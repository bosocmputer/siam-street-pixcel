import type { Point } from './geo';

export interface CombatPose {
  position: Point;
  yaw: number;
  pitch: number;
  blocking: boolean;
}
export type ObstacleCheck = (p: Point, radius?: number) => boolean;
export type SlimeMode = 'idle' | 'chase' | 'windup' | 'recover' | 'stunned' | 'dead';
export interface SlimeState {
  id: number;
  position: Point;
  home: Point;
  hp: number;
  maxHp: number;
  mode: SlimeMode;
  until: number;
  hitAt: number;
  diedAt: number;
}
export interface CombatEvent {
  kind: 'swing' | 'hit' | 'kill' | 'hurt' | 'block' | 'level' | 'respawn';
  position: Point;
  amount: number;
  slimeId: number;
}

export const SWORD = { range: 3.05, cooldown: 0.6, windup: 0.16, stamina: 12 };
const copy = (p: Point): Point => [...p];
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function clearSight(a: Point, b: Point, blocked: ObstacleCheck): boolean {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 0.2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocked([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 0.05)) return false;
  }
  return true;
}
export function inSwordArc(pose: CombatPose, target: Point): boolean {
  const dx = target[0] - pose.position[0],
    dz = target[1] - pose.position[1];
  const d = Math.hypot(dx, dz);
  if (d > SWORD.range || pose.pitch > 0.65 || pose.pitch < -1.2) return false;
  return d < 0.25 || (dx * -Math.sin(pose.yaw) + dz * -Math.cos(pose.yaw)) / d > 0.48;
}

/** Local, deterministic combat simulation. A future networked game must run this on a server. */
export class CombatSimulation {
  time = 0;
  kills = 0;
  lastSwingAt = -1000;
  hurtAt = -1000;
  player = { hp: 100, maxHp: 100, stamina: 100, level: 1, xp: 0, damage: 26 };
  slimes: SlimeState[];
  private events: CombatEvent[] = [];
  private impactAt: number | null = null;
  private immuneUntil = 0;

