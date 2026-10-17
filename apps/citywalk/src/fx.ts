import * as THREE from 'three';
import type { Element, Vec3 } from './skills';

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

/** The thing that flies: a glowing ball for fire, a wobbling bubble for water. */
export interface Orb {
  object: THREE.Object3D;
  place(pos: Vec3, dir: Vec3, time: number): void;
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

export class Fx {
  readonly object = new THREE.Group();
  /** for glows and fire: colours add up and get brighter */
  private bright: Particles;
  /** for smoke and water drops: colours cover what is behind */
  private solid: Particles;
  private uniforms = { uPx: { value: 600 } };
  private glow = glowTexture();
  private rings: Ring[] = [];
  private stains: Stain[] = [];
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
    this.bright = new Particles(1400, THREE.AdditiveBlending, this.uniforms);
    this.solid = new Particles(900, THREE.NormalBlending, this.uniforms);
    this.object.add(this.solid.points, this.bright.points);
    const ringGeo = new THREE.RingGeometry(0.82, 1, 56).rotateX(-Math.PI / 2);
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.object.add(mesh);
      this.rings.push({ mesh, age: 1, life: 1, delay: 0, from: 0, to: 1, alpha: 1 });
    }
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

  /** Make the flying ball for a skill; add `object` to the scene yourself via `addOrb`. */
  orb(element: Element): Orb {
    const g = new THREE.Group();
    if (element === 'fire') {
      const core = new THREE.Mesh(this.ballGeo, this.fireCore);
      core.scale.setScalar(0.16);
      const outer = this.sprite(FIRE.flame, 0.8, THREE.NormalBlending);
      const inner = this.sprite(FIRE.yellow, 0.9);
      g.add(outer, core, inner);
      return {
        object: g,
        place: (p, _d, t) => {
          g.position.set(...p);
          const f = 1 + Math.sin(t * 37) * 0.08 + Math.sin(t * 23) * 0.06;
          inner.scale.setScalar(0.6 * f);
          outer.scale.setScalar(1.05 * (2 - f));
        },
      };
    }
    const skin = new THREE.Mesh(this.ballGeo, this.waterSkin);
    const shine = new THREE.Mesh(this.ballGeo, this.shine);
    shine.scale.setScalar(0.045);
    shine.position.set(-0.07, 0.08, 0.06);
    const halo = this.sprite(WATER.light, 0.35);
    halo.scale.setScalar(1.1);
    g.add(skin, shine, halo);
    return {
      object: g,
      place: (p, _d, t) => {
        g.position.set(...p);
        // a bubble of water wobbles as it flies
        const w = Math.sin(t * 18) * 0.07;
        skin.scale.set(0.22 * (1 + w), 0.22 * (1 - w), 0.22 * (1 + w * 0.5));
        skin.rotation.y = t * 3;
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

  /** What a flying orb leaves behind it, for one frame. */
  trail(orb: Orb, element: Element, p: Vec3, dir: Vec3, dt: number, time: number): void {
    const back: Vec3 = [-dir[0], -dir[1], -dir[2]];
    const jitter = (r: number): Vec3 => [
      p[0] + rand(-r, r),
      p[1] + rand(-r, r),
      p[2] + rand(-r, r),
    ];
    if (element === 'fire') {
      for (let i = this.count(orb, 80, dt); i > 0; i--)
        this.solid.emit({
          pos: jitter(0.1),
          vel: [
            back[0] * 1.5 + rand(-0.4, 0.4),
            back[1] * 1.5 + rand(0.3, 1.2),
            back[2] * 1.5 + rand(-0.4, 0.4),
          ],
          life: rand(0.25, 0.45),
          size: [rand(0.4, 0.55), 0.1],
          color: [FIRE.orange, FIRE.ember],
          alpha: [0.95, 0],
          drag: 2,
        });
      for (let i = this.count(orb.object, 50, dt); i > 0; i--)
        this.bright.emit({
          pos: jitter(0.08),
          vel: [back[0] * 1.2, back[1] * 1.2 + rand(0.2, 0.8), back[2] * 1.2],
          life: rand(0.15, 0.3),
          size: [rand(0.25, 0.35), 0.05],
          color: [FIRE.yellow, FIRE.orange],
          alpha: [0.7, 0],
          drag: 2,
        });
      for (let i = this.count(this.solid, 24, dt); i > 0; i--)
        this.solid.emit({
          pos: jitter(0.12),
          vel: [rand(-0.3, 0.3), rand(0.6, 1.2), rand(-0.3, 0.3)],
          life: rand(0.7, 1.1),
          size: [0.3, 0.9],
          color: [0x4a3a33, 0x8a8580],
          alpha: [0.35, 0],
          drag: 1,
        });
      for (let i = this.count(this.bright, 18, dt); i > 0; i--)
        this.bright.emit({
          pos: jitter(0.15),
          vel: [rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1.5, 1.5)],
          life: rand(0.4, 0.8),
          size: [0.07, 0.02],
          color: [FIRE.white, FIRE.orange],
          alpha: [1, 0.2],
          gravity: -3,
        });
      return;
    }
    // water: two threads spiral around the path, drops fall off it and a light mist follows
    const side = Math.abs(dir[1]) < 0.9 ? ([0, 1, 0] as Vec3) : ([1, 0, 0] as Vec3);
    const u: Vec3 = [
      dir[1] * side[2] - dir[2] * side[1],
      dir[2] * side[0] - dir[0] * side[2],
      dir[0] * side[1] - dir[1] * side[0],
    ];
    const ul = Math.hypot(...u) || 1;
    u[0] /= ul;
    u[1] /= ul;
    u[2] /= ul;
    const v: Vec3 = [
      dir[1] * u[2] - dir[2] * u[1],
      dir[2] * u[0] - dir[0] * u[2],
      dir[0] * u[1] - dir[1] * u[0],
    ];
    for (let i = this.count(orb, 90, dt); i > 0; i--) {
      const a = time * 16 + (i % 2) * Math.PI;
      const r = 0.3;
      const c = Math.cos(a) * r,
        s = Math.sin(a) * r;
      this.bright.emit({
        pos: [p[0] + u[0] * c + v[0] * s, p[1] + u[1] * c + v[1] * s, p[2] + u[2] * c + v[2] * s],
        life: 0.32,
        size: [0.2, 0.04],
        color: [WATER.white, WATER.blue],
        alpha: [0.75, 0],
      });
    }
    for (let i = this.count(this.solid, 40, dt); i > 0; i--)
      this.solid.emit({
        pos: jitter(0.12),
        vel: [back[0] * 1 + rand(-0.6, 0.6), rand(-0.2, 0.8), back[2] * 1 + rand(-0.6, 0.6)],
        life: rand(0.4, 0.7),
        size: [rand(0.07, 0.11), 0.04],
        color: [WATER.light, WATER.blue],
        alpha: [0.95, 0.6],
        gravity: -9,
        shape: 1,
      });
    for (let i = this.count(this.bright, 20, dt); i > 0; i--)
      this.bright.emit({
        pos: jitter(0.08),
        life: 0.5,
        size: [0.35, 0.8],
        color: [WATER.light, WATER.deep],
        alpha: [0.22, 0],
      });
  }

  /** A small flash at the hand as the skill leaves it. */
  cast(element: Element, p: Vec3): void {
    const c =
      element === 'fire' ? FIRE : { white: WATER.white, yellow: WATER.light, orange: WATER.blue };
    this.bright.emit({
      pos: p,
      life: 0.18,
      size: [0.4, 1.3],
      color: [c.white, c.orange],
      alpha: [0.9, 0],
    });
    for (let i = 0; i < 14; i++)
      this.bright.emit({
        pos: p,
        vel: [rand(-2.5, 2.5), rand(-1, 2.5), rand(-2.5, 2.5)],
        life: rand(0.2, 0.35),
        size: [0.1, 0.02],
        color: [c.white, c.yellow],
        alpha: [1, 0],
        drag: 4,
      });
  }

  /** The burst where a shot lands. `ground` is the height of the ground below it. */
  impact(element: Element, p: Vec3, ground: number, big = true): void {
    const at = (h: number): Vec3 => [p[0], ground + h, p[2]];
    if (element === 'fire') {
      this.bright.emit({
        pos: p,
        life: 0.16,
        size: [0.8, 2.4],
        color: [FIRE.yellow, FIRE.orange],
        alpha: [0.9, 0],
      });
      for (let i = 0; i < (big ? 22 : 8); i++) {
        const a = rand(0, Math.PI * 2),
          s = rand(0.8, 2.8);
        this.solid.emit({
          pos: [p[0] + rand(-0.2, 0.2), p[1] + rand(-0.2, 0.2), p[2] + rand(-0.2, 0.2)],
          vel: [Math.cos(a) * s, rand(0.5, 2.5), Math.sin(a) * s],
          life: rand(0.35, 0.6),
          size: [rand(0.6, 0.9), 1.3],
          color: [FIRE.orange, FIRE.ember],
          alpha: [0.95, 0],
          drag: 3,
        });
      }
      for (let i = 0; i < (big ? 46 : 14); i++) {
        const a = rand(0, Math.PI * 2),
          up = rand(-0.2, 1),
          s = rand(4, 9);
        this.bright.emit({
          pos: p,
          vel: [Math.cos(a) * s * (1 - up * 0.5), up * s, Math.sin(a) * s * (1 - up * 0.5)],
          life: rand(0.4, 0.8),
          size: [rand(0.07, 0.12), 0.03],
          color: [FIRE.white, FIRE.orange],
          alpha: [1, 0.3],
          gravity: -9,
          drag: 1.5,
        });
      }
      for (let i = 0; i < (big ? 12 : 4); i++)
        this.solid.emit({
          pos: [p[0] + rand(-0.4, 0.4), p[1] + rand(0, 0.4), p[2] + rand(-0.4, 0.4)],
          vel: [rand(-0.6, 0.6), rand(0.8, 1.8), rand(-0.6, 0.6)],
          life: rand(1.2, 1.9),
          size: [0.6, 2.2],
          color: [0x3d3330, 0x9a958f],
          alpha: [0.42, 0],
          drag: 1.2,
        });
      if (big) {
        this.ring(at(0.09), 0xffb347, 0.2, 3.2, 0.38, 0, 0.9, THREE.AdditiveBlending);
        this.ring(at(0.1), 0xff6a1a, 0.1, 2.2, 0.3, 0.06, 0.7, THREE.AdditiveBlending);
        this.stain(at(0.055), 2.4, 0x2a1a12, 0.55, 3.5);
      }
      return;
    }
    // water
    this.bright.emit({
      pos: p,
      life: 0.14,
      size: [0.8, 2.4],
      color: [WATER.white, WATER.light],
      alpha: [0.8, 0],
    });
    for (let i = 0; i < (big ? 44 : 16); i++) {
      const a = rand(0, Math.PI * 2),
        s = rand(1.5, 5);
      this.solid.emit({
        pos: [p[0] + rand(-0.15, 0.15), p[1] + rand(-0.15, 0.15), p[2] + rand(-0.15, 0.15)],
        vel: [Math.cos(a) * s, rand(2, 6), Math.sin(a) * s],
        life: rand(0.6, 1),
        size: [rand(0.08, 0.15), 0.05],
        color: [WATER.white, WATER.blue],
        alpha: [0.95, 0.7],
        gravity: -13,
        shape: 1,
      });
    }
    for (let i = 0; i < (big ? 10 : 4); i++)
      this.bright.emit({
        pos: [p[0] + rand(-0.3, 0.3), p[1] + rand(-0.2, 0.3), p[2] + rand(-0.3, 0.3)],
        vel: [rand(-0.8, 0.8), rand(0.2, 0.9), rand(-0.8, 0.8)],
        life: rand(0.5, 0.8),
        size: [0.6, 1.8],
        color: [WATER.light, WATER.deep],
        alpha: [0.3, 0],
        drag: 2,
      });
    if (big) {
      for (let i = 0; i < 3; i++)
        this.ring(
          at(0.08),
          0xd8f4ff,
          0.2,
          1.6 + i * 0.8,
          0.7,
          i * 0.14,
          0.75 - i * 0.15,
          THREE.NormalBlending,
        );
      this.stain(at(0.055), 2, 0x1e4f73, 0.4, 2.5);
    }
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
  ): void {
    const r = this.rings.find((x) => x.age >= x.life + x.delay) ?? this.rings[0]!;
    r.mesh.position.set(...p);
    r.mesh.material.color.setHex(color);
    r.mesh.material.blending = blending;
    r.mesh.material.needsUpdate = true;
    Object.assign(r, { age: 0, life, delay, from, to, alpha });
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
    for (const r of this.rings) {
      r.age += dt;
      const t = (r.age - r.delay) / r.life;
      r.mesh.visible = t >= 0 && t < 1;
      if (!r.mesh.visible) continue;
      const e = 1 - (1 - t) * (1 - t); // fast, then slowing down
      const s = r.from + (r.to - r.from) * e;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = r.alpha * (1 - t);
    }
    for (const s of this.stains) {
      s.age += dt;
      const t = s.age / s.life;
      s.mesh.visible = t < 1;
      // stays a while, then fades
      s.mesh.material.opacity = s.alpha * Math.min(1, (1 - t) * 2.5);
    }
    return this.bright.update(dt) + this.solid.update(dt);
  }
}
