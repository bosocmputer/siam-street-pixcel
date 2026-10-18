import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  damage,
  hittable,
  newBrain,
  newVitals,
  provoke,
  seeded,
  stepBrain,
  stepVitals,
  type BrainWorld,
  type Element,
  type MonsterSpec,
  type Prey,
  type SlimeBrain,
  type SlimeMode,
  type Vitals,
} from '@newgame/rpg-core';

// The creator's slime (public/models/slime_aquanaut.glb). Its own clips are used as they are:
// Idle, Jumping (hops in place), Squishing and Attacking. The game moves the whole slime around.

const CLIP: Record<SlimeMode, string> = {
  idle: 'Idle',
  hop: 'Jumping',
  watch: 'Squishing',
  lunge: 'Attacking',
  chase: 'Jumping',
};
/** spheres smaller than this (radius, metres) are face details drawn with fewer triangles */
const SMALL = 0.02;

export interface SlimeTemplate {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  triangles: number;
  /** metres from the ground to the top of the body */
  height: number;
}

function triangles(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    n += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
  });
  return n;
}

/** Merge the meshes `parts` (children of `parent`) into one mesh with the first one's material. */
function mergeInto(parent: THREE.Object3D, parts: THREE.Mesh[], name: string): void {
  if (parts.length === 0) return;
  const geos = parts.map((m) => {
    m.updateMatrix();
    const g = (m.geometry as THREE.BufferGeometry).clone();
    g.applyMatrix4(m.matrix);
    return g.index ? g.toNonIndexed() : g;
  });
  for (const g of geos)
    for (const key of Object.keys(g.attributes))
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
  const merged = mergeGeometries(geos);
  if (!merged) return;
  const mesh = new THREE.Mesh(merged, parts[0]!.material);
  mesh.name = name;
  for (const p of parts) parent.remove(p);
  parent.add(mesh);
}

/**
 * Load the slime and make it lighter to draw without changing how it looks: tiny spheres (eye
 * sparkles, the dotted mouth) get fewer triangles, and the mouth dots and each eye's sparkles are
 * merged into one mesh each.
 */
export async function loadSlime(bytes: ArrayBuffer): Promise<SlimeTemplate> {
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  const scene = gltf.scene;
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g = o.geometry as THREE.BufferGeometry;
    g.computeBoundingSphere();
    const r = g.boundingSphere!.radius;
    if (r < SMALL) {
      const c = g.boundingSphere!.center;
      o.geometry = new THREE.SphereGeometry(r, 8, 5).translate(c.x, c.y, c.z);
    }
  });
  const mouth = scene.getObjectByName('Mouth_Grp');
  if (mouth)
    mergeInto(
      mouth,
      mouth.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh),
      'Mouth',
    );
  for (const side of ['L', 'R']) {
    const eye = scene.getObjectByName(`Eye_${side}`);
    if (!eye) continue;
    const sparkles = eye.children.filter(
      (c): c is THREE.Mesh => c instanceof THREE.Mesh && /_Hi/.test(c.name),
    );
    mergeInto(eye, sparkles, `Eye_${side}_Hi`);
  }
  const box = new THREE.Box3().setFromObject(scene);
  return { scene, clips: gltf.animations, triangles: triangles(scene), height: box.max.y };
}

interface Slime {
  spec: MonsterSpec;
  brain: SlimeBrain;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  playing: SlimeMode | null;
  current: THREE.AnimationAction | null;
  vitals: Vitals;
  /** materials of this slime only, so one can light up when hit without the others */
  skins: THREE.MeshStandardMaterial[];
  flash: number;
  flashColor: THREE.Color;
  /** push-back still to travel, metres per second */
  knock: [number, number];
}

/** how long a slime glows after being hit, seconds */
const FLASH = 0.14;

/**
 * Give a cloned slime its own copies of the materials, and recolour its body with `tint` (the
 * body is the see-through material; the eyes, mouth and sparkles keep their colours).
 */
function ownSkins(root: THREE.Object3D, tint: number | null): THREE.MeshStandardMaterial[] {
  const copies = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    let c = copies.get(o.material);
    if (!c) {
      c = o.material.clone();
      if (tint !== null && c.transparent) {
        c.color.setHex(tint);
        // the body glows faintly from inside in its own colour
        c.emissive.setHex(tint).multiplyScalar(0.16);
      }
      c.userData.emissive = c.emissive.clone();
      c.userData.emissiveIntensity = c.emissiveIntensity;
      copies.set(o.material, c);
    }
    o.material = c;
  });
  return [...copies.values()];
}

