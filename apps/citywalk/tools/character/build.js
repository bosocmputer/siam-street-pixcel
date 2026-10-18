// Builds a character to the game's rig (packages/rpg-core/config/rig.json) entirely from code:
// rounded tubes for the body, a face painted on a canvas, and hair made of tapered locks. The result
// is a three.js group with the rig's joints (empty nodes, no rotation) and one rigid mesh per body
// part, ready for GLTFExporter. Runs in a browser page (see make.mjs), because the face is drawn
// on a canvas.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const rgb = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

/**
 * A closed tube through `sections`. Each section is a rounded rectangle (superellipse) centred on
 * `c`, spanning `u` one way and `v` the other (both half-extents, at right angles). The tube's
 * direction should run along v × u so its faces point outwards. `color(p)` colours each vertex.
 */
function tube(sections, n, color) {
  const pos = [];
  const col = [];
  const idx = [];
  const add = (p) => {
    pos.push(p.x, p.y, p.z);
    col.push(...color(p));
    return pos.length / 3 - 1;
  };
  for (const s of sections) {
    const e = 2 / (s.p ?? 2.2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const cu = Math.sign(ca) * Math.abs(ca) ** e;
      const sv = Math.sign(sa) * Math.abs(sa) ** e;
      const p = s.c.clone().addScaledVector(s.u, cu).addScaledVector(s.v, sv);
      // a forward bulge on the +v side (a chest, a calf)
      if (s.bulge && sv > 0) p.addScaledVector(s.v.clone().normalize(), s.bulge * sv * sv);
      add(p);
    }
  }
  for (let k = 0; k < sections.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = k * n + i,
        b = k * n + j,
        c = (k + 1) * n + i,
        d = (k + 1) * n + j;
      idx.push(a, c, b, b, c, d);
    }
  // close both ends
  const first = sections[0],
    last = sections[sections.length - 1];
  const bottom = add(first.c);
  const top = add(last.c);
  const lastRing = (sections.length - 1) * n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    idx.push(bottom, i, j);
    idx.push(top, lastRing + j, lastRing + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Sections for an upright tube: at height y, width w across (x) and depth d front to back (z). */
const upright = (y, w, d, o = {}) => ({
  c: v3(o.x ?? 0, y, o.z ?? 0),
  u: v3(w / 2, 0, 0),
  v: v3(0, 0, d / 2),
  p: o.p,
  bulge: o.bulge,
});

/** Read a profile of [y, w, d, z, bulge] rows at height y (straight lines between rows). */
function profileAt(rows, y) {
  if (y <= rows[0][0]) return rows[0];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1];
    if (y <= b[0]) {
      const t = (y - a[0]) / (b[0] - a[0]);
      return a.map((x, k) => lerp(x ?? 0, b[k] ?? 0, t));
    }
  }
  return rows[rows.length - 1];
}

/** An upright tube following a profile between y0 and y1, `steps` rings, rounded off at both ends. */
function profileTube(rows, y0, y1, steps, n, color, o = {}) {
  const secs = [];
  for (let i = 0; i <= steps; i++) {
    const y = lerp(y0, y1, i / steps);
    const [, w, d, z, bulge] = profileAt(rows, y);
    // round the ends a little so the joins between parts look soft
    const end = Math.min(i, steps - i) === 0 ? (o.endScale ?? 0.82) : 1;
    secs.push(
      upright(y, w * end, d * end, { z: z ?? 0, p: o.p ?? 2.3, bulge: bulge ?? 0, x: o.x }),
    );
  }
  return tube(secs, n, color);
}

/** Ring positions along a limb, closer together near the ends so they can be rounded off. */
const LIMB_T = [0, 0.05, 0.14, 0.3, 0.5, 0.7, 0.86, 0.95, 1];

/**
 * A tapered limb from a to b, radius ra at a and rb at b, with rounded ends (like a capsule), a
 * little flattened front to back when depth < 1.
 */
function limb(a, b, ra, rb, n, color, o = {}) {
  const round = o.round ?? 0.16;
  const ts = o.steps ? Array.from({ length: o.steps + 1 }, (_, i) => i / o.steps) : LIMB_T;
  const secs = ts.map((t) => {
    const d = Math.min(t, 1 - t) / round;
    const k = d >= 1 ? 1 : Math.max(0.2, Math.sqrt(1 - (1 - d) ** 2));
    const r = lerp(ra, rb, t) * k * (o.swell ? 1 + o.swell * Math.sin(t * Math.PI) : 1);
    return {
      c: a.clone().lerp(b, t),
      u: v3(r, 0, 0),
      v: v3(0, 0, r * (o.depth ?? 1)),
      p: o.p ?? 2,
    };
  });
  // the tube must run upwards (v × u = +y) for its faces to point outwards
  if (a.y > b.y) secs.reverse();
  return tube(secs, n, color);
}

