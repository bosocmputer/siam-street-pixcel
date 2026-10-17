import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Slime = { x: number; z: number; hp: number; life: string; alive: boolean };
type CombatState = { target: number | null; cooldowns: Record<string, number>; inFlight: number };

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const slimes = (page: Page) => js<Slime[]>(page, 'window.__walk.slimes()');
const combat = (page: Page) => js<CombatState>(page, 'window.__walk.combat()');

async function open(page: Page) {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  // stop the world so every step below is ours, and screenshots catch the moment we want
  await js(page, 'window.__walk.pause(true)');
}

/** Tap a skill button; the game picks the command up on its next frame. */
async function press(page: Page, name: string) {
  await page.getByRole('button', { name }).tap();
  await expect.poll(async () => (await combat(page)).inFlight).toBeGreaterThan(0);
}

/** Step the fight in 1/30 s steps until the shot lands, then a little more for the burst. */
async function untilLanded(page: Page, after: number) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let i = 0; i < 150 && w.combat().inFlight > 0; i++) w.simulateFight(1 / 30);
    w.simulateFight(${after});
  })()`);
}

test.describe('skills on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('tap a slime to aim, then fire and water shots fly to it and hurt it', async ({ page }) => {
    test.setTimeout(150_000);
    await open(page);
    await expect(page.getByRole('button', { name: 'กระสุนไฟ' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'กระสุนน้ำ' })).toBeVisible();

    // tap on a slime on the screen to choose it
    const at = await js<[number, number] | null>(page, 'window.__walk.slimeOnScreen(1)');
    expect(at).not.toBeNull();
    await page.touchscreen.tap(at![0], at![1]);
    await expect.poll(async () => (await combat(page)).target).toBe(1);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/skill-target.png` });

    // fire: gathered in the hand, caught in the air, then just after it lands
    await press(page, 'กระสุนไฟ');
    await js(page, 'window.__walk.simulateFight(0.4)');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-fire-gather.png` });
    await js(page, 'window.__walk.simulateFight(0.4)');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-fire-flying.png` });
    await untilLanded(page, 0.1);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-fire-hit.png` });
    expect((await slimes(page))[1]!.hp).toBe(60);

    // the fire skill is cooling down: a second tap does nothing yet
    await page.getByRole('button', { name: 'กระสุนไฟ' }).tap();
    await page.waitForTimeout(300);
    expect((await combat(page)).inFlight).toBe(0);

    // water
    await js(page, 'window.__walk.simulateFight(1.5)');
    await press(page, 'กระสุนน้ำ');
    await js(page, 'window.__walk.simulateFight(0.2)');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-water-gather.png` });
    await js(page, 'window.__walk.simulateFight(0.17)');
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-water-flying.png` });
    await untilLanded(page, 0.12);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SHOTS}/skill-water-hit.png` });
    expect((await slimes(page))[1]!.hp).toBe(40);

    // up close, about 5 m away from a slime that is still whole, to see both effects in detail
    await page.evaluate(`(() => {
      const w = window.__walk;
      w.setTarget(0);
      const s = w.slimes()[0], me = w.state();
      const d = Math.hypot(me.x - s.x, me.z - s.z);
      w.teleport(s.x + ((me.x - s.x) / d) * 5, s.z + ((me.z - s.z) / d) * 5);
      w.simulateFight(1.5);
    })()`);
    for (const [skill, name, gather] of [
      ['fire', 'กระสุนไฟ', 0.55],
      ['water', 'กระสุนน้ำ', 0.3],
    ] as const) {
      await press(page, name);
      await js(page, `window.__walk.simulateFight(${gather * 0.75})`);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/skill-${skill}-close-gather.png` });
      await js(page, `window.__walk.simulateFight(${gather * 0.25 + 0.1})`);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/skill-${skill}-close-flying.png` });
      await untilLanded(page, 0.08);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${SHOTS}/skill-${skill}-close-hit.png` });
      await js(page, 'window.__walk.simulateFight(1.5)');
    }
    expect((await slimes(page))[0]!.hp).toBe(40);
  });
});

test('a beaten slime melts away and grows back at home', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await js(page, 'window.__walk.setTarget(0)');
  for (let i = 0; i < 3; i++) {
    await js(page, "window.__walk.cast('fire')");
    await untilLanded(page, 1.4);
  }
  // 3 × 40 is more than its 100 hit points
  let s = (await slimes(page))[0]!;
  expect(s.hp).toBe(0);
  expect(s.alive).toBe(false);
  expect((await combat(page)).target).toBeNull();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/skill-melted.png` });
  await js(page, 'window.__walk.simulateFight(6)');
  s = (await slimes(page))[0]!;
  expect(s.life).toBe('alive');
  expect(s.hp).toBe(100);

  // with nothing chosen, Q picks the nearest slime in front by itself
  await js(page, 'window.__walk.pause(false)');
  await page.locator('#view').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('KeyQ');
  await expect.poll(async () => (await combat(page)).target).not.toBeNull();
});
