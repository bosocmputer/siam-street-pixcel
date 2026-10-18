import { expect, test, type Page } from '@playwright/test';

// Every window must fit the screen or scroll: on a small phone, a phone on its side and a desktop.
// Nothing the player can press may sit off the screen where no scrolling reaches it, and a window
// taller than the screen must move under a finger.

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
const SIZES = [
  { name: 'small', width: 360, height: 640 },
  { name: 'side', width: 844, height: 390 },
  { name: 'desk', width: 1280, height: 720 },
];
test.describe.configure({ timeout: 240_000 });
test.use({ hasTouch: true });

/** Controls and text that are off the screen with no scrolling box to bring them in. */
const cutOff = (page: Page) =>
  page.evaluate(() => {
    const W = innerWidth,
      H = innerHeight;
    const reachable = (e: Element) => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY) && p.scrollHeight > p.clientHeight + 1) return true;
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
      }
      return false;
    };
    const shown = (e: Element) => {
      for (let p: Element | null = e; p; p = p.parentElement)
        if ((p as HTMLElement).hidden || getComputedStyle(p).display === 'none') return false;
      return true;
    };
    const bad: string[] = [];
    for (const e of Array.from(
      document.querySelectorAll('button, input, a, [role=button], h1, h2, h3'),
    )) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || !shown(e)) continue;
      const off = r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1;
      if (off && !reachable(e))
        bad.push((e.textContent || e.getAttribute('aria-label') || e.tagName).trim());
    }
    if (document.documentElement.scrollWidth > W + 1) bad.push('the page is wider than the screen');
    return bad;
  });

/** If the box is taller than it shows, a finger swipe moves it. */
async function swipeScrolls(page: Page, selector: string): Promise<void> {
  const box = page.locator(selector).first();
  const tall = await box.evaluate((e) => e.scrollHeight > e.clientHeight + 4);
  if (!tall) return;
  const r = (await box.boundingBox())!;
  // a finger put down low and dragged up, as separate touch points (the way a phone sends them)
  const cdp = await page.context().newCDPSession(page);
  const x = Math.round(r.x + r.width / 2);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y: Math.round(y) }],
    });
  const from = r.y + r.height * 0.75,
    to = r.y + r.height * 0.3;
  await touch('touchStart', from);
  for (let y = from; y > to; y -= 30) await touch('touchMove', y);
  await touch('touchEnd', to);
  await expect.poll(() => box.evaluate((e) => e.scrollTop)).toBeGreaterThan(10);
}

async function nameAndWake(page: Page) {
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await page.getByLabel('ตั้งชื่อ').fill('ภาม');
  await page.getByRole('button', { name: 'ตื่นขึ้น' }).click();
}

for (const size of SIZES) {
  test(`every window fits or scrolls: ${size.name} ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await page.goto('./?debug=1');
    const start = page.getByRole('button', { name: 'เริ่มเดิน' });
    await expect(start).toBeVisible();
    expect(await cutOff(page)).toEqual([]);
    await swipeScrolls(page, '.intro');

    // the listening room
    await page.getByRole('button', { name: 'ฟังเสียงทั้งหมด' }).click();
    expect(await cutOff(page)).toEqual([]);
    await swipeScrolls(page, '.lab');
    await page.getByRole('button', { name: 'กลับ' }).first().click();

    // the character screen, the name sheet and the system's announcement
    await start.click();
    await expect(page.locator('.cr-thumb')).toHaveCount(6);
    expect(await cutOff(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/screens-${size.name}-creator.png` });
    await page.getByRole('button', { name: 'ถัดไป' }).click();
    expect(await cutOff(page)).toEqual([]);
    await page.getByRole('button', { name: 'ตื่นขึ้น' }).click(); // empty name: refused
    await page.locator('.creator .cr-sheet-bg').click({ position: { x: 5, y: 5 } }); // tap outside closes
    await nameAndWake(page);
    await expect(page.getByRole('button', { name: 'รับทราบ' })).toBeVisible();
    expect(await cutOff(page)).toEqual([]);
    await page.getByRole('button', { name: 'รับทราบ' }).click();

    // the status window
    await page.evaluate('window.__walk.setStats({ level: 9 })');
    await page.getByRole('button', { name: 'ค่าสถานะ' }).first().click();
    const status = page.getByRole('dialog', { name: 'ค่าสถานะ' });
    await expect(status).toBeVisible();
    expect(await cutOff(page)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/screens-${size.name}-status.png` });
    await swipeScrolls(page, '.status');
    // the bottom buttons are reachable
    await status.getByRole('button', { name: '+ปัญญา' }).click();
    await status.getByRole('button', { name: 'ยืนยัน' }).click();
    await expect(page.getByRole('button', { name: 'กลับ' })).toBeVisible();
    expect(await cutOff(page)).toEqual([]);
  });
}
