import type {
  ClaimReport,
  SlimeLook,
  PlayerState,
  Rarity,
  Slot,
  StatKey,
} from '@slimehood/game-core';

/** Every change a player can make. The local backend runs them with game-core; M4 sends them to the server. */
export type Action =
  | { t: 'claim' }
  | { t: 'absorb'; monsterId: string; count: number | 'all' }
  | { t: 'awaken'; skillId: string; choice: string }
  | { t: 'allocate'; stat: StatKey; amount: number }
  | { t: 'resetStats' }
  | { t: 'equipSkill'; kind: 'active' | 'passive'; index: number; skillId: string | null }
  | { t: 'equipItem'; uid: string }
  | { t: 'unequip'; slot: Slot }
  | { t: 'upgrade'; uid: string }
  | { t: 'salvage'; uids: string[] }
  | { t: 'autoSalvage'; below: Rarity | null }
  | { t: 'evolve'; formId: string }
  | { t: 'setFarm'; districtId: string; stage: number }
  | { t: 'savePreset'; index: number }
  | { t: 'applyPreset'; index: number }
  | { t: 'chooseHome'; districtId: string };

export type ActionResult =
  | { ok: true; state: PlayerState; report?: ClaimReport; info?: Record<string, unknown> }
  | { ok: false; reason: string };

export interface Backend {
  /** Saved game, or null for a brand-new player. */
  load(): Promise<PlayerState | null>;
  /** Start a new game with what the player picked in the creator. */
  create(profile: { name: string; look: SlimeLook }): Promise<PlayerState>;
  exec(state: PlayerState, action: Action): Promise<ActionResult>;
  /** Server time in seconds (local clock in the local backend). */
  now(): number;
  reset(): Promise<void>;
}
