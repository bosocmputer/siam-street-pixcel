import * as THREE from 'three';
import type { Element, Vec3 } from '@newgame/rpg-core';

// Skill effects, all drawn in code: glowing orbs, trails, bursts, rings on the ground and marks
// left behind. Positions are map metres; the effects live inside the city group so they follow the
// city scale. Random numbers here only change how things look, never what happens in the game.

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** one colour as three 0..1 numbers */
type RGB = [number, number, number];
const rgb = (hex: number): RGB => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

interface Emit {
  pos: Vec3;
  vel?: Vec3;
  life: number;
  /** size in metres at birth and at death */
  size: [number, number];
  color: [number, number];
  alpha: [number, number];
  /** metres per second squared, + is up */
  gravity?: number;
  /** how quickly it slows down, 0 = never */
  drag?: number;
  /** 0 = soft glow, 1 = round drop with a hard edge */
  shape?: number;
}

const VERT = /* glsl */ `
attribute float size;
attribute float shape;
attribute vec4 tint;
uniform float uPx;
varying vec4 vTint;
varying float vShape;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uPx / max(-mv.z, 0.05);
  gl_Position = projectionMatrix * mv;
  vTint = tint;
  vShape = shape;
}`;

const FRAG = /* glsl */ `
varying vec4 vTint;
varying float vShape;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float soft = pow(1.0 - d, 1.6);
  float hard = smoothstep(1.0, 0.72, d);
  float a = mix(soft, hard, vShape);
  vec3 c = vTint.rgb * (1.0 + vShape * 0.6 * (1.0 - d));
  gl_FragColor = vec4(c, vTint.a * a);
}`;

/** Many small round sprites in one draw call. */
class Particles {
  readonly points: THREE.Points;
  private readonly max: number;
  private next = 0;
  /** particles alive after the last update; when it stays 0 there is nothing to do */
  private live = 0;
  private fresh = false;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private sizes: Float32Array;
  private colors: Float32Array;
  private alphas: Float32Array;
  private gravity: Float32Array;
  private drag: Float32Array;
  private tint: Float32Array;
  private shape: Float32Array;

  constructor(max: number, blending: THREE.Blending, uniforms: { uPx: { value: number } }) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.sizes = new Float32Array(max * 2);
    this.colors = new Float32Array(max * 6);
    this.alphas = new Float32Array(max * 2);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.tint = new Float32Array(max * 4);
    this.shape = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      'size',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      'tint',
      new THREE.BufferAttribute(this.tint, 4).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute(
      'shape',
      new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage),
    );
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 3 : 2;
  }

  emit(e: Emit): void {
    const i = this.next;
    this.next = (this.next + 1) % this.max;
    this.fresh = true;
    this.pos.set(e.pos, i * 3);
    this.vel.set(e.vel ?? [0, 0, 0], i * 3);
    this.age[i] = 0;
    this.life[i] = e.life;
    this.sizes.set(e.size, i * 2);
    this.colors.set([...rgb(e.color[0]), ...rgb(e.color[1])], i * 6);
    this.alphas.set(e.alpha, i * 2);
    this.gravity[i] = e.gravity ?? 0;
    this.drag[i] = e.drag ?? 0;
    this.shape[i] = e.shape ?? 0;
  }

  update(dt: number): number {
    if (this.live === 0 && !this.fresh) return 0;
    this.fresh = false;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i]! >= this.life[i]!) {
        this.size[i] = 0;
        continue;
      }
      alive++;
      const a = (this.age[i]! += dt);
      const t = Math.min(1, a / this.life[i]!);
      const k = Math.max(0, 1 - this.drag[i]! * dt);
      const j = i * 3;
      this.vel[j]! *= k;
      this.vel[j + 2]! *= k;
      this.vel[j + 1] = this.vel[j + 1]! * k + this.gravity[i]! * dt;
      this.pos[j]! += this.vel[j]! * dt;
      this.pos[j + 1]! += this.vel[j + 1]! * dt;
      this.pos[j + 2]! += this.vel[j + 2]! * dt;
      if (this.pos[j + 1]! < 0.06 && this.vel[j + 1]! < 0) {
        // drops and sparks land on the ground and stop
        this.pos[j + 1] = 0.06;
        this.vel[j] = this.vel[j + 1] = this.vel[j + 2] = 0;
      }
      this.size[i] = this.sizes[i * 2]! + (this.sizes[i * 2 + 1]! - this.sizes[i * 2]!) * t;
      const c = i * 6;
      for (let n = 0; n < 3; n++)
        this.tint[i * 4 + n] =
          this.colors[c + n]! + (this.colors[c + 3 + n]! - this.colors[c + n]!) * t;
      this.tint[i * 4 + 3] =
        this.alphas[i * 2]! + (this.alphas[i * 2 + 1]! - this.alphas[i * 2]!) * t;
    }
    const g = this.points.geometry;
    for (const name of ['position', 'size', 'tint', 'shape'])
      g.getAttribute(name).needsUpdate = true;
    this.live = alive;
    this.points.visible = alive > 0;
    return alive;
  }
}

