import {
  absorb,
  awaken,
  awakenOptions,
  awakenReady,
  getSkill,
  allocateStat,
  applyPreset as _applyPreset,
  computeDerived,
  equipItem,
  equipSkill,
  evaluateFight,
  evolutionOptions,
  evolve,
  getDistrict,
  getMonster,
  itemPower,
  getItemDef,
  salvageItems,
  setAutoSalvage,
  setFarmTarget,
  upgradeItem,
  type Element,
  type GameConfig,
  type PlayerState,
  type Slot,
  type StatKey,
} from '@slimehood/game-core';

void _applyPreset;

export interface Policy {
  statWeights: Record<StatKey, number>;
}

export const defaultPolicy: Policy = {
  statWeights: { str: 0.4, agi: 0.2, vit: 0.25, int: 0.15 },
};

/** How good a state is for farming `districtId` at `stage`: kills per second if it can survive. */
export function farmScore(state: PlayerState, cfg: GameConfig, districtId: string, stage: number) {
  const d = computeDerived(state, cfg);
  const district = getDistrict(cfg, districtId);
  let cycle = 0;
  let dmg = 0;
  let ok = true;
  const total = district.monsters.reduce((s, m) => s + m.weight, 0);
  for (const dm of district.monsters) {
    const f = evaluateFight(d, getMonster(cfg, dm.id), stage, district.stageOffset, cfg);
    if (!f.survives) ok = false;
    cycle += (dm.weight / total) * f.killCycle;
    dmg += (dm.weight / total) * (f.damageTaken / d.hp);
  }
  // survivable states are always better than unsurvivable ones; then faster is better
  return (ok ? 1000 : 0) + (ok ? 1 / cycle : -dmg);
}

function combos<T>(list: T[], k: number): T[][] {
  if (k === 0) return [[]];
  const out: T[][] = [];
  const go = (start: number, acc: T[]) => {
    if (acc.length === k) {
      out.push([...acc]);
      return;
    }
    for (let i = start; i < list.length; i++) {
      acc.push(list[i] as T);
      go(i + 1, acc);
      acc.pop();
    }
  };
  go(0, []);
  return out;
}

