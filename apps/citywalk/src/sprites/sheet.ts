// A sprite sheet ready to draw: its layout and one texture per picture. It comes either from the
// pixel baker (drawn from a model in the game) or from files listed in public/assets.json (for
// example pictures made in PixelLab and packed with tools/sprites/pack.py). Both look the same
// to the rest of the game.

import * as THREE from 'three';
import { readSheetMeta, type SheetMeta } from '@newgame/rpg-core';
import type { Baked } from './bake';

export interface SpriteSheet {
  meta: SheetMeta;
  pages: THREE.Texture[];
}

function pixelTexture(t: THREE.Texture): THREE.Texture {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

export function sheetFromBaked(b: Baked): SpriteSheet {
  return { meta: b.meta, pages: b.pages.map((c) => pixelTexture(new THREE.CanvasTexture(c))) };
}

/**
 * Load a sheet from files: `url` is its description (the layout, plus `pages`: the picture file
 * names next to it). Throws if the pictures do not fit the description.
 */
export async function loadSheet(url: string): Promise<SpriteSheet> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const raw = (await res.json()) as { pages?: unknown };
  const names = Array.isArray(raw.pages) ? raw.pages.map(String) : [];
  if (!names.length) throw new Error(`${url}: no pages listed`);
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const images = await Promise.all(
    names.map(
      (n) =>
        new Promise<HTMLImageElement>((ok, fail) => {
          const im = new Image();
          im.onload = () => ok(im);
          im.onerror = () => fail(new Error(`${base}${n} did not load`));
          im.src = base + n;
        }),
    ),
  );
  const meta = readSheetMeta(raw, images);
  return {
    meta,
    pages: images.map((im) => {
      const t = new THREE.Texture(im);
      return pixelTexture(t);
    }),
  };
}
