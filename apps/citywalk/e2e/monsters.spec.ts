import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Slime = {
  x: number;
  z: number;
  level: number;
  hp: number;
  alive: boolean;
  species: string;
  life: string;
};
type Pickup = { item: string; count: number; x: number; z: number; age: number };

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const slimes = (page: Page) => js<Slime[]>(page, 'window.__walk.slimes()');
const pickups = (page: Page) => js<Pickup[]>(page, 'window.__walk.pickups()');
const bag = (page: Page) => js<Record<string, number>>(page, 'window.__walk.inventory()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
// software WebGL is slow when several test files run at once
test.describe.configure({ timeout: 150_000 });

async function open(page: Page) {
  await page.goto('./?debug=1&seed=7');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
}

/** Stand `d` metres from slime i, on the side of where the walker is now (or the nearest side
 * with no wall in between), looking at it. */
async function standNear(page: Page, i: number, d: number) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[${i}], me = w.state();
    const base = Math.atan2(me.x - s.x, me.z - s.z);
    const open = (x, z) => {
      for (let t = 0; t <= 0.9; t += 0.05) if (w.blocked(x + (s.x - x) * t, z + (s.z - z) * t)) return false;
      return true;
    };
    let x = s.x + Math.sin(base) * ${d}, z = s.z + Math.cos(base) * ${d};
    for (let k = 0; k < 24; k++) {
      const a = base + Math.ceil(k / 2) * (k % 2 ? 1 : -1) * (Math.PI / 12);
      const cx = s.x + Math.sin(a) * ${d}, cz = s.z + Math.cos(a) * ${d};
      if (open(cx, cz)) { x = cx; z = cz; break; }
    }
    w.teleport(x, z);
    w.setYaw(Math.atan2(-(s.x - x), -(s.z - z)));
  })()`);
}

/** Cast at slime i and step the fight until the shot lands, then `after` seconds more. */
async function shoot(page: Page, i: number, id: string, after = 0.1) {
  await page.evaluate(`(() => {
    const w = window.__walk;
    w.setTarget(${i});
    w.cast('${id}');
    for (let n = 0; n < 150 && w.combat().inFlight > 0; n++) w.simulateFight(1 / 30);
    w.simulateFight(${after});
  })()`);
}

/** Beat slime i with fire shots, keeping the player strong enough to stand it. */
async function beat(page: Page, i: number) {
  await js(page, 'window.__walk.setStats({ level: 10 })');
  for (let n = 0; n < 24 && (await slimes(page))[i]!.alive; n++) {
    await js(page, 'window.__walk.setStats({ hp: 200, energy: 200, safe: 5 })');
    // it chases whoever hits it; keep away so what it drops stays on the ground
    await standNear(page, i, 12);
    await shoot(page, i, 'fireball', 1.7);
  }
  expect((await slimes(page))[i]!.alive).toBe(false);
}

test('slimes live across the city, stronger away from the start; kinds differ in size and colour', async ({
  page,
}) => {
  await open(page);
  const list = await slimes(page);
  expect(list.length).toBeGreaterThan(40);
  expect(list[0]!.species).toBe('slime_water');
  expect(new Set(list.map((s) => s.species)).size).toBe(5);
  // the square: level 1 and 2, a level-2 slime has more hp than the same kind at level 1
  expect(list.slice(0, 6).map((s) => s.level)).toEqual([1, 1, 1, 1, 2, 2]);
  expect(list.slice(0, 6).map((s) => s.hp)).toEqual([100, 100, 80, 40, 135, 108]);
  expect(Math.max(...list.map((s) => s.level))).toBe(12);

  // a picture of the fire slime and the giant, to see the colours and sizes; the giant's name
  // carries its level, red for a new player far below it
  const g = list.findIndex((s) => s.species === 'slime_giant');
  await standNear(page, g, 9);
  await js(page, `window.__walk.setTarget(${g})`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/kinds-giant.png` });
  await expect(page.locator('.hpname')).toContainText(`Lv ${list[g]!.level} สไลม์ยักษ์`);
  await expect(page.locator('.hpname')).toHaveAttribute('data-tier', 'top');
  await standNear(page, 2, 6);
  await js(page, 'window.__walk.setTarget(2)');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/kinds-fire.png` });
  await expect(page.locator('.hpname')).toContainText('สไลม์ไฟ · แพ้น้ำ');
});

test('a fire slime is weak to water and resists fire, and the numbers show it', async ({
  page,
}) => {
  await open(page);
  await standNear(page, 2, 12);
  // water: 20 × 1.5 = 30, shown big with a "!"
  await shoot(page, 2, 'waterball', 0.2);
  expect((await slimes(page))[2]!.hp).toBe(50);
  await expect(page.locator('.dmg-weak')).toHaveText('30!');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/weak-hit.png` });
  // fire: 40 × 0.5 = 20, shown small and grey
  await js(page, 'window.__walk.simulateFight(2)');
  await shoot(page, 2, 'fireball', 0.2);
  expect((await slimes(page))[2]!.hp).toBe(30);
  await expect(page.locator('.dmg-resist')).toHaveText('20');
});

test('a beaten slime drops things that are picked up by walking close, and the bag keeps them', async ({
  page,
}) => {
  await open(page);
  const g = (await slimes(page)).findIndex((s) => s.species === 'slime_giant');
  await standNear(page, g, 12); // the giant: always drops 2-4 water gel
  await beat(page, g);
  const dropped = await pickups(page);
  const water = dropped.find((p) => p.item === 'gel_water')!;
  expect(water.count).toBeGreaterThanOrEqual(2);
  expect(water.count).toBeLessThanOrEqual(4);
  // they lie round where the giant fell
  const giant = (await slimes(page))[g]!;
  for (const p of dropped) expect(Math.hypot(p.x - giant.x, p.z - giant.z)).toBeLessThan(1.5);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SHOTS}/drops-ground.png` });
  expect(await bag(page)).toEqual({});

  // stand a few metres off, inside the pull but not touching: it drifts in by itself
  await js(page, `window.__walk.teleport(${water.x} + 2.5, ${water.z})`);
  await js(page, 'window.__walk.simulateFight(1.2)');
  const got = await bag(page);
  expect(got.gel_water).toBe(water.count);
  await expect(page.locator('.toast')).toContainText('เจลสไลม์น้ำ');
  await expect(page.locator('.toast')).toContainText(`×${water.count}`);
  expect((await pickups(page)).some((p) => p.item === 'gel_water')).toBe(false);
});

test('drops that nobody picks up are gone after a while, and far away ones are left alone', async ({
  page,
}) => {
  await open(page);
  const g = (await slimes(page)).findIndex((s) => s.species === 'slime_giant');
  await standNear(page, g, 12);
  await beat(page, g);
  expect((await pickups(page)).length).toBeGreaterThan(0);
  // walk well away and wait
  await js(page, 'window.__walk.teleport(window.__walk.state().x + 40, window.__walk.state().z)');
  await js(page, 'window.__walk.simulateFight(10)');
  expect((await pickups(page)).length).toBeGreaterThan(0);
  await js(page, 'window.__walk.simulateFight(25)');
  expect(await pickups(page)).toEqual([]);
  expect(await bag(page)).toEqual({});
});
