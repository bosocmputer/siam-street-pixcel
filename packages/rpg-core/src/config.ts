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

/** A finite number, at least `min`, or `fallback` when the key is not there. */
export function numOr(o: Obj, key: string, where: string, fallback: number, min = 0): number {
  return o[key] === undefined ? fallback : num(o, key, where, min);
}

/** One of a fixed set of words, or `fallback` when the key is not there. */
export function pick<T extends string>(
  o: Obj,
  key: string,
  where: string,
  allowed: readonly T[],
  fallback?: T,
): T {
  const v = o[key];
  if (v === undefined && fallback !== undefined) return fallback;
  const found = allowed.find((a) => a === v);
  if (found === undefined)
    throw new ConfigError(
      `${where}.${key}: expected one of ${allowed.join(', ')}, got ${JSON.stringify(v)}`,
    );
  return found;
}

/** true or false, or `fallback` when the key is not there. */
export function flag(o: Obj, key: string, where: string, fallback: boolean): boolean {
  const v = o[key];
  if (v === undefined) return fallback;
  if (typeof v !== 'boolean') throw new ConfigError(`${where}.${key}: expected true or false`);
  return v;
}
