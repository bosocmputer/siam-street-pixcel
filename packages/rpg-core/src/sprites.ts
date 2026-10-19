// Pixel sprites: the sheet format every character and monster picture uses (drawn by the game
// from a model, or a file made elsewhere such as PixelLab), which row to show for the way a
// sprite faces the camera, and which frame to show when. Numbers come from config/sprites.json.

import spritesJson from '../config/sprites.json';
import { ConfigError, flag, num, obj } from './config';

export interface SheetAnim {
  /** which picture of the sheet it is on (a big sheet is split, one picture per animation) */
  page: number;
  /** first row of this animation on its picture; one row per direction follows */
  row: number;
  frames: number;
  /** frames per second; 0 = the frames follow distance walked instead of time */
  fps: number;
  loop: boolean;
}

/**
 * How a sheet is laid out: frames of `frame` pixels, one row per animation and direction (all
 * of one animation's directions together, front first), one column per frame. `anchor` is where
 * the feet stand in a frame (pixels from the left and top); `ppm` is pixels per metre.
 */
export interface SheetMeta {
  frame: [number, number];
  anchor: [number, number];
  ppm: number;
  /** 5 = front, front-side, side, back-side, back (the rest mirrored); 8 = every direction */
  dirs: 5 | 8;
  anims: Record<string, SheetAnim>;
}

export interface AnimSpec {
  frames: number;
  fps: number;
  loop: boolean;
}

export interface SpriteSpec {
  ppm: number;
  elevation: number;
  dirs: 5 | 8;
  colors: number;
  outline: number;
  supersample: number;
  /** the most pixels a frame may be drawn at before shrinking (big monsters are supersampled less) */
  maxRender: number;
  /** skill effects are drawn in pixels this many screen pixels across */
  fxPixel: number;
  hero: {
    frame: [number, number];
    anchor: [number, number];
    proportions: Record<string, [number, number, number]>;
    anims: Record<string, AnimSpec>;
  };
  monster: { fps: number; maxFrames: number };
}

const pair = (v: unknown, where: string, min = 1): [number, number] => {
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number' && n >= min))
    throw new ConfigError(`${where}: expected [x, y]`);
  return [v[0] as number, v[1] as number];
};

const dirsOf = (o: Record<string, unknown>, where: string): 5 | 8 => {
  if (o.dirs !== 5 && o.dirs !== 8) throw new ConfigError(`${where}.dirs: expected 5 or 8`);
  return o.dirs;
};

function readAnim(v: unknown, where: string): AnimSpec {
  const a = obj(v, where);
  const frames = num(a, 'frames', where, 1);
  if (!Number.isInteger(frames)) throw new ConfigError(`${where}.frames: expected a whole number`);
  return { frames, fps: num(a, 'fps', where), loop: flag(a, 'loop', where, true) };
}

function readProportions(v: unknown, where: string): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (const [k, s] of Object.entries(obj(v, where))) {
    if (!Array.isArray(s) || s.length !== 3 || !s.every((n) => typeof n === 'number' && n > 0))
      throw new ConfigError(`${where}.${k}: expected [x, y, z] above 0`);
    out[k] = [s[0], s[1], s[2]];
  }
  return out;
}

export function readSprites(raw: unknown): SpriteSpec {
  const w = 'sprites';
  const o = obj(raw, 'sprites.json');
  const h = obj(o.hero, `${w}.hero`);
  const frame = pair(h.frame, `${w}.hero.frame`);
  const anchor = pair(h.anchor, `${w}.hero.anchor`, 0);
  if (anchor[0] > frame[0] || anchor[1] > frame[1])
    throw new ConfigError(`${w}.hero.anchor: must be inside the frame`);
  const ha = obj(h.anims, `${w}.hero.anims`);
  const anims: Record<string, AnimSpec> = {};
  for (const [k, v] of Object.entries(ha)) anims[k] = readAnim(v, `${w}.hero.anims.${k}`);
  for (const need of ['idle', 'walk', 'run'])
    if (!anims[need]) throw new ConfigError(`${w}.hero.anims: ${need} is missing`);
  const m = obj(o.monster, `${w}.monster`);
  const outline = num(o, 'outline', w);
  if (outline > 1) throw new ConfigError(`${w}.outline: expected 0..1`);
  return {
    ppm: num(o, 'ppm', w, 1),
    elevation: num(o, 'elevation', w),
    dirs: dirsOf(o, w),
    colors: num(o, 'colors', w, 2),
    outline,
    supersample: num(o, 'supersample', w, 1),
    maxRender: num(o, 'maxRender', w, 16),
    fxPixel: num(o, 'fxPixel', w, 1),
    hero: {
      frame,
      anchor,
      proportions: readProportions(h.proportions, `${w}.hero.proportions`),
      anims,
    },
    monster: {
      fps: num(m, 'fps', `${w}.monster`, 1),
      maxFrames: num(m, 'maxFrames', `${w}.monster`, 1),
    },
  };
}

