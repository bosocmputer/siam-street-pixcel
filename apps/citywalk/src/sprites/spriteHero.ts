// The player as a pixel sprite: the same controls and moves as the 3D body (hero.ts), shown as
// frames of a sprite sheet (drawn from the character model, or loaded from files).

import * as THREE from 'three';
import { frameOfDistance } from '@newgame/rpg-core';
import { makeShadow, type Walker } from '../walker';
import { SpriteActor } from './actor';
import { HERO_GAIT } from './heroSprites';
import type { SpriteSheet } from './sheet';

export function makeSpriteHero(sheet: SpriteSheet): Walker {
  const body = new THREE.Group();
  body.name = 'Hero';
  const actor = new SpriteActor(sheet);
  body.add(actor.object, makeShadow(0.42));
  // the bike is drawn in the riding frames
  const bike = new THREE.Group();
  bike.visible = false;
  body.add(bike);
  const m = sheet.meta;
  const tall = m.anchor[1] / m.ppm;
  const hurtFor = (a = m.anims.hurt) => (a ? a.frames / Math.max(1, a.fps) : 0);
  let hurt = 0,
    walked = 0;
  const hand = new THREE.Vector3();
  return {
    body,
    bike,
    lift: 0.04,
    fallsItself: true,
    showing: () => actor.playing,
    bob: () => undefined,
    // the right hand raised in front (the body faces -z, its right is +x)
    hand: (out) => body.localToWorld(out.copy(hand.set(0.3, tall * 0.62, -0.25))),
    hurt: () => {
      hurt = hurtFor();
    },
    animate: (dt, mo) => {
      walked += mo.speed * dt;
      hurt = Math.max(0, hurt - dt);
      const gait = (anim: 'walk' | 'run') => {
        const a = m.anims[anim];
        if (!a) return actor.play('idle');
        // a sheet with a frame rate plays by time; one without follows the distance walked
        if (a.fps > 0) actor.play(anim, mo.speed / HERO_GAIT[anim].speed);
        else actor.hold(anim, frameOfDistance(a.frames, walked, HERO_GAIT[anim].cycle));
      };
      const act = mo.act;
      if (mo.down) actor.play(actor.has('down') ? 'down' : 'hurt');
      else if (act && actor.has(act.kind)) {
        // a strike or dash shows the frame for how far through it is
        const n = m.anims[act.kind]!.frames;
        actor.hold(act.kind, Math.min(n - 1, Math.floor(act.t * n)));
      } else if (mo.mode === 'bike') actor.play(actor.has('ride') ? 'ride' : 'idle');
      else if (mo.casting && actor.has('cast')) actor.play('cast');
      else if (hurt > 0 && actor.has('hurt')) actor.play('hurt');
      else if (mo.speed > 5 && actor.has('run')) gait('run');
      else if (mo.speed > 0.3) gait('walk');
      else actor.play('idle');
      actor.update(dt);
    },
    // the body faces -z, so it looks the opposite way to its turn
    draw: (camera) => actor.draw(camera, body.rotation.y + Math.PI),
  };
}
