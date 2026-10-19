// The player's character as a pixel sprite sheet, drawn from the same model and the same posing
// code as the 3D body (hero.ts), with a bigger head for chibi proportions.

import * as THREE from 'three';
import { APPEARANCE, SPRITES, type AnimSpec, type Look } from '@newgame/rpg-core';
import { GAIT } from '../anim/clips';
import { makeHero } from '../hero';
import { buildLook, styleFor } from '../lookModel';
import { bake, cartoon, type Baked, type Mark } from './bake';

/** walking and running speeds the frames are drawn at (metres a second), and stride cycles */
export const HERO_GAIT = GAIT;

/** Draw the sheet for a look; `anims` picks fewer animations (a quick preview). */
export function bakeHero(
  look: Look,
  spec = SPRITES,
  anims: [string, AnimSpec][] = Object.entries(spec.hero.anims),
): Baked {
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
  const sheet = bake(
    {
      root: w.body,
      marks: () => {
        w.body.updateMatrixWorld(true);
        return eyes.map(eyeAt);
      },
      face: (a) => (w.body.rotation.y = a + Math.PI),
      pose: (anim, i, n) => {
        w.body.rotation.z = 0;
        w.bike.visible = anim === 'ride';
        // frame i of n shows the middle of its share of the move; a loop starts on its first key
        const loops = spec.hero.anims[anim]?.loop ?? false;
        if (anim === 'down') {
          w.posed('hurt', 0.3);
          w.body.rotation.z = 1.45;
        } else w.posed(anim, loops ? i / n : n === 1 ? 0 : (i + 0.5) / n);
      },
    },
    {
      frame: spec.hero.frame,
      anchor: spec.hero.anchor,
      anims,
    },
    spec,
  );
  // the model was only needed for drawing
  w.body.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of [o.material].flat() as THREE.MeshBasicMaterial[]) {
      m.map?.dispose();
      m.dispose();
    }
  });
  return sheet;
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
