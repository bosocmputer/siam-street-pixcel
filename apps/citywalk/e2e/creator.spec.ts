import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
type Look = {
  body: string;
  hair: string;
  hairColor: string;
  face: string;
  eye: string;
  name: string;
};

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 150_000 });

test('a new game makes the character: body, hair, colours, name, then the system speaks', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.waitForFunction(() => '__walk' in window);
  expect(await js(page, 'window.__walk.screen()')).toBe('create');
  // pictures of each hair shape, drawn on the character
  await expect(page.locator('.cr-thumb')).toHaveCount(6);
  await expect(page.locator('.cr-thumb.wait')).toHaveCount(0, { timeout: 60_000 });
  await page.screenshot({ path: `${SHOTS}/creator-hair.png` });

  await page.getByRole('button', { name: 'หญิง' }).click();
  await page.getByRole('button', { name: 'หางม้า' }).click();
  await page.getByRole('tab', { name: 'สีผม' }).click();
  await page.getByRole('button', { name: 'บลอนด์' }).click();
  await page.getByRole('tab', { name: 'แบบหน้า' }).click();
  await page.getByRole('button', { name: 'สดใส' }).click();
  await expect(page.locator('.cr-thumb.wait')).toHaveCount(0, { timeout: 60_000 });
  await page.screenshot({ path: `${SHOTS}/creator-face.png` });
  const chosen = await js<Look>(page, 'window.__walk.creatorChoice()');
  expect(chosen).toMatchObject({ body: 'f', hair: 'ponytail', hairColor: 'blond', face: 'bright' });

  // a name with odd characters is refused, then a good one goes through
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByLabel('ตั้งชื่อ').fill('<มิ้นท์>');
  await page.getByRole('button', { name: 'ตื่นขึ้น' }).click();
  await expect(page.locator('.cr-err')).toHaveText('ใช้ได้แค่ไทย อังกฤษ และตัวเลข');
  await page.getByLabel('ตั้งชื่อ').fill('มิ้นท์');
  await page.getByRole('button', { name: 'ตื่นขึ้น' }).click();
  await expect(page.getByText('เชียงใหม่เข้าสู่โหมดประเมิน')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/creator-system.png` });
  await page.getByRole('button', { name: 'รับทราบ' }).click();

  expect(await js(page, 'window.__walk.screen()')).toBe('play');
  expect(await js<Look>(page, 'window.__walk.look()')).toMatchObject({ ...chosen, name: 'มิ้นท์' });
  // the body in the city is the one just made: about 1.7 m tall, standing
  const head = await js<number[]>(page, "window.__walk.heroJoint('Head')");
  expect(head[1]).toBeGreaterThan(1.45);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/creator-in-city.png` });

  // the look is kept: after a reload the game carries on with the same character
  expect(await js(page, 'window.__walk.save()')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'เดินต่อจากเดิม' }).click();
  await page.waitForFunction(() => '__walk' in window);
  expect(await js<Look>(page, 'window.__walk.look()')).toMatchObject({ ...chosen, name: 'มิ้นท์' });
});

test('the status window: points from levels, the job wheel, confirm', async ({ page }) => {
  await page.goto('./?debug=1');
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByLabel('ตั้งชื่อ').fill('ภาม');
  await page.getByRole('button', { name: 'ตื่นขึ้น' }).click();
  await page.getByRole('button', { name: 'รับทราบ' }).click();
  // level 9 with points to spend: the panel shows a badge
  await js(page, 'window.__walk.setStats({ level: 9 })');
  await expect(page.locator('.player[data-points="true"]')).toBeVisible();

  await page.getByRole('button', { name: 'ค่าสถานะ' }).first().click();
  expect(await js(page, 'window.__walk.screen()')).toBe('menu');
  const status = page.getByRole('dialog', { name: 'ค่าสถานะ' });
  await expect(status.locator('.st-name')).toHaveText('ภาม');
  await expect(status.locator('.st-lh b')).toHaveText('24');
  // put the points into INT then VIT: the job shown follows the wheel
  for (let i = 0; i < 8; i++) await status.getByRole('button', { name: '+ปัญญา' }).click();
  for (let i = 0; i < 4; i++) await status.getByRole('button', { name: '+แม่นยำ' }).click();
  await expect(status.locator('.st-job')).toHaveAttribute('data-job', 'elementalist');
  for (let i = 0; i < 6; i++) await status.getByRole('button', { name: '+อึด' }).click();
  await expect(status.locator('.st-job')).toHaveAttribute('data-job', 'cleric');
  await page.screenshot({ path: `${SHOTS}/status-pending.png` });
  // one point back from VIT makes DEX and VIT tie under INT: both sides pulse
  await status.getByRole('button', { name: '−อึด' }).click();
  await status.getByRole('button', { name: '−อึด' }).click();
  await expect(status.locator('.st-tie')).toHaveCount(1);

  await status.getByRole('button', { name: 'ยืนยัน' }).click();
  await page.getByRole('button', { name: 'ยืนยัน' }).last().click();
  const attrs = await js<Record<string, number>>(page, 'window.__walk.stats().attrs');
  expect(attrs).toEqual({ str: 5, agi: 5, dex: 9, int: 13, vit: 9 });
  await page.screenshot({ path: `${SHOTS}/status-saved.png` });
  // VIT adds health
  const stats = await js<{ hp: number }>(page, 'window.__walk.stats()');
  expect(stats.hp).toBeGreaterThan(0);

  await status.getByRole('button', { name: 'ปิด' }).click();
  expect(await js(page, 'window.__walk.screen()')).toBe('play');
});
