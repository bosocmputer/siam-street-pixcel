import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

// Pictures of each step of both skills from the side (charge, release, flight, impact, burst,
// after), to compare with the creator's reference sheets.
const OUT = process.env.SHOTS_DIR ?? 'test-results/shots';
const js = (page: Page, code: string) => page.evaluate(code);
test.use({ viewport: { width: 1100, height: 700 } });
test('skill effects step by step, seen from the side', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
  await js(page, "window.__walk.setCamera('back')");
  const setup = `(() => {
    const w = window.__walk; w.setTarget(0);
    const s = w.slimes()[0], me = w.state();
    const d = Math.hypot(me.x - s.x, me.z - s.z);
    const px = s.x + ((me.x - s.x) / d) * 5, pz = s.z + ((me.z - s.z) / d) * 5;
    w.teleport(px, pz);
    const lx = (s.x - px) / 5, lz = (s.z - pz) / 5;
    w.setYaw(Math.atan2(lz, -lx));
    w.simulateFight(1.6);
  })()`;
  const shot = async (name: string) => {
    await page.waitForTimeout(250);
    await page.screenshot({
      path: `${OUT}/fx-${name}.png`,
      clip: { x: 0, y: 160, width: 900, height: 440 },
    });
  };
  for (const [el, id, charge] of [
    ['fire', 'fireball', 0.55],
    ['water', 'waterball', 0.3],
  ] as const) {
    await js(page, setup);
    await page.waitForTimeout(600);
    await js(page, `window.__walk.cast('${id}')`);
    await js(page, `window.__walk.simulateFight(${charge * 0.6})`);
    await shot(`${el}-1-charge`);
    await js(
      page,
      `window.__walk.simulateFight(${el === 'fire' ? charge * 0.4 + 0.02 : charge * 0.4 - 0.03})`,
    );
    await shot(`${el}-2-release`);
    await js(page, `window.__walk.simulateFight(${el === 'fire' ? 0.15 : 0.08})`);
    await shot(`${el}-3-flight`);
    await page.evaluate(
      `(() => { const w = window.__walk; for (let i = 0; i < 150 && w.combat().inFlight > 0; i++) w.simulateFight(1/60); })()`,
    );
    await js(page, 'window.__walk.simulateFight(0.04)');
    await shot(`${el}-4-impact`);
    await js(page, 'window.__walk.simulateFight(0.2)');
    await shot(`${el}-5-burst`);
    await js(page, 'window.__walk.simulateFight(0.5)');
    await shot(`${el}-6-after`);
    await js(page, 'window.__walk.simulateFight(3)');
  }
  expect(await js(page, 'window.__walk.combat().inFlight')).toBe(0);
});
