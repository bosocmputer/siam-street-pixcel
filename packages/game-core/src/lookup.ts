import type {
  BossDef,
  DistrictDef,
  FormDef,
  GameConfig,
  ItemDef,
  MonsterDef,
  RuleDef,
  SkillDef,
} from './types';

interface Index {
  skills: Map<string, SkillDef>;
  monsters: Map<string, MonsterDef>;
  forms: Map<string, FormDef>;
  items: Map<string, ItemDef>;
  districts: Map<string, DistrictDef>;
  bosses: Map<string, BossDef>;
  rules: Map<string, RuleDef>;
}

const cache = new WeakMap<GameConfig, Index>();

function index(cfg: GameConfig): Index {
  let idx = cache.get(cfg);
  if (!idx) {
    const by = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    idx = {
      skills: by(cfg.skills),
      monsters: by(cfg.monsters),
      forms: by(cfg.forms),
      items: by(cfg.items),
      districts: by(cfg.districts),
      bosses: by(cfg.bosses),
      rules: by(cfg.rules),
    };
    cache.set(cfg, idx);
  }
  return idx;
}

function need<T>(kind: string, id: string, v: T | undefined): T {
  if (v === undefined) throw new Error(`config: unknown ${kind} "${id}"`);
  return v;
}

export const getSkill = (cfg: GameConfig, id: string) =>
  need('skill', id, index(cfg).skills.get(id));
export const getMonster = (cfg: GameConfig, id: string) =>
  need('monster', id, index(cfg).monsters.get(id));
export const getForm = (cfg: GameConfig, id: string) => need('form', id, index(cfg).forms.get(id));
export const getItemDef = (cfg: GameConfig, id: string) =>
  need('item', id, index(cfg).items.get(id));
export const getDistrict = (cfg: GameConfig, id: string) =>
  need('district', id, index(cfg).districts.get(id));
export const getBoss = (cfg: GameConfig, id: string) => need('boss', id, index(cfg).bosses.get(id));
export const getRule = (cfg: GameConfig, id: string) => need('rule', id, index(cfg).rules.get(id));
export const hasSkill = (cfg: GameConfig, id: string) => index(cfg).skills.has(id);
