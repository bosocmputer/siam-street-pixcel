import type { Locator, Page } from '@playwright/test';

/**
 * Start a new game the way a player does: the start button, the character screen (keeping the
 * starting look), a name, and the system's announcement.
 */
export async function newGame(page: Page, o: { tap?: boolean; name?: string } = {}): Promise<void> {
  const press = (l: Locator) => (o.tap ? l.tap() : l.click());
  await press(page.getByRole('button', { name: 'เริ่มเดิน' }));
  await press(page.getByRole('button', { name: 'ถัดไป' }));
  await page.getByLabel('ตั้งชื่อ').fill(o.name ?? 'ทดสอบ');
  await press(page.getByRole('button', { name: 'ตื่นขึ้น' }));
  await press(page.getByRole('button', { name: 'รับทราบ' }));
}
