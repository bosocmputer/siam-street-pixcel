// Turning a rendered picture into pixel art: shrink it to the pixel grid with hard edges, keep
// to a small palette shared by the whole sheet, and draw a dark 1-pixel edge round the shape.

/** An RGBA picture. */
export interface Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export const newImg = (w: number, h: number): Img => ({
  w,
  h,
  data: new Uint8ClampedArray(w * h * 4),
});

/**
 * Shrink by `k`: a pixel is solid when at least `cover` of its k×k block is solid, and takes the
 * average colour of the solid part (no half-see-through edges, as pixel art has none).
 */
export function shrink(src: Img, k: number, cover = 0.45): Img {
  const w = Math.floor(src.w / k),
    h = Math.floor(src.h / k);
  const out = newImg(w, h);
  const need = Math.max(1, Math.round(k * k * cover));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let n = 0,
        r = 0,
        g = 0,
        b = 0;
      for (let dy = 0; dy < k; dy++)
        for (let dx = 0; dx < k; dx++) {
          const i = ((y * k + dy) * src.w + (x * k + dx)) * 4;
          if (src.data[i + 3]! < 128) continue;
          n++;
          r += src.data[i]!;
          g += src.data[i + 1]!;
          b += src.data[i + 2]!;
        }
      if (n < need) continue;
      const o = (y * w + x) * 4;
      out.data[o] = r / n;
      out.data[o + 1] = g / n;
      out.data[o + 2] = b / n;
      out.data[o + 3] = 255;
    }
  return out;
}

type RGB = [number, number, number];
const dist2 = (a: RGB, r: number, g: number, b: number) =>
  (a[0] - r) ** 2 + (a[1] - g) ** 2 + (a[2] - b) ** 2;

/**
 * A palette of at most `n` colours for all of `imgs` (k-means on the solid pixels). `rng` gives
 * numbers in [0, 1) so the same pictures always give the same palette.
 */
export function fitPalette(imgs: Img[], n: number, rng: () => number, rounds = 8): RGB[] {
  const all: RGB[] = [];
  for (const im of imgs)
    for (let i = 0; i < im.data.length; i += 4)
      if (im.data[i + 3]! > 0) all.push([im.data[i]!, im.data[i + 1]!, im.data[i + 2]!]);
  if (all.length === 0) return [];
  // a sample keeps this quick on big sheets
  const step = Math.max(1, Math.floor(all.length / 30000));
  const pts = all.filter((_, i) => i % step === 0);
  // k-means++ start: spread the first centres out
  const centres: RGB[] = [[...pts[Math.floor(rng() * pts.length)]!]];
  const near = new Float64Array(pts.length).fill(Infinity);
  while (centres.length < Math.min(n, pts.length)) {
    const c = centres[centres.length - 1]!;
    let sum = 0;
    pts.forEach((p, i) => {
      near[i] = Math.min(near[i]!, dist2(c, p[0], p[1], p[2]));
      sum += near[i]!;
    });
    if (sum === 0) break;
    let pick = rng() * sum,
      j = 0;
    while (j < pts.length - 1 && (pick -= near[j]!) > 0) j++;
    centres.push([...pts[j]!]);
  }
  for (let r = 0; r < rounds; r++) {
    const acc = new Float64Array(centres.length * 4);
    for (const p of pts) {
      const k = nearest(centres, p[0], p[1], p[2]) * 4;
      acc[k]! += p[0];
      acc[k + 1]! += p[1];
      acc[k + 2]! += p[2];
      acc[k + 3]! += 1;
    }
    centres.forEach((_, k) => {
      const n = acc[k * 4 + 3]!;
      if (n) centres[k] = [acc[k * 4]! / n, acc[k * 4 + 1]! / n, acc[k * 4 + 2]! / n];
    });
  }
  return centres.map((c) => c.map(Math.round) as RGB);
}

function nearest(pal: RGB[], r: number, g: number, b: number): number {
  let best = 0,
    bd = Infinity;
  for (let k = 0; k < pal.length; k++) {
    const d = dist2(pal[k]!, r, g, b);
    if (d < bd) [bd, best] = [d, k];
  }
  return best;
}

/** Snap every solid pixel to the nearest palette colour. */
export function toPalette(img: Img, pal: RGB[]): void {
  if (!pal.length) return;
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    const c = pal[nearest(pal, d[i]!, d[i + 1]!, d[i + 2]!)]!;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  }
}

/**
 * Draw a 1-pixel edge round the shape: each empty pixel next to a solid one (left, right, above,
 * below) takes the darkest neighbouring colour times `dark`.
 */
export function outline(img: Img, dark: number): void {
  const { w, h, data } = img;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[(y * w + x) * 4 + 3]! === 255;
  const edge: [number, number, number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      let best = -1,
        lum = Infinity;
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ] as const) {
        if (!solid(nx, ny)) continue;
        const j = (ny * w + nx) * 4;
        const l = data[j]! * 0.3 + data[j + 1]! * 0.59 + data[j + 2]! * 0.11;
        if (l < lum) [lum, best] = [l, j];
      }
      if (best >= 0) edge.push([(y * w + x) * 4, data[best]!, data[best + 1]!, data[best + 2]!]);
    }
  for (const [i, r, g, b] of edge) {
    // a dark edge leaning cool, like hand-drawn outlines
    data[i] = r * dark * 0.9;
    data[i + 1] = g * dark * 0.9;
    data[i + 2] = Math.min(255, b * dark + 14);
    data[i + 3] = 255;
  }
}
