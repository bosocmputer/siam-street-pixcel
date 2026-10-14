import { elementMult } from './elements';
import { skillPowerAt } from './skills';
import type { Derived } from './stats';
import type { Element, GameConfig, MonsterDef, RuleEffects } from './types';

export interface FightContext {
  rule?: RuleEffects | null;
  carry?: boolean; // a "แบกเพื่อน" helper is active
}

export interface FightEval {
  playerDps: number;
  monsterDps: number;
  monsterHp: number;
  ttk: number; // seconds to kill one monster
  damageTaken: number; // HP lost per kill
  survives: boolean;
  killCycle: number; // ttk + respawn
}

const ruleDmg = (rule: RuleEffects | null | undefined, el: Element | null): number =>
  el ? (rule?.damageMultByElement?.[el] ?? 1) : 1;

/** Expected damage per second against a target element (no monster stats involved). */
export function playerDps(
  d: Derived,
  targetEl: Element | null,
  cfg: GameConfig,
  ctx: FightContext = {},
): number {
  const critChance = Math.min(1, Math.max(0, d.crit + (ctx.rule?.critAdd ?? 0)));
  const critMult = 1 + critChance * (d.critDamage - 1);
  const dmgMult = d.combo.dmgMult * (ctx.carry ? 1 + cfg.balance.carry.dpsBonus : 1);
  const styleDot = d.style.dotMult;

  const basic =
    d.atk *
    d.style.atkMult *
    d.atkSpeed *
    critMult *
    elementMult(d.formElement, targetEl, cfg) *
    ruleDmg(ctx.rule, d.formElement) *
    dmgMult *
    (1 + styleDot);

  let skills = 0;
  for (const { def, level, powerMult, cdMult } of d.actives) {
    const cd = (def.cooldown ?? 1) * cdMult * (1 - d.cdr);
    const dot = (def.effects.dotMult ?? 0) > 0 ? (def.effects.dotMult ?? 0) + d.combo.dotMult : 0;
    skills +=
      ((d.atk * d.skillPow * d.style.skillMult * skillPowerAt(def, level, cfg) * powerMult) / cd) *
      critMult *
      elementMult(def.element, targetEl, cfg) *
      ruleDmg(ctx.rule, def.element) *
      dmgMult *
      (1 + dot + styleDot) *
      (def.effects.multiTarget ? cfg.balance.combat.multiTargetBonus : 1);
  }
  return basic + skills;
}

/** Evaluate one monster at one stage of a district (`stageOffset` is the district's offset). */
export function evaluateFight(
  d: Derived,
  monster: MonsterDef,
  stage: number,
  stageOffset: number,
  cfg: GameConfig,
  ctx: FightContext = {},
): FightEval {
  const c = cfg.balance.combat;
  const eff = stage + stageOffset;
  const scaleHp = Math.pow(1 + c.hpStep * (eff - 1), c.hpPower);
  const scaleAtk = Math.pow(1 + c.atkStep * (eff - 1), c.atkPower);
  const monsterHp = monster.hp * scaleHp;

  const enemyAtk =
    monster.atk * scaleAtk * (ctx.rule?.enemyAtkMultByElement?.[monster.element] ?? 1);
  const speed = monster.atkSpeed * (1 - d.slow);
  const incoming =
    elementMult(monster.element, d.formElement, cfg) * (1 - d.resist[monster.element]);
  const monsterDps = enemyAtk * speed * (c.defConstant / (c.defConstant + d.def)) * incoming;

  const dealt = playerDps(d, monster.element, cfg, ctx);
  const reflected = d.reflect * monsterDps;
  const dps = Math.max(1e-9, dealt + reflected);
  const ttk = monsterHp / dps;
  const heal = d.lifesteal * dealt;
  // lifesteal can soften incoming damage but never make the slime immortal
  const damageTaken = Math.max(monsterDps * (1 - c.maxHealFraction), monsterDps - heal) * ttk;

  return {
    playerDps: dps,
    monsterDps,
    monsterHp,
    ttk,
    damageTaken,
    survives: damageTaken <= d.hp * c.maxDamagePerKillFraction,
    killCycle: ttk + cfg.balance.idle.respawnSeconds,
  };
}
