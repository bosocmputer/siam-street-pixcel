import * as THREE from 'three';
import type { Collider } from './collide';
import type { Fx, Orb } from './fx';
import type { SlimeHerd } from './slime';
import {
  HIT_RADIUS,
  SKILLS,
  chooseTarget,
  launch,
  readyCooldowns,
  spent,
  splashed,
  stepShot,
  tickCooldowns,
  useSkill,
  type Element,
  type Shot,
  type Vec3,
} from '@newgame/rpg-core';

/** height of the paved square, where bursts and stains sit */
const GROUND = 0.04;

const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** a ball being gathered in the hand */
interface Charging {
  element: Element;
  hand: () => Vec3;
  /** where to throw if there is no target, radians, 0 = +z */
  heading: number;
  orb: Orb;
  t: number;
}

/** the colour a slime glows when hit */
const HIT_COLOR: Record<Element, number> = { fire: 0xffa040, water: 0xd8f6ff };

interface Flying {
  shot: Shot;
  orb: Orb;
  /** where the target last was, kept if it melts away mid-flight */
  aim: Vec3 | null;
  time: number;
}

export interface HitEvent {
  element: Element;
  slime: number;
  damage: number;
  defeated: boolean;
  /** where it landed, map metres */
  at: Vec3;
}

/** Targets, cooldowns and the shots in the air. */
export class Combat {
  readonly cooldowns = readyCooldowns();
  target: number | null = null;
  private flying: Flying[] = [];
  private charging: Charging | null = null;
  private marker = new THREE.Group();
  private ring: THREE.Mesh;
  private arrow: THREE.Mesh;
  private time = 0;