/** A soft white dot used for glows; the material colour tints it. */
function glowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** A soft round stain for the ground. */
function stainTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** The thing that flies: a ball of flame for fire, a bubble that stretches into a spear for water. */
export interface Orb {
  object: THREE.Object3D;
  /**
   * Put it at `pos`, heading along `dir`. `grow` is 0..1 while it is being gathered in the hand,
   * and `flying` is true once it has left.
   */
  place(pos: Vec3, dir: Vec3, time: number, grow: number, flying: boolean): void;
}

const WATER_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const WATER_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
  vec3 c = mix(vec3(0.16, 0.56, 0.95), vec3(0.88, 0.98, 1.0), f);
  gl_FragColor = vec4(c, 0.5 + 0.5 * f);
}`;

interface Ring {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  delay: number;
  from: number;
  to: number;
  alpha: number;
}

interface Stain {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  age: number;
  life: number;
  alpha: number;
}

/** a small patch of fire left burning on the ground after an explosion */
interface Burning {
  pos: Vec3;
  left: number;
  key: object;
}

// bright colours that add up wash out to white over the light paving, so the body of the fire uses
// solid orange and red, and only small parts of it glow
const FIRE = {
  white: 0xfff6d8,
  yellow: 0xffd34d,
  orange: 0xff8a1e,
  flame: 0xff7a14,
  red: 0xd8380f,
  ember: 0x8c1d06,
};
const WATER = { white: 0xf2fdff, light: 0x9fe0ff, blue: 0x3a9ee8, deep: 0x1c5fae };
const SMOKE: [number, number] = [0x3d3330, 0x9a958f];

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const tmp = new THREE.Vector3();

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** two directions at right angles to `dir` and to each other */
function across(dir: Vec3): [Vec3, Vec3] {
  const u = unit(cross(dir, Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return [u, cross(dir, u)];
}
/** a random direction, length 1 */
const anyway = (): Vec3 => {
  const z = rand(-1, 1),
    a = rand(0, Math.PI * 2),
    r = Math.sqrt(1 - z * z);
  return [Math.cos(a) * r, z, Math.sin(a) * r];
};

export class Fx {
  readonly object = new THREE.Group();
  /** for glows and fire: colours add up and get brighter */
  private bright: Particles;
  /** for smoke, flames and water drops: colours cover what is behind */
  private solid: Particles;
  private uniforms = { uPx: { value: 600 } };
  private glow = glowTexture();
  /** rings lying flat on the ground */
  private rings: Ring[] = [];
  /** rings standing across a shot's path, like air pushed aside */
  private airRings: Ring[] = [];
  private stains: Stain[] = [];
  private burning: Burning[] = [];
  private emitDebt = new Map<object, number>();
  private fireCore = new THREE.MeshBasicMaterial({ color: 0xfff1c4 });
  private ballGeo = new THREE.SphereGeometry(1, 20, 14);
  private waterSkin = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
  });
  private shine = new THREE.MeshBasicMaterial({ color: 0xffffff });

  constructor() {
    this.object.name = 'Effects';
    this.bright = new Particles(1600, THREE.AdditiveBlending, this.uniforms);
    this.solid = new Particles(1400, THREE.NormalBlending, this.uniforms);
    this.object.add(this.solid.points, this.bright.points);
    const flat = new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2);
    const standing = new THREE.RingGeometry(0.88, 1, 40);
    const ringPool = (geo: THREE.RingGeometry, n: number, into: Ring[]) => {
      for (let i = 0; i < n; i++) {
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshBasicMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
        );
        mesh.visible = false;
        mesh.renderOrder = 1;
        this.object.add(mesh);
        into.push({ mesh, age: 1, life: 1, delay: 0, from: 0, to: 1, alpha: 1 });
      }
    };
    ringPool(flat, 16, this.rings);
    ringPool(standing, 24, this.airRings);
    const stainGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const stainTex = stainTexture();
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(
        stainGeo,
        new THREE.MeshBasicMaterial({
          map: stainTex,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -4,
          polygonOffsetUnits: -4,
        }),
      );
      mesh.visible = false;
      this.object.add(mesh);
      this.stains.push({ mesh, age: 1, life: 1, alpha: 1 });
    }
  }

  private sprite(
    color: number,
    opacity: number,
    blending: THREE.Blending = THREE.AdditiveBlending,
  ): THREE.Sprite {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glow,
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        blending,
      }),
    );
    s.renderOrder = 4;
    return s;
  }

  /** Make the ball for a skill; add it to the scene with `addOrb`. */
  orb(element: Element): Orb {
    const g = new THREE.Group();
    if (element === 'fire') {
      const core = new THREE.Mesh(this.ballGeo, this.fireCore);
      const outer = this.sprite(FIRE.flame, 0.85, THREE.NormalBlending);
      const inner = this.sprite(FIRE.yellow, 0.9);
      g.add(outer, core, inner);
      return {
        object: g,
        place: (p, _d, t, grow) => {
          g.position.set(...p);
          const f = 1 + Math.sin(t * 37) * 0.08 + Math.sin(t * 23) * 0.06;
          core.scale.setScalar(0.2 * grow);
          inner.scale.setScalar(0.8 * f * grow);
          outer.scale.setScalar(1.35 * (2 - f) * grow);
        },
      };
    }
    const skin = new THREE.Mesh(this.ballGeo, this.waterSkin);
    const shine = new THREE.Mesh(this.ballGeo, this.shine);
    const halo = this.sprite(WATER.light, 0.35);
    const body = new THREE.Group();
    body.add(skin, shine);
    g.add(body, halo);
    return {
      object: g,
      place: (p, d, t, grow, flying) => {
        g.position.set(...p);
        halo.scale.setScalar(1.1 * grow);
        if (flying) {
          // a short spear of water: long and thin along the way it flies
          body.quaternion.setFromUnitVectors(Z_AXIS, tmp.set(...d));
          const w = Math.sin(t * 40) * 0.05;
          skin.scale.set(0.12 * (1 + w), 0.12 * (1 - w), 0.55);
          skin.rotation.set(0, 0, 0);
          shine.scale.setScalar(0.03);
          shine.position.set(-0.04, 0.05, 0.25);
          return;
        }
        // gathering: a spinning ball of water that swells as drops join it
        body.quaternion.identity();
        const w = Math.sin(t * 18) * 0.08;
        const r = 0.24 * grow;
        skin.scale.set(r * (1 + w), r * (1 - w), r * (1 + w * 0.5));
        skin.rotation.y = t * 9;
        shine.scale.setScalar(0.05 * grow);
        shine.position.set(-0.08 * grow, 0.09 * grow, 0.08 * grow);
      },
    };
  }

  addOrb(orb: Orb): void {
    this.object.add(orb.object);
  }

  removeOrb(orb: Orb): void {
    this.object.remove(orb.object);
    this.emitDebt.delete(orb);
    this.emitDebt.delete(orb.object);
    orb.object.traverse((o) => {
      if (o instanceof THREE.Sprite) o.material.dispose();
    });
  }

  /** How many to emit this frame at `rate` per second, carrying the fractions over. */
  private count(key: object, rate: number, dt: number): number {
    const d = (this.emitDebt.get(key) ?? 0) + rate * dt;
    const n = Math.floor(d);
    this.emitDebt.set(key, d - n);
    return n;
  }

  /** Where the ball sits while it is gathered: water circles the hand, fire stays on it. */
  chargePos(element: Element, hand: Vec3, t: number, time: number): Vec3 {
    if (element === 'fire') return hand;
    const r = 0.35 * (1 - t);
    return [
      hand[0] + Math.cos(time * 14) * r,
      hand[1] + Math.sin(time * 9) * r * 0.4,
      hand[2] + Math.sin(time * 14) * r,
    ];
  }

  /**
   * One frame of gathering the ball at `p` (`t` 0..1 is how far along). Fire draws heat in as
   * sparks and the ball starts to burn; water pulls drops out of the air in a spiral.
   */
  gather(orb: Orb, element: Element, p: Vec3, t: number, dt: number): void {
    if (element === 'fire') {
      for (let i = this.count(orb, 70, dt); i > 0; i--) {
        const from = add(p, anyway(), rand(0.9, 1.5));
        const life = rand(0.22, 0.32);
        this.bright.emit({
          pos: from,
          vel: [(p[0] - from[0]) / life, (p[1] - from[1]) / life, (p[2] - from[2]) / life],
          life,
          size: [0.05, 0.12],
          color: [FIRE.red, FIRE.yellow],
          alpha: [0.2, 1],
        });
      }
      this.flames(orb.object, p, 0.28 * t, [0, 0, 0], 60 * t, dt);
      if (t > 0.3)
        for (let i = this.count(this.bright, 10, dt); i > 0; i--)
          this.bright.emit({
            pos: add(p, anyway(), 0.25 * t),
            vel: [rand(-0.8, 0.8), rand(1, 2.5), rand(-0.8, 0.8)],
            life: rand(0.3, 0.6),
            size: [0.06, 0.02],
            color: [FIRE.white, FIRE.orange],
            alpha: [1, 0],
            gravity: -2,
          });
      return;
    }
    for (let i = this.count(orb, 85, dt); i > 0; i--) {
      // start on a ring around the hand and swirl inwards
      const a = rand(0, Math.PI * 2),
        r = rand(1, 1.6),
        life = rand(0.28, 0.38);
      const from: Vec3 = [p[0] + Math.cos(a) * r, p[1] + rand(-0.6, 0.7), p[2] + Math.sin(a) * r];
      const swirl = 2.2;
      this.solid.emit({
        pos: from,
        vel: [
          (p[0] - from[0]) / life - Math.sin(a) * swirl,
          (p[1] - from[1]) / life,
          (p[2] - from[2]) / life + Math.cos(a) * swirl,
        ],
        life,
        size: [0.05, 0.1],
        color: [WATER.light, WATER.white],
        alpha: [0.3, 0.95],
        shape: 1,
      });
    }
    for (let i = this.count(orb.object, 14, dt); i > 0; i--) {
      const from = add(p, anyway(), rand(0.6, 1));
      this.bright.emit({
        pos: from,
        vel: [(p[0] - from[0]) * 2.5, (p[1] - from[1]) * 2.5, (p[2] - from[2]) * 2.5],
        life: 0.4,
        size: [0.5, 0.2],
        color: [WATER.deep, WATER.light],
        alpha: [0, 0.25],
      });
    }
  }

  /** Flames licking off the surface of a ball of radius `r` at `p`. */
  private flames(key: object, p: Vec3, r: number, drift: Vec3, rate: number, dt: number): void {
    for (let i = this.count(key, rate, dt); i > 0; i--)
      this.solid.emit({
        pos: add(p, anyway(), r * rand(0.6, 1)),
        vel: [drift[0] + rand(-0.3, 0.3), drift[1] + rand(0.6, 1.6), drift[2] + rand(-0.3, 0.3)],
        life: rand(0.22, 0.4),
        size: [rand(0.3, 0.45), 0.08],
        color: [FIRE.orange, FIRE.ember],
        alpha: [0.95, 0],
        drag: 2,
      });
  }

  /** The moment it leaves the hand: a puff and a ring of air pushed out along the way. */
  release(element: Element, p: Vec3, dir: Vec3): void {
    if (element === 'fire') {
      this.bright.emit({
        pos: p,
        life: 0.15,
        size: [0.6, 1.8],
        color: [FIRE.yellow, FIRE.orange],
        alpha: [0.9, 0],
      });
      for (let i = 0; i < 10; i++)
        this.solid.emit({
          pos: add(p, anyway(), 0.15),
          vel: add(anyway(), dir, -1.5),
          life: rand(0.25, 0.4),
          size: [0.35, 0.7],
          color: [FIRE.orange, FIRE.ember],
          alpha: [0.9, 0],
          drag: 3,
        });
      this.airRing(p, dir, 0xff9a3c, 0.15, 0.9, 0.25, 0.8, THREE.AdditiveBlending);
      return;
    }
    this.airRing(p, dir, 0xeaf9ff, 0.1, 0.6, 0.2, 0.6, THREE.NormalBlending);
    this.airRing(add(p, dir, 0.6), dir, 0xeaf9ff, 0.1, 0.45, 0.18, 0.45, THREE.NormalBlending);
    for (let i = 0; i < 16; i++) {
      const [u, v] = across(dir);
      const a = rand(0, Math.PI * 2),
        s = rand(1, 2.5);
      this.solid.emit({
        pos: p,
        vel: add(add(add([0, 0, 0], u, Math.cos(a) * s), v, Math.sin(a) * s), dir, rand(1, 4)),
        life: rand(0.25, 0.4),
        size: [0.07, 0.04],
        color: [WATER.white, WATER.blue],
        alpha: [0.95, 0.5],
        gravity: -8,
        shape: 1,
      });
    }
  }

  /**
   * What a flying ball leaves behind it, for one frame. It moved `moved` metres along `dir` to
   * reach `p`; the trail fills in that whole stretch so a fast shot leaves an unbroken line.
   */
  trail(orb: Orb, element: Element, p: Vec3, dir: Vec3, moved: number, dt: number): void {
    const back: Vec3 = [-dir[0], -dir[1], -dir[2]];
    const along = (): Vec3 => add(p, back, rand(0, moved));
    if (element === 'fire') {
      // the line of fire: dense small glows along the path, fading where the ball has been
      for (let i = this.count(orb, 160, dt); i > 0; i--)
        this.bright.emit({
          pos: add(along(), anyway(), 0.05),
          vel: [rand(-0.2, 0.2), rand(0.2, 0.6), rand(-0.2, 0.2)],
          life: rand(0.25, 0.4),
          size: [0.32, 0.06],
          color: [FIRE.yellow, FIRE.red],
          alpha: [0.75, 0],
        });
      this.flames(orb.object, p, 0.3, add([0, 0, 0], back, 2), 110, dt);
      for (let i = this.count(this.solid, 30, dt); i > 0; i--)
        this.solid.emit({
          pos: add(along(), anyway(), 0.15),
          vel: [rand(-0.3, 0.3), rand(0.6, 1.2), rand(-0.3, 0.3)],
          life: rand(0.8, 1.3),
          size: [0.35, 1.1],
          color: SMOKE,
          alpha: [0.32, 0],
          drag: 1,
        });
      for (let i = this.count(this.bright, 26, dt); i > 0; i--)
        this.bright.emit({
          pos: add(p, anyway(), 0.25),
          vel: add([rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)], back, 2),
          life: rand(0.4, 0.8),
          size: [0.07, 0.02],
          color: [FIRE.white, FIRE.orange],
          alpha: [1, 0.2],
          gravity: -3,
        });
      return;
    }
    // water: a thin wake of spray along the path, rings of air pushed aside, drops falling off
    for (let i = this.count(orb, 140, dt); i > 0; i--)
      this.bright.emit({
        pos: add(along(), anyway(), 0.04),
        life: rand(0.3, 0.45),
        size: [0.14, 0.55],
        color: [WATER.white, WATER.deep],
        alpha: [0.45, 0],
      });
    for (let i = this.count(orb.object, 18, dt); i > 0; i--)
      this.airRing(
        add(p, back, rand(0.3, moved)),
        dir,
        0xeaf9ff,
        0.12,
        0.45,
        0.2,
        0.4,
        THREE.NormalBlending,
      );
    for (let i = this.count(this.solid, 50, dt); i > 0; i--)
      this.solid.emit({
        pos: add(along(), anyway(), 0.08),
        vel: [rand(-0.6, 0.6), rand(-0.2, 0.6), rand(-0.6, 0.6)],
        life: rand(0.4, 0.7),
        size: [rand(0.06, 0.1), 0.04],
        color: [WATER.light, WATER.blue],
        alpha: [0.95, 0.6],
        gravity: -9,
        shape: 1,
      });
  }

  /**
   * The burst where a shot lands. `ground` is the height of the ground below it, `dir` the way
   * the shot was going; a `small` one is a shot fading out with nothing hit.
   */
  impact(element: Element, p: Vec3, ground: number, dir: Vec3, small = false): void {
    const at = (h: number): Vec3 => [p[0], ground + h, p[2]];
    const k = small ? 0.3 : 1;
    if (element === 'fire') {
      this.bright.emit({
        pos: p,
        life: 0.18,
        size: [1.2, 4.2 * k],
        color: [FIRE.white, FIRE.yellow],
        alpha: [0.85, 0],
      });
      // the fireball swells outwards, then rolls up as smoke
      for (let i = 0; i < 34 * k; i++) {
        const d = anyway(),
          s = rand(2.5, 6.5);
        this.solid.emit({
          pos: add(p, d, 0.2),
          vel: [d[0] * s, Math.abs(d[1]) * s * 0.7 + 0.8, d[2] * s],
          life: rand(0.45, 0.8),
          size: [rand(0.7, 1), rand(1.6, 2.2)],
          color: [FIRE.orange, FIRE.ember],
          alpha: [0.95, 0],
          drag: 4.5,
        });
      }
      for (let i = 0; i < 14 * k; i++) {
        const d = anyway();
        this.bright.emit({
          pos: add(p, d, 0.15),
          vel: add([0, 0.8, 0], d, rand(1, 3)),
          life: rand(0.25, 0.4),
          size: [0.9, 1.6],
          color: [FIRE.yellow, FIRE.red],
          alpha: [0.8, 0],
          drag: 4,
        });
      }
      for (let i = 0; i < 70 * k; i++) {
        const d = anyway(),
          s = rand(5, 11);
        this.bright.emit({
          pos: p,
          vel: [d[0] * s, Math.abs(d[1]) * s, d[2] * s],
          life: rand(0.45, 0.9),
          size: [rand(0.07, 0.13), 0.03],
          color: [FIRE.white, FIRE.orange],
          alpha: [1, 0.3],
          gravity: -9,
          drag: 1.5,
        });
      }
      for (let i = 0; i < 18 * k; i++)
        this.solid.emit({
          pos: add(p, anyway(), rand(0.2, 0.9)),
          vel: [rand(-0.7, 0.7), rand(1, 2.4), rand(-0.7, 0.7)],
          life: rand(1.4, 2.2),
          size: [0.8, 2.8],
          color: SMOKE,
          alpha: [0.4, 0],
          drag: 1.2,
        });
      if (small) return;
      this.ring(at(0.09), 0xffb347, 0.3, 4.6, 0.42, 0, 0.9, THREE.AdditiveBlending);
      this.ring(at(0.1), 0xff6a1a, 0.2, 3.2, 0.34, 0.06, 0.75, THREE.AdditiveBlending);
      this.stain(at(0.055), 3.6, 0x2a1a12, 0.55, 4);
      // little fires keep burning on the ground around it for a moment
      for (let i = 0; i < 6; i++) {
        const a = rand(0, Math.PI * 2),
          r = rand(0.4, 1.9);
        this.burning.push({
          pos: [p[0] + Math.cos(a) * r, ground + 0.1, p[2] + Math.sin(a) * r],
          left: rand(0.7, 1.5),
          key: {},
        });
      }
      return;
    }
    // water: bursts apart under pressure, most of it sprayed on in the way it was going
    this.bright.emit({
      pos: p,
      life: 0.14,
      size: [0.9, 2.8 * k],
      color: [WATER.white, WATER.light],
      alpha: [0.85, 0],
    });
    for (let i = 0; i < 100 * k; i++) {
      const d = anyway(),
        s = rand(3, 9);
      const v = add([d[0] * s, Math.abs(d[1]) * s * 0.8 + 1.5, d[2] * s], dir, rand(2, 7));
      this.solid.emit({
        pos: add(p, d, 0.1),
        vel: v,
        life: rand(0.5, 0.95),
        size: [rand(0.08, 0.16), 0.05],
        color: [WATER.white, WATER.blue],
        alpha: [0.95, 0.65],
        gravity: -14,
        drag: 0.8,
        shape: 1,
      });
    }
    for (let i = 0; i < 16 * k; i++) {
      const d = anyway();
      this.bright.emit({
        pos: add(p, d, 0.2),
        vel: add(add([0, 0.5, 0], d, rand(1.5, 3.5)), dir, 1.5),
        life: rand(0.45, 0.8),
        size: [0.6, 2.2],
        color: [WATER.light, WATER.deep],
        alpha: [0.35, 0],
        drag: 3,
      });
    }
    this.airRing(p, dir, 0xeaf9ff, 0.2, 1.5 * k, 0.26, 0.5, THREE.NormalBlending);
    if (small) return;
    for (let i = 0; i < 3; i++)
      this.ring(
        at(0.08),
        0xd8f4ff,
        0.2,
        1.8 + i * 0.9,
        0.7,
        i * 0.14,
        0.75 - i * 0.15,
        THREE.NormalBlending,
      );
    this.stain(at(0.055), 2.4, 0x1e4f73, 0.42, 2.8);
  }

  /** A defeated slime melts into a puddle with a few drops. */
  melt(p: Vec3, ground: number): void {
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2),
        s = rand(0.6, 2.2);
      this.solid.emit({
        pos: [p[0], ground + rand(0.2, 0.6), p[2]],
        vel: [Math.cos(a) * s, rand(1, 3.5), Math.sin(a) * s],
        life: rand(0.5, 0.9),
        size: [rand(0.08, 0.14), 0.05],
        color: [0x7fd8f2, 0x2a8fc4],
        alpha: [0.9, 0.6],
        gravity: -10,
        shape: 1,
      });
    }
    this.stain([p[0], ground + 0.05, p[2]], 1.6, 0x2a8fc4, 0.45, 2.2);
  }

  private ring(
    p: Vec3,
    color: number,
    from: number,
    to: number,
    life: number,
    delay: number,
    alpha: number,
    blending: THREE.Blending,
    pool = this.rings,
  ): Ring {
    const r =
      pool.find((x) => x.age >= x.life + x.delay) ??
      pool.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
    r.mesh.position.set(...p);
    r.mesh.material.color.setHex(color);
    if (r.mesh.material.blending !== blending) {
      r.mesh.material.blending = blending;
      r.mesh.material.needsUpdate = true;
    }
    Object.assign(r, { age: 0, life, delay, from, to, alpha });
    return r;
  }

  /** A ring standing across the path at `p`, facing along `dir`. */
  private airRing(
    p: Vec3,
    dir: Vec3,
    color: number,
    from: number,
    to: number,
    life: number,
    alpha: number,
    blending: THREE.Blending,
  ): void {
    const r = this.ring(p, color, from, to, life, 0, alpha, blending, this.airRings);
    r.mesh.quaternion.setFromUnitVectors(Z_AXIS, tmp.set(...dir));
  }

  private stain(p: Vec3, size: number, color: number, alpha: number, life: number): void {
    const s = this.stains.reduce((a, b) => (b.age / b.life > a.age / a.life ? b : a));
    s.mesh.position.set(...p);
    s.mesh.scale.set(size, 1, size);
    s.mesh.rotation.y = rand(0, Math.PI);
    s.mesh.material.color.setHex(color);
    Object.assign(s, { age: 0, life, alpha });
  }

  /** Advance everything; `scale` is the city scale (the effects are drawn inside the city). */
  update(dt: number, camera: THREE.PerspectiveCamera, viewHeight: number, scale: number): number {
    this.uniforms.uPx.value = (viewHeight / (2 * Math.tan((camera.fov * Math.PI) / 360))) * scale;
    for (const r of this.rings) this.grow(r, dt, false);
    for (const r of this.airRings) this.grow(r, dt, true);
    for (const s of this.stains) {
      s.age += dt;
      const t = s.age / s.life;
      s.mesh.visible = t < 1;
      // stays a while, then fades
      s.mesh.material.opacity = s.alpha * Math.min(1, (1 - t) * 2.5);
    }
    this.burning = this.burning.filter((b) => {
      b.left -= dt;
      if (b.left <= 0) {
        this.emitDebt.delete(b.key);
        return false;
      }
      this.flames(b.key, b.pos, 0.15, [0, 0.3, 0], 22 * Math.min(1, b.left * 2), dt);
      return true;
    });
    return this.bright.update(dt) + this.solid.update(dt);
  }

  private grow(r: Ring, dt: number, standing: boolean): void {
    r.age += dt;
    const t = (r.age - r.delay) / r.life;
    r.mesh.visible = t >= 0 && t < 1;
    if (!r.mesh.visible) return;
    const e = 1 - (1 - t) * (1 - t); // fast, then slowing down
    const s = r.from + (r.to - r.from) * e;
    if (standing) r.mesh.scale.setScalar(s);
    else r.mesh.scale.set(s, 1, s);
    r.mesh.material.opacity = r.alpha * (1 - t);
  }
}
