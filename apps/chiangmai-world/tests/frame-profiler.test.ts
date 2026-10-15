import { expect, it } from 'vitest';
import { summarizeFrames } from '../src/frame-profiler';
it('computes throughput FPS and tail frame latency rather than averaging instantaneous FPS', () => {
  const result = summarizeFrames(
    [10, 10, 40].map((frameMs) => ({
      frameMs,
      simulationMs: 1,
      viewMs: 2,
      renderMs: 3,
      drawcalls: 100,
      triangles: 200,
      geometries: 4,
      textures: 2,
    })),
  );
  if (!result) throw new Error('Expected measured frames');
  expect(result.fps).toBe(50);
  expect(result.p95FrameMs).toBe(40);
  expect(result.over33msPercent).toBeCloseTo(100 / 3);
  expect(result.simulationMs).toBe(1);
  expect(result.samples).toBe(3);
  expect(summarizeFrames([])).toBeNull();
});
