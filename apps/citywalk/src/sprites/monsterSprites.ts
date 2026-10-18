// A monster as a pixel sprite sheet, drawn from the creator's model with its own animation
// clips (one animation per clip), in the species' colour and size.

import * as THREE from 'three';
import { SPRITES, type AnimSpec, type MonsterSpec } from '@newgame/rpg-core';
import { ownSkins, type SlimeTemplate } from '../slime';
import { bake, cartoon, type Baked, type Mark } from './bake';

export function bakeMonster(t: SlimeTemplate, spec: MonsterSpec, sp = SPRITES): Baked {
  const root = t.scene.clone(true);
  ownSkins(root, spec.tint);
  root.scale.setScalar(spec.scale);
  const wrap = new THREE.Group();
  wrap.add(root);
  cartoon(wrap);
  const mixer = new THREE.AnimationMixer(root);
  // frames per clip: its length at the monster frame rate, within limits
  const anims: [string, AnimSpec][] = t.clips.map((c) => {
    const n = Math.max(2, Math.min(sp.monster.maxFrames, Math.round(c.duration * sp.monster.fps)));
    return [c.name, { frames: n, fps: n / Math.max(0.05, c.duration), loop: true }];
  });
  // room for the body and a hop above it
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3());
  const step = (m: number) => Math.ceil((m * sp.ppm) / 4) * 4;
  const fw = step(Math.max(size.x, size.z) * 1.3) + 8;
  const fh = step(size.y * 1.9) + 8;
  // the model's eyes, painted as pixels so they survive shrinking
  const eyes = ['Eye_L', 'Eye_R']
    .map((n) => root.getObjectByName(n))
    .filter((e): e is THREE.Object3D => !!e);
  const small = t.height * spec.scale < 1;
  return bake(
    {
      root: wrap,
      marks: () =>
        eyes.map((e): Mark => {
          const at = e.getWorldPosition(new THREE.Vector3());
          // looking out from the middle of the body at the eye's height
          const normal = at
            .clone()
            .setY(0)
            .sub(wrap.getWorldPosition(new THREE.Vector3()).setY(0))
            .normalize();
          return { at, normal, eye: ['#1a1420', '#1a1420', '#ffffff'], small };
        }),
      face: (a) => (wrap.rotation.y = a),
      pose: (anim, i, n) => {
        const clip = t.clips.find((c) => c.name === anim)!;
        mixer.stopAllAction();
        mixer.clipAction(clip).reset().play();
        mixer.setTime((i / n) * clip.duration);
      },
    },
    { frame: [fw, fh], anchor: [fw / 2, fh - 4], anims },
    sp,
  );
}
