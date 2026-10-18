// The character screen (mockup approved 18 Oct 2026): the character turning on a stage, the
// body switch, a rail of parts, a strip of choices drawn on the character itself, then the name
// and the system's first announcement.

import * as THREE from 'three';
import {
  APPEARANCE,
  LOOK_PARTS,
  SPRITES,
  frameAt,
  spriteDirection,
  checkName,
  choices,
  defaultLook,
  randomLook,
  type Look,
  type LookPart,
} from '@newgame/rpg-core';
import type { BuiltCharacter } from '../../tools/character/build.js';
import { buildLook, disposeCharacter } from '../lookModel';
import type { Baked } from '../sprites/bake';
import { bakeHero } from '../sprites/heroSprites';
import { TH } from '../th';
import { el } from './dom';
import { pxIcon } from './pixelIcons';

type CreatorIcon = LookPart | 'dice' | 'zoom';
const icon = (k: CreatorIcon) => pxIcon(k, 'ico');

/** parts drawn as pictures of the character; the rest are colour dots */
const PICTURED: LookPart[] = ['hair', 'face'];
const COLOURS: Partial<Record<LookPart, Record<string, string>>> = {
  hairColor: APPEARANCE.hairColors,
  eye: APPEARANCE.eyes,
  skin: APPEARANCE.skins,
};
const VIEW = {
  full: { pos: new THREE.Vector3(0, 0.78, 6.7), at: new THREE.Vector3(0, 0.74, 0) },
  face: { pos: new THREE.Vector3(0, 1.5, 2.9), at: new THREE.Vector3(0, 1.4, 0) },
};

function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x6b5240, 2.0));
  const key = new THREE.DirectionalLight(0xffe2bf, 2.0);
  key.position.set(2.2, 3.6, 3);
  const rim = new THREE.DirectionalLight(0x7cc8ff, 2.2);
  rim.position.set(-2.6, 2.4, -2.4);
  scene.add(key, rim);
}

export class Creator {
  readonly root = el('div', 'creator');
  private look: Look;
  private part: LookPart = 'hair';
  private faceView = false;
  private yaw = 0;
  private strip = el('div', 'cr-strip');
  private capKey = el('span', 'cr-cap-k');
  private capVal = el('b', 'cr-cap-v');
  private canvas = el('canvas', 'cr-view');
  private nameSheet = el('div', 'cr-sheet-bg');
  private nameInput = el('input', 'cr-field');
  private nameErr = el('div', 'cr-err');
  private announce = el('div', 'cr-sys-bg');
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(24, 1, 0.05, 50);
  private holder = new THREE.Group();
  private ring: THREE.Mesh;
  private current: BuiltCharacter | null = null;
  private thumbR: THREE.WebGLRenderer | null = null;
  private thumbScene = new THREE.Scene();
  private thumbCam = new THREE.PerspectiveCamera(24, 1, 0.05, 20);
  private thumbs = new Map<string, string>();
  private thumbRun = 0;
  private frame = 0;
  private dirty = false;
  private lastT = 0;
  private t = 0;
  private resize: ResizeObserver | null = null;
  /** pixel art: the character as its sprite, drawn on a flat canvas */
  private sheet: Baked | null = null;
  private g2: CanvasRenderingContext2D | null = null;

