import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

// The strike button and what goes with it (jobs.md section 1): three hits in a chain with the
// iron pipe, closing in on a slime a few steps off (no shots at range: those come from skills),
// dash and guard, the perfect dodge, and the combo count.

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

test('a slime a few steps off: the player closes in and the pipe lands; too far, it hits air', async ({
  page,
}) => {
  await open(page);
  await standNear(page, 1, 4);
  const start = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  const before = (await slimes(page))[1]!.hp;
  await js(page, 'window.__walk.strike()');
  await js(page, 'window.__walk.simulateStrike(0.05)');
  expect((await js<{ lunge: number }>(page, 'window.__walk.combat()')).lunge).toBeGreaterThan(0);
  await js(page, 'window.__walk.simulateStrike(0.8)');
  const end = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeGreaterThan(1.5);
  expect((await slimes(page))[1]!.hp).toBeLessThan(before);
  await page.screenshot({ path: `${SHOTS}/strike-lunge.png` });

  // beyond the lunge the swing stays where it is and nothing flies
  await js(page, 'window.__walk.simulateStrike(1)');
  await standNear(page, 1, 10);
  const far = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  const hp = (await slimes(page))[1]!.hp;
  await js(page, 'window.__walk.strike()');
  await js(page, 'window.__walk.simulateStrike(0.8)');
  const still = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  expect(Math.hypot(still.x - far.x, still.z - far.z)).toBeLessThan(0.2);
  expect((await slimes(page))[1]!.hp).toBe(hp);
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

test('an angry slime warns with a red ring before its blow, and the ring sounds', async ({
  page,
}) => {
  await open(page);
  await standNear(page, 0, 1.4);
  // hit it: now it fights back
  await js(page, 'window.__walk.sound.clear()');
  await js(page, 'window.__walk.strike()');
  await js(page, 'window.__walk.simulateStrike(0.5)');
  // step the fight until a ring shows
  const shown = await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 120; n++) {
      w.simulateFight(1 / 30);
      const s = w.warnings();
      if (s.shown > 0) return s;
    }
    return w.warnings();
  })()`);
  const s = shown as { shown: number; list: { kind: string; radius: number; fill: number }[] };
  expect(s.shown).toBeGreaterThan(0);
  expect(s.list[0]).toMatchObject({ kind: 'blow' });
  expect(s.list[0]!.radius).toBeGreaterThan(1);
  const log = await js<string[]>(page, 'window.__walk.sound.log()');
  expect(log).toContain('telegraph.warn');
  // half way to the blow, for the picture
  await js(page, 'window.__walk.simulateFight(0.3)');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/warning-ring.png` });
});

test('combo help in the settings gives a wider perfect dodge, and is remembered', async ({
  page,
}) => {
  await open(page);
  const late = 0.4; // too late without help, in time with it
  const dodge = () =>
    page.evaluate(`(() => {
      const w = window.__walk;
      w.dash(1, 0);
      w.simulateStrike(${late});
      return w.blow(10);
    })()`);
  expect(await dodge()).toBe('hit');
  await js(page, 'window.__walk.simulateStrike(1.5)');
  await page.getByRole('button', { name: 'ตั้งค่า' }).click();
  const chip = page.locator('[data-chip="assist"]');
  await expect(chip).toContainText('ปิด');
  await chip.click();
  await expect(chip).toContainText('เปิด');
  expect(await dodge()).toBe('perfect');
  await page.reload();
  await page.getByRole('button', { name: 'เดินต่อจากเดิม' }).click();
  await page.waitForFunction(() => '__walk' in window);
  await page.getByRole('button', { name: 'ตั้งค่า' }).click();
  await expect(page.locator('[data-chip="assist"]')).toContainText('เปิด');
});

test('the target ring shows while fighting and goes once the fight is over', async ({ page }) => {
  await open(page);
  await standNear(page, 1, 6);
  const marked = async () => (await js<{ marked: boolean }>(page, 'window.__walk.combat()')).marked;
  await js(page, 'window.__walk.simulateFight(1 / 30)');
  expect(await marked()).toBe(true);
  // a calm slime nobody is hitting: after a few seconds the ring is gone
  await js(page, 'window.__walk.simulateFight(5)');
  expect(await marked()).toBe(false);
  await expect(page.locator('.hpbox')).toBeHidden();
  // a strike brings it back
  await js(page, 'window.__walk.strike()');
  await js(page, 'window.__walk.simulateStrike(0.2)');
  expect(await marked()).toBe(true);
});
