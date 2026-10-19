// The camera's numbers (config/camera.json) and the little maths it needs: where it sits for
// each view, and turning towards a chosen target. No three.js here.

import cameraJson from '../config/camera.json';
import { ConfigError, num, obj } from './config';

export type CameraMode = 'back' | 'shoulder';
export const CAMERA_MODES: CameraMode[] = ['back', 'shoulder'];

export interface CameraRig {
  distance: number;
  bike: number;
  side: number;
}

export interface CameraSpec {
  back: CameraRig;
  shoulder: CameraRig;
  targetHeight: number;
  pitch: { start: number; min: number; max: number };
  lock: { rate: number; range: number; idle: number };
  follow: { rate: number; idle: number; back: number };
}

export function readCamera(raw: unknown): CameraSpec {
  const root = obj(raw, 'camera.json');
  const rig = (key: 'back' | 'shoulder'): CameraRig => {
    const w = `camera.${key}`;
    const o = obj(root[key], w);
    return {
      distance: num(o, 'distance', w, 0.5),
      bike: num(o, 'bike', w, 0.5),
      side: num(o, 'side', w),
    };
  };
  const pitch = obj(root.pitch, 'camera.pitch');
  const lock = obj(root.lock, 'camera.lock');
  const follow = obj(root.follow, 'camera.follow');
  const spec: CameraSpec = {
    back: rig('back'),
    shoulder: rig('shoulder'),
    targetHeight: num(root, 'targetHeight', 'camera', 0),
    pitch: {
      start: num(pitch, 'start', 'camera.pitch'),
      min: num(pitch, 'min', 'camera.pitch'),
      max: num(pitch, 'max', 'camera.pitch'),
    },
    lock: {
      rate: num(lock, 'rate', 'camera.lock'),
      range: num(lock, 'range', 'camera.lock', 1),
      idle: num(lock, 'idle', 'camera.lock'),
    },
    follow: {
      rate: num(follow, 'rate', 'camera.follow'),
      idle: num(follow, 'idle', 'camera.follow'),
      back: num(follow, 'back', 'camera.follow'),
    },
  };
  if (spec.back.side > 0.9 || spec.shoulder.side > 0.9)
    throw new ConfigError('camera: side is a share of half the screen, expected 0..0.9');
  if (spec.pitch.min > spec.pitch.start || spec.pitch.start > spec.pitch.max)
    throw new ConfigError('camera.pitch: expected min ≤ start ≤ max');
  return spec;
}

export const CAMERA = readCamera(cameraJson);

/** How far behind the camera sits, and how far left of centre the player stands (a share). */
export function rigFor(
  mode: CameraMode,
  riding: boolean,
  spec: CameraSpec = CAMERA,
): { distance: number; side: number } {
  const r = spec[mode];
  return { distance: riding ? r.bike : r.distance, side: r.side };
}

/**
 * Metres to the right the camera must sit so the player stands `share` of the half-screen to the
 * left of centre, for a camera `distance` metres behind them, with a vertical field of view of
 * `fovDeg` degrees on a screen `aspect` (width over height) wide. Never more than `max`.
 */
export function sideMetres(
  share: number,
  distance: number,
  fovDeg: number,
  aspect: number,
  max = 1.6,
): number {
  const halfWidth = Math.tan((fovDeg * Math.PI) / 360) * aspect;
  return Math.min(max, share * distance * halfWidth);
}

/** An angle brought into -π..π. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/**
 * Turn the camera's heading a little towards a target. yaw is the camera's heading (it looks
 * along (-sin yaw, -cos yaw)); a target out of range, or already in front, leaves it alone.
 */
export function lockYaw(
  yaw: number,
  from: { x: number; z: number },
  to: { x: number; z: number },
  dt: number,
  lock = CAMERA.lock,
): number {
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d > lock.range || d < 1) return yaw;
  const delta = wrapAngle(Math.atan2(-dx, -dz) - yaw);
  if (Math.abs(delta) < 0.02) return yaw;
  return yaw + delta * Math.min(1, dt * lock.rate);
}

/**
 * The camera that follows by itself: while the player walks (forward and right are the stick, in
 * -1..1, relative to the camera), the camera's heading swings a little towards the way they go,
 * so it ends up behind them without being dragged. Pushing sideways turns gently round; walking
 * back towards the camera (forward below -back) leaves it alone, so it never spins round.
 */
export function followYaw(
  yaw: number,
  forward: number,
  right: number,
  dt: number,
  follow = CAMERA.follow,
): number {
  const push = Math.hypot(forward, right);
  if (push < 0.05 || forward < -follow.back) return yaw;
  // the way the player goes, as a camera heading: the stick's angle off straight ahead
  const off = Math.atan2(right, Math.max(forward, 0));
  return yaw - off * Math.min(1, dt * follow.rate * Math.min(1, push));
}
