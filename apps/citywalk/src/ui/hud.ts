// The always-on screen parts: title, nearest place, setting chips, movement buttons, messages,
// map credit, and name tags floating over the gates and corners.

import * as THREE from 'three';
import type { MoveMode } from '@newgame/rpg-core';
import { TH } from '../th';
import type { Landmark } from '../types';
import { el } from './dom';

export const MODES: MoveMode[] = ['walk', 'run', 'bike'];

export interface Chip {
  id: string;
  label: string;
  value: () => string;
  onClick: () => void;
}

export class Hud {
  readonly top = el('div', 'top');
  private near = el('div', 'near');
  private chips = el('div', 'chips');
  private modes = el('div', 'modes');
  private toast = el('div', 'toast');
  private modeButtons: HTMLButtonElement[] = [];
  private chipPaints: (() => void)[] = [];
  private tags: { m: Landmark; t: HTMLElement }[];
  private visited = new Set<string>();
  private toastTimer = 0;
  private holdUntil = 0;
  /** called when a button on this panel is pressed (for a click sound) */
  onTap: (() => void) | null = null;
  private v = new THREE.Vector3();

  constructor(
    readonly root: HTMLElement,
    landmarks: Landmark[],
    onMode: (m: MoveMode) => void,
    chips: Chip[],
  ) {
    const credit = el('a', 'credit', TH.credit);
    credit.href = 'https://www.openstreetmap.org/copyright';
    credit.target = '_blank';
    credit.rel = 'noopener';
    this.top.append(el('div', 'title', TH.title), this.near, this.chips);
    root.append(this.top, this.modes, this.toast, credit);

    this.modeButtons = MODES.map((m) => {
      const b = el('button', 'mode', TH.modes[m]);
      b.type = 'button';
      b.dataset.mode = m;
      b.addEventListener('click', () => {
        onMode(m);
        this.onTap?.();
        b.blur(); // keep the keyboard for walking
      });
      this.modes.append(b);
      return b;
    });
    for (const c of chips) {
      const b = el('button', 'chip');
      b.type = 'button';
      b.dataset.chip = c.id;
      const paint = () => (b.innerHTML = `<span>${c.label}</span> <b>${c.value()}</b>`);
      b.addEventListener('click', () => {
        c.onClick();
        paint();
        this.onTap?.();
        b.blur(); // keep the keyboard for walking
      });
      paint();
      this.chipPaints.push(paint);
      this.chips.append(b);
    }
    this.tags = landmarks.map((m) => {
      const t = el('div', 'tag', m.name);
      root.append(t);
      return { m, t };
    });
  }

  /** Redraw the chip values after they were changed from elsewhere (e.g. a loaded save). */
  paintChips(): void {
    for (const p of this.chipPaints) p();
  }

  showMode(m: MoveMode): void {
    for (const b of this.modeButtons) b.setAttribute('aria-pressed', String(b.dataset.mode === m));
  }

  /**
   * Show a short message. An `important` one (level up, falling down) is not covered by an
   * ordinary one until it has had its time on screen.
   */
  say(text: string, important = false): void {
    const now = performance.now();
    if (!important && now < this.holdUntil) return;
    if (important) this.holdUntil = now + 2000;
    this.toast.textContent = text;
    this.toast.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), 2600);
  }

  hush(): void {
    this.toast.classList.remove('show');
  }

  /**
   * Move the name tags over their places, show the nearest place, and say when one is reached.
   * Tags slide below `covered` (screen boxes of the top panel, buttons and minimap) rather than
   * cover it; places
   * are only announced while `playing`.
   */
  landmarks(
    me: { x: number; z: number },
    scale: number,
    labels: boolean,
    camera: THREE.Camera,
    covered: readonly DOMRect[],
    playing: boolean,
  ): void {
    let best: Landmark | null = null;
    let bestD = Infinity;
    for (const { m, t } of this.tags) {
      const d = Math.hypot(m.x - me.x, m.z - me.z);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
      this.v.set(m.x * scale, 5.5 * Math.max(scale, 0.5), m.z * scale).project(camera);
      const sy = ((1 - this.v.y) / 2) * window.innerHeight;
      const sx = ((this.v.x + 1) / 2) * window.innerWidth;
      // a tag is about 120 px wide and sits above its point; where that would cover a button or
      // the minimap it slides down to just under it instead of disappearing
      let ty = sy;
      for (const r of covered)
        if (sx > r.left - 60 && sx < r.right + 60 && ty > r.top && ty < r.bottom + 30)
          ty = r.bottom + 30;
      const show = labels && this.v.z < 1 && d * scale < 450 && ty < window.innerHeight * 0.6;
      t.hidden = !show;
      if (show)
        t.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(ty)}px)`;
      if (playing && d < 25 && !this.visited.has(m.name)) {
        this.visited.add(m.name);
        if (labels) this.say(TH.arrived(m.name));
      } else if (d > 70) this.visited.delete(m.name);
    }
    this.near.hidden = !labels || !best;
    if (best) this.near.textContent = TH.near(best.name, Math.round(bestD / 10) * 10);
  }
}
