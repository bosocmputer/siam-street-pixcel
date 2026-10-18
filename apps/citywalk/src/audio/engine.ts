import { newMixer, release, request, sound, spatialize } from '@newgame/rpg-core';
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

type AudioCtor = typeof AudioContext;

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
  hold(id: string, o: SoundCall = {}): (fade?: number) => void {
    const uid = this.begin(id, o);
    return (fade = 0.12) => {
      const v = this.voices.get(uid);
      if (!v || !this.ctx) return;
      v.stop(fade);
      release(this.mixer, uid, this.ctx.currentTime, fade);
      this.voices.delete(uid);
    };
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
      const s = spatialize(this.ear, o.at);
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
      { ...defaults(), gain, pan, pitch: o.pitch ?? 1, stretch },
      Math.random,
    );
    this.voices.set(d.uid, voice);
    window.setTimeout(() => this.voices.delete(d.uid), (length + 0.2) * 1000);
    this.log.push(id);
    if (this.log.length > 80) this.log.shift();
    return d.uid;
  }
}
