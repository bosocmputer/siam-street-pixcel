import Phaser from 'phaser';
import { W, H, FONT, RULE_LABEL, type Weapon, type Power } from '../config';
import { loadWorld, saveWorld } from '../state';

export class TitleScene extends Phaser.Scene {
  private weapon: Weapon = 'sword';
  private power: Power = 'freeze';
  private useRule = true;
  private opts: Record<string, Phaser.GameObjects.Text> = {};
  private worldText!: Phaser.GameObjects.Text;

  constructor() {
    super('Title');
  }

  create(): void {
    this.add.rectangle(W / 2, H / 2, W, H, 0x10241a);
    this.add.text(W / 2, 54, 'สยามพลิกกฎ', { fontFamily: FONT, fontSize: '52px', color: '#fde68a' }).setOrigin(0.5);
    this.add
      .text(W / 2, 100, 'SIAM: REWRITE — demo ต้นแบบ (graybox)', { fontFamily: FONT, fontSize: '20px', color: '#a7f3d0' })
      .setOrigin(0.5);
    this.add
      .text(W / 2, 140, 'ล้มผู้พิทักษ์แม่น้ำ แล้วฝาก "กฎ" ไว้ในพื้นที่ให้รอบถัดไปใช้', {
        fontFamily: FONT,
        fontSize: '20px',
        color: '#e5e7eb',
      })
      .setOrigin(0.5);

    this.add.text(150, 190, 'อาวุธ', { fontFamily: FONT, fontSize: '22px', color: '#93c5fd' });
    this.opt('sword', 330, 190, '[1] ดาบ — ฟันระยะประชิด', () => (this.weapon = 'sword'));
    this.opt('staff', 610, 190, '[2] คทา — ยิงระยะไกล', () => (this.weapon = 'staff'));

    this.add.text(150, 245, 'พลัง', { fontFamily: FONT, fontSize: '22px', color: '#93c5fd' });
    this.opt('freeze', 330, 245, '[3] แช่แข็ง — ทำสะพานน้ำแข็ง', () => (this.power = 'freeze'));
    this.opt('reflect', 610, 245, '[4] สะท้อน — กำแพงสะท้อนกระสุน', () => (this.power = 'reflect'));

    this.add.text(150, 300, 'โลก', { fontFamily: FONT, fontSize: '22px', color: '#93c5fd' });
    this.opt('rule', 330, 300, '', () => (this.useRule = !this.useRule));
    this.worldText = this.add.text(330, 338, '', { fontFamily: FONT, fontSize: '18px', color: '#d1d5db' });

    const start = this.add
      .text(W / 2, 410, '▶ เริ่มสู้ (Enter / แตะที่นี่)', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#111827',
        backgroundColor: '#fde68a',
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    start.on('pointerdown', () => this.begin());

    this.add
      .text(
        W / 2,
        480,
        'คีย์บอร์ด: WASD/ลูกศร เดิน · J หรือคลิก โจมตี · Space หลบ · K หรือ E ใช้พลัง   |   มือถือ: จอยซ้าย + ปุ่มขวา\n[C] ล้างโลกที่บันทึกไว้',
        { fontFamily: FONT, fontSize: '16px', color: '#9ca3af', align: 'center' },
      )
      .setOrigin(0.5);

    const kb = this.input.keyboard!;
    kb.on('keydown-ONE', () => this.pick(() => (this.weapon = 'sword')));
    kb.on('keydown-TWO', () => this.pick(() => (this.weapon = 'staff')));
    kb.on('keydown-THREE', () => this.pick(() => (this.power = 'freeze')));
    kb.on('keydown-FOUR', () => this.pick(() => (this.power = 'reflect')));
    kb.on('keydown-R', () => this.pick(() => (this.useRule = !this.useRule)));
    kb.on('keydown-C', () => {
      saveWorld({ rule: null, usedWins: 0 });
      this.refresh();
    });
    kb.on('keydown-ENTER', () => this.begin());
    kb.on('keydown-SPACE', () => this.begin());

    this.refresh();
  }

  private opt(key: string, x: number, y: number, label: string, onPick: () => void): void {
    const t = this.add
      .text(x, y, label, { fontFamily: FONT, fontSize: '20px', color: '#e5e7eb', padding: { x: 10, y: 5 } })
      .setInteractive({ useHandCursor: true });
    t.on('pointerdown', () => this.pick(onPick));
    this.opts[key] = t;
  }

  private pick(fn: () => void): void {
    fn();
    this.refresh();
  }

  private refresh(): void {
    const mark = (key: string, on: boolean) => {
      this.opts[key].setBackgroundColor(on ? '#166534' : '#1f2937');
    };
    mark('sword', this.weapon === 'sword');
    mark('staff', this.weapon === 'staff');
    mark('freeze', this.power === 'freeze');
    mark('reflect', this.power === 'reflect');

    const w = loadWorld();
    const ruleName = w.rule ? RULE_LABEL[w.rule] : 'ยังไม่มีผลงานที่ฝากไว้';
    this.opts.rule.setText(`[R] ใช้ผลงานที่ฝากไว้: ${this.useRule ? 'เปิด' : 'ปิด'}`);
    mark('rule', this.useRule && w.rule !== null);
    this.worldText.setText(
      `พื้นที่ "ลำน้ำเชียงใหม่" · กฎที่ฝากไว้: ${ruleName}` +
        (w.rule ? ` · ถูกใช้ชนะบอสแล้ว ${w.usedWins} ครั้ง` : ''),
    );
  }

  private begin(): void {
    this.scene.start('Fight', { weapon: this.weapon, power: this.power, useRule: this.useRule });
  }
}
