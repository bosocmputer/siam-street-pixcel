// The player's level, health and energy bars, a thin experience line, and a red flash at the
// edges of the screen when hit.

import { expToNext, maxEnergy, maxHp, pointsLeft, type PlayerStats } from '@newgame/rpg-core';
import { TH } from '../th';
import { el } from './dom';

function bar(
  kind: string,
  label: string,
): { row: HTMLElement; fill: HTMLElement; text: HTMLElement } {
  const row = el('div', `pbar pbar-${kind}`);
  const track = el('div', 'pbar-track');
  const fill = el('div', 'pbar-fill');
  const text = el('span', 'pbar-text');
  track.append(fill);
  row.append(el('span', 'pbar-label', label), track, text);
  return { row, fill, text };
}

export class PlayerHud {
  readonly panel = el('div', 'player');
  private lv = el('div', 'player-lv');
  private hp = bar('hp', TH.hp);
  private energy = bar('energy', TH.energy);
  private exp = el('div', 'player-exp');
  private expFill = el('div', 'player-exp-fill');
  private flash = el('div', 'hurt-flash');
  private shown = '';
  /** a tap on the panel (opens the status window) */
  onOpen: () => void = () => undefined;

  /** The panel goes into `top` right under its first line (the title). */
  constructor(top: HTMLElement) {
    this.exp.append(this.expFill);
    const bars = el('div', 'player-bars');
    bars.append(this.hp.row, this.energy.row);
    this.panel.append(this.lv, bars, this.exp);
    top.insertBefore(this.panel, top.children[1] ?? null);
    this.panel.setAttribute('role', 'button');
    this.panel.tabIndex = 0;
    this.panel.setAttribute('aria-label', TH.status.open);
    this.panel.addEventListener('click', () => this.onOpen());
    this.panel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.onOpen();
    });
    document.body.append(this.flash);
  }

  draw(s: PlayerStats): void {
    const hpMax = maxHp(s.level, undefined, s.attrs),
      enMax = maxEnergy(s.level, undefined, s.attrs),
      left = pointsLeft(s.attrs, s.level),
      expMax = expToNext(s.level);
    // only touch the page when something visible changed
    const key = `${s.level}|${Math.ceil(s.hp)}|${Math.floor(s.energy)}|${s.exp}|${s.down > 0}|${left}`;
    if (key === this.shown) return;
    this.shown = key;
    this.lv.textContent = TH.level(s.level);
    this.hp.fill.style.width = `${(100 * s.hp) / hpMax}%`;
    this.hp.text.textContent = `${Math.ceil(s.hp)}/${hpMax}`;
    this.energy.fill.style.width = `${(100 * s.energy) / enMax}%`;
    this.energy.text.textContent = `${Math.floor(s.energy)}/${enMax}`;
    this.expFill.style.width = `${Math.min(100, (100 * s.exp) / expMax)}%`;
    this.panel.dataset.down = String(s.down > 0);
    this.panel.dataset.points = String(left > 0);
    this.panel.dataset.left = left > 0 ? `+${left}` : '';
    this.panel.dataset.lowHp = String(s.hp / hpMax < 0.3);
  }

  /** A short red flash at the edges of the screen. */
  hurt(): void {
    this.flash.classList.remove('on');
    void this.flash.offsetWidth; // restart the animation
    this.flash.classList.add('on');
  }
}
