// Small pixel icons for the interface (tab bar, currency, stats). Drawn with code as stand-ins until the
// PixelLab UI set exists. All 16x16 or 24x24; show them with `image-rendering: pixelated`.
import { ctxOf, makeCanvas } from './draw';

const cache = new Map<string, HTMLCanvasElement>();
const LINE = '#0b0a1c';

function build(key: string, size: number, draw: (g: CanvasRenderingContext2D) => void) {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = makeCanvas(size);
  draw(ctxOf(c));
  cache.set(key, c);
  return c;
}

const px = (g: CanvasRenderingContext2D, col: string, x: number, y: number, w = 1, h = 1) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

function disc(
  g: CanvasRenderingContext2D,
  col: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
) {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) px(g, col, x, y);
}

export type TabName = 'farm' | 'slime' | 'skills' | 'bag' | 'map';

export function tabIcon(name: TabName, on: boolean): HTMLCanvasElement {
  const col = on ? '#ffb84d' : '#8c86b3';
  const dk = on ? '#5a3000' : '#0d0b22';
  return build(`tab:${name}:${on}`, 16, (g) => {
    if (name === 'farm') {
      // two crossed swords
      for (let i = 0; i < 11; i++) {
        px(g, col, 2 + i, 12 - i, 2, 2);
        px(g, col, 12 - i, 12 - i, 2, 2);
      }
      px(g, col, 1, 11, 5, 2);
      px(g, col, 10, 11, 5, 2);
      px(g, dk, 7, 7, 2, 2);
    } else if (name === 'slime') {
      disc(g, col, 8, 9, 6.5, 6);
      px(g, dk, 5, 8, 2, 3);
      px(g, dk, 9, 8, 2, 3);
      px(g, 'rgba(255,255,255,.5)', 4, 5, 2, 1);
    } else if (name === 'skills') {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const dx = Math.abs(x - 7.5),
            dy = Math.abs(y - 7.5);
          if (dx ** (2 / 3) + dy ** (2 / 3) <= 7.6 ** (2 / 3) * 0.95) px(g, col, x, y);
        }
      px(g, dk, 7, 7, 2, 2);
    } else if (name === 'bag') {
      px(g, col, 6, 1, 4, 2);
      px(g, col, 4, 3, 8, 2);
      disc(g, col, 8, 10, 6, 5);
      px(g, dk, 4, 5, 8, 1);
      px(g, dk, 7, 5, 2, 4);
    } else {
      disc(g, col, 8, 6, 5, 5);
      px(g, col, 5, 9, 6, 2);
      px(g, col, 6, 11, 4, 2);
      px(g, col, 7, 13, 2, 2);
      disc(g, dk, 8, 6, 2, 2);
    }
  });
}

export function coinIcon(): HTMLCanvasElement {
  return build('coin', 24, (g) => {
    px(g, '#5a3000', 6, 4, 12, 16);
    px(g, '#5a3000', 4, 6, 16, 12);
    px(g, '#ffb84d', 6, 6, 12, 12);
    px(g, '#ffd98a', 6, 6, 12, 3);
    px(g, '#b86f10', 10, 8, 4, 8);
  });
}

export function heartIcon(): HTMLCanvasElement {
  return build('heart', 24, (g) => {
    const H = ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...'];
    const dots: [number, number][] = [];
    H.forEach((row, y) => [...row].forEach((ch, x) => ch === 'X' && dots.push([x, y])));
    for (const [x, y] of dots)
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        px(g, LINE, 3 + (x + dx) * 2, 6 + (y + dy) * 2, 2, 2);
    for (const [x, y] of dots) px(g, '#ff6f8f', 3 + x * 2, 6 + y * 2, 2, 2);
    px(g, '#ffc2d0', 5, 8, 2, 2);
  });
}

export function statIcon(key: 'str' | 'agi' | 'vit' | 'int'): HTMLCanvasElement {
  return build(`stat:${key}`, 24, (g) => {
    const col = { str: '#ef5a50', agi: '#cdeaf5', vit: '#5fe0b0', int: '#c4a6f0' }[key];
    px(g, LINE, 2, 2, 20, 20);
    px(g, col, 3, 3, 18, 18);
    px(g, 'rgba(255,255,255,.35)', 3, 3, 18, 2);
    if (key === 'str') px(g, '#fff', 9, 8, 6, 8);
    if (key === 'agi') {
      px(g, '#12101f', 6, 9, 12, 2);
      px(g, '#12101f', 9, 13, 9, 2);
    }
    if (key === 'vit') {
      px(g, '#12101f', 10, 6, 4, 12);
      px(g, '#12101f', 6, 10, 12, 4);
    }
    if (key === 'int') {
      px(g, '#12101f', 11, 5, 2, 14);
      px(g, '#12101f', 5, 11, 14, 2);
    }
  });
}

/** Sticky-rice basket (kratip) used as the "auto loot" bag. `fill` 0-3 shows how full it is. */
export function basketFallback(fill: number): HTMLCanvasElement {
  return build(`basket:${fill}`, 32, (g) => {
    px(g, 'rgba(0,0,0,0.3)', 5, 29, 22, 3);
    px(g, LINE, 6, 14, 20, 15);
    for (let y = 15; y < 28; y++)
      for (let x = 7; x < 25; x++)
        px(g, (x + (y >> 1)) % 3 === 0 ? '#a8702f' : y % 2 ? '#d6a05a' : '#c98f4a', x, y);
    px(g, '#8a5a2a', 7, 26, 18, 2);
    px(g, LINE, 5, 12, 22, 3);
    px(g, '#8a5a2a', 6, 13, 20, 1);
    px(g, '#e0463a', 6, 17, 20, 1);
    for (let r = 0; r < 7; r++) {
      const half = 4 + r * 1.6;
      px(g, LINE, 16 - Math.round(half) - 1, 5 + r, Math.round(half) * 2 + 2, 1);
      px(g, r % 2 ? '#d9a55e' : '#e6b672', 16 - Math.round(half), 5 + r, Math.round(half) * 2, 1);
    }
    px(g, LINE, 14, 3, 4, 3);
    px(g, '#8a5a2a', 15, 4, 2, 1);
    void fill;
  });
}
