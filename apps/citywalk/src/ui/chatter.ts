// Monsters talking: a short line in a pixel bubble over the head and a mark that pops up (! when
// it notices you, a vein when it attacks...). When and which line comes from rpg-core
// (chatter.ts, config/chatter.json); the lines are in th.ts.

import {
  CHATTER,
  newVoice,
  speak,
  stepVoice,
  type ChatEvent,
  type ChatVoice,
  type Vec3,
} from '@newgame/rpg-core';
import type { SlimeEvent, SlimeHerd } from '../slime';
import { TH } from '../th';
import { el } from './dom';
import { pxIcon } from './pixelIcons';
import type { ToScreen } from './combatHud';

interface Shown {
  e: HTMLElement;
  i: number;
  /** seconds since it appeared */
  t: number;
  life: number;
  /** how far over the head, metres */
  over: number;
}

const ANGRY: ChatEvent[] = ['attack', 'charge', 'slam'];

export class Chatter {
  private voices = new Map<number, ChatVoice>();
  private bubbles: Shown[] = [];
  private marks: Shown[] = [];
  /** the lines said so far (for tests) */
  readonly said: { i: number; kind: ChatEvent; text: string }[] = [];

  constructor(
    private root: HTMLElement,
    private rng: () => number,
  ) {}

  private voice(i: number): ChatVoice {
    let v = this.voices.get(i);
    if (!v) this.voices.set(i, (v = newVoice(this.rng)));
    return v;
  }

  /** Something happened to slime i: a mark over its head, and maybe a line. */
  react(herd: SlimeHerd, e: SlimeEvent): void {
    const spec = herd.species(e.i);
    if (e.kind !== 'idle') this.mark(e.i, CHATTER.emote[e.kind]);
    const lines = TH.chatter[spec.id]?.[e.kind] ?? [];
    const k = speak(this.voice(e.i), e.kind, lines.length, this.rng);
    if (k === null) return;
    const text = lines[k]!;
    this.said.push({ i: e.i, kind: e.kind, text });
    if (e.kind === 'idle') this.mark(e.i, CHATTER.emote.idle);
    // one bubble per slime; the oldest goes when there are too many
    for (const b of this.bubbles.filter((b) => b.i === e.i)) b.life = 0;
    const kind =
      spec.specials.charge || spec.specials.slam
        ? ' say-boss'
        : ANGRY.includes(e.kind)
          ? ' say-angry'
          : '';
    const bubble = el('div', `say${kind}`, text);
    bubble.dataset.slime = String(e.i);
    this.root.append(bubble);
    this.bubbles.push({ e: bubble, i: e.i, t: 0, life: CHATTER.showFor, over: 1.5 });
    const live = this.bubbles.filter((b) => b.life > b.t);
    if (live.length > CHATTER.maxBubbles) live[0]!.life = 0;
  }

  private mark(i: number, name: (typeof CHATTER.emote)[ChatEvent]): void {
    for (const m of this.marks.filter((m) => m.i === i)) m.life = 0;
    const e = el('div', 'emote');
    e.innerHTML = pxIcon(name);
    e.dataset.emote = name;
    this.root.append(e);
    this.marks.push({ e, i, t: 0, life: 1.1, over: 0.35 });
  }

  /**
   * Time passes: slimes close to the player now and then remark on nothing much, and blink.
   * `player` is in map metres.
   */
  update(dt: number, herd: SlimeHerd, player: { x: number; z: number }): void {
    for (const e of herd.takeEvents()) this.react(herd, e);
    for (let i = 0; i < herd.count; i++) {
      const at = herd.aimPoint(i);
      if (!at) continue;
      const step = stepVoice(this.voice(i), dt, this.rng);
      if (step.blink) herd.blink(i);
      const near = Math.hypot(at[0] - player.x, at[2] - player.z) < CHATTER.hearRange;
      if (step.remark && near) this.react(herd, { i, kind: 'idle' });
    }
    for (const s of [...this.bubbles, ...this.marks]) s.t += dt;
  }

  draw(herd: SlimeHerd, toScreen: ToScreen): void {
    const place = (list: Shown[], pop: boolean) => {
      for (let n = list.length - 1; n >= 0; n--) {
        const s = list[n]!;
        const [x, z] = herd.positionOf(s.i);
        const p: Vec3 = [x, herd.heightOf(s.i) + s.over, z];
        const xy = toScreen(p);
        if (s.t >= s.life || (!xy && s.t > 0.2)) {
          s.e.remove();
          list.splice(n, 1);
          continue;
        }
        s.e.hidden = !xy;
        if (!xy) continue;
        // a mark pops up a few pixels, then sits; whole pixels keep it sharp
        const hop = pop ? (s.t < 0.08 ? 6 : s.t < 0.16 ? -4 : 0) : 0;
        s.e.style.transform = `translate(-50%, -100%) translate(${Math.round(xy[0])}px, ${Math.round(xy[1]) + hop}px)`;
        s.e.style.opacity = s.life - s.t < 0.25 ? '0.5' : '1';
      }
    };
    place(this.bubbles, false);
    place(this.marks, true);
  }
}
