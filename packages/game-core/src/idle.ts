import { evaluateFight, playerDps, type FightContext } from './combat';
import { elementMult, elementThatBeats } from './elements';
import { getBoss, getDistrict, getMonster } from './lookup';
import { capacity, usedSlots } from './inventory';
import { rarityIndex, rollItem, rollItemAtLeast, salvageYield } from './items';
import { addExp } from './progression';
import { createRng, pickWeighted, rollCount, type Rng } from './rng';
import { computeDerived, type Derived } from './stats';
import type { Element, GameConfig, ItemInstance, PlayerState, Result, RuleEffects } from './types';

export interface ClaimOptions {
  rule?: RuleEffects | null; // this week's district rule
  carry?: boolean; // a "แบกเพื่อน" helper joined this claim
  bossId?: string | null; // contribute damage to this district boss
}

export interface Hint {
  reason: 'element' | 'defense' | 'damage';
  monsterId: string;
  monsterElement: Element;
  suggestElement?: Element;
}

export interface ClaimReport {
  elapsedSeconds: number;
  effectiveSeconds: number;
  restedSeconds: number; // extra time credited for time spent away beyond the cap
  kills: number;
  targetStage: number;
  farmedStage: number; // 0 when stuck
  stagesCleared: number[];
  milestones: { stage: number; final: boolean }[]; // guaranteed rewards for clearing every 5th stage
  golden: { count: number; byMonster: Record<string, number> }; // lucky golden monsters met
  stuck: boolean;
  hint?: Hint;
  exp: number;
  coins: number;
  levelsGained: number;
  cores: Record<string, number>;
  materials: Record<string, number>;
  items: ItemInstance[];
  salvaged: { count: number; jelly: number; coins: number };
  bossDamage: number;
}

export type ClaimFail = 'tooSoon';

/** Kills needed to clear a stage. Early stages are quick, later ones take longer. */
export function killsForStage(stage: number, cfg: GameConfig, killMult = 1): number {
  const i = cfg.balance.idle;
  return Math.max(
    1,
    Math.round(i.killsPerStage * killMult * Math.pow(i.killsPerStageGrowth, stage - 1)),
  );
}

const bump = (map: Record<string, number>, key: string, n: number) => {
  if (n > 0) map[key] = (map[key] ?? 0) + n;
};

/** Why a stage is too hard, in terms the player can act on ("try water skills"). */
export function diagnoseStage(
  d: Derived,
  districtId: string,
  stage: number,
  cfg: GameConfig,
  ctx: FightContext = {},
): Hint | undefined {
  const district = getDistrict(cfg, districtId);
  for (const dm of district.monsters) {
    const m = getMonster(cfg, dm.id);
    const fight = evaluateFight(d, m, stage, district.stageOffset, cfg, ctx);
    if (fight.survives) continue;
    const incomingElem = elementMult(m.element, d.formElement, cfg);
    if (incomingElem > 1) {
      return {
        reason: 'element',
        monsterId: m.id,
        monsterElement: m.element,
        suggestElement: elementThatBeats(m.element, cfg),
      };
    }
    const dmgAdv = playerDps(d, m.element, cfg, ctx) / Math.max(1e-9, d.atk);
    return {
      reason: dmgAdv < 3 ? 'damage' : 'defense',
      monsterId: m.id,
      monsterElement: m.element,
      suggestElement: elementThatBeats(m.element, cfg),
    };
  }
  return undefined;
}

/** Damage dealt to a district boss over `seconds` of farming. */
export function bossDamage(
  d: Derived,
  bossId: string,
  seconds: number,
  cfg: GameConfig,
  ctx: FightContext = {},
): number {
  const boss = getBoss(cfg, bossId);
  return playerDps(d, boss.element, cfg, ctx) * seconds * cfg.balance.boss.uptime;
}

/**
 * Settle everything the slime did since the last claim. Pure and deterministic:
 * same state + same server time + same seed => same result.
 *
 * Simplification: the whole window is simulated with the player's stats at the start of the
 * window (level-ups inside the window do not speed up the same window).
 */
