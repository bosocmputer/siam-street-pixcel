import { defineConfig } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// In the cloud sandbox Chromium is preinstalled under /opt/pw-browsers (do not run `playwright install`).
// In CI the browser is installed by the workflow, so no override is needed.
function sandboxChromium(): string | undefined {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  const exe = dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined;
  return exe && existsSync(exe) ? exe : undefined;
}

export default defineConfig({
  testDir: 'e2e',
  // every game starts through the character screen, which builds the character in software WebGL
  timeout: 90_000,
  webServer: {
    command: 'pnpm preview',
    port: 4174,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:4174',
    // the 3D bodies by default (drawing pixel sprites in software WebGL takes long); the sprite
    // tests ask for pixel art themselves
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4174',
          localStorage: [{ name: 'citywalk.art', value: '3d' }],
        },
      ],
    },
    launchOptions: {
      executablePath: sandboxChromium(),
      // WebGL in headless Chromium needs the software renderer
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
});
