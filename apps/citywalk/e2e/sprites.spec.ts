import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { newGame } from './start';

// Pixel art: the player and the monsters as sprites, drawn from their models while loading or
// read from packed sheet files (tools/sprites/pack.py).

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
type Art = { mode: string; heroSprite: boolean; anim: string | null; sheets: string[] };
const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const art = (page: Page) => js<Art>(page, 'window.__walk.art()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
// drawing every sheet in software WebGL takes a while
test.describe.configure({ timeout: 240_000 });

async function open(page: Page, query = '') {
  await page.goto(`./?debug=1&seed=7&art=pixel${query}`);
  await page.getByRole('button', { name: 'เริ่มเดิน' }).waitFor({ timeout: 200_000 });
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
}

test('the player and every monster are pixel sprites that move, fight and face the camera', async ({
  page,
}) => {
  await open(page);
  const a = await art(page);
  expect(a.mode).toBe('pixel');
  expect(a.heroSprite).toBe(true);
  expect(a.sheets.sort()).toEqual(
    ['boss_tide_regent', 'slime_fire', 'slime_giant', 'slime_mini', 'slime_water'].sort(),
  );
  expect(a.anim).toBe('idle');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/pixel-start.png` });

  // walking shows the walk
  await js(page, 'window.__walk.pause(true)');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  expect((await art(page)).anim).toBe('walk');
  await page.screenshot({ path: `${SHOTS}/pixel-walk.png` });
  await page.keyboard.up('KeyW');

  // a shot at a sprite slime lands and hurts it
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[2];
    w.teleport(s.x, s.z + 7);
    w.setYaw(0);
  })()`);
  await js(page, 'window.__walk.simulateFight(0.5)');
  const hp = (await js<{ hp: number }[]>(page, 'window.__walk.slimes()'))[2]!.hp;
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setTarget(2);
    w.cast('waterball');
  })()`);
  await page.waitForTimeout(60);
  await js(page, 'window.__walk.simulateFight(0.05)');
  expect((await art(page)).anim).toBe('cast');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/pixel-cast.png` });
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 150 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30);
  })()`);
  expect((await js<{ hp: number }[]>(page, 'window.__walk.slimes()'))[2]!.hp).toBeLessThan(hp);

  // the boss, big and close
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[6];
    w.teleport(s.x + 4, s.z + 12);
    w.setYaw(Math.atan2(4, 12));
    w.setTarget(6);
  })()`);
  await js(page, 'window.__walk.simulateFight(0.3)');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/pixel-boss.png` });
});

test('a sheet packed from files (such as a PixelLab export) takes the place of the drawn one', async ({
  page,
}) => {
  // the asset list as served, plus the packed test sheet for the player
  await page.route('**/assets.json', async (route) => {
    const res = await route.fetch();
    const list = (await res.json()) as Record<string, unknown>;
    await route.fulfill({
      response: res,
      json: { ...list, sprites: { hero: 'test-sheet/sheet.json' } },
    });
  });
  await page.route('**/test-sheet/*', (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    route.fulfill({ body: readFileSync(`e2e/fixtures/hero_sheet/${name}`) });
  });
  await open(page);
  const a = await art(page);
  expect(a.sheets).toContain('hero');
  expect(a.heroSprite).toBe(true);
  await js(page, 'window.__walk.pause(true)');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  expect((await art(page)).anim).toBe('walk');
  await page.screenshot({ path: `${SHOTS}/pixel-file-hero.png` });
  await page.keyboard.up('KeyW');
});

test('?art=3d brings back the 3D bodies and is remembered', async ({ page }) => {
  await page.goto('./?debug=1&art=3d');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  expect((await art(page)).mode).toBe('3d');
  expect((await art(page)).heroSprite).toBe(false);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/3d-start.png` });
  expect(await page.evaluate(() => localStorage.getItem('citywalk.art'))).toBe('3d');
});
