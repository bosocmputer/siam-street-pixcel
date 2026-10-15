export interface FrameSample {
  frameMs: number;
  simulationMs: number;
  viewMs: number;
  renderMs: number;
  drawcalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}
export function summarizeFrames(samples: FrameSample[]) {
  if (!samples.length) return null;
  const ordered = samples.map((s) => s.frameMs).sort((a, b) => a - b);
  const average = (key: keyof FrameSample) =>
    samples.reduce((sum, s) => sum + s[key], 0) / samples.length;
  const percentile = (p: number) =>
    ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * p) - 1)];
  return {
    samples: samples.length,
    durationMs: samples.reduce((sum, s) => sum + s.frameMs, 0),
    fps: 1000 / average('frameMs'),
    medianFrameMs: percentile(0.5),
    p95FrameMs: percentile(0.95),
    p99FrameMs: percentile(0.99),
    over33msPercent: (samples.filter((s) => s.frameMs > 1000 / 30).length / samples.length) * 100,
    simulationMs: average('simulationMs'),
    viewMs: average('viewMs'),
    renderSubmitMs: average('renderMs'),
    drawcalls: average('drawcalls'),
    triangles: average('triangles'),
    maxGeometries: Math.max(...samples.map((s) => s.geometries)),
    maxTextures: Math.max(...samples.map((s) => s.textures)),
  };
}
export type FrameSummary = NonNullable<ReturnType<typeof summarizeFrames>>;
export class CrowdBenchmark {
  active = false;
  status = 'พร้อมวัด 1 คนเทียบกับ 10 คน';
  results: {
    bots: 1 | 10;
    round: number;
    stats: FrameSummary;
    activity: Record<string, number>;
  }[] = [];
  private phases: (1 | 10)[] = [1, 10, 10, 1];
  private phase = 0;
  private elapsed = 0;
  private samples: FrameSample[] = [];
  constructor(private configure: (count: 1 | 10) => void) {}
  start(): void {
    this.active = true;
    this.phase = 0;
    this.elapsed = 0;
    this.samples = [];
    this.results = [];
    this.configure(1);
  }
  cancel(reason: string): void {
    if (this.active) this.status = `หยุดวัด: ${reason}`;
    this.active = false;
  }
  record(sample: FrameSample, activity: Record<string, number>): void {
    if (!this.active) return;
    this.elapsed += sample.frameMs;
    const bots = this.phases[this.phase];
    this.status = `รอบ ${this.phase + 1}/4 · ${bots} คน · ${this.elapsed < 3000 ? 'อุ่นฉาก' : 'กำลังวัด'} ${Math.ceil(Math.max(0, 13000 - this.elapsed) / 1000)}s`;
    if (this.elapsed < 3000) return;
    this.samples.push(sample);
    if (this.elapsed < 13000) return;
    const stats = summarizeFrames(this.samples)!;
    this.results.push({ bots, round: this.phase + 1, stats, activity: { ...activity } });
    this.phase++;
    this.elapsed = 0;
    this.samples = [];
    if (this.phase === this.phases.length) {
      this.active = false;
      this.status = 'วัดครบ 4 รอบแล้ว · ดูผลด้านล่าง';
      this.configure(10);
      return;
    }
    this.configure(this.phases[this.phase]);
  }
}
