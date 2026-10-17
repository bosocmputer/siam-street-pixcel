// Keyboard, mouse and touch. Reports a movement vector (forward, right in -1..1) and camera turns.

export interface InputState {
  forward: number;
  right: number;
}

export class Input {
  private keys = new Set<string>();
  private stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private look = { id: -1, x: 0, y: 0 };
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
    this.base.append(this.knob, label);
    this.base.hidden = !this.touchScreen;
    document.body.append(this.base);
    this.rest();
    window.addEventListener('resize', () => this.rest());

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    // Fingers use touch events, which work in more in-app browsers than pointer events, and the
    // page keeps them so the app around it does not scroll instead of the walker moving.
    const opts = { passive: false } as const;
    el.addEventListener('touchstart', (e) => this.touches(e, 'down'), opts);
    el.addEventListener('touchmove', (e) => this.touches(e, 'move'), opts);
    el.addEventListener('touchend', (e) => this.touches(e, 'up'), opts);
    el.addEventListener('touchcancel', (e) => this.touches(e, 'up'), opts);
    document.addEventListener('touchmove', (e) => e.preventDefault(), opts);

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
      const id = 1000 + t.identifier;
      if (kind === 'down') this.down(id, t.clientX, t.clientY, true);
      else if (kind === 'move') this.moveTo(id, t.clientX, t.clientY);
      else this.up(id);
    }
  }

  private rest(): void {
    this.home = { x: 86, y: window.innerHeight - 150 };
    if (this.stick.id < 0) this.placeStick(this.home.x, this.home.y);
  }

  private placeStick(x: number, y: number): void {
    this.base.style.left = `${x}px`;
    this.base.style.top = `${y}px`;
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private down(id: number, x: number, y: number, touch: boolean): void {
    // a finger on the left half of the screen drives the walker; everything else turns the camera
    if (touch && x < window.innerWidth / 2 && this.stick.id < 0) {
      this.stick = { id, ox: x, oy: y, x, y };
      this.base.classList.add('active');
      this.placeStick(x, y);
    } else if (this.look.id < 0) {
      this.look = { id, x, y };
    }
  }

  private moveTo(id: number, x: number, y: number): void {
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
    if (id === this.stick.id) {
      this.stick.id = -1;
      this.base.classList.remove('active');
      this.placeStick(this.home.x, this.home.y);
    }
    if (id === this.look.id) this.look.id = -1;
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
    let forward = 0,
      right = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) right += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) right -= 1;
    if (this.stick.id >= 0) {
      const [dx, dy] = this.stickOffset();
      forward = -dy / 48;
      right = dx / 48;
    }
    const len = Math.hypot(forward, right);
    if (len > 1) {
      forward /= len;
      right /= len;
    }
    return { forward, right };
  }

  /** Camera drag since the last call, in pixels. */
  takeTurn(): [number, number] {
    const t: [number, number] = [this.turnX, this.turnY];
    this.turnX = 0;
    this.turnY = 0;
    return t;
  }

  pressed(code: string): boolean {
    if (!this.keys.has(code)) return false;
    this.keys.delete(code);
    return true;
  }
}
