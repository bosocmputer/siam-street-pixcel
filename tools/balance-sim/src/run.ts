import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  claim,
  createNewPlayer,
  defaultConfig as cfg,
  getBoss,
  getDistrict,
  grantTutorialCores,
  type ClaimReport,
  type Element,
  type PlayerState,
} from '@slimehood/game-core';
import { playSession } from './policy';
import { renderReport, type ChartSpec } from './chart';

const HOUR = 3600;
const DAY = 24 * HOUR;
const DAYS = 30;

interface Profile {
  id: string;
  label: string;
  hours: (day: number) => number[]; // hours of day when the player opens the app
}

const profiles: Profile[] = [
  {
    id: 'diligent',
    label: 'ขยัน (5 ครั้ง/วัน)',
    hours: (d) => (d === 0 ? [13, 18, 22] : [7, 10, 13, 18, 22]),
  },
  { id: 'normal', label: 'ปกติ (3 ครั้ง/วัน)', hours: (d) => (d === 0 ? [20] : [8, 13, 20]) },
  { id: 'rare', label: 'นาน ๆ ที (2 วัน/ครั้ง)', hours: (d) => (d % 2 === 0 && d > 0 ? [20] : []) },
];

interface DayRow {
  profile: string;
  day: number;
  level: number;
  form: string;
  skills: number;
  clearedStages: number;
  bestiary: number;
  coins: number;
  bossDamage: number;
  awakened: number;
}

interface Milestones {
  firstAbsorbSec: number;
  level10At: number | null;
  evolve1At: number | null;
  evolve2At: number | null;
  level30At: number | null;
  level60At: number | null;
  firstDistrictClearedAt: number | null;
}

const cleared = (s: PlayerState) => Object.values(s.progress).reduce((a, b) => a + b, 0);

function simulate(p: Profile, home = 'wiang', prefer: Element | null = null, naive = false) {
  let t = 9 * HOUR; // day 0, 09:00
  let s = createNewPlayer(cfg, home, t);
  s = grantTutorialCores(s, cfg);
  const first = playSession(s, cfg, undefined, 0, prefer, naive);
  s = first.state; // the first absorb + evolve choices happen in the first seconds
  const ms: Milestones = {
    firstAbsorbSec: 30,
    level10At: null,
    evolve1At: null,
    evolve2At: null,
    level30At: null,
    level60At: null,
    firstDistrictClearedAt: null,
  };
  const days: DayRow[] = [];
  const reports: { t: number; report: ClaimReport }[] = [];
  let evolutions = 0;
  let bossToday = 0;
  const totals = { golden: 0, milestones: 0, restedHours: 0, claims: 0 };
  let n = 0;

  const note = (now: number, log: string[], state: PlayerState) => {
    const day = (now - 9 * HOUR) / DAY;
    for (const l of log) {
      if (l.startsWith('evolve:')) {
        evolutions += 1;
        if (evolutions === 1) ms.evolve1At = day;
        if (evolutions === 2) ms.evolve2At = day;
      }
    }
    if (state.level >= 10 && ms.level10At === null) ms.level10At = day;
    if (state.level >= 30 && ms.level30At === null) ms.level30At = day;
    if (state.level >= 60 && ms.level60At === null) ms.level60At = day;
    if (ms.firstDistrictClearedAt === null && Object.values(state.progress).some((v) => v >= 30)) {
      ms.firstDistrictClearedAt = day;
    }
  };

  const sessionAt = (now: number) => {
    const boss = getDistrict(cfg, s.farm.districtId).bossId;
    const r = claim(s, now, `${p.id}:${n++}`, cfg, { bossId: getBoss(cfg, boss).id });
    if (!r.ok) return;
    s = r.state;
    bossToday += r.report.bossDamage;
    totals.golden += r.report.golden.count;
    totals.milestones += r.report.milestones.length;
    totals.restedHours += r.report.restedSeconds / 3600;
    totals.claims += 1;
    reports.push({ t: now, report: r.report });
    const played = playSession(s, cfg, undefined, n, prefer, naive);
    s = played.state;
    note(now, [...first.log, ...played.log].splice(0, 0).concat(played.log), s);
  };

  // first session: stay 15 minutes
  t += 15 * 60;
  sessionAt(t);
  for (let day = 0; day <= DAYS; day++) {
    for (const h of p.hours(day)) {
      const now = day * DAY + h * HOUR;
      if (now <= t) continue;
      t = now;
      sessionAt(now);
    }
    days.push({
      profile: p.id,
      day,
      level: s.level,
      form: s.formId,
      skills: Object.values(s.skills).filter((x) => x.level >= 1).length,
      clearedStages: cleared(s),
      bestiary: Object.keys(s.bestiary).length,
      coins: s.coins,
      bossDamage: Math.round(bossToday),
      awakened: Object.values(s.skills).filter((x) => x.awakened).length,
    });
    bossToday = 0;
  }
  return { days, ms, final: s, totals };
}

