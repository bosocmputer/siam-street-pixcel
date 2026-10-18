// Skill buttons with their cooldown, the chosen slime's health bar, and damage numbers.

import { skill, type Vec3 } from '@newgame/rpg-core';
import type { Combat, HitEvent } from '../combat';
import type { SlimeHerd } from '../slime';
import { TH } from '../th';
import { el } from './dom';
import { ICONS, pxIcon, type IconName } from './pixelIcons';

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
  /** the chosen slime's name and weakness over its health bar */
  private box = el('div', 'hpbox');
  private name = el('div', 'hpname');
  private bar = el('div', 'hpbar');
  private fill = el('div', 'hpfill');
  private shownName = '';
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
      const pic = el('span', 'skill-pic');
      pic.innerHTML = spec.element in ICONS ? pxIcon(spec.element as IconName, 'px-ico') : '';
      b.append(
        el('span', 'skill-orb'),
        pic,
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
    this.box.append(this.name, this.bar);
    this.box.hidden = true;
    root.append(box, this.box);
  }

  /** Numbers pop out above the slime, a little to one side so they do not stack up. */
  hit(h: HitEvent): void {
    const top = h.height + 0.35;
    const side = (Math.random() - 0.5) * 0.8;
    // a hit on a weakness is big and ends with "!", on something that resists it small and grey
    const kind = h.takes > 1 ? ' dmg-weak' : h.takes < 1 ? ' dmg-resist' : '';
    const n = el('div', `dmg dmg-${h.element}${kind}`, `${h.damage}${h.takes > 1 ? '!' : ''}`);
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
    const at = aim && t !== null ? toScreen([aim[0], herd.heightOf(t) + 1.0, aim[2]]) : null;
    this.box.hidden = !at;
    if (at && t !== null) {
      this.box.style.transform = `translate(-50%, -100%) translate(${Math.round(at[0])}px, ${Math.round(at[1])}px)`;
      this.fill.style.width = `${(100 * herd.hpRatio(t)).toFixed(1)}%`;
      const spec = herd.species(t);
      if (spec.id !== this.shownName) {
        this.shownName = spec.id;
        const weak = (['fire', 'water'] as const).find((e) => spec.takes[e] > 1);
        this.name.textContent =
          (TH.monsters[spec.id] ?? spec.id) + (weak ? ` · ${TH.weakTo(TH.elements[weak]!)}` : '');
      }
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
      // whole pixels keep the pixel font sharp; a number hops up at first, then drifts
      const hop = k < 0.12 ? -8 : 0;
      n.e.style.transform = `translate(-50%, -50%) translate(${Math.round(p[0])}px, ${Math.round(p[1]) + hop}px)`;
    }
  }
}
