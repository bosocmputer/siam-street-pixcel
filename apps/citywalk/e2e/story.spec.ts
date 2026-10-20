import { expect, test, type Page } from '@playwright/test';
import { newGame } from './start';

// The first minute (approved mockup): the opening pictures, the stick hint, quest 1 to Pa Saeng
// along the guide line, her dialogue, the strike spotlight, the first red ring in slow motion,
// quest cards, and skills that come only with a job.

const SHOTS = process.env.SHOTS_DIR ?? 'test-results/shots';

type Story = {
  quest: { id: string | null; step: number; count: number; done: string[] };
  tips: string[];
  job: string | null;
  talking: string;
  bar: string;
  card: string;
  guide: number;
  tip: string | null;
  skills: boolean;
  npcs: [number, number] | null;
};

const js = <T>(page: Page, code: string) => page.evaluate(code) as Promise<T>;
const story = (page: Page) => js<Story>(page, 'window.__walk.story()');

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.describe.configure({ timeout: 150_000 });

test('the opening shows three pictures, a tap moves on, and skip goes to the character screen', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  await page.waitForFunction(() => '__walk' in window);
  // the pictures wait for taps while the test looks at them
  await page.getByRole('button', { name: 'เริ่มเดิน' }).click();
  await js(page, 'window.__walk.holdOpening(true)');
  await page.screenshot({ path: `${SHOTS}/opening-1.png` });
  const at = await js<number>(page, 'window.__walk.opening()');
  expect(at).toBeGreaterThanOrEqual(0);
  if (at < 2) {
    await page.locator('.opening').click({ position: { x: 100, y: 300 } });
    expect(await js<number>(page, 'window.__walk.opening()')).toBe(at + 1);
  }
  // tap on to the last picture
  while ((await js<number>(page, 'window.__walk.opening()')) < 2)
    await page.locator('.opening').click({ position: { x: 100, y: 300 } });
  await expect(page.locator('.op-line')).toHaveText('และเชียงใหม่ทั้งเมืองก็หลับไป');
  await page.getByRole('button', { name: 'ข้าม ›' }).click();
  await expect(page.locator('.opening')).toBeHidden();
  expect(await js(page, 'window.__walk.screen()')).toBe('create');
});

test('the first minute: hint, guide line to Pa Saeng, her words, the strike spotlight', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  await newGame(page, { tap: true });
  await page.waitForFunction(() => '__walk' in window);
  // only strike and dash: the skill buttons come with a job
  await expect(page.getByRole('button', { name: 'ตี' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'กระสุนไฟ' })).toBeHidden();
  let s = await story(page);
  expect(s.skills).toBe(false);
  expect(s.quest.id).toBe('wake');
  expect(s.bar).toContain('ไปหาเสียงร้อง');
  // the stick hint, one at a time: walking first, then turning the camera
  expect(s.tip).toBe('stick');
  await expect(page.locator('.tip-walk')).toBeVisible();
  await expect(page.locator('.tip-look')).toBeHidden();
  // the guide line runs to Pa Saeng, with the distance over her
  expect(s.guide).toBeGreaterThan(5);
  await expect(page.locator('.goal')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/story-start.png` });

  // walk and turn: the hint is done for good
  await js(page, 'window.__walk.simulate(1, 0, 1)');
  await expect(page.locator('.tip-look')).toBeVisible();
  await expect(page.locator('.tip-walk')).toBeHidden();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 3 }],
    });
  await touch('touchStart', 300, 400);
  for (let i = 1; i <= 6; i++) await touch('touchMove', 300 - i * 10, 400);
  await touch('touchEnd', 240, 400);
  await expect.poll(async () => (await story(page)).tips).toContain('stick');

  // arriving at the stall finishes quest 1; standing close, she speaks and the world waits
  await page.evaluate(`(() => {
    const w = window.__walk; const [x, z] = w.story().npcs; w.teleport(x + 4, z + 1);
  })()`);
  await expect.poll(async () => (await story(page)).quest.id).toBe('pa_saeng');
  await expect(page.locator('.sysbox')).toContainText('สำเร็จ · ตื่น');
  await page.evaluate(`(() => {
    const w = window.__walk; const [x, z] = w.story().npcs; w.teleport(x + 2, z + 0.5);
  })()`);
  await expect(page.locator('.talk')).toBeVisible();
  await expect(page.locator('.talk')).toContainText('ป้าแสง');
  expect(await js(page, 'window.__walk.screen()')).toBe('menu');
  await expect(page.getByRole('button', { name: 'ตี' })).toBeHidden();
  await page.screenshot({ path: `${SHOTS}/story-talk.png` });
  await page.locator('.talk').click();
  await expect(page.locator('.talk')).toBeHidden();
  expect(await js(page, 'window.__walk.screen()')).toBe('play');
  s = await story(page);
  expect(s.quest).toMatchObject({ id: 'pa_saeng', step: 1 });
  expect(s.bar).toContain('ล้มสไลม์น้ำ');

  // the strike spotlight, until a strike lands
  await expect.poll(async () => (await story(page)).tip).toBe('strike');
  await expect(page.locator('.tip-hole')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/story-strike-tip.png` });
});

