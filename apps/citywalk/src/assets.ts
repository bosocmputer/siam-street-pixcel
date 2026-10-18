// The asset list (public/assets.json) and loading everything on it with progress.

import type { WorldData } from './types';

export interface ModelEntry {
  id: string;
  file: string;
  /** animation names the game needs from the file */
  clips?: string[];
  // --- for a character model (see src/hero.ts) ---
  /** rig joint name → this model's bone name, when they differ (a model from Blender, Mixamo...) */
  joints?: Record<string, string> | 'mixamo' | 'vroid';
  /** degrees [x, y, z] to turn joints so the model stands like the rig (arms down from a T-pose) */
  restFix?: Record<string, [number, number, number]>;
  /** metres tall to scale to (default: the rig's height) */
  height?: number;
  /** which way the model faces (default +z) */
  forward?: '+z' | '-z' | '+x' | '-x';
  /** dark edges round the body (default on), and how thick, metres */
  outline?: boolean;
  outlineWidth?: number;
}

export interface Manifest {
  world: string;
  models: ModelEntry[];
  /**
   * pixel sprite sheets made outside the game (for example in PixelLab, packed with
   * tools/sprites/pack.py), by "hero" or a monster species id → the sheet's .json; anything not
   * listed is drawn from its model
   */
  sprites?: Record<string, string>;
}

export interface Loaded {
  world: WorldData;
  /** file bytes by model id; a model that failed to load is missing */
  models: Map<string, ArrayBuffer>;
  manifest: Manifest;
}

/**
 * The .glb file, or the same bytes as base64 text next to it (`<name>.glb.b64.txt`) for hosts that
 * only serve text, such as the shared preview page.
 */
export async function fetchModel(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (res.ok && !(res.headers.get('content-type') ?? '').includes('text/html'))
    return res.arrayBuffer();
  const text = await fetch(`${url}.b64.txt`).then((r) => {
    if (!r.ok) throw new Error(`model not found: ${url}`);
    return r.text();
  });
  const bin = atob(text.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Load the map and every model, reporting how many of them are done. The map is required (this
 * throws without it); models are optional.
 */
export async function loadAssets(progress: (done: number, total: number) => void): Promise<Loaded> {
  const manifest = await json<Manifest>('./assets.json');
  const total = 1 + manifest.models.length;
  let done = 0;
  const tick = () => progress(++done, total);
  progress(0, total);
  const models = new Map<string, ArrayBuffer>();
  const [world] = await Promise.all([
    json<WorldData>(`./${manifest.world}`).then((w) => {
      tick();
      return w;
    }),
    ...manifest.models.map((m) =>
      fetchModel(`./${m.file}`)
        .then((bytes) => models.set(m.id, bytes))
        .catch((err) => console.error(`model ${m.id} skipped:`, err))
        .finally(tick),
    ),
  ]);
  return { world, models, manifest };
}

/** Animation names a model entry asks for that the loaded file does not have. */
export function missingClips(
  entry: ModelEntry | undefined,
  have: readonly { name: string }[],
): string[] {
  const names = new Set(have.map((c) => c.name));
  return (entry?.clips ?? []).filter((c) => !names.has(c));
}
