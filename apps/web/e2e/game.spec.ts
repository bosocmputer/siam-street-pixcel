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

/** Close the "auto loot" sheet, and the level-up card that follows it when the slime grew. */
async function collect(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'เก็บเข้ากระเป๋า' }).click();
  const later = page.getByRole('button', { name: 'ไว้ก่อน' });
  if (await later.isVisible().catch(() => false)) await later.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await expect(page.getByRole('dialog')).toHaveCount(0);
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
  // the farm page offers it quietly; nothing asks for it in the first minute
  await page.getByRole('button', { name: /เลือกย่านเรา/ }).click();
  await expect(page.getByText('ย่านที่คุณจะเชียร์')).toBeVisible();
  await page.getByRole('button', { name: 'ตั้งเป็นย่านเรา' }).first().click();
  await expect(page.getByText('ย่านเราคือ')).toBeVisible();
  const s = await page.evaluate(() => window.__slime.state);
  expect(s.homeDistrictId).not.toBeNull();
  await page
    .getByRole('button', { name: /ริมปิง/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: /เปลี่ยนย่านเราได้อีกใน/ })).toBeDisabled();
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
  await expect(dialog).toContainText('หายไป');
  await expect(dialog).toContainText('ฆ่ามอน');
  await expect(dialog).toContainText('เหรียญ');
  await collect(page);
  await expect(page.getByRole('button', { name: /รอสักครู่/ })).toBeVisible();
  expect((await page.evaluate(() => window.__slime.state)).level).toBeGreaterThan(5);
});

test('putting on a hat changes how the slime looks', async ({ page }) => {
  await startGame(page);
  await tab(page, 'สไลม์');
  const slime = page.locator('.hero-slime img');
  const before = await slime.getAttribute('src');
  await page.evaluate(() => window.__slime.grant('ngob'));
  await tab(page, 'กระเป๋า');
  await page.getByRole('button', { name: 'งอบ', exact: true }).click();
  await page.getByRole('button', { name: 'ใส่', exact: true }).click();
  await tab(page, 'สไลม์');
  await expect(slime).not.toHaveAttribute('src', before!);
  await tab(page, 'กระเป๋า');
  await page.getByRole('button', { name: 'งอบ', exact: true }).click();
  await page.getByRole('button', { name: 'ถอด', exact: true }).click();
  await tab(page, 'สไลม์');
  await expect(slime).toHaveAttribute('src', before!);
});

test('the save survives a reload', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__slime.advance(8 * 3600));
  await page.getByRole('button', { name: 'รับของออโต้' }).click();
  await collect(page);
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
  await collect(page);
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
  await collect(page);
  await tab(page, 'สไลม์');
  await expect(page.getByText('อัปร่างได้แล้ว')).toBeVisible();
  await page.getByRole('button', { name: /อัปร่างได้แล้ว/ }).click();
  await page.getByRole('button', { name: 'เลือกร่างนี้' }).click();
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
  await collect(page);
  for (const name of ['ฟาร์ม', 'สไลม์', 'สกิล', 'กระเป๋า', 'แผนที่']) {
    await tab(page, name);
    await page.waitForTimeout(150);
    expect(await wide(), `page ${name}`).toBeLessThanOrEqual(0);
    // nothing inside the scroll area is wider than the screen either
    const overflowing = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('.content *')).filter(
          // art inside a clipped frame (the map, the stage) may extend past it on purpose
          (el) =>
            !el.closest('.mapwrap, .stage, .hero-stage') &&
            el.getBoundingClientRect().right > window.innerWidth + 1,
        ).length,
    );
    expect(overflowing, `page ${name}`).toBe(0);
  }
});

test('the map lets you change where the slime farms', async ({ page }) => {
  await startGame(page);
  await tab(page, 'แผนที่');
  await page
    .getByRole('button', { name: /ริมปิง/ })
    .first()
    .click();
  await expect(page.getByText('ยังหนักเกินไป').first()).toBeVisible(); // later districts are far too hard at level 1
  await page.getByRole('button', { name: /ไปฟาร์มที่นี่/ }).click();
  await expect(page.locator('.zone.chip')).toContainText('ริมปิง');
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

test('the share card is drawn on the device and can be previewed', async ({ page }) => {
  await startGame(page, { name: 'โมจิ' });
  await tab(page, 'สไลม์');
  await page.getByRole('button', { name: 'การ์ด' }).click();
  const img = page.locator('.scard-img');
  await expect(img).toBeVisible();
  expect(await img.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
  await expect(page.getByRole('button', { name: 'แชร์การ์ด' })).toBeEnabled();
  await page.getByRole('button', { name: 'ปิด' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

// The design checklist from docs/ui_design.md that a machine can check (looks are judged by eye, see docs/ui/review.md)
for (const [w, h] of [
  [360, 740],
  [390, 844],
  [412, 915],
] as const) {
  test(`every page keeps to the design rules on a ${w}px phone`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await startGame(page);
    await page.evaluate(() => window.__slime.advance(8 * 3600));
    await page.getByRole('button', { name: 'รับของออโต้' }).click();
    await collect(page);
    for (const name of ['ฟาร์ม', 'สไลม์', 'สกิล', 'กระเป๋า', 'แผนที่']) {
      await tab(page, name);
      await page.waitForTimeout(150);
      const r = await page.evaluate(() => {
        const visible = (el: Element) => {
          const b = el.getBoundingClientRect();
          return b.width > 0 && b.height > 0;
        };
        const primaries = Array.from(document.querySelectorAll('.content .btn.primary')).filter(
          visible,
        ).length;
        const smallTargets = Array.from(
          document.querySelectorAll(
            '.content button, .content select, .content input, .tabbar button',
          ),
        )
          .filter(visible)
          .filter((el) => el.getBoundingClientRect().height < 43.5)
          .map((el) => `${el.className}:${Math.round(el.getBoundingClientRect().height)}`);
        const tinyText = Array.from(document.querySelectorAll('.content *, .tabbar *'))
          .filter(
            (el) =>
              visible(el) &&
              Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim()) &&
              parseFloat(getComputedStyle(el).fontSize) < 12,
          )
          .map((el) => `${el.className}:${getComputedStyle(el).fontSize}`);
        return { primaries, smallTargets, tinyText };
      });
      expect(r.primaries, `${name}: at most one amber button`).toBeLessThanOrEqual(1);
      expect(r.smallTargets, `${name}: touch targets under 44px`).toEqual([]);
      expect(r.tinyText, `${name}: text under 12px`).toEqual([]);
    }
  });
}
