import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneModel } from 'three/addons/utils/SkeletonUtils.js';
import { RIG } from '@newgame/rpg-core';
import type { ModelEntry } from './assets';
import { makeBike, type Walker } from './walker';

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
}

/** The player's body: the model, posed in code, plus the motorbike shown when riding. */
export function makeHero(t: HeroTemplate, opts: HeroOptions = {}): Walker {
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
  const hand = nodeOf('Socket_Hand_R') ?? joints.get('Hand_R')?.node ?? model;
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
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  if (opts.shadow !== false) body.add(shadow);

  let time = 0,
    cast = 0,
    ride = 0,
    flinch = 0,
    stride = 0,
    running = 0,
    phase = 0;
  const baseY = model.position.y;
  // leg lengths from the rig, to keep the standing foot on the ground
  const at = Object.fromEntries(RIG.joints.map((j) => [j.name, j.at]));
  const thigh = at.UpperLeg_L![1] - at.LowerLeg_L![1];
  const shin = at.LowerLeg_L![1] - at.Foot_L![1];

  return {
    body,
    bike,
    lift: 0.04,
    bob: () => undefined,
    hand: (out) => hand.getWorldPosition(out),
    joint: (name, out) => {
      const n = joints.get(name as JointName)?.node;
      return n ? n.getWorldPosition(out) : null;
    },
    hurt: () => {
      flinch = 1;
    },
    animate: (dt, m) => {
      time += dt;
      const ease = (v: number, to: number, rate: number) => v + (to - v) * Math.min(1, dt * rate);
      const onFoot = m.mode !== 'bike' && !m.down;
      cast = ease(cast, m.casting && !m.down ? 1 : 0, 12);
      ride = ease(ride, m.mode === 'bike' ? 1 : 0, 10);
      // how much of a stride to take follows the real speed, so a stop eases out and a start
      // eases in; running blends in above walking pace
      const speed = onFoot ? m.speed : 0;
      stride = ease(stride, Math.min(1, speed / 3.5), 10);
      running = ease(running, Math.min(1, Math.max(0, (speed - 4.5) / 3)), 6);
      flinch = Math.max(0, flinch - dt * 4);
      // the stride clock runs on distance, so each step covers the ground the body moved over:
      // the feet never slide
      const stepLen = 1.25 + 0.85 * running;
      phase += ((speed * dt) / stepLen) * Math.PI;
      const p = phase;
      const r = running;
      const mix = (a: number, b: number) => a + (b - a) * ride;

      // legs: the thigh swings from the hip; the knee folds as the leg comes through, more when
      // running; the foot stays level with the ground
      const swingA = (0.5 + 0.28 * r) * stride;
      const kneeA = (0.85 + 1.0 * r) * stride;
      const leg = (side: 1 | -1) => {
        const f = p + (side > 0 ? 0 : Math.PI);
        // a runner lifts the knee high as the leg comes forward
        const thighX = -swingA * Math.sin(f) - 0.4 * r * stride * Math.max(0, Math.sin(f + 0.9));
        // the knee folds through the whole swing, most as the leg passes under the body
        const kneeX = kneeA * ((1 + Math.cos(f - 0.25)) / 2) ** 2 + 0.08 * stride;
        return { thighX, kneeX, footX: -(thighX + kneeX) * 0.8 };
      };
      const L = leg(1),
        R = leg(-1);
      pose('UpperLeg_L', mix(L.thighX, -1.4), 0, mix(0, 0.12));
      pose('UpperLeg_R', mix(R.thighX, -1.4), 0, mix(0, -0.12));
      pose('LowerLeg_L', mix(L.kneeX, 1.45));
      pose('LowerLeg_R', mix(R.kneeX, 1.45));
      pose('Foot_L', mix(L.footX, 0.1));
      pose('Foot_R', mix(R.footX, 0.1));

      // arms swing against the legs, elbows bent more when running; the right one comes up to
      // gather a ball
      const sw = Math.sin(p) * stride; // + : left leg forward, left arm back
      const armA = 0.42 + 0.45 * r;
      // a runner's elbows stay bent near a right angle, a walker's swing almost straight
      const elbow = (s: number) => 0.18 + 0.2 * stride + 1.25 * r * stride + 0.2 * Math.max(0, -s);
      const breathe = Math.sin(time * 2.2) * 0.02 * (1 - stride);
      const upL = mix(sw * armA, -0.95);
      const upR = mix(-sw * armA, -0.95);
      pose('UpperArm_L', upL, 0, mix(0.07 + breathe + 0.05 * r, 0.15));
      pose(
        'UpperArm_R',
        upR + (-1.35 - upR) * cast,
        0,
        mix(-0.07 - breathe - 0.05 * r, -0.15) - 0.2 * cast,
      );
      pose('LowerArm_L', -mix(elbow(sw), 0.35));
      pose('LowerArm_R', -mix(elbow(-sw), 0.35) - 0.25 * cast);

      // the body: hips turn with the stepping leg and dip towards it, the shoulders turn against
      // them, the head keeps looking ahead; lean into a run or onto the bike; flinch when hit
      const hipTurn = Math.sin(p) * stride * (0.14 + 0.06 * r);
      pose('Hips', 0, mix(hipTurn, 0), mix(Math.cos(p) * 0.045 * stride, 0));
      pose(
        'Spine',
        mix(-0.05 * stride - 0.32 * r * stride, -0.25) + 0.25 * flinch,
        mix(-hipTurn * 1.6, 0) - 0.25 * cast,
      );
      pose('Chest', breathe + 0.15 * flinch + 0.03 * Math.sin(2 * p) * stride, 0);
      // the head comes back up so a leaning runner still looks ahead
      pose('Neck', mix(0.2 * r * stride, 0.1), hipTurn * 0.5 + 0.15 * cast);
      pose('Head', -0.1 * flinch);

      // drop the body so the lower foot stands on the ground (a swinging leg otherwise lifts
      // both feet and the body floats); a runner leaves the ground briefly between steps
      const height = (l: { thighX: number; kneeX: number }) =>
        thigh * Math.cos(l.thighX) + shin * Math.cos(l.thighX + l.kneeX);
      const drop = thigh + shin - Math.max(height(L), height(R));
      const flight = 0.035 * r * stride * Math.max(0, Math.cos(2 * p));
      model.position.y = baseY + (1 - ride) * (flight - drop) - 0.13 * ride;
    },
  };
}
