import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { newGame } from './start';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';
type V = [number, number, number];
const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const joint = (page: Page, name: string) =>
  js<V | null>(page, `window.__walk.heroJoint('${name}')`);

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 120_000 });

async function open(page: Page) {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await page.waitForTimeout(300);
}

/** Stand, gather a ball in the free left hand, ride: the body follows each one. */
async function checkPoses(page: Page, shot: string) {
  const head = (await joint(page, 'Head'))!;
  expect(head).not.toBeNull();
  // standing 1.7 m tall on the square, the free arm hanging down, the pipe held low at the hip
  expect(head[1]).toBeGreaterThan(1.45);
  expect(head[1]).toBeLessThan(1.65);
  expect((await joint(page, 'Hand_L'))![1]).toBeLessThan(1.05);
  expect((await joint(page, 'Hand_R'))![1]).toBeLessThan(1.15);
  await page.screenshot({ path: `${SHOTS}/${shot}-stand.png` });

  // gathering a ball raises the left hand; the right keeps the pipe low
  await js(page, 'window.__walk.pause(true)');
  await js(page, "window.__walk.setTarget(0); window.__walk.cast('fireball')");
  await js(page, 'window.__walk.simulateFight(0.3)');
  await page.waitForTimeout(500);
  expect((await joint(page, 'Hand_L'))![1]).toBeGreaterThan(1.2);
  expect((await joint(page, 'Hand_R'))![1]).toBeLessThan(1.15);
  await page.screenshot({ path: `${SHOTS}/${shot}-cast.png` });
  await js(page, 'window.__walk.simulateFight(2)');
  await js(page, 'window.__walk.pause(false)');

  // walking swings the legs: the feet trade places
  await page.locator('#view').click({ position: { x: 5, y: 300 } });
  await page.keyboard.down('KeyW');
  const gaps: number[] = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(90);
    const l = (await joint(page, 'Foot_L'))!,
      r = (await joint(page, 'Foot_R'))!;
    gaps.push(Math.hypot(l[0] - r[0], l[2] - r[2]));
  }
  await page.keyboard.up('KeyW');
  expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(0.08);

  // riding sits the body down
  await js(page, 'window.__walk.setRiding(true)');
  await page.waitForTimeout(700);
  expect((await joint(page, 'Hips'))![1]).toBeLessThan(0.9);
  await page.screenshot({ path: `${SHOTS}/${shot}-bike.png` });
}

test('the player is the character made on the character screen, posed in code', async ({
  page,
}) => {
  await open(page);
  await checkPoses(page, 'hero');
});

test('a model from another program (Mixamo bones, T-pose, centimetres) works the same', async ({
  page,
}) => {
  // list a "hero" model: a copy of the character dressed up as a Mixamo export, with the notes
  // that tell the game how to read it
  await page.route('**/assets.json', async (route) => {
    const res = await route.fetch();
    const manifest = (await res.json()) as { models: Record<string, unknown>[] };
    manifest.models.push({
      id: 'hero',
      file: 'models/hero.glb',
      joints: 'mixamo',
      restFix: { UpperArm_L: [0, 0, -90], UpperArm_R: [0, 0, 90] },
    });
    await route.fulfill({ response: res, json: manifest });
  });
  await page.route('**/models/hero.glb', (route) =>
    route.fulfill({
      body: readFileSync(new URL('./fixtures/hero_mixamo.glb', import.meta.url)),
      contentType: 'model/gltf-binary',
    }),
  );
  await open(page);
  await checkPoses(page, 'hero-mixamo');
});
