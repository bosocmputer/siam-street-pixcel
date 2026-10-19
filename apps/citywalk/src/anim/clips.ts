// The player's moves as key poses, the way an animator sets them: a walk's contact, down,
// passing and up; a strike's wind-up, hit and follow-through. Between keys the joints ease from
// one pose to the next. Poses are in the character's own frame (see hero.ts): degrees, x = bend
// (a limb hanging down swings forward with -x; the spine and head lean forward with +x; a knee
// folds back with +x, an elbow forward with -x), y = twist (+ turns towards the character's left),
// z = out to the side (+ for the left limbs, - for the right; the spine leans right with +z).
// A gait's second half is its first half mirrored, left for right. `lift` raises the whole body
// (metres) on top of keeping the lower foot on the ground. `Pipe` is where the weapon in the right
// fist points, turned from straight ahead the same way (x + tips it down, y + swings it left).

export type Turn = [number, number, number];
/** a pose and how far the body is lifted off the ground */
export interface Frame {
  joints: Record<string, Turn>;
  lift: number;
}
export type Ease = 'linear' | 'in' | 'out' | 'inout';
export interface Key {
  /** 0..1 through the clip */
  t: number;
  pose: Record<string, Turn>;
  lift?: number;
  /** how it moves towards the next key */
  ease?: Ease;
}
export interface Clip {
  keys: Key[];
  loop: boolean;
  /** joints laid over these keys on their own timing (a walk's arms over its legs) */
  top?: Clip;
}

/** walking and running speeds (metres a second on screen) and the ground one stride cycle covers */
export const GAIT = {
  walk: { speed: 4, cycle: 2.5 },
  run: { speed: 8, cycle: 4.2 },
};

const RAD = Math.PI / 180;

const easing: Record<Ease, (u: number) => number> = {
  linear: (u) => u,
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inout: (u) => u * u * (3 - 2 * u),
};

/** The other side: left for right, and the turns that cross the middle reversed. */
export function mirrorPose(p: Record<string, Turn>): Record<string, Turn> {
  const out: Record<string, Turn> = {};
  for (const [name, [x, y, z]] of Object.entries(p)) {
    const other = name.endsWith('_L')
      ? name.slice(0, -2) + '_R'
      : name.endsWith('_R')
        ? name.slice(0, -2) + '_L'
        : name;
    out[other] = [x, -y, -z];
  }
  return out;
}

/** A gait from its first half: the second half is the first mirrored, half a cycle on. */
export function gait(half: Key[]): Clip {
  const keys = [...half, ...half.map((k) => ({ ...k, t: k.t + 0.5, pose: mirrorPose(k.pose) }))];
  return { keys, loop: true };
}

/** Lay one clip's joints over another's (an arm swing over a leg cycle). */
export function overlay(base: Clip, top: Clip): Clip {
  return { ...base, top };
}

