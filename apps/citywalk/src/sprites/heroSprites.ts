// The player's character as a pixel sprite sheet, drawn from the same model and the same posing
// code as the 3D body (hero.ts), with a bigger head for chibi proportions.

import * as THREE from 'three';
import { APPEARANCE, SPRITES, type Look } from '@newgame/rpg-core';
import { makeHero, type Motion } from '../hero';
import { buildLook, styleFor } from '../lookModel';
import { bake, cartoon, type Baked, type Mark } from './bake';

/** walking and running speeds the frames are drawn at (metres a second), and stride cycles */
export const HERO_GAIT = {
  walk: { speed: 4, cycle: 2.5 },
  run: { speed: 8, cycle: 4.2 },
};

export function bakeHero(look: Look, spec = SPRITES): Baked {
  lookNow = look;
  const built = buildLook(look);
  const w = makeHero(
    { scene: built.root, entry: { id: 'hero', file: '' } },
    { outline: false, shadow: false, proportions: spec.hero.proportions },
  );
  cartoon(w.body);
  // the eye spots are worked out on the model as built, then follow its posed copy
  const clone = w.body.getObjectByName('Face_Main');
  const eyes = clone ? eyePoints(built.root, look).map((e) => ({ ...e, mesh: clone })) : [];
  const animate = w.animate!;
  const still: Motion = { mode: 'walk', speed: 0, casting: false, down: false };
  const run = (m: Partial<Motion>, dt: number, n = 1) => {
    for (let k = 0; k < n; k++) animate(dt, { ...still, ...m });
  };
  return bake(
    {
      root: w.body,
      marks: () => {
        w.body.updateMatrixWorld(true);
        return eyes.map(eyeAt);
      },
      face: (a) => (w.body.rotation.y = a + Math.PI),
      pose: (anim, i, n) => {
        w.body.rotation.z = 0;
        w.bike.visible = false;
        switch (anim) {
          case 'idle':
            // one slow breath across the frames
            run({}, i === 0 ? 0.1 : (2 * Math.PI) / 2.2 / n, i === 0 ? 40 : 1);
            break;
          case 'walk':
          case 'run': {
            const g = HERO_GAIT[anim];
            if (i === 0) run({ speed: g.speed }, 0.05, 80);
            else run({ speed: g.speed }, g.cycle / g.speed / n);
            break;
          }
          case 'cast':
            if (i === 0) run({}, 0.1, 30);
            run({ casting: true }, 0.4 / n);
            break;
          case 'hurt':
            if (i === 0) {
              run({}, 0.1, 30);
              w.hurt?.();
            }
            run({}, 0.07);
            break;
          case 'down':
            run({}, 0.1, 30);
            w.body.rotation.z = 1.45;
            break;
          case 'ride':
            w.bike.visible = true;
            run({ mode: 'bike', speed: 16 }, i === 0 ? 0.1 : 0.2, i === 0 ? 30 : 1);
            break;
        }
      },
    },
    {
      frame: spec.hero.frame,
      anchor: spec.hero.anchor,
      anims: Object.entries(spec.hero.anims),
    },
    spec,
  );
}

/**
 * Where the eyes sit on the face (from the face picture's layout in tools/character/build.js),
 * as points on the face mesh that follow the head as it moves.
 */
function eyePoints(
  root: THREE.Object3D,
  look: Look,
): { mesh: THREE.Object3D; local: THREE.Vector3 }[] {
  const style = styleFor(look) as { headH: number; face: { eyeGap?: number; eyeAt?: number } };
  const face = root.getObjectByName('Face_Main') as THREE.Mesh | undefined;
  if (!face) return [];
  const pos = face.geometry.getAttribute('position');
  const chin = 1.69 - style.headH;
  const head = root.getObjectByName('Head')!;
  const y =
    chin + (style.face.eyeAt ?? 0.4) * style.headH - head.getWorldPosition(new THREE.Vector3()).y;
  return [-1, 1].map((side) => {
    const x = side * (style.face.eyeGap ?? 0.036);
    // the face surface's depth at that spot: the nearest point of the face mesh
    let best = 0,
      bd = Infinity;
    for (let i = 0; i < pos.count; i++) {
      const d = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2;
      if (d < bd) [bd, best] = [d, i];
    }
    return { mesh: face, local: new THREE.Vector3(x, y, pos.getZ(best)) };
  });
}

const IRIS = (look: Look) => APPEARANCE.eyes[look.eye] ?? '#4a3a30';
let lookNow: Look | null = null;
function eyeAt(e: { mesh: THREE.Object3D; local: THREE.Vector3 }): Mark {
  const at = e.local.clone().applyMatrix4(e.mesh.matrixWorld);
  // the eye looks out from the middle of the head at its height, so in a side view only the
  // near eye shows
  const centre = new THREE.Vector3(0, e.local.y, e.local.z - 0.1).applyMatrix4(e.mesh.matrixWorld);
  const normal = at.clone().sub(centre).normalize();
  return { at, normal, eye: ['#1d1420', lookNow ? IRIS(lookNow) : '#4a3a30', '#ffffff'] };
}
