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
import { pxIcon, type IconName } from './pixelIcons';

/** colour of each attribute (also the aura colours in the GDD) */
export const ATTR_COLOR: Record<Attr, string> = {
  str: '#ff5a4e',
  agi: '#34d399',
  dex: '#b07cff',
  int: '#4aa8ff',
  vit: '#ffc845',
};
const JOB_ICONS = new Set<string>([
  'striker',
  'ranger',
  'elementalist',
  'cleric',
  'guardian',
  'freelancer',
]);
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
    close.innerHTML = pxIcon('close', 'ico');
    close.addEventListener('click', () => {
      this.tap();
      this.close();
    });
    head.append(this.nameEl, lv, close);
    const bar = el('div', 'st-xp');
    bar.append(this.xp);

    this.radar.setAttribute('viewBox', '0 0 150 134');
    this.radar.setAttribute('shape-rendering', 'crispEdges');
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
    this.undo.innerHTML = pxIcon('undo', 'ico');
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
      <div class="st-ic" style="--a:${a};--b:${b}">${JOB_ICONS.has(pick.job) ? pxIcon(pick.job as IconName) : ''}</div>
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

  /**
   * The attribute wheel drawn in pixels: a 150×134 grid shown at twice the size. Lines are laid
   * pixel by pixel, the areas filled with a checker so the grid shows through.
   */
  private drawRadar(locked: Attrs, v: Attrs, job: string, ties: string[]): void {
    const cx = 75,
      cy = 69,
      R = 45;
    const order = ATTR.order;
    const top = Math.max(18, Math.ceil(Math.max(...order.map((k) => v[k])) * 1.12));
    const pt = (i: number, r: number): [number, number] => {
      const a = ((-90 + i * 72) * Math.PI) / 180;
      return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
    };
    const shape = (a: Attrs) => order.map((k, i) => pt(i, (R * a[k]) / top));
    const layers: { cls?: string; job?: string; px: Map<string, string> }[] = [];
    const layer = (cls?: string, jobId?: string) => {
      const l = { cls, job: jobId, px: new Map<string, string>() };
      layers.push(l);
      return l.px;
    };
    const line = (
      px: Map<string, string>,
      [x0, y0]: [number, number],
      [x1, y1]: [number, number],
      colour: (t: number) => string,
      thick = 1,
    ) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let s = 0; s <= n; s++) {
        const x = Math.round(x0 + ((x1 - x0) * s) / n),
          y = Math.round(y0 + ((y1 - y0) * s) / n);
        for (let d = 0; d < thick; d++) px.set(`${x + d},${y}`, colour(s / n));
      }
    };
    const ring = (px: Map<string, string>, pts: [number, number][], colour: string) =>
      pts.forEach((p, i) => line(px, p, pts[(i + 1) % pts.length]!, () => colour));
    const fill = (px: Map<string, string>, pts: [number, number][], colour: string) => {
      for (let y = 0; y < 134; y++)
        for (let x = 0; x < 150; x++) {
          if ((x + y) % 2) continue;
          let inside = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const [xi, yi] = pts[i]!,
              [xj, yj] = pts[j]!;
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) px.set(`${x},${y}`, colour);
        }
    };
    const grid = layer();
    for (const k of [0.34, 0.67, 1])
      ring(
        grid,
        order.map((_, i) => pt(i, R * k)),
        k === 1 ? '#5a6988' : '#3a4466',
      );
    ATTR.jobs.forEach((j, i) => {
      const on = j.id === job,
        tie = !on && ties.includes(j.id);
      if (!on && !tie) return;
      const [a, b] = j.between.map((x) => ATTR_COLOR[x]);
      line(
        layer(tie ? 'st-tie' : 'st-on', j.id),
        pt(i, R),
        pt((i + 1) % order.length, R),
        (t) => (t < 0.5 ? a! : b!),
        on ? 2 : 1,
      );
    });
    const shapes = layer();
    fill(shapes, shape(locked), '#5a6988');
    ring(shapes, shape(locked), '#c0cbdc');
    if (ATTRS.some((k) => this.add[k])) {
      fill(shapes, shape(v), '#be4a2f');
      ring(shapes, shape(v), '#f77622');
    }
    order.forEach((k, i) => {
      const [x, y] = pt(i, (R * v[k]) / top);
      for (const [dx, dy] of [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ])
        shapes.set(`${x + dx!},${y + dy!}`, ATTR_COLOR[k]);
    });
    let s = '';
    for (const l of layers) {
      const byColour = new Map<string, string>();
      for (const [key, c] of l.px) {
        const [x, y] = key.split(',');
        byColour.set(c, (byColour.get(c) ?? '') + `M${x} ${y}h1v1h-1z`);
      }
      let body = '';
      for (const [c, d] of byColour) body += `<path d="${d}" fill="${c}"/>`;
      s += l.cls ? `<g class="${l.cls}" data-job="${l.job}">${body}</g>` : body;
    }
    order.forEach((k, i) => {
      const [lx, ly] = pt(i, R + 14);
      s += `<text x="${lx}" y="${ly - 1}" text-anchor="middle" class="st-tl">${TH.attrs[k]}</text>`;
      s += `<text x="${lx}" y="${ly + 8}" text-anchor="middle" class="st-tv${this.add[k] ? ' up' : ''}">${v[k]}</text>`;
    });
    this.radar.innerHTML = s;
    this.radar.setAttribute(
      'aria-label',
      `${TH.status.title}: ${order.map((k) => `${TH.attrs[k]} ${v[k]}`).join(', ')}`,
    );
  }
}