/** The pose `t` of the way through a clip (wrapping round if it loops), in radians. */
export function sample(clip: Clip, t: number): Frame {
  const keys = clip.keys;
  let u = clip.loop ? t - Math.floor(t) : Math.min(1, Math.max(0, t));
  // the key before and after
  let i = keys.length - 1;
  while (i > 0 && keys[i]!.t > u) i--;
  const a = keys[i]!;
  let b = keys[i + 1];
  let span: number;
  if (!b) {
    if (!clip.loop) return toFrame(a.pose, a.lift ?? 0, clip.top, t);
    b = keys[0]!;
    span = 1 - a.t + b.t;
  } else span = b.t - a.t;
  if (u < a.t) u += 1;
  const k = easing[a.ease ?? 'inout'](span > 0 ? (u - a.t) / span : 0);
  const joints: Record<string, Turn> = {};
  for (const name of new Set([...Object.keys(a.pose), ...Object.keys(b.pose)])) {
    const p = a.pose[name] ?? [0, 0, 0];
    const q = b.pose[name] ?? [0, 0, 0];
    joints[name] = [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
  }
  const lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * k;
  return toFrame(joints, lift, clip.top, t);
}

function toFrame(
  joints: Record<string, Turn>,
  lift: number,
  top: Clip | undefined,
  t: number,
): Frame {
  const out: Record<string, Turn> = {};
  for (const [n, v] of Object.entries(joints)) out[n] = [v[0] * RAD, v[1] * RAD, v[2] * RAD];
  if (top) Object.assign(out, sample(top, t).joints);
  return { joints: out, lift };
}

/** Mix two frames: 0 is all `a`, 1 all `b`; `only` keeps the mix to some joints (and no lift). */
export function blend(a: Frame, b: Frame, w: number, only?: (joint: string) => boolean): Frame {
  if (w <= 0) return a;
  if (w >= 1 && !only) return b;
  const joints: Record<string, Turn> = { ...a.joints };
  for (const name of new Set([...Object.keys(a.joints), ...Object.keys(b.joints)])) {
    if (only && !only(name)) continue;
    const p = a.joints[name] ?? [0, 0, 0];
    const q = b.joints[name] ?? [0, 0, 0];
    joints[name] = [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w, p[2] + (q[2] - p[2]) * w];
  }
  return { joints, lift: only ? a.lift : a.lift + (b.lift - a.lift) * w };
}

/** the arms, body and head: what a cast or a flinch moves while the legs keep walking */
export const upperBody = (joint: string) => !/Leg|Foot|Hips|Root/.test(joint);

// ---------- the poses ----------

/** standing easy with the pipe held low in the right hand */
const READY = {
  Spine: [4, 0, 0],
  Neck: [-3, 0, 0],
  UpperArm_R: [-14, 0, -10],
  LowerArm_R: [-48, 0, 0],
  Hand_R: [10, 0, 0],
  Pipe: [38, -14, 0],
  UpperArm_L: [4, 0, 9],
  LowerArm_L: [-16, 0, 0],
  UpperLeg_L: [-4, 0, 3],
  LowerLeg_L: [5, 0, 0],
  UpperLeg_R: [3, 0, -3],
  LowerLeg_R: [5, 0, 0],
} satisfies Record<string, Turn>;

/** feet apart, knees soft, weight forward: ready to swing */
const STANCE = {
  Spine: [10, 0, 0],
  Neck: [-8, 0, 0],
  UpperLeg_L: [-16, 0, 6],
  LowerLeg_L: [20, 0, 0],
  UpperLeg_R: [12, 0, -6],
  LowerLeg_R: [16, 0, 0],
} satisfies Record<string, Turn>;

export const IDLE: Clip = {
  loop: true,
  keys: [
    { t: 0, pose: READY },
    {
      t: 0.5,
      pose: { ...READY, Chest: [-3, 0, 0], UpperArm_L: [6, 0, 11], UpperArm_R: [-16, 0, -12] },
    },
  ],
};

/** a walk's legs and body over one step (upright, as in the reference); the arms swing over the
 * whole cycle */
const WALK_LEGS = gait([
  {
    t: 0,
    pose: {
      Hips: [0, -8, 0],
      Spine: [2, 7, 0],
      Neck: [-1, -4, 0],
      UpperLeg_L: [-26, 0, 2],
      LowerLeg_L: [6, 0, 0],
      UpperLeg_R: [18, 0, -2],
      LowerLeg_R: [14, 0, 0],
    },
  },
  {
    t: 0.125,
    pose: {
      Hips: [0, -5, 0],
      Spine: [2, 4, 0],
      Neck: [-1, -2, 0],
      UpperLeg_L: [-16, 0, 2],
      LowerLeg_L: [22, 0, 0],
      UpperLeg_R: [26, 0, -2],
      LowerLeg_R: [38, 0, 0],
    },
  },
  {
    t: 0.25,
    pose: {
      Hips: [0, 0, 0],
      Spine: [2, 0, 0],
      Neck: [-1, 0, 0],
      UpperLeg_L: [0, 0, 2],
      LowerLeg_L: [8, 0, 0],
      UpperLeg_R: [-14, 0, -2],
      LowerLeg_R: [48, 0, 0],
    },
  },
  {
    t: 0.375,
    pose: {
      Hips: [0, 5, 0],
      Spine: [2, -4, 0],
      Neck: [-1, 2, 0],
      UpperLeg_L: [14, 0, 2],
      LowerLeg_L: [4, 0, 0],
      UpperLeg_R: [-28, 0, -2],
      LowerLeg_R: [24, 0, 0],
    },
  },
]);

// from the Flow reference walk (newgame/prompts/motion_reference.md ref_01): the pipe hand stays
// by the hip, elbow soft; the pipe points ahead, tipping down as the hand swings forward
const WALK_ARMS: Clip = {
  loop: true,
  keys: [
    {
      t: 0,
      pose: {
        UpperArm_L: [18, 0, 6],
        LowerArm_L: [-12, 0, 0],
        UpperArm_R: [-12, 0, -7],
        LowerArm_R: [-26, 0, 0],
        Hand_R: [10, 0, 0],
        Pipe: [34, -6, 0],
      },
    },
    {
      t: 0.5,
      pose: {
        UpperArm_L: [-20, 0, 6],
        LowerArm_L: [-30, 0, 0],
        UpperArm_R: [12, 0, -7],
        LowerArm_R: [-18, 0, 0],
        Hand_R: [10, 0, 0],
        Pipe: [4, -6, 0],
      },
    },
  ],
};

export const WALK = overlay(WALK_LEGS, WALK_ARMS);

const RUN_LEGS = gait([
  {
    t: 0,
    pose: {
      Hips: [0, -10, 0],
      Spine: [16, 12, 0],
      Neck: [-14, -6, 0],
      UpperLeg_L: [-36, 0, 2],
      LowerLeg_L: [16, 0, 0],
      UpperLeg_R: [26, 0, -2],
      LowerLeg_R: [52, 0, 0],
    },
  },
  {
    t: 0.1,
    pose: {
      Hips: [0, -7, 0],
      Spine: [18, 8, 0],
      Neck: [-15, -4, 0],
      UpperLeg_L: [-22, 0, 2],
      LowerLeg_L: [38, 0, 0],
      UpperLeg_R: [16, 0, -2],
      LowerLeg_R: [90, 0, 0],
    },
  },
  {
    t: 0.25,
    pose: {
      Hips: [0, 2, 0],
      Spine: [16, -2, 0],
      Neck: [-14, 1, 0],
      UpperLeg_L: [20, 0, 2],
      LowerLeg_L: [14, 0, 0],
      UpperLeg_R: [-56, 0, -2],
      LowerLeg_R: [100, 0, 0],
    },
  },
  {
    t: 0.375,
    lift: 0.07,
    pose: {
      Hips: [0, 8, 0],
      Spine: [15, -10, 0],
      Neck: [-13, 5, 0],
      UpperLeg_L: [34, 0, 2],
      LowerLeg_L: [70, 0, 0],
      UpperLeg_R: [-50, 0, -2],
      LowerLeg_R: [42, 0, 0],
    },
  },
]);

const RUN_ARMS: Clip = {
  loop: true,
  keys: [
    {
      t: 0,
      pose: {
        UpperArm_L: [36, 0, 10],
        LowerArm_L: [-80, 0, 0],
        UpperArm_R: [-42, 0, -12],
        LowerArm_R: [-92, 0, 0],
        Hand_R: [30, 0, 0],
        Pipe: [-12, -12, 0],
      },
    },
    {
      t: 0.5,
      pose: {
        UpperArm_L: [-38, 0, 10],
        LowerArm_L: [-96, 0, 0],
        UpperArm_R: [26, 0, -12],
        LowerArm_R: [-70, 0, 0],
        Hand_R: [20, 0, 0],
        Pipe: [62, -20, 0],
      },
    },
  ],
};

export const RUN = overlay(RUN_LEGS, RUN_ARMS);

/** a flat swing from the right across the body to the left */
export const STRIKE1: Clip = {
  loop: false,
  keys: [
    { t: 0, pose: { ...READY, ...STANCE } },
    {
      t: 0.24,
      ease: 'in',
      pose: {
        ...STANCE,
        Spine: [10, -34, 0],
        Chest: [0, -12, 0],
        Neck: [-8, 40, 0],
        UpperArm_R: [0, 0, -72],
        LowerArm_R: [-40, 0, 0],
        Hand_R: [20, 0, 0],
        Pipe: [-12, -140, 0],
        UpperArm_L: [-50, 0, 20],
        LowerArm_L: [-30, 0, 0],
        UpperLeg_L: [-24, 0, 6],
        LowerLeg_L: [26, 0, 0],
      },
    },
    {
      t: 0.4,
      ease: 'out',
      pose: {
        ...STANCE,
        Spine: [14, 14, 0],
        Chest: [0, 6, 0],
        Neck: [-10, -20, 0],
        UpperArm_R: [0, 66, -80],
        LowerArm_R: [-8, 0, 0],
        Hand_R: [20, 0, 0],
        Pipe: [-6, 14, 0],
        UpperArm_L: [10, 0, 26],
        LowerArm_L: [-60, 0, 0],
        UpperLeg_L: [-28, 0, 6],
        LowerLeg_L: [32, 0, 0],
      },
    },
    {
      t: 0.62,
      pose: {
        ...STANCE,
        Spine: [12, 40, 0],
        Chest: [0, 16, 0],
        Neck: [-10, -46, 0],
        UpperArm_R: [0, 96, -66],
        LowerArm_R: [-34, 0, 0],
        Hand_R: [20, 0, 0],
        Pipe: [12, 124, 0],
        UpperArm_L: [16, 0, 24],
        LowerArm_L: [-60, 0, 0],
        UpperLeg_L: [-26, 0, 6],
        LowerLeg_L: [30, 0, 0],
      },
    },
    { t: 1, pose: { ...READY, ...STANCE } },
  ],
};

/** and back again, backhand from the left out to the right */
export const STRIKE2: Clip = {
  loop: false,
  keys: [
    {
      t: 0,
      pose: {
        ...STANCE,
        Spine: [12, 38, 0],
        Chest: [0, 14, 0],
        Neck: [-10, -44, 0],
        UpperArm_R: [0, 96, -66],
        LowerArm_R: [-34, 0, 0],
        Pipe: [12, 118, 0],
        UpperArm_L: [16, 0, 24],
        LowerArm_L: [-60, 0, 0],
      },
    },
    {
      t: 0.24,
      ease: 'in',
      pose: {
        ...STANCE,
        Spine: [12, 44, 0],
        Chest: [0, 14, 0],
        Neck: [-10, -50, 0],
        UpperArm_R: [-20, 110, -56],
        LowerArm_R: [-70, 0, 0],
        Pipe: [-16, 146, 0],
        UpperArm_L: [18, 0, 26],
        LowerArm_L: [-50, 0, 0],
      },
    },
    {
      t: 0.4,
      ease: 'out',
      pose: {
        ...STANCE,
        Spine: [14, -24, 0],
        Chest: [0, -10, 0],
        Neck: [-10, 30, 0],
        UpperArm_R: [0, 50, -82],
        LowerArm_R: [-6, 0, 0],
        Pipe: [-6, -14, 0],
        UpperArm_L: [-40, 0, 24],
        LowerArm_L: [-40, 0, 0],
        UpperLeg_R: [4, 0, -6],
        LowerLeg_R: [24, 0, 0],
      },
    },
    {
      t: 0.62,
      pose: {
        ...STANCE,
        Spine: [12, -40, 0],
        Chest: [0, -14, 0],
        Neck: [-10, 46, 0],
        UpperArm_R: [0, 10, -76],
        LowerArm_R: [-20, 0, 0],
        Pipe: [12, -124, 0],
        UpperArm_L: [-30, 0, 22],
        LowerArm_L: [-50, 0, 0],
      },
    },
    { t: 1, pose: { ...READY, ...STANCE } },
  ],
};

/** both hands high, a little hop, and down hard */
export const STRIKE3: Clip = {
  loop: false,
  keys: [
    { t: 0, pose: { ...READY, ...STANCE } },
    {
      t: 0.3,
      ease: 'in',
      lift: 0.12,
      pose: {
        Spine: [-14, 0, 0],
        Neck: [10, 0, 0],
        UpperArm_R: [-168, 0, -12],
        LowerArm_R: [-40, 0, 0],
        Hand_R: [40, 0, 0],
        Pipe: [-150, -6, 0],
        UpperArm_L: [-168, 0, 12],
        LowerArm_L: [-40, 0, 0],
        UpperLeg_L: [-36, 0, 6],
        LowerLeg_L: [60, 0, 0],
        UpperLeg_R: [6, 0, -6],
        LowerLeg_R: [40, 0, 0],
      },
    },
    {
      t: 0.42,
      ease: 'out',
      pose: {
        Spine: [30, 0, 0],
        Neck: [-24, 0, 0],
        UpperArm_R: [-100, 0, -6],
        LowerArm_R: [-6, 0, 0],
        Hand_R: [60, 0, 0],
        Pipe: [26, 0, 0],
        UpperArm_L: [-96, 0, 6],
        LowerArm_L: [-10, 0, 0],
        UpperLeg_L: [-34, 0, 8],
        LowerLeg_L: [44, 0, 0],
        UpperLeg_R: [24, 0, -8],
        LowerLeg_R: [24, 0, 0],
      },
    },
    {
      t: 0.72,
      pose: {
        Spine: [26, 0, 0],
        Neck: [-22, 0, 0],
        UpperArm_R: [-90, 0, -6],
        LowerArm_R: [-10, 0, 0],
        Hand_R: [60, 0, 0],
        Pipe: [34, 0, 0],
        UpperArm_L: [-86, 0, 6],
        LowerArm_L: [-14, 0, 0],
        UpperLeg_L: [-32, 0, 8],
        LowerLeg_L: [42, 0, 0],
        UpperLeg_R: [22, 0, -8],
        LowerLeg_R: [24, 0, 0],
      },
    },
    { t: 1, pose: { ...READY, ...STANCE } },
  ],
};

/** low and forward, arms swept back */
export const DASH: Clip = {
  loop: false,
  keys: [
    { t: 0, pose: { ...READY, ...STANCE } },
    {
      t: 0.3,
      pose: {
        Spine: [42, 0, 0],
        Neck: [-32, 0, 0],
        UpperArm_R: [44, 0, -22],
        LowerArm_R: [-30, 0, 0],
        Hand_R: [0, 0, 0],
        Pipe: [150, -16, 0],
        UpperArm_L: [44, 0, 22],
        LowerArm_L: [-30, 0, 0],
        UpperLeg_L: [-46, 0, 4],
        LowerLeg_L: [76, 0, 0],
        UpperLeg_R: [36, 0, -4],
        LowerLeg_R: [54, 0, 0],
      },
    },
    {
      t: 1,
      pose: {
        Spine: [34, 0, 0],
        Neck: [-26, 0, 0],
        UpperArm_R: [30, 0, -18],
        LowerArm_R: [-36, 0, 0],
        Pipe: [140, -16, 0],
        UpperArm_L: [30, 0, 18],
        LowerArm_L: [-36, 0, 0],
        UpperLeg_L: [-30, 0, 4],
        LowerLeg_L: [50, 0, 0],
        UpperLeg_R: [22, 0, -4],
        LowerLeg_R: [40, 0, 0],
      },
    },
  ],
};

/** the pipe held across in front with both hands, knees bent */
export const GUARD: Clip = {
  loop: false,
  keys: [
    {
      t: 0,
      pose: {
        Spine: [12, -10, 0],
        Neck: [-10, 10, 0],
        UpperArm_R: [-62, 0, 24],
        LowerArm_R: [-74, 0, 0],
        Hand_R: [-10, -70, 0],
        Pipe: [-6, 84, 0],
        UpperArm_L: [-58, 0, -18],
        LowerArm_L: [-82, 0, 0],
        UpperLeg_L: [-22, 0, 8],
        LowerLeg_L: [36, 0, 0],
        UpperLeg_R: [16, 0, -8],
        LowerLeg_R: [32, 0, 0],
      },
    },
  ],
};

/** knocked back a step by a blow */
export const HURT: Clip = {
  loop: false,
  keys: [
    { t: 0, pose: { ...READY } },
    {
      t: 0.3,
      pose: {
        Spine: [-18, 8, 0],
        Neck: [14, 0, 0],
        UpperArm_R: [-30, 0, -34],
        LowerArm_R: [-40, 0, 0],
        Pipe: [56, -34, 0],
        UpperArm_L: [-26, 0, 34],
        LowerArm_L: [-30, 0, 0],
        UpperLeg_L: [6, 0, 4],
        LowerLeg_L: [16, 0, 0],
        UpperLeg_R: [14, 0, -4],
        LowerLeg_R: [10, 0, 0],
      },
    },
    { t: 1, pose: { ...READY } },
  ],
};

/** the free hand held up to gather a ball of fire or water */
export const CAST: Clip = {
  loop: false,
  keys: [
    {
      t: 0,
      pose: {
        ...READY,
        Spine: [6, 14, 0],
        Neck: [-6, -14, 0],
        UpperArm_L: [-84, 0, 6],
        LowerArm_L: [-22, 0, 0],
      },
    },
  ],
};

/** sitting on the bike, hands on the bars */
export const RIDE: Clip = {
  loop: false,
  keys: [
    {
      t: 0,
      pose: {
        Spine: [16, 0, 0],
        Neck: [-12, 0, 0],
        UpperArm_R: [-58, 0, -10],
        LowerArm_R: [-24, 0, 0],
        UpperArm_L: [-58, 0, 10],
        LowerArm_L: [-24, 0, 0],
        UpperLeg_L: [-82, 0, 8],
        LowerLeg_L: [86, 0, 0],
        UpperLeg_R: [-82, 0, -8],
        LowerLeg_R: [86, 0, 0],
      },
    },
  ],
};
