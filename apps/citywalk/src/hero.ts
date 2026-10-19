import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneModel } from 'three/addons/utils/SkeletonUtils.js';
import { RIG } from '@newgame/rpg-core';
import type { ModelEntry } from './assets';
import { makeBike, type Walker } from './walker';
import { makePipe } from './weapon';
import { cartoon } from './sprites/bake';
import * as C from './anim/clips';
import { GAIT, blend, sample, upperBody, type Clip, type Frame, type Turn } from './anim/clips';

// The player character. Any .glb can be the body, as long as the game can find its joints:
//
// - built to config/rig.json (like the ones made by tools/character): joints carry the rig's
//   names, body parts are rigid meshes under them. Nothing else to set.
// - from a modelling program (Blender, VRoid, Mixamo...): usually a skinned mesh with its own bone
//   names, often standing in a T-pose. Its entry in public/assets.json then lists `joints` (rig
//   name → its bone name) and, for a T-pose, `restFix` (degrees to lower the arms). The model is
//   scaled to `height` metres with its feet on the ground, and turned by `forward` if it does not
//   face +z.
//
// All poses are written in the character's own frame (x = its left, y = up, z = forward, a pose
// of zero is the rig's standing pose), and turned into each bone's own axes here, so the same
// walk works on any skeleton.

export type JointName = (typeof RIG.joints)[number]['name'];

/** Bone names used by common tools, so an entry can just say `"joints": "mixamo"`. */
const SIDES = (l: string, r: string, f: (s: string) => Record<string, string>) => ({
  ...f(l),
  ...f(r),
});
export const JOINT_PRESETS: Record<string, Record<string, string>> = {
  mixamo: {
    Hips: 'mixamorig:Hips',
    Spine: 'mixamorig:Spine',
    Chest: 'mixamorig:Spine2',
    Neck: 'mixamorig:Neck',
    Head: 'mixamorig:Head',
    ...SIDES('Left', 'Right', (s) => {
      const k = s === 'Left' ? 'L' : 'R';
      return {
        [`Shoulder_${k}`]: `mixamorig:${s}Shoulder`,
        [`UpperArm_${k}`]: `mixamorig:${s}Arm`,
        [`LowerArm_${k}`]: `mixamorig:${s}ForeArm`,
        [`Hand_${k}`]: `mixamorig:${s}Hand`,
        [`UpperLeg_${k}`]: `mixamorig:${s}UpLeg`,
        [`LowerLeg_${k}`]: `mixamorig:${s}Leg`,
        [`Foot_${k}`]: `mixamorig:${s}Foot`,
      };
    }),
  },
  vroid: {
    Hips: 'J_Bip_C_Hips',
    Spine: 'J_Bip_C_Spine',
    Chest: 'J_Bip_C_Chest',
    Neck: 'J_Bip_C_Neck',
    Head: 'J_Bip_C_Head',
    ...SIDES('L', 'R', (k) => ({
      [`Shoulder_${k}`]: `J_Bip_${k}_Shoulder`,
      [`UpperArm_${k}`]: `J_Bip_${k}_UpperArm`,
      [`LowerArm_${k}`]: `J_Bip_${k}_LowerArm`,
      [`Hand_${k}`]: `J_Bip_${k}_Hand`,
      [`UpperLeg_${k}`]: `J_Bip_${k}_UpperLeg`,
      [`LowerLeg_${k}`]: `J_Bip_${k}_LowerLeg`,
      [`Foot_${k}`]: `J_Bip_${k}_Foot`,
    })),
  },
};

export interface HeroTemplate {
  scene: THREE.Object3D;
  entry: ModelEntry;
}

/** Read a character model file. */
export async function loadHero(bytes: ArrayBuffer, entry: ModelEntry): Promise<HeroTemplate> {
  const gltf = await new GLTFLoader().parseAsync(bytes, '');
  return { scene: gltf.scene, entry };
}

interface Bound {
  node: THREE.Object3D;
  /** its rest turn in the character's frame, and the inverse of its parent's */
  rest: THREE.Quaternion;
  parentInv: THREE.Quaternion;
}

const DEG = Math.PI / 180;
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();

/** What the character is doing this frame. */
export interface Motion {
  mode: 'walk' | 'run' | 'bike';
  /** how fast the body is going over the ground, metres a second on screen */
  speed: number;
  /** a ball is being gathered in the right hand */
  casting: boolean;
  down: boolean;
  /** a strike, dash or guard under way, and how far through it is (0..1) */
  act?: Act | null;
}

