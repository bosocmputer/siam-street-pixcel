// The always-on screen parts: title, nearest place, the settings button and its chips, messages,
// map credit, and name tags floating over the gates and corners.

import * as THREE from 'three';
import { TH } from '../th';
import type { Landmark } from '../types';
import { el } from './dom';
import { pxIcon } from './pixelIcons';

export interface Chip {
  id: string;
  label: string;
  value: () => string;
  onClick: () => void;
}

export class Hud {
  readonly top = el('div', 'top');
  private near = el('div', 'near');
  /** the settings chips, shown under the gear button */
  private chips = el('div', 'chips');
  readonly gear = el('button', 'gear');
  private toast = el('div', 'toast');
  private chipPaints: (() => void)[] = [];
  private tags: { m: Landmark; t: HTMLElement }[];
  private visited = new Set<string>();
  /** the first frame of play: places the player starts at are known, not arrived at */
  private started = false;
  private toastTimer = 0;
  private holdUntil = 0;
  /** called when a button on this panel is pressed (for a click sound) */
  onTap: (() => void) | null = null;
  private v = new THREE.Vector3();

  constructor(
    readonly root: HTMLElement,
    landmarks: Landmark[],
    chips: Chip[],
  ) {
    const credit = el('a', 'credit', TH.credit);
    credit.href = 'https://www.openstreetmap.org/copyright';
    credit.target = '_blank';
    credit.rel = 'noopener';
    this.top.append(el('div', 'title', TH.title), this.near);
    this.gear.type = 'button';
    this.gear.innerHTML = pxIcon('gear');
    this.gear.setAttribute('aria-label', TH.settings);
    this.gear.setAttribute('aria-expanded', 'false');
    this.chips.hidden = true;
    this.gear.addEventListener('click', () => {
      this.showSettings(this.chips.hidden);
      this.onTap?.();
      this.gear.blur();
    });
    root.append(this.top, this.gear, this.chips, this.toast, credit);

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

  /** Open or close the settings chips under the gear. */
  showSettings(open: boolean): void {
    this.chips.hidden = !open;
    this.gear.setAttribute('aria-expanded', String(open));
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
      // sliding under one box can land it on another (the gear under the map): check again
      for (let moved = true, n = 0; moved && n < 4; n++) {
        moved = false;
        for (const r of covered)
          if (sx > r.left - 60 && sx < r.right + 60 && ty > r.top && ty < r.bottom + 30) {
            ty = r.bottom + 30;
            moved = true;
          }
      }
      const show = labels && this.v.z < 1 && d * scale < 450 && ty < window.innerHeight * 0.6;
      t.hidden = !show;
      if (show)
        t.style.transform = `translate(-50%, -100%) translate(${Math.round(sx)}px, ${Math.round(ty)}px)`;
      if (playing && d < 25 && !this.visited.has(m.name)) {
        this.visited.add(m.name);
        if (labels && this.started) this.say(TH.arrived(m.name));
      } else if (d > 70) this.visited.delete(m.name);
    }
    if (playing) this.started = true;
    this.near.hidden = !labels || !best;
    if (best) this.near.textContent = TH.near(best.name, Math.round(bestD / 10) * 10);
  }
}
