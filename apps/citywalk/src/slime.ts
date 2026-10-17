import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fetchModel } from './assets';
import {
  newBrain,
  seeded,
  stepBrain,
  type BrainWorld,
  type SlimeBrain,
  type SlimeMode,
} from './slimeBrain';

// The creator's slime (public/models/slime_aquanaut.glb). Its own clips are used as they are:
// Idle, Jumping (hops in place), Squishing and Attacking. The game moves the whole slime around.

const CLIP: Record<SlimeMode, string> = {
  idle: 'Idle',
  hop: 'Jumping',
  watch: 'Squishing',
  lunge: 'Attacking',
};
/** spheres smaller than this (radius, metres) are face details drawn with fewer triangles */
const SMALL = 0.02;

export interface SlimeTemplate {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  triangles: number;
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
export async function loadSlime(url: string): Promise<SlimeTemplate> {
  const gltf = await new GLTFLoader().parseAsync(await fetchModel(url), '');
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
  return { scene, clips: gltf.animations, triangles: triangles(scene) };
}

interface Slime {
  brain: SlimeBrain;
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  playing: SlimeMode | null;
  current: THREE.AnimationAction | null;
}

/** A group of slimes that wander around their homes, watch the walker, and lunge when close. */
export class SlimeHerd {
  object = new THREE.Group();
  private slimes: Slime[] = [];
  private world: BrainWorld;

  constructor(
    template: SlimeTemplate,
    homes: [number, number][],
    world: Omit<BrainWorld, 'rng'>,
    seed = 1,
  ) {
    this.object.name = 'Slimes';
    const rng = seeded(seed);
    this.world = { ...world, rng };
    homes.forEach(([x, z], i) => {
      const root = template.scene.clone(true);
      root.name = `Slime_${i + 1}`;
      const mixer = new THREE.AnimationMixer(root);
      const actions = new Map<string, THREE.AnimationAction>();
      for (const clip of template.clips) actions.set(clip.name, mixer.clipAction(clip));
      const brain = newBrain(x, z, rng() * 3);
      brain.heading = rng() * Math.PI * 2;
      root.position.set(x, 0, z);
      root.rotation.y = brain.heading;
      this.object.add(root);
      const slime: Slime = { brain, root, mixer, actions, playing: null, current: null };
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

  update(dt: number, player: { x: number; z: number }): void {
    for (const s of this.slimes) {
      stepBrain(s.brain, dt, player, this.world);
      this.play(s, s.brain.mode);
      s.root.position.set(s.brain.x, 0, s.brain.z);
      let d = s.brain.heading - s.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      s.root.rotation.y += d * Math.min(1, dt * 8);
      s.mixer.update(dt);
    }
  }

  /** Map positions as a flat list, for the minimap. */
  dots(): number[] {
    return this.slimes.flatMap((s) => [s.brain.x, s.brain.z]);
  }

  state(): { x: number; z: number; mode: SlimeMode }[] {
    return this.slimes.map((s) => ({ x: s.brain.x, z: s.brain.z, mode: s.brain.mode }));
  }
}
