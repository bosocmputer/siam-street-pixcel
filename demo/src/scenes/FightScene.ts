import Phaser from 'phaser';
import { W, H, FONT, RIVER, BOSS_X, type Weapon, type Power, type Rule } from '../config';
import { loadWorld, saveWorld } from '../state';

interface FightData {
  weapon: Weapon;
  power: Power;
  useRule: boolean;
}

interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  kind: 'shot' | 'orb' | 'bolt';
  friendly: boolean;
  dmg: number;
  r: number;
}

interface Zone {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  until: number;
  rect: Phaser.GameObjects.Rectangle;
}

interface Wall {
  img: Phaser.GameObjects.Image;
  x: number;
  y: number;
  r: number;
  until: number;
  pillar: boolean;
}

type BossState = 'move' | 'telegraph' | 'recover';

const PLAYER_R = 14;
const BOSS_R = 48;
const SLAM_R = 140;
const BTN = {
  atk: { x: W - 90, y: H - 90, r: 48 },
  dodge: { x: W - 200, y: H - 64, r: 36 },
  power: { x: W - 72, y: H - 200, r: 36 },
};

export class FightScene extends Phaser.Scene {
  private d!: FightData;
  private t = 0;
  private over = false;
  private ruleOn: Rule = null;

  private player!: Phaser.GameObjects.Image;
  private boss!: Phaser.GameObjects.Image;
  private px = 150;
  private py = 270;
  private pHp = 100;
  private dir = new Phaser.Math.Vector2(1, 0);
  private iframes = 0;
  private dashUntil = 0;
  private dashDir = new Phaser.Math.Vector2(1, 0);
  private dodgeReadyAt = 0;
  private atkReadyAt = 0;
  private powerReadyAt = 0;

  private bossY = 270;
  private bossHp = 120;
  private bossMax = 120;
  private bossState: BossState = 'move';
  private bossT = 1.5;
  private bossAttack: 'slam' | 'volley' = 'volley';
  private volleyAngle = 0;
  private volleyCount = 0;

  private shots: Shot[] = [];
  private zones: Zone[] = [];
  private walls: Wall[] = [];

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private touchUi = false;
  private roles = new Map<number, string>();
  private joyId: number | null = null;
  private joyOrigin = new Phaser.Math.Vector2();
  private mouseAtk = false;
  private dodgeQ = false;
  private powerQ = false;

  private hud!: Phaser.GameObjects.Graphics;
  private tele!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private powerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private toastUntil = 0;

  constructor() {
    super('Fight');
  }

  init(data: FightData): void {
    this.d = data;
  }

