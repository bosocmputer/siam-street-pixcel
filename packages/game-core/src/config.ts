import balance from '../config/balance.json';
import elements from '../config/elements.json';
import styles from '../config/styles.json';
import combos from '../config/combos.json';
import skills from '../config/skills.json';
import monsters from '../config/monsters.json';
import forms from '../config/forms.json';
import items from '../config/items.json';
import districts from '../config/districts.json';
import bosses from '../config/bosses.json';
import rules from '../config/rules.json';
import { ELEMENTS, type GameConfig } from './types';

export const defaultConfig = {
  balance,
  elementBeats: elements,
  styles,
  combos,
  skills,
  monsters,
  forms,
  items,
  districts,
  bosses,
  rules,
} as unknown as GameConfig;

/** Referential-integrity checks for a config. Returns a list of problems (empty = valid). */
export function validateConfig(cfg: GameConfig): string[] {
  const errs: string[] = [];
  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errs.push(`duplicate ${kind} id: ${id}`);
      seen.add(id);
    }
  };
  dup(
    'skill',
    cfg.skills.map((s) => s.id),
  );
  dup(
    'monster',
    cfg.monsters.map((m) => m.id),
  );
  dup(
    'form',
    cfg.forms.map((f) => f.id),
  );
  dup(
    'item',
    cfg.items.map((i) => i.id),
  );
  dup(
    'district',
    cfg.districts.map((d) => d.id),
  );
  dup(
    'boss',
    cfg.bosses.map((b) => b.id),
  );
  dup(
    'rule',
    cfg.rules.map((r) => r.id),
  );

  const skillIds = new Set(cfg.skills.map((s) => s.id));
  const monsterIds = new Set(cfg.monsters.map((m) => m.id));
  const districtIds = new Set(cfg.districts.map((d) => d.id));
  const formIds = new Set(cfg.forms.map((f) => f.id));
  const bossIds = new Set(cfg.bosses.map((b) => b.id));
  const materials = new Set(cfg.districts.map((d) => d.material));

  for (const e of ELEMENTS) {
    if (!cfg.elementBeats[e]) errs.push(`element ${e} has no target in the element ring`);
  }
  for (const s of cfg.skills) {
    if (s.kind === 'active' && !(s.cooldown && s.cooldown > 0 && s.power && s.power > 0)) {
      errs.push(`active skill ${s.id} needs cooldown and power`);
    }
    if (!s.tags.includes(s.element)) errs.push(`skill ${s.id} should include its element tag`);
  }
  for (const m of cfg.monsters) {
    if (!skillIds.has(m.skillId)) errs.push(`monster ${m.id}: unknown skill ${m.skillId}`);
    if (!districtIds.has(m.districtId)) errs.push(`monster ${m.id}: unknown district`);
    const sk = cfg.skills.find((s) => s.id === m.skillId);
    if (sk && sk.formOnly) errs.push(`monster ${m.id} gives form-only skill ${m.skillId}`);
  }
  for (const f of cfg.forms) {
    if (f.from !== null && !formIds.has(f.from))
      errs.push(`form ${f.id}: unknown parent ${f.from}`);
    if (f.skillId !== null && !skillIds.has(f.skillId)) errs.push(`form ${f.id}: unknown skill`);
  }
  for (const d of cfg.districts) {
    if (!bossIds.has(d.bossId)) errs.push(`district ${d.id}: unknown boss`);
    for (const m of d.monsters) {
      const def = cfg.monsters.find((x) => x.id === m.id);
      if (!def) errs.push(`district ${d.id}: unknown monster ${m.id}`);
      else if (def.districtId !== d.id) errs.push(`monster ${m.id} listed in wrong district`);
    }
  }
  for (const b of cfg.bosses) {
    if (!districtIds.has(b.districtId)) errs.push(`boss ${b.id}: unknown district`);
  }
  for (const i of cfg.items) {
    if (!materials.has(i.material)) errs.push(`item ${i.id}: unknown material ${i.material}`);
    if (i.slot === 'weapon' && !i.style) errs.push(`weapon ${i.id} needs a style`);
    if (i.style && !cfg.styles[i.style]) errs.push(`item ${i.id}: unknown style`);
  }
  for (const tag of Object.keys(cfg.combos)) {
    if (!cfg.combos[tag]) errs.push(`combo ${tag} is empty`);
  }
  if (cfg.balance.skills.activeSlots < 1 || cfg.balance.skills.passiveSlots < 1) {
    errs.push('skill slots must be >= 1');
  }
  void monsterIds;
  return errs;
}
