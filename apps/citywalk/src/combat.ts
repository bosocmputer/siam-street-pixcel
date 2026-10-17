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
  stepShot,
  tickCooldowns,
  useSkill,
  type Element,
  type Shot,
  type Vec3,
} from './skills';

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

  /**
   * Use a skill. `hand` is where it leaves from and `heading` (0 = +z) where the walker looks,
   * both in map metres. Returns false while the skill is cooling down.
   */
  /** Keep the chosen slime if it can still be hit, else pick the best one in reach. */
  ensureTarget(player: { x: number; z: number; heading: number }): void {
    if (this.target !== null && !this.herd.aimPoint(this.target)) this.target = null;
    if (this.target === null) this.target = chooseTarget(player, this.candidates());
  }

  cast(element: Element, hand: Vec3, player: { x: number; z: number; heading: number }): boolean {
    this.ensureTarget(player);
    if (!useSkill(this.cooldowns, element)) return false;
    const aim = this.target !== null ? this.herd.aimPoint(this.target) : null;
    const shot = launch(element, hand, player.heading, aim, this.target);
    const orb = this.fx.orb(element);
    this.fx.addOrb(orb);
    orb.place(shot.pos, shot.dir, 0);
    this.fx.cast(element, hand);
    this.flying.push({ shot, orb, aim, time: 0 });
    return true;
  }

  /** Where the walker should face to throw at the target, or null with no target. */
  facing(): Vec3 | null {
    return this.target !== null ? this.herd.aimPoint(this.target) : null;
  }

  update(dt: number): HitEvent[] {
    this.time += dt;
    tickCooldowns(this.cooldowns, dt);
    const hits: HitEvent[] = [];
    this.flying = this.flying.filter((f) => {
      f.time += dt;
      const s = f.shot;
      if (s.target !== null) f.aim = this.herd.aimPoint(s.target) ?? f.aim;
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
          this.fx.impact(s.element, s.pos, 0.04);
          if (result === 'defeated') {
            this.fx.melt(s.pos, 0.04);
            if (this.target === hit) this.target = null;
          }
          hits.push({
            element: s.element,
            slime: hit,
            damage: spec.damage,
            defeated: result === 'defeated',
            at: [...s.pos],
          });
          return this.land(f);
        }
        const aimGone = s.target !== null && !this.herd.aimPoint(s.target);
        const atAim =
          f.aim && aimGone && Math.hypot(s.pos[0] - f.aim[0], s.pos[2] - f.aim[2]) < 0.3;
        if (s.pos[1] < 0.1 || this.collider.solid(s.pos[0], s.pos[2]) || atAim) {
          this.fx.impact(s.element, s.pos, 0.04, s.pos[1] < 1.5);
          return this.land(f);
        }
        if (spent(s)) {
          this.fx.impact(s.element, s.pos, 0.04, false);
          return this.land(f);
        }
      }
      f.orb.place(s.pos, s.dir, f.time);
      this.fx.trail(f.orb, s.element, s.pos, s.dir, dt, this.time);
      return true;
    });
    this.updateMarker();
    return hits;
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

  /** Shots in the air, for tests. */
  get inFlight(): number {
    return this.flying.length;
  }
}
