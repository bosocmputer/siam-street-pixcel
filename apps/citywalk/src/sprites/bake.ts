// Draw a 3D subject as a pixel sprite sheet: each animation frame from each direction is rendered
// with flat cartoon light, shrunk onto the pixel grid, kept to one palette for the whole sheet,
// outlined, and cropped to what is drawn. The result has the same layout as a sheet made
// elsewhere (see sheet.ts): one picture per animation, a row per direction, a column per frame.

import * as THREE from 'three';
import { SPRITES, seeded, sheetLayout, type AnimSpec, type SheetMeta } from '@newgame/rpg-core';
import { fitPalette, outline, shrink, toPalette, type Img } from './pixelize';

/** Something to draw: posed frame by frame, turned to face each direction. */
export interface Bakeable {
  /** what is drawn; it stands on the ground at the origin */
  root: THREE.Object3D;
  /** turn so the subject faces this way on the ground (atan2(x, z); 0 = towards the viewer) */
  face(angle: number): void;
  /** pose frame i of n of an animation; frames are asked for in order, starting at 0 */
  pose(anim: string, i: number, n: number): void;
  /** small features too fine to survive shrinking (eyes), painted on as pixels afterwards */
  marks?(): Mark[];
}

/** A feature painted on after shrinking: where it is and which way it faces (world space). */
export interface Mark {
  at: THREE.Vector3;
  normal: THREE.Vector3;
  /** colours [outline, iris, shine] of an eye */
  eye: [string, string, string];
  /** a small eye is 2×2 pixels, a normal one 2×3 */
  small?: boolean;
  /** shut: a short dark line */
  shut?: boolean;
}

export interface BakeOptions {
  /** the frame drawn in; the sheet keeps only the part anything is drawn in */
  frame: [number, number];
  anchor: [number, number];
  anims: [string, AnimSpec][];
}

export interface Baked {
  /** one picture per animation, in the order of `meta.anims` pages */
  pages: HTMLCanvasElement[];
  meta: SheetMeta;
}

// four bands of light: deep shade, shade, lit, and a bright top that reads as a highlight
const TONES = new THREE.DataTexture(new Uint8Array([120, 185, 235, 255]), 4, 1, THREE.RedFormat);
TONES.needsUpdate = true;

/** Swap every material for a cartoon one with bands of light, keeping colours and maps. */
export function cartoon(root: THREE.Object3D): void {
  const made = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const swap = (m: THREE.Material) => {
      let t = made.get(m);
      if (!t) {
        const s = m as THREE.MeshStandardMaterial;
        t = new THREE.MeshToonMaterial({
          color: s.color ?? 0xffffff,
          map: s.map ?? null,
          vertexColors: s.vertexColors,
          gradientMap: TONES,
          side: s.side,
          // a see-through slime is drawn solid: pixel art has no half-see-through
          transparent: false,
          alphaTest: s.map ? 0.5 : 0,
        });
        made.set(m, t);
      }
      return t;
    };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
}

/**
 * An anime eye centred on (x, y): a dark lid line, the pupil with a shine, the iris colour below
 * (2×3 pixels; a small one 2×2). Only on pixels the body already covers.
 */
function paintEye(img: Img, x: number, y: number, m: Mark): void {
  const [ink, iris, shine] = m.eye.map((h) => new THREE.Color(h));
  const pattern = m.shut
    ? [[ink!, ink!]]
    : m.small
      ? [
          [ink!, shine!],
          [ink!, ink!],
        ]
      : [
          [ink!, ink!],
          [ink!, shine!],
          [iris!, iris!],
        ];
  const x0 = Math.round(x - 1),
    y0 = Math.round(y - pattern.length / 2);
  pattern.forEach((row, dy) =>
    row.forEach((col, dx) => {
      const px = x0 + dx,
        py = y0 + dy;
      if (px < 0 || py < 0 || px >= img.w || py >= img.h) return;
      const i = (py * img.w + px) * 4;
      if (img.data[i + 3]! !== 255) return;
      img.data[i] = col.r * 255;
      img.data[i + 1] = col.g * 255;
      img.data[i + 2] = col.b * 255;
    }),
  );
}

// one drawing surface for every sheet (a page may only have a few at a time)
let shared: THREE.WebGLRenderer | null = null;
function drawer(): THREE.WebGLRenderer {
  if (!shared) {
    shared = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    shared.setPixelRatio(1);
  }
  return shared;
}

