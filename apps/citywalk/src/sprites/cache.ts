// Sprite sheets the game draws are kept in the browser (IndexedDB), so the next start shows them
// at once instead of drawing them again. Each slot ("hero", a monster's id) holds one sheet with
// a signature of everything it was drawn from: the look or species, the sprite settings, the
// model file and the game's own code. When any of these changes, the sheet is drawn again.

import * as THREE from 'three';
import { readSheetMeta, type SheetMeta } from '@newgame/rpg-core';
import type { Baked } from './bake';
import { pixelTexture, sheetFromBaked, type SpriteSheet } from './sheet';

const DB = 'citywalk-sprites';
const STORE = 'sheets';

/** A short fingerprint of some strings and file contents (FNV-1a, 32 bits per part). */
export function signature(...parts: (string | ArrayBuffer | undefined)[]): string {
  return parts
    .map((p) => {
      let h = 0x811c9dc5;
      const step = (b: number) => {
        h ^= b;
        h = Math.imul(h, 0x01000193) >>> 0;
      };
      if (p === undefined) step(0);
      else if (typeof p === 'string')
        for (let i = 0; i < p.length; i++) {
          step(p.charCodeAt(i) & 0xff);
          step(p.charCodeAt(i) >> 8);
        }
      else for (const b of new Uint8Array(p)) step(b);
      return h.toString(16).padStart(8, '0');
    })
    .join('');
}

interface Stored {
  slot: string;
  sig: string;
  meta: SheetMeta;
  pages: Blob[];
}

/** the slots served from the cache since the page opened (for tests) */
export const fromCache = new Set<string>();

function open(): Promise<IDBDatabase> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}

function read(db: IDBDatabase, slot: string): Promise<Stored | undefined> {
  return new Promise((ok, fail) => {
    const req = db.transaction(STORE).objectStore(STORE).get(slot);
    req.onsuccess = () => ok(req.result as Stored | undefined);
    req.onerror = () => fail(req.error);
  });
}

function write(db: IDBDatabase, value: Stored): Promise<void> {
  return new Promise((ok, fail) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value);
    tx.oncomplete = () => ok();
    tx.onerror = () => fail(tx.error);
  });
}

const toBlob = (c: HTMLCanvasElement) =>
  new Promise<Blob>((ok, fail) =>
    c.toBlob((b) => (b ? ok(b) : fail(new Error('no picture'))), 'image/png'),
  );

function image(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const url = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      ok(im);
    };
    im.onerror = () => fail(new Error('a kept picture did not load'));
    im.src = url;
  });
}

/**
 * The sheet for `slot` drawn from what `sig` describes: from the browser if it was kept,
 * otherwise drawn by `bake` now and kept for next time. Without storage it just draws.
 */
export async function cachedSheet(
  slot: string,
  sig: string,
  bake: () => Baked,
): Promise<SpriteSheet> {
  let db: IDBDatabase | null = null;
  try {
    db = await open();
    const kept = await read(db, slot);
    if (kept && kept.sig === sig) {
      const images = await Promise.all(kept.pages.map(image));
      const meta = readSheetMeta(kept.meta, images);
      fromCache.add(slot);
      return { meta, pages: images.map((im) => pixelTexture(new THREE.Texture(im))) };
    }
  } catch (err) {
    console.warn(`sprite cache unavailable for ${slot}:`, err);
  }
  const baked = bake();
  if (db) {
    const store = db;
    // kept in the background; a failure only means drawing again next time
    void Promise.all(baked.pages.map(toBlob))
      .then((pages) => write(store, { slot, sig, meta: baked.meta, pages }))
      .catch((err) => console.warn(`sprite ${slot} not kept:`, err));
  }
  return sheetFromBaked(baked);
}
