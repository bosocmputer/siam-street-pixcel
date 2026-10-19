// node tools/pose/export.mjs <out dir> [old game url] : save the hero sheet drawn by the pose page
// (dev server on :5199) as new_<anim>.png + new.json, and, given the url of an older build with
// ?debug=1, that build's sheet as old_*, for side-by-side previews.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [dir, oldUrl] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader'],
});
const save = (tag, out) => {
  const anims = Object.keys(out.meta.anims);
  out.pages.forEach((url, i) =>
    writeFileSync(`${dir}/${tag}_${i}.png`, Buffer.from(url.split(',')[1], 'base64')),
  );
  writeFileSync(`${dir}/${tag}.json`, JSON.stringify({ ...out.meta, order: anims }, null, 1));
};
const p = await b.newPage();
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.goto('http://localhost:5199/tools/pose/index.html?zoom=1');
await p.waitForFunction(() => window.ready, null, { timeout: 180000 });
save('new', await p.evaluate(() => window.out));
if (oldUrl) {
  await p.goto(oldUrl);
  await p.waitForFunction(() => '__walk' in window, null, { timeout: 180000 });
  const out = await p.evaluate(async () => (await window.__walk.bakePreview()).hero);
  save('old', out);
}
await b.close();
