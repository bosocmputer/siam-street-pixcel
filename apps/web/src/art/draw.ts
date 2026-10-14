// Placeholder art, drawn with Canvas2D. Real PixelLab PNGs replace these later through
// public/assets/manifest.json (see overrides in index.ts). Everything is 48x48 or 32x32.
import type { Element } from '@slimehood/game-core';

export type Ctx = CanvasRenderingContext2D;

export const SLIME = 48;

export function makeCanvas(w: number, h = w): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return c;
}

export function ctxOf(c: HTMLCanvasElement): Ctx {
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('canvas 2d not available');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

const rect = (c: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  c.fillStyle = color;
  c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};
const disc = (c: Ctx, color: string, x: number, y: number, r: number) => {
  c.fillStyle = color;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
};
const tri = (
  c: Ctx,
  color: string,
  a: [number, number],
  b: [number, number],
  d: [number, number],
) => {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(...a);
  c.lineTo(...b);
  c.lineTo(...d);
  c.closePath();
  c.fill();
};

export const ELEMENT_COLORS: Record<Element, { body: string; shade: string; line: string }> = {
  earth: { body: '#c9825a', shade: '#9a5d3d', line: '#4a2a1b' },
  water: { body: '#5aa9e6', shade: '#3b7fc2', line: '#173e6a' },
  fire: { body: '#ff9440', shade: '#d1581f', line: '#6a2a0f' },
  wind: { body: '#cdeaf5', shade: '#8fc6dc', line: '#32596b' },
};
const CLEAR = { body: '#7ee0b0', shade: '#4fb88a', line: '#1e5a46' };

export const SKIN_COLORS: Record<string, string> = {
  clay_skin: '#b5785a',
  river_skin: '#5a90d8',
  ember_skin: '#e0603a',
  breeze_skin: '#e8f4ff',
  night_market_skin: '#8a5ad8',
  moat_skin: '#4caf7a',
  mist_skin: '#9fb4c4',
};

export const RARITY_COLORS = {
  common: '#9aa7a2',
  good: '#5fd08a',
  rare: '#5aa9ff',
  legend: '#ffb454',
} as const;

/** Anchor points (in the 48px slime frame) where equipment and growth parts are attached. */
export const ANCHORS = {
  head: { x: 24, y: 19 },
  weapon: { x: 41, y: 36 },
  // slots 0-2: active skills, 3-4: passive skills
  parts: [
    { x: 8, y: 29 },
    { x: 39, y: 24 },
    { x: 24, y: 41 },
    { x: 12, y: 19 },
    { x: 36, y: 18 },
  ],
} as const;

export function drawSlimeBody(
  c: Ctx,
  opts: { element: Element | null; tier: number; skin?: string | null },
): void {
  const pal = opts.element ? ELEMENT_COLORS[opts.element] : CLEAR;
  const body = (opts.skin && SKIN_COLORS[opts.skin]) || pal.body;
  const grow = opts.tier >= 2 ? 2 : 0; // second-tier forms are a bit bigger
  const w = 17 + grow;
  const h = 14 + grow;
  c.save();
  disc(c, 'rgba(0,0,0,0.25)', 24, 42, 15);
  c.restore();
  // body: dome with flat base
  c.fillStyle = pal.line;
  c.beginPath();
  c.ellipse(24, 33, w + 1.5, h + 1.5, 0, Math.PI, 0);
  c.rect(24 - w - 1.5, 33, (w + 1.5) * 2, 8);
  c.fill();
  c.fillStyle = pal.shade;
  c.beginPath();
  c.ellipse(24, 33, w, h, 0, Math.PI, 0);
  c.rect(24 - w, 33, w * 2, 7);
  c.fill();
  c.fillStyle = body;
  c.beginPath();
  c.ellipse(24, 32, w - 1.5, h - 1.5, 0, Math.PI, 0);
  c.rect(24 - w + 1.5, 32, (w - 1.5) * 2, 6);
  c.fill();
  // shine, eyes, mouth
  rect(c, 'rgba(255,255,255,0.55)', 15, 22, 5, 3);
  rect(c, 'rgba(255,255,255,0.35)', 15, 25, 2, 2);
  for (const ex of [18, 29]) {
    rect(c, '#12201b', ex, 29, 3, 5);
    rect(c, '#ffffff', ex, 29, 1, 2);
  }
  rect(c, pal.line, 23, 36, 3, 1);
  if (opts.tier >= 1) {
    // little crest so evolved forms read differently at a glance
    tri(c, pal.line, [21, 17], [24, 10], [27, 17]);
    tri(c, pal.shade, [22, 17], [24, 12], [26, 17]);
  }
}

// ---------- growth parts (from absorbed skills) ----------

export function drawPartAt(c: Ctx, tags: string[], el: Element, x: number, y: number): void {
  const col = ELEMENT_COLORS[el];
  const has = (t: string) => tags.includes(t);
  if (has('burn')) {
    tri(c, '#ffd15c', [x - 3, y + 4], [x, y - 5], [x + 3, y + 4]);
    tri(c, '#ff7a2c', [x - 2, y + 4], [x, y - 2], [x + 2, y + 4]);
  } else if (has('poison')) {
    disc(c, '#9b6cdc', x - 2, y + 1, 2);
    disc(c, '#c8a8f5', x + 2, y - 1, 2);
    disc(c, '#9b6cdc', x + 1, y + 3, 1.5);
  } else if (has('crit')) {
    tri(c, col.line, [x - 4, y + 3], [x - 2, y - 4], [x, y + 3]);
    tri(c, col.body, [x - 1, y + 3], [x + 2, y - 5], [x + 4, y + 3]);
  } else if (has('lifesteal')) {
    disc(c, '#ffffff', x, y, 3.5);
    disc(c, '#7a1d2b', x, y, 1.8);
  } else if (has('multi')) {
    for (const a of [-0.8, 0, 0.8]) {
      c.save();
      c.translate(x, y + 3);
      c.rotate(a);
      rect(c, col.body, -1, -8, 2, 8);
      rect(c, col.line, -1, -8, 2, 1);
      c.restore();
    }
  } else if (has('reflect')) {
    c.strokeStyle = col.line;
    c.lineWidth = 2;
    c.beginPath();
    c.arc(x, y, 4, 0, Math.PI * 2);
    c.stroke();
    disc(c, col.body, x, y, 2);
  } else if (has('slow')) {
    c.fillStyle = col.body;
    c.beginPath();
    c.ellipse(x, y, 5, 2.5, -0.6, 0, Math.PI * 2);
    c.fill();
    rect(c, col.line, x - 1, y, 2, 1);
  } else if (has('speed')) {
    tri(c, col.body, [x - 5, y + 2], [x + 4, y - 4], [x + 1, y + 4]);
    rect(c, col.line, x - 5, y + 2, 4, 1);
  } else if (has('defense')) {
    rect(c, col.line, x - 4, y - 4, 8, 8);
    rect(c, col.body, x - 3, y - 3, 6, 6);
    rect(c, col.shade, x - 3, y + 1, 6, 2);
  } else if (has('smash')) {
    for (let i = -1; i <= 1; i++)
      rect(c, i === 0 ? col.body : col.shade, x - 2 + i * 3, y - 3 + Math.abs(i), 3, 6);
  } else {
    disc(c, col.line, x, y, 4);
    disc(c, col.body, x, y, 3);
  }
}

export function drawPart(c: Ctx, tags: string[], el: Element, slot: number): void {
  const a = ANCHORS.parts[slot % ANCHORS.parts.length];
  if (a) drawPartAt(c, tags, el, a.x, a.y);
}

// ---------- hats ----------

function hatShape(c: Ctx, id: string, x: number, y: number): void {
  switch (id) {
    case 'ngob':
      tri(c, '#8a6a2c', [x - 13, y + 2], [x, y - 11], [x + 13, y + 2]);
      tri(c, '#d9b365', [x - 11, y + 1], [x, y - 9], [x + 11, y + 1]);
      rect(c, '#8a6a2c', x - 13, y + 1, 26, 2);
      break;
    case 'pakama_wrap':
      rect(c, '#c8553d', x - 10, y - 6, 20, 8);
      rect(c, '#f5e6c8', x - 10, y - 3, 20, 2);
      rect(c, '#8a2f1f', x + 8, y - 2, 5, 6);
      break;
    case 'win_helmet':
      disc(c, '#e04848', x, y - 1, 10);
      rect(c, '#e04848', x - 10, y - 1, 20, 4);
      rect(c, '#ffffff', x - 6, y - 8, 4, 2);
      rect(c, '#1c1c1c', x - 8, y + 3, 16, 2);
      break;
    case 'beanie':
      disc(c, '#5b9bd5', x, y - 1, 10);
      rect(c, '#3f72a8', x - 10, y + 1, 20, 3);
      disc(c, '#ffffff', x, y - 11, 3);
      break;
    case 'cat_headband':
      rect(c, '#ff8fb8', x - 11, y, 22, 3);
      tri(c, '#ff8fb8', [x - 10, y], [x - 8, y - 9], [x - 3, y]);
      tri(c, '#ff8fb8', [x + 10, y], [x + 8, y - 9], [x + 3, y]);
      break;
    case 'paper_boat_hat':
      tri(c, '#f4f1e6', [x - 12, y + 2], [x + 12, y + 2], [x, y - 10]);
      rect(c, '#c9c4b0', x - 12, y + 1, 24, 2);
      break;
    case 'chili_crown':
      for (let i = -2; i <= 2; i++)
        tri(
          c,
          i % 2 ? '#ff5a3c' : '#d92d20',
          [x + i * 5 - 3, y + 2],
          [x + i * 5, y - 9 + Math.abs(i)],
          [x + i * 5 + 3, y + 2],
        );
      rect(c, '#7a1c10', x - 12, y + 1, 24, 2);
      break;
    case 'coffee_cap':
      disc(c, '#7a4f2c', x, y - 1, 10);
      rect(c, '#7a4f2c', x - 10, y - 1, 20, 4);
      rect(c, '#4a2d18', x - 2, y + 2, 16, 3);
      break;
    case 'lantern_crown':
      rect(c, '#ffb24a', x - 6, y - 10, 12, 12);
      rect(c, '#ffe08a', x - 4, y - 8, 8, 8);
      rect(c, '#8a5a12', x - 7, y - 11, 14, 2);
      rect(c, '#8a5a12', x - 7, y + 1, 14, 2);
      break;
    case 'flower_wreath':
      for (let i = -2; i <= 2; i++) {
        disc(
          c,
          ['#ff7aa8', '#ffd15c', '#ffffff', '#ff7aa8', '#ffd15c'][i + 2] as string,
          x + i * 5,
          y - Math.abs(i) * 1.2,
          3,
        );
      }
      break;
    default:
      disc(c, '#8fa0b0', x, y - 1, 10);
      rect(c, '#8fa0b0', x - 10, y - 1, 20, 4);
  }
}

export function drawHat(c: Ctx, id: string): void {
  hatShape(c, id, ANCHORS.head.x, ANCHORS.head.y);
}

// ---------- weapons ----------

function weaponShape(c: Ctx, style: string, id: string, x: number, y: number): void {
  const tint: Record<string, string> = {
    paddle_sword: '#c79a5a',
    ladle_staff: '#9ad0e8',
    pot_lid_shield: '#9aa3ad',
    broom_thorn: '#d9a441',
  };
  const col = tint[id] ?? '#dfe7ee';
  switch (style) {
    case 'sword':
      rect(c, '#5a3a1a', x - 1, y + 2, 3, 7);
      rect(c, '#2b2b2b', x - 4, y + 1, 9, 2);
      rect(c, col, x - 2, y - 12, 5, 13);
      rect(c, 'rgba(255,255,255,0.6)', x - 1, y - 12, 1, 11);
      break;
    case 'staff':
      rect(c, '#6b4a2a', x, y - 10, 2, 20);
      disc(c, col, x + 1, y - 12, 4);
      disc(c, '#ffffff', x, y - 13, 1.5);
      break;
    case 'shield':
      disc(c, '#3b3f46', x, y, 8);
      disc(c, col, x, y, 6.5);
      disc(c, '#d9dde2', x, y, 2.5);
      break;
    case 'thorn':
      rect(c, '#6b4a2a', x, y - 8, 2, 18);
      for (const [dx, dy] of [
        [-3, -8],
        [3, -5],
        [-3, -2],
        [3, 1],
      ] as const)
        tri(c, col, [x + 1, y + dy], [x + 1 + dx, y + dy - 2], [x + 1 + dx * 0.3, y + dy + 2]);
      break;
    default:
      rect(c, '#6b4a2a', x, y - 6, 2, 12);
  }
}

export function drawWeapon(c: Ctx, style: string, id: string): void {
  weaponShape(c, style, id, ANCHORS.weapon.x, ANCHORS.weapon.y);
}

// ---------- monsters ----------

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function drawMonster(c: Ctx, id: string, el: Element): void {
  const p = ELEMENT_COLORS[el];
  disc(c, 'rgba(0,0,0,0.25)', 24, 42, 13);
  const eyes = (y = 25) => {
    rect(c, '#ffffff', 16, y, 6, 5);
    rect(c, '#ffffff', 27, y, 6, 5);
    rect(c, '#220', 19, y + 1, 3, 4);
    rect(c, '#220', 27, y + 1, 3, 4);
    rect(c, '#220', 15, y - 2, 8, 1);
    rect(c, '#220', 26, y - 2, 8, 1);
  };
  switch (id) {
    case 'brick_imp':
      rect(c, p.line, 11, 18, 26, 24);
      rect(c, p.body, 12, 19, 24, 22);
      rect(c, p.shade, 12, 28, 24, 1);
      rect(c, p.shade, 24, 19, 1, 9);
      tri(c, p.line, [12, 19], [14, 11], [18, 19]);
      tri(c, p.line, [30, 19], [34, 11], [36, 19]);
      eyes(23);
      break;
    case 'clay_pot':
      rect(c, p.line, 13, 16, 22, 4);
      disc(c, p.line, 24, 31, 14);
      disc(c, p.body, 24, 31, 12.5);
      rect(c, p.shade, 14, 36, 20, 3);
      eyes(26);
      break;
    case 'wall_rat':
      disc(c, p.line, 24, 33, 13);
      disc(c, p.body, 24, 33, 11.5);
      disc(c, p.line, 14, 21, 5);
      disc(c, p.line, 34, 21, 5);
      disc(c, '#ffb3b3', 14, 21, 3);
      disc(c, '#ffb3b3', 34, 21, 3);
      eyes(28);
      rect(c, '#ffb3b3', 22, 36, 4, 2);
      break;
    case 'hyacinth_walker':
      disc(c, p.line, 24, 33, 13);
      disc(c, '#6fcf7f', 24, 33, 11.5);
      for (const a of [-0.9, 0, 0.9]) {
        c.save();
        c.translate(24, 22);
        c.rotate(a);
        c.fillStyle = '#3f9b52';
        c.beginPath();
        c.ellipse(0, -6, 3, 7, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      eyes(29);
      break;
    case 'wicker_fish':
      c.fillStyle = p.line;
      c.beginPath();
      c.ellipse(22, 32, 15, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#e0c27a';
      c.beginPath();
      c.ellipse(22, 32, 13.5, 8.5, 0, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i < 4; i++) rect(c, '#b8973f', 12 + i * 5, 26, 1, 12);
      tri(c, '#e0c27a', [34, 32], [44, 24], [44, 40]);
      rect(c, '#220', 13, 29, 3, 3);
      break;
    case 'pier_frog':
      disc(c, p.line, 24, 34, 13);
      disc(c, '#7ccf5a', 24, 34, 11.5);
      disc(c, '#7ccf5a', 15, 22, 5);
      disc(c, '#7ccf5a', 33, 22, 5);
      disc(c, '#ffffff', 15, 22, 3.5);
      disc(c, '#ffffff', 33, 22, 3.5);
      disc(c, '#220', 15, 22, 1.6);
      disc(c, '#220', 33, 22, 1.6);
      rect(c, '#2e6a1c', 17, 38, 14, 1);
      break;
    case 'meatball_flame':
      disc(c, p.line, 24, 34, 12);
      disc(c, '#8a4a2a', 24, 34, 10.5);
      tri(c, '#ffd15c', [16, 24], [24, 8], [32, 24]);
      tri(c, '#ff7a2c', [19, 24], [24, 14], [29, 24]);
      eyes(30);
      break;
    case 'tuktuk_mini':
      rect(c, p.line, 9, 22, 30, 16);
      rect(c, '#ffd14a', 10, 23, 28, 14);
      rect(c, '#2a2a2a', 12, 17, 24, 6);
      rect(c, '#bfe8ff', 14, 26, 8, 6);
      disc(c, '#222', 15, 40, 4);
      disc(c, '#222', 34, 40, 4);
      rect(c, '#fff7c2', 36, 28, 4, 4);
      break;
    case 'fire_moth':
      tri(c, '#ffb070', [24, 32], [4, 16], [10, 40]);
      tri(c, '#ffb070', [24, 32], [44, 16], [38, 40]);
      tri(c, '#ff7a2c', [24, 32], [10, 22], [14, 38]);
      tri(c, '#ff7a2c', [24, 32], [38, 22], [34, 38]);
      disc(c, p.line, 24, 32, 6);
      rect(c, '#ffe08a', 21, 29, 2, 2);
      rect(c, '#ffe08a', 25, 29, 2, 2);
      break;
    case 'coffee_cup':
      rect(c, p.line, 12, 18, 24, 22);
      rect(c, '#f4f1e6', 13, 19, 22, 20);
      rect(c, '#6b4a2a', 13, 19, 22, 4);
      c.strokeStyle = p.line;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(38, 28, 5, -1.2, 1.2);
      c.stroke();
      eyes(26);
      break;
    case 'fan_goof':
      disc(c, p.line, 24, 26, 13);
      for (let i = 0; i < 3; i++) {
        c.save();
        c.translate(24, 26);
        c.rotate((i * Math.PI * 2) / 3 + 0.4);
        c.fillStyle = p.body;
        c.beginPath();
        c.ellipse(0, -7, 4, 8, 0, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      disc(c, p.line, 24, 26, 3);
      rect(c, p.line, 22, 28, 4, 14);
      rect(c, p.line, 16, 40, 16, 3);
      break;
    case 'sparrow_spin':
      disc(c, p.line, 24, 30, 13);
      disc(c, '#c79a6a', 24, 30, 11.5);
      tri(c, '#c79a6a', [20, 18], [24, 8], [28, 18]);
      tri(c, '#ffb030', [33, 28], [42, 31], [33, 34]);
      rect(c, '#220', 20, 26, 3, 4);
      rect(c, '#e8d2b0', 16, 33, 16, 5);
      break;
    default: {
      const h = hash(id);
      disc(c, p.line, 24, 33, 13);
      disc(c, p.body, 24, 33, 11.5);
      eyes(28 + (h % 2));
    }
  }
}

export function drawBoss(c: Ctx, el: Element): void {
  const p = ELEMENT_COLORS[el];
  disc(c, 'rgba(0,0,0,0.3)', 24, 43, 20);
  disc(c, p.line, 24, 28, 20);
  disc(c, p.body, 24, 28, 18);
  tri(c, p.line, [8, 14], [12, 2], [18, 12]);
  tri(c, p.line, [40, 14], [36, 2], [30, 12]);
  rect(c, '#ffffff', 14, 24, 8, 7);
  rect(c, '#ffffff', 26, 24, 8, 7);
  rect(c, '#c00', 18, 25, 4, 6);
  rect(c, '#c00', 28, 25, 4, 6);
  rect(c, p.line, 18, 38, 12, 2);
}

// ---------- icons ----------

export function drawIconFrame(c: Ctx, color: string): void {
  rect(c, '#0b1618', 0, 0, 32, 32);
  rect(c, color, 0, 0, 32, 2);
  rect(c, color, 0, 30, 32, 2);
  rect(c, color, 0, 0, 2, 32);
  rect(c, color, 30, 0, 2, 32);
}

export function drawMaterial(c: Ctx, id: string): void {
  const colors: Record<string, string> = {
    jelly: '#7ee0b0',
    old_brick: '#c9825a',
    water_scale: '#5aa9e6',
    spark: '#ff9440',
    wind_feather: '#cdeaf5',
  };
  const col = colors[id] ?? '#aaa';
  disc(c, '#0b1618', 16, 17, 10);
  disc(c, col, 16, 16, 8);
  disc(c, 'rgba(255,255,255,0.6)', 13, 12, 2.5);
}
