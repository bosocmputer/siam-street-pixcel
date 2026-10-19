import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Start a new game the way a player does: the start button, the character screen (keeping the
 * starting look), a name, and the system's announcement.
 */
export async function newGame(page: Page, o: { tap?: boolean; name?: string } = {}): Promise<void> {
  const press = (l: Locator) => (o.tap ? l.tap() : l.click());
  await press(page.getByRole('button', { name: 'เริ่มเดิน' }));
  await press(page.getByRole('button', { name: 'ข้าม ›' }));
  await press(page.getByRole('button', { name: 'ถัดไป' }));
  await page.getByLabel('ตั้งชื่อ').fill(o.name ?? 'ทดสอบ');
  // a tap on a slow software-drawn page is now and then lost; tap again until the system speaks
  const ok = page.getByRole('button', { name: 'รับทราบ' });
  await expect(async () => {
    if (!(await ok.isVisible())) await press(page.getByRole('button', { name: 'ตื่นขึ้น' }));
    await expect(ok).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await press(ok);
}

/** Press a settings chip: the gear opens the chips first if they are closed. */
export async function chip(page: Page, id: string): Promise<Locator> {
  const c = page.locator(`[data-chip="${id}"]`);
  if (!(await c.isVisible())) await page.getByRole('button', { name: 'ตั้งค่า' }).click();
  return c;
}

/** A new game opens with three pictures; skip them to reach the character screen. */
export async function skipOpening(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'ข้าม ›' }).click();
}