test('quests 2 to 4 play through, the first red ring slows time, and a job brings the skills', async ({
  page,
}) => {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
  // straight to the fight of quest 2, the stick hint already learnt
  await js(page, `window.__walk.setStory('pa_saeng', 1, ['stick'])`);
  const near = (i: number, d: number) =>
    page.evaluate(`(() => {
      const w = window.__walk;
      const s = w.slimes()[${i}], me = w.state();
      const l = Math.hypot(me.x - s.x, me.z - s.z) || 1;
      w.teleport(s.x + ((me.x - s.x) / l) * ${d}, s.z + ((me.z - s.z) / l) * ${d});
      w.setTarget(${i});
    })()`);
  await near(0, 1.4);
  // strike until the water slime melts: the strike hint is done, and the step moves on
  for (let n = 0; n < 40 && (await story(page)).quest.step === 1; n++) {
    await js(page, 'window.__walk.strike()');
    await js(page, 'window.__walk.simulateStrike(0.5)');
  }
  let s = await story(page);
  expect(s.quest).toMatchObject({ id: 'pa_saeng', step: 2 });
  expect(s.tips).toContain('strike');
  // the first red ring the player stands in: time slows and the dash button is shown
  expect(s.tips).toContain('ring1');
  // back to Pa Saeng to finish quest 2
  await js(page, 'window.__walk.pause(false)');
  await page.evaluate(`(() => {
    const w = window.__walk; const [x, z] = w.story().npcs; w.teleport(x + 2, z + 0.5);
  })()`);
  await expect(page.locator('.talk')).toBeVisible();
  await page.locator('.talk').click();
  await page.locator('.talk').click();
  await expect.poll(async () => (await story(page)).quest.id).toBe('street');
  await expect(page.locator('.sysbox')).toContainText('ตีพลัง');
  await page.screenshot({ path: `${SHOTS}/story-done.png` });

  // the skills stay hidden until a job is awakened
  expect((await story(page)).skills).toBe(false);
  await js(page, `window.__walk.setJob('elementalist')`);
  await expect(page.getByRole('button', { name: 'กระสุนไฟ' })).toBeVisible();
  expect(await js(page, 'window.__walk.save()')).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'เดินต่อจากเดิม' }).click();
  await page.waitForFunction(() => '__walk' in window);
  s = await story(page);
  expect(s.quest.id).toBe('street');
  expect(s.job).toBe('elementalist');
  await expect(page.getByRole('button', { name: 'กระสุนไฟ' })).toBeVisible();
});

test('the first red ring the player stands in slows time and points at dash', async ({ page }) => {
  await page.goto('./?debug=1');
  await newGame(page);
  await page.waitForFunction(() => '__walk' in window);
  await js(page, 'window.__walk.pause(true)');
  await js(page, `window.__walk.setStory('street', 0, ['stick', 'strike'])`);
  await page.evaluate(`(() => {
    const w = window.__walk;
    const s = w.slimes()[0], me = w.state();
    const l = Math.hypot(me.x - s.x, me.z - s.z) || 1;
    w.teleport(s.x + ((me.x - s.x) / l) * 1.4, s.z + ((me.z - s.z) / l) * 1.4);
    w.setTarget(0);
    w.strike();
    w.simulateStrike(0.3);
    for (let n = 0; n < 120 && w.story().tip !== 'ring1'; n++) w.simulateFight(1 / 30);
  })()`);
  expect((await story(page)).tip).toBe('ring1');
  await expect(page.locator('.tip-slow')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/story-ring-tip.png` });
});
