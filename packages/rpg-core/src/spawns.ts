// Where monsters live (config/spawns.json), checked against the list of species.

import spawnsJson from '../config/spawns.json';
import { ConfigError, obj } from './config';
import { MONSTERS } from './monsters';

export interface Spawn {
  species: string;
  /** [x, z] in metres in the Tha Phae Gate frame */
  at: [number, number];
}

export function readSpawns(
  raw: unknown,
  speciesIds: readonly string[] = Object.keys(MONSTERS),
): Record<string, Spawn[]> {
  const root = obj(raw, 'spawns.json');
  const out: Record<string, Spawn[]> = {};
  for (const [zone, list] of Object.entries(root)) {
    if (zone === 'about') continue;
    if (!Array.isArray(list) || list.length === 0)
      throw new ConfigError(`spawns.${zone}: expected a list of spawns`);
    out[zone] = list.map((raw, i) => {
      const w = `spawns.${zone}[${i}]`;
      const s = obj(raw, w);
      if (typeof s.species !== 'string' || !speciesIds.includes(s.species))
        throw new ConfigError(`${w}.species: no monster called ${JSON.stringify(s.species)}`);
      const at = s.at;
      if (
        !Array.isArray(at) ||
        at.length !== 2 ||
        !at.every((v) => typeof v === 'number' && Number.isFinite(v))
      )
        throw new ConfigError(`${w}.at: expected [x, z]`);
      return { species: s.species, at: [at[0] as number, at[1] as number] };
    });
  }
  if (Object.keys(out).length === 0) throw new ConfigError('spawns.json: no zones');
  return out;
}

export const SPAWNS = readSpawns(spawnsJson);
