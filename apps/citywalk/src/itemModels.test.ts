import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fitModel, loadItemModel } from './itemModels';

const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
const box = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o);

/** A .glb holding one triangle, 2 m wide and 1 m tall, standing off to one side and underground. */
function triangleGlb(): ArrayBuffer {
  const positions = new Float32Array([5, -3, 0, 7, -3, 0, 5, -2, 0]);
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [5, -3, 0],
        max: [7, -2, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    buffers: [{ byteLength: positions.byteLength }],
  };
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const body = new TextEncoder().encode(text);
  const out = new Uint8Array(12 + 8 + body.length + 8 + positions.byteLength);
  const v = new DataView(out.buffer);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, out.length, true);
  v.setUint32(12, body.length, true);
  v.setUint32(16, 0x4e4f534a, true);
  out.set(body, 20);
  const at = 20 + body.length;
  v.setUint32(at, positions.byteLength, true);
  v.setUint32(at + 4, 0x004e4942, true);
  out.set(new Uint8Array(positions.buffer), at + 8);
  return out.buffer;
}

describe('item models', () => {
  it('fitModel makes the widest side the item size, centres it, and stands it on the ground', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2));
    mesh.position.set(10, 5, -7);
    const fitted = fitModel(mesh, 0.5);
    const s = size(fitted);
    expect(s.x).toBeCloseTo(0.5);
    expect(s.y).toBeCloseTo(0.125);
    const b = box(fitted);
    expect(b.min.y).toBeCloseTo(0);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(0);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(0);
  });

  it('fitModel leaves an empty model alone', () => {
    expect(() => fitModel(new THREE.Group(), 1)).not.toThrow();
  });

  it('reads a real .glb file and fits it', async () => {
    const model = await loadItemModel(triangleGlb(), 0.4);
    const s = size(model);
    expect(s.x).toBeCloseTo(0.4);
    expect(s.y).toBeCloseTo(0.2);
    expect(box(model).min.y).toBeCloseTo(0);
  });

  it('refuses a file that is not a model', async () => {
    await expect(loadItemModel(new ArrayBuffer(32), 0.4)).rejects.toThrow();
  });
});