  constructor(
    private fx: Fx,
    private herd: SlimeHerd,
    private collider: Collider,
    parent: THREE.Object3D,
  ) {
    // a dashed ring under the chosen slime and a small arrow over it
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.strokeStyle = '#fff';
    g.lineWidth = 9;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.arc(64, 64, 56, (i * Math.PI) / 2 + 0.25, ((i + 1) * Math.PI) / 2 - 0.25);
      g.stroke();
    }
    this.ring = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(c),
        color: 0xffc93d,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -6,
      }),
    );
    this.ring.renderOrder = 1;
    this.arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.3, 4).rotateX(Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xffc93d }),
    );
    this.marker.add(this.ring, this.arrow);
    this.marker.visible = false;
    parent.add(this.marker);
  }

  /** The slimes as the target picker sees them. */
  private candidates(): { x: number; z: number; alive: boolean }[] {
    return this.herd.state();
  }

  /** Choose the next slime in reach, nearest in front first, skipping the current one. */
  cycleTarget(player: { x: number; z: number; heading: number }): void {
    const list = this.candidates().map((s, i) => ({ ...s, alive: s.alive && i !== this.target }));
    this.target = chooseTarget(player, list) ?? this.target;
  }

  /** Keep the chosen slime if it can still be hit, else pick the best one in reach. */
  ensureTarget(player: { x: number; z: number; heading: number }): void {
    if (this.target !== null && !this.herd.aimPoint(this.target)) this.target = null;
    if (this.target === null) this.target = chooseTarget(player, this.candidates());
  }

  /**
   * Start a skill: the ball is gathered in the hand for a moment, then flies. `hand` tells where
   * the hand is now (it moves with the walker); `player.heading` (0 = +z) is where to throw with
   * no target. Returns false while the skill cools down or another one is being gathered.
   */
  cast(
    element: Element,
    hand: () => Vec3,
    player: { x: number; z: number; heading: number },
  ): boolean {
    if (this.charging) return false;
    this.ensureTarget(player);
    if (!useSkill(this.cooldowns, element)) return false;
    const orb = this.fx.orb(element);
    this.fx.addOrb(orb);
    this.charging = { element, hand, heading: player.heading, orb, t: 0 };
    return true;
  }

  /** Where the walker should face to throw at the target, or null with no target. */
  facing(): Vec3 | null {
    return this.target !== null ? this.herd.aimPoint(this.target) : null;
  }

  /** Is a ball being gathered in the hand right now? */
  get gathering(): boolean {
    return this.charging !== null;
  }

  update(dt: number): HitEvent[] {
    this.time += dt;
    tickCooldowns(this.cooldowns, dt);
    this.gather(dt);
    const hits: HitEvent[] = [];
    this.flying = this.flying.filter((f) => {
      f.time += dt;
      const s = f.shot;
      if (s.target !== null) f.aim = this.herd.aimPoint(s.target) ?? f.aim;
      const from = s.travelled;
      // small steps so a fast shot cannot skip through a slime
      const steps = Math.max(1, Math.ceil((SKILLS[s.element].speed * dt) / 0.25));
      for (let n = 0; n < steps; n++) {
        stepShot(s, dt / steps, f.aim);
        const hit = this.touching(s.pos);
        if (hit !== null) {
          const spec = SKILLS[s.element];
          const result = this.herd.hit(
            hit,
            spec.damage,
            s.pos[0] - s.dir[0],
            s.pos[2] - s.dir[2],
            spec.knock,
            HIT_COLOR[s.element],
          );
          this.fx.impact(s.element, s.pos, GROUND, s.dir);
          hits.push(this.hitEvent(s.element, hit, spec.damage, result, s.pos));
          this.burst(s, hit, hits);
          return this.land(f);
        }
        const aimGone = s.target !== null && !this.herd.aimPoint(s.target);
        const atAim =
          f.aim && aimGone && Math.hypot(s.pos[0] - f.aim[0], s.pos[2] - f.aim[2]) < 0.3;
        if (s.pos[1] < 0.1 || this.collider.solid(s.pos[0], s.pos[2]) || atAim) {
          const low = s.pos[1] < 1.5;
          this.fx.impact(s.element, s.pos, GROUND, s.dir, !low);
          if (low) this.burst(s, null, hits);
          return this.land(f);
        }
        if (spent(s)) {
          this.fx.impact(s.element, s.pos, GROUND, s.dir, true);
          return this.land(f);
        }
      }
      f.orb.place(s.pos, s.dir, f.time, 1, true);
      this.fx.trail(f.orb, s.element, s.pos, s.dir, s.travelled - from, dt);
      return true;
    });
    this.updateMarker();
    return hits;
  }

  /** Grow the ball in the hand, and let it go once it is ready. */
  private gather(dt: number): void {
    const c = this.charging;
    if (!c) return;
    c.t += dt;
    const spec = SKILLS[c.element];
    const t = Math.min(1, c.t / spec.charge);
    const at = this.fx.chargePos(c.element, c.hand(), t, this.time);
    const aim = this.target !== null ? this.herd.aimPoint(this.target) : null;
    const toAim = aim ? unit([aim[0] - at[0], aim[1] - at[1], aim[2] - at[2]]) : null;
    const grow = 1 - (1 - t) * (1 - t);
    c.orb.place(at, toAim ?? [Math.sin(c.heading), 0, Math.cos(c.heading)], this.time, grow, false);
    this.fx.gather(c.orb, c.element, at, t, dt);
    if (t < 1) return;
    const shot = launch(c.element, at, c.heading, aim, this.target);
    this.fx.release(c.element, at, shot.dir);
    this.flying.push({ shot, orb: c.orb, aim, time: 0 });
    this.charging = null;
  }

  /** A fire burst also scorches the slimes standing close by. */
  private burst(s: Shot, direct: number | null, hits: HitEvent[]): void {
    const splash = SKILLS[s.element].splash;
    if (!splash) return;
    for (const i of splashed(s.pos, this.candidates(), splash.radius, direct)) {
      const result = this.herd.hit(i, splash.damage, s.pos[0], s.pos[2], 0.7, HIT_COLOR[s.element]);
      if (result !== 'ignored')
        hits.push(this.hitEvent(s.element, i, splash.damage, result, s.pos));
    }
  }

  private hitEvent(
    element: Element,
    slime: number,
    damage: number,
    result: 'hurt' | 'defeated' | 'ignored',
    pos: Vec3,
  ): HitEvent {
    const defeated = result === 'defeated';
    const where = this.herd.state()[slime];
    const at: Vec3 = where ? [where.x, pos[1], where.z] : [...pos];
    if (defeated) {
      this.fx.melt(at, GROUND);
      if (this.target === slime) this.target = null;
    }
    return { element, slime, damage, defeated, at };
  }

  private land(f: Flying): false {
    this.fx.removeOrb(f.orb);
    return false;
  }

  /** The first slime a shot at `p` is touching. */
  private touching(p: Vec3): number | null {
    for (let i = 0; i < this.herd.count; i++) {
      const a = this.herd.aimPoint(i);
      if (a && Math.hypot(p[0] - a[0], (p[1] - a[1]) * 0.8, p[2] - a[2]) < HIT_RADIUS) return i;
    }
    return null;
  }

  private updateMarker(): void {
    const a = this.target !== null ? this.herd.aimPoint(this.target) : null;
    this.marker.visible = a !== null;
    if (!a) return;
    this.marker.position.set(a[0], 0, a[2]);
    this.ring.position.y = 0.07;
    this.ring.scale.setScalar(1.5 + Math.sin(this.time * 5) * 0.06);
    this.ring.rotation.y = this.time * 1.2;
    this.arrow.position.y = this.herd.height + 0.45 + Math.abs(Math.sin(this.time * 4)) * 0.18;
    this.arrow.rotation.y = this.time * 2;
  }

  /** Shots being gathered or in the air, for tests. */
  get inFlight(): number {
    return this.flying.length + (this.charging ? 1 : 0);
  }
}
