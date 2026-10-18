// Keyboard, mouse and touch. Keys become actions (config/controls.json in rpg-core), and on-screen
// buttons send the same actions through trigger(). Reports a movement vector (forward, right in
// -1..1), camera turns and taps.

import { BINDINGS, moveFrom, type HoldAction, type PressAction } from '@newgame/rpg-core';
import { pxRing, pxSvg } from './ui/pixelIcons';

export interface InputState {
  forward: number;
  right: number;
}

export class Input {
  /** movement actions held down right now, with the keys holding them */
  private held = new Map<string, HoldAction>();
  /** actions pressed since the game last asked, kept even if the key is already let go */
  private presses = new Set<PressAction>();
  // ids are null when no finger is on them: touch ids from iPhones can be negative, so -1 is no good
  private stick: { id: number | null; ox: number; oy: number; x: number; y: number } = {
    id: null,
    ox: 0,
    oy: 0,
    x: 0,
    y: 0,
  };
  private look: { id: number | null; x: number; y: number } = { id: null, x: 0, y: 0 };
  /** where and when each finger or button went down, to tell a tap from a drag */
  private downs = new Map<number, { x: number; y: number; t: number; far: boolean }>();
  private taps: [number, number][] = [];
  /** camera turn accumulated since the last read, in pixels */
  private turnX = 0;
  private turnY = 0;
  private knob: HTMLElement;
  private base: HTMLElement;

  /** where the stick waits when no finger is on it (touch screens only) */
  private home = { x: 0, y: 0 };
  private touchScreen: boolean;

  constructor(el: HTMLElement, hint: string) {
    this.touchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'knob';
    const label = document.createElement('span');
    label.className = 'stick-hint';
    label.textContent = hint;
    // a stepped pixel ring
    this.base.innerHTML = pxSvg(pxRing(28, 2), '');
    this.base.append(this.knob, label);
    this.base.hidden = !this.touchScreen;
    document.body.append(this.base);
    this.rest();
    window.addEventListener('resize', () => this.rest());

    window.addEventListener('keydown', (e) => {
      const press = BINDINGS.press.get(e.code);
      // Tab picks the next target, not the next button
      if (press === 'target') e.preventDefault();
      if (e.target instanceof HTMLButtonElement && press !== 'target') return;
      const hold = BINDINGS.hold.get(e.code);
      if (hold) this.held.set(e.code, hold);
      if (press && !e.repeat) this.presses.add(press);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => this.held.clear());

    // Fingers use touch events, which work in more in-app browsers than pointer events, and the
    // page keeps them so the app around it does not scroll instead of the walker moving.
    const opts = { passive: false } as const;
    el.addEventListener('touchstart', (e) => this.touches(e, 'down'), opts);
    el.addEventListener('touchmove', (e) => this.touches(e, 'move'), opts);
    el.addEventListener('touchend', (e) => this.touches(e, 'up'), opts);
    el.addEventListener('touchcancel', (e) => this.touches(e, 'up'), opts);
    // ...but a window that scrolls (the status window, the listening room, a list of choices)
    // still moves under the finger
    document.addEventListener(
      'touchmove',
      (e) => {
        if (!inScroller(e.target)) e.preventDefault();
      },
      opts,
    );

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      el.setPointerCapture(e.pointerId);
      this.down(e.pointerId, e.clientX, e.clientY, false);
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'touch') this.moveTo(e.pointerId, e.clientX, e.clientY);
    });
    el.addEventListener('pointerup', (e) => this.up(e.pointerId));
    el.addEventListener('pointercancel', (e) => this.up(e.pointerId));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private touches(e: TouchEvent, kind: 'down' | 'move' | 'up'): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      // keep touch ids apart from mouse pointer ids
      const id = 1e9 + t.identifier;
      if (kind === 'down') this.down(id, t.clientX, t.clientY, true);
      else if (kind === 'move') this.moveTo(id, t.clientX, t.clientY);
      else this.up(id);
    }
  }

  private rest(): void {
    this.home = { x: 86, y: window.innerHeight - 150 };
    if (this.stick.id === null) this.placeStick(this.home.x, this.home.y);
  }

  private placeStick(x: number, y: number): void {
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private down(id: number, x: number, y: number, touch: boolean): void {
    this.downs.set(id, { x, y, t: performance.now(), far: false });
    // a finger on the left half of the screen drives the walker; everything else turns the camera
    if (touch && x < window.innerWidth / 2 && this.stick.id === null) {
      this.stick = { id, ox: x, oy: y, x, y };
      this.base.classList.add('active');
      this.placeStick(x, y);
    } else if (this.look.id === null) {
      this.look = { id, x, y };
    }
  }

  private moveTo(id: number, x: number, y: number): void {
    const d = this.downs.get(id);
    if (d && Math.hypot(x - d.x, y - d.y) > 12) d.far = true;
    if (id === this.stick.id) {
      this.stick.x = x;
      this.stick.y = y;
      const [dx, dy] = this.stickOffset();
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (id === this.look.id) {
      this.turnX += x - this.look.x;
      this.turnY += y - this.look.y;
      this.look.x = x;
      this.look.y = y;
    }
  }

  private up(id: number): void {
    const d = this.downs.get(id);
    this.downs.delete(id);
    if (d && !d.far && performance.now() - d.t < 350) this.taps.push([d.x, d.y]);
    if (id === this.stick.id) {
      this.stick.id = null;
      this.base.classList.remove('active');
      this.placeStick(this.home.x, this.home.y);
    }
    if (id === this.look.id) this.look.id = null;
  }

  private stickOffset(): [number, number] {
    const max = 48;
    let dx = this.stick.x - this.stick.ox,
      dy = this.stick.y - this.stick.oy;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    return [dx, dy];
  }

  read(): InputState {
    if (this.stick.id !== null) {
      const [dx, dy] = this.stickOffset();
      const forward = -dy / 48,
        right = dx / 48;
      const len = Math.hypot(forward, right);
      return len > 1 ? { forward: forward / len, right: right / len } : { forward, right };
    }
    return moveFrom(new Set(this.held.values()));
  }

  /** Camera drag since the last call, in pixels. */
  takeTurn(): [number, number] {
    const t: [number, number] = [this.turnX, this.turnY];
    this.turnX = 0;
    this.turnY = 0;
    return t;
  }

  /** Quick taps or clicks (screen pixels) since the last call. */
  takeTaps(): [number, number][] {
    const t = this.taps;
    this.taps = [];
    return t;
  }

  /** An on-screen button asks for an action, the same as its key would. */
  trigger(action: PressAction): void {
    this.presses.add(action);
  }

  /** Was this action asked for since the last call? Asking clears it. */
  pressed(action: PressAction): boolean {
    return this.presses.delete(action);
  }
}

/** Is this inside a box the player can scroll (one that has more to show than fits)? */
export function inScroller(target: EventTarget | null): boolean {
  for (
    let n = target instanceof Element ? target : null;
    n && n !== document.body;
    n = n.parentElement
  ) {
    const s = getComputedStyle(n);
    if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight + 1) return true;
    if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return true;
  }
  return false;
}