  constructor(
    private done: (look: Look) => void,
    start: Look = defaultLook('m'),
    /** a tap on a button (for a click sound) */
    private tap: () => void = () => undefined,
    /** show the character as a pixel sprite (as in the game) instead of the 3D model */
    private pixel = false,
  ) {
    this.look = { ...start };
    this.root.hidden = true;
    lights(this.scene);
    lights(this.thumbScene);
    this.scene.add(this.holder);
    // a soft shadow and a faint ring under the feet
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const g = sc.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.2, 1.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(sc),
        transparent: true,
        depthWrite: false,
      }),
    );
    shadow.position.y = 0.002;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.56, 0.575, 72).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xff9500, transparent: true, opacity: 0.5 }),
    );
    this.ring.position.y = 0.004;
    this.scene.add(shadow, this.ring);
    this.cam.position.copy(VIEW.full.pos);
    this.thumbCam.position.set(0, 1.58, 1.15);
    this.thumbCam.lookAt(0, 1.55, 0);
    this.layout();
  }

  private layout(): void {
    const C = TH.create;
    const stage = el('div', 'cr-stage');
    stage.append(el('div', 'cr-rain'));
    this.canvas.setAttribute('aria-label', C.turn);

    const top = el('div', 'cr-top');
    const head = el('div', '');
    const seg = el('div', 'cr-seg');
    seg.setAttribute('role', 'group');
    for (const b of APPEARANCE.bodies) {
      const btn = el('button', '', C.bodies[b]);
      btn.type = 'button';
      btn.dataset.body = b;
      btn.addEventListener('click', () => {
        if (this.look.body === b) return;
        this.tap();
        this.look = defaultLook(b, this.look.name);
        this.refresh();
      });
      seg.append(btn);
    }
    head.append(el('h1', 'cr-title', C.title), seg);
    const dice = this.iconButton('dice', C.random, () => {
      this.look = randomLook(Math.random, this.look.name);
      this.refresh();
    });
    dice.classList.add('cr-dice');
    top.append(head, dice);

    const rail = el('nav', 'cr-rail');
    rail.setAttribute('role', 'tablist');
    for (const p of LOOK_PARTS) {
      const b = this.iconButton(p, C.parts[p], () => {
        this.part = p;
        this.setZoom(p === 'face' || p === 'eye');
        this.refresh();
      });
      b.setAttribute('role', 'tab');
      b.dataset.part = p;
      rail.append(b);
    }

    const dock = el('div', 'cr-dock');
    const cap = el('div', 'cr-cap');
    cap.append(this.capKey, this.capVal);
    this.strip.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b?.dataset.v) return;
      this.tap();
      this.look = { ...this.look, [this.part]: b.dataset.v };
      this.refresh();
    });
    const row = el('div', 'cr-row');
    const zoom = this.iconButton('zoom', C.zoom, () => this.setZoom(!this.faceView));
    zoom.classList.add('cr-zoom');
    const next = el('button', 'cr-primary', C.next);
    next.type = 'button';
    next.addEventListener('click', () => {
      this.tap();
      this.nameSheet.hidden = false;
      this.nameInput.value = this.look.name;
      this.nameInput.focus();
    });
    row.append(zoom, next);
    dock.append(cap, this.strip, row);

    // the name, on a sheet from the bottom
    this.nameSheet.hidden = true;
    const sheet = el('div', 'cr-sheet');
    sheet.setAttribute('role', 'dialog');
    this.nameInput.maxLength = APPEARANCE.nameMax;
    this.nameInput.placeholder = C.namePlaceholder(APPEARANCE.nameMax);
    this.nameInput.autocomplete = 'off';
    this.nameInput.setAttribute('aria-label', C.nameTitle);
    this.nameInput.addEventListener('input', () => (this.nameErr.textContent = ''));
    this.nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && wake.click());
    const wake = el('button', 'cr-primary', C.wake);
    wake.type = 'button';
    wake.addEventListener('click', () => {
      const check = checkName(this.nameInput.value);
      if (check !== 'ok') {
        this.nameErr.textContent = C.nameErr[check];
        this.nameInput.classList.remove('cr-shake');
        void this.nameInput.offsetWidth;
        this.nameInput.classList.add('cr-shake');
        this.nameInput.focus();
        return;
      }
      this.tap();
      this.look = { ...this.look, name: this.nameInput.value.trim() };
      this.nameSheet.hidden = true;
      this.announce.hidden = false;
      (this.announce.querySelector('button') as HTMLButtonElement).focus();
    });
    sheet.append(el('h2', '', C.nameTitle), this.nameInput, this.nameErr, wake);
    this.nameSheet.append(sheet);
    this.nameSheet.addEventListener('click', (e) => {
      if (e.target === this.nameSheet) this.nameSheet.hidden = true;
    });

    // the system's first word to every resident
    this.announce.hidden = true;
    const sys = el('div', 'sys-window');
    sys.setAttribute('role', 'dialog');
    const gains = el('div', 'sys-gains');
    for (const g of TH.system.gains) gains.append(el('span', '', g));
    const ok = el('button', 'cr-primary', TH.system.ok);
    ok.type = 'button';
    ok.addEventListener('click', () => {
      this.tap();
      // give the keyboard back to walking now (drawing the character may take a moment)
      ok.blur();
      this.announce.hidden = true;
      this.close();
      this.done({ ...this.look });
    });
    sys.append(el('div', 'sys-tag', TH.system.tag), el('h3', '', TH.system.evaluation), gains, ok);
    this.announce.append(sys);

    // turn the character by dragging across it
    let drag: { x: number; yaw: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, yaw: this.yaw }));
    window.addEventListener('pointermove', (e) => {
      if (drag) this.yaw = drag.yaw + (e.clientX - drag.x) * 0.012;
    });
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointercancel', () => (drag = null));

    this.root.append(stage, this.canvas, top, rail, dock, this.nameSheet, this.announce);
  }

  private iconButton(k: CreatorIcon, label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'cr-icon');
    b.type = 'button';
    b.innerHTML = icon(k);
    b.setAttribute('aria-label', label);
    b.addEventListener('click', () => {
      this.tap();
      onClick();
    });
    return b;
  }

  private setZoom(on: boolean): void {
    this.faceView = on;
    this.root.querySelector('.cr-zoom')?.setAttribute('aria-pressed', String(on));
  }

  /** Paint the controls for the current look and part, and rebuild the character. */
  private refresh(): void {
    const C = TH.create;
    for (const b of Array.from(this.root.querySelectorAll<HTMLElement>('.cr-seg button')))
      b.setAttribute('aria-pressed', String(b.dataset.body === this.look.body));
    for (const b of Array.from(this.root.querySelectorAll<HTMLElement>('.cr-rail button')))
      b.setAttribute('aria-selected', String(b.dataset.part === this.part));
    const ids = choices(this.part);
    const names = C.names[this.part] ?? {};
    this.capKey.textContent = C.parts[this.part];
    this.capVal.textContent = names[this.look[this.part]] ?? '';
    const colours = COLOURS[this.part];
    this.strip.replaceChildren(
      ...ids.map((id) => {
        const b = el('button', colours ? 'cr-swatch' : 'cr-thumb');
        b.type = 'button';
        b.dataset.v = id;
        b.setAttribute('aria-label', names[id] ?? id);
        b.setAttribute('aria-pressed', String(this.look[this.part] === id));
        if (colours) b.style.setProperty('--c', colours[id]!);
        else {
          b.classList.add('wait');
          b.append(el('img', ''));
        }
        return b;
      }),
    );
    this.dirty = true;
  }

  open(): void {
    this.root.hidden = false;
    if (this.pixel) {
      this.g2 ??= this.canvas.getContext('2d');
      this.resize ??= new ResizeObserver(() => this.fit());
      this.resize.observe(this.canvas);
    } else if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      this.thumbR = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
      this.thumbR.setPixelRatio(1);
      this.thumbR.setSize(128, 128);
      this.thumbR.outputColorSpace = THREE.SRGBColorSpace;
      this.resize = new ResizeObserver(() => this.fit());
      this.resize.observe(this.canvas);
    }
    this.fit();
    this.refresh();
    this.lastT = performance.now();
    const loop = () => {
      this.frame = requestAnimationFrame(loop);
      this.draw();
    };
    loop();
  }

  close(): void {
    cancelAnimationFrame(this.frame);
    this.thumbRun++;
    this.root.hidden = true;
    this.resize?.disconnect();
    if (this.current) {
      this.holder.remove(this.current.root);
      disposeCharacter(this.current);
      this.current = null;
    }
    for (const r of [this.renderer, this.thumbR]) {
      r?.dispose();
      r?.forceContextLoss();
    }
    this.renderer = this.thumbR = null;
  }

  /** The look being made (for tests). */
  get choice(): Look {
    return { ...this.look };
  }

  private fit(): void {
    const r = this.canvas.getBoundingClientRect();
    if (this.pixel) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
      return;
    }
    if (!this.renderer || !r.width || !r.height) return;
    this.renderer.setSize(r.width, r.height, false);
    this.cam.aspect = r.width / r.height;
    this.cam.updateProjectionMatrix();
  }

  private draw(): void {
    if (this.pixel) return this.drawPixel();
    if (!this.renderer) return;
    if (this.dirty) {
      this.dirty = false;
      const c = buildLook(this.look);
      if (this.current) {
        this.holder.remove(this.current.root);
        disposeCharacter(this.current);
      }
      this.current = c;
      this.holder.add(c.root);
      void this.drawThumbs();
    }
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    this.t += dt;
    const t = this.t;
    this.holder.rotation.y = this.yaw + Math.sin(t * 0.5) * 0.1;
    if (this.current) {
      // standing at ease: breathing, a slow look round, arms hanging loose
      const get = (n: string) => this.current!.root.getObjectByName(n);
      const sway = Math.sin(t * 1.7) * 0.015;
      get('Chest')?.rotation.set(Math.sin(t * 1.7) * 0.02, 0, 0);
      get('Head')?.rotation.set(0, Math.sin(t * 0.37) * 0.07, 0);
      get('UpperArm_L')?.rotation.set(0, 0, -0.12 - sway);
      get('UpperArm_R')?.rotation.set(0, 0, 0.12 + sway);
      for (const n of ['LowerArm_L', 'LowerArm_R']) get(n)?.rotation.set(-0.12, 0, 0);
    }
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.3 + 0.2 * Math.sin(t * 2);
    const v = this.faceView ? VIEW.face : VIEW.full;
    const k = Math.min(1, dt * 6);
    this.cam.position.lerp(v.pos, k);
    this.camAt.lerp(v.at, k);
    this.cam.lookAt(this.camAt);
    this.renderer.render(this.scene, this.cam);
  }
  private camAt = VIEW.full.at.clone();

  /**
   * The sprite standing on the stage, in whole screen pixels per sprite pixel; dragging turns it
   * through the directions it is drawn from.
   */
  private drawPixel(): void {
    const g = this.g2;
    if (!g) return;
    if (this.dirty) {
      this.dirty = false;
      this.sheet = bakeHero(this.look, SPRITES, [['idle', SPRITES.hero.anims.idle!]]);
      void this.drawThumbs();
    }
    const now = performance.now();
    this.t += Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    const c = this.canvas;
    g.clearRect(0, 0, c.width, c.height);
    const sh = this.sheet;
    if (!sh) return;
    g.imageSmoothingEnabled = false;
    const m = sh.meta;
    const [fw, fh] = m.frame;
    // the stage is what the dock at the bottom leaves free
    const dock = this.root.querySelector('.cr-dock')?.getBoundingClientRect();
    const box = this.canvas.getBoundingClientRect();
    const free = dock && box.height ? ((dock.top - box.top) / box.height) * c.height : c.height;
    const full = Math.max(1, Math.floor(Math.min((free * 0.7) / fh, (c.width * 0.7) / fw)));
    const k = this.faceView ? full * 2 : full;
    const fx = Math.round(c.width / 2 / k) * k;
    // stand on the stage, or with the face in the upper part of it
    const fy = this.faceView
      ? Math.round((free * 0.45 + m.anchor[1] * 0.75 * k) / k) * k
      : Math.round(Math.min(c.height * 0.62, free - 6 * k) / k) * k;
    // a shadow and a slowly blinking ring on the ground, in sprite pixels
    const blob = (rx: number, ry: number, colour: string, ring: boolean) => {
      g.fillStyle = colour;
      for (let dy = -ry; dy <= ry; dy++) {
        const w = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2));
        if (ring) {
          const inner = Math.round((rx - 2) * Math.sqrt(Math.max(0, 1 - (dy / (ry - 0.5)) ** 2)));
          g.fillRect(fx - w * k, fy + dy * k, (w - inner) * k, k);
          g.fillRect(fx + inner * k, fy + dy * k, (w - inner) * k, k);
        } else g.fillRect(fx - w * k, fy + dy * k, 2 * w * k, k);
      }
    };
    blob(Math.round(fw * 0.42), 3, 'rgba(24,20,37,0.45)', false);
    if (Math.floor(this.t * 1.5) % 2 === 0)
      blob(Math.round(fw * 0.6), 4, 'rgba(247,118,34,0.6)', true);
    const idle = m.anims.idle!;
    const { row, mirror } = spriteDirection(-this.yaw, 0, m.dirs);
    const col = frameAt(idle, this.t);
    g.save();
    g.translate(fx, fy - m.anchor[1] * k);
    if (mirror) g.scale(-1, 1);
    g.drawImage(
      sh.pages[idle.page]!,
      col * fw,
      (idle.row + row) * fh,
      fw,
      fh,
      -m.anchor[0] * k,
      0,
      fw * k,
      fh * k,
    );
    g.restore();
  }

  /** A pixel head-and-shoulders picture of a look, for a choice button. */
  private pixelThumb(look: Look): string {
    const sh = bakeHero(look, { ...SPRITES, dirs: 1 as 5 }, [
      ['idle', { frames: 1, fps: 1, loop: true }],
    ]);
    const m = sh.meta;
    const side = Math.min(m.frame[0], Math.round(m.anchor[1] * 0.55));
    const out = document.createElement('canvas');
    out.width = out.height = 64;
    const g = out.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    const k = Math.max(1, Math.floor(64 / side));
    g.drawImage(
      sh.pages[0]!,
      Math.round(m.anchor[0] - side / 2),
      0,
      side,
      side,
      Math.round((64 - side * k) / 2),
      Math.round((64 - side * k) / 2) + 4,
      side * k,
      side * k,
    );
    return out.toDataURL('image/png');
  }

  /** Pictures of each choice of the shown part, drawn on the current look, one per frame. */
  private async drawThumbs(): Promise<void> {
    if (!PICTURED.includes(this.part)) return;
    const run = ++this.thumbRun;
    const part = this.part;
    for (const b of Array.from(this.strip.children) as HTMLElement[]) {
      const look = { ...this.look, [part]: b.dataset.v, name: '' };
      const key = JSON.stringify(look);
      let url = this.thumbs.get(key);
      if (!url && this.pixel) {
        await new Promise((r) => setTimeout(r, 0));
        if (run !== this.thumbRun) return;
        url = this.pixelThumb(look);
        this.thumbs.set(key, url);
      }
      if (!url) {
        await new Promise((r) => setTimeout(r, 0));
        if (run !== this.thumbRun || !this.thumbR) return;
        const c = buildLook(look);
        const h = new THREE.Group();
        h.add(c.root);
        h.rotation.y = -0.38;
        this.thumbScene.add(h);
        this.thumbR.render(this.thumbScene, this.thumbCam);
        url = this.thumbR.domElement.toDataURL('image/png');
        this.thumbScene.remove(h);
        disposeCharacter(c);
        this.thumbs.set(key, url);
      }
      if (run !== this.thumbRun) return;
      b.querySelector('img')!.src = url;
      b.classList.remove('wait');
    }
  }
}
