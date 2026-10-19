// The picture hints of the first minute (approved mockup, steps 2, 5 and 6): a hand showing how
// to drag the stick and turn the camera, and a spotlight on one button with a hand pressing it.
// The game goes on underneath; each hint goes away once the player has done it.

import { el } from './dom';
import { pxSvg } from './pixelIcons';

// a pointing hand: 'k' the ink outline, 'W' the white hand (pixel grid, see pixelIcons.ts)
const HAND = [
  '....kk......',
  '...kWWk.....',
  '...kWWk.....',
  '...kWWk.....',
  '...kWWkkk...',
  '...kWWkWWkk.',
  '.kkkWWkWWkWk',
  'kWWkWWWWWkWk',
  'kWWWWWWWWWWk',
  '.kWWWWWWWWWk',
  '..kWWWWWWWk.',
  '...kWWWWWk..',
  '...kkkkkkk..',
];

/** words with the important one picked out: [plain, bold, plain, bold, ...] */
const words = (parts: string[]) => {
  const e = el('div', 'hint');
  parts.forEach((p, i) => e.append(i % 2 ? el('b', '', p) : document.createTextNode(p)));
  return e;
};

const hand = (cls: string) => {
  const h = el('div', `finger ${cls}`);
  h.innerHTML = pxSvg(HAND, 'px-ico');
  return h;
};

export class Tips {
  readonly root = el('div', 'tips');
  private target: HTMLElement | null = null;
  private hole = el('div', 'tip-hole');
  private ring = el('div', 'tip-ring');
  private press = hand('tip-press');
  private label: HTMLElement | null = null;
  private slow = el('div', 'tip-slow');
  /** which hint is up: 'stick', a button's name, or null */
  showing: string | null = null;

  constructor() {
    this.root.hidden = true;
  }

  /** How to walk and turn: on a touch screen with hands on the stick and the right side. */
  stick(touch: boolean, t: Record<string, string | string[]>): void {
    this.clear();
    this.showing = 'stick';
    this.root.className = 'tips tips-stick';
    if (touch) {
      const walk = words(t.walk as string[]);
      walk.append(el('br', ''), ...Array.from(words(t.run as string[]).childNodes));
      walk.classList.add('tip-walk');
      const look = words(t.look as string[]);
      look.classList.add('tip-look');
      this.root.append(el('div', 'tip-dim'), walk, hand('tip-drag'), look, hand('tip-swipe'));
    } else {
      const keys = words(t.keys as string[]);
      keys.classList.add('tip-keys');
      const mouse = words(t.mouse as string[]);
      mouse.classList.add('tip-mouse');
      this.root.append(keys, mouse);
    }
    this.root.hidden = false;
  }

  /** A spotlight on one button with a hand pressing it; `slow` adds the slow-motion label. */
  button(name: string, b: HTMLElement, text: string[], slow?: string): void {
    this.clear();
    this.showing = name;
    this.root.className = 'tips tips-button';
    this.target = b;
    this.label = words(text);
    this.label.classList.add('tip-label');
    this.root.append(this.hole, this.ring, this.label, this.press);
    if (slow) {
      this.slow.textContent = slow;
      this.root.append(this.slow);
    }
    this.root.hidden = false;
    this.place();
  }

  /** Follow the button (the layout turns with the phone). */
  place(): void {
    const b = this.target;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) + 24;
    const cx = r.left + r.width / 2,
      cy = r.top + r.height / 2;
    for (const e of [this.hole, this.ring]) {
      e.style.width = e.style.height = `${size}px`;
      e.style.left = `${Math.round(cx - size / 2)}px`;
      e.style.top = `${Math.round(cy - size / 2)}px`;
    }
    this.press.style.left = `${Math.round(cx - 6)}px`;
    this.press.style.top = `${Math.round(cy - 4)}px`;
    if (this.label) {
      this.label.style.right = `${Math.round(Math.max(8, window.innerWidth - cx - 60))}px`;
      this.label.style.top = `${Math.round(cy - size / 2 - 44)}px`;
    }
  }

  hide(): void {
    this.clear();
    this.root.hidden = true;
  }

  private clear(): void {
    this.root.replaceChildren();
    this.target = null;
    this.label = null;
    this.showing = null;
  }
}
