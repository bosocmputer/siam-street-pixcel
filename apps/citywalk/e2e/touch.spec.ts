import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('dragging a finger on the left side walks', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).tap();
  await page.waitForFunction(() => '__walk' in window);
  const before = (await page.evaluate('window.__walk.state()')) as Pos;
  const cdp = await page.context().newCDPSession(page);
  type Pos = { x: number; z: number };
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
    });
  await touch('touchStart', 90, 650);
  for (let i = 1; i <= 10; i++) await touch('touchMove', 90, 650 - i * 6);
  await page.waitForTimeout(1500);
  const during = (await page.evaluate('window.__walk.state()')) as Pos;
  await touch('touchEnd', 90, 590);
  expect(Math.hypot(during.x - before.x, during.z - before.z)).toBeGreaterThan(2);
});

test('the joystick is visible and dragging the right side turns the camera', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).tap();
  await page.waitForFunction(() => '__walk' in window);
  await expect(page.locator('.stick')).toBeVisible();
  await expect(page.locator('.stick-hint')).toHaveText('ลากเพื่อเดิน');
  await page.screenshot({
    path: `${process.env.SHOTS_DIR ?? 'test-results/shots'}/phone-stick.png`,
  });
  const yaw0 = (await page.evaluate('window.__walk.state().yaw')) as number;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 2 }],
    });
  await touch('touchStart', 300, 400);
  for (let i = 1; i <= 8; i++) await touch('touchMove', 300 - i * 10, 400);
  await touch('touchEnd', 220, 400);
  await page.waitForTimeout(200);
  const yaw1 = (await page.evaluate('window.__walk.state().yaw')) as number;
  expect(yaw1).not.toBeCloseTo(yaw0, 2);
});