  constructor(private spawns: Point[]) {
    this.slimes = spawns.map((home, id) => ({
      id,
      position: copy(home),
      home: copy(home),
      hp: 70,
      maxHp: 70,
      mode: 'idle',
      until: 0,
      hitAt: -1000,
      diedAt: -1000,
    }));
  }
  reset(): void {
    const fresh = new CombatSimulation(this.spawns);
    this.time = 0;
    this.kills = 0;
    this.lastSwingAt = -1000;
    this.hurtAt = -1000;
    this.player = fresh.player;
    this.slimes = fresh.slimes;
    this.events = [];
    this.impactAt = null;
    this.immuneUntil = 0;
  }
  attack(pose: CombatPose, _blocked: ObstacleCheck): boolean {
    if (
      this.player.hp <= 0 ||
      pose.blocking ||
      this.time - this.lastSwingAt < SWORD.cooldown ||
      this.player.stamina < SWORD.stamina
    )
      return false;
    this.lastSwingAt = this.time;
    this.impactAt = this.time + SWORD.windup;
    this.player.stamina -= SWORD.stamina;
    this.events.push({ kind: 'swing', position: copy(pose.position), amount: 0, slimeId: -1 });
    return true;
  }
  drainEvents(): CombatEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }
  target(pose: CombatPose, blocked: ObstacleCheck): SlimeState | undefined {
    return this.slimes
      .filter(
        (s) =>
          s.mode !== 'dead' &&
          inSwordArc(pose, s.position) &&
          clearSight(pose.position, s.position, blocked),
      )
      .sort((a, b) => distance(a.position, pose.position) - distance(b.position, pose.position))[0];
  }
  step(seconds: number, pose: CombatPose, blocked: ObstacleCheck): void {
    if (!Number.isFinite(seconds) || seconds <= 0 || this.player.hp <= 0) return;
    const dt = Math.min(seconds, 0.1);
    this.time += dt;
    this.player.stamina = Math.min(100, this.player.stamina + dt * (pose.blocking ? 4 : 18));
    if (this.impactAt !== null && this.time >= this.impactAt) {
      this.impactAt = null;
      for (const slime of this.slimes) {
        if (
          slime.mode === 'dead' ||
          !inSwordArc(pose, slime.position) ||
          !clearSight(pose.position, slime.position, blocked)
        )
          continue;
        slime.hp = Math.max(0, slime.hp - this.player.damage);
        slime.hitAt = this.time;
        this.events.push({
          kind: 'hit',
          position: copy(slime.position),
          amount: this.player.damage,
          slimeId: slime.id,
        });
        if (slime.hp === 0) {
          slime.mode = 'dead';
          slime.diedAt = this.time;
          slime.until = this.time + 8;
          this.kills++;
          this.player.xp += 20;
          this.events.push({
            kind: 'kill',
            position: copy(slime.position),
            amount: 20,
            slimeId: slime.id,
          });
          if (this.player.xp >= this.player.level * 60) {
            this.player.xp -= this.player.level * 60;
            this.player.level++;
            this.player.damage += 4;
            this.player.maxHp += 10;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
            this.events.push({
              kind: 'level',
              position: copy(pose.position),
              amount: this.player.level,
              slimeId: -1,
            });
          }
        } else {
          slime.mode = 'stunned';
          slime.until = this.time + 0.4;
        }
      }
    }
    for (const slime of this.slimes) {
      if (slime.mode === 'dead') {
        if (this.time >= slime.until) {
          slime.position = copy(slime.home);
          slime.hp = slime.maxHp;
          slime.mode = 'idle';
          slime.hitAt = -1000;
          this.events.push({
            kind: 'respawn',
            position: copy(slime.position),
            amount: 0,
            slimeId: slime.id,
          });
        }
        continue;
      }
      if (slime.mode === 'windup') {
        if (this.time >= slime.until) {
          if (
            distance(slime.position, pose.position) < 1.85 &&
            this.time >= this.immuneUntil &&
            clearSight(slime.position, pose.position, blocked)
          ) {
            const defended =
              pose.blocking && this.player.stamina >= 14 && inSwordArc(pose, slime.position);
            const damage = defended ? 3 : 12;
            if (defended) this.player.stamina -= 14;
            this.player.hp = Math.max(0, this.player.hp - damage);
            this.immuneUntil = this.time + 0.6;
            this.hurtAt = this.time;
            this.events.push({
              kind: defended ? 'block' : 'hurt',
              position: copy(pose.position),
              amount: damage,
              slimeId: slime.id,
            });
          }
          slime.mode = 'recover';
          slime.until = this.time + 1.05;
        }
        continue;
      }
      if (slime.mode === 'recover' || slime.mode === 'stunned') {
        if (this.time >= slime.until) slime.mode = 'idle';
        continue;
      }
      const d = distance(slime.position, pose.position);
      const leashed = distance(slime.home, pose.position) > 24;
      if (!leashed && d < 1.5 && clearSight(slime.position, pose.position, blocked)) {
        slime.mode = 'windup';
        slime.until = this.time + 0.65;
        continue;
      }
      const destination = leashed ? slime.home : pose.position;
      if ((!leashed && d > 12) || (leashed && distance(slime.position, slime.home) < 0.15)) {
        slime.mode = 'idle';
        continue;
      }
      slime.mode = 'chase';
      const dx = destination[0] - slime.position[0],
        dz = destination[1] - slime.position[1];
      const length = Math.hypot(dx, dz);
      if (length < 0.01) continue;
      const speed = dt * 1.5;
      const x: Point = [slime.position[0] + (dx / length) * speed, slime.position[1]];
      if (!blocked(x, 0.62)) slime.position[0] = x[0];
      const z: Point = [slime.position[0], slime.position[1] + (dz / length) * speed];
      if (!blocked(z, 0.62)) slime.position[1] = z[1];
    }
  }
}