export const SPRITES = readSprites(spritesJson);

/**
 * Lay animations out for drawing: each animation gets its own picture (so no picture grows past
 * what phones can load), one row per direction, one column per frame.
 */
export function sheetLayout(anims: [string, AnimSpec][]): Record<string, SheetAnim> {
  const out: Record<string, SheetAnim> = {};
  anims.forEach(([name, a], page) => (out[name] = { page, row: 0, ...a }));
  return out;
}

/**
 * Check the description of a sheet from files (for example packed from PixelLab pictures) against
 * the sizes of its pictures. Throws ConfigError when something does not fit.
 */
export function readSheetMeta(
  raw: unknown,
  images?: { width: number; height: number }[],
): SheetMeta {
  const w = 'sheet';
  const o = obj(raw, w);
  const frame = pair(o.frame, `${w}.frame`);
  const anchor = pair(o.anchor, `${w}.anchor`, 0);
  const dirs = dirsOf(o, w);
  const ao = obj(o.anims, `${w}.anims`);
  const anims: Record<string, SheetAnim> = {};
  for (const [k, v] of Object.entries(ao)) {
    const where = `${w}.anims.${k}`;
    const a = readAnim(v, where);
    const vo = obj(v, where);
    const row = num(vo, 'row', where);
    const page = vo.page === undefined ? 0 : num(vo, 'page', where);
    anims[k] = { page, row, ...a };
    const im = images?.[page];
    if (images && !im) throw new ConfigError(`${where}.page: there is no picture ${page}`);
    if (im && (im.width < a.frames * frame[0] || im.height < (row + dirs) * frame[1]))
      throw new ConfigError(
        `${where}: picture ${page} is ${im.width}x${im.height} but the frames need ${a.frames * frame[0]}x${(row + dirs) * frame[1]}`,
      );
  }
  // a character's standing pose is 'idle'; a monster's keeps its model's clip name, 'Idle'
  if (!anims.idle && !anims.Idle) throw new ConfigError(`${w}.anims: idle is missing`);
  return { frame, anchor, ppm: num(o, 'ppm', w, 1), dirs, anims };
}

/**
 * Which row of an animation to show, and whether to mirror it. `facing` is the way the sprite
 * faces and `toCamera` the way from it to the camera, both as angles on the ground
 * (atan2(x, z)). Front (row 0) is facing the camera; rows turn a quarter-eighth at a time towards
 * the camera's right (row 2 = facing the right of the screen). With 5 directions the left-facing
 * ones are the right-facing rows mirrored.
 */
export function spriteDirection(
  facing: number,
  toCamera: number,
  dirs: 5 | 8,
): { row: number; mirror: boolean } {
  const k = (((Math.round((facing - toCamera) / (Math.PI / 4)) % 8) + 8) % 8) as number;
  if (dirs === 8 || k <= 4) return { row: k, mirror: false };
  return { row: 8 - k, mirror: true };
}

/** The frame of an animation `t` seconds in (holding the last one when it does not loop). */
export function frameAt(a: Pick<AnimSpec, 'frames' | 'fps' | 'loop'>, t: number): number {
  const n = Math.floor(Math.max(0, t) * a.fps);
  return a.loop ? n % a.frames : Math.min(a.frames - 1, n);
}

/** The frame of a walk or run after walking `metres`, when one cycle covers `cycle` metres. */
export function frameOfDistance(frames: number, metres: number, cycle: number): number {
  const f = Math.floor(((((metres / cycle) % 1) + 1) % 1) * frames);
  return Math.min(frames - 1, f);
}
