import { CombatSimulation, type CombatEvent, type CombatPose, type ObstacleCheck } from './combat';
import type { Point } from './geo';

export interface FarmBot {
  id: number;
  position: Point;
  yaw: number;
  moving: boolean;
  targetId: number | null;
  combat: CombatSimulation;
  lifetimeKills: number;
  reviveAt: number;
  generation: number;
  events: CombatEvent[];
}
const separation = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export const botPose = (bot: FarmBot): CombatPose => ({
  position: bot.position,
  yaw: bot.yaw,
  pitch: -0.16,
  blocking: false,
});

/** All actors share enemies. Actor abilities run separately; enemy AI runs exactly once. */
export class CrowdSimulation {
  readonly world: CombatSimulation;
  bots: FarmBot[] = [];
  totals = { kills: 0, swings: 0, casts: 0, deaths: 0 };
  constructor(
    readonly center: Point,
    private safe: (p: Point) => Point,
  ) {
    const spawns: Point[] = Array.from({ length: 30 }, (_, i) =>
      this.safe([
        center[0] - 9 + (i % 6) * 3,
        center[1] - 12 + Math.floor(i / 6) * 6 + (i % 2) * 0.7,
      ]),
    );
    this.world = new CombatSimulation(spawns);
  }
  configure(count: 1 | 10): void {
    this.world.reset();
    this.totals = { kills: 0, swings: 0, casts: 0, deaths: 0 };
    this.bots = Array.from({ length: count }, (_, id) => {
      const combat = new CombatSimulation([]);
      combat.slimes = this.world.slimes;
      return {
        id,
        combat,
        position: this.spawn(id),
        yaw: Math.PI / 2,
        moving: false,
        targetId: null,
        lifetimeKills: 0,
        reviveAt: 0,
        generation: 0,
        events: [],
      };
    });
  }
  private spawn(id: number): Point {
    return this.safe([
      this.center[0] + 10 + (id % 2) * 2,
      this.center[1] - 12 + Math.floor(id / 2) * 6,
    ]);
  }
  step(seconds: number, blocked: ObstacleCheck): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    const dt = Math.min(0.1, seconds);
    for (const bot of this.bots) {
      bot.events = [];
      bot.moving = false;
      if (bot.combat.player.hp <= 0) {
        if (!bot.reviveAt) {
          bot.reviveAt = this.world.time + 2;
          this.totals.deaths++;
        }
        if (this.world.time < bot.reviveAt) continue;
        bot.combat.reset();
        bot.combat.slimes = this.world.slimes;
        bot.combat.time = this.world.time;
        bot.position = this.spawn(bot.id);
        bot.targetId = null;
        bot.reviveAt = 0;
        bot.generation++;
      }
      let target = this.world.slimes.find((s) => s.id === bot.targetId && s.mode !== 'dead');
      if (!target) {
        let best = Infinity;
        for (const slime of this.world.slimes) {
          if (slime.mode === 'dead') continue;
          const assigned = this.bots.filter(
            (other) =>
              other.id !== bot.id && other.targetId === slime.id && other.combat.player.hp > 0,
          ).length;
          const score = separation(bot.position, slime.position) + assigned * 4;
          if (score < best) {
            best = score;
            target = slime;
          }
        }
        bot.targetId = target?.id ?? null;
      }
      if (target) {
        const d = separation(bot.position, target.position);
        bot.yaw = Math.atan2(
          bot.position[0] - target.position[0],
          bot.position[1] - target.position[1],
        );
        const pose = botPose(bot);
        if (d > 3.3 && (this.world.time + bot.id * 0.43) % 7 < 1.5) bot.combat.castSkill(pose);
        if (d < 2.7) bot.combat.attack(pose, blocked);
        if (d > 2.1) {
          const speed = dt * (bot.combat.chargingAt === null ? 2.8 : 1.2);
          const dx = -Math.sin(bot.yaw) * speed,
            dz = -Math.cos(bot.yaw) * speed;
          const free = (p: Point) =>
            !blocked(p, 0.4) &&
            !this.bots.some(
              (other) =>
                other.id !== bot.id &&
                other.combat.player.hp > 0 &&
                separation(p, other.position) < 0.72,
            );
          const x: Point = [bot.position[0] + dx, bot.position[1]];
          if (free(x)) {
            bot.position[0] = x[0];
            bot.moving = true;
          }
          const z: Point = [bot.position[0], bot.position[1] + dz];
          if (free(z)) {
            bot.position[1] = z[1];
            bot.moving = true;
          }
        }
      }
      bot.combat.step(dt, botPose(bot), blocked, { enemyAI: false });
    }
    this.world.step(dt, { position: this.center, yaw: 0, pitch: 0, blocking: false }, blocked, {
      targets: this.bots.map((bot) => ({ simulation: bot.combat, pose: botPose(bot) })),
    });
    this.world.drainEvents();
    for (const bot of this.bots) {
      bot.events = bot.combat.drainEvents();
      for (const event of bot.events) {
        if (event.kind === 'kill') {
          bot.lifetimeKills++;
          this.totals.kills++;
        }
        if (event.kind === 'swing') this.totals.swings++;
        if (event.kind === 'wave-release') this.totals.casts++;
      }
    }
  }
}
