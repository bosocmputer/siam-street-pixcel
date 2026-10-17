import { describe, expect, it } from 'vitest';
import { GlbError, glbFacts, readGlbJson } from '../src/glb';
import { RIG, checkRig } from '../src/rig';

/** Pack glTF JSON into a .glb (JSON chunk only, which is all the checker reads). */
function glb(json: unknown): Uint8Array {
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(20 + body.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, body.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  return out;
}

/** A model laid out exactly like the rig, with one box per joint as its body. */
function rigModel(change?: (nodes: Record<string, unknown>[]) => void) {
  const all = [...RIG.joints, ...RIG.sockets];
  const index = new Map(all.map((n, i) => [n.name, i]));
  const nodes: Record<string, unknown>[] = all.map((n) => {
    const p = n.parent ? all.find((x) => x.name === n.parent)! : null;
    const at = p ? n.at.map((v, k) => v - p.at[k]!) : n.at;
    return { name: n.name, translation: at };
  });
  for (const n of all)
    if (n.parent) {
      const parent = nodes[index.get(n.parent)!]!;
      parent.children = [...((parent.children as number[]) ?? []), index.get(n.name)!];
    }
  // a body box on the head reaching up to the top of the rig, and one under the feet
  nodes[index.get('Head')!]!.mesh = 0;
  nodes[index.get('Foot_L')!]!.mesh = 1;
  change?.(nodes);
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes: [
      { primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] },
      { primitives: [{ attributes: { POSITION: 2 } }] },
    ],
    accessors: [
      { count: 24, min: [-0.1, -0.02, -0.1], max: [0.1, RIG.height - 1.52, 0.1] },
      { count: 36 },
      { count: 36, min: [-0.05, -0.08, -0.06], max: [0.05, 0.01, 0.2] },
    ],
    materials: [{}, {}],
  };
}

describe('reading a .glb', () => {
  it('finds every joint where the rig puts it, and the model passes', () => {
    const facts = glbFacts(glb(rigModel()));
    expect(facts.nodes).toHaveLength(23);
    expect(facts.nodes.find((n) => n.name === 'Hand_R')!.at[0]).toBeCloseTo(-0.26);
    expect(facts.nodes.find((n) => n.name === 'Hand_R')!.parent).toBe('LowerArm_R');
    expect(facts.minY).toBeCloseTo(0);
    expect(facts.maxY).toBeCloseTo(RIG.height);
    expect(facts.triangles).toBe(12 + 12);
    expect(facts.materials).toBe(2);
    expect(checkRig(facts)).toEqual([]);
  });

  it('notices a turned joint, and that everything under it moves too', () => {
    const facts = glbFacts(
      glb(
        rigModel(
          (nodes) => (nodes.find((n) => n.name === 'Chest')!.rotation = [0, 0.383, 0, 0.924]),
        ),
      ),
    );
    expect(facts.nodes.find((n) => n.name === 'Chest')!.turned).toBe(true);
    expect(facts.nodes.find((n) => n.name === 'Hand_L')!.turned).toBe(true);
    expect(facts.nodes.find((n) => n.name === 'Hips')!.turned).toBe(false);
    const issues = checkRig(facts);
    expect(issues.some((i) => i.code === 'turned')).toBe(true);
    expect(issues.some((i) => i.code === 'place' && i.th.startsWith('Hand_L'))).toBe(true);
  });

  it('reads matrices, strips, skins and animations', () => {
    const json = rigModel((nodes) => {
      const root = nodes.find((n) => n.name === 'Root')!;
      root.matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0.5, 0, 1];
      root.skin = 0;
    });
    json.meshes[1]!.primitives[0] = { attributes: { POSITION: 2 }, mode: 5 } as never;
    Object.assign(json, { animations: [{}], skins: [{}] });
    const facts = glbFacts(glb(json));
    expect(facts.nodes.find((n) => n.name === 'Hips')!.at[1]).toBeCloseTo(1.45);
    expect(facts.triangles).toBe(12 + 34);
    expect(facts.animations).toBe(1);
    expect(facts.skinned).toBe(true);
  });

  it('turns away files that are not a .glb', () => {
    expect(() => readGlbJson(new Uint8Array(40))).toThrow(GlbError);
    const bad = glb({});
    new DataView(bad.buffer).setUint32(4, 1, true);
    expect(() => readGlbJson(bad)).toThrow(/2.0/);
    const cut = glb({ a: 1 }).subarray(0, 22);
    expect(() => readGlbJson(cut)).toThrow(/JSON/);
  });

  it('copes with a file that has no scene or meshes', () => {
    const facts = glbFacts(glb({ asset: { version: '2.0' } }));
    expect(facts.nodes).toEqual([]);
    expect(facts.minY).toBe(0);
    expect(checkRig(facts).filter((i) => i.code === 'missing')).toHaveLength(23);
  });
});
