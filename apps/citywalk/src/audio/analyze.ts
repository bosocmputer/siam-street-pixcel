// Looking at a sound's samples: how loud, how long, and a picture of which pitches it holds over
// time (a spectrogram). Plain maths on numbers, so it is tested without any audio.

export interface Stats {
  /** loudest sample, 0..1 (above 1 would distort) */
  peak: number;
  /** average loudness */
  rms: number;
  /** length in seconds */
  seconds: number;
  /** when the first audible sample is, seconds */
  startsAt: number;
  /** when the last audible sample is, seconds */
  endsAt: number;
  /** how many samples went past full scale */
  clipped: number;
}

const AUDIBLE = 0.005;

export function stats(samples: Float32Array, rate: number): Stats {
  let peak = 0,
    sum = 0,
    first = -1,
    last = -1,
    clipped = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]!);
    if (a > peak) peak = a;
    if (a > 1) clipped++;
    sum += a * a;
    if (a > AUDIBLE) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return {
    peak,
    rms: samples.length ? Math.sqrt(sum / samples.length) : 0,
    seconds: samples.length / rate,
    startsAt: first < 0 ? 0 : first / rate,
    endsAt: last < 0 ? 0 : last / rate,
    clipped,
  };
}

/** In-place radix-2 Fourier transform of re/im (length a power of two). */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang),
      wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1,
        ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k,
          b = i + k + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * A grid of how strong each pitch is at each moment: `cols` moments across, `rows` pitches up
 * from 60 Hz to 12 kHz on a log scale (row 0 is the lowest). Values 0..1 on a 60 dB scale.
 */
export function spectrogram(
  samples: Float32Array,
  rate: number,
  cols = 64,
  rows = 28,
  size = 1024,
): number[][] {
  const grid: number[][] = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  const lo = Math.log(60),
    hi = Math.log(Math.min(12000, rate / 2));
  const re = new Float64Array(size),
    im = new Float64Array(size);
  const hop = Math.max(1, (samples.length - size) / Math.max(1, cols - 1));
  for (let c = 0; c < cols; c++) {
    const from = Math.floor(c * hop);
    for (let i = 0; i < size; i++) {
      // a Hann window keeps one pitch from smearing across the picture
      const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
      re[i] = (samples[from + i] ?? 0) * w;
      im[i] = 0;
    }
    fft(re, im);
    const power = new Array<number>(rows).fill(0);
    for (let k = 1; k < size / 2; k++) {
      const f = (k * rate) / size;
      const row = Math.floor(((Math.log(f) - lo) / (hi - lo)) * rows);
      if (row < 0 || row >= rows) continue;
      power[row] = Math.max(power[row]!, Math.hypot(re[k]!, im[k]!) / (size / 4));
    }
    for (let r = 0; r < rows; r++) {
      const db = 20 * Math.log10(Math.max(power[r]!, 1e-6));
      grid[c]![r] = Math.min(1, Math.max(0, (db + 60) / 60));
    }
  }
  return grid;
}
