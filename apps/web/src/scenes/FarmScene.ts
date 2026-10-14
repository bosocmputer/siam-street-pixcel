import Phaser from 'phaser';
import { dataUrl } from '../art';
import { ELEMENT_COLORS } from '../art/draw';
import type { Element } from '@slimehood/game-core';

export interface FarmView {
  slime: HTMLCanvasElement;
  slimeKey: string;
  monsters: { id: string; canvas: HTMLCanvasElement }[];
  element: Element;
}

export const FARM_W = 480;
export const FARM_H = 270;

const SKY: Record<Element, [number, number]> = {
  earth: [0x2a1f1c, 0x4a3328],
  water: [0x10303f, 0x1c5775],
  fire: [0x2a1220, 0x6a2a2a],
  wind: [0x1d3a52, 0x5a8fb3],
};

/** Purely cosmetic: the real fight is calculated by game-core when you claim. */
export class FarmScene extends Phaser.Scene {
  private view: FarmView | null = null;
  private slime?: Phaser.GameObjects.Image;
  private monster?: Phaser.GameObjects.Image;
  private bg?: Phaser.GameObjects.Graphics;
  private shapes: Phaser.GameObjects.GameObject[] = [];
  private loop?: Phaser.Time.TimerEvent;
  private n = 0;

  constructor() {
    super('Farm');
  }

  create(): void {
    this.bg = this.add.graphics();
    this.slime = this.add.image(120, 184, '__DEFAULT').setScale(2.4).setVisible(false);
    this.monster = this.add.image(372, 184, '__DEFAULT').setScale(2.2).setVisible(false);
    this.loop = this.time.addEvent({ delay: 2200, loop: true, callback: () => this.round() });
    if (this.view) this.applyView(this.view);
  }

  applyView(view: FarmView): void {
    this.view = view;
    if (!this.slime || !this.monster || !this.bg) return; // create() will call us again
    this.drawBackground(view.element);
    if (this.textures.exists(view.slimeKey)) this.textures.remove(view.slimeKey);
    this.textures.addCanvas(view.slimeKey, view.slime);
    this.slime.setTexture(view.slimeKey).setVisible(true);
    this.tweens.killTweensOf(this.slime);
    this.slime.setPosition(120, 184);
    this.tweens.add({
      targets: this.slime,
      y: 180,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
    this.showMonster();
  }

  private drawBackground(el: Element): void {
    if (!this.bg) return;
    for (const s of this.shapes) s.destroy();
    this.shapes = [];
    const [top, bottom] = SKY[el];
    const g = this.bg;
    g.clear();
    const bands = 9;
    for (let i = 0; i < bands; i++) {
      const k = i / (bands - 1);
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top),
        Phaser.Display.Color.ValueToColor(bottom),
        100,
        k * 100,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      g.fillRect(0, (i * 150) / bands, FARM_W, 150 / bands + 1);
    }
    const ground = Phaser.Display.Color.HexStringToColor(ELEMENT_COLORS[el].shade).color;
    const edge = Phaser.Display.Color.HexStringToColor(ELEMENT_COLORS[el].line).color;
    g.fillStyle(edge, 1);
    g.fillRect(0, 150, FARM_W, 120);
    g.fillStyle(ground, 1);
    g.fillRect(0, 154, FARM_W, 116);
    g.fillStyle(0xffffff, 0.06);
    for (let x = 0; x < FARM_W; x += 32) g.fillRect(x + ((x / 32) % 2) * 8, 190, 16, 3);
    // a few drifting details so the scene is not static
    for (let i = 0; i < 6; i++) {
      const d = this.add.rectangle(
        40 + i * 80,
        40 + (i % 3) * 22,
        28 + (i % 2) * 14,
        6,
        0xffffff,
        el === 'wind' ? 0.35 : 0.12,
      );
      this.shapes.push(d);
      this.tweens.add({
        targets: d,
        x: d.x + 36,
        duration: 5000 + i * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut',
      });
    }
    if (el === 'fire') {
      for (let i = 0; i < 5; i++) {
        const l = this.add.circle(30 + i * 100, 118, 7, 0xffb347, 0.8);
        this.shapes.push(l);
        this.tweens.add({
          targets: l,
          alpha: 0.35,
          duration: 600 + i * 90,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private showMonster(): void {
    const v = this.view;
    if (!v || !this.monster || v.monsters.length === 0) return;
    const m = v.monsters[this.n % v.monsters.length];
    if (!m) return;
    const key = `monster:${m.id}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, m.canvas);
    this.monster
      .setTexture(key)
      .setVisible(true)
      .setAlpha(1)
      .setTint(0xffffff)
      .clearTint()
      .setScale(0.1)
      .setPosition(372, 184);
    this.tweens.add({ targets: this.monster, scale: 2.2, duration: 220, ease: 'Back.out' });
  }

  private round(): void {
    if (!this.view || !this.slime || !this.monster) return;
    const slime = this.slime;
    const monster = this.monster;
    this.tweens.add({
      targets: slime,
      x: 280,
      duration: 160,
      yoyo: true,
      ease: 'Quad.in',
      onYoyo: () => {
        monster.setTintFill(0xffffff);
        this.floatText(monster.x, monster.y - 70, '+' + (3 + (this.n % 5)));
        this.time.delayedCall(90, () => monster.clearTint());
      },
      onComplete: () => {
        this.tweens.add({
          targets: monster,
          alpha: 0,
          scale: 0.1,
          duration: 200,
          onComplete: () => {
            this.n += 1;
            this.showMonster();
          },
        });
      },
    });
  }

  private floatText(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: 'Silkscreen, monospace',
      fontSize: '16px',
      color: '#ffe08a',
      stroke: '#2a1a00',
      strokeThickness: 3,
    });
    t.setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 800,
      onComplete: () => t.destroy(),
    });
  }

  shutdown(): void {
    this.loop?.remove();
  }
}

export { dataUrl };
