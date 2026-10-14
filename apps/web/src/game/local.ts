import {
  absorb,
  allocateStat,
  applyPreset,
  awaken,
  claim,
  createNewPlayer,
  defaultConfig as cfg,
  equipItem,
  equipSkill,
  evolve,
  grantTutorialCores,
  resetStats,
  salvageItems,
  savePreset,
  setAutoSalvage,
  setFarmTarget,
  unequipSlot,
  upgradeItem,
  type PlayerState,
} from '@slimehood/game-core';
import type { Action, ActionResult, Backend } from './backend';

const KEY = 'slimehood-save-v1';

interface SaveFile {
  version: 1;
  state: PlayerState;
  claims: number;
}

// If localStorage is unavailable (private mode, blocked) the game still works for this tab.
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function write(text: string): void {
  memory = text;
  try {
    localStorage.setItem(KEY, text);
  } catch {
    /* keep the in-memory copy */
  }
}

export function loadSave(): SaveFile | null {
  const raw = read();
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as SaveFile;
    if (f && f.version === 1 && f.state && typeof f.state.level === 'number') return f;
  } catch {
    /* corrupt save: start over rather than crash */
  }
  return null;
}

export class LocalBackend implements Backend {
  private claims = loadSave()?.claims ?? 0;
  /** Debug only: shifts the clock so tests can "wait" for hours. */
  offsetSeconds = 0;

  now(): number {
    return Math.floor(Date.now() / 1000) + this.offsetSeconds;
  }

  async load(): Promise<PlayerState | null> {
    return loadSave()?.state ?? null;
  }

  async create(homeDistrictId: string): Promise<PlayerState> {
    const state = grantTutorialCores(createNewPlayer(cfg, homeDistrictId, this.now()), cfg);
    this.claims = 0;
    this.persist(state);
    return state;
  }

  async reset(): Promise<void> {
    memory = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  private persist(state: PlayerState): void {
    write(JSON.stringify({ version: 1, state, claims: this.claims } satisfies SaveFile));
  }

  async exec(state: PlayerState, a: Action): Promise<ActionResult> {
    const out = this.run(state, a);
    if (out.ok) this.persist(out.state);
    return out;
  }

  private run(state: PlayerState, a: Action): ActionResult {
    const wrap = <T extends { ok: boolean }>(r: T) =>
      r as T & ({ ok: true; state: PlayerState } | { ok: false; reason: string });
    switch (a.t) {
      case 'claim': {
        this.claims += 1;
        const r = claim(state, this.now(), `local:${state.lastClaimAt}:${this.claims}`, cfg);
        if (!r.ok) {
          this.claims -= 1;
          return r;
        }
        return { ok: true, state: r.state, report: r.report };
      }
      case 'absorb': {
        const r = absorb(state, a.monsterId, a.count, cfg);
        return r.ok ? { ok: true, state: r.state, info: { ...r } } : r;
      }
      case 'awaken':
        return wrap(awaken(state, a.skillId, a.choice, cfg));
      case 'allocate':
        return wrap(allocateStat(state, a.stat, a.amount));
      case 'resetStats':
        return { ok: true, state: resetStats(state) };
      case 'equipSkill':
        return wrap(equipSkill(state, a.kind, a.index, a.skillId, cfg));
      case 'equipItem':
        return wrap(equipItem(state, a.uid, cfg));
      case 'unequip':
        return { ok: true, state: unequipSlot(state, a.slot) };
      case 'upgrade':
        return wrap(upgradeItem(state, a.uid, cfg));
      case 'salvage': {
        const r = salvageItems(state, a.uids, cfg);
        return r.ok ? { ok: true, state: r.state, info: { jelly: r.jelly, coins: r.coins } } : r;
      }
      case 'autoSalvage':
        return { ok: true, state: setAutoSalvage(state, a.below) };
      case 'evolve': {
        const r = evolve(state, a.formId, cfg);
        return r.ok ? { ok: true, state: r.state, info: { skillId: r.skillId } } : r;
      }
      case 'setFarm':
        return wrap(setFarmTarget(state, a.districtId, a.stage, cfg));
      case 'savePreset':
        return wrap(savePreset(state, a.index, cfg));
      case 'applyPreset':
        return wrap(applyPreset(state, a.index, cfg));
    }
  }
}
