import Phaser from 'phaser';
import type { Element } from '@slimehood/game-core';

export interface FarmView {
  slime: HTMLCanvasElement;
  slimeKey: string;
  monsters: { id: string; canvas: HTMLCanvasElement }[];
  element: Element;
  /** the street behind the fight, drawn at a third of the stage size */
  scene: HTMLCanvasElement;
  /** only used to make the floating numbers look believable; the real fight is calculated on claim */
  atk: number;
  reducedMotion: boolean;
}

export const FARM_W = 390;
export const FARM_H = 330;
const SCALE = 5; // one art pixel = 5 screen pixels; the 48x48 sprite canvases become 240x240
const FEET_Y = 262;
const SLIME_X = 118;
const MONSTER_X = 290;
// where the feet sit inside the 48x48 canvas (rows from the top), used as the sprite origin
const ORIGIN_Y = 33 / 48;

/** Purely cosmetic: the real fight is calculated by game-core when you claim. */
export class FarmScene extends Phaser.Scene {
  private view: FarmView | null = null;
  private bg?: Phaser.GameObjects.Image;
  private slime?: Phaser.GameObjects.Image;
  private monster?: Phaser.GameObjects.Image;
  private loop?: Phaser.Time.TimerEvent;
  private n = 0;

  constructor() {
    super('Farm');
  }

  create(): void {
    this.bg = this.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false);
    this.slime = this.add
      .image(SLIME_X, FEET_Y, '__DEFAULT')
      .setOrigin(0.5, ORIGIN_Y)
      .setScale(SCALE)
      .setVisible(false);
    this.monster = this.add
      .image(MONSTER_X, FEET_Y, '__DEFAULT')
      .setOrigin(0.5, ORIGIN_Y)
      .setScale(SCALE)
      .setVisible(false);
    this.loop = this.time.addEvent({ delay: 2300, loop: true, callback: () => this.round() });
    if (this.view) this.applyView(this.view);
  }

  applyView(view: FarmView): void {
    this.view = view;
    if (!this.slime || !this.monster || !this.bg) return; // create() will call us again
    const bgKey = `bg:${view.element}`;
    if (!this.textures.exists(bgKey)) this.textures.addCanvas(bgKey, view.scene);
    this.bg
      .setTexture(bgKey)
      .setScale(FARM_W / view.scene.width)
      .setVisible(true);
    if (this.textures.exists(view.slimeKey)) this.textures.remove(view.slimeKey);
    this.textures.addCanvas(view.slimeKey, view.slime);
    this.slime.setTexture(view.slimeKey).setVisible(true).setScale(SCALE);
    this.tweens.killTweensOf(this.slime);
    this.slime.setPosition(SLIME_X, FEET_Y);
    // breathing: squash and stretch around the feet
    this.tweens.add({
      targets: this.slime,
      scaleY: SCALE * (view.reducedMotion ? 0.99 : 0.93),
      scaleX: SCALE * (view.reducedMotion ? 1.01 : 1.05),
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.showMonster();
  }

  private showMonster(): void {
    const v = this.view;
    if (!v || !this.monster || v.monsters.length === 0) return;
    const m = v.monsters[this.n % v.monsters.length];
    if (!m) return;
    const key = `monster:${m.id}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, m.canvas);
    this.tweens.killTweensOf(this.monster);
    this.monster
      .setTexture(key)
      .setVisible(true)
      .setAlpha(1)
      .clearTint()
      .setScale(0.1)
      .setPosition(MONSTER_X, FEET_Y);
    this.tweens.add({
      targets: this.monster,
      scale: SCALE,
      duration: v.reducedMotion ? 1 : 240,
      ease: 'Back.out',
      onComplete: () => {
        if (!this.monster || v.reducedMotion) return;
        this.tweens.add({
          targets: this.monster,
          scaleY: SCALE * 0.95,
          scaleX: SCALE * 1.03,
          duration: 520,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.inOut',
        });
      },
    });
  }

  private round(): void {
    const v = this.view;
    if (!v || !this.slime || !this.monster) return;
    const slime = this.slime;
    const monster = this.monster;
    const crit = this.n % 4 === 3;
    const dmg = Math.max(
      1,
      Math.round(v.atk * (0.85 + ((this.n * 37) % 30) / 100) * (crit ? 2 : 1)),
    );
    const hit = () => {
      monster.setTintFill(0xffffff);
      this.time.delayedCall(90, () => monster.clearTint());
      this.floatText(monster.x - 20, FEET_Y - 150, String(dmg), crit);
      if (!v.reducedMotion) this.sparks(monster.x - 40, FEET_Y - 70);
      this.cameras.main.shake(crit ? 120 : 60, crit ? 0.006 : 0.003);
    };
    const finish = () => {
      this.tweens.add({
        targets: monster,
        alpha: 0,
        scale: 0.1,
        duration: v.reducedMotion ? 1 : 220,
        onComplete: () => {
          this.n += 1;
          this.showMonster();
        },
      });
    };
    if (v.reducedMotion) {
      hit();
      this.time.delayedCall(400, finish);
      return;
    }
    this.tweens.add({
      targets: slime,
      x: SLIME_X + 90,
      duration: 150,
      yoyo: true,
      ease: 'Quad.in',
      onYoyo: hit,
      onComplete: finish,
    });
  }

  private floatText(x: number, y: number, text: string, crit: boolean): void {
    const t = this.add.text(x, y, crit ? `${text}!` : text, {
      fontFamily: '"Pixelify Sans", monospace',
      fontStyle: 'bold',
      fontSize: crit ? '34px' : '22px',
      color: crit ? '#ffb84d' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    });
    t.setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 34,
      alpha: 0,
      duration: crit ? 900 : 700,
      ease: 'Quad.out',
      onComplete: () => t.destroy(),
    });
  }

  private sparks(x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
      const s = this.add.rectangle(x, y, 8, 8, i % 2 ? 0xffd98a : 0xffffff);
      this.tweens.add({
        targets: s,
        x: x + Phaser.Math.Between(-50, 30),
        y: y + Phaser.Math.Between(-60, 20),
        alpha: 0,
        angle: 90,
        duration: 380,
        onComplete: () => s.destroy(),
      });
    }
  }

  shutdown(): void {
    this.loop?.remove();
  }
}
