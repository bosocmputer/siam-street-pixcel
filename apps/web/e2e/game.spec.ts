import { expect, test, type Page } from '@playwright/test';

declare global {
  interface Window {
    __slime: {
      state: {
        level: number;
        statPoints: number;
        formId: string;
        items: { uid: string; defId: string }[];
        skills: Record<string, { level: number }>;
        name: string;
        look: { color: string; eyes: number };
        homeDistrictId: string | null;
      };
      advance(seconds: number): void;
      grant(defId: string, rarity?: string): void;
      store: {
        getState(): { player: object; setPage(p: string): void };
        setState(s: object): void;
      };
    };
  }
}

const problems: string[] = [];

test.beforeEach(({ page }) => {
  problems.length = 0;
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console: ${m.text()}`);
  });
});

test.afterEach(() => {
  // blocked Google Fonts in a sandbox are not our bug
  const real = problems.filter(
    (p) => !/fonts\.(googleapis|gstatic)|ERR_|Failed to load resource/i.test(p),
  );
  expect(real).toEqual([]);
});

/** Egg -> slime creator -> first monster -> farm. `name` is typed in; colour/eyes are picked by index. */
async function createSlime(
  page: Page,
  opts: { name?: string; color?: number; eyes?: number } = {},
) {
  await page.goto('/?debug=1');
  await page.click('.egg');
  if (opts.name !== undefined) await page.getByRole('textbox').fill(opts.name);
  await page
    .locator('.swatch')
    .nth(opts.color ?? 0)
    .click();
  await page
    .locator('.eye-card')
    .nth(opts.eyes ?? 0)
    .click();
}

async function startGame(page: Page, opts: { name?: string; color?: number; eyes?: number } = {}) {
  await createSlime(page, opts);
  await page.getByRole('button', { name: 'ตัวนี้แหละ!' }).click();
  await page.getByRole('button', { name: 'กลืนเลย!' }).click();
  await page.getByRole('button', { name: 'ไปฟาร์มกัน' }).click();
  await expect(page.locator('.farm-canvas canvas')).toBeVisible();
}

const tab = (page: Page, name: string) =>
  page.locator('.tabbar').getByRole('button', { name }).click();

test('the first minute: hatch, design the slime, absorb, farm, with no sign-up', async ({
  page,
}) => {
  const t0 = Date.now();
  await startGame(page, { name: 'โมจิ', color: 3, eyes: 2 });
  const elapsed = Date.now() - t0;
  expect(elapsed).toBeLessThan(60_000);
  await expect(page.locator('input')).toHaveCount(0);
  const s = await page.evaluate(() => window.__slime.state);
  expect(s.level).toBe(1);
  expect(Object.keys(s.skills).length).toBe(1); // the first absorbed skill
  expect(s.name).toBe('โมจิ');
  expect(s.look).toEqual({ color: 'rose', eyes: 2 });
  expect(s.homeDistrictId).toBeNull(); // no district question in the first minute
  await expect(page.getByText('เลือกย่านเรา')).toHaveCount(0);
});

test('the creator shows the slime as you change it, and can suggest a name', async ({ page }) => {
  await createSlime(page);
  const preview = page.locator('.creator-preview img');
  const first = await preview.getAttribute('src');
  await page.locator('.swatch').nth(4).click();
  const recoloured = await preview.getAttribute('src');
  expect(recoloured).not.toBe(first);
  await page.locator('.eye-card').nth(3).click();
  expect(await preview.getAttribute('src')).not.toBe(recoloured);
  await page.getByRole('textbox').fill('');
  await page.getByRole('button', { name: 'สุ่มชื่อ' }).click();
  expect((await page.getByRole('textbox').inputValue()).length).toBeGreaterThan(0);
  await page.getByRole('textbox').fill('A'.repeat(40));
  expect((await page.getByRole('textbox').inputValue()).length).toBeLessThanOrEqual(12);
});

test('the home district is chosen later on the map, free the first time', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__slime.store.setState({ page: 'map' }));
  await expect(page.getByText('ยังไม่มีย่านเรา')).toHaveCount(0); // tip only shows from level 3
  await page.evaluate(() => {
    const st = window.__slime.store.getState();
    window.__slime.store.setState({ player: { ...st.player, level: 3 } });
    window.__slime.store.getState().setPage('farm');
  });
  await page.getByRole('button', { name: 'ยังไม่มีย่านเรา ไปเลือกที่แผนที่' }).click();
  await expect(page.getByText('ย่านที่คุณจะเชียร์')).toBeVisible();
  await page.getByRole('button', { name: 'ตั้งเป็นย่านเรา' }).nth(2).click();
  await expect(page.getByText('ย่านเราคือ')).toBeVisible();
  const s = await page.evaluate(() => window.__slime.state);
  expect(s.homeDistrictId).not.toBeNull();
  await expect(page.getByRole('button', { name: /เปลี่ยนย่านเราได้อีกใน/ }).first()).toBeDisabled();
});

test('the first absorb makes a growth part appear on the slime straight away', async ({ page }) => {
  await createSlime(page);
  await page.getByRole('button', { name: 'ตัวนี้แหละ!' }).click();
  const before = await page.locator('.duel img[alt="สไลม์"]').getAttribute('src');
  await page.getByRole('button', { name: 'กลืนเลย!' }).click();
  await expect(page.getByText('งอกแล้ว!')).toBeVisible();
  const after = await page.locator('.duel img[alt="สไลม์"]').getAttribute('src');
  expect(after).not.toBe(before);
});

test('claiming after hours away shows what the slime earned, and then the button cools down', async ({
  page,
}) => {
  await startGame(page);
  await expect(page.getByRole('button', { name: /รอสักครู่/ })).toBeDisabled();
  await page.evaluate(() => window.__slime.advance(6 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('ระหว่างหายไป');
  await expect(dialog).toContainText('ฆ่ามอน');
  await expect(dialog).toContainText('เอ็กซ์พี');
  await dialog.getByRole('button', { name: 'โอเค' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /รอสักครู่/ })).toBeVisible();
  expect((await page.evaluate(() => window.__slime.state)).level).toBeGreaterThan(5);
});

test('putting on a hat changes how the slime looks', async ({ page }) => {
  await startGame(page);
  await tab(page, 'สไลม์');
  const slime = page.locator('.hero img[alt="สไลม์"]');
  const before = await slime.getAttribute('src');
  await page.evaluate(() => window.__slime.grant('ngob'));
  await tab(page, 'กระเป๋า');
  const card = page.locator('.item-card', { hasText: 'งอบ' });
  await card.getByRole('button', { name: 'ใส่', exact: true }).click();
  await tab(page, 'สไลม์');
  await expect(slime).not.toHaveAttribute('src', before!);
  await tab(page, 'กระเป๋า');
  await page.locator('.item-card', { hasText: 'งอบ' }).getByRole('button', { name: 'ถอด' }).click();
  await tab(page, 'สไลม์');
  await expect(slime).toHaveAttribute('src', before!);
});

test('the save survives a reload', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__slime.advance(8 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'โอเค' }).click();
  const before = await page.evaluate(() => window.__slime.state);
  await page.reload();
  await expect(page.locator('.tabbar')).toBeVisible();
  const after = await page.evaluate(() => window.__slime.state);
  expect(after.level).toBe(before.level);
  expect(after.items.length).toBe(before.items.length);
});

test('stat points can be spent and refunded for free', async ({ page }) => {
  await startGame(page);
  await tab(page, 'สไลม์');
  const points = async () => (await page.evaluate(() => window.__slime.state)).statPoints;
  const start = await points();
  expect(start).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'พลัง +1' }).click();
  expect(await points()).toBe(start - 1);
  await page.getByRole('button', { name: 'รีเซ็ตแต้ม (ฟรี)' }).click();
  expect(await points()).toBe(start);
});

test('absorbing cores on the skills page unlocks more skills and equipping one works', async ({
  page,
}) => {
  await startGame(page);
  await page.evaluate(() => window.__slime.advance(8 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'โอเค' }).click();
  await tab(page, 'สกิล');
  const owned = async () =>
    Object.keys((await page.evaluate(() => window.__slime.state)).skills).length;
  const before = await owned();
  // the last row is a monster whose skill we do not own yet (the first skill came from the tutorial)
  await page.getByRole('button', { name: 'กลืนเลย!' }).last().click();
  await expect.poll(owned).toBeGreaterThan(before);
  await page.getByRole('button', { name: /สกิลใช้งาน.*ช่อง 1/ }).click();
  await page.getByRole('dialog').getByRole('button').first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('at level 10 the slime can evolve and its form changes', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__slime.advance(8 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'โอเค' }).click();
  await tab(page, 'สไลม์');
  await expect(page.getByText('อัปร่างได้แล้ว!')).toBeVisible();
  await page.getByRole('button', { name: 'ไปร่างนี้' }).first().click();
  const s = await page.evaluate(() => window.__slime.state);
  expect(s.formId).not.toBe('slime_clear');
});

test('every page fits a 360px phone with no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await startGame(page);
  await page.evaluate(() => window.__slime.advance(8 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const wide = () =>
    page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
  expect(await wide()).toBeLessThanOrEqual(0);
  await page.getByRole('dialog').getByRole('button', { name: 'โอเค' }).click();
  for (const name of ['ฟาร์ม', 'สไลม์', 'สกิล', 'กระเป๋า', 'แผนที่']) {
    await tab(page, name);
    await page.waitForTimeout(150);
    expect(await wide(), `page ${name}`).toBeLessThanOrEqual(0);
    // nothing inside the scroll area is wider than the screen either
    const overflowing = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('.content *')).filter(
          (el) => el.getBoundingClientRect().right > window.innerWidth + 1,
        ).length,
    );
    expect(overflowing, `page ${name}`).toBe(0);
  }
});

test('the map lets you change where the slime farms', async ({ page }) => {
  await startGame(page);
  await tab(page, 'แผนที่');
  await expect(page.getByText('ยังหนักเกินไป').first()).toBeVisible(); // the later districts are far too hard at level 1
  await page.getByRole('button', { name: 'กำลังฟาร์มอยู่' }).first().click();
  await expect(page.getByText('ฟาร์มที่ด่าน 1')).toBeVisible();
});

test('starting over asks first and then returns to the egg', async ({ page }) => {
  await startGame(page);
  await tab(page, 'แผนที่');
  await page.getByRole('button', { name: 'เริ่มใหม่' }).click();
  await expect(page.getByRole('dialog')).toContainText('เซฟทั้งหมดจะหาย');
  await page.getByRole('button', { name: 'ยกเลิก' }).click();
  await page.getByRole('button', { name: 'เริ่มใหม่' }).click();
  await page.getByRole('button', { name: 'เริ่มใหม่เลย' }).click();
  await expect(page.locator('.egg')).toBeVisible();
});
