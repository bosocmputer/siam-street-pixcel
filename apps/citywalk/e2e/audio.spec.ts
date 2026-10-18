import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const heard = (page: Page) => js<string[]>(page, 'window.__walk.sound.log()');
const clear = (page: Page) => js(page, 'window.__walk.sound.clear()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
}

async function shoot(page: Page, i: number, id: string, after = 0.1) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setTarget(${i});
    w.cast('${id}');
    for (let n = 0; n < 150 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30);
    w.simulateFight(${after});
  })()`);
}

test('every sound comes out audible, whole and not clipped', async ({ page }) => {
  await open(page);
  expect(await js(page, 'window.__walk.sound.ready()')).toBe(true);
  const ids = await js<string[]>(page, 'window.__walk.sound.ids()');
  expect(ids.length).toBe(26);
  for (const id of ids) {
    const m = await js<{
      peak: number;
      seconds: number;
      recipe: number;
      clipped: number;
      startsAt: number;
    }>(page, `window.__walk.sound.measure('${id}', 1)`);
    expect(m.peak, `${id} is too quiet`).toBeGreaterThan(0.05);
    expect(m.peak, `${id} is too loud`).toBeLessThan(0.9);
    expect(m.clipped, `${id} clips`).toBe(0);
    expect(m.startsAt, `${id} starts late`).toBeLessThan(0.05);
    // the tail is rendered 0.15 s past the recipe; the sound should not run past that
    expect(m.seconds, `${id} runs long`).toBeLessThanOrEqual(m.recipe + 0.16);
  }
});

test('skills, hits and drops make their sounds', async ({ page }) => {
  await open(page);
  await clear(page);
  await shoot(page, 1, 'fireball', 0.2);
  let log = await heard(page);
  expect(log).toContain('fire.gather');
  expect(log).toContain('fire.release');
  expect(log).toContain('fire.flight');
  expect(log).toContain('fire.impact');
  expect(log).toContain('slime.hurt');

  await js(page, 'window.__walk.simulateFight(2)');
  await clear(page);
  await shoot(page, 1, 'waterball', 0.2);
  log = await heard(page);
  expect(log).toContain('water.gather');
  expect(log).toContain('water.release');
  expect(log).toContain('water.impact');

  // a slime beaten for good melts and drops something
  await clear(page);
  for (let n = 0; n < 3; n++) await shoot(page, 0, 'fireball', 1.7);
  log = await heard(page);
  expect(log).toContain('slime.melt');
});

test('a tap on a button clicks, and a refused skill denies', async ({ page }) => {
  await open(page);
  await clear(page);
  await page.getByRole('button', { name: /กล้อง/ }).tap();
  expect(await heard(page)).toContain('ui.click');
  await js(page, 'window.__walk.setStats({ energy: 5 })');
  await page.getByRole('button', { name: /กระสุนไฟ/ }).tap();
  await expect.poll(() => heard(page)).toContain('ui.deny');
});

test('getting hurt, lying down and levelling up sound off', async ({ page }) => {
  await open(page);
  await js(page, 'window.__walk.setStats({ level: 2, exp: 9 })');
  await shoot(page, 1, 'waterball');
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[1], me = w.state();
    const l = Math.hypot(me.x - s.x, me.z - s.z) || 1;
    w.teleport(s.x + ((me.x - s.x) / l) * 1.2, s.z + ((me.z - s.z) / l) * 1.2);
  })()`);
  await clear(page);
  await js(page, 'window.__walk.setStats({ hp: 60, safe: 0 })');
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 200 && !w.sound.log().includes('player.hurt'); n++) w.simulateFight(1 / 30);
  })()`);
  expect(await heard(page)).toContain('player.hurt');
  await js(page, 'window.__walk.setStats({ hp: 3, safe: 0 })');
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 200 && w.stats().down === 0; n++) w.simulateFight(1 / 30);
  })()`);
  expect(await heard(page)).toContain('player.down');
  await js(page, 'window.__walk.simulateFight(3.5)');
  expect(await heard(page)).toContain('player.up');
});

test('levelling up rings out', async ({ page }) => {
  await open(page);
  await js(page, 'window.__walk.setStats({ exp: 30 })'); // 10 short of level 2
  await clear(page);
  let rang = false;
  for (let n = 0; n < 3; n++) {
    await shoot(page, 0, 'fireball', 1.7);
    rang ||= (await heard(page)).includes('player.levelup');
  }
  expect(rang).toBe(true);
});

test('walking makes steps, and the sound chip turns everything off and stays off', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.sound.clear()');
  // footsteps come from the main loop, so walk for real (keys only count when no button has focus)
  await page.locator('#view').click({ position: { x: 5, y: 5 } });
  await page.keyboard.down('KeyW');
  await expect.poll(() => heard(page), { timeout: 8000 }).toContain('step.walk');
  await page.keyboard.up('KeyW');

  const chip = page.locator('[data-chip="sound"]');
  await expect(chip).toContainText('เปิด');
  await chip.click();
  await expect(chip).toContainText('ปิด');
  await clear(page);
  await page.locator('#view').click({ position: { x: 5, y: 5 } });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  expect(await heard(page)).toEqual([]);

  await page.reload();
  await page
    .getByRole('button', { name: /เริ่มเดิน|เดินต่อจากเดิม/ })
    .first()
    .click();
  await page.waitForFunction(() => '__walk' in window);
  expect(await js(page, 'window.__walk.sound.muted()')).toBe(true);
  await expect(page.locator('[data-chip="sound"]')).toContainText('ปิด');
});

test('the listening room opens from the first page and plays every sound', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'ฟังเสียงทั้งหมด' }).click();
  await page.waitForFunction(() => '__walk' in window);
  await expect(page.locator('.lab')).toBeVisible();
  await expect(page.locator('.lab-play')).toHaveCount(26);
  // spectrograms are painted one by one; wait for the last
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const cs = Array.from(document.querySelectorAll<HTMLCanvasElement>('.lab-spec'));
          return cs.filter((c) => {
            const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
            for (let i = 0; i < d.length; i += 4)
              if (d[i]! + d[i + 1]! + d[i + 2]! > 30) return true;
            return false;
          }).length;
        }),
      { timeout: 30_000 },
    )
    .toBe(26);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${SHOTS}/lab.png` });

  await js(page, 'window.__walk.sound.clear()');
  await page.locator('.lab-play').nth(5).click();
  await expect.poll(() => heard(page)).toHaveLength(1);
  await page.getByRole('button', { name: 'ขวา' }).click();
  await page.locator('.lab-play').nth(0).click();
  await expect.poll(() => heard(page)).toHaveLength(2);

  await page.locator('.lab-back').click();
  await expect(page.locator('.lab')).toHaveCount(0);
});
