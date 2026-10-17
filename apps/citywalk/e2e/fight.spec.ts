import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Stats = { level: number; exp: number; hp: number; energy: number; down: number };
type Slime = { x: number; z: number; hp: number; alive: boolean; angry: boolean; life: string };

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const stats = (page: Page) => js<Stats>(page, 'window.__walk.stats()');
const slimes = (page: Page) => js<Slime[]>(page, 'window.__walk.slimes()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
// software WebGL is slow when several test files run at once
test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
}

/** Cast at slime i and step the fight until the shot lands (plus `after` seconds). */
async function shoot(page: Page, i: number, id: string, after = 0.1) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setTarget(${i});
    w.cast('${id}');
    for (let n = 0; n < 150 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30);
    w.simulateFight(${after});
  })()`);
}

/** Stand `d` metres from slime i, on the side towards where the walker is now. */
async function standNear(page: Page, i: number, d: number) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[${i}], me = w.state();
    const l = Math.hypot(me.x - s.x, me.z - s.z) || 1;
    w.teleport(s.x + ((me.x - s.x) / l) * ${d}, s.z + ((me.z - s.z) / l) * ${d});
  })()`);
}

test('the player panel shows level, health and energy, and skills use energy', async ({ page }) => {
  await open(page);
  await expect(page.locator('.player')).toContainText('Lv 1');
  await expect(page.locator('.pbar-hp')).toContainText('100/100');
  await expect(page.locator('.pbar-energy')).toContainText('100/100');
  await shoot(page, 1, 'fireball');
  expect((await stats(page)).energy).toBeLessThan(100);

  // with too little energy the button refuses and says why
  // wait out the cooldown first (energy refills meanwhile), then run low
  await js(page, 'window.__walk.simulateFight(2)');
  await js(page, 'window.__walk.setStats({ energy: 5 })');
  await page.getByRole('button', { name: /กระสุนไฟ/ }).tap();
  await expect(page.locator('.toast')).toContainText('พลังไม่พอ');
  expect((await js<{ inFlight: number }>(page, 'window.__walk.combat()')).inFlight).toBe(0);
  await expect(page.locator('[data-skill="fireball"]')).toHaveAttribute('data-low', 'true');
});

test('a slime that is hit gets angry and fights back; calm ones only threaten', async ({
  page,
}) => {
  await open(page);
  // walk up to a calm slime: it threatens but never hurts
  await standNear(page, 0, 1.2);
  await js(page, 'window.__walk.simulateFight(4)');
  expect((await stats(page)).hp).toBe(100);

  // hit one: it turns angry and its blows land
  await shoot(page, 1, 'waterball');
  expect((await slimes(page))[1]!.angry).toBe(true);
  await standNear(page, 1, 1.2);
  await js(page, 'window.__walk.simulateFight(3)');
  const hurt = await stats(page);
  expect(hurt.hp).toBeLessThan(100);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/fight-hurt.png` });
});

test('running out of health means lying down, then getting up at the gate with nothing lost', async ({
  page,
}) => {
  await open(page);
  const start = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  await js(page, 'window.__walk.setStats({ level: 2, exp: 9 })');
  await shoot(page, 1, 'waterball');
  await standNear(page, 1, 1.2);
  await js(page, 'window.__walk.setStats({ hp: 3, safe: 0 })');
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 200 && w.stats().down === 0; n++) w.simulateFight(1 / 30);
  })()`);
  const down = await stats(page);
  expect(down.down).toBeGreaterThan(0);
  expect(down.hp).toBe(0);
  await expect(page.locator('.toast')).toContainText('ล้มแล้ว');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/fight-down.png` });

  await js(page, 'window.__walk.simulateFight(3.5)');
  const up = await stats(page);
  expect(up.down).toBe(0);
  expect(up.hp).toBe(112); // full at level 2
  expect(up.level).toBe(2);
  expect(up.exp).toBe(9);
  const at = await js<{ x: number; z: number }>(page, 'window.__walk.state()');
  expect(at.x).toBeCloseTo(start.x, 3);
  expect(at.z).toBeCloseTo(start.z, 3);
  await expect(page.locator('.toast')).toContainText('ฟื้นแล้ว');
});

test('beating slimes gives experience and a new level', async ({ page }) => {
  await open(page);
  await js(page, 'window.__walk.setStats({ exp: 30 })'); // 10 short of level 2
  for (let n = 0; n < 3; n++) await shoot(page, 0, 'fireball', 1.7);
  expect((await slimes(page))[0]!.alive).toBe(false);
  const s = await stats(page);
  expect(s.level).toBe(2);
  expect(s.exp).toBe(10);
  await expect(page.locator('.player')).toContainText('Lv 2');
  await page.waitForTimeout(400);
  // the level-up message stays up even though the gate is announced meanwhile
  await expect(page.locator('.toast')).toContainText('เลเวลอัป');
  await page.screenshot({ path: `${SHOTS}/fight-levelup.png` });
});
