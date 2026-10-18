import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Slime = {
  x: number;
  z: number;
  hp: number;
  mode: string;
  species: string;
  life: string;
  alive: boolean;
  angry: boolean;
};
type Stats = { level: number; exp: number; hp: number; energy: number; down: number };

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const slimes = (page: Page) => js<Slime[]>(page, 'window.__walk.slimes()');
const stats = (page: Page) => js<Stats>(page, 'window.__walk.stats()');
const bossIndex = async (page: Page) =>
  (await slimes(page)).findIndex((s) => s.species === 'boss_tide_regent');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
}

/** Stand `d` metres from the boss on the side we are on, facing it, and target it. */
async function standAt(page: Page, d: number) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    const i = w.slimes().findIndex((s) => s.species === 'boss_tide_regent');
    w.setTarget(i);
    const b = w.slimes()[i], me = w.state();
    const l = Math.hypot(me.x - b.x, me.z - b.z) || 1;
    const px = b.x + ((me.x - b.x) / l) * ${d}, pz = b.z + ((me.z - b.z) / l) * ${d};
    w.teleport(px, pz);
    w.setYaw(Math.atan2((b.z - pz) / ${d}, -(b.x - px) / ${d}));
  })()`);
}

const run = (page: Page, seconds: number) => js(page, `window.__walk.simulateFight(${seconds})`);

/** run the fight until the boss is in this mode (or the time is up); returns whether it got there */
const untilMode = (page: Page, mode: string, limit = 25) =>
  js<boolean>(
    page,
    `(() => {
      const w = window.__walk;
      const i = w.slimes().findIndex((s) => s.species === 'boss_tide_regent');
      for (let t = 0; t < ${limit}; t += 1 / 30) {
        if (w.slimes()[i].mode === '${mode}') return true;
        w.simulateFight(1 / 30);
      }
      return false;
    })()`,
  );

test('the boss stands on the square, big, with its own numbers', async ({ page }) => {
  await open(page);
  const list = await slimes(page);
  expect(list).toHaveLength(7);
  const i = await bossIndex(page);
  expect(i).toBeGreaterThanOrEqual(0);
  expect(list[i]!.hp).toBe(500);
  const on = await js<boolean>(
    page,
    'window.__walk.onPlaza(-15, 34) && window.__walk.onPlaza(-21, 34) && window.__walk.onPlaza(-9, 34)',
  );
  expect(on).toBe(true);
  await standAt(page, 14);
  await run(page, 1.5);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/boss-stand.png` });
  // weak to fire: 40 × 1.5
  await js(page, "window.__walk.cast('fireball')");
  await page.evaluate(
    `(() => { const w = window.__walk; for (let n = 0; n < 200 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30); w.simulateFight(0.5); })()`,
  );
  const after = (await slimes(page))[i]!;
  expect(after.hp).toBe(500 - 60); // 40 × 1.5
  expect(after.angry).toBe(true);
});

test('an angry boss slams the ground and charges, and both hurt', async ({ page }) => {
  await open(page);
  const i = await bossIndex(page);
  await standAt(page, 12);
  await run(page, 1);
  // a hit makes it angry (it only threatens until then)
  await js(page, "window.__walk.cast('fireball')");
  await page.evaluate(
    `(() => { const w = window.__walk; for (let n = 0; n < 200 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30); })()`,
  );
  expect((await slimes(page))[i]!.angry).toBe(true);

  // from 8 metres it charges: crouch, then rush at the player and hit them
  await standAt(page, 8);
  await js(page, 'window.__walk.setStats({ hp: 100, safe: 0 })');
  expect(await untilMode(page, 'charge')).toBe(true);
  await run(page, 0.5);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/boss-charge-crouch.png` });
  await run(page, 0.7);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/boss-charge-dash.png` });
  await run(page, 0.6);
  expect((await stats(page)).hp).toBeLessThan(100);

  // up close it rears up and brings its arms down: the ground shakes and the player is hurt
  await js(page, 'window.__walk.setStats({ hp: 100, safe: 0 })');
  await standAt(page, 3);
  expect(await untilMode(page, 'slam')).toBe(true);
  await run(page, 0.6);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/boss-slam-raise.png` });
  await run(page, 0.5);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/boss-slam-hit.png` });
  await run(page, 1.2);
  expect((await stats(page)).hp).toBeLessThanOrEqual(100 - 28);
  expect(await js<string[]>(page, 'window.__walk.sound.log()')).toContain('boss.slam');
});

test('beating the boss gives a lot of experience and its drops, and it grows back much later', async ({
  page,
}) => {
  await open(page);
  const i = await bossIndex(page);
  await standAt(page, 12);
  // nine fireballs at 60 each; keep the energy up so the fight is about the boss, not the gauge
  for (let n = 0; n < 9; n++) {
    await js(page, 'window.__walk.setStats({ energy: 100, hp: 100, safe: 0 })');
    await js(page, 'window.__walk.setTarget(' + i + "); window.__walk.cast('fireball')");
    await page.evaluate(
      `(() => { const w = window.__walk; for (let k = 0; k < 200 && w.combat().inFlight > 0; k++) w.simulateFight(1 / 30); w.simulateFight(1.7); })()`,
    );
    await standAt(page, 12);
  }
  const b = (await slimes(page))[i]!;
  expect(b.hp).toBe(0);
  expect(['melting', 'gone']).toContain(b.life);
  // 200 experience is several levels' worth at the start
  expect((await stats(page)).level).toBeGreaterThanOrEqual(3);
  const drops = await js<{ item: string; count: number }[]>(page, 'window.__walk.pickups()');
  const of = (item: string) =>
    drops.filter((d) => d.item === item).reduce((n, d) => n + d.count, 0);
  expect(of('gel_core')).toBeGreaterThanOrEqual(2);
  expect(of('gel_water')).toBeGreaterThanOrEqual(4);

  // it takes two minutes to come back, with full health
  await run(page, 100);
  expect((await slimes(page))[i]!.alive).toBe(false);
  await run(page, 30);
  const back = (await slimes(page))[i]!;
  expect(back.life).toBe('alive');
  expect(back.hp).toBe(500);
});
