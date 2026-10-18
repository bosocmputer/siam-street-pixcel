// The player's character built from the choices on the character screen, with the same code
// that makes the model files (tools/character), so every look is a real model at once.

import { APPEARANCE, type Look } from '@newgame/rpg-core';
import rigJson from '@newgame/rpg-core/config/rig.json';
import { buildCharacter, type BuiltCharacter } from '../tools/character/build.js';
import { DESIGNS } from '../tools/character/designs.js';
import type { HeroTemplate } from './hero';

/** A body design with the look's choices put in. */
export function styleFor(l: Look): object {
  const s = structuredClone(DESIGNS[l.body]);
  const i = l.body === 'm' ? 0 : 1;
  const f = APPEARANCE.faces[l.face]!;
  s.hairStyle = l.hair;
  s.hair = APPEARANCE.hairColors[l.hairColor]!;
  s.skin = APPEARANCE.skins[l.skin]!;
  s.sharp = f.sharp[i];
  s.ears = !APPEARANCE.earsHiddenBy.includes(l.hair);
  Object.assign(s.face, {
    iris: APPEARANCE.eyes[l.eye]!,
    tilt: f.tilt,
    browAngle: f.browAngle,
    irisSize: f.irisSize,
    smile: f.smile[i],
    eyeH: (s.face.eyeH as number) * f.eyeK,
  });
  return s;
}

export const buildLook = (l: Look): BuiltCharacter => buildCharacter(styleFor(l), rigJson);

/** The look as a body the game can pose (see hero.ts). */
export function heroFromLook(l: Look): HeroTemplate {
  return { scene: buildLook(l).root, entry: { id: 'hero', file: '' } };
}

/** Free the GPU memory of a character that is no longer shown. */
export function disposeCharacter(c: BuiltCharacter): void {
  c.root.traverse((o) => (o as { geometry?: { dispose(): void } }).geometry?.dispose());
  for (const m of c.materials) {
    (m as { map?: { dispose(): void } | null }).map?.dispose();
    m.dispose();
  }
}