export const ACTS = ['strike1', 'strike2', 'strike3', 'dash', 'guard'] as const;
export type ActKind = (typeof ACTS)[number];
export interface Act {
  kind: ActKind;
  t: number;
}

/**
 * Thin dark edges round the body (drawn from the back faces, pushed out along the normals).
 * `width` is in world metres; each piece is pushed by that much whatever its own scale, so a
 * model made in centimetres gets the same edge as one made in metres.
 */
function addOutline(root: THREE.Object3D, width: number, color: number): void {
  const mats = new Map<string, THREE.MeshBasicMaterial>();
  const material = (thickness: number) => {
    const key = thickness.toPrecision(3);
    let m = mats.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
      m.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `vec3 transformed = position + normal * ${Number(key).toExponential(4)};`,
        );
      };
      mats.set(key, m);
    }
    return m;
  };
  root.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !/^Face_/.test(o.name) && o.geometry.getAttribute('normal'))
      meshes.push(o);
  });
  const scale = new THREE.Vector3();
  for (const m of meshes) {
    m.getWorldScale(scale);
    const mat = material(width / Math.max(1e-6, (scale.x + scale.y + scale.z) / 3));
    let edge: THREE.Mesh;
    if (m instanceof THREE.SkinnedMesh) {
      const s = new THREE.SkinnedMesh(m.geometry, mat);
      s.bind(m.skeleton, m.bindMatrix);
      edge = s;
    } else edge = new THREE.Mesh(m.geometry, mat);
    edge.name = `${m.name}_Edge`;
    edge.renderOrder = -1;
    edge.position.copy(m.position);
    edge.quaternion.copy(m.quaternion);
    edge.scale.copy(m.scale);
    m.parent!.add(edge);
  }
}

/** Options for drawing the body as pixel sprites (see sprites/heroSprites.ts). */
export interface HeroOptions {
  /** draw the dark edges (default: as the model entry says) */
  outline?: boolean;
  /** scale joints [x, y, z] for other proportions (a name without _L/_R means both sides) */
  proportions?: Record<string, [number, number, number]>;
  /** the round shadow under the feet (default on) */
  shadow?: boolean;
  /** the pipe in the right hand (default on) */
  weapon?: boolean;
  /** flat bands of light instead of smooth shading (for the pixel-3D look) */
  toon?: boolean;
}

/** each animation's clip (the sprite sheet's names) */
const CLIPS = {
  idle: C.IDLE,
  walk: C.WALK,
  run: C.RUN,
  strike1: C.STRIKE1,
  strike2: C.STRIKE2,
  strike3: C.STRIKE3,
  dash: C.DASH,
  guard: C.GUARD,
  hurt: C.HURT,
  cast: C.CAST,
  ride: C.RIDE,
} satisfies Record<string, Clip>;

/** The posed character, which can also hold any frame of a move still (for drawing sprites). */
export interface Hero extends Walker {
  /** hold animation `anim` at `u` (0..1) of the way through it */
  posed(anim: string, u: number): void;
}