/** A tapered lock of hair from root through ctrl to tip, flat side facing away from `centre`. */
function lock(root, ctrl, tip, width, thick, centre, color, n = 5, steps = 5) {
  const curve = new THREE.QuadraticBezierCurve3(root, ctrl, tip);
  const secs = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = curve.getPoint(t);
    const T = curve.getTangent(t).normalize();
    const R = c.clone().sub(centre).normalize();
    let u = new THREE.Vector3().crossVectors(T, R);
    if (u.lengthSq() < 1e-6) u = v3(1, 0, 0);
    u.normalize();
    const v = new THREE.Vector3().crossVectors(u, T).normalize();
    const taper = Math.pow(1 - t, 0.85) * (t < 0.15 ? 0.8 + t * 1.3 : 1);
    const w = Math.max(0.0015, width * taper);
    const h = Math.max(0.001, thick * (0.4 + 0.6 * taper));
    // the tube runs root → tip; faces point outward because v = u × direction
    secs.push({ c, u: u.multiplyScalar(w / 2), v: v.multiplyScalar(h / 2), p: 2 });
  }
  return tube(secs, n, typeof color === 'function' ? color : () => color);
}

const merged = (geos) => mergeGeometries(geos, false);

/** Widen a geometry around the vertical axis (x and z only). */
function scaled(g, k) {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * k, p.getY(i), p.getZ(i) * k);
  g.computeVertexNormals();
  return g;
}

/**
 * The head's shape as rows of [t, width, depth, z]: t runs from the chin (0) to the crown (1).
 * `sharp` makes a narrower, pointed chin; 0 is a soft round one.
 */
function headRows(style) {
  const s = style.sharp;
  return [
    [0, lerp(0.05, 0.026, s), lerp(0.07, 0.05, s), lerp(0.028, 0.036, s)],
    [0.12, lerp(0.11, 0.085, s), lerp(0.13, 0.12, s), 0.02],
    [0.28, lerp(0.15, 0.13, s), 0.168, 0.008],
    [0.42, 0.152, 0.188, 0],
    [0.6, 0.158, 0.205, -0.008],
    [0.78, 0.152, 0.2, -0.014],
    [0.9, 0.124, 0.164, -0.014],
    [0.97, 0.074, 0.094, -0.012],
    [1, 0.012, 0.014, -0.01],
  ];
}

/** Where on the head's surface a direction points: `ang` round from the front (+z), at height t. */
function headPoint(H, ang, t, out = 1) {
  const [, w, d, z] = profileAt(H.rows, t);
  const k = H.size;
  const y = H.chin + t * H.h;
  // a superellipse with power 2.3 (same as the head tube): find the radius along this direction
  const dx = Math.sin(ang),
    dz = Math.cos(ang);
  const p = 2.3;
  const a = (w * k) / 2,
    b = (d * k) / 2;
  const r = 1 / Math.pow(Math.abs(dx / a) ** p + Math.abs(dz / b) ** p, 1 / p);
  return v3(dx * r * out, y, z * k + dz * r * out);
}

// ---------------------------------------------------------------------------------------------
// the face, painted on a canvas and laid over the front of the head

