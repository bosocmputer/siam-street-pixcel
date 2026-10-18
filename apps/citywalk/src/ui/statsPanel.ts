// The status window (mockup approved 18 Oct 2026): the attribute wheel, the job the attributes
// would give at the job level, and + / − to place the points from levelling up.

import {
  ATTR,
  ATTRS,
  addPoints,
  expToNext,
  leaning,
  pickJob,
  pointsLeft,
  type Attr,
  type Attrs,
} from '@newgame/rpg-core';
import { TH } from '../th';
import { el } from './dom';

/** colour of each attribute (also the aura colours in the GDD) */
export const ATTR_COLOR: Record<Attr, string> = {
  str: '#ff5a4e',
  agi: '#34d399',
  dex: '#b07cff',
  int: '#4aa8ff',
  vit: '#ffc845',
};
const JOB_ICON: Record<string, string> = {
  striker: '<path d="M5 19 19 5M14 5h5v5M5 14l5 5M3 21l3-3"/>',
  ranger: '<path d="M6 3c7 3 7 15 0 18M6 3v18M4 12h16M17 9l3 3-3 3"/>',
  elementalist: '<path d="M12 3c3 4 5 6 5 9a5 5 0 0 1-10 0c0-3 2-5 5-9Z"/>',
  cleric: '<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z"/><path d="M5 19 13 11"/>',
  guardian: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/>',
  freelancer: '<path d="M12 3 20 12 12 21 4 12Z"/><path d="M4 12h16M12 3v18"/>',
};
const ZERO = (): Attrs => ({ str: 0, agi: 0, dex: 0, int: 0, vit: 0 });

export interface StatusOf {
  name: string;
  level: number;
  exp: number;
  attrs: Attrs;
}

export class StatsPanel {
  readonly root = el('div', 'status');
  private add = ZERO();
  private shown = '';
  private nameEl = el('span', 'st-name');
  private lvEl = el('b', '');
  private xp = el('i', '');
  private radar = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  private job = el('div', 'st-job');
  private rows = el('div', 'st-rows');
  private pts = el('b', '');
  private undo = el('button', 'st-undo');
  private confirm = el('button', 'cr-primary st-confirm', TH.status.confirm);
  private ask = el('div', 'cr-sheet-bg');
  private askList = el('div', 'st-chips');
  private toast = el('div', 'st-toast');
  private toastTimer = 0;
  /** called after the window closes */
  onClose: () => void = () => undefined;