/** The player's body: the model, posed in code, plus the motorbike shown when riding. */
export function makeHero(t: HeroTemplate, opts: HeroOptions = {}): Hero {
  const e = t.entry;
  const body = new THREE.Group();
  const holder = new THREE.Group();
  const model = cloneModel(t.scene);
  holder.add(model);
  body.add(holder);
  // the game moves the body along its -z; the rig faces +z, so the model turns round inside it
  holder.rotation.y = Math.PI;
  // face +z, stand `height` metres tall with the feet on the ground
  const turn = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 }[e.forward ?? '+z'];
  model.rotation.y = turn;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const k = (e.height ?? RIG.height) / Math.max(0.01, box.max.y - box.min.y);
  model.scale.multiplyScalar(k);
  model.position.y = -box.min.y * k;
  holder.updateMatrixWorld(true);
  if ((opts.outline ?? e.outline) !== false) addOutline(model, e.outlineWidth ?? 0.006, 0x15131c);

  // find each joint and remember how it sits at rest in the character's frame
  const names = (typeof e.joints === 'string' ? JOINT_PRESETS[e.joints] : e.joints) ?? {};
  const bodyInv = new THREE.Quaternion();
  holder.getWorldQuaternion(bodyInv).invert();
  const inFrame = (o: THREE.Object3D) =>
    bodyInv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
  // the loader drops characters such as ':' from names (mixamorig:Hips → mixamorigHips)
  const nodeOf = (name: string) =>
    model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(names[name] ?? name));
  // first bring a T-pose (or any odd rest pose) to the rig's standing pose, parents first, so
  // that every pose below bends about the right axes
  for (const j of RIG.joints) {
    const fix = e.restFix?.[j.name];
    const node = nodeOf(j.name);
    if (!fix || !node || !node.parent) continue;
    const turn = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(fix[0] * DEG, fix[1] * DEG, fix[2] * DEG, 'YXZ'),
    );
    const want = turn.multiply(inFrame(node));
    node.quaternion.copy(inFrame(node.parent).invert().multiply(want));
    node.updateMatrixWorld(true);
  }
  const joints = new Map<JointName, Bound>();
  for (const j of RIG.joints) {
    const node = nodeOf(j.name);
    if (!node) continue;
    joints.set(j.name, {
      node,
      rest: inFrame(node),
      parentInv: node.parent ? inFrame(node.parent).invert() : new THREE.Quaternion(),
    });
  }
  if (opts.proportions) {
    for (const [name, [x, y, z]] of Object.entries(opts.proportions))
      for (const j of [name, `${name}_L`, `${name}_R`])
        joints.get(j as JointName)?.node.scale.set(x, y, z);
    // stand on the ground again with the new leg length
    holder.updateMatrixWorld(true);
    model.position.y -= new THREE.Box3().setFromObject(model).min.y - holder.position.y;
  }

  /** Turn a joint by (x, y, z) radians in the character's frame, from its rest pose. */
  const pose = (name: JointName, x = 0, y = 0, z = 0) => {
    const b = joints.get(name);
    if (!b) return;
    tmpQ.setFromEuler(tmpE.set(x, y, z, 'YXZ'));
    // local = inverse(parent at rest) · turn · (this joint at rest), all in the character's frame
    b.node.quaternion.copy(b.parentInv).multiply(tmpQ).multiply(b.rest);
  };

  const bike = makeBike();
  body.add(bike);
  if (opts.toon) cartoon(body);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  if (opts.shadow !== false) body.add(shadow);

  // the pipe follows the right fist. It hangs from the body rather than the hand, so the arm's
  // chibi scaling does not stretch it.
  const grip = nodeOf('Socket_Hand_R') ?? joints.get('Hand_R')?.node;
  const pipe = makePipe();
  if (grip && opts.weapon !== false) holder.add(pipe);
  if (opts.toon) cartoon(pipe);
  // The pipe sits in the fist and points where the move says (the `Pipe` turn in a clip, from
  // straight ahead): a swing is an arc of directions, which reads better than a turning wrist.
  const holdInv = new THREE.Matrix4();
  const fist = new THREE.Vector3();
  const aim = new THREE.Quaternion();
  const holdPipe = (turn: Turn | undefined, seat: number) => {
    if (!grip || !pipe.parent) return;
    pipe.visible = seat < 0.5;
    holder.updateMatrixWorld(true);
    holdInv.copy(holder.matrixWorld).invert();
    pipe.position.copy(grip.getWorldPosition(fist).applyMatrix4(holdInv));
    const [x, y, z] = turn ?? [0, 0, 0];
    aim.setFromEuler(tmpE.set(x, y, z, 'YXZ'));
    pipe.quaternion.copy(model.quaternion).multiply(aim);
  };

  // leg lengths as built (after any chibi scaling), to keep the standing foot on the ground
  holder.updateMatrixWorld(true);
  const gap = (a: JointName, b: JointName) => {
    const p = joints.get(a)?.node.getWorldPosition(new THREE.Vector3());
    const q = joints.get(b)?.node.getWorldPosition(new THREE.Vector3());
    return p && q ? p.distanceTo(q) : 0;
  };
  const thigh = gap('UpperLeg_L', 'LowerLeg_L');
  const shin = gap('LowerLeg_L', 'Foot_L');
  const baseY = model.position.y;

  /** Put the body in a pose: the feet kept flat unless the pose turns them, the lower foot on
   * the ground, the whole body raised by the pose's lift (and lowered onto the bike seat). */
  const apply = (f: Frame, seat = 0) => {
    const j = f.joints;
    const x = (n: string) => j[n]?.[0] ?? 0;
    for (const side of ['L', 'R'] as const) {
      const foot = `Foot_${side}`;
      if (!j[foot]) j[foot] = [-(x(`UpperLeg_${side}`) + x(`LowerLeg_${side}`)), 0, 0];
    }
    for (const jt of RIG.joints) {
      const t = j[jt.name];
      pose(jt.name, t?.[0], t?.[1], t?.[2]);
    }
    const height = (s: 'L' | 'R') =>
      thigh * Math.cos(x(`UpperLeg_${s}`)) +
      shin * Math.cos(x(`UpperLeg_${s}`) + x(`LowerLeg_${s}`));
    const drop = thigh + shin - Math.max(height('L'), height('R'));
    model.position.y = baseY + (1 - seat) * (f.lift - drop) - 0.13 * seat;
    holdPipe(j.Pipe, seat);
  };

  let time = 0,
    cast = 0,
    ride = 0,
    flinch = 0,
    guard = 0,
    stride = 0,
    running = 0,
    phase = 0,
    lastAct: ActKind | null = null,
    actFade = 0;

  return {
    body,
    bike,
    lift: 0.04,
    bob: () => undefined,
    // a ball of fire or water gathers in the free (left) hand
    hand: (out) => (nodeOf('Socket_Hand_L') ?? model).getWorldPosition(out),
    joint: (name, out) => {
      const n = joints.get(name as JointName)?.node;
      return n ? n.getWorldPosition(out) : null;
    },
    hurt: () => {
      flinch = 1;
    },
    posed: (anim, u) => {
      const clip = CLIPS[anim as keyof typeof CLIPS] ?? CLIPS.idle;
      apply(sample(clip, u), anim === 'ride' ? 1 : 0);
    },
    animate: (dt, m) => {
      time += dt;
      const ease = (v: number, to: number, rate: number) => v + (to - v) * Math.min(1, dt * rate);
      const onFoot = m.mode !== 'bike' && !m.down;
      cast = ease(cast, m.casting && !m.down ? 1 : 0, 12);
      ride = ease(ride, m.mode === 'bike' ? 1 : 0, 10);
      flinch = Math.max(0, flinch - dt * 3);
      // how much of a stride to take follows the real speed, so a stop eases out and a start
      // eases in; running blends in above walking pace
      const speed = onFoot ? m.speed : 0;
      stride = ease(stride, Math.min(1, speed / 2.5), 10);
      running = ease(running, Math.min(1, Math.max(0, (speed - 4.5) / 3)), 6);
      // the stride clock runs on distance, so each step covers the ground the body moved over:
      // the feet never slide
      const cycle = GAIT.walk.cycle + (GAIT.run.cycle - GAIT.walk.cycle) * running;
      phase = (phase + (speed * dt) / cycle) % 1;

      let f = sample(CLIPS.idle, time / 3);
      f = blend(f, blend(sample(CLIPS.walk, phase), sample(CLIPS.run, phase), running), stride);
      // a strike or dash plays its clip, faded in from the walk and back out at the end; a
      // guard is held as long as the button is
      const act = m.act && !m.down ? m.act : null;
      guard = Math.min(1, Math.max(0, guard + (act?.kind === 'guard' ? dt : -dt) * 10));
      if (act && act.kind !== 'guard') {
        if (act.kind !== lastAct) actFade = 0;
        actFade = Math.min(1, actFade + dt * 14);
        const t = Math.min(1, Math.max(0, act.t));
        const out = act.kind === 'dash' ? 1 : Math.min(1, (1 - t) / 0.25);
        f = blend(f, sample(CLIPS[act.kind], t), Math.min(actFade, out));
      }
      lastAct = act?.kind ?? null;
      if (guard > 0) f = blend(f, sample(CLIPS.guard, 0), guard);
      if (cast > 0) f = blend(f, sample(CLIPS.cast, 0), cast, upperBody);
      if (flinch > 0) f = blend(f, sample(CLIPS.hurt, 0.3), Math.sin(Math.PI * flinch), upperBody);
      if (ride > 0) f = blend(f, sample(CLIPS.ride, 0), ride);
      apply(f, ride);
    },
  };
}
