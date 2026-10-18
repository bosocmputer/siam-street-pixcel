import type { NoiseColor, SoundSpec } from '@newgame/rpg-core';

// Turns a sound recipe (rpg-core config/sounds.json) into sound with the browser's audio nodes.
// It works the same on a live sound maker and an offline one, so the listening page and the tests
// can draw a sound without playing it.

export interface PlayOptions {
  /** loudness on top of the recipe's own, 1 = as written */
  gain: number;
  /** left (-1) to right (1) */
  pan: number;
  /** 1 = as written; 2 is an octave higher */
  pitch: number;
  /** 1 = as written; 2 lasts twice as long */
  stretch: number;
}

export interface Voice {
  /** seconds from the start until it has died away */
  length: number;
  /** fade it out over `fade` seconds (to make room for another sound, or when a shot lands) */
  stop(fade?: number): void;
}

export const defaults = (): PlayOptions => ({ gain: 1, pan: 0, pitch: 1, stretch: 1 });

/** Three kinds of hiss, made once for each sound maker: 2 seconds each, played round and round. */
export class NoiseBank {
  private cache = new Map<NoiseColor, AudioBuffer>();
  private state = 12345;

  constructor(private ctx: BaseAudioContext) {}

  /** the same hiss every time, so a sound is drawn the same way each time it is checked */
  private random(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 4294967296;
  }

  get(color: NoiseColor): AudioBuffer {
    let buf = this.cache.get(color);
    if (buf) return buf;
    const n = Math.floor(this.ctx.sampleRate * 2);
    buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0,
      brown = 0;
    for (let i = 0; i < n; i++) {
      const white = this.random() * 2 - 1;
      if (color === 'white') d[i] = white;
      else if (color === 'pink') {
        // Paul Kellet's pink-noise filter
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      } else {
        brown = (brown + 0.02 * white) / 1.02;
        d[i] = brown * 3.5;
      }
    }
    this.cache.set(color, buf);
    return buf;
  }
}

const TINY = 0.0001;

const curves = new Map<number, Float32Array>();
/** The bend that roughens a layer: soft clipping, harder the more `drive`. */
function driveCurve(drive: number): Float32Array {
  let c = curves.get(drive);
  if (c) return c;
  c = new Float32Array(1024);
  const k = 1 + drive * 30;
  for (let i = 0; i < c.length; i++) {
    const x = (i / (c.length - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / Math.tanh(k);
  }
  curves.set(drive, c);
  return c;
}

/** Glide an audio setting to `to` by time `t`. */
function sweep(param: AudioParam, curve: 'exp' | 'lin', to: number, t: number): void {
  if (curve === 'exp') param.exponentialRampToValueAtTime(Math.max(1, to), t);
  else param.linearRampToValueAtTime(to, t);
}

/**
 * Play a sound recipe into `out`, starting at `startAt` on the sound maker's clock. `rand` gives
 * the small differences between plays (pitch jitter, where repeats fall); pass a seeded one to get
 * the same sound every time.
 */
export function playSound(
  ctx: BaseAudioContext,
  out: AudioNode,
  spec: SoundSpec,
  noise: NoiseBank,
  o: PlayOptions,
  rand: () => number = Math.random,
  startAt: number = ctx.currentTime + 0.005,
): Voice {
  const voice = ctx.createGain();
  voice.gain.value = spec.volume * o.gain;
  let tail: AudioNode = voice;
  if (typeof ctx.createStereoPanner === 'function') {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, o.pan));
    voice.connect(p);
    tail = p;
  }
  tail.connect(out);

  let pending = 0;
  let end = startAt;
  const finished = () => {
    if (--pending > 0) return;
    voice.disconnect();
    tail.disconnect();
  };
  for (const layer of spec.layers) {
    const copies = layer.repeat.count;
    const slot = copies > 1 ? layer.repeat.spread / (copies - 1) : 0;
    for (let r = 0; r < copies; r++) {
      // repeats are spread evenly with a little wobble so they do not sound machine-made
      const offset = layer.at + r * slot + (copies > 1 ? (rand() - 0.5) * slot * 0.6 : 0);
      const start = startAt + Math.max(0, offset) * o.stretch;
      const len = layer.length * o.stretch;
      const pitch = o.pitch * (1 + (rand() * 2 - 1) * layer.jitter);

      let src: AudioScheduledSourceNode;
      if (layer.kind === 'osc') {
        const osc = ctx.createOscillator();
        osc.type = layer.wave;
        const f = layer.freq!;
        osc.frequency.setValueAtTime(Math.max(1, f.from * pitch), start);
        sweep(osc.frequency, f.curve, f.to * pitch, start + len);
        src = osc;
      } else {
        const bs = ctx.createBufferSource();
        bs.buffer = noise.get(layer.color);
        bs.loop = true;
        src = bs;
      }
      let node: AudioNode = src;
      if (layer.filter) {
        const bq = ctx.createBiquadFilter();
        bq.type = layer.filter.type;
        bq.Q.value = layer.filter.q;
        bq.frequency.setValueAtTime(Math.max(20, layer.filter.from * pitch), start);
        sweep(bq.frequency, 'exp', Math.max(20, layer.filter.to * pitch), start + len);
        src.connect(bq);
        node = bq;
      }
      if (layer.drive > 0) {
        const shaper = ctx.createWaveShaper();
        shaper.curve = driveCurve(layer.drive);
        shaper.oversample = '2x';
        node.connect(shaper);
        node = shaper;
      }
      const env = ctx.createGain();
      const e = layer.env;
      env.gain.setValueAtTime(TINY, start);
      env.gain.linearRampToValueAtTime(e.peak, start + Math.max(0.001, e.attack * o.stretch));
      env.gain.setValueAtTime(e.peak, start + (e.attack + e.hold) * o.stretch);
      env.gain.exponentialRampToValueAtTime(TINY, start + len);
      node.connect(env);
      let lfo: OscillatorNode | null = null;
      if (layer.wobble) {
        // loudness throbs between 1 - depth and 1, the beat speeding up or slowing down
        const w = layer.wobble;
        const trem = ctx.createGain();
        trem.gain.value = 1 - w.depth / 2;
        const swing = ctx.createGain();
        swing.gain.value = w.depth / 2;
        lfo = ctx.createOscillator();
        lfo.frequency.setValueAtTime(Math.max(0.1, w.from), start);
        lfo.frequency.exponentialRampToValueAtTime(Math.max(0.1, w.to), start + len);
        lfo.connect(swing);
        swing.connect(trem.gain);
        env.connect(trem);
        trem.connect(voice);
        lfo.start(start);
        lfo.stop(start + len + 0.03);
      } else env.connect(voice);

      src.onended = finished;
      pending++;
      if (src instanceof AudioBufferSourceNode) src.start(start, rand() * 1.5);
      else src.start(start);
      src.stop(start + len + 0.03);
      end = Math.max(end, start + len);
    }
  }
  return {
    length: end - startAt,
    stop: (fade = 0.03) => {
      const t = ctx.currentTime;
      voice.gain.cancelScheduledValues(t);
      voice.gain.setTargetAtTime(0, t, fade / 3);
    },
  };
}

/** Make a sound without playing it: the samples it would produce, as one channel. */
export async function renderSound(
  spec: SoundSpec,
  o: Partial<PlayOptions> = {},
  rand: () => number = Math.random,
): Promise<AudioBuffer> {
  const opts = { ...defaults(), ...o };
  const rate = 44100;
  const seconds = spec.length * opts.stretch + 0.15;
  const off = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
  playSound(off, off.destination, spec, new NoiseBank(off), opts, rand, 0);
  return off.startRendering();
}
