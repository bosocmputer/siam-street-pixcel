// The approved PixelLab slime ("B", 20x18 px body on a 48x48 canvas) recoloured at run time so the
// player's colour choice, element forms and skins all work with one piece of art, and the creator's
// eye styles are drawn over a copy of the sprite whose original face was painted out.
import type { Element } from '@slimehood/game-core';

export interface BodyOpts {
  /** colour id picked in the creator (looks.json) */
  color: string;
  eyes: number;
  /** element of the form, null for the plain slime */
  element: Element | null;
  /** 0 plain, 1 first evolution, 2 second evolution */
  tier: number;
  /** body colour of a worn skin item, overrides everything else */
  skin?: string | null;
}

interface Target {
  h: number; // hue in degrees
  s: number; // saturation multiplier
  l: number; // lightness delta
}

// mint (the art as generated) has hue ~120, so it is left alone
const LOOK: Record<string, Target | null> = {
  mint: null,
  sky: { h: 205, s: 0.95, l: 0 },
  peach: { h: 24, s: 1.1, l: 0.04 },
  rose: { h: 338, s: 1.2, l: 0.02 },
  lilac: { h: 268, s: 0.85, l: 0.02 },
  lemon: { h: 52, s: 1.3, l: 0.02 },
  coral: { h: 4, s: 1.4, l: -0.02 },
  cloud: { h: 210, s: 0.05, l: 0.1 },
};

const ELEMENT: Record<Element, Target> = {
  earth: { h: 24, s: 0.9, l: -0.06 },
  water: { h: 205, s: 1, l: -0.02 },
  fire: { h: 16, s: 1.5, l: -0.03 },
  wind: { h: 190, s: 0.35, l: 0.1 },
};

const MINT_HUE = 118;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rr = r / 255,
    gg = g / 255,
    bb = b / 255;
  const max = Math.max(rr, gg, bb),
    min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  const hh = h / 360;
  return [
    Math.round(f(hh + 1 / 3) * 255),
    Math.round(f(hh) * 255),
    Math.round(f(hh - 1 / 3) * 255),
  ];
}

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Mix two hues along the short way round the colour wheel. */
function mixHue(a: number, b: number, t: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

/** The recolouring to apply, or null when the art should stay as generated. */
export function targetFor(o: BodyOpts): Target | null {
  if (o.skin) {
    const [h, s, l] = rgbToHsl(...hexToRgb(o.skin));
    return { h, s: Math.min(1.6, s / 0.55), l: (l - 0.7) * 0.5 };
  }
  const mine = LOOK[o.color] ?? null;
  if (!o.element) return mine;
  const el = ELEMENT[o.element];
  if (!mine) return el;
  return { h: mixHue(el.h, mine.h, 0.4), s: el.s, l: el.l };
}

export function recolour(src: ImageData, target: Target | null): ImageData {
  if (!target) return src;
  const out = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const [h, s, l] = rgbToHsl(d[i]!, d[i + 1]!, d[i + 2]!);
    // only the green body: outline, highlights, blush and the grey face stay as they are
    if (h < 70 || h > 175 || s < 0.12 || l < 0.2 || l > 0.93) continue;
    const shift = h - MINT_HUE; // keeps the little hue variation inside the body shading
    const [r, g, b] = hslToRgb(
      (target.h + shift * 0.4 + 360) % 360,
      Math.min(1, s * target.s),
      Math.min(0.97, Math.max(0.05, l + target.l)),
    );
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
  return out;
}

const DARK = '#12201b';
const WHITE = '#ffffff';
// body origin inside the 48x48 canvas; the two eyes start 5 and 13 px into the body
const BODY_X = 14;
const BODY_Y = 15;
const EYE_X = [BODY_X + 5, BODY_X + 13];
const EYE_Y = BODY_Y + 7;

/** Draw the eyes for styles 1-3 (style 0 is the face that came with the art). */
export function drawEyes(g: CanvasRenderingContext2D, style: number): void {
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  for (const ex of EYE_X) {
    if (style === 1) {
      // wide and sparkly
      px(DARK, ex, EYE_Y, 3, 4);
      px(WHITE, ex, EYE_Y, 1, 1);
      px(WHITE, ex + 1, EYE_Y, 1, 1);
      px(WHITE, ex + 2, EYE_Y + 3, 1, 1);
    } else if (style === 2) {
      // happy arcs
      px(DARK, ex + 1, EYE_Y + 1, 1, 1);
      px(DARK, ex, EYE_Y + 2, 1, 1);
      px(DARK, ex + 2, EYE_Y + 2, 1, 1);
    } else if (style === 3) {
      // sleepy
      px(DARK, ex, EYE_Y + 2, 3, 1);
      px(DARK, ex, EYE_Y + 3, 1, 1);
    }
  }
}

/** Little crest/horns so evolved forms read differently at a glance. */
export function drawCrest(
  g: CanvasRenderingContext2D,
  tier: number,
  body: string,
  line: string,
): void {
  const px = (c: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  };
  if (tier >= 1) {
    px(line, 24, 11, 1, 1);
    px(line, 23, 12, 3, 1);
    px(line, 22, 13, 5, 2);
    px(body, 24, 12, 1, 1);
    px(body, 23, 13, 3, 1);
  }
  if (tier >= 2) {
    px(line, 15, 17, 2, 2);
    px(line, 31, 17, 2, 2);
    px(body, 15, 18, 1, 1);
    px(body, 32, 18, 1, 1);
  }
}
