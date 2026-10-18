// How the player's character looks, chosen on the character screen, and the checks on it.
// Choices come from config/appearance.json.

import appearanceJson from '../config/appearance.json';
import { ConfigError, num, obj, strings } from './config';

export type Body = 'm' | 'f';

export interface Look {
  body: Body;
  hair: string;
  hairColor: string;
  face: string;
  eye: string;
  skin: string;
  name: string;
}

export interface FaceStyle {
  tilt: number;
  browAngle: number;
  eyeK: number;
  irisSize: number;
  /** per body, [m, f] */
  smile: [number, number];
  sharp: [number, number];
}

export interface AppearanceSpec {
  bodies: Body[];
  hair: string[];
  hairColors: Record<string, string>;
  faces: Record<string, FaceStyle>;
  eyes: Record<string, string>;
  skins: Record<string, string>;
  defaults: Record<Body, Omit<Look, 'body' | 'name'>>;
  earsHiddenBy: string[];
  nameMax: number;
}

/** The parts of a look picked from a list, in the order the screen shows them. */
export const LOOK_PARTS = ['hair', 'hairColor', 'face', 'eye', 'skin'] as const;
export type LookPart = (typeof LOOK_PARTS)[number];

const HEX = /^#[0-9a-f]{6}$/i;

function colours(v: unknown, where: string): Record<string, string> {
  const o = obj(v, where);
  for (const [k, c] of Object.entries(o))
    if (typeof c !== 'string' || !HEX.test(c))
      throw new ConfigError(`${where}.${k}: expected #rrggbb`);
  if (!Object.keys(o).length) throw new ConfigError(`${where}: empty`);
  return o as Record<string, string>;
}

const pair = (o: Record<string, unknown>, key: string, where: string): [number, number] => {
  const v = o[key];
  if (!Array.isArray(v) || v.length !== 2 || !v.every((n) => typeof n === 'number'))
    throw new ConfigError(`${where}.${key}: expected [m, f]`);
  return [v[0] as number, v[1] as number];
};

export function readAppearance(raw: unknown): AppearanceSpec {
  const w = 'appearance';
  const o = obj(raw, 'appearance.json');
  const bodies = strings(o.bodies, `${w}.bodies`);
  if (bodies.join() !== 'm,f') throw new ConfigError(`${w}.bodies: expected ["m", "f"]`);
  const hair = strings(o.hair, `${w}.hair`);
  if (!hair.length) throw new ConfigError(`${w}.hair: empty`);
  const fo = obj(o.faces, `${w}.faces`);
  const faces: Record<string, FaceStyle> = {};
  for (const [id, f] of Object.entries(fo)) {
    const fw = `${w}.faces.${id}`;
    const x = obj(f, fw);
    const any = (k: string) => {
      const v = x[k];
      if (typeof v !== 'number' || !Number.isFinite(v))
        throw new ConfigError(`${fw}.${k}: expected a number`);
      return v;
    };
    faces[id] = {
      tilt: any('tilt'),
      browAngle: any('browAngle'),
      eyeK: num(x, 'eyeK', fw, 0.1),
      irisSize: num(x, 'irisSize', fw, 0.1),
      smile: pair(x, 'smile', fw),
      sharp: pair(x, 'sharp', fw),
    };
  }
  if (!Object.keys(faces).length) throw new ConfigError(`${w}.faces: empty`);
  const spec: AppearanceSpec = {
    bodies: ['m', 'f'],
    hair,
    hairColors: colours(o.hairColors, `${w}.hairColors`),
    faces,
    eyes: colours(o.eyes, `${w}.eyes`),
    skins: colours(o.skins, `${w}.skins`),
    defaults: {} as AppearanceSpec['defaults'],
    earsHiddenBy: strings(o.earsHiddenBy, `${w}.earsHiddenBy`),
    nameMax: num(o, 'nameMax', w, 1),
  };
  const d = obj(o.defaults, `${w}.defaults`);
  for (const body of spec.bodies) {
    const x = obj(d[body], `${w}.defaults.${body}`);
    if (!fits({ body, ...x }, spec))
      throw new ConfigError(`${w}.defaults.${body}: uses a choice that is not on the lists`);
    const s = (k: LookPart) => x[k] as string;
    spec.defaults[body] = {
      hair: s('hair'),
      hairColor: s('hairColor'),
      face: s('face'),
      eye: s('eye'),
      skin: s('skin'),
    };
  }
  return spec;
}

/** The ids the screen offers for one part of the look. */
export function choices(part: LookPart, spec: AppearanceSpec = APPEARANCE): string[] {
  switch (part) {
    case 'hair':
      return spec.hair;
    case 'hairColor':
      return Object.keys(spec.hairColors);
    case 'face':
      return Object.keys(spec.faces);
    case 'eye':
      return Object.keys(spec.eyes);
    case 'skin':
      return Object.keys(spec.skins);
  }
}

function fits(l: Record<string, unknown>, spec: AppearanceSpec): boolean {
  return (
    (l.body === 'm' || l.body === 'f') &&
    LOOK_PARTS.every((p) => typeof l[p] === 'string' && choices(p, spec).includes(l[p] as string))
  );
}

export const APPEARANCE = readAppearance(appearanceJson);

export function defaultLook(body: Body = 'm', name = '', spec = APPEARANCE): Look {
  return { body, ...spec.defaults[body], name };
}

export type NameCheck = 'ok' | 'empty' | 'long' | 'letters';

/** Thai, English letters, digits and single spaces; trimmed; not longer than nameMax. */
export function checkName(name: string, spec = APPEARANCE): NameCheck {
  const n = name.trim();
  if (!n) return 'empty';
  if ([...n].length > spec.nameMax) return 'long';
  return /^[฀-๿a-zA-Z0-9]+( [฀-๿a-zA-Z0-9]+)*$/.test(n) ? 'ok' : 'letters';
}

/** A look read back from a save, or null if anything in it is not a current choice. */
export function validLook(raw: unknown, spec = APPEARANCE): Look | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!fits(o, spec) || typeof o.name !== 'string' || checkName(o.name, spec) !== 'ok') return null;
  const l = o as unknown as Look;
  return {
    body: l.body,
    hair: l.hair,
    hairColor: l.hairColor,
    face: l.face,
    eye: l.eye,
    skin: l.skin,
    name: l.name.trim(),
  };
}

/** A random look (the dice button), keeping the name. `rng` gives numbers in [0, 1). */
export function randomLook(rng: () => number, name = '', spec = APPEARANCE): Look {
  const any = <T>(list: T[]) => list[Math.min(list.length - 1, Math.floor(rng() * list.length))]!;
  return {
    body: any(spec.bodies),
    hair: any(choices('hair', spec)),
    hairColor: any(choices('hairColor', spec)),
    face: any(choices('face', spec)),
    eye: any(choices('eye', spec)),
    skin: any(choices('skin', spec)),
    name,
  };
}
