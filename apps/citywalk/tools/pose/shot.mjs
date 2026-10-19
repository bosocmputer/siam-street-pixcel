// node tools/pose/shot.mjs <out.png> "<query>" : screenshot the pose page (dev server on :5199)
import { chromium } from '@playwright/test';
const [out, query = ''] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto(`http://localhost:5199/tools/pose/index.html?${query}`);
await p.waitForFunction(() => window.ready, null, { timeout: 120000 });
await p.screenshot({ path: out, fullPage: true });
await b.close();
