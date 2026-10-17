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

  constructor(private el: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'knob';
    this.base.append(this.knob);
    this.base.hidden = true;
    document.body.append(this.base);

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLButtonElement) return;
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.moveTo(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down(e: PointerEvent): void {
    this.el.setPointerCapture(e.pointerId);
    // a finger on the left half of the screen drives the walker; everything else turns the camera
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth / 2 && this.stick.id < 0) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      this.base.hidden = false;
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else if (this.look.id < 0) {
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  }

  private moveTo(e: PointerEvent): void {
    if (e.pointerId === this.stick.id) {
      this.stick.x = e.clientX;
      this.stick.y = e.clientY;
      const [dx, dy] = this.stickOffset();
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (e.pointerId === this.look.id) {
      this.turnX += e.clientX - this.look.x;
      this.turnY += e.clientY - this.look.y;
      this.look.x = e.clientX;
      this.look.y = e.clientY;
    }
  }

  private up(e: PointerEvent): void {
    if (e.pointerId === this.stick.id) {
      this.stick.id = -1;
      this.base.hidden = true;
    }
    if (e.pointerId === this.look.id) this.look.id = -1;
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
