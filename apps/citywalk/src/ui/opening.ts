// The opening (gdd.md section 2, approved first-minute mockup step 1): three still pictures, one
// line each, three seconds a picture; a tap shows the next one and "skip" ends it. Pictures from
// files when the asset list names them (newgame/prompts/opening_stills.md), else drawn here in a
// few pixels.

import { el } from './dom';

const SHOW_FOR = 3000;

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

const rect = (
  g: CanvasRenderingContext2D,
  col: string,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  g.fillStyle = col;
  g.fillRect(x, y, w, h);
};

/** the night sky with a few stars */
const sky: Draw = (g, w, h) => {
  rect(g, '#1b1f3a', 0, 0, w, h);
  for (let i = 0; i < 40; i++) rect(g, '#3a4466', (i * 37) % w, (i * 53) % 70, 1, 1);
};

/** Sunday night at the gate: the brick gate, lanterns and the crowd */
const gate: Draw = (g, w, h) => {
  sky(g, w, h);
  rect(g, '#7a3a2a', 4, 50, 34, 52);
  rect(g, '#7a3a2a', 60, 50, 34, 52);
  for (let x = 4; x < 38; x += 6) rect(g, '#7a3a2a', x, 46, 4, 4);
  for (let x = 60; x < 94; x += 6) rect(g, '#7a3a2a', x, 46, 4, 4);
  rect(g, '#2a2333', 38, 58, 22, 44);
  rect(g, '#5a4a40', 0, 102, w, h - 102);
  const people = ['#181425', '#3a4466', '#262b44'];
  for (let i = 0; i < 70; i++) rect(g, people[i % 3]!, (i * 29) % w, 92 + ((i * 7) % 14), 3, 6);
  for (let i = 0; i < 9; i++) {
    rect(g, '#f77622', 6 + i * 10, 32 + (i % 2) * 4, 3, 4);
    rect(g, '#fee761', 7 + i * 10, 33 + (i % 2) * 4, 1, 2);
  }
};

/** a glowing blue drop falls on an open hand */
const drop: Draw = (g, w, h) => {
  sky(g, w, h);
  for (let i = 0; i < 30; i++) rect(g, '#2ce8f5', (i * 31) % w, (i * 17) % 80, 1, 3);
  rect(g, '#e8b796', 22, 70, 56, 22);
  rect(g, '#c28569', 22, 88, 56, 4);
  for (let i = 0; i < 4; i++) rect(g, '#e8b796', 24 + i * 12, 56, 9, 16);
  rect(g, '#e8b796', 74, 66, 14, 9);
  rect(g, 'rgba(44,232,245,.35)', 38, 40, 22, 24);
  rect(g, '#0099db', 44, 46, 10, 12);
  rect(g, '#2ce8f5', 46, 44, 6, 12);
  rect(g, '#ffffff', 47, 47, 2, 3);
};

/** a dome of light over the sleeping city */
const dome: Draw = (g, w, h) => {
  sky(g, w, h);
  rect(g, '#262b44', 0, 84, w, h - 84);
  for (let i = 0; i < 12; i++) rect(g, '#3a4466', i * 8 + 1, 68 + ((i * 13) % 14), 7, 30);
  for (let i = 0; i < 12; i++) rect(g, '#fee761', i * 8 + 3, 76 + ((i * 13) % 14), 2, 2);
  for (let a = 0; a <= 180; a += 2) {
    const t = (a * Math.PI) / 180;
    rect(g, '#2ce8f5', Math.round(49 + Math.cos(t) * 46), Math.round(88 - Math.sin(t) * 56), 2, 2);
  }
  rect(g, '#8b9bb4', 66, 96, 6, 2);
  rect(g, '#8b9bb4', 70, 92, 4, 2);
  rect(g, '#8b9bb4', 74, 88, 3, 2);
};

const DRAWN: Draw[] = [gate, drop, dome];

export class Opening {
  readonly root = el('div', 'opening');
  private pic = el('div', 'op-pic');
  private line = el('div', 'op-line');
  private dots = el('div', 'op-dots');
  private skip = el('button', 'op-skip');
  private n = 0;
  private timer = 0;
  private done: (() => void) | null = null;

  /** `lines` are the words under each picture; `files` the pictures, if there are any */
  constructor(
    private lines: readonly string[],
    skipLabel: string,
    private files: string[] = [],
  ) {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.skip.type = 'button';
    this.skip.textContent = skipLabel;
    for (let i = 0; i < lines.length; i++) this.dots.append(el('i', ''));
    this.root.append(this.pic, this.line, this.dots, this.skip);
    // fetched now, so each shows the moment it is due
    for (const f of files) new Image().src = f;
    this.root.addEventListener('click', (e) =>
      e.target === this.skip ? this.end() : this.show(this.n + 1),
    );
  }

  /** which picture is up (for tests), or -1 when the opening is not showing */
  get at(): number {
    return this.root.hidden ? -1 : this.n;
  }

  play(): Promise<void> {
    this.root.hidden = false;
    this.show(0);
    return new Promise((ok) => (this.done = ok));
  }

  private show(n: number): void {
    window.clearTimeout(this.timer);
    if (n >= this.lines.length) return this.end();
    this.n = n;
    this.line.textContent = this.lines[n]!;
    Array.from(this.dots.children).forEach((d, i) => d.classList.toggle('on', i === n));
    const file = this.files[n];
    if (file) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = file;
      this.pic.replaceChildren(img);
    } else {
      const c = document.createElement('canvas');
      c.width = 98;
      c.height = 120;
      DRAWN[n]?.(c.getContext('2d')!, c.width, c.height);
      this.pic.replaceChildren(c);
    }
    this.timer = window.setTimeout(() => this.show(n + 1), SHOW_FOR);
  }

  private end(): void {
    window.clearTimeout(this.timer);
    this.root.hidden = true;
    const d = this.done;
    this.done = null;
    d?.();
  }
}
