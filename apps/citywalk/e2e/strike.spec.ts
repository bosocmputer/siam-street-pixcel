import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

// The strike button and what goes with it (jobs.md section 1): three hits in a chain, a wave at
// a slime out of reach, dash and guard, the perfect dodge, and the combo count.

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Fighter = {
  chain: number;
  swinging: number;
  combo: number;
  best: number;
  guarding: boolean;
  dash: number;
  counter: boolean;
  slow: number;
};
type Slime = { x: number; z: number; hp: number; alive: boolean };

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const fighter = (page: Page) => js<Fighter>(page, 'window.__walk.fighter()');
const slimes = (page: Page) => js<Slime[]>(page, 'window.__walk.slimes()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
}

/** Stand `d` metres from slime i, facing it, with it chosen as the target. */
async function standNear(page: Page, i: number, d: number) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[${i}], me = w.state();
    const l = Math.hypot(me.x - s.x, me.z - s.z) || 1;
    w.teleport(s.x + ((me.x - s.x) / l) * ${d}, s.z + ((me.z - s.z) / l) * ${d});
    w.setTarget(${i});
  })()`);
}

test('three strikes in a row hit the slime, the third hard, and the combo is found', async ({
  page,
}) => {
  await open(page);
  await standNear(page, 0, 1.4);
  await js(page, 'window.__walk.setStats({ energy: 50 })');
  const before = (await slimes(page))[0]!.hp;
  for (let n = 1; n <= 3; n++) {
    await js(page, 'window.__walk.strike()');
    expect((await fighter(page)).swinging).toBe(n);
    await js(page, 'window.__walk.simulateStrike(0.5)');
  }
  const f = await fighter(page);
  expect(f.chain).toBe(3);
  expect(f.combo).toBe(3);
  const after = (await slimes(page))[0]!;
  expect(after.hp).toBeLessThan(before);
  // every hit gives a little energy back
  const s = await js<{ energy: number }>(page, 'window.__walk.stats()');
  expect(s.energy).toBeGreaterThan(50);
  // the heavy third hit is a combo, found for the first time
  expect(await js<string[]>(page, 'window.__walk.found()')).toContain('finisher');
  await expect(page.locator('.combo')).toHaveClass(/show/);
  await expect(page.locator('.combo b')).toHaveText('3');
  await page.screenshot({ path: `${SHOTS}/strike-chain.png` });
});

test('a slime out of reach gets a wave instead', async ({ page }) => {
  await open(page);
  await standNear(page, 1, 8);
  const before = (await slimes(page))[1]!.hp;
  await js(page, 'window.__walk.strike()');
  await js(page, 'window.__walk.simulateStrike(0.15)');
  expect((await js<{ waves: number }>(page, 'window.__walk.combat()')).waves).toBe(1);
  await js(page, 'window.__walk.simulateStrike(1)');
  expect((await slimes(page))[1]!.hp).toBeLessThan(before);
});

test('dash, guard, the perfect dodge and its counter', async ({ page }) => {
  await open(page);
  await standNear(page, 0, 3);
  // moving: a dash, which a strike straight after turns into a dash strike
  await js(page, 'window.__walk.dash(1, 0)');
  expect((await fighter(page)).dash).toBeGreaterThan(0);
  // a blow just after the dash starts is dodged perfectly: time slows, the next strike counters
  expect(await js(page, 'window.__walk.blow(20)')).toBe('perfect');
  const f = await fighter(page);
  expect(f.counter).toBe(true);
  expect(f.slow).toBeGreaterThan(0);
  await expect(page.locator('.strike')).toHaveAttribute('data-counter', 'true');
  await js(page, 'window.__walk.simulateStrike(1.5)');
  // standing still the same button guards, and a guarded blow hurts less
  await js(page, 'window.__walk.dash(0, 0)');
  expect((await fighter(page)).guarding).toBe(true);
  expect(await js(page, 'window.__walk.blow(20)')).toBe('guarded');
  // without the button held the guard drops on the next frame
  await expect.poll(async () => (await fighter(page)).guarding).toBe(false);
  expect(await js(page, 'window.__walk.blow(20)')).toBe('hit');
});

test('the buttons and keys: strike, dash, Shift to run, no walk/run/bike buttons', async ({
  page,
}) => {
  await open(page);
  await js(page, 'window.__walk.pause(false)');
  await expect(page.getByRole('button', { name: 'ตี' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'พุ่ง' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เปลี่ยนเป้า' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'วิ่ง' })).toHaveCount(0);
  await page.getByRole('button', { name: 'ตี' }).tap();
  await expect.poll(async () => (await fighter(page)).chain, { timeout: 15_000 }).toBe(1);
  // keys: J strikes again, holding Space while standing guards
  await page.locator('#view').click({ position: { x: 5, y: 300 } });
  await page.keyboard.press('KeyJ');
  await expect.poll(async () => (await fighter(page)).chain, { timeout: 15_000 }).toBe(2);
  await page.keyboard.down('Space');
  await expect.poll(async () => (await fighter(page)).guarding, { timeout: 15_000 }).toBe(true);
  await page.keyboard.up('Space');
  await expect.poll(async () => (await fighter(page)).guarding, { timeout: 15_000 }).toBe(false);
  // W walks, W with Shift runs
  await page.keyboard.down('KeyW');
  await expect
    .poll(async () => (await js<{ mode: string }>(page, 'window.__walk.state()')).mode)
    .toBe('walk');
  await page.keyboard.down('ShiftLeft');
  await expect
    .poll(async () => (await js<{ mode: string }>(page, 'window.__walk.state()')).mode, {
      timeout: 15_000,
    })
    .toBe('run');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
});
