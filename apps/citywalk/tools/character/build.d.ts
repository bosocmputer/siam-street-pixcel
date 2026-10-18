// Types for build.js, so the game (TypeScript) can build characters with it at runtime.
import type * as THREE from 'three';

export interface BuiltCharacter {
  root: THREE.Object3D;
  triangles: number;
  materials: THREE.Material[];
}

/** `style` is a design from designs.js with the player's choices put in; `rig` is config/rig.json. */
export function buildCharacter(style: object, rig: object): BuiltCharacter;