export function claim(
  state: PlayerState,
  now: number,
  seed: string,
  cfg: GameConfig,
  opts: ClaimOptions = {},
): Result<{ state: PlayerState; report: ClaimReport }, ClaimFail> {
  const idle = cfg.balance.idle;
  const raw = now - state.lastClaimAt;
  if (raw < idle.minClaimIntervalSeconds) return { ok: false, reason: 'tooSoon' };

  const capped = Math.min(raw, idle.capSeconds);
  // time beyond the cap is not lost: it still counts at a reduced rate ("พลังสะสมนอกเวลา")
  const rested =
    Math.min(Math.max(0, raw - idle.capSeconds), idle.restedMaxSeconds) * idle.restedRate;
  const effective = capped + rested;

  const rng: Rng = createRng(seed);
  const st = structuredClone(state);
  const d = computeDerived(st, cfg);
  const ctx: FightContext = { rule: opts.rule ?? null, carry: opts.carry ?? false };
  const district = getDistrict(cfg, st.farm.districtId);
  const monsters = district.monsters.map((m) => ({ def: getMonster(cfg, m.id), weight: m.weight }));
  const totalWeight = monsters.reduce((s, m) => s + m.weight, 0);

  const report: ClaimReport = {
    elapsedSeconds: raw,
    effectiveSeconds: effective,
    restedSeconds: rested,
    kills: 0,
    targetStage: Math.min(st.farm.stage, (st.progress[district.id] ?? 0) + 1),
    farmedStage: 0,
    stagesCleared: [],
    milestones: [],
    golden: { count: 0, byMonster: {} },
    stuck: false,
    exp: 0,
    coins: 0,
    levelsGained: 0,
    cores: {},
    materials: {},
    items: [],
    salvaged: { count: 0, jelly: 0, coins: 0 },
    bossDamage: 0,
  };

  const stageCache = new Map<number, { ok: boolean; kps: number }>();
  const stageEval = (stage: number) => {
    let hit = stageCache.get(stage);
    if (!hit) {
      let ok = true;
      let cycle = 0;
      for (const m of monsters) {
        const f = evaluateFight(d, m.def, stage, district.stageOffset, cfg, ctx);
        if (!f.survives) ok = false;
        cycle += (m.weight / totalWeight) * f.killCycle;
      }
      hit = { ok, kps: ok ? 1 / cycle : 0 };
      stageCache.set(stage, hit);
    }
    return hit;
  };

  const expMult = (1 + d.rates.exp) * (ctx.rule?.expMult ?? 1);
  const coinMult = (1 + d.rates.coin) * (ctx.rule?.coinMult ?? 1);

  const addDrop = (inst: ItemInstance) => {
    const salvage =
      (st.autoSalvageBelow !== null &&
        rarityIndex(inst.rarity) < rarityIndex(st.autoSalvageBelow)) ||
      usedSlots(st) >= capacity(st, cfg);
    if (salvage) {
      const y = salvageYield(inst.rarity, cfg);
      bump(st.materials, 'jelly', y.jelly);
      bump(report.materials, 'jelly', y.jelly);
      st.coins += y.coins;
      report.salvaged.count += 1;
      report.salvaged.jelly += y.jelly;
      report.salvaged.coins += y.coins;
    } else {
      st.items.push(inst);
      report.items.push(inst);
    }
  };

  const applyKills = (stage: number, kills: number) => {
    if (kills <= 0) return;
    report.kills += kills;
    const per = monsters.map((m) => Math.floor((kills * m.weight) / totalWeight));
    let rest = kills - per.reduce((s, n) => s + n, 0);
    while (rest-- > 0) {
      const i = pickWeighted(
        monsters.map((m) => m.weight),
        rng,
      );
      per[i] = (per[i] ?? 0) + 1;
    }
    const r = cfg.balance.rewards;
    const eff = stage + district.stageOffset;
    monsters.forEach((m, i) => {
      const k = per[i] ?? 0;
      if (k <= 0) return;
      const def = m.def;
      report.exp += k * def.exp * Math.pow(r.expGrowth, eff - 1) * expMult;
      report.coins += k * def.coins * Math.pow(r.coinGrowth, eff - 1) * coinMult;
      const dm =
        (1 + d.rates.drop) *
        (ctx.rule?.dropMult ?? 1) *
        (ctx.rule?.dropMultByElement?.[def.element] ?? 1);
      const cores = rollCount(k * def.coreChance * (1 + d.rates.core) * dm, rng);
      bump(st.cores, def.id, cores);
      bump(report.cores, def.id, cores);
      const mats = rollCount(k * r.materialChance * dm, rng);
      bump(st.materials, district.material, mats);
      bump(report.materials, district.material, mats);
      const jelly = rollCount(k * r.jellyPerKill, rng);
      bump(st.materials, 'jelly', jelly);
      bump(report.materials, 'jelly', jelly);
      const drops = rollCount(k * r.itemDropChance * dm, rng);
      for (let n = 0; n < drops; n++) {
        st.counters.item += 1;
        addDrop(rollItem(eff, cfg, rng, `i${st.counters.item}`));
      }
      // lucky golden monsters: a burst of exp, coins, cores and sometimes a good item
      const golden = rollCount(k * r.golden.chance, rng);
      if (golden > 0) {
        const baseExp = def.exp * Math.pow(r.expGrowth, eff - 1) * expMult;
        const baseCoins = def.coins * Math.pow(r.coinGrowth, eff - 1) * coinMult;
        report.exp += golden * baseExp * (r.golden.expMult - 1);
        report.coins += golden * baseCoins * (r.golden.coinMult - 1);
        bump(st.cores, def.id, golden * r.golden.cores);
        bump(report.cores, def.id, golden * r.golden.cores);
        report.golden.count += golden;
        bump(report.golden.byMonster, def.id, golden);
        for (let n = rollCount(golden * r.golden.itemChance, rng); n > 0; n--) {
          st.counters.item += 1;
          addDrop(rollItemAtLeast(eff, cfg, rng, `i${st.counters.item}`, 'good'));
        }
      }
    });
  };

  // guaranteed reward every few stages (and a bigger one for finishing the district)
  const grantMilestone = (stage: number) => {
    const m = cfg.balance.rewards.milestones;
    const final = stage === district.stageCount;
    if (!final && stage % m.everyStages !== 0) return;
    report.milestones.push({ stage, final });
    st.counters.item += 1;
    const eff = stage + district.stageOffset;
    addDrop(
      rollItemAtLeast(
        eff,
        cfg,
        rng,
        `i${st.counters.item}`,
        final ? m.finalMinRarity : m.minRarity,
      ),
    );
    for (const mon of monsters) {
      const n = final ? m.finalCores : m.cores;
      bump(st.cores, mon.def.id, n);
      bump(report.cores, mon.def.id, n);
    }
  };

  // ---- main loop: spend the time window on stages ----
  let remaining = effective;
  for (let guard = 0; guard < district.stageCount + 3 && remaining > 1e-9; guard++) {
    const cleared = st.progress[district.id] ?? 0;
    const frontier = Math.min(cleared + 1, district.stageCount);
    const target = Math.min(st.farm.stage, frontier);
    let eff = target;
    let ev = stageEval(eff);
    while (!ev.ok && eff > 1) {
      eff -= 1;
      ev = stageEval(eff);
    }
    if (!ev.ok) {
      report.stuck = true;
      report.hint = diagnoseStage(d, district.id, target, cfg, ctx);
      break;
    }
    report.farmedStage = Math.max(report.farmedStage, eff);
    if (eff < target && !report.hint) report.hint = diagnoseStage(d, district.id, target, cfg, ctx);

    const atFrontier = cleared < district.stageCount && eff === frontier && target === frontier;
    if (atFrontier) {
      const need = Math.max(
        1,
        killsForStage(eff, cfg, district.killMult) - (st.frontierKills[district.id] ?? 0),
      );
      const timeNeeded = Math.max(0, (need - st.farm.killCarry) / ev.kps);
      if (timeNeeded <= remaining) {
        applyKills(eff, need);
        remaining -= timeNeeded;
        st.progress[district.id] = eff;
        report.stagesCleared.push(eff);
        grantMilestone(eff);
        st.farm.stage = Math.min(eff + 1, district.stageCount);
        st.frontierKills[district.id] = 0;
        st.farm.killCarry = 0;
        continue;
      }
    }
    const total = remaining * ev.kps + st.farm.killCarry;
    const kills = Math.floor(total);
    st.farm.killCarry = total - kills;
    if (atFrontier) st.frontierKills[district.id] = (st.frontierKills[district.id] ?? 0) + kills;
    applyKills(eff, kills);
    remaining = 0;
  }

  if (opts.bossId) report.bossDamage = bossDamage(d, opts.bossId, capped, cfg, ctx);

  st.coins += Math.round(report.coins);
  report.coins = Math.round(report.coins);
  report.exp = Math.round(report.exp);
  report.levelsGained = addExp(st, report.exp, cfg);
  st.lastClaimAt = now;
  return { ok: true, state: st, report };
}

/** Choose which stage to farm (never above the frontier) and which district. */
export function setFarmTarget(
  state: PlayerState,
  districtId: string,
  stage: number,
  cfg: GameConfig,
): Result<{ state: PlayerState }, 'badStage'> {
  const district = getDistrict(cfg, districtId);
  const frontier = Math.min((state.progress[districtId] ?? 0) + 1, district.stageCount);
  if (!Number.isInteger(stage) || stage < 1 || stage > frontier)
    return { ok: false, reason: 'badStage' };
  const next = structuredClone(state);
  if (next.farm.districtId !== districtId) {
    next.farm = { districtId, stage, killCarry: 0 }; // partial stage progress is kept per district
  } else {
    next.farm.stage = stage;
  }
  return { ok: true, state: next };
}