const results = profiles.map((p) => ({ p, ...simulate(p) }));
const normalProfile = profiles.find((x) => x.id === 'normal') as Profile;
const naiveRun = simulate(normalProfile, 'wiang', null, true);
const lineRuns = cfg.districts.map((d) => ({
  home: d.id,
  element: d.element,
  ...simulate(normalProfile, d.id, d.element),
}));

// ---------- output ----------
const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../../docs/balance');
mkdirSync(outDir, { recursive: true });

const header = 'profile,day,level,form,skills,clearedStages,bestiary,coins,bossDamage,awakened';
const csv = [header, ...results.flatMap((r) => r.days.map((d) => Object.values(d).join(',')))].join(
  '\n',
);
writeFileSync(resolve(outDir, 'progression.csv'), csv + '\n');

const fmt = (v: number | null) =>
  v === null ? 'ไม่ถึงใน 30 วัน' : v < 1 ? `${(v * 24).toFixed(1)} ชม.` : `วันที่ ${v.toFixed(1)}`;
const summary: Record<string, unknown> = {};
for (const r of results) {
  summary[r.p.id] = {
    finalLevel: r.final.level,
    finalForm: r.final.formId,
    skillsOwned: Object.values(r.final.skills).filter((x) => x.level >= 1).length,
    clearedStages: cleared(r.final),
    milestones: r.ms,
  };
}
writeFileSync(resolve(outDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');

const normal = results.find((r) => r.p.id === 'normal');
const rare = results.find((r) => r.p.id === 'rare');
const dayOf = (rows: DayRow[], day: number) => rows.find((x) => x.day === day);
const targets: [string, string, boolean][] = [];
if (normal && rare) {
  const m = normal.ms;
  targets.push([
    'เวล 10 + อัปร่างครั้งแรก ภายในเซสชันแรก (≤ 20 นาที)',
    `เวล10: ${fmt(m.level10At)} · อัปร่าง: ${fmt(m.evolve1At)}`,
    (m.level10At ?? 99) * 24 <= 0.34 && (m.evolve1At ?? 99) * 24 <= 0.34,
  ]);
  targets.push([
    'เวล 30 / อัปร่างครั้งที่ 2 ภายในวันที่ 3–5',
    `เวล30: ${fmt(m.level30At)} · อัปร่าง2: ${fmt(m.evolve2At)}`,
    (m.level30At ?? 99) >= 3 && (m.level30At ?? 99) <= 5,
  ]);
  targets.push([
    'ผ่านครบ 30 ด่านของ 1 ย่าน วันที่ 7–10',
    fmt(m.firstDistrictClearedAt),
    (m.firstDistrictClearedAt ?? 99) >= 7 && (m.firstDistrictClearedAt ?? 99) <= 10,
  ]);
  targets.push([
    'เวล 60 วันที่ 21–28',
    fmt(m.level60At),
    (m.level60At ?? 99) >= 21 && (m.level60At ?? 99) <= 28,
  ]);
  const n14 = dayOf(normal.days, 14)?.level ?? 0;
  const r14 = dayOf(rare.days, 14)?.level ?? 0;
  targets.push([
    'ผู้เล่นนาน ๆ ที ไม่ช้ากว่าปกติเกิน 2 เท่าที่วันที่ 14 (เทียบเวล)',
    `ปกติ L${n14} · นาน ๆ ที L${r14}`,
    r14 >= n14 / 2,
  ]);
}
const colors: Record<string, string> = {
  diligent: 'var(--c1)',
  normal: 'var(--c2)',
  rare: 'var(--c3)',
};
const series = (pick: (d: DayRow) => number) =>
  results.map((r) => ({
    id: r.p.id,
    label: r.p.label,
    color: colors[r.p.id] ?? '#888',
    points: r.days.map((d) => ({ day: d.day, value: pick(d) })),
  }));
const charts: ChartSpec[] = [
  { title: 'เลเวลของสไลม์', yLabel: 'เลเวล', series: series((d) => d.level), yMax: 80 },
  {
    title: 'ด่านที่ผ่านแล้ว (รวม 4 ย่าน สูงสุด 120)',
    yLabel: 'ด่าน',
    series: series((d) => d.clearedStages),
    yMax: 120,
  },
  {
    title: 'สกิลที่ปลดล็อกแล้ว (สูงสุด 14 ต่อสายวิวัฒนาการ)',
    yLabel: 'สกิล',
    series: series((d) => d.skills),
    yMax: 20,
  },
];
const msText = (v: number | null) =>
  v === null ? 'ไม่ถึงใน 30 วัน' : v < 1 ? `${(v * 24).toFixed(1)} ชม.` : `วันที่ ${v.toFixed(1)}`;
const msRowsData = [
  ['เวล 10', (m: Milestones) => m.level10At],
  ['อัปร่างครั้งที่ 1', (m: Milestones) => m.evolve1At],
  ['เวล 30', (m: Milestones) => m.level30At],
  ['อัปร่างครั้งที่ 2', (m: Milestones) => m.evolve2At],
  ['ผ่านครบ 30 ด่านของย่านแรก', (m: Milestones) => m.firstDistrictClearedAt],
  ['เวล 60', (m: Milestones) => m.level60At],
] as const;
const milestones = msRowsData.map(([label, get]) => ({
  label,
  rows: results.map((r) => ({ profile: r.p.label, text: msText(get(r.ms)) })),
}));
const lastRow = (r: { days: DayRow[] }) => r.days[r.days.length - 1] as DayRow;
const homeName: Record<string, string> = {
  wiang: 'ในเวียง (ดิน)',
  ping: 'ริมปิง (น้ำ)',
  thapae: 'ท่าแพ (ไฟ)',
  nimman: 'นิมมาน (ลม)',
};
const lineRows = lineRuns.map((r) => ({
  label: homeName[r.home] ?? r.home,
  level14: r.days.find((d) => d.day === 14)?.level ?? 0,
  level30: lastRow(r).level,
  cleared30: lastRow(r).clearedStages,
  form: lastRow(r).form,
  level60Day: msText(r.ms.level60At),
}));
const lvl30s = lineRows.map((r) => r.level30);
const spread = Math.max(...lvl30s) - Math.min(...lvl30s);
const byId = (id: string) => results.find((r) => r.p.id === id);
const at = (id: string, day: number) => byId(id)?.days.find((d) => d.day === day);
const notes = [
  `ที่วันที่ 30 ผู้เล่นขยันผ่านไป ${lastRow(byId('diligent') ?? results[0]!).clearedStages}/120 ด่าน ปกติ ${at('normal', 30)?.clearedStages}/120 นาน ๆ ที ${at('rare', 30)?.clearedStages}/120 จึงยังมีเนื้อหาเหลือหลังวันที่ 30 สำหรับสองแบบแรก แต่ไม่มากเกินไป`,
  `ผู้เล่นนาน ๆ ที (เปิดทุก 2 วัน) เลเวล ${at('rare', 14)?.level} ที่วันที่ 14 เทียบกับปกติ ${at('normal', 14)?.level} เพราะของออโต้สะสมได้สูงสุด ${(cfg.balance.idle.capSeconds / 3600).toFixed(0)} ชม. ต่อครั้ง`,
  `ระบบใหม่ที่ใส่เพิ่ม (นับใน 30 วัน ผู้เล่นปกติ): มอนทอง ${byId('normal')?.totals.golden} ตัว · หมุดหมายด่าน ${byId('normal')?.totals.milestones} ครั้ง · พลังสะสมนอกเวลารวม ${byId('normal')?.totals.restedHours.toFixed(0)} ชม. · สกิลที่ตื่นพลังแล้ว ${at('normal', 30)?.awakened} ตัวที่วันที่ 30 (ขยัน ${at('diligent', 30)?.awakened}, นาน ๆ ที ${at('rare', 30)?.awakened})`,
  'ผลนี้มาจากนโยบายผู้เล่นจำลอง (ใส่ของที่ดีที่สุด กลืนทุกอย่าง เดินตามลำดับย่าน สลับไปย่านอื่นเพื่อเก็บสกิลสลับรอบ) คนจริงจะต่างจากนี้ โดยเฉพาะการเลือกธาตุ สกิล และจังหวะเข้าเล่น',
  `ผู้เล่นที่ไม่แตะสกิลและของเลย ไปได้แค่ ${naiveRun.days.find((d) => d.day === 14)?.clearedStages}/120 ด่านที่วันที่ 14 เทียบกับผู้เล่นปกติ ${at('normal', 14)?.clearedStages}/120 แปลว่าการเลือกบิลด์มีผลจริง`,
  'ยังไม่ได้จำลองกฎย่านรายสัปดาห์ (ใช้ “ไม่มีกฎ” ตลอด), การแบกเพื่อน, และคนที่เลิกเล่นกลางทาง',
  'ขนาด HP บอสย่านเป็นค่าตั้งต้น ต้องปรับจากจำนวนผู้เล่น active จริงใน playtest',
];
writeFileSync(
  resolve(outDir, 'progression.html'),
  renderReport({
    generatedOn: new Date().toISOString().slice(0, 10),
    days: DAYS,
    charts,
    targets,
    milestones,
    lineRows,
    notes: [
      ...notes,
      `สายธาตุต่างกันที่วันที่ 30 สูงสุด-ต่ำสุด ${spread} เวล (${lineRows.map((r) => `${r.label.split(' ')[0]} L${r.level30}`).join(' · ')})`,
    ],
  }),
);
const report = ['ผลจำลองสมดุล 30 วัน', ''].concat(
  targets.map(([t, v, ok]) => `${ok ? 'PASS' : 'MISS'}  ${t}  →  ${v}`),
);
writeFileSync(resolve(outDir, 'targets.txt'), report.join('\n') + '\n');
if (process.env.SIM_JSON) {
  const nm = normal?.ms;
  console.log(
    JSON.stringify({
      level10H: nm && nm.level10At !== null ? nm.level10At * 24 : 999,
      level30D: nm?.level30At ?? 99,
      evolve2D: nm?.evolve2At ?? 99,
      clear1D: nm?.firstDistrictClearedAt ?? 99,
      level60D: nm?.level60At ?? 99,
      ratio14:
        (rare?.days.find((x) => x.day === 14)?.level ?? 0) /
        Math.max(1, normal?.days.find((x) => x.day === 14)?.level ?? 1),
      normalCleared: normal ? cleared(normal.final) : 0,
      lineSpread:
        (Math.max(...lineRuns.map((x) => lastRow(x).level)) -
          Math.min(...lineRuns.map((x) => lastRow(x).level))) /
        Math.max(1, lastRow(lineRuns[0] as { days: DayRow[] }).level),
      buildBenefit:
        (normal?.days.find((x) => x.day === 14)?.level ?? 1) /
        Math.max(1, naiveRun.days.find((x) => x.day === 14)?.level ?? 1),
      buildBenefitStages:
        (normal?.days.find((x) => x.day === 14)?.clearedStages ?? 1) /
        Math.max(1, naiveRun.days.find((x) => x.day === 14)?.clearedStages ?? 1),
      normalLevel30d: normal?.days.find((x) => x.day === 30)?.level ?? 0,
    }),
  );
  process.exit(0);
}
console.log(report.join('\n'));
console.log('\nสายธาตุ (ผู้เล่นปกติ):');
for (const r of lineRows)
  console.log(
    `  ${r.label.padEnd(16)} L14=${r.level14} L30=${r.level30} stages=${r.cleared30} form=${r.form} lv60=${r.level60Day}`,
  );
for (const r of results) {
  console.log(
    `\n[${r.p.id}] final level ${r.final.level} form ${r.final.formId} cleared ${cleared(r.final)} skills ${summary[r.p.id] && (summary[r.p.id] as { skillsOwned: number }).skillsOwned}`,
  );
  for (const d of r.days.filter((x) => [0, 1, 2, 3, 5, 7, 10, 14, 21, 28, 30].includes(x.day))) {
    console.log(
      `  day ${String(d.day).padStart(2)}  L${String(d.level).padStart(2)}  ${d.form.padEnd(18)} skills ${String(d.skills).padStart(2)}  stages ${String(d.clearedStages).padStart(3)}  boss ${d.bossDamage}`,
    );
  }
}
