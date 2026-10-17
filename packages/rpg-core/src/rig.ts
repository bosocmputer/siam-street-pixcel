// The character's skeleton (config/rig.json) and a check that a model file matches it, so a file
// from the modelling AI can be judged before it goes into the game.

import rigJson from '../config/rig.json';
import { ConfigError, num, obj } from './config';

export type V3 = [number, number, number];

export interface RigNode {
  name: string;
  parent: string | null;
  /** where it sits in the rest pose, metres from the ground between the feet */
  at: V3;
}

export interface Rig {
  height: number;
  joints: RigNode[];
  sockets: RigNode[];
  limits: { triangles: number; materials: number; fileKB: number };
}

/** Read and check config/rig.json: three numbers per position, and every parent listed first. */
export function readRig(raw: unknown): Rig {
  const r = obj(raw, 'rig.json');
  const nodes = (v: unknown, where: string): RigNode[] => {
    if (!Array.isArray(v)) throw new ConfigError(`${where}: expected a list`);
    return v.map((n, i) => {
      const o = obj(n, `${where}[${i}]`);
      const at = o.at;
      if (
        typeof o.name !== 'string' ||
        !(o.parent === null || typeof o.parent === 'string') ||
        !Array.isArray(at) ||
        at.length !== 3 ||
        !at.every((x) => typeof x === 'number' && Number.isFinite(x))
      )
        throw new ConfigError(`${where}[${i}]: needs name, parent and at [x, y, z]`);
      return { name: o.name, parent: o.parent as string | null, at: at as V3 };
    });
  };
  const limits = obj(r.limits, 'rig.limits');
  const rig: Rig = {
    height: num(r, 'height', 'rig', 0.1),
    joints: nodes(r.joints, 'rig.joints'),
    sockets: nodes(r.sockets, 'rig.sockets'),
    limits: {
      triangles: num(limits, 'triangles', 'rig.limits', 1),
      materials: num(limits, 'materials', 'rig.limits', 1),
      fileKB: num(limits, 'fileKB', 'rig.limits', 1),
    },
  };
  const seen = new Set<string>();
  for (const n of [...rig.joints, ...rig.sockets]) {
    if (seen.has(n.name)) throw new ConfigError(`rig: ${n.name} is listed twice`);
    if (n.parent !== null && !seen.has(n.parent))
      throw new ConfigError(`rig: ${n.name} comes before its parent ${n.parent}`);
    seen.add(n.name);
  }
  return rig;
}

export const RIG: Rig = readRig(rigJson);

/** What a loaded model says about one of its nodes. */
export interface FoundNode {
  name: string;
  parent: string | null;
  /** world position in the rest pose */
  at: V3;
  /** does it (or anything above it) rotate or scale? */
  turned: boolean;
}

export interface ModelFacts {
  nodes: FoundNode[];
  /** lowest and highest point of all meshes, metres */
  minY: number;
  maxY: number;
  triangles: number;
  materials: number;
  fileKB: number;
  animations: number;
  skinned: boolean;
}

export interface RigIssue {
  /** short code for tests */
  code: 'missing' | 'parent' | 'place' | 'turned' | 'height' | 'ground' | 'budget' | 'extra';
  /** what is wrong, in Thai, ready to send back to the modelling AI */
  th: string;
}

const close = (a: V3, b: V3, tol: number) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) <= tol;
const fmt = (v: V3) => `(${v.map((n) => Math.round(n * 1000) / 1000).join(', ')})`;

/** Compare a model with the rig. An empty list means it fits. */
export function checkRig(facts: ModelFacts, rig: Rig = RIG, tol = 0.02): RigIssue[] {
  const issues: RigIssue[] = [];
  const found = new Map(facts.nodes.map((n) => [n.name, n]));
  for (const want of [...rig.joints, ...rig.sockets]) {
    const got = found.get(want.name);
    if (!got) {
      issues.push({
        code: 'missing',
        th: want.parent
          ? `ไม่มีโหนดชื่อ ${want.name} (ต้องเป็นลูกของ ${want.parent})`
          : `ไม่มีโหนดชื่อ ${want.name} (ต้องเป็นโหนดบนสุดของไฟล์)`,
      });
      continue;
    }
    if (got.parent !== want.parent)
      issues.push({
        code: 'parent',
        th: `${want.name} ต้องเป็นลูกของ ${want.parent} แต่ตอนนี้เป็นลูกของ ${got.parent ?? '(ไม่มี)'}`,
      });
    if (!close(got.at, want.at, tol))
      issues.push({
        code: 'place',
        th: `${want.name} อยู่ที่ ${fmt(got.at)} แต่ต้องอยู่ที่ ${fmt(want.at)}`,
      });
    if (got.turned)
      issues.push({
        code: 'turned',
        th: `${want.name} ต้องไม่หมุนและ scale = 1 (ตั้ง rotation 0,0,0)`,
      });
  }
  if (Math.abs(facts.minY) > tol)
    issues.push({
      code: 'ground',
      th: `ฝ่าเท้าต้องอยู่ที่ y = 0 แต่จุดต่ำสุดอยู่ที่ ${facts.minY.toFixed(3)}`,
    });
  if (Math.abs(facts.maxY - rig.height) > 0.05)
    issues.push({
      code: 'height',
      th: `ตัวสูง ${facts.maxY.toFixed(2)} ม. แต่ต้องสูง ${rig.height.toFixed(2)} ม.`,
    });
  const l = rig.limits;
  if (facts.triangles > l.triangles)
    issues.push({ code: 'budget', th: `สามเหลี่ยม ${facts.triangles} เกินงบ ${l.triangles}` });
  if (facts.materials > l.materials)
    issues.push({ code: 'budget', th: `วัสดุ ${facts.materials} ชนิด เกินงบ ${l.materials}` });
  if (facts.fileKB > l.fileKB)
    issues.push({
      code: 'budget',
      th: `ไฟล์ ${Math.round(facts.fileKB)} KB เกินงบ ${l.fileKB} KB`,
    });
  if (facts.animations > 0)
    issues.push({
      code: 'extra',
      th: `มี animation ${facts.animations} อัน ไม่ต้องมี (เกมทำท่าเอง)`,
    });
  if (facts.skinned)
    issues.push({ code: 'extra', th: 'ใช้ SkinnedMesh อยู่ ต้องเป็นชิ้นแข็งติดข้อต่อ' });
  return issues;
}
