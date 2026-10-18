import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
type Pt = [number, number] | null;
const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;

test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
}

for (const [name, size] of [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 800 }],
] as const)
  test(`shoulder view puts the player left of centre and keeps the target in sight on ${name}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);
    const w = size.width;

    // the same spot and the same aim, in the two views
    await js(page, 'window.__walk.setTarget(1)');
    await js(page, 'window.__walk.setCamera("back")');
    await page.waitForTimeout(900);
    const back = await js<Pt>(page, 'window.__walk.walkerOnScreen()');
    await page.screenshot({ path: `${SHOTS}/camera-${name}-back.png` });

    await js(page, 'window.__walk.setCamera("shoulder")');
    await page.waitForTimeout(1800);
    const shoulder = await js<Pt>(page, 'window.__walk.walkerOnScreen()');
    const target = await js<Pt>(page, 'window.__walk.slimeOnScreen(1)');
    await page.screenshot({ path: `${SHOTS}/camera-${name}-shoulder.png` });

    // straight behind: the player is in the middle; over the shoulder: clearly left of it, but
    // never pushed against the edge of the screen
    expect(Math.abs(back![0] - w / 2)).toBeLessThan(w * 0.06);
    expect(shoulder![0]).toBeLessThan(w * 0.42);
    expect(shoulder![0]).toBeGreaterThan(w * 0.18);
    // and the chosen slime is on screen
    expect(target).not.toBeNull();
    expect(target![0]).toBeGreaterThan(0);
    expect(target![0]).toBeLessThan(w);
  });

test('the camera chip switches views, and standing still the camera swings round to the target', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const chip = page.locator('[data-chip="camera"]');
  await expect(chip).toContainText('ไหล่'); // shoulder is the default view
  await chip.click();
  await expect(chip).toContainText('หลัง');
  expect((await js<{ camera: string }>(page, 'window.__walk.state()')).camera).toBe('back');
  await chip.click();
  await expect(chip).toContainText('ไหล่');

  // choose a slime well off to the side, then stand still: the camera turns towards it by itself
  await js(
    page,
    `(() => {
    const w = window.__walk;
    const s = w.slimes()[0], me = w.state();
    w.setTarget(0);
    // look about 80 degrees away from it
    w.setYaw(Math.atan2(-(s.x - me.x), -(s.z - me.z)) + 1.4);
  })()`,
  );
  const before = await js<number>(page, 'window.__walk.state().yaw');
  await page.waitForTimeout(2600);
  const after = await js<number>(
    page,
    `(() => {
    const w = window.__walk;
    const s = w.slimes()[0], me = w.state();
    const want = Math.atan2(-(s.x - me.x), -(s.z - me.z));
    const d = Math.atan2(Math.sin(me.yaw - want), Math.cos(me.yaw - want));
    return Math.abs(d);
  })()`,
  );
  const beforeOff = 1.4;
  expect(after).toBeLessThan(beforeOff * 0.5);
  expect(before).not.toBeNull();

  // while walking the camera is left alone, even with a target chosen
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(150);
  await js(page, 'window.__walk.setYaw(window.__walk.state().yaw + 1.4)');
  const yaw0 = await js<number>(page, 'window.__walk.state().yaw');
  await page.waitForTimeout(700);
  const yaw1 = await js<number>(page, 'window.__walk.state().yaw');
  await page.keyboard.up('KeyW');
  expect(Math.abs(yaw1 - yaw0)).toBeLessThan(0.05);
});
