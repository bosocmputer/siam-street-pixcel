/// <reference types="vitest" />
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 1600 },
  test: { include: ['src/**/*.test.ts'] },
});
