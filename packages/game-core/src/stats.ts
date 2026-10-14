import { bestiaryBonus } from './bestiary';
import { getForm, getItemDef, getSkill } from './lookup';
import { scaledBonus, itemScale } from './items';
import {
  ELEMENTS,
  STAT_KEYS,
  type ComboMods,
  type Element,
  type GameConfig,
  type PlayerState,
  type SkillDef,
  type StyleDef,
  type Stats,
} from './types';

export interface EquippedSkill {
  def: SkillDef;
  level: number;
}

export interface Derived {
  level: number;
  stats: Stats; // effective stats (allocated + form + items)
  hp: number;
  atk: number;
  def: number;
  atkSpeed: number;
  crit: number;
  critDamage: number;
  skillPow: number;
  cdr: number;
  resist: Record<Element, number>;
  style: StyleDef;
  formElement: Element | null;
  actives: EquippedSkill[];
  passives: EquippedSkill[];
  combo: Required<ComboMods>;
  lifesteal: number;
  slow: number;
  reflect: number;
  rates: { coin: number; exp: number; drop: number; core: number };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Count tags over the equipped skills and merge the matching combo bonuses. */
export function comboMods(skills: SkillDef[], cfg: GameConfig): Required<ComboMods> {
  const counts = new Map<string, number>();
  for (const s of skills) for (const t of new Set(s.tags)) counts.set(t, (counts.get(t) ?? 0) + 1);
  const out: Required<ComboMods> = {
    dmgMult: 1,
    critAdd: 0,
    dotMult: 0,
    slow: 0,
    lifesteal: 0,
    speedMult: 1,
    defMult: 1,
  };
  for (const [tag, n] of counts) {
    const tiers = cfg.combos[tag];
    if (!tiers) continue;
    let best: ComboMods | undefined;
    let bestN = 0;
    for (const [need, mods] of Object.entries(tiers)) {
      const k = Number(need);
      if (n >= k && k > bestN) {
        best = mods;
        bestN = k;
      }
    }
    if (!best) continue;
    out.dmgMult *= best.dmgMult ?? 1;
    out.speedMult *= best.speedMult ?? 1;
    out.defMult *= best.defMult ?? 1;
    out.critAdd += best.critAdd ?? 0;
    out.dotMult += best.dotMult ?? 0;
    out.slow += best.slow ?? 0;
    out.lifesteal += best.lifesteal ?? 0;
  }
  return out;
}

export function computeDerived(state: PlayerState, cfg: GameConfig): Derived {
  const b = cfg.balance;
  const s = b.stats;
  const form = getForm(cfg, state.formId);

  // equipment
  const flat = { atk: 0, def: 0, hp: 0 };
  const eStats: Stats = { str: 0, agi: 0, vit: 0, int: 0 };
  const resist: Record<Element, number> = { earth: 0, water: 0, fire: 0, wind: 0 };
  const rates = { coin: 0, exp: 0, drop: 0, core: 0 };
  let critFromItems = 0;
  let styleId: StyleDef | undefined;
  for (const uid of Object.values(state.equipment)) {
    const inst = state.items.find((x) => x.uid === uid);
    if (!inst) continue;
    const def = getItemDef(cfg, inst.defId);
    const bonus = scaledBonus(inst, cfg);
    flat.atk += bonus.atk ?? 0;
    flat.def += bonus.def ?? 0;
    flat.hp += bonus.hp ?? 0;
    for (const k of STAT_KEYS) eStats[k] += bonus[k] ?? 0;
    const k = itemScale(inst, cfg);
    for (const e of ELEMENTS) resist[e] += (def.resist?.[e] ?? 0) * k;
    rates.coin += (def.rates?.coin ?? 0) * k;
    rates.exp += (def.rates?.exp ?? 0) * k;
    rates.drop += (def.rates?.drop ?? 0) * k;
    rates.core += (def.rates?.core ?? 0) * k;
    critFromItems += (def.rates?.crit ?? 0) * k;
    if (def.slot === 'weapon' && def.style) styleId = cfg.styles[def.style];
  }
  for (const e of ELEMENTS) resist[e] = Math.min(b.combat.resistCap, resist[e]);
  const style = styleId ?? cfg.styles.none;

  const stats: Stats = { str: 0, agi: 0, vit: 0, int: 0 };
  for (const k of STAT_KEYS) stats[k] = state.stats[k] + (form.statBonus[k] ?? 0) + eStats[k];

  // skills
  const equipped = (ids: (string | null)[]): EquippedSkill[] =>
    ids.flatMap((id) => {
      if (!id) return [];
      const owned = state.skills[id];
      if (!owned || owned.level < 1) return [];
      return [{ def: getSkill(cfg, id), level: owned.level }];
    });
  const actives = equipped(state.activeSkills);
  const passives = equipped(state.passiveSkills);
  const all = [...actives, ...passives];
  const combo = comboMods(
    all.map((x) => x.def),
    cfg,
  );

  let atkBonus = 0;
  let hpBonus = 0;
  let defBonus = 0;
  let speedBonus = 0;
  let critBonus = 0;
  let lifesteal = 0;
  let slow = 0;
  let reflect = style.reflect;
  for (const { def } of all) {
    const f = def.effects;
    atkBonus += f.atkBonus ?? 0;
    hpBonus += f.hpBonus ?? 0;
    defBonus += f.defBonus ?? 0;
    speedBonus += f.atkSpeedBonus ?? 0;
    critBonus += f.critBonus ?? 0;
    lifesteal += f.lifesteal ?? 0;
    slow = Math.max(slow, f.slow ?? 0);
    reflect += f.reflect ?? 0;
  }
  lifesteal += combo.lifesteal;
  slow += combo.slow;

  const bestiary = bestiaryBonus(state, cfg);
  const level = state.level;
  const hp =
    (s.hpBase + stats.vit * s.hpPerVit + level * s.hpPerLevel + flat.hp) *
    (1 + hpBonus) *
    bestiary.hpMult;
  const atk =
    (s.atkBase + stats.str * s.atkPerStr + level * s.atkPerLevel + flat.atk) *
    (1 + atkBonus) *
    bestiary.atkMult;
  const def = (stats.vit * s.defPerVit + flat.def) * (1 + defBonus) * combo.defMult * style.defMult;
  const atkSpeed = Math.min(
    s.atkSpeedMax,
    (s.atkSpeedBase + stats.agi * s.atkSpeedPerAgi) *
      (1 + speedBonus) *
      combo.speedMult *
      style.speedMult,
  );
  const crit = clamp(
    s.critBase + stats.agi * s.critPerAgi + critBonus + combo.critAdd + critFromItems,
    0,
    s.critMax,
  );

  return {
    level,
    stats,
    hp,
    atk,
    def,
    atkSpeed,
    crit,
    critDamage: s.critDamage,
    skillPow: 1 + stats.int * s.skillPowPerInt,
    cdr: Math.min(s.cdrMax, stats.int * s.cdrPerInt),
    resist,
    style,
    formElement: form.element,
    actives,
    passives,
    combo,
    lifesteal: Math.min(0.5, lifesteal),
    slow: Math.min(0.6, slow),
    reflect: Math.min(0.5, reflect),
    rates,
  };
}
