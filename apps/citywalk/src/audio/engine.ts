import {
  SPATIAL,
  newMixer,
  release,
  request,
  sound,
  spatialize,
  type SoundSpec,
} from '@newgame/rpg-core';
import { NoiseBank, defaults, playSound, type Voice } from './synth';

/** What a caller can ask of a sound. */
export interface SoundCall {
  /** where it happens, map metres; only matters for sounds marked spatial */
  at?: { x: number; z: number };
  /** pitch multiplier (a big slime is lower, a picked-up combo higher) */
  pitch?: number;
  /** make the sound last this many seconds, stretching its recipe */
  fit?: number;
  /** loudness multiplier */
  gain?: number;
  /** force left (-1) to right (1), for trying a sound out */
  pan?: number;
}

export interface Prefs {
  muted: boolean;
  /** master volume 0..1 */
  volume: number;
}

/** A sound that lasts until stopped, and can follow the thing making it. */
export interface Held {
  /** fade it out over `fade` seconds and free its place */
  stop(fade?: number): void;
  /** it is now here (map metres); a spatial sound turns and fades to match */
  at(x: number, z: number): void;
}

type AudioCtor = typeof AudioContext;

/**
 * The echo of an open street between walls and buildings: a few early bounces off nearby walls,
 * then a short tail dying away. Made from noise, so there is no recording to load.
 */
function streetEcho(ctx: BaseAudioContext): AudioBuffer {
  const rate = ctx.sampleRate;
  const n = Math.floor(rate * 1.1);
  const buf = ctx.createBuffer(2, n, rate);
  let seed = 777;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      // the tail: noise that dies away, duller as it goes
      d[i] = (rand() * 2 - 1) * Math.exp(-t * 5.5) * 0.35;
    }
    // bounces off walls 8 to 30 metres away, a little different on each side
    for (const ms of ch === 0 ? [23, 47, 71, 102] : [31, 55, 83, 118]) {
      const i = Math.floor((ms / 1000) * rate);
      d[i] = (d[i] ?? 0) + 0.5 * Math.exp(-ms / 90);
    }
    // smooth out the very top so the echo sounds like brick and plaster, not metal
    let last = 0;
    for (let i = 0; i < n; i++) last = d[i] = last + (d[i]! - last) * 0.35;
  }
  return buf;
}

/**
 * The game's sound. Nothing makes a sound until the player has tapped something (phones will not
 * allow it before), so call `unlock()` from a tap. Every method is safe to call at any time: with
 * no sound support, or before unlocking, or while muted, it simply does nothing.
 */
export class Sound {
  muted: boolean;
  volume: number;
  /** the sounds played most recently, newest last (for tests and for the page's debug hook) */
  readonly log: string[] = [];

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private main: GainNode | null = null;
  private alert: GainNode | null = null;
  private echo: ConvolverNode | null = null;
  private noise: NoiseBank | null = null;
  private mixer = newMixer();
  private voices = new Map<number, Voice>();
  private ear = { x: 0, z: 0, yaw: 0 };
  private unlocked = false;

  constructor(prefs: Prefs) {
    this.muted = prefs.muted;
    this.volume = prefs.volume;
  }

  /** Has the player enabled sound by tapping, and is the sound maker running? */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Start the sound maker. Call this inside a tap or click. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: AudioCtor | undefined =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      const ctx = this.ctx;
      // everything goes through a gentle limiter so many sounds at once never crackle
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 12;
      limiter.ratio.value = 6;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.2;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.main = ctx.createGain();
      this.alert = ctx.createGain();
      this.main.connect(limiter);
      this.alert.connect(limiter);
      try {
        this.echo = ctx.createConvolver();
        this.echo.buffer = streetEcho(ctx);
        this.echo.connect(this.main);
      } catch {
        this.echo = null; // sounds simply have no echo
      }
      limiter.connect(this.master);
      this.master.connect(ctx.destination);
      this.noise = new NoiseBank(ctx);
    }
    this.unlocked = true;
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    // iPhones want a sound actually started inside the tap
    try {
      const silent = this.ctx.createBufferSource();
      silent.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      silent.connect(this.ctx.destination);
      silent.start(0);
    } catch {
      // not needed everywhere
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  }

  /** Stop while the page is hidden. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  /** Carry on after the page is shown again (only if the player had enabled sound). */
  resume(): void {
    if (this.ctx && this.unlocked && this.ctx.state === 'suspended')
      void this.ctx.resume().catch(() => undefined);
  }

  /** Where the listener is and which way they look, so sounds can come from the right side. */
  hear(x: number, z: number, yaw: number): void {
    this.ear.x = x;
    this.ear.z = z;
    this.ear.yaw = yaw;
  }

  /** Play a sound. Returns whether anything was started. */
  play(id: string, o: SoundCall = {}): boolean {
    return this.begin(id, o) !== 0;
  }

  /**
   * Start a held sound (one that lasts until told to stop, like a fireball's roar while it flies).
   * Returns the way to stop it: a short fade, then its place is free for other sounds.
   */
  hold(id: string, o: SoundCall = {}): Held {
    const uid = this.begin(id, o);
    const spec = sound(id);
    return {
      stop: (fade = 0.12) => {
        const v = this.voices.get(uid);
        if (!v || !this.ctx) return;
        v.stop(fade);
        release(this.mixer, uid, this.ctx.currentTime, fade);
        this.voices.delete(uid);
      },
      at: (x, z) => {
        const v = this.voices.get(uid);
        if (!v || !spec.spatial) return;
        const s = this.place(spec, { x, z });
        v.steer((o.gain ?? 1) * s.gain, s.pan);
      },
    };
  }

  /** How loud and on which side a sound at `at` is for the listener. */
  private place(spec: SoundSpec, at: { x: number; z: number }): { gain: number; pan: number } {
    return spatialize(this.ear, at, { near: spec.reach, far: SPATIAL.far });
  }

  /** Start a sound; its number, or 0 if nothing was started. */
  private begin(id: string, o: SoundCall): number {
    const ctx = this.ctx;
    if (!ctx || !this.main || !this.alert || !this.noise || this.muted || ctx.state !== 'running')
      return 0;
    const spec = sound(id);
    let gain = o.gain ?? 1;
    let pan = o.pan ?? 0;
    if (spec.spatial && o.at) {
      const s = this.place(spec, o.at);
      gain *= s.gain;
      if (o.pan === undefined) pan = s.pan;
    }
    // too far away to hear: do not even start it
    if (gain < 0.02) return 0;
    const stretch = o.fit ? Math.max(0.5, Math.min(2, o.fit / spec.length)) : 1;
    const length = spec.length * stretch;
    const now = ctx.currentTime;
    const d = request(this.mixer, spec, now, length);
    if (!d.play) return 0;
    if (d.steal !== null) this.voices.get(d.steal)?.stop();

    const bus = spec.alert ? this.alert : this.main;
    if (spec.alert && this.main) {
      // everything else drops while the alert plays, then comes back
      this.main.gain.setTargetAtTime(spec.duck, now, 0.03);
      this.main.gain.setTargetAtTime(1, now + length, 0.25);
    }
    const voice = playSound(
      ctx,
      bus,
      spec,
      this.noise,
      {
        ...defaults(),
        gain,
        pan,
        pitch: o.pitch ?? 1,
        stretch,
        echo: spec.alert ? null : this.echo,
      },
      Math.random,
    );
    this.voices.set(d.uid, voice);
    window.setTimeout(() => this.voices.delete(d.uid), (length + 0.2) * 1000);
    this.log.push(id);
    if (this.log.length > 80) this.log.shift();
    return d.uid;
  }
}
