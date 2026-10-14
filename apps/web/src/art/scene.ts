// Placeholder background: a low top-down night-market street drawn with code. PixelLab tiles replace it
// later (docs/art_brief.md). One palette per element so each district has its own mood.
import type { Element } from '@slimehood/game-core';
import { makeCanvas, ctxOf } from './draw';

interface Mood {
  sky: string[]; // top -> horizon
  brickA: string;
  brickB: string;
  gap: string;
  awnings: [string, string, string];
  glow: string;
  lights: string[];
}

const MOODS: Record<Element, Mood> = {
  earth: {
    sky: ['#0c0a22', '#14102f', '#1d1540', '#2b1a4d', '#47235a'],
    brickA: '#46304a',
    brickB: '#523a52',
    gap: '#201529',
    awnings: ['#ef5a50', '#ffb84d', '#5fe0b0'],
    glow: '255,170,70',
    lights: ['#ffd98a', '#ff8a3d', '#ffd98a', '#5fe0b0'],
  },
  water: {
    sky: ['#071427', '#0b1f3a', '#10305a', '#16467a', '#22609a'],
    brickA: '#2c3a5a',
    brickB: '#34456a',
    gap: '#141c33',
    awnings: ['#5aa9e6', '#f6f0e4', '#5fe0b0'],
    glow: '130,200,255',
    lights: ['#cdeaf5', '#8cc8f5', '#cdeaf5', '#ffd98a'],
  },
  fire: {
    sky: ['#14081c', '#26102a', '#3f1630', '#6a2034', '#a0392f'],
    brickA: '#4a2a36',
    brickB: '#5a3340',
    gap: '#241320',
    awnings: ['#ff8a3d', '#ef5a50', '#ffd98a'],
    glow: '255,120,50',
    lights: ['#ff8a3d', '#ffd98a', '#ef5a50', '#ffd98a'],
  },
  wind: {
    sky: ['#0b1024', '#141a3a', '#1f2a55', '#2e4278', '#4d6aa0'],
    brickA: '#3a3a58',
    brickB: '#444464',
    gap: '#1c1c33',
    awnings: ['#cdeaf5', '#c4a6f0', '#ffd98a'],
    glow: '200,220,255',
    lights: ['#f6f0e4', '#cdeaf5', '#f6f0e4', '#c4a6f0'],
  },
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, HTMLCanvasElement>();

/** w x h low-resolution canvas; show it scaled up with pixelated rendering. */
export function sceneCanvas(element: Element, w = 130, h = 110, seed = 7): HTMLCanvasElement {
  const key = `${element}:${w}x${h}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mood = MOODS[element];
  const c = makeCanvas(w, h);
  const g = ctxOf(c);
  const r = rng(seed);
  const R = (col: string, x: number, y: number, ww = 1, hh = 1) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  };
  const skyH = Math.round(h * 0.34);
  for (let y = 0; y < skyH; y++) R(mood.sky[Math.min(4, Math.floor((y / skyH) * 5))]!, 0, y, w, 1);
  for (let i = 0; i < 26; i++)
    R(i % 4 ? '#6b64a8' : '#f6f0e4', Math.floor(r() * w), Math.floor(r() * skyH * 0.7), 1, 1);
  // shophouse silhouettes
  let x = 0;
  while (x < w) {
    const bw = 12 + Math.floor(r() * 12),
      bh = 12 + Math.floor(r() * 14);
    R('#0a0820', x, skyH - bh, bw, bh + 2);
    for (let wy = skyH - bh + 3; wy < skyH - 3; wy += 5)
      for (let wx = x + 2; wx < x + bw - 2; wx += 4)
        if (r() > 0.45) R(r() > 0.5 ? '#ffb84d' : '#c9822a', wx, wy, 2, 2);
    x += bw + 1;
  }
  // brick pavement
  for (let y = skyH; y < h; y++) {
    const row = Math.floor((y - skyH) / 5);
    R(mood.gap, 0, y, w, 1);
    for (let px = (row % 2) * 6 - 6; px < w; px += 12) {
      const col = r() > 0.5 ? mood.brickA : mood.brickB;
      R(col, px + 1, y, 10, (y - skyH) % 5 === 4 ? 0 : 1);
    }
  }
  for (let y = skyH; y < h; y += 5) R(mood.gap, 0, y + 4, w, 1);
  // market stalls with striped awnings
  [10, 52, 94].forEach((sx, i) => {
    const y0 = skyH - 2,
      sw = 30;
    R('#0a0820', sx, y0 - 2, sw, 16);
    const c1 = mood.awnings[i % 3]!;
    for (let k = 0; k < sw; k += 4) {
      R((k / 4) % 2 ? '#f6f0e4' : c1, sx + k, y0, 4, 6);
      R((k / 4) % 2 ? '#d9d2c3' : c1, sx + k, y0 + 6, 4, 1);
    }
    R('#3a2418', sx + 2, y0 + 7, 3, 8);
    R('#3a2418', sx + sw - 5, y0 + 7, 3, 8);
    R('#6b4a2a', sx + 3, y0 + 10, sw - 6, 2);
    R('#ffd98a', sx + 8, y0 + 8, 2, 2);
    R('#5fe0b0', sx + 14, y0 + 8, 2, 2);
    R('#ef5a50', sx + 19, y0 + 8, 2, 2);
  });
  // string lights
  for (let lx = 0; lx < w; lx++) {
    const ly = 3 + Math.round(4 * Math.sin((lx / w) * Math.PI * 4));
    R('#1b1630', lx, ly, 1, 1);
    if (lx % 7 === 0) {
      R(mood.lights[(lx / 7) % 4 | 0]!, lx, ly + 1, 1, 2);
      g.fillStyle = `rgba(${mood.glow},0.12)`;
      g.fillRect(lx - 3, ly - 1, 7, 7);
    }
  }
  // warm pools of light on the ground
  [28, 72, 112].forEach((gx) => {
    for (let k = 8; k > 0; k--) {
      g.fillStyle = `rgba(${mood.glow},${0.018 * (9 - k)})`;
      g.beginPath();
      g.ellipse(gx, skyH + 20, k * 4.5, k * 2.2, 0, 0, 7);
      g.fill();
    }
  });
  // hanging lanterns
  [16, 60, 104].forEach((lx, i) => {
    R('#1b1630', lx + 2, 0, 1, 8 + (i % 2) * 3);
    const ly = 8 + (i % 2) * 3;
    R('#5a1a0a', lx, ly, 5, 6);
    R('#ff7a3a', lx + 1, ly + 1, 3, 4);
    R('#ffd98a', lx + 2, ly + 2, 1, 2);
    R('#5a1a0a', lx + 1, ly + 6, 3, 1);
  });
  cache.set(key, c);
  return c;
}
