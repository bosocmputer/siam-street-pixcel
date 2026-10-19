// The fighting buttons round the right thumb (layout A, approved on the HUD mockup): a big strike
// button with the chain of hits under it, dash beside it, the two skills above, and the target
// button. Also the combo count with its gauge, a combo's name shown big, the chosen slime's health
// bar, and damage numbers.

import {
  MELEE,
  comboGauge,
  skill,
  type Fighter,
  type PressAction,
  type Vec3,
} from '@newgame/rpg-core';
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
  readonly strikeButton: HTMLButtonElement;
  readonly dashButton: HTMLButtonElement;
  private chain = el('div', 'chain');
  private combo = el('div', 'combo');
  private comboCount = el('b', '');
  private gauge = el('i', '');
  private banner = el('div', 'banner');
  private bannerTimer = 0;
  /** the chosen slime's name and weakness over its health bar */
  private box = el('div', 'hpbox');
  private name = el('div', 'hpname');
  private bar = el('div', 'hpbar');
  private fill = el('div', 'hpfill');
  private shownName = '';
  private numbers: Floating[] = [];

  /**
   * `slots` are the skill ids on the skill buttons, in order. A button sends its action to
   * `act`: `down` true when pressed, false when let go (dash is held to guard).
   */
  constructor(
    private root: HTMLElement,
    slots: string[],
    act: (a: PressAction, down: boolean) => void,
  ) {
    const button = (cls: string, icon: IconName, label: string, action: PressAction) => {
      const b = el('button', `fight ${cls}`);
      b.type = 'button';
      b.dataset.act = action;
      b.innerHTML = pxIcon(icon, 'px-ico');
      b.append(el('small', 'fight-name', label));
      // pressed the moment a finger lands, so quick strikes are not lost; let go anywhere
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        act(action, true);
      });
      const up = () => act(action, false);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    };
    this.strikeButton = button('strike', 'strike', TH.strike, 'strike');
    this.dashButton = button('dash', 'dash', TH.dash, 'dash');
    this.dashButton.append(el('span', 'skill-orb'));
    const aim = button('aim', 'target', '', 'target');
    aim.setAttribute('aria-label', TH.target);
    for (let i = 0; i < 3; i++) this.chain.append(el('i', ''));
    const g = el('div', 'gauge');
    g.append(this.gauge);
    this.combo.append(this.comboCount, el('span', '', TH.combo), g);
    root.append(this.strikeButton, this.dashButton, aim, this.chain, this.combo, this.banner);

    slots.forEach((id, i) => {
      const spec = skill(id);
      const b = el('button', `skill skill-${spec.element} skill-${i + 1}`);
      b.type = 'button';
      b.dataset.skill = id;
      b.setAttribute('aria-label', TH.skills[id] ?? id);
      const pic = el('span', 'skill-pic');
      pic.innerHTML = spec.element in ICONS ? pxIcon(spec.element as IconName, 'px-ico') : '';
      b.append(
        el('span', 'skill-orb'),
        pic,
        el('span', 'skill-name', TH.elements[spec.element] ?? spec.element),
        el('span', 'skill-cost', String(spec.cost)),
      );
      b.addEventListener('click', () => {
        act(i === 0 ? 'skill1' : 'skill2', true);
        b.blur(); // keep the keyboard for walking
      });
      root.append(b);
      this.buttons.set(id, b);
    });
    this.bar.append(this.fill);
    this.box.append(this.name, this.bar);
    this.box.hidden = true;
    root.append(this.box);
  }

  /** The skill buttons show once there are skills to use (they come with a job). */
  setSkills(open: boolean): void {
    for (const b of this.buttons.values()) b.hidden = !open;
  }

  /** Numbers pop out above the slime, a little to one side so they do not stack up. */
  hit(h: HitEvent): void {
    const top = h.height + 0.35;
    const side = (Math.random() - 0.5) * 0.8;
    // a hit on a weakness is big and ends with "!", on something that resists it small and grey;
    // a critical strike is yellow with "!"
    const kind =
      h.takes > 1 ? ' dmg-weak' : h.takes < 1 ? ' dmg-resist' : h.crit ? ' dmg-crit' : '';
    const loud = h.takes > 1 || h.crit ? '!' : '';
    const n = el('div', `dmg dmg-${h.element ?? 'strike'}${kind}`, `${h.damage}${loud}`);
    this.root.append(n);
    this.numbers.push({ e: n, at: [h.at[0] + side, top, h.at[2]], t: 0 });
    if (h.defeated) {
      const m = el('div', 'dmg dmg-melt', TH.melted);
      this.root.append(m);
      this.numbers.push({ e: m, at: [h.at[0], top + 0.5, h.at[2]], t: -0.15 });
    }
  }

  /** A word shown big in the middle for a moment: a combo's name, a perfect dodge. */
  announce(text: string): void {
    this.banner.textContent = text;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth; // restart the animation
    this.banner.classList.add('show');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), 1000);
  }

  /** what the banner says now (for tests) */
  get announced(): string {
    return this.banner.classList.contains('show') ? (this.banner.textContent ?? '') : '';
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

  draw(
    combat: Combat,
    herd: SlimeHerd,
    toScreen: ToScreen,
    energy: number,
    fighter: Fighter,
  ): void {
    for (const [id, b] of this.buttons) {
      const spec = skill(id);
      const left = (combat.cooldowns[id] ?? 0) / spec.cooldown;
      b.style.setProperty('--cd', left.toFixed(3));
      b.dataset.ready = String(left === 0);
      b.dataset.low = String(energy < spec.cost);
    }
    this.dashButton.style.setProperty(
      '--cd',
      (fighter.dashCooldown / MELEE.dash.cooldown).toFixed(3),
    );
    this.dashButton.dataset.guard = String(fighter.guarding);
    this.strikeButton.dataset.counter = String(fighter.counter);
    // the hits of the chain made so far; the last one is the heavy finisher
    const chained = fighter.swing || fighter.sinceSwing <= MELEE.strike.chainWindow;
    Array.from(this.chain.children).forEach((d, i) => {
      d.className = chained && i < fighter.chain ? (i === 2 ? 'fin' : 'on') : '';
    });
    this.combo.classList.toggle('show', fighter.combo >= 2);
    this.comboCount.textContent = String(fighter.combo);
    this.gauge.style.width = `${Math.round(comboGauge(fighter.combo) * 100)}%`;

    const t = combat.target;
    // the name and health show with the target marker, while fighting it
    const aim = t !== null && combat.marker.visible ? herd.aimPoint(t) : null;
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