  constructor(
    private now: () => StatusOf,
    /** keep the new attributes */
    private commit: (a: Attrs) => void,
    private tap: () => void = () => undefined,
  ) {
    const S = TH.status;
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', S.title);
    const inner = el('div', 'st-in');

    const head = el('div', 'st-head');
    const lv = el('span', 'st-lv', 'LV');
    lv.append(this.lvEl);
    const close = el('button', 'cr-icon st-close');
    close.type = 'button';
    close.setAttribute('aria-label', S.close);
    close.innerHTML =
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    close.addEventListener('click', () => {
      this.tap();
      this.close();
    });
    head.append(this.nameEl, lv, close);
    const bar = el('div', 'st-xp');
    bar.append(this.xp);

    this.radar.setAttribute('viewBox', '0 0 300 268');
    this.radar.setAttribute('class', 'st-radar');
    this.radar.setAttribute('role', 'img');

    const list = el('div', 'st-list');
    const lh = el('div', 'st-lh');
    const p = el('span', '', S.points);
    p.append(this.pts);
    lh.append(el('span', '', S.title), p);
    list.append(lh, this.rows);
    this.rows.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b || b.disabled) return;
      const k = b.dataset.a as Attr;
      const d = Number(b.dataset.d);
      const s = this.now();
      if (d > 0 && pointsLeft(this.sum(s.attrs), s.level) <= 0) return;
      if (d < 0 && this.add[k] <= 0) return;
      this.tap();
      this.add[k] += d;
      this.paint();
    });

    const foot = el('div', 'st-foot');
    this.undo.type = 'button';
    this.undo.setAttribute('aria-label', S.undo);
    this.undo.innerHTML =
      '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>';
    this.undo.addEventListener('click', () => {
      this.tap();
      this.add = ZERO();
      this.paint();
    });
    this.confirm.type = 'button';
    this.confirm.addEventListener('click', () => {
      this.tap();
      this.askList.replaceChildren(
        ...ATTRS.filter((k) => this.add[k]).map((k) =>
          el('span', '', `${TH.attrs[k]} +${this.add[k]}`),
        ),
      );
      this.ask.hidden = false;
    });
    foot.append(this.undo, this.confirm);

    // asked once more before the points are kept
    this.ask.hidden = true;
    const sheet = el('div', 'cr-sheet');
    sheet.setAttribute('role', 'dialog');
    const two = el('div', 'st-two');
    const no = el('button', 'st-ghost', S.back);
    no.type = 'button';
    no.addEventListener('click', () => {
      this.tap();
      this.ask.hidden = true;
    });
    const yes = el('button', 'cr-primary', S.confirm);
    yes.type = 'button';
    yes.addEventListener('click', () => {
      const s = this.now();
      const next = addPoints(s.attrs, this.add, s.level);
      this.ask.hidden = true;
      if (!next) return;
      this.tap();
      this.commit(next);
      this.add = ZERO();
      this.paint();
      this.say(S.saved, 1400);
    });
    two.append(no, yes);
    sheet.append(el('h2', '', S.confirmTitle), this.askList, two);
    this.ask.append(sheet);

    this.toast.hidden = true;
    inner.append(head, bar, this.radar, this.job, list, foot);
    this.root.append(inner, this.toast, this.ask);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(): void {
    this.add = ZERO();
    this.shown = '';
    this.root.hidden = false;
    this.paint();
    const s = this.now();
    if (s.level >= Math.min(...ATTR.hintLevels)) this.say(TH.hint(TH.attrs[leaning(s.attrs)]!));
    (this.root.querySelector('.st-close') as HTMLElement).focus();
  }

  close(): void {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.ask.hidden = true;
    this.onClose();
  }

  /** The points not yet confirmed (for tests). */
  get pending(): Attrs {
    return { ...this.add };
  }

  private sum(a: Attrs): Attrs {
    return Object.fromEntries(ATTRS.map((k) => [k, a[k] + this.add[k]])) as Attrs;
  }

  private say(text: string, ms = 2600): void {
    this.toast.textContent = text;
    this.toast.hidden = false;
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), ms);
  }

  private paint(): void {
    const s = this.now();
    const v = this.sum(s.attrs);
    const left = pointsLeft(v, s.level);
    const dirty = ATTRS.some((k) => this.add[k]);
    this.nameEl.textContent = s.name;
    this.lvEl.textContent = String(s.level);
    this.xp.style.width = `${Math.min(100, (100 * s.exp) / expToNext(s.level))}%`;
    this.pts.textContent = String(left);
    this.rows.replaceChildren(
      ...ATTRS.map((k) => {
        const row = el('div', 'st-row');
        row.style.setProperty('--c', ATTR_COLOR[k]);
        const val = el('span', 'st-val', String(v[k]));
        if (this.add[k]) val.append(el('small', '', `+${this.add[k]}`));
        const btn = (d: number, label: string, on: boolean) => {
          const b = el('button', 'st-pm', d > 0 ? '+' : '−');
          b.type = 'button';
          b.dataset.a = k;
          b.dataset.d = String(d);
          b.disabled = !on;
          b.setAttribute('aria-label', `${label}${TH.attrs[k]}`);
          return b;
        };
        row.append(
          el('span', 'st-dot'),
          el('span', 'st-attr', TH.attrs[k]),
          val,
          btn(-1, '−', this.add[k] > 0),
          btn(1, '+', left > 0),
        );
        return row;
      }),
    );
    const pick = pickJob(v);
    this.drawRadar(s.attrs, v, pick.job, pick.ties);
    const spec = ATTR.jobs.find((j) => j.id === pick.job);
    const [a, b] = spec ? spec.between.map((x) => ATTR_COLOR[x]) : ['#ffffff', '#c9c4ff'];
    this.job.innerHTML = `
      <div class="st-ic" style="--a:${a};--b:${b}"><svg viewBox="0 0 24 24" aria-hidden="true">${JOB_ICON[pick.job] ?? ''}</svg></div>
      <div><div class="st-k">${TH.status.jobAt(ATTR.jobLevel)}</div><div class="st-n">${TH.jobs[pick.job]}</div></div>
      <span class="st-r">${TH.jobRoles[pick.job]}</span>`;
    if (this.shown && this.shown !== pick.job) {
      this.job.classList.remove('flip');
      void this.job.offsetWidth;
      this.job.classList.add('flip');
    }
    this.shown = pick.job;
    this.job.dataset.job = pick.job;
    this.undo.disabled = !dirty;
    this.confirm.disabled = !dirty;
  }

  private drawRadar(locked: Attrs, v: Attrs, job: string, ties: string[]): void {
    const cx = 150,
      cy = 138,
      R = 90;
    const order = ATTR.order;
    const top = Math.max(18, Math.ceil(Math.max(...order.map((k) => v[k])) * 1.12));
    const pt = (i: number, r: number) => {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
    };
    const poly = (a: Attrs) =>
      order
        .map((k, i) =>
          pt(i, (R * a[k]) / top)
            .map((n) => n.toFixed(1))
            .join(','),
        )
        .join(' ');
    let s = `<defs><filter id="st-glow" filterUnits="userSpaceOnUse" x="0" y="0" width="300" height="268"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    ATTR.jobs.forEach((j, i) => {
      const [x1, y1] = pt(i, R),
        [x2, y2] = pt((i + 1) % order.length, R);
      s += `<linearGradient id="st-e${i}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="${ATTR_COLOR[j.between[0]]}"/><stop offset="1" stop-color="${ATTR_COLOR[j.between[1]]}"/></linearGradient>`;
    });
    s += '</defs>';
    for (const k of [0.34, 0.67, 1])
      s += `<polygon points="${order.map((_, i) => pt(i, R * k).join(',')).join(' ')}" fill="none" stroke="rgba(255,255,255,${k === 1 ? 0.12 : 0.06})"/>`;
    ATTR.jobs.forEach((j, i) => {
      const on = j.id === job,
        tie = !on && ties.includes(j.id);
      if (!on && !tie) return;
      const [x1, y1] = pt(i, R),
        [x2, y2] = pt((i + 1) % order.length, R);
      s += `<line class="${tie ? 'st-tie' : 'st-on'}" data-job="${j.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#st-e${i})" stroke-width="${on ? 4 : 3}" stroke-linecap="round" ${on ? 'filter="url(#st-glow)"' : 'opacity="0.7"'}/>`;
    });
    s += `<polygon points="${poly(locked)}" fill="rgba(238,240,246,0.08)" stroke="rgba(238,240,246,0.55)" stroke-width="1.2" stroke-linejoin="round"/>`;
    if (ATTRS.some((k) => this.add[k]))
      s += `<polygon points="${poly(v)}" fill="rgba(255,149,0,0.12)" stroke="#ff9500" stroke-width="1.6" stroke-linejoin="round"/>`;
    order.forEach((k, i) => {
      const [x, y] = pt(i, (R * v[k]) / top);
      s += `<circle cx="${x}" cy="${y}" r="3.2" fill="${ATTR_COLOR[k]}"/>`;
      const [lx, ly] = pt(i, R + 24);
      s += `<text x="${lx}" y="${ly - 3}" text-anchor="middle" class="st-tl">${TH.attrs[k]}</text>`;
      s += `<text x="${lx}" y="${ly + 14}" text-anchor="middle" class="st-tv${this.add[k] ? ' up' : ''}">${v[k]}</text>`;
    });
    this.radar.innerHTML = s;
    this.radar.setAttribute(
      'aria-label',
      `${TH.status.title}: ${order.map((k) => `${TH.attrs[k]} ${v[k]}`).join(', ')}`,
    );
  }
}
