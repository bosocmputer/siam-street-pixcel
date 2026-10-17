// Skill buttons with their cooldown, the chosen slime's health bar, and damage numbers.

import { skill, type Vec3 } from '@newgame/rpg-core';
import type { Combat, HitEvent } from '../combat';
import type { SlimeHerd } from '../slime';
import { TH } from '../th';
import { el } from './dom';

/** turns a point in map metres into screen pixels, or null when it is behind the camera */
export type ToScreen = (p: Vec3 | null) => [number, number] | null;

interface Floating {
  e: HTMLElement;
  at: Vec3;
  /** seconds since it appeared; below 0 it waits before showing */
  t: number;
}

export class CombatHud {
  private buttons = new Map<string, HTMLButtonElement>();
  private bar = el('div', 'hpbar');
  private fill = el('div', 'hpfill');
  private numbers: Floating[] = [];

  /** `slots` are the skill ids on the buttons, in order; pressing one calls `onPress(slot)`. */
  constructor(
    private root: HTMLElement,
    slots: string[],
    onPress: (slot: number) => void,
  ) {
    const box = el('div', 'skills');
    slots.forEach((id, i) => {
      const spec = skill(id);
      const b = el('button', `skill skill-${spec.element}`);
      b.type = 'button';
      b.dataset.skill = id;
      b.append(
        el('span', 'skill-orb'),
        el('span', 'skill-name', TH.skills[id] ?? id),
        el('span', 'skill-cost', String(spec.cost)),
      );
      b.addEventListener('click', () => {
        onPress(i);
        b.blur(); // keep the keyboard for walking
      });
      box.append(b);
      this.buttons.set(id, b);
    });
    this.bar.append(this.fill);
    this.bar.hidden = true;
    root.append(box, this.bar);
  }

  /** Numbers pop out above the slime, a little to one side so they do not stack up. */
  hit(h: HitEvent, slimeHeight: number): void {
    const top = slimeHeight + 0.35;
    const side = (Math.random() - 0.5) * 0.8;
    const n = el('div', `dmg dmg-${h.element}`, String(h.damage));
    this.root.append(n);
    this.numbers.push({ e: n, at: [h.at[0] + side, top, h.at[2]], t: 0 });
    if (h.defeated) {
      const m = el('div', 'dmg dmg-melt', TH.melted);
      this.root.append(m);
      this.numbers.push({ e: m, at: [h.at[0], top + 0.5, h.at[2]], t: -0.15 });
    }
  }

  /** Numbers run on game time, so they wait while the game is stopped. */
  age(dt: number): void {
    for (const n of this.numbers) n.t += dt;
  }

  /** Shake a button whose skill could not be used (not enough energy). */
  refuse(id: string): void {
    const b = this.buttons.get(id);
    if (!b) return;
    b.classList.remove('refused');
    void b.offsetWidth; // restart the animation
    b.classList.add('refused');
  }

  draw(combat: Combat, herd: SlimeHerd, toScreen: ToScreen, energy: number): void {
    for (const [id, b] of this.buttons) {
      const spec = skill(id);
      const left = (combat.cooldowns[id] ?? 0) / spec.cooldown;
      b.style.setProperty('--cd', left.toFixed(3));
      b.dataset.ready = String(left === 0);
      b.dataset.low = String(energy < spec.cost);
    }
    const t = combat.target;
    const aim = t !== null ? herd.aimPoint(t) : null;
    const at = aim ? toScreen([aim[0], herd.height + 1.35, aim[2]]) : null;
    this.bar.hidden = !at;
    if (at && t !== null) {
      this.bar.style.transform = `translate(-50%, -100%) translate(${at[0]}px, ${at[1]}px)`;
      this.fill.style.width = `${herd.hp(t)}%`;
    }
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i]!;
      const k = Math.max(0, n.t) / 0.9;
      const p = toScreen([n.at[0], n.at[1] + k * 1.2, n.at[2]]);
      if (k >= 1 || !p) {
        n.e.remove();
        this.numbers.splice(i, 1);
        continue;
      }
      n.e.style.opacity = n.t < 0 ? '0' : String(Math.min(1, (1 - k) * 2.5));
      n.e.style.transform = `translate(-50%, -50%) translate(${p[0]}px, ${p[1]}px) scale(${1 + Math.max(0, 0.25 - k) * 2})`;
    }
  }
}
