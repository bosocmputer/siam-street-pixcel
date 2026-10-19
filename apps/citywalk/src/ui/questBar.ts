// The quest under way, on the left under the player panel (one line; a tap shows the next two),
// the goal's mark over where to go, and the card when a quest is done (approved first-minute
// mockup, steps 3 and 7).

import { el } from './dom';
import { pxSvg } from './pixelIcons';

const EXCL = ['..##..', '..##..', '..##..', '..##..', '......', '..##..'];

export class QuestBar {
  readonly root = el('button', 'quest');
  private name = el('span', 'q-name');
  private todo = el('span', 'q-do');
  private more = el('span', 'q-more');
  /** the "!" over the place to go, with how far it is */
  readonly goal = el('div', 'goal');
  private goalM = el('div', 'g-m');
  private card = el('div', 'sysbox');
  private cardTimer = 0;

  constructor(top: HTMLElement, root: HTMLElement, onTap: () => void) {
    this.root.type = 'button';
    const ico = el('span', 'q-ico');
    ico.innerHTML = pxSvg(EXCL, 'px-ico');
    const text = el('span', 'q-text');
    text.append(this.name, this.todo, this.more);
    this.root.append(ico, text);
    this.root.hidden = true;
    this.more.hidden = true;
    this.root.addEventListener('click', () => {
      this.more.hidden = !this.more.hidden || !this.more.textContent;
      onTap();
      this.root.blur();
    });
    top.append(this.root);
    const gi = el('div', 'g-ico');
    gi.innerHTML = pxSvg(EXCL, 'px-ico');
    this.goal.append(gi, this.goalM);
    this.goal.hidden = true;
    this.card.hidden = true;
    root.append(this.goal, this.card);
  }

  /** Show the quest under way (null hides the bar), and the next ones for a tap. */
  show(q: { name: string; todo: string; after: string[] } | null): void {
    this.root.hidden = !q;
    if (!q) return;
    this.name.textContent = q.name;
    this.todo.textContent = q.todo;
    this.more.textContent = q.after.join(' › ');
    if (!q.after.length) this.more.hidden = true;
  }

  /** Put the goal's mark at this screen point (null hides it), with the distance in metres. */
  mark(at: [number, number] | null, metres: number, unit: (m: number) => string): void {
    this.goal.hidden = !at;
    if (!at) return;
    this.goal.style.transform = `translate(-50%, -100%) translate(${Math.round(at[0])}px, ${Math.round(at[1])}px)`;
    this.goalM.textContent = unit(Math.round(metres));
  }

  /** The card for a finished quest: its name and what it gave, for a couple of seconds. */
  done(title: string, rewards: string[]): void {
    this.card.replaceChildren(el('div', 't', title));
    const r = el('div', 'r');
    for (const x of rewards) r.append(el('span', '', x));
    if (rewards.length) this.card.append(r);
    this.card.hidden = false;
    window.clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => (this.card.hidden = true), 2400);
  }

  /** the card's words now (for tests) */
  get shown(): string {
    return this.card.hidden ? '' : (this.card.textContent ?? '');
  }
}
