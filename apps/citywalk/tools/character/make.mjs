// Make the draft characters: build each design in a browser page (three.js needs a canvas for the
// face), save it as .glb and draw a turnaround picture (front, three-quarter, side, back).
//
//   node tools/character/make.mjs [outDir] [design ids...]
//
// Files go to newgame/refs/characters/ unless another folder is given.

import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '../..');
const repo = resolve(app, '../..');
const out = resolve(process.argv[2] ?? join(repo, 'newgame/refs/characters'));
const args = process.argv.slice(3);
// --mixamo: also write a test copy dressed up as a Mixamo file (bone names, T-pose, centimetres)
const mixamo = args.includes('--mixamo');
const only = args.filter((a) => !a.startsWith('--'));
mkdirSync(out, { recursive: true });

function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).find((d) => /^chromium-\d+$/.test(d));
  return dir ? join(root, dir, 'chrome-linux', 'chrome') : undefined;
}

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body style="margin:0;background:#fff"><script type="module" src="/tools/page.js"></script></body></html>`;

const types = { js: 'text/javascript', json: 'application/json', html: 'text/html' };
const browser = await chromium.launch({
  executablePath: chromiumPath(),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 760 } });
page.on('console', (m) => m.type() === 'error' && console.error('page:', m.text()));
page.on('pageerror', (e) => console.error('page error:', e.message));
await page.route('http://maker.local/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  let file;
  if (path === '/') return route.fulfill({ body: PAGE, contentType: 'text/html' });
  if (path.startsWith('/three/')) file = join(app, 'node_modules', path);
  else if (path.startsWith('/tools/')) file = join(here, path.slice('/tools/'.length));
  else if (path === '/rig.json') file = join(repo, 'packages/rpg-core/config/rig.json');
  if (!file || !existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + path });
  route.fulfill({
    body: readFileSync(file),
    contentType: types[file.split('.').pop()] ?? 'application/octet-stream',
  });
});
await page.goto('http://maker.local/');
await page.waitForFunction(() => window.maker?.ready === true, null, { timeout: 30000 });
const ids = only.length ? only : await page.evaluate(() => Object.keys(window.maker.designs));
for (const id of ids) {
  const r = await page.evaluate((id) => window.maker.make(id), id);
  writeFileSync(join(out, `${id}.glb`), Buffer.from(r.glb, 'base64'));
  await page.evaluate((id) => window.maker.turnaround(id), id);
  await page.screenshot({ path: join(out, `${id}.png`) });
  await page.evaluate((id) => window.maker.portrait(id), id);
  await page.screenshot({ path: join(out, `${id}_face.png`) });
  console.log(`${id}: ${r.triangles} triangles, ${Math.round(r.bytes / 1024)} KB`);
  if (mixamo) {
    const t = await page.evaluate((id) => window.maker.make(id, 'mixamo'), id);
    writeFileSync(join(out, `${id}_mixamo.glb`), Buffer.from(t.glb, 'base64'));
  }
}
await browser.close();
