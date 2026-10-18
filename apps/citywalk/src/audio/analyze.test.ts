import { describe, expect, it } from 'vitest';
import { fft, spectrogram, stats } from './analyze';

const RATE = 44100;
const tone = (hz: number, seconds: number, amp = 0.5) =>
  Float32Array.from(
    { length: Math.floor(RATE * seconds) },
    (_, i) => amp * Math.sin((2 * Math.PI * hz * i) / RATE),
  );

describe('sound analysis', () => {
  it('measures loudness, length and when the sound is audible', () => {
    const quiet = new Float32Array(RATE / 2); // half a second of nothing
    const loud = tone(440, 0.2, 0.8);
    const all = new Float32Array(quiet.length + loud.length);
    all.set(quiet, 0);
    all.set(loud, quiet.length);
    const s = stats(all, RATE);
    expect(s.peak).toBeCloseTo(0.8, 2);
    expect(s.rms).toBeGreaterThan(0.1);
    expect(s.seconds).toBeCloseTo(0.7, 2);
    expect(s.startsAt).toBeCloseTo(0.5, 1);
    expect(s.endsAt).toBeCloseTo(0.7, 1);
    expect(s.clipped).toBe(0);
  });

  it('counts samples past full scale and copes with silence and nothing at all', () => {
    expect(stats(Float32Array.from([0.5, 1.5, -2]), RATE).clipped).toBe(2);
    const none = stats(new Float32Array(100), RATE);
    expect([none.peak, none.startsAt, none.endsAt]).toEqual([0, 0, 0]);
    expect(stats(new Float32Array(0), RATE).rms).toBe(0);
  });

  it('the Fourier transform finds a pure tone in the right place', () => {
    const n = 1024;
    const re = new Float64Array(n),
      im = new Float64Array(n);
    // 16 whole cycles across the window land exactly on bin 16
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * 16 * i) / n);
    fft(re, im);
    const mag = Array.from({ length: n / 2 }, (_, k) => Math.hypot(re[k]!, im[k]!));
    expect(mag.indexOf(Math.max(...mag))).toBe(16);
    expect(mag[16]!).toBeCloseTo(n / 2, 0);
    expect(mag[40]!).toBeLessThan(1e-6);
  });

  it('the picture puts a low tone low down and a high tone high up, and silence nowhere', () => {
    const rows = 28;
    const peakRow = (hz: number) => {
      const g = spectrogram(tone(hz, 0.4), RATE, 16, rows);
      const col = g[8]!;
      return col.indexOf(Math.max(...col));
    };
    const low = peakRow(150),
      mid = peakRow(1000),
      high = peakRow(6000);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
    const quiet = spectrogram(new Float32Array(RATE / 4), RATE, 8, rows);
    expect(Math.max(...quiet.flat())).toBe(0);
    // values stay within 0..1
    const loud = spectrogram(tone(1000, 0.3, 1), RATE, 8, rows).flat();
    expect(Math.max(...loud)).toBeLessThanOrEqual(1);
    expect(Math.min(...loud)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...loud)).toBeGreaterThan(0.8);
  });

  it('a sound shorter than one window still gives a picture', () => {
    const g = spectrogram(tone(800, 0.01), RATE, 4, 10);
    expect(g).toHaveLength(4);
    expect(g[0]).toHaveLength(10);
  });
});