function paintFace(style, H) {
  const N = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  // the canvas covers x -0.08..0.08 m and y chin+0.02 .. chin+0.18 m
  const S = N / 0.16;
  const X = (x) => N / 2 + x * S;
  const Y = (t) => N - (t * H.h - 0.02) * S; // t: share of head height from the chin
  const f = style.face;
  const eyeT = f.eyeAt ?? 0.4;
  const ex = f.eyeGap ?? 0.036;
  const ew = (f.eyeW ?? 0.03) * S,
    eh = (f.eyeH ?? 0.02) * S;
  const ink = '#1d1618';
  const iris = new THREE.Color(f.iris);
  const irisDark = '#' + iris.clone().multiplyScalar(0.45).getHexString();
  const irisLight = '#' + iris.clone().lerp(new THREE.Color('#ffffff'), 0.35).getHexString();
  for (const side of [-1, 1]) {
    const cx = X(side * ex),
      cy = Y(eyeT);
    const tilt = side * (f.tilt ?? 0.12); // outer corners up for a sharp look
    g.save();
    g.translate(cx, cy);
    g.rotate(-tilt);
    // the white of the eye
    g.fillStyle = '#fbf8f4';
    g.beginPath();
    g.ellipse(0, 0, ew / 2, eh / 2, 0, 0, TAU);
    g.fill();
    // the iris, half hidden under the upper lid
    const ir = eh * (f.irisSize ?? 0.62);
    const grad = g.createLinearGradient(0, -ir, 0, ir);
    grad.addColorStop(0, irisDark);
    grad.addColorStop(0.55, '#' + iris.getHexString());
    grad.addColorStop(1, irisLight);
    g.save();
    g.beginPath();
    g.ellipse(0, 0, ew / 2, eh / 2, 0, 0, TAU);
    g.clip();
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(side * -ew * 0.04, eh * 0.06, ir * 0.82, ir, 0, 0, TAU);
    g.fill();
    g.fillStyle = '#120c10';
    g.beginPath();
    g.ellipse(side * -ew * 0.04, eh * 0.1, ir * 0.36, ir * 0.48, 0, 0, TAU);
    g.fill();
    // a sparkle and a softer second one
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(-ir * 0.35, -ir * 0.3, ir * 0.24, ir * 0.3, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 0.7;
    g.beginPath();
    g.ellipse(ir * 0.32, ir * 0.42, ir * 0.12, ir * 0.12, 0, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    // the lid's shadow over the top of the eye
    g.fillStyle = 'rgba(40,20,30,0.28)';
    g.fillRect(-ew, -eh / 2, ew * 2, eh * 0.22);
    g.restore();
    // upper lid: a thick line that flicks out at the outer corner
    g.strokeStyle = ink;
    g.lineCap = 'round';
    g.lineWidth = (f.lid ?? 0.0032) * S;
    g.beginPath();
    g.moveTo(-side * ew * 0.55, eh * 0.05);
    g.quadraticCurveTo(0, -eh * 0.78, side * ew * 0.58, -eh * 0.18);
    if (f.lash) g.lineTo(side * ew * 0.78, -eh * 0.42);
    g.stroke();
    // lower lid: a thin light line
    g.lineWidth = 0.0009 * S;
    g.strokeStyle = 'rgba(60,30,35,0.55)';
    g.beginPath();
    g.moveTo(-side * ew * 0.25, eh * 0.52);
    g.quadraticCurveTo(side * ew * 0.12, eh * 0.62, side * ew * 0.48, eh * 0.3);
    g.stroke();
    g.restore();
    // brow
    g.strokeStyle = f.brow ?? '#2a2024';
    g.lineWidth = (f.browW ?? 0.0028) * S;
    g.beginPath();
    const by = Y(eyeT + (f.browUp ?? 0.13));
    const angry = f.browAngle ?? 0.1;
    g.moveTo(X(side * (ex - 0.016)), by + angry * S * 0.03);
    g.quadraticCurveTo(
      X(side * ex),
      by - 0.004 * S,
      X(side * (ex + 0.017)),
      by + 0.002 * S - angry * S * 0.01,
    );
    g.stroke();
  }
  // nose: a small shadow
  g.strokeStyle = 'rgba(150,80,70,0.55)';
  g.lineWidth = 0.0014 * S;
  g.beginPath();
  g.moveTo(X(0.002), Y(0.27));
  g.lineTo(X(-0.003), Y(0.235));
  g.stroke();
  // mouth
  g.strokeStyle = 'rgba(110,40,45,0.9)';
  g.lineWidth = 0.0016 * S;
  g.beginPath();
  const mw = (f.mouthW ?? 0.016) / 2;
  const smile = f.smile ?? 0.002;
  g.moveTo(X(-mw), Y(0.15));
  g.quadraticCurveTo(X(0), Y(0.15) + smile * S, X(mw), Y(0.15));
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.name = 'face';
  return tex;
}

/** A grid laid just over the front of the head where the face is painted. */
function faceDecal(H) {
  const cols = 12,
    rows = 12;
  const pos = [],
    uv = [],
    idx = [];
  const ids = [];
  for (let j = 0; j <= rows; j++) {
    ids.push([]);
    const yy = H.chin + 0.02 + (j / rows) * 0.16;
    const t = (yy - H.chin) / H.h;
    const [, w, d, z] = profileAt(H.rows, Math.min(1, Math.max(0, t)));
    const a = (w * H.size) / 2,
      b = (d * H.size) / 2;
    for (let i = 0; i <= cols; i++) {
      const x = -0.08 + (i / cols) * 0.16;
      const q = Math.abs(x / a);
      if (t < 0 || q >= 0.97) {
        ids[j].push(-1);
        continue;
      }
      const zz = z * H.size + b * Math.pow(1 - q ** 2.3, 1 / 2.3) + 0.0016;
      pos.push(x, yy, zz);
      uv.push(i / cols, j / rows);
      ids[j].push(pos.length / 3 - 1);
    }
  }
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = ids[j][i],
        b = ids[j][i + 1],
        c = ids[j + 1][i],
        d = ids[j + 1][i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------------------------
// hair styles: each returns a list of geometries in head space (world metres)

/**
 * The hair that hugs the skull. Its lower edge follows a hairline: high over the forehead, lower
 * at the temples, lowest at the nape (`line` gives those three heights as shares of the head).
 */
function hairCap(H, color, scale, line) {
  const [front, side, back] = line;
  const rings = 7,
    n = 18;
  const secs = [];
  const from = Math.min(front, side, back);
  for (let i = 0; i <= rings; i++) {
    const t = lerp(from, 1, i / rings);
    const [, w, d, z] = profileAt(H.rows, t);
    const k = H.size * scale;
    secs.push(upright(H.chin + t * H.h + 0.004, w * k, d * k, { z: z * H.size - 0.003, p: 2.3 }));
  }
  const g = tube(secs, n, () => color);
  // pull everything below the hairline up onto it
  const pos = g.getAttribute('position');
  for (let i = 0; i < rings * n + n; i++) {
    const r = Math.floor(i / n);
    const a = ((i % n) / n) * TAU; // 0 is +x (the side), π/2 is +z (the front)
    const toFront = Math.sin(a); // 1 at the front, -1 at the back
    const line =
      toFront >= 0 ? lerp(side, front, toFront ** 1.5) : lerp(side, back, (-toFront) ** 1.2);
    const t = lerp(from, 1, r / rings);
    if (t >= line) continue;
    const ang = Math.atan2(pos.getX(i), pos.getZ(i) - 0.0001);
    const p = headPoint(H, ang, line, scale);
    pos.setXYZ(i, p.x, p.y + 0.004, p.z);
  }
  g.computeVertexNormals();
  return g;
}

function hair(style, H) {
  const col = rgb(style.hair);
  const c = () => col;
  const centre = v3(0, H.chin + H.h * 0.55, -0.01);
  const line = { undercut: [0.8, 0.6, 0.42], long: [0.82, 0.48, 0.25], bob: [0.8, 0.45, 0.25] }[
    style.hairStyle
  ] ?? [0.8, 0.52, 0.3];
  const geos = [hairCap(H, col, 1.07, line)];
  const at = (ang, t, out = 1.08) => headPoint(H, ang, t, out);
  const deg = Math.PI / 180;
  const L = (rootAng, rootT, ctrl, tip, w, th = 0.022) =>
    geos.push(lock(at(rootAng * deg, rootT), ctrl, tip, w, th, centre, c()));
  const front = (ang, t, out) => at(ang * deg, t, out);
  switch (style.hairStyle) {
    case 'spiky': {
      // bangs: sharp locks falling over the forehead, longer at the sides
      for (const [a, len, sway] of [
        [-42, 0.56, -0.02],
        [-26, 0.58, -0.012],
        [-10, 0.6, -0.004],
        [6, 0.58, 0.006],
        [22, 0.6, 0.014],
        [38, 0.57, 0.02],
      ]) {
        const tip = front(a + sway * 300, len, 1.12);
        tip.x += sway;
        L(a, 0.86, front(a, 0.78, 1.3), tip, 0.05);
      }
      // side locks in front of the ears, down to the jaw
      for (const s of [-1, 1]) {
        L(s * 70, 0.7, front(s * 78, 0.5, 1.18), front(s * 74, 0.24, 1.06), 0.045);
        L(s * 95, 0.72, front(s * 100, 0.5, 1.22), front(s * 102, 0.3, 1.12), 0.05);
      }
      // the back: layered spikes flaring out a little at the nape
      for (let a = 120; a <= 240; a += 20)
        L(a, 0.75, front(a, 0.45, 1.32), front(a, 0.12, 1.22), 0.07, 0.026);
      // messy volume on top
      for (const [a, t] of [
        [-20, 0.95],
        [30, 0.94],
        [160, 0.9],
        [200, 0.9],
        [90, 0.9],
        [-90, 0.9],
      ])
        L(a, t, front(a, 1.05, 1.3), front(a + 25, 0.82, 1.42), 0.06, 0.03);
      break;
    }
    case 'long': {
      // side-swept bangs from a parting on the left
      for (const [a, tipA, len] of [
        [-30, -12, 0.58],
        [-15, 6, 0.6],
        [0, 22, 0.58],
        [15, 40, 0.56],
        [30, 58, 0.52],
      ])
        L(a, 0.9, front(a + 10, 0.8, 1.25), front(tipA, len, 1.13), 0.055);
      // long locks framing the face, down to the chest
      for (const s of [-1, 1]) {
        L(s * 72, 0.72, front(s * 80, 0.3, 1.2), v3(s * 0.11, 1.18, 0.05), 0.06, 0.024);
        L(s * 92, 0.72, front(s * 98, 0.3, 1.25), v3(s * 0.13, 1.16, -0.01), 0.06, 0.024);
      }
      // the back: a solid sheet of hair, then wide locks over it down past the shoulder blades
      geos.push(
        lock(
          front(180, 0.72, 1.06),
          v3(0, H.chin + 0.02, -0.19),
          v3(0, 1.1, -0.15),
          0.27,
          0.06,
          centre,
          col,
          8,
          6,
        ),
      );
      for (const [out, back, y, w] of [
        [1.42, 0, 1.08, 0.11],
        [1.3, 0.025, 1.14, 0.1],
      ])
        for (let a = 100; a <= 260; a += 20) {
          const s = Math.sin(a * deg);
          const tip = v3(s * 0.16, y, -0.13 - back + Math.cos(a * deg) * 0.04);
          L(a, 0.84, front(a, 0.25, out), tip, w, 0.03);
        }
      break;
    }
    case 'fluffy': {
      for (let a = -50; a <= 50; a += 16)
        L(a, 0.88, front(a, 0.74, 1.32), front(a * 1.05, 0.58, 1.14), 0.065, 0.035);
      for (const s of [-1, 1])
        L(s * 80, 0.75, front(s * 86, 0.5, 1.28), front(s * 84, 0.32, 1.14), 0.06, 0.035);
      for (let a = 100; a <= 260; a += 20)
        L(a, 0.78, front(a, 0.45, 1.34), front(a, 0.22, 1.18), 0.08, 0.035);
      for (const a of [-30, 40, 150, 210])
        L(a, 0.96, front(a, 1.04, 1.34), front(a + 20, 0.85, 1.38), 0.07, 0.04);
      break;
    }
    case 'bob': {
      // blunt bangs
      for (let a = -40; a <= 40; a += 13)
        L(a, 0.9, front(a, 0.74, 1.24), front(a, 0.58, 1.13), 0.06, 0.025);
      // a rounded bob to the chin, tips curling in
      for (let a = 60; a <= 300; a += 15) {
        const tip = front(a, 0.12, 1.12);
        L(a, 0.8, front(a, 0.32, 1.4), tip, 0.08, 0.03);
      }
      break;
    }
    case 'undercut': {
      // short sides are the cap; the top sweeps back from the forehead
      for (let x = -0.05; x <= 0.051; x += 0.02) {
        const root = v3(x, H.chin + H.h * 0.86, 0.075);
        geos.push(
          lock(
            root,
            v3(x * 1.2, H.chin + H.h * 1.12, 0.0),
            v3(x * 1.3, H.chin + H.h * 0.9, -0.11),
            0.05,
            0.04,
            centre,
            col,
          ),
        );
      }
      // a short fringe falling to one side
      L(15, 0.9, front(25, 0.85, 1.35), front(40, 0.62, 1.16), 0.045, 0.025);
      break;
    }
    case 'ponytail': {
      for (const [a, tipA] of [
        [-25, -32],
        [-8, -12],
        [25, 38],
      ])
        L(a, 0.88, front(a, 0.76, 1.24), front(tipA, 0.6, 1.13), 0.05, 0.022);
      for (const s of [-1, 1])
        L(s * 70, 0.75, front(s * 76, 0.42, 1.16), front(s * 74, 0.2, 1.08), 0.035, 0.02);
      // the tail: from high on the back of the head, swinging down behind
      const base = front(180, 0.82, 1.1);
      geos.push(
        lock(
          base,
          v3(0, base.y + 0.06, base.z - 0.16),
          v3(0.02, 1.26, -0.2),
          0.11,
          0.07,
          v3(0, base.y - 0.1, base.z + 0.2),
          col,
          8,
          8,
        ),
      );
      geos.push(
        lock(
          base,
          v3(0.03, base.y - 0.02, base.z - 0.12),
          v3(0.05, 1.3, -0.16),
          0.07,
          0.05,
          v3(0, base.y - 0.1, base.z + 0.2),
          col,
          6,
          6,
        ),
      );
      break;
    }
  }
  return merged(geos);
}

// ---------------------------------------------------------------------------------------------

/** A ball (elbows, knees, the wrist) with a vertex colour, so it merges with the parts around it. */
function ball(c, r, color, w = 12, h = 8) {
  const g = new THREE.SphereGeometry(r, w, h).translate(c.x, c.y, c.z);
  const n = g.getAttribute('position').count;
  const col = [];
  for (let i = 0; i < n; i++) col.push(...color);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

/** A flat ring lying round the body at height y (a collar, a cuff, a waistband). */
function band(c, radius, thick, color, sx = 1, sz = 1, seg = 20) {
  const g = new THREE.TorusGeometry(radius, thick, 6, seg).rotateX(Math.PI / 2);
  g.scale(sx, 1, sz).translate(c.x, c.y, c.z);
  const n = g.getAttribute('position').count;
  const col = [];
  for (let i = 0; i < n; i++) col.push(...color);
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

/** Shade hair darker underneath and give it the glossy ring anime hair has. */
function hairShine(g, H) {
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const col = g.getAttribute('color');
  const lo = H.chin + H.h * 0.74,
    hi = H.chin + H.h * 0.84;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let k = 0.78 + 0.16 * Math.max(0, Math.min(1, (y - H.chin) / H.h)); // darker towards the tips
    // the shine: a band round the upper head on surfaces that face outwards
    const up = nor.getY(i);
    if (y > lo && y < hi && up > -0.3)
      k = Math.min(1.25, k + 0.32 * Math.sin(((y - lo) / (hi - lo)) * Math.PI));
    col.setXYZ(i, k, k, k);
  }
  return g;
}

/**
 * Build one character. `style` gives the body build, colours, face and hair; `rig` is the parsed
 * rig.json. Returns { root, materials, triangles }.
 */
export function buildCharacter(style, rig) {
  const at = Object.fromEntries([...rig.joints, ...rig.sockets].map((n) => [n.name, v3(...n.at)]));
  const nodes = {};
  for (const n of [...rig.joints, ...rig.sockets]) {
    const o = new THREE.Object3D();
    o.name = n.name;
    nodes[n.name] = o;
    if (n.parent) {
      nodes[n.parent].add(o);
      o.position.copy(at[n.name]).sub(at[n.parent]);
    } else o.position.copy(at[n.name]);
  }

  // glossy like the creator's slimes: smooth skin, shiny hair, soft cloth
  const mats = {
    skin: new THREE.MeshStandardMaterial({
      name: 'Skin',
      color: style.skin,
      roughness: 0.42,
      metalness: 0.02,
    }),
    hair: new THREE.MeshStandardMaterial({
      name: 'Hair',
      color: style.hair,
      vertexColors: true,
      roughness: 0.3,
      metalness: 0.05,
    }),
    outfit: new THREE.MeshStandardMaterial({
      name: 'Outfit',
      vertexColors: true,
      roughness: 0.58,
      metalness: 0.02,
    }),
  };
  const white = () => [1, 1, 1];
  const O = style.outfit;
  const shirt = rgb(O.top),
    pants = rgb(O.bottom),
    trim = rgb(O.trim ?? O.top),
    shoe = rgb(O.shoes),
    sole = rgb(O.sole ?? '#e8e4dc'),
    accent = rgb(O.accent ?? O.trim ?? O.shoes);
  const W1 = [1, 1, 1];

  const B = style.build;
  const torso = B.torso;
  const top = torso[torso.length - 1][0];
  const hem = O.hem ?? 1.0;
  const parts = [];
  const part = (name, joint, geos, materials) => parts.push({ name, joint, geos, materials });

  // torso: the shirt (on the chest) hangs over the trousers (on the hips) like real clothes, so
  // the join is a hem, not a seam; the spine carries only a small core hidden inside
  // an amber edge at the hem
  const shirtColor = (p) => (p.y < hem + 0.018 ? trim : shirt);
  const shirtGeo = scaled(profileTube(torso, hem, top, 12, 20, shirtColor, { endScale: 1 }), 1.035);
  part('Body_Chest', 'Chest', [shirtGeo], [mats.outfit]);
  part(
    'Body_Spine',
    'Spine',
    [
      scaled(
        profileTube(torso, 1.02, 1.2, 3, 10, () => shirt, { endScale: 1 }),
        0.94,
      ),
    ],
    [mats.outfit],
  );
  const pantsGeo = profileTube(
    torso,
    torso[0][0],
    hem + 0.07,
    8,
    20,
    (p) => (p.y > hem + 0.035 ? trim : pants),
    { endScale: 1 },
  );
  part('Body_Hips', 'Hips', [pantsGeo], [mats.outfit]);
  part(
    'Body_Neck',
    'Neck',
    [limb(v3(0, 1.535, -0.008), v3(0, 1.39, 0), B.neck, B.neck * 1.1, 12, white, { round: 0.1 })],
    [mats.skin],
  );

  // head
  const H = {
    size: style.headSize,
    h: style.headH,
    chin: 1.69 - style.headH,
    rows: headRows(style),
  };
  const headSecs = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const [, w, d, z] = profileAt(H.rows, t);
    headSecs.push(upright(H.chin + t * H.h, w * H.size, d * H.size, { z: z * H.size, p: 2.3 }));
  }
  const headGeos = [tube(headSecs, 22, white)];
  if (style.ears !== false)
    for (const s of [-1, 1]) {
      const e = headPoint(H, (s * 90 * Math.PI) / 180, 0.42, 0.97);
      headGeos.push(
        limb(
          v3(e.x, e.y + 0.02, e.z - 0.008),
          v3(e.x * 1.04, e.y - 0.016, e.z - 0.004),
          0.012,
          0.009,
          8,
          white,
          { steps: 4, depth: 1.6, round: 0.5 },
        ),
      );
    }
  part('Body_Head', 'Head', [mergeGeometries(headGeos)], [mats.skin]);

  for (const s of [-1, 1]) {
    const side = s > 0 ? 'L' : 'R';
    const sh = at[`UpperArm_${side}`],
      el = at[`LowerArm_${side}`],
      wr = at[`Hand_${side}`];
    // upper arm with a rounded shoulder, under a short sleeve with a turned hem
    // the top of the arm tucks under the slope of the shoulder so it reads as one body
    const shoulder = v3(sh.x - s * 0.03, 1.37, 0);
    const sleeveEnd = O.longSleeves
      ? el.clone().add(v3(0, -0.03, 0))
      : shoulder.clone().lerp(el, 0.45);
    const sleeveR = B.arm[0] * (O.longSleeves ? 1.06 : 1.13);
    // the bare arm starts inside the sleeve so no skin shows at the top
    const upper = [
      limb(
        shoulder.clone().add(v3(0, -0.03, 0)),
        el.clone().add(v3(0, -0.02, 0)),
        B.arm[0],
        B.arm[1],
        14,
        white,
        { swell: 0.06, round: 0.08 },
      ),
    ];
    const sleeve = [
      limb(
        shoulder.clone().add(v3(-s * 0.006, 0.012, 0)),
        sleeveEnd,
        sleeveR,
        sleeveR * 0.96,
        14,
        () => shirt,
        { round: 0.32 },
      ),
      band(sleeveEnd.clone().add(v3(0, 0.012, 0)), sleeveR * 0.92, 0.006, trim, 1, 1, 16),
    ];
    part(
      `Body_UpperArm_${side}`,
      `UpperArm_${side}`,
      [mergeGeometries([upper[0], mergeGeometries(sleeve)], true)],
      [mats.skin, mats.outfit],
    );
    // forearm with a round elbow so a bent arm stays whole
    const lowerSkin = [
      limb(
        el.clone().add(v3(0, 0.025, 0)),
        wr.clone().add(v3(0, -0.012, 0)),
        B.arm[1],
        B.arm[2],
        14,
        white,
        { round: 0.06 },
      ),
      ball(el, B.arm[1] * 0.99, W1, 14, 10),
    ];
    const lowerParts = [mergeGeometries(lowerSkin)];
    const lowerMats = [mats.skin];
    if (O.longSleeves) {
      lowerParts.push(
        mergeGeometries([
          limb(
            el.clone().add(v3(0, 0.03, 0)),
            wr.clone().add(v3(0, 0.02, 0)),
            B.arm[1] * 1.12,
            B.arm[2] * 1.3,
            14,
            () => shirt,
            { round: 0.12 },
          ),
          band(wr.clone().add(v3(0, 0.03, 0)), B.arm[2] * 1.28, 0.007, trim, 1, 1, 16),
        ]),
      );
      lowerMats.push(mats.outfit);
    }
    part(
      `Body_LowerArm_${side}`,
      `LowerArm_${side}`,
      [lowerParts.length > 1 ? mergeGeometries(lowerParts, true) : lowerParts[0]],
      lowerMats,
    );
    // a bigger, softer hand: palm towards the body, fingers together, a thumb forward
    const hx = wr.x,
      hs = B.hand ?? 1.15;
    const hand = tube(
      [
        upright(0.69, 0.024 * hs, 0.04 * hs, { x: hx, p: 2.4 }),
        upright(0.705, 0.034 * hs, 0.066 * hs, { x: hx, p: 2.5 }),
        upright(0.74, 0.04 * hs, 0.08 * hs, { x: hx, p: 2.6 }),
        upright(0.78, 0.042 * hs, 0.084 * hs, { x: hx, p: 2.6 }),
        upright(0.82, 0.042 * hs, 0.078 * hs, { x: hx, p: 2.5 }),
        upright(0.85, 0.036 * hs, 0.06 * hs, { x: hx, p: 2.2 }),
        upright(0.87, 0.03 * hs, 0.045 * hs, { x: hx, p: 2.2 }),
      ],
      14,
      white,
    );
    const thumb = limb(
      v3(hx - s * 0.008, 0.83, 0.028 * hs),
      v3(hx - s * 0.014, 0.772, 0.056 * hs),
      0.014 * hs,
      0.011 * hs,
      10,
      white,
      { steps: 5, round: 0.45 },
    );
    part(
      `Body_Hand_${side}`,
      `Hand_${side}`,
      [
        mergeGeometries([
          hand,
          thumb,
          ball(wr.clone().add(v3(0, 0.005, 0)), B.arm[2] * 1.02, W1, 10, 6),
        ]),
      ],
      [mats.skin],
    );

    // legs: trousers with a rounded knee and a cuff at the ankle
    const hip = at[`UpperLeg_${side}`],
      knee = at[`LowerLeg_${side}`],
      ankle = at[`Foot_${side}`];
    const legColor = () => pants;
    part(
      `Body_UpperLeg_${side}`,
      `UpperLeg_${side}`,
      [
        limb(
          hip.clone().add(v3(s * 0.006, 0.05, 0)),
          knee.clone().add(v3(0, -0.035, 0)),
          B.leg[0],
          B.leg[1],
          14,
          legColor,
          { swell: 0.04, round: 0.05 },
        ),
      ],
      [mats.outfit],
    );
    const shin = limb(
      knee.clone().add(v3(0, 0.035, 0)),
      ankle.clone().add(v3(0, 0.035, 0)),
      B.leg[1],
      B.leg[2] * (O.flare ?? 1.12),
      14,
      legColor,
      { swell: 0.07, round: 0.05 },
    );
    const cuff = band(
      ankle.clone().add(v3(0, 0.045, 0)),
      B.leg[2] * (O.flare ?? 1.12) * 0.92,
      0.012,
      trim,
      1,
      1,
      16,
    );
    part(
      `Body_LowerLeg_${side}`,
      `LowerLeg_${side}`,
      [mergeGeometries([shin, cuff, ball(knee, B.leg[1] * 0.99, pants, 14, 10)])],
      [mats.outfit],
    );
    // chunky sneakers: a thick light sole under a coloured upper with a stripe
    const fs = B.foot ?? 1.1;
    const shoeAt = (z, w, h, y0) => ({
      c: v3(ankle.x, y0 + h / 2, z),
      u: v3((w * fs) / 2, 0, 0),
      v: v3(0, -h / 2, 0),
      p: 3,
    });
    const solePts = [
      [-0.07, 0.085, 0.03],
      [-0.03, 0.1, 0.034],
      [0.06, 0.105, 0.034],
      [0.14, 0.1, 0.032],
      [0.19, 0.07, 0.026],
    ];
    const sole3 = tube(
      solePts.map(([z, w, h]) => shoeAt(z * fs, w, h, 0)),
      14,
      () => sole,
    );
    const upperPts = O.boots
      ? [
          [-0.065, 0.078, 0.13],
          [-0.03, 0.092, 0.14],
          [0.04, 0.096, 0.09],
          [0.12, 0.09, 0.06],
          [0.175, 0.062, 0.04],
        ]
      : [
          [-0.065, 0.078, 0.07],
          [-0.03, 0.092, 0.085],
          [0.04, 0.096, 0.07],
          [0.12, 0.09, 0.05],
          [0.175, 0.062, 0.032],
        ];
    const upperShoe = tube(
      upperPts.map(([z, w, h]) => shoeAt(z * fs, w, h, 0.026)),
      14,
      (p) => (Math.abs(p.x - ankle.x) > 0.035 * fs && p.y < 0.07 && p.y > 0.04 ? accent : shoe),
    );
    part(`Body_Foot_${side}`, `Foot_${side}`, [mergeGeometries([sole3, upperShoe])], [mats.outfit]);
  }

  const face = new THREE.MeshStandardMaterial({
    name: 'Face',
    map: paintFace(style, H),
    transparent: true,
    depthWrite: false,
    roughness: 0.3,
  });

  let triangles = 0;
  for (const p of parts) {
    const geo = p.geos.length === 1 ? p.geos[0] : mergeGeometries(p.geos, true);
    const local = geo.clone().translate(...at[p.joint].clone().negate().toArray());
    const mesh = new THREE.Mesh(local, p.materials.length === 1 ? p.materials[0] : p.materials);
    mesh.name = p.name;
    nodes[p.joint].add(mesh);
    triangles += (local.index ? local.index.count : local.getAttribute('position').count) / 3;
  }
  const hairGeo = hairShine(hair(style, H), H).translate(...at.Head.clone().negate().toArray());
  const hairMesh = new THREE.Mesh(hairGeo, mats.hair);
  hairMesh.name = 'Hair_Main';
  nodes.Head.add(hairMesh);
  triangles += hairGeo.index.count / 3;
  const decal = faceDecal(H).translate(...at.Head.clone().negate().toArray());
  const faceMesh = new THREE.Mesh(decal, face);
  faceMesh.name = 'Face_Main';
  faceMesh.renderOrder = 2;
  nodes.Head.add(faceMesh);
  triangles += decal.index.count / 3;

  return { root: nodes.Root, triangles, materials: [mats.skin, mats.hair, mats.outfit, face] };
}
