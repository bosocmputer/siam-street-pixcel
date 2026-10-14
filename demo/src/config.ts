export const W = 960;
export const H = 540;
export const RIVER = { x: 400, w: 160 };
export const BOSS_X = 810;

export type Weapon = 'sword' | 'staff';
export type Power = 'freeze' | 'reflect';
export type Rule = 'ice' | 'cover' | null;

export const FONT = "Sarabun, 'Noto Sans Thai', Tahoma, sans-serif";

export const RULE_LABEL: Record<Exclude<Rule, null>, string> = {
  ice: 'ทางน้ำแข็ง',
  cover: 'เสาสะท้อน',
};