export function bake(subject: Bakeable, o: BakeOptions, spec = SPRITES): Baked {
  const [fw, fh] = o.frame;
  // a big frame is drawn less oversized, to keep the drawing within what a phone handles
  const ss = Math.max(1, Math.min(spec.supersample, Math.floor(spec.maxRender / Math.max(fw, fh))));
  const dirs = spec.dirs;
  const layout = sheetLayout(o.anims);

  const renderer = drawer();
  renderer.setSize(fw * ss, fh * ss, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf0f3ff, 0x6a5a54, 1.7));
  const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
  key.position.set(-2, 4, 3.5); // from the front, up and to the viewer's left
  scene.add(key, subject.root);
  // a flat (orthographic) view from the front and above; the feet land on the anchor pixel
  const ppm = spec.ppm;
  const cam = new THREE.OrthographicCamera(
    -o.anchor[0] / ppm,
    (fw - o.anchor[0]) / ppm,
    o.anchor[1] / ppm,
    -(fh - o.anchor[1]) / ppm,
    -50,
    50,
  );
  const e = spec.elevation;
  cam.position.set(0, Math.sin(e) * 10, Math.cos(e) * 10);
  cam.lookAt(0, 0, 0);
  const toCam = new THREE.Vector3();
  cam.getWorldDirection(toCam).negate();

  const grab = document.createElement('canvas');
  grab.width = fw * ss;
  grab.height = fh * ss;
  const g = grab.getContext('2d', { willReadFrequently: true })!;
  const frames: {
    img: Img;
    anim: string;
    col: number;
    row: number;
    eyes: [number, number, Mark][];
  }[] = [];
  for (const [name, a] of o.anims) {
    for (let i = 0; i < a.frames; i++) {
      subject.pose(name, i, a.frames);
      for (let d = 0; d < dirs; d++) {
        subject.face((d * Math.PI) / 4);
        subject.root.updateMatrixWorld(true);
        renderer.render(scene, cam);
        g.clearRect(0, 0, grab.width, grab.height);
        g.drawImage(renderer.domElement, 0, 0);
        const big = g.getImageData(0, 0, grab.width, grab.height);
        const img = shrink({ w: big.width, h: big.height, data: big.data }, ss);
        // eyes that face the viewer, at their pixel on the shrunk frame
        const eyes: [number, number, Mark][] = [];
        for (const m of subject.marks?.() ?? []) {
          if (m.normal.dot(toCam) < 0.15) continue;
          const p = m.at.clone().project(cam);
          eyes.push([((p.x + 1) / 2) * fw, ((1 - p.y) / 2) * fh, m]);
        }
        frames.push({ img, anim: name, col: i, row: d, eyes });
      }
    }
  }
  scene.remove(subject.root);

  // one palette for the whole sheet, then the eyes and the edges
  const pal = fitPalette(
    frames.map((f) => f.img),
    spec.colors,
    seeded(7),
  );
  let x0 = fw,
    y0 = fh,
    x1 = 0,
    y1 = 0;
  for (const f of frames) {
    toPalette(f.img, pal);
    for (const [x, y, m] of f.eyes) paintEye(f.img, x, y, m);
    outline(f.img, spec.outline);
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++)
        if (f.img.data[(y * fw + x) * 4 + 3]) {
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
  }
  // keep only the part anything is drawn in, the same for every frame and still centred on the
  // feet, with the width a multiple of two
  const half = Math.max(o.anchor[0] - x0, x1 + 1 - o.anchor[0]);
  const cx0 = Math.max(0, o.anchor[0] - half),
    cw = Math.min(fw, 2 * half),
    cy0 = Math.max(0, y0 - 1),
    ch = Math.min(fh, y1 + 2) - cy0;
  const pages = o.anims.map(([, a]) => {
    const c = document.createElement('canvas');
    c.width = a.frames * cw;
    c.height = dirs * ch;
    return c;
  });
  for (const f of frames) {
    const id = new ImageData(new Uint8ClampedArray(f.img.data), f.img.w, f.img.h);
    pages[layout[f.anim]!.page]!.getContext('2d')!.putImageData(
      id,
      f.col * cw - cx0,
      f.row * ch - cy0,
      cx0,
      cy0,
      cw,
      ch,
    );
  }
  return {
    pages,
    meta: {
      frame: [cw, ch],
      anchor: [o.anchor[0] - cx0, o.anchor[1] - cy0],
      ppm,
      dirs,
      anims: layout,
    },
  };
}
