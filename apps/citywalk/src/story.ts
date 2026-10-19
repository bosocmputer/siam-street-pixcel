// The story quests on screen (approved first-minute mockup): the quest bar, the guide line and the
// goal's mark, the people to talk to and their dialogue, and the card when a quest is done. The
// counting is in rpg-core (quests.ts); the game tells this what happened.

import type * as THREE from 'three';
import {
  QUESTS,
  current,
  goalOf,
  questEvent,
  stepCount,
  type Progress,
  type QuestEvent,
  type Vec3,
} from '@newgame/rpg-core';
import { Guide } from './guide';
import type { Npc } from './npc';
import { TH } from './th';
import { QuestBar } from './ui/questBar';
import { PA_SAENG_FACE, Talk, type Face } from './ui/talk';
import { el } from './ui/dom';

/** how close the player comes for someone to start talking, metres */
const TALK_NEAR = 3;
const FACES: Record<string, Face> = { pa_saeng: PA_SAENG_FACE };

export interface StoryHost {
  root: HTMLElement;
  top: HTMLElement;
  /** a spot in the gate frame (quests.json places) as map metres */
  toMap(at: [number, number]): [number, number];
  screenOf(p: Vec3): [number, number] | null;
  player(): { x: number; z: number };
  /** the slimes, for the guide to lead to one to beat */
  slimes(): { x: number; z: number; alive: boolean; species: string }[];
  /** stop the world while someone talks */
  pause(on: boolean): void;
  /** experience for a finished quest */
  reward(exp: number): void;
  announce(text: string): void;
  sound(id: string): void;
  save(): void;
}

export class Story {
  readonly guide = new Guide();
  readonly talk = new Talk(TH.talkSkip, TH.talkNext);
  readonly bar: QuestBar;
  private npcs = new Map<string, Npc>();
  private shout = el('div', 'shout', TH.shout);
  private time = 0;

  constructor(
    private host: StoryHost,
    public progress: Progress,
  ) {
    this.bar = new QuestBar(host.top, host.root, () => host.sound('ui.click'));
    this.shout.hidden = true;
    host.root.append(this.shout);
    document.body.append(this.talk.root);
    this.showBar();
  }

  addNpc(n: Npc): void {
    this.npcs.set(n.id, n);
  }

  get talking(): boolean {
    return this.talk.isOpen;
  }

  /** Start the story again (a new game) or carry on from a save. */
  setProgress(p: Progress): void {
    this.progress = p;
    this.showBar();
  }

  /** Something happened that a quest may count. */
  event(e: QuestEvent): void {
    const r = questEvent(this.progress.quest, e);
    if (!r.stepped) return;
    const q = r.finished;
    if (q) {
      const name = TH.quests[q.id]?.name ?? q.id;
      const gifts = [
        ...(q.reward.exp > 0 ? [TH.expGain(q.reward.exp)] : []),
        ...(q.reward.learn ? [TH.learned[q.reward.learn] ?? q.reward.learn] : []),
      ];
      this.bar.done(TH.questDone(name), gifts);
      this.host.sound('player.levelup');
      if (q.reward.exp > 0) this.host.reward(q.reward.exp);
      // the next quest is announced once the card has had its moment
      if (this.progress.quest.id) window.setTimeout(() => this.host.announce(TH.newQuest), 2500);
    }
    this.showBar();
    this.host.save();
  }

  private showBar(): void {
    const log = this.progress.quest;
    const c = current(log);
    if (!c) return this.bar.show(null);
    const t = TH.quests[c.quest.id];
    const [done, needed] = stepCount(log);
    const todo = (t?.steps[log.step] ?? '') + (needed > 1 ? ` ${done}/${needed}` : '');
    const after: string[] = [];
    for (let id = c.quest.next; id && after.length < 2; id = QUESTS.quests[id]?.next ?? null)
      after.push(TH.quests[id]?.name ?? id);
    this.bar.show({ name: t?.name ?? c.quest.id, todo, after });
  }

  /** Each frame while playing: who talks, where the line leads, reaching places. */
  update(dt: number, ground: number, scale: number): void {
    this.time += dt;
    const me = this.host.player();
    for (const n of this.npcs.values()) n.update(dt, me, scale);
    const c = current(this.progress.quest);
    const step = c?.step ?? null;
    // walking to a place, or up to someone who has something to say
    if (step?.do === 'reach') {
      const [x, z] = this.host.toMap(QUESTS.places[step.place]!);
      if (Math.hypot(me.x - x, me.z - z) <= step.radius)
        this.event({ kind: 'reach', place: step.place });
    } else if (step?.do === 'talk' && !this.talk.isOpen) {
      const n = this.npcs.get(step.npc);
      if (n && n.distance(me) <= TALK_NEAR) void this.say(step.npc, step.line);
    }
    // the line leads to the place or person, or to the nearest monster to beat
    const goal = goalOf(this.progress.quest);
    let to: [number, number] | null = goal ? this.host.toMap(goal) : null;
    if (!to && step?.do === 'defeat') {
      let best = 80;
      for (const s of this.host.slimes()) {
        if (!s.alive || (step.species && s.species !== step.species)) continue;
        const d = Math.hypot(s.x - me.x, s.z - me.z);
        if (d < best) [best, to] = [d, [s.x, s.z]];
      }
    }
    this.guide.update(dt, [me.x, me.z], to, ground);
    // the "!" over where to go, and someone calling for help on the way there
    const mark = goal && to ? this.host.screenOf([to[0], 2.7, to[1]]) : null;
    this.bar.mark(mark, to ? Math.hypot(to[0] - me.x, to[1] - me.z) : 0, TH.metres);
    const calling = c?.quest.id === 'wake' && Math.floor(this.time / 1.4) % 2 === 0;
    const caller = calling && to ? this.host.screenOf([to[0], 3.4, to[1]]) : null;
    this.shout.hidden = !caller;
    if (caller)
      this.shout.style.transform = `translate(-50%, -100%) translate(${Math.round(caller[0])}px, ${Math.round(caller[1])}px)`;
  }

  /** Someone talks; the world waits until the last page. */
  async say(npc: string, line: string): Promise<void> {
    const pages = TH.story[npc]?.[line] ?? [];
    this.host.pause(true);
    this.host.sound('ui.click');
    await this.talk.open(TH.npcs[npc] ?? npc, pages, FACES[npc] ?? PA_SAENG_FACE);
    this.host.pause(false);
    this.event({ kind: 'talk', npc });
  }

  draw(camera: THREE.Camera): void {
    for (const n of this.npcs.values()) n.draw(camera);
  }
}