  create(): void {
    this.t = 0;
    this.over = false;
    this.px = 150;
    this.py = 270;
    this.pHp = 100;
    this.dir.set(1, 0);
    this.iframes = this.dashUntil = this.dodgeReadyAt = this.atkReadyAt = this.powerReadyAt = 0;
    this.bossY = 270;
    this.bossHp = this.bossMax = 120;
    this.bossState = 'move';
    this.bossT = 1.5;
    this.volleyCount = 0;
    this.shots = [];
    this.zones = [];
    this.walls = [];
    this.roles.clear();
    this.joyId = null;
    this.mouseAtk = this.dodgeQ = this.powerQ = false;

    const world = loadWorld();
    this.ruleOn = this.d.useRule ? world.rule : null;
    this.drawBackground();

    this.player = this.add.image(this.px, this.py, 'player').setDepth(10);
    this.boss = this.add.image(BOSS_X, this.bossY, 'boss').setDepth(9);
    this.tele = this.add.graphics().setDepth(5);
    this.fx = this.add.graphics().setDepth(20);
    this.hud = this.add.graphics().setDepth(100);
    this.powerText = this.add
      .text(16, H - 36, '', { fontFamily: FONT, fontSize: '18px', color: '#fff' })
      .setDepth(101);
    this.toastText = this.add
      .text(W / 2, 90, '', { fontFamily: FONT, fontSize: '22px', color: '#fde68a', backgroundColor: '#000a', padding: { x: 10, y: 4 } })
      .setOrigin(0.5)
      .setDepth(101)
      .setVisible(false);
    this.add
      .text(W / 2, 14, 'ผู้พิทักษ์แม่น้ำ', { fontFamily: FONT, fontSize: '18px', color: '#fecaca' })
      .setOrigin(0.5, 0)
      .setDepth(101);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,J,K,E,R,ESC') as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.touchUi = this.sys.game.device.input.touch || new URLSearchParams(location.search).has('touch');
    this.input.addPointer(2);
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointerup', this.onUp, this);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', this.onDown, this);
      this.input.off('pointerup', this.onUp, this);
    });

    const label = this.ruleOn
      ? this.ruleOn === 'ice'
        ? 'ใช้ผลงานที่ฝากไว้: ทางน้ำแข็ง'
        : 'ใช้ผลงานที่ฝากไว้: เสาสะท้อน'
      : this.d.power === 'freeze'
        ? 'ข้ามแม่น้ำด้วยแช่แข็ง หรือยิงข้ามแม่น้ำ'
        : 'ใช้กำแพงสะท้อนกระสุนของบอส';
    this.toast(label, 3);
  }

  // ---------- setup ----------

  private drawBackground(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x3d6b3a).setDepth(0);
    this.add.rectangle(RIVER.x + RIVER.w / 2, H / 2, RIVER.w, H, 0x2f6fb0).setDepth(1);
    for (let i = 0; i < 14; i++) {
      const r = this.add
        .rectangle(RIVER.x + 14 + (i % 4) * 40, 20 + i * 38, 26, 4, 0x7dd3fc, 0.6)
        .setDepth(2);
      this.tweens.add({ targets: r, alpha: 0.1, duration: 700 + i * 40, yoyo: true, repeat: -1 });
    }
    this.add.rectangle(RIVER.x - 3, H / 2, 6, H, 0x1f4d24).setDepth(2);
    this.add.rectangle(RIVER.x + RIVER.w + 3, H / 2, 6, H, 0x1f4d24).setDepth(2);

    if (this.ruleOn === 'ice') {
      const rect = this.add
        .rectangle((RIVER.x + RIVER.x + RIVER.w) / 2, 270, RIVER.w + 24, 110, 0xbfe8ff)
        .setDepth(3)
        .setStrokeStyle(2, 0xffffff);
      this.zones.push({ x1: RIVER.x - 12, x2: RIVER.x + RIVER.w + 12, y1: 215, y2: 325, until: Infinity, rect });
    }
    if (this.ruleOn === 'cover') {
      const img = this.add.image(300, 270, 'pillar').setDepth(4);
      this.walls.push({ img, x: 300, y: 270, r: 44, until: Infinity, pillar: true });
    }
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.touchUi) {
      const hit = (b: { x: number; y: number; r: number }) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 8;
      if (hit(BTN.atk)) this.roles.set(p.id, 'atk');
      else if (hit(BTN.dodge)) this.dodgeQ = true;
      else if (hit(BTN.power)) this.powerQ = true;
      else if (p.x < W * 0.55 && this.joyId === null) {
        this.joyId = p.id;
        this.joyOrigin.set(p.x, p.y);
      }
    } else {
      this.mouseAtk = true;
    }
    if (this.over) this.restartOrExit();
  }

  private onUp(p: Phaser.Input.Pointer): void {
    this.roles.delete(p.id);
    if (this.joyId === p.id) this.joyId = null;
    this.mouseAtk = false;
  }

  // ---------- helpers ----------

  private toast(msg: string, secs = 1.6): void {
    this.toastText.setText(msg).setVisible(true);
    this.toastUntil = this.t + secs;
  }

  private onIce(x: number, y: number): boolean {
    return this.zones.some((z) => z.until > this.t && x > z.x1 && x < z.x2 && y > z.y1 && y < z.y2);
  }

  private inWater(x: number): boolean {
    return x > RIVER.x - 10 && x < RIVER.x + RIVER.w + 10;
  }

  private blocked(x: number, y: number): boolean {
    if (this.inWater(x) && !this.onIce(x, y)) return true;
    return this.walls.some((w) => w.pillar && Math.hypot(x - w.x, y - w.y) < w.r + PLAYER_R - 8);
  }

  private tryMove(dx: number, dy: number): void {
    const nx = Phaser.Math.Clamp(this.px + dx, 20, W - 20);
    if (!this.blocked(nx, this.py)) this.px = nx;
    const ny = Phaser.Math.Clamp(this.py + dy, 30, H - 30);
    if (!this.blocked(this.px, ny)) this.py = ny;
  }

  private toBoss(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(BOSS_X - this.px, this.bossY - this.py).normalize();
  }

  private addShot(x: number, y: number, ang: number, speed: number, kind: Shot['kind'], friendly: boolean, dmg: number, r: number): void {
    const key = kind === 'orb' ? 'orb' : kind === 'bolt' ? 'bolt' : 'shot';
    const img = this.add.image(x, y, key).setDepth(8);
    if (friendly && kind === 'shot') img.setTint(0x67e8f9);
    this.shots.push({ img, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, kind, friendly, dmg, r });
  }

  private hurt(dmg: number): void {
    if (this.over || this.iframes > this.t) return;
    this.pHp -= dmg;
    this.iframes = this.t + 0.6;
    this.cameras.main.shake(120, 0.006);
    this.cameras.main.flash(80, 255, 60, 60);
    if (this.pHp <= 0) this.lose();
  }

  private hitBoss(dmg: number): void {
    if (this.over) return;
    this.bossHp -= dmg;
    this.boss.setTintFill(0xffffff);
    this.time.delayedCall(70, () => this.boss.clearTint());
    if (this.bossHp <= 0) this.win();
  }

  private win(): void {
    this.over = true;
    this.shots.forEach((s) => s.img.destroy());
    this.shots = [];
    this.tele.clear();
    const w = loadWorld();
    if (this.ruleOn) saveWorld({ ...w, usedWins: w.usedWins + 1 });
    this.toast('ชนะ!', 5);
    this.cameras.main.flash(250, 255, 255, 200);
    this.time.delayedCall(1300, () =>
      this.scene.start('Result', { weapon: this.d.weapon, power: this.d.power, usedRule: this.ruleOn }),
    );
  }

  private lose(): void {
    this.over = true;
    this.toast('แพ้ — ไม่เสียพลังที่ปลดล็อก · แตะหรือกด R เพื่อลองใหม่ · Esc กลับ', 999);
  }

  private restartOrExit(): void {
    if (this.pHp <= 0) this.scene.restart(this.d);
  }

  // ---------- actions ----------

  private attack(): void {
    if (this.t < this.atkReadyAt || this.over) return;
    const aim = this.toBoss();
    this.dir.copy(aim);
    if (this.d.weapon === 'sword') {
      this.atkReadyAt = this.t + 0.35;
      const cx = this.px + aim.x * 42;
      const cy = this.py + aim.y * 42;
      if (Math.hypot(BOSS_X - cx, this.bossY - cy) < BOSS_R + 46) this.hitBoss(6);
      const a = Math.atan2(aim.y, aim.x);
      this.fx.clear();
      this.fx.lineStyle(6, 0xffffff, 0.9).beginPath().arc(this.px, this.py, 58, a - 0.9, a + 0.9).strokePath();
      this.time.delayedCall(90, () => this.fx.clear());
    } else {
      this.atkReadyAt = this.t + 0.45;
      this.addShot(this.px, this.py, Math.atan2(aim.y, aim.x), 520, 'bolt', true, 3, 8);
    }
  }

  private dodge(mx: number, my: number): void {
    if (this.t < this.dodgeReadyAt || this.over) return;
    this.dodgeReadyAt = this.t + 0.8;
    this.dashUntil = this.t + 0.18;
    this.iframes = Math.max(this.iframes, this.t + 0.25);
    if (mx || my) this.dashDir.set(mx, my).normalize();
    else this.dashDir.copy(this.dir);
  }

  private usePower(): void {
    if (this.t < this.powerReadyAt || this.over) return;
    if (this.d.power === 'freeze') {
      const nearRiver = this.px > RIVER.x - 230 && this.px < RIVER.x + RIVER.w + 230;
      if (!nearRiver) {
        this.toast('เข้าใกล้แม่น้ำก่อนใช้แช่แข็ง');
        return;
      }
      const cy = Phaser.Math.Clamp(this.py, 70, H - 70);
      const rect = this.add
        .rectangle(RIVER.x + RIVER.w / 2, cy, RIVER.w + 24, 100, 0xbfe8ff, 0.95)
        .setDepth(3)
        .setStrokeStyle(2, 0xffffff);
      this.zones.push({ x1: RIVER.x - 12, x2: RIVER.x + RIVER.w + 12, y1: cy - 50, y2: cy + 50, until: this.t + 6, rect });
      this.powerReadyAt = this.t + 7;
      this.toast('แช่แข็งแม่น้ำ! สะพานน้ำแข็ง 6 วินาที');
    } else {
      const aim = this.toBoss();
      const wx = this.px + aim.x * 70;
      const wy = this.py + aim.y * 70;
      const img = this.add.image(wx, wy, 'wall').setDepth(7);
      this.walls.push({ img, x: wx, y: wy, r: 52, until: this.t + 3.2, pillar: false });
      this.powerReadyAt = this.t + 5;
      this.toast('กำแพงสะท้อน! กระสุนธรรมดาจะย้อนกลับ ส่วนลูกม่วงทำลายกำแพง');
    }
  }

  // ---------- update ----------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.t += dt;

    if (this.keys.ESC.isDown) {
      this.scene.start('Title');
      return;
    }
    if (this.over && this.pHp <= 0 && this.keys.R.isDown) {
      this.scene.restart(this.d);
      return;
    }

    if (!this.over) {
      this.updatePlayer(dt);
      this.updateBoss(dt);
    }
    this.updateShots(dt);
    this.updateZonesAndWalls();
    this.drawHud();
  }

  private updatePlayer(dt: number): void {
    const k = this.keys;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (this.joyId !== null) {
      const p = this.input.manager.pointers.find((q) => q.id === this.joyId);
      if (p) {
        const v = new Phaser.Math.Vector2(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y).scale(1 / 50);
        if (v.length() > 0.2) {
          if (v.length() > 1) v.normalize();
          mx = v.x;
          my = v.y;
        }
      }
    }
    const mv = new Phaser.Math.Vector2(mx, my);
    if (mv.length() > 1) mv.normalize();

    const atkHeld = k.J.isDown || this.mouseAtk || [...this.roles.values()].includes('atk');
    if (atkHeld) this.attack();
    if (Phaser.Input.Keyboard.JustDown(k.SPACE) || Phaser.Input.Keyboard.JustDown(k.SHIFT) || this.dodgeQ) {
      this.dodge(mv.x, mv.y);
    }
    if (Phaser.Input.Keyboard.JustDown(k.K) || Phaser.Input.Keyboard.JustDown(k.E) || this.powerQ) this.usePower();
    this.dodgeQ = this.powerQ = false;

    if (this.t < this.dashUntil) {
      this.tryMove(this.dashDir.x * 620 * dt, this.dashDir.y * 620 * dt);
    } else if (mv.lengthSq() > 0) {
      this.tryMove(mv.x * 230 * dt, mv.y * 230 * dt);
      this.dir.copy(mv).normalize();
    }

    if (this.inWater(this.px) && !this.onIce(this.px, this.py)) {
      this.px = this.px < RIVER.x + RIVER.w / 2 ? RIVER.x - 24 : RIVER.x + RIVER.w + 24;
      this.toast('น้ำแข็งละลาย!');
    }

    this.player.setPosition(this.px, this.py);
    this.player.setFlipX(this.dir.x < 0);
    this.player.setAlpha(this.iframes > this.t ? 0.5 + 0.3 * Math.sin(this.t * 40) : 1);
  }

  private updateBoss(dt: number): void {
    const phase2 = this.bossHp < this.bossMax * 0.5;
    this.bossT -= dt;

    if (this.bossState === 'move') {
      const dy = this.py - this.bossY;
      this.bossY += Phaser.Math.Clamp(dy, -1, 1) * Math.min(Math.abs(dy), 80 * dt);
      this.bossY = Phaser.Math.Clamp(this.bossY, 100, H - 100);
      if (this.bossT <= 0) {
        const near = Math.hypot(this.px - BOSS_X, this.py - this.bossY) < 200;
        this.bossAttack = near ? 'slam' : 'volley';
        this.volleyAngle = Math.atan2(this.py - this.bossY, this.px - BOSS_X);
        this.bossState = 'telegraph';
        this.bossT = phase2 ? 0.7 : 0.95;
        this.volleyCount += this.bossAttack === 'volley' ? 1 : 0;
      }
    } else if (this.bossState === 'telegraph') {
      this.drawTelegraph(phase2);
      if (this.bossT <= 0) {
        this.tele.clear();
        this.executeAttack(phase2);
        this.bossState = 'recover';
        this.bossT = phase2 ? 0.7 : 1.0;
      }
    } else if (this.bossT <= 0) {
      this.bossState = 'move';
      this.bossT = phase2 ? 0.8 : 1.3;
    }
    this.boss.setPosition(BOSS_X, this.bossY);
  }

  private spreads(phase2: boolean): number[] {
    return phase2 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.25, 0, 0.25];
  }

  private drawTelegraph(phase2: boolean): void {
    const g = this.tele;
    g.clear();
    const pulse = 0.35 + 0.25 * Math.sin(this.t * 24);
    if (this.bossAttack === 'slam') {
      g.fillStyle(0xef4444, pulse).fillCircle(BOSS_X, this.bossY, SLAM_R);
    } else {
      for (const s of this.spreads(phase2)) {
        const a = this.volleyAngle + s;
        g.lineStyle(4, 0xef4444, pulse + 0.2).lineBetween(BOSS_X, this.bossY, BOSS_X + Math.cos(a) * 900, this.bossY + Math.sin(a) * 900);
      }
      if (this.volleyCount % 3 === 0) {
        g.lineStyle(7, 0xa855f7, pulse + 0.3).lineBetween(BOSS_X, this.bossY, BOSS_X + Math.cos(this.volleyAngle) * 900, this.bossY + Math.sin(this.volleyAngle) * 900);
      }
    }
  }

  private executeAttack(phase2: boolean): void {
    if (this.bossAttack === 'slam') {
      if (Math.hypot(this.px - BOSS_X, this.py - this.bossY) < SLAM_R) this.hurt(25);
      this.cameras.main.shake(180, 0.01);
      const ring = this.add.circle(BOSS_X, this.bossY, SLAM_R, 0xffffff, 0.35).setDepth(6);
      this.tweens.add({ targets: ring, alpha: 0, duration: 250, onComplete: () => ring.destroy() });
      return;
    }
    for (const s of this.spreads(phase2)) {
      this.addShot(BOSS_X, this.bossY, this.volleyAngle + s, 320, 'shot', false, 10, 10);
    }
    if (this.volleyCount % 3 === 0) {
      this.addShot(BOSS_X, this.bossY, this.volleyAngle, 230, 'orb', false, 20, 18);
    }
  }

  private updateShots(dt: number): void {
    for (const s of [...this.shots]) {
      s.img.x += s.vx * dt;
      s.img.y += s.vy * dt;
      let dead = s.img.x < -40 || s.img.x > W + 40 || s.img.y < -40 || s.img.y > H + 40;

      if (!dead && !s.friendly) {
        for (const w of this.walls) {
          if (Math.hypot(s.img.x - w.x, s.img.y - w.y) >= w.r + s.r) continue;
          if (s.kind === 'orb') {
            if (w.pillar) continue;
            w.until = 0;
            this.toast('ลูกม่วงทำลายกำแพงสะท้อน!');
            dead = true;
          } else {
            const a = Math.atan2(this.bossY - s.img.y, BOSS_X - s.img.x);
            s.vx = Math.cos(a) * 420;
            s.vy = Math.sin(a) * 420;
            s.friendly = true;
            s.dmg = 8;
            s.img.setTint(0x67e8f9);
          }
          break;
        }
      }
      if (!dead && !s.friendly && Math.hypot(s.img.x - this.px, s.img.y - this.py) < PLAYER_R + s.r) {
        this.hurt(s.dmg);
        dead = true;
      }
      if (!dead && s.friendly && Math.hypot(s.img.x - BOSS_X, s.img.y - this.bossY) < BOSS_R + s.r) {
        this.hitBoss(s.dmg);
        dead = true;
      }
      if (dead) {
        s.img.destroy();
        this.shots.splice(this.shots.indexOf(s), 1);
      }
    }
  }

  private updateZonesAndWalls(): void {
    this.zones = this.zones.filter((z) => {
      if (z.until > this.t) {
        if (z.until - this.t < 1.2) z.rect.setAlpha(0.4 + 0.4 * Math.sin(this.t * 30));
        return true;
      }
      z.rect.destroy();
      return false;
    });
    this.walls = this.walls.filter((w) => {
      if (w.until > this.t) return true;
      w.img.destroy();
      return false;
    });
    if (this.toastText.visible && this.t > this.toastUntil) this.toastText.setVisible(false);
  }

  private drawHud(): void {
    const g = this.hud;
    g.clear();
    g.fillStyle(0x000000, 0.5).fillRect(16, 16, 204, 20);
    g.fillStyle(0x22c55e).fillRect(18, 18, Math.max(0, this.pHp) * 2, 16);
    const bw = 420;
    g.fillStyle(0x000000, 0.5).fillRect(W / 2 - bw / 2 - 2, 40, bw + 4, 18);
    g.fillStyle(0xdc2626).fillRect(W / 2 - bw / 2, 42, Math.max(0, this.bossHp / this.bossMax) * bw, 14);

    const left = Math.max(0, this.powerReadyAt - this.t);
    const name = this.d.power === 'freeze' ? 'แช่แข็ง' : 'สะท้อน';
    this.powerText.setText(`พลัง [K/E]: ${name} — ${left > 0 ? left.toFixed(1) + 's' : 'พร้อม'}`);
    this.powerText.setColor(left > 0 ? '#9ca3af' : '#a7f3d0');

    if (this.touchUi) {
      const btn = (b: { x: number; y: number; r: number }, color: number, on: boolean) => {
        g.fillStyle(color, on ? 0.55 : 0.25).fillCircle(b.x, b.y, b.r);
        g.lineStyle(3, 0xffffff, 0.6).strokeCircle(b.x, b.y, b.r);
      };
      btn(BTN.atk, 0xef4444, this.t >= this.atkReadyAt);
      btn(BTN.dodge, 0x3b82f6, this.t >= this.dodgeReadyAt);
      btn(BTN.power, 0x22d3ee, this.t >= this.powerReadyAt);
      if (this.joyId !== null) {
        const p = this.input.manager.pointers.find((q) => q.id === this.joyId);
        g.lineStyle(3, 0xffffff, 0.4).strokeCircle(this.joyOrigin.x, this.joyOrigin.y, 50);
        if (p) g.fillStyle(0xffffff, 0.5).fillCircle(p.x, p.y, 20);
      }
    }
  }
}
