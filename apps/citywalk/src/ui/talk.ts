// The dialogue box at the bottom of the screen (approved first-minute mockup, step 4): a face, a
// name and at most three sentences a page. A tap anywhere shows the next page; "skip" ends it.
// The fighting buttons hide while someone talks.

import { el } from './dom';

/** A face drawn in a few pixels (until the characters have portraits). */
export type Face = (g: CanvasRenderingContext2D) => void;

const SIZE = 18;

export class Talk {
  readonly root = el('div', 'talk');
  private face = document.createElement('canvas');
  private who = el('div', 'talk-who');
  private say = el('div', 'talk-say');
  private skip = el('button', 'talk-skip');
  private next = el('div', 'talk-next');
  private pages: string[] = [];
  private page = 0;
  private done: (() => void) | null = null;

  constructor(skipLabel: string, nextLabel: string) {
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.face.width = this.face.height = SIZE;
    this.face.className = 'talk-face';
    this.skip.type = 'button';
    this.skip.textContent = skipLabel;
    this.next.textContent = nextLabel;
    const foot = el('div', 'talk-foot');
    foot.append(this.skip, this.next);
    this.root.append(this.face, this.who, this.say, foot);
    this.root.addEventListener('click', (e) => {
      if (e.target === this.skip) this.close();
      else this.turn();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  /** what is on the page now (for tests) */
  get text(): string {
    return this.isOpen ? (this.say.textContent ?? '') : '';
  }

  /** Show what someone says, page by page; resolves when the last page is read or skipped. */
  open(name: string, pages: string[], face: Face): Promise<void> {
    this.who.textContent = name;
    const g = this.face.getContext('2d')!;
    g.clearRect(0, 0, SIZE, SIZE);
    face(g);
    this.pages = pages;
    this.page = 0;
    this.say.textContent = pages[0] ?? '';
    this.root.hidden = false;
    document.body.classList.add('talking');
    return new Promise((ok) => (this.done = ok));
  }

  /** the next page, or close after the last */
  turn(): void {
    if (!this.isOpen) return;
    this.page++;
    if (this.page >= this.pages.length) return this.close();
    this.say.textContent = this.pages[this.page]!;
  }

  close(): void {
    if (!this.isOpen) return;
    this.root.hidden = true;
    document.body.classList.remove('talking');
    const d = this.done;
    this.done = null;
    d?.();
  }
}

/** Pa Saeng's face: grey hair, a warm smile, an orange apron. */
export const PA_SAENG_FACE: Face = (g) => {
  const r = (col: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  r('#3a4466', 0, 0, 18, 18);
  r('#5a6988', 3, 2, 12, 6);
  r('#8b9bb4', 5, 1, 8, 3);
  r('#e8b796', 4, 5, 10, 10);
  r('#c28569', 4, 13, 10, 2);
  r('#181425', 6, 8, 2, 2);
  r('#181425', 10, 8, 2, 2);
  r('#be4a2f', 7, 12, 4, 1);
  r('#f77622', 3, 15, 12, 3);
  r('#feae34', 7, 15, 4, 3);
};