/** Where one slime lives and what kind it is. */
export interface SlimeHome {
  spec: MonsterSpec;
  x: number;
  z: number;
}

/** A group of slimes that wander around their homes, watch the walker, and lunge when close. */
export class SlimeHerd {
  object = new THREE.Group();
  private slimes: Slime[] = [];
  private world: BrainWorld;
  readonly height: number;

  constructor(
    template: SlimeTemplate,
    homes: SlimeHome[],
    world: Omit<BrainWorld, 'rng'>,
    seed = 1,
  ) {
    this.object.name = 'Slimes';
    this.height = template.height;
    const rng = seeded(seed);
    this.world = { ...world, rng };
    homes.forEach(({ spec, x, z }, i) => {
      const root = template.scene.clone(true);
      root.name = `Slime_${i + 1}`;
      root.scale.setScalar(spec.scale);
      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of template.clips) actions.set(clip.name, mixer.clipAction(clip));
      const brain = newBrain(x, z, rng() * 3, spec);
      brain.heading = rng() * Math.PI * 2;
      root.position.set(x, 0, z);
      root.rotation.y = brain.heading;
      this.object.add(root);
      const slime: Slime = {
        spec,
        brain,
        root,
        mixer,
        actions,
        playing: null,
        current: null,
        vitals: newVitals(spec),
        skins: ownSkins(root, spec.tint),
        flash: 0,
        flashColor: new THREE.Color(),
        knock: [0, 0],
      };
      mixer.addEventListener('finished', (e) => this.settle(slime, e.action));
      this.slimes.push(slime);
    });
  }

  private play(s: Slime, mode: SlimeMode): void {
    if (s.playing === mode) return;
    const next = s.actions.get(CLIP[mode]);
    const prev = s.current;
    s.playing = mode;
    if (!next) return;
    next.reset();
    next.timeScale = s.spec.pace; // a quick species moves quicker, a heavy one slower
    // noticing the walker is a single squish; after it the slime breathes while it keeps watching
    next.setLoop(mode === 'watch' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.play();
    if (prev && prev !== next) prev.crossFadeTo(next, 0.25, false);
    s.current = next;
  }

  private settle(s: Slime, finished: THREE.AnimationAction): void {
    if (s.playing !== 'watch' || finished !== s.current) return;
    const idle = s.actions.get(CLIP.idle);
    if (!idle) return;
    idle.reset();
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.play();
    finished.crossFadeTo(idle, 0.3, false);
    s.current = idle;
  }

  /**
   * Move every slime on by dt. Returns the blows angry slimes landed on the player this step,
   * with where each came from (map metres).
   */
  update(dt: number, player: Prey): { damage: number; from: [number, number] }[] {
    const blows: { damage: number; from: [number, number] }[] = [];
    for (const s of this.slimes) {
      const v = s.vitals;
      const changed = stepVitals(v, dt);
      if (changed === 'growing') {
        // back at home, growing out of the ground
        const [hx, hz] = s.brain.home;
        Object.assign(s.brain, newBrain(hx, hz, 1, s.spec), { heading: s.brain.heading });
        s.root.visible = true;
      }
      if (changed === 'gone') s.root.visible = false;
      if (v.life === 'alive') {
        stepBrain(s.brain, dt, player, this.world);
        if (s.brain.struck)
          blows.push({ damage: s.spec.attack.damage, from: [s.brain.x, s.brain.z] });
      } else if (v.life === 'hurt' && (s.knock[0] || s.knock[1])) {
        const [nx, nz] = this.world.move(
          s.brain.x,
          s.brain.z,
          s.knock[0] * dt,
          s.knock[1] * dt,
          s.spec.radius,
        );
        s.brain.x = nx;
        s.brain.z = nz;
        const k = Math.max(0, 1 - dt * 8);
        s.knock = [s.knock[0] * k, s.knock[1] * k];
      }
      this.play(s, s.brain.mode);
      s.root.position.set(s.brain.x, 0, s.brain.z);
      this.shape(s);
      let d = s.brain.heading - s.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.root.rotation.y += d * Math.min(1, dt * 8);
      if (s.flash > 0) {
        s.flash = Math.max(0, s.flash - dt);
        this.glow(s, s.flash / FLASH);
      }
      s.mixer.update(dt);
    }
    return blows;
  }

  /** Squash when hit, flatten into a puddle when beaten, pop back up when growing again. */
  private shape(s: Slime): void {
    const v = s.vitals;
    let y = 1,
      xz = 1;
    if (v.life === 'hurt') {
      const t = 1 - v.timer / v.times.hurt;
      const q = Math.sin(t * Math.PI) * Math.exp(-t * 1.5);
      y = 1 - 0.35 * q;
      xz = 1 + 0.22 * q;
    } else if (v.life === 'melting') {
      const t = 1 - v.timer / v.times.melt;
      y = Math.max(0.04, 1 - t * 1.2);
      xz = 1 + 0.7 * Math.min(1, t * 1.3);
    } else if (v.life === 'growing') {
      const t = 1 - v.timer / v.times.grow;
      // overshoot a little, like jelly settling
      const b = 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);
      y = xz = Math.max(0.01, b);
    }
    const k = s.spec.scale;
    s.root.scale.set(xz * k, y * k, xz * k);
  }

  private glow(s: Slime, k: number): void {
    for (const m of s.skins) {
      m.emissive.copy(m.userData.emissive as THREE.Color).lerp(s.flashColor, k);
      m.emissiveIntensity =
        (m.userData.emissiveIntensity as number) +
        (2.5 - (m.userData.emissiveIntensity as number)) * k;
    }
  }

  /** The point a shot should aim at, or null if the slime cannot be hit right now. */
  aimPoint(i: number): [number, number, number] | null {
    const s = this.slimes[i];
    if (!s || !hittable(s.vitals)) return null;
    return [s.brain.x, this.heightOf(i) * 0.45, s.brain.z];
  }

  /** How tall slime i is, metres (a giant is taller, a mini shorter). */
  heightOf(i: number): number {
    return this.height * (this.slimes[i]?.spec.scale ?? 1);
  }

  /** Which kind slime i is. */
  species(i: number): MonsterSpec {
    const s = this.slimes[i];
    if (!s) throw new Error(`no slime ${i}`);
    return s.spec;
  }

  /** How much of an element's damage slime i takes (1 = normal, above 1 = weak to it). */
  takes(i: number, element: Element): number {
    return this.slimes[i]?.spec.takes[element] ?? 1;
  }

  /** How close a shot must come to slime i to hit it, metres. */
  hitRadius(i: number, base: number): number {
    return base * Math.max(0.6, this.slimes[i]?.spec.scale ?? 1);
  }

  /**
   * Hit slime i for `amount`, pushed away from (fromX, fromZ) by `knock` metres. It turns to face
   * whoever hit it.
   */
  hit(
    i: number,
    amount: number,
    fromX: number,
    fromZ: number,
    knock: number,
    color: number,
  ): 'hurt' | 'defeated' | 'ignored' {
    const s = this.slimes[i];
    if (!s) return 'ignored';
    const result = damage(s.vitals, amount);
    if (result === 'ignored') return result;
    const dx = s.brain.x - fromX,
      dz = s.brain.z - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    // travel `knock` metres while slowing down at rate 8: speed = distance * 8
    s.knock = [(dx / d) * knock * 8, (dz / d) * knock * 8];
    s.brain.heading = Math.atan2(-dx, -dz);
    s.brain.mode = 'watch';
    s.brain.target = null;
    provoke(s.brain); // it fights back now
    s.playing = null; // replay the squish
    s.flash = FLASH;
    s.flashColor.setHex(color);
    return result;
  }

  hp(i: number): number {
    return this.slimes[i]?.vitals.hp ?? 0;
  }

  /** Health left as a share of its most, 0..1. */
  hpRatio(i: number): number {
    const v = this.slimes[i]?.vitals;
    return v ? v.hp / v.max : 0;
  }

  get count(): number {
    return this.slimes.length;
  }

  /** Map positions as a flat list, for the minimap. */
  dots(): number[] {
    return this.slimes.flatMap((s) => (s.root.visible ? [s.brain.x, s.brain.z] : []));
  }

  state(): {
    x: number;
    z: number;
    mode: SlimeMode;
    species: string;
    hp: number;
    life: Vitals['life'];
    alive: boolean;
    angry: boolean;
  }[] {
    return this.slimes.map((s) => ({
      x: s.brain.x,
      z: s.brain.z,
      mode: s.brain.mode,
      species: s.spec.id,
      hp: s.vitals.hp,
      life: s.vitals.life,
      alive: hittable(s.vitals),
      angry: s.brain.anger > 0,
    }));
  }
}
