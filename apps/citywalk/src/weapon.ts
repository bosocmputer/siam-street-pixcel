// The first weapon (jobs.md): an iron pipe picked up by the road. Built in code until there is a
// model. It lies along +z from the fist (a held pipe points forward out of the thumb side), the
// grip wrapped in tape, the steel greyed and spotted with rust, the far end cut off square.

import * as THREE from 'three';

/** metres */
export const PIPE = { length: 0.8, radius: 0.026, grip: 0.09 };

const lambert = (color: number) => new THREE.MeshLambertMaterial({ color });

export function makePipe(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'Weapon_Pipe';
  const { length, radius, grip } = PIPE;
  /** a length of pipe from `a` to `b` metres along it */
  const piece = (a: number, b: number, r: number, color: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, b - a, 8), lambert(color));
    m.rotation.x = Math.PI / 2;
    m.position.z = (a + b) / 2;
    g.add(m);
  };
  // the tape the hand holds, a little behind and in front of the fist
  piece(-grip, grip * 1.3, radius * 1.25, 0x3a4466);
  piece(grip * 1.3, length - grip, radius, 0x8b9bb4);
  // rust bands and the dark cut end
  for (const at of [0.32, 0.52]) piece(at, at + 0.06, radius * 1.06, 0xc28569);
  piece(length - grip, length - grip + 0.05, radius * 1.15, 0x5a6988);
  piece(length - grip + 0.05, length - grip + 0.09, radius, 0x8b9bb4);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = false;
  });
  return g;
}
