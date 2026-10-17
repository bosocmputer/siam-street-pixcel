import { expect, test, type Page } from '@playwright/test';

interface Walk {
  state: () => { x: number; z: number; scale: number; mode: string; labels: boolean };
  teleport: (x: number, z: number) => void;
  setYaw: (y: number) => void;
  simulate: (forward: number, right: number, seconds: number) => void;
  landmarks: { name: string; x: number; z: number }[];
}
const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

async function open(page: Page) {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
}

// runs fn inside the page with the debug hooks; fn must not use variables from this file
const walk = <T>(page: Page, fn: (w: Walk) => T) =>
  page.evaluate(`(${fn.toString()})(window.__walk)`) as Promise<T>;

for (const [name, size] of [
  ['phone', { width: 390, height: 844 }],
  ['desktop', { width: 1280, height: 800 }],
] as const) {
  test(`renders the city on ${name}`, async ({ page }) => {
    // software WebGL in CI is slow, and this test walks around and takes several screenshots
    test.setTimeout(90_000);
    await page.setViewportSize(size);
    await page.goto('./?debug=1');
    await expect(page.getByRole('button', { name: 'เริ่มเดิน' })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/${name}-intro.png` });
    await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('.tag', { hasText: 'ประตูท่าแพ' })).toBeVisible();
    await expect(page.locator('.near')).toContainText('ประตูท่าแพ');
    await page.screenshot({ path: `${SHOTS}/${name}-start.png` });
    await walk(page, (w) => w.simulate(1, 0, 6));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${name}-gate-close.png` });
    await walk(page, (w) => {
      const g = w.landmarks.find((m) => m.name === 'ประตูท่าแพ')!;
      w.teleport(g.x + 45, g.z);
    });

    // look from inside the old city and from high above
    await walk(page, (w) => {
      w.setYaw(Math.PI / 2);
      w.simulate(1, 0, 14);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${name}-inside.png` });

    await page.locator('[data-chip="scale"]').click();
    await page.locator('[data-chip="scale"]').click();
    await page.getByRole('button', { name: 'มอไซค์' }).click();
    await walk(page, (w) => w.simulate(1, 0, 3));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/${name}-scale3-bike.png` });
  });
}

test('walks through Tha Phae Gate into the old city', async ({ page }) => {
  await open(page);
  // the creator's gate model is in place, scaled to fit the gap in the wall
  const model = await walk(
    page,
    (w) => (w as unknown as { gateModel: { scale: number; solids: number } | null }).gateModel,
  );
  expect(model).not.toBeNull();
  expect(model!.scale).toBeGreaterThanOrEqual(0.9);
  expect(model!.solids).toBeGreaterThanOrEqual(4);
  const gate = await walk(page, (w) => w.landmarks.find((m) => m.name === 'ประตูท่าแพ')!);
  const before = await walk(page, (w) => w.state());
  expect(before.x).toBeGreaterThan(gate.x);
  await walk(page, (w) => {
    w.setYaw(Math.PI / 2);
    w.simulate(1, 0, 25);
  });
  const after = await walk(page, (w) => w.state());
  expect(after.x).toBeLessThan(gate.x - 30);
});

test('the moat stops you away from the bridges', async ({ page }) => {
  await open(page);
  const gate = await walk(page, (w) => w.landmarks.find((m) => m.name === 'ประตูท่าแพ')!);
  // 150 m south of the gate, on the outer bank, walking west into the moat
  const result = await walk(page, (w) => {
    const g = w.landmarks.find((m) => m.name === 'ประตูท่าแพ')!;
    w.teleport(g.x + 45, g.z + 150);
    w.setYaw(Math.PI / 2);
    w.simulate(1, 0, 20);
    return w.state();
  });
  expect(result.x).toBeGreaterThan(gate.x);
});

test('the chips change scale, labels and haze', async ({ page }) => {
  await open(page);
  const scale = page.locator('[data-chip="scale"]');
  await expect(scale).toContainText('1:1');
  await scale.click();
  await expect(scale).toContainText('1:2');
  await expect(page.locator('.toast')).toContainText('นาที');

  await page.locator('[data-chip="labels"]').click();
  await expect(page.locator('.near')).toBeHidden();
  await expect(page.locator('.tag', { hasText: 'ประตูท่าแพ' })).toBeHidden();

  await page.locator('[data-chip="haze"]').click();
  await expect(page.locator('[data-chip="haze"]')).toContainText('เปิด');
  await page.getByRole('button', { name: 'มอไซค์' }).click();
  await expect(page.getByRole('button', { name: 'มอไซค์' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
