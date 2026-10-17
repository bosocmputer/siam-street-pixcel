import { expect, test, type Page } from '@playwright/test';

type State = { x: number; z: number; mode: string; scale: number; haze: boolean };
const state = (page: Page) => page.evaluate('window.__walk.state()') as Promise<State>;

test('the walk is saved on this device and carries on after a reload', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('./?debug=1');
  // a first visit has nothing to carry on from
  await expect(page.getByRole('button', { name: 'เริ่มเดิน' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เริ่มใหม่ที่ประตูท่าแพ' })).toBeHidden();
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  const start = await state(page);

  // walk somewhere, change some settings, and save
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setYaw(Math.PI / 2);
    w.simulate(1, 0, 6);
  })()`);
  await page.evaluate('window.__walk.setStats({ level: 3, exp: 7 })');
  await page.getByRole('button', { name: 'วิ่ง' }).click();
  await page.locator('[data-chip="haze"]').click();
  await expect.poll(async () => (await state(page)).mode).toBe('run');
  const moved = await state(page);
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(10);
  expect(await page.evaluate('window.__walk.save()')).toBe(true);

  // come back: the game offers to carry on, and puts everything back
  await page.reload();
  await page.getByRole('button', { name: 'เดินต่อจากเดิม' }).click();
  await page.waitForFunction(() => '__walk' in window);
  const back = await state(page);
  expect(back.x).toBeCloseTo(moved.x, 3);
  expect(back.z).toBeCloseTo(moved.z, 3);
  expect(back.mode).toBe('run');
  expect(back.haze).toBe(true);
  const kept = (await page.evaluate('window.__walk.stats()')) as { level: number; exp: number };
  expect([kept.level, kept.exp]).toEqual([3, 7]);
  await expect(page.locator('.player')).toContainText('Lv 3');
  await expect(page.locator('[data-chip="haze"]')).toContainText('เปิด');

  // or start again at the gate
  await page.reload();
  await page.getByRole('button', { name: 'เริ่มใหม่ที่ประตูท่าแพ' }).click();
  await page.waitForFunction(() => '__walk' in window);
  const again = await state(page);
  expect(again.x).toBeCloseTo(start.x, 3);
  expect(again.z).toBeCloseTo(start.z, 3);
});

test('a damaged save is ignored and the game starts fresh', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.evaluate(() => localStorage.setItem('citywalk.save', '{"version":1,"player":"oops"}'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'เริ่มเดิน' })).toBeVisible();
});

test('the world stops while the page is hidden', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  expect(await page.evaluate('window.__walk.screen()')).toBe('play');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate('window.__walk.screen()')).toBe('paused');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate('window.__walk.screen()')).toBe('play');
});
