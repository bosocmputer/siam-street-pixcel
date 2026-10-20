// Where monsters live and where players rest (config/spawns.json), checked against the list of
// species. Zones are written in one of two frames: `gate`, metres in the Tha Phae Gate frame (x
// along the wall, z out onto the square), or `map`, metres on the city map.

import spawnsJson from '../config/spawns.json';
import { ConfigError, num, obj } from './config';
import { MONSTERS } from './monsters';

export type Frame = 'gate' | 'map';

export interface Spawn {
  species: string;
  at: [number, number];
  /** the monster's level here (monsters.json `levels` says what that changes) */
  level: number;
}

export interface SpawnZone {
  frame: Frame;
  spawns: Spawn[];
}

/** Where a player gets up after going down: the nearest one. Monsters leave them alone there. */
export interface RestPoint {
  id: string;
  frame: Frame;
  at: [number, number];
}

export interface SpawnBook {
  zones: Record<string, SpawnZone>;
  rest: RestPoint[];
  /** metres round a rest point where monsters leave the player alone and none live */
  restRadius: number;
  /** metres round a temple's grounds kept free of monsters */
  templeClear: number;
  /** monsters further than this from the player (metres) stand still and are not drawn */
  activeRange: number;
}

const FRAMES: readonly Frame[] = ['gate', 'map'];

function point(raw: unknown, w: string): [number, number] {
  if (
    !Array.isArray(raw) ||
    raw.length !== 2 ||
    !raw.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    throw new ConfigError(`${w}: expected [x, z]`);
  return [raw[0] as number, raw[1] as number];
}

function frame(raw: unknown, w: string): Frame {
  if (!FRAMES.includes(raw as Frame)) throw new ConfigError(`${w}: expected "gate" or "map"`);
  return raw as Frame;
}

export function readSpawns(
  raw: unknown,
  speciesIds: readonly string[] = Object.keys(MONSTERS),
): SpawnBook {
  const root = obj(raw, 'spawns.json');
  const zonesRaw = obj(root.zones, 'spawns.zones');
  const zones: Record<string, SpawnZone> = {};
  for (const [id, z] of Object.entries(zonesRaw)) {
    const w = `spawns.zones.${id}`;
    const zone = obj(z, w);
    const list = zone.spawns;
    if (!Array.isArray(list) || list.length === 0)
      throw new ConfigError(`${w}.spawns: expected a list of spawns`);
    zones[id] = {
      frame: frame(zone.frame, `${w}.frame`),
      spawns: list.map((raw, i) => {
        const sw = `${w}.spawns[${i}]`;
        const s = obj(raw, sw);
        if (typeof s.species !== 'string' || !speciesIds.includes(s.species))
          throw new ConfigError(`${sw}.species: no monster called ${JSON.stringify(s.species)}`);
        const level = num(s, 'level', sw, 1);
        if (!Number.isInteger(level)) throw new ConfigError(`${sw}.level: a whole number`);
        return { species: s.species, at: point(s.at, `${sw}.at`), level };
      }),
    };
  }
  if (Object.keys(zones).length === 0) throw new ConfigError('spawns.json: no zones');
  if (!Array.isArray(root.rest) || root.rest.length === 0)
    throw new ConfigError('spawns.rest: expected a list of rest points');
  const rest = root.rest.map((raw, i): RestPoint => {
    const w = `spawns.rest[${i}]`;
    const r = obj(raw, w);
    if (typeof r.id !== 'string' || r.id === '') throw new ConfigError(`${w}.id: expected a name`);
    return { id: r.id, frame: frame(r.frame, `${w}.frame`), at: point(r.at, `${w}.at`) };
  });
  return {
    zones,
    rest,
    restRadius: num(root, 'restRadius', 'spawns'),
    templeClear: num(root, 'templeClear', 'spawns'),
    activeRange: num(root, 'activeRange', 'spawns', 10),
  };
}

export const SPAWNS = readSpawns(spawnsJson);
