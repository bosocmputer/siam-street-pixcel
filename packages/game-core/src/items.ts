import { getItemDef } from './lookup';
import { pickWeighted, type Rng } from './rng';
import {
  RARITIES,
  type GameConfig,
  type ItemBonus,
  type ItemDef,
  type ItemInstance,
  type PlayerState,
  type Rarity,
  type Result,
} from './types';

export function itemScale(inst: ItemInstance, cfg: GameConfig): number {
  const i = cfg.balance.items;
  return i.rarityMult[inst.rarity] * (1 + inst.upgrade * i.upgradePerLevel);
}

export function scaledBonus(inst: ItemInstance, cfg: GameConfig): ItemBonus {
  const def = getItemDef(cfg, inst.defId);
  const k = itemScale(inst, cfg);
  const out: ItemBonus = {};
  for (const [key, v] of Object.entries(def.bonus)) {
    (out as Record<string, number>)[key] = (v as number) * k;
  }
  return out;
}

/** A single comparable number for "which item is better" (used by policies / UI sorting). */
export function itemPower(inst: ItemInstance, cfg: GameConfig): number {
  const b = scaledBonus(inst, cfg);
  const def = getItemDef(cfg, inst.defId);
  const k = itemScale(inst, cfg);
  let p = (b.atk ?? 0) * 2 + (b.def ?? 0) * 2 + (b.hp ?? 0) * 0.5;
  p += ((b.str ?? 0) + (b.agi ?? 0) + (b.vit ?? 0) + (b.int ?? 0)) * 4;
  for (const v of Object.values(def.resist ?? {})) p += v * k * 40;
  for (const v of Object.values(def.rates ?? {})) p += v * k * 60;
  return p;
}

export function rarityWeights(stage: number, cfg: GameConfig): number[] {
  const r = cfg.balance.rewards;
  return RARITIES.map((q) =>
    q === 'common' ? r.rarityWeights.common : r.rarityWeights[q] * (1 + r.rarityStageShift * stage),
  );
}

/** Roll one dropped item. The uid comes from the state counter (deterministic). */
export function rollItem(stage: number, cfg: GameConfig, rng: Rng, uid: string): ItemInstance {
  const pool = cfg.items.filter((i) => i.minStage <= stage);
  const def: ItemDef = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] as ItemDef;
  const rarity = RARITIES[pickWeighted(rarityWeights(stage, cfg), rng)] as Rarity;
  return { uid, defId: def.id, rarity, upgrade: 0 };
}

export function rarityIndex(r: Rarity): number {
  return RARITIES.indexOf(r);
}

/** Like rollItem, but never below `min` (used for guaranteed rewards). */
export function rollItemAtLeast(
  stage: number,
  cfg: GameConfig,
  rng: Rng,
  uid: string,
  min: Rarity,
): ItemInstance {
  const pool = cfg.items.filter((i) => i.minStage <= stage);
  const def = pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))] as ItemDef;
  const floor = rarityIndex(min);
  const weights = rarityWeights(stage, cfg).map((w, i) => (i < floor ? 0 : w));
  return { uid, defId: def.id, rarity: RARITIES[pickWeighted(weights, rng)] as Rarity, upgrade: 0 };
}

export function upgradeCost(inst: ItemInstance, cfg: GameConfig) {
  const i = cfg.balance.items;
  const def = getItemDef(cfg, inst.defId);
  const n = inst.upgrade;
  return {
    coins: Math.round(i.upgradeCoinBase * Math.pow(i.upgradeCoinGrowth, n)),
    jelly: i.upgradeJellyBase * (n + 1),
    material: { id: def.material, qty: i.upgradeMaterialBase * (n + 1) },
  };
}

export type UpgradeFail = 'notFound' | 'maxed' | 'noCoins' | 'noJelly' | 'noMaterial';

/** Upgrading never fails or breaks the item; it only needs resources. */
export function upgradeItem(
  state: PlayerState,
  uid: string,
  cfg: GameConfig,
): Result<{ state: PlayerState }, UpgradeFail> {
  const idx = state.items.findIndex((x) => x.uid === uid);
  const inst = state.items[idx];
  if (!inst) return { ok: false, reason: 'notFound' };
  if (inst.upgrade >= cfg.balance.items.upgradeMax) return { ok: false, reason: 'maxed' };
  const cost = upgradeCost(inst, cfg);
  if (state.coins < cost.coins) return { ok: false, reason: 'noCoins' };
  if ((state.materials.jelly ?? 0) < cost.jelly) return { ok: false, reason: 'noJelly' };
  if ((state.materials[cost.material.id] ?? 0) < cost.material.qty) {
    return { ok: false, reason: 'noMaterial' };
  }
  const next = structuredClone(state);
  next.coins -= cost.coins;
  next.materials.jelly = (next.materials.jelly ?? 0) - cost.jelly;
  next.materials[cost.material.id] = (next.materials[cost.material.id] ?? 0) - cost.material.qty;
  const target = next.items[idx];
  if (target) target.upgrade += 1;
  return { ok: true, state: next };
}

export function salvageYield(rarity: Rarity, cfg: GameConfig) {
  const r = cfg.balance.rewards;
  return { jelly: r.salvageJelly[rarity], coins: r.salvageCoins[rarity] };
}

export type SalvageFail = 'equipped' | 'notFound';

/** Break items down into jelly + coins. Equipped items are never salvaged. */
export function salvageItems(
  state: PlayerState,
  uids: string[],
  cfg: GameConfig,
): Result<{ state: PlayerState; jelly: number; coins: number }, SalvageFail> {
  const equipped = new Set(Object.values(state.equipment));
  for (const uid of uids) {
    if (equipped.has(uid)) return { ok: false, reason: 'equipped' };
    if (!state.items.some((x) => x.uid === uid)) return { ok: false, reason: 'notFound' };
  }
  const next = structuredClone(state);
  let jelly = 0;
  let coins = 0;
  const gone = new Set(uids);
  for (const it of next.items) {
    if (gone.has(it.uid)) {
      const y = salvageYield(it.rarity, cfg);
      jelly += y.jelly;
      coins += y.coins;
    }
  }
  next.items = next.items.filter((x) => !gone.has(x.uid));
  next.materials.jelly = (next.materials.jelly ?? 0) + jelly;
  next.coins += coins;
  return { ok: true, state: next, jelly, coins };
}
