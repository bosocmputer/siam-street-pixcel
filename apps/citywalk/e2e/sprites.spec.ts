import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { newGame, skipOpening } from './start';

// How people and monsters are drawn: pixel 3D by default (the whole scene in big pixels); with
// ?art=pixel as sprites, drawn from their models while loading or read from packed sheet files
// (tools/sprites/pack.py); with ?art=3d as plain 3D models.

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
type Art = {
  mode: string;
  scenePixel: number;
  view: [number, number];
  heroSprite: boolean;
  anim: string | null;
  sheets: string[];
  cached: string[];
};
const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const art = (page: Page) => js<Art>(page, 'window.__walk.art()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
// drawing every sheet in software WebGL takes a while
test.describe.configure({ timeout: 240_000 });

async function open(page: Page, query = '', shot = '') {
  await page.goto(`./?debug=1&seed=7&art=pixel${query}`);
  await page.getByRole('button', { name: 'เริ่มเดิน' }).waitFor({ timeout: 200_000 });
  if (shot) {
    // the character screen shows the character as its sprite
    await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
    await skipOpening(page);
    await expect(page.locator('.cr-thumb.wait')).toHaveCount(0, { timeout: 120_000 });
    await page.screenshot({ path: `${SHOTS}/${shot}.png` });
    await page.getByRole('button', { name: 'ถัดไป' }).click();
    await page.getByLabel('ตั้งชื่อ').fill('ทดสอบ');
    await page.getByRole('button', { name: 'ตื่นขึ้น' }).click();
    await page.getByRole('button', { name: 'รับทราบ' }).click();
  } else await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
}

test('the player and every monster are pixel sprites that move, fight and face the camera', async ({
  page,
}) => {
  await open(page, '', 'pixel-creator');
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
  await expect.poll(async () => (await art(page)).anim, { timeout: 15_000 }).toBe('walk');
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
  // (software drawing is slow: the next frame may take a moment to show it)
  await expect.poll(async () => (await art(page)).anim, { timeout: 15_000 }).toBe('cast');
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/pixel-cast.png` });
  await page.evaluate(`(() => {
    const w = window.__walk;
    for (let n = 0; n < 150 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30);
  })()`);
  expect((await js<{ hp: number }[]>(page, 'window.__walk.slimes()'))[2]!.hp).toBeLessThan(hp);

  // monsters talk: a hit slime may say something, a beaten one always does, in a bubble
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setStats({ level: 10 });
    for (let n = 0; n < 8 && w.slimes()[2].alive; n++) {
      w.setStats({ hp: 200, energy: 200 });
      w.cast('waterball');
      for (let k = 0; k < 90 && w.combat().inFlight > 0; k++) w.simulateFight(1 / 30);
      w.simulateFight(0.4);
    }
  })()`);
  const said = await js<{ i: number; kind: string; text: string }[]>(page, 'window.__walk.said()');
  expect(said.some((l) => l.i === 2 && l.kind === 'defeated')).toBe(true);
  await expect(page.locator('.say').first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pixel-chatter.png` });

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
  await expect.poll(async () => (await art(page)).anim, { timeout: 15_000 }).toBe('walk');
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

test.describe('a new player', () => {
  // nothing remembered: the game's own default
  test.use({ storageState: { cookies: [], origins: [] } });
  test('sees pixel 3D: the whole scene in big pixels, 3D bodies, no sprites drawn', async ({
    page,
  }) => {
    await page.goto('./?debug=1');
    await newGame(page);
    await page.waitForFunction(() => '__walk' in window);
    const a = await art(page);
    expect(a.mode).toBe('pixel3d');
    expect(a.heroSprite).toBe(false);
    expect(a.sheets).toEqual([]);
    // one scene pixel for every `scenePixel` screen pixels, shown with hard edges
    expect(a.scenePixel).toBe(2);
    const size = await page.evaluate(() => [innerWidth, innerHeight]);
    expect(Math.abs(a.view[0] - size[0]! / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(a.view[1] - size[1]! / 2)).toBeLessThanOrEqual(1);
    await expect(page.locator('#view')).toHaveCSS('image-rendering', 'pixelated');
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/pixel3d-start.png` });
  });
});

test('sprites drawn once are kept, so the next start does not draw them again', async ({
  page,
}) => {
  await open(page);
  // nothing came from the cache on the first start, except the player's own sheet: it was drawn
  // while loading for the starting look, and the walk with that same look found it kept
  expect((await art(page)).cached.filter((s) => s !== 'hero')).toEqual([]);
  // the pictures are kept in the background after drawing
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((ok) => {
              const req = indexedDB.open('citywalk-sprites');
              req.onsuccess = () => {
                const all = req.result.transaction('sheets').objectStore('sheets').getAllKeys();
                all.onsuccess = () => ok(all.result.length);
              };
            }),
        ),
      { timeout: 30_000 },
    )
    // the player, five kinds of monster and Pa Saeng
    .toBe(7);
  await page.reload();
  await page.getByRole('button', { name: 'เดินต่อจากเดิม' }).click({ timeout: 120_000 });
  await page.waitForFunction(() => '__walk' in window);
  // Pa Saeng is drawn a moment after the walk starts; she comes from the store too
  await expect
    .poll(async () => (await art(page)).cached.sort(), { timeout: 30_000 })
    .toEqual(
      [
        'boss_tide_regent',
        'hero',
        'npc_pa_saeng',
        'slime_fire',
        'slime_giant',
        'slime_mini',
        'slime_water',
      ].sort(),
    );
  expect((await art(page)).heroSprite).toBe(true);
});
