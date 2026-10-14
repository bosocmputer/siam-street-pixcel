import Phaser from 'phaser';
import { W, H, FONT, RULE_LABEL, BOSS_X, RIVER, type Rule, type Power, type Weapon } from '../config';
import { loadWorld, saveWorld } from '../state';

interface ResultData {
  weapon: Weapon;
  power: Power;
  usedRule: Rule;
}

export class ResultScene extends Phaser.Scene {
  private data0!: ResultData;
  private chosen: Rule | 'skip' | null = null;
  private layer!: Phaser.GameObjects.Container;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.data0 = data;
    this.chosen = null;
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x10241a);
    this.layer = this.add.container(0, 0);
    this.drawChoice();

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.choose('ice'));
    kb.on('keydown-TWO', () => this.choose('cover'));
    kb.on('keydown-THREE', () => this.choose('skip'));
    kb.on('keydown-ENTER', () => this.next());
  }

  private text(x: number, y: number, s: string, size: number, color = '#e5e7eb', origin = 0.5) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, align: 'center', wordWrap: { width: 820 } });
    t.setOrigin(origin, 0);
    this.layer.add(t);
    return t;
  }

  private drawChoice(): void {
    this.layer.removeAll(true);
    const w = loadWorld();
    this.text(W / 2, 24, 'ชนะแล้ว! ผู้พิทักษ์แม่น้ำคืนกฎให้พื้นที่', 34, '#fde68a');
    if (this.data0.usedRule) {
      this.text(
        W / 2,
        72,
        `ผลงานที่ฝากไว้ (${RULE_LABEL[this.data0.usedRule]}) ถูกใช้ชนะบอสแล้ว ${w.usedWins} ครั้ง`,
        20,
        '#86efac',
      );
    }
    this.text(W / 2, 108, 'เลือกกฎที่จะฝากไว้ในพื้นที่นี้ (มีช่องเดียว) — หรือไม่เปลี่ยนก็ได้', 20);
    if (w.rule) {
      this.text(W / 2, 138, `ช่องกฎมี "${RULE_LABEL[w.rule]}" อยู่แล้ว การเลือกใหม่จะแทนที่ — ระบบยืนยันก่อนเขียนทับ`, 17, '#fca5a5');
    }

    this.card(70, 190, 'ice', '[1] ทางน้ำแข็ง', 'เปิดสะพานข้ามแม่น้ำตั้งแต่เริ่ม\nทีมถัดไปเข้าประชิดบอสได้ทันที');
    this.card(510, 190, 'cover', '[2] เสาสะท้อน', 'เสากำบังสะท้อนกระสุนอยู่กลางฝั่งเรา\nทีมถัดไปยืนไกลก็สู้ได้');
    const skip = this.add
      .text(W / 2, 480, '[3] ไม่เปลี่ยนพื้นที่ — เก็บเฉพาะรางวัลส่วนตัว', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e5e7eb',
        backgroundColor: '#374151',
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    skip.on('pointerdown', () => this.choose('skip'));
    this.layer.add(skip);
  }

  private card(x: number, y: number, rule: Exclude<Rule, null>, title: string, body: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x1f2937).fillRoundedRect(x, y, 380, 270, 12);
    this.layer.add(g);
    this.mini(x + 20, y + 14, 340 / W, rule);
    this.text(x + 190, y + 210, title, 22, '#fde68a');
    this.text(x + 190, y + 238, body, 14, '#d1d5db').setWordWrapWidth(360);
    const hit = this.add.rectangle(x + 190, y + 135, 380, 270, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.choose(rule));
    this.layer.add(hit);
  }

  private mini(ox: number, oy: number, sc: number, rule: Rule): void {
    const g = this.add.graphics();
    g.fillStyle(0x3d6b3a).fillRect(ox, oy, W * sc, H * sc * 0.82);
    g.fillStyle(0x2f6fb0).fillRect(ox + RIVER.x * sc, oy, RIVER.w * sc, H * sc * 0.82);
    if (rule === 'ice') g.fillStyle(0xbfe8ff).fillRect(ox + (RIVER.x - 12) * sc, oy + 215 * sc, (RIVER.w + 24) * sc, 110 * sc);
    if (rule === 'cover') g.fillStyle(0x64748b).fillCircle(ox + 300 * sc, oy + 270 * sc, 22 * sc * 1.4);
    g.fillStyle(0x3b82f6).fillCircle(ox + 150 * sc, oy + 270 * sc, 6);
    g.fillStyle(0xb91c1c).fillCircle(ox + BOSS_X * sc, oy + 270 * sc, 10);
    this.layer.add(g);
  }

  private choose(c: Rule | 'skip'): void {
    if (this.chosen) return;
    this.chosen = c;
    const w = loadWorld();
    const before = w.rule;
    if (c !== 'skip') saveWorld({ rule: c, usedWins: before === c ? w.usedWins : 0 });

    this.layer.removeAll(true);
    const after: Rule = c === 'skip' ? before : c;
    this.text(W / 2, 24, c === 'skip' || c === null ? 'เก็บพื้นที่ไว้ตามเดิม' : `ฝาก "${RULE_LABEL[c]}" ไว้ในพื้นที่แล้ว`, 34, '#fde68a');
    this.text(W / 2, 70, 'ภาพก่อน–หลังของพื้นที่', 20);

    this.text(260, 110, 'ก่อน', 20, '#fca5a5');
    this.mini(60, 140, 400 / W, before);
    this.text(700, 110, 'หลัง', 20, '#86efac');
    this.mini(500, 140, 400 / W, after);

    this.text(
      W / 2,
      390,
      after
        ? `รอบถัดไป (ของคุณหรือเพื่อน) เลือกใช้ "${RULE_LABEL[after]}" ได้ — แต่ทางตรงเดิมยังเล่นได้เสมอ`
        : 'พื้นที่ยังไม่มีกฎที่ฝากไว้',
      20,
    );
    const again = this.add
      .text(W / 2, 470, '▶ เล่นอีกรอบ (Enter / แตะ)', {
        fontFamily: FONT,
        fontSize: '28px',
        color: '#111827',
        backgroundColor: '#fde68a',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    again.on('pointerdown', () => this.next());
    this.layer.add(again);
  }

  private next(): void {
    if (this.chosen) this.scene.start('Title');
  }
}
