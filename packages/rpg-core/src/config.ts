// Small checks for the numbers read from config/*.json, so a typo there fails loudly at start
// instead of quietly breaking the game.

export class ConfigError extends Error {}

type Obj = Record<string, unknown>;

export function obj(v: unknown, where: string): Obj {
  if (typeof v !== 'object' || v === null || Array.isArray(v))
    throw new ConfigError(`${where}: expected an object`);
  return v as Obj;
}

/** A finite number, at least `min`. */
export function num(o: Obj, key: string, where: string, min = 0): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min)
    throw new ConfigError(`${where}.${key}: expected a number ≥ ${min}, got ${JSON.stringify(v)}`);
  return v;
}

/** A finite number of any sign. */
export function signed(o: Obj, key: string, where: string): number {
  return num(o, key, where, -Infinity);
}

export function strings(v: unknown, where: string): string[] {
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string'))
    throw new ConfigError(`${where}: expected a list of names`);
  return v as string[];
}