function bestSkills(
  state: PlayerState,
  cfg: GameConfig,
  kind: 'active' | 'passive',
  districtId: string,
  stage: number,
): PlayerState {
  const owned = Object.entries(state.skills)
    .filter(([id, s]) => s.level >= 1 && cfg.skills.find((x) => x.id === id)?.kind === kind)
    .map(([id]) => id);
  const slots = kind === 'active' ? state.activeSkills.length : state.passiveSkills.length;
  const k = Math.min(slots, owned.length);
  let best = state;
  let bestScore = -Infinity;
  for (const pick of combos(owned, k)) {
    const cand = structuredClone(state);
    const list = kind === 'active' ? cand.activeSkills : cand.passiveSkills;
    for (let i = 0; i < list.length; i++) list[i] = pick[i] ?? null;
    const score = farmScore(cand, cfg, districtId, stage);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

/** Follow the campaign: finish the districts in order, grind the last one when everything is cleared. */
export function chooseFarm(
  state: PlayerState,
  cfg: GameConfig,
): { districtId: string; stage: number } {
  const probe = (districtId: string, stage: number) =>
    farmScore(state, cfg, districtId, stage) >= 1000;
  for (const d of cfg.districts) {
    const cleared = state.progress[d.id] ?? 0;
    if (cleared >= d.stageCount) continue;
    if (!probe(d.id, 1)) break; // too hard yet: stay on what we have
    return { districtId: d.id, stage: Math.min(cleared + 1, d.stageCount) };
  }
  // everything reachable is cleared: grind the last cleared district's top stage
  const done = [...cfg.districts]
    .reverse()
    .find((d) => (state.progress[d.id] ?? 0) >= d.stageCount);
  const d = done ?? (cfg.districts[0] as NonNullable<(typeof cfg.districts)[number]>);
  return { districtId: d.id, stage: d.stageCount };
}

/** One "open the app" session: do what a sensible player would do. */
export function playSession(
  input: PlayerState,
  cfg: GameConfig,
  policy: Policy = defaultPolicy,
  sessionNo = 0,
  preferElement: Element | null = null,
  naive = false, // a player who never touches skills or gear (to measure how much builds matter)
): { state: PlayerState; log: string[] } {
  let s = input;
  const log: string[] = [];

  // 1. absorb everything
  for (const id of Object.keys(s.cores)) {
    const r = absorb(s, id, 'all', cfg);
    if (r.ok) {
      s = r.state;
      if (r.unlocked) log.push(`unlock:${r.skillId}`);
    }
  }

  // 1b. awaken skills whose gauge is full: try every choice and keep the one that farms best
  for (const id of Object.keys(s.skills)) {
    if (!awakenReady(s, id, cfg)) continue;
    const kind = getSkill(cfg, id).kind;
    const farmNow = chooseFarm(s, cfg);
    let best: PlayerState | null = null;
    let bestScore = -Infinity;
    let bestChoice = '';
    for (const choice of awakenOptions(getSkill(cfg, id), cfg)) {
      const r = awaken(s, id, choice, cfg);
      if (!r.ok) continue;
      const tuned = bestSkills(r.state, cfg, kind, farmNow.districtId, farmNow.stage);
      const score = farmScore(tuned, cfg, farmNow.districtId, farmNow.stage);
      if (score > bestScore) {
        bestScore = score;
        best = r.state;
        bestChoice = choice;
      }
    }
    if (best) {
      s = best;
      log.push(`awaken:${id}:${bestChoice}`);
    }
  }

  // 2. evolve
  for (let i = 0; i < 3; i++) {
    const opts = evolutionOptions(s, cfg);
    const first = opts.find((f) => f.element === preferElement) ?? opts[0];
    if (!first) break;
    const r = evolve(s, first.id, cfg);
    if (!r.ok) break;
    s = r.state;
    log.push(`evolve:${first.id}`);
  }

  // 3. stat points, by weights (greedy toward the target ratio)
  while (s.statPoints > 0) {
    const total = Object.values(s.stats).reduce((a, b) => a + b, 0) + 1;
    let pick: StatKey = 'str';
    let gap = -Infinity;
    for (const k of Object.keys(policy.statWeights) as StatKey[]) {
      const g = policy.statWeights[k] * total - s.stats[k];
      if (g > gap) {
        gap = g;
        pick = k;
      }
    }
    const n = Math.min(s.statPoints, Math.max(1, Math.floor(s.statPoints / 4)));
    const r = allocateStat(s, pick, n);
    if (!r.ok) break;
    s = r.state;
  }

  // 4. equipment: best per slot by actual farm score (charm by item power)
  const farm0 = chooseFarm(s, cfg);
  const slots: Slot[] = ['weapon', 'head', 'skin', 'charm'];
  for (const slot of naive ? [] : slots) {
    const cands = s.items.filter((i) => getItemDef(cfg, i.defId).slot === slot);
    let bestUid: string | undefined;
    let bestScore = -Infinity;
    for (const c of cands) {
      const r = equipItem(s, c.uid, cfg);
      if (!r.ok) continue;
      const score =
        slot === 'charm'
          ? itemPower(c, cfg)
          : farmScore(r.state, cfg, farm0.districtId, farm0.stage);
      if (score > bestScore) {
        bestScore = score;
        bestUid = c.uid;
      }
    }
    if (bestUid) {
      const r = equipItem(s, bestUid, cfg);
      if (r.ok) s = r.state;
    }
  }

  // 5. upgrade equipped items while we can afford it (weapon first)
  for (let guard = 0; guard < 40; guard++) {
    let did = false;
    for (const slot of slots) {
      const uid = s.equipment[slot];
      if (!uid) continue;
      const r = upgradeItem(s, uid, cfg);
      if (r.ok) {
        s = r.state;
        did = true;
      }
    }
    if (!did) break;
  }

  // 6. salvage everything not equipped
  const equipped = new Set(Object.values(s.equipment));
  const spare = s.items.filter((i) => !equipped.has(i.uid)).map((i) => i.uid);
  if (spare.length) {
    const r = salvageItems(s, spare, cfg);
    if (r.ok) s = r.state;
  }
  if (s.level >= 10) s = setAutoSalvage(s, 'good');

  // 7. farm target (every other session, hunt a district whose monsters we have not all absorbed yet)
  let farm = chooseFarm(s, cfg);
  if (sessionNo % 2 === 1) {
    const need = cfg.districts.find(
      (d) =>
        d.monsters.some((m) => (s.bestiary[m.id] ?? 0) < 1) && farmScore(s, cfg, d.id, 1) >= 1000,
    );
    if (need) farm = { districtId: need.id, stage: 1 };
  }
  const f = setFarmTarget(s, farm.districtId, farm.stage, cfg);
  if (f.ok) s = f.state;
  const main = chooseFarm(s, cfg);
  if (!naive) {
    s = bestSkills(s, cfg, 'active', main.districtId, main.stage);
    s = bestSkills(s, cfg, 'passive', main.districtId, main.stage);
  }

  // (re-apply through the public API so invalid loadouts would be caught in tests)
  for (let i = 0; i < s.activeSkills.length; i++) {
    const id = s.activeSkills[i] ?? null;
    const r = equipSkill(s, 'active', i, id, cfg);
    if (r.ok) s = r.state;
  }
  return { state: s, log };
}
