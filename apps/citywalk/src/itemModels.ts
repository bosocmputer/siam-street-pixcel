import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ITEMS } from '@newgame/rpg-core';

// Item models made by the creator replace the placeholder gem: an item in config/items.json whose
// `model` names an entry in public/assets.json is shown as that file, scaled to the item's size.

/**
 * Wrap a model so its widest side is `size` metres, centred over its middle with its bottom on
 * the ground.
 */
export function fitModel(model: THREE.Object3D, size: number): THREE.Object3D {
  const wrap = new THREE.Group();
  wrap.add(model);
  const first = new THREE.Box3().setFromObject(wrap);
  const dim = first.getSize(new THREE.Vector3());
  const widest = Math.max(dim.x, dim.y, dim.z);
  if (widest > 0) model.scale.multiplyScalar(size / widest);
  const fitted = new THREE.Box3().setFromObject(wrap);
  const mid = fitted.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(mid.x, fitted.min.y, mid.z));
  return wrap;
}

export async function loadItemModel(bytes: ArrayBuffer, size: number): Promise<THREE.Object3D> {
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  return fitModel(gltf.scene, size);
}

/**
 * Load the model of every item that names one. An item whose file is missing or cannot be read
 * is left out, and shows its placeholder instead.
 */
export async function loadItemModels(
  files: ReadonlyMap<string, ArrayBuffer>,
): Promise<Map<string, THREE.Object3D>> {
  const out = new Map<string, THREE.Object3D>();
  for (const spec of Object.values(ITEMS)) {
    if (spec.model === null) continue;
    const bytes = files.get(spec.model);
    if (!bytes) {
      console.warn(
        `item ${spec.id}: model "${spec.model}" is not in the asset list or failed to load`,
      );
      continue;
    }
    try {
      out.set(spec.id, await loadItemModel(bytes, spec.size));
    } catch (err) {
      console.error(`item ${spec.id}: model could not be read:`, err);
    }
  }
  return out;
}
