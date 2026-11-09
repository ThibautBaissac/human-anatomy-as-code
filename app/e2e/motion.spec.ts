import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';
interface V {
  getSnapshot(): { ready: boolean; playing: unknown; view: { selection: { slug: string } | null; pose: Record<string, number> } };
  pickReadyMs: number;
  instanceState(name: string): { matrix: number[]; alpha: number } | null;
  focus(slug: string, side: string): void;
  setState(p: object): void;
  meanFrameMs(): number;
}
const state = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __viewer: V }).__viewer.instanceState(n), name);

async function open(page: Page, query: string, hash: string) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}#${hash}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  return errors;
}
const moved = (a: number[], b: number[]) => a.some((v, i) => Math.abs(v - b[i]) > 1e-3);

test('elbow: the Mouvement section moves the forearm by keyboard, ghosts crossing tissues, picks the moved bone, rests', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  const section = page.getByRole('region', { name: 'Mouvement' });
  await expect(section).toBeVisible();
  const slider = section.getByRole('slider', { name: /Angle de flexion/ });
  await expect(slider).toHaveAttribute('aria-valuetext', '13° de flexion');
  const rest = (await state(page, 'ulna@left'))!.matrix;
  const restRight = (await state(page, 'ulna@right'))!.matrix;
  expect((await state(page, 'brachialis@left'))!.alpha).toBe(1);

  // keyboard: Page Up ×7 (+70°), then arrows (+7°): 90°
  await slider.focus();
  for (let i = 0; i < 7; i++) await slider.press('PageUp');
  for (let i = 0; i < 7; i++) await slider.press('ArrowRight');
  await expect(slider).toHaveAttribute('aria-valuetext', '90° de flexion');
  expect(moved((await state(page, 'ulna@left'))!.matrix, rest)).toBe(true);
  // the other side stays still
  expect((await state(page, 'ulna@right'))!.matrix).toEqual(restRight);
  expect((await state(page, 'brachialis@left'))!.alpha).toBeLessThan(1);
  expect((await state(page, 'skin'))!.alpha).toBeLessThan(1);
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('p=elbow-joint@left:90');

  // picking reaches the forearm where it now is
  await page.evaluate(() => { const v = (window as unknown as { __viewer: V }).__viewer; v.setState({ hiddenKinds: ['artery', 'fascia', 'muscle', 'nerve', 'skin', 'vein', 'tendon', 'ligament', 'lymphatic', 'cns', 'organ', 'cartilage'] }); v.focus('ulna', 'left'); });
  await page.waitForTimeout(300);
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // the hit is an instance the elbow moved (forearm or hand): picking follows the moved geometry
  await expect.poll(() => page.evaluate(() => {
    const v = (window as unknown as { __viewer: V & { rigs: Record<string, { moving: string[] }> } }).__viewer;
    const sel = v.getSnapshot().view.selection as { slug: string; side: string | null } | null;
    return !!sel && v.rigs['elbow-joint@left'].moving.includes(`${sel.slug}@${sel.side ?? 'left'}`);
  })).toBe(true);

  // rest puts everything back
  await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.setState({ hiddenKinds: [] }));
  await page.goto(`${BASE}${info.project.metadata.query}#sel=humerus@left&p=elbow-joint@left:90`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Position de repos' }).click();
  expect((await state(page, 'ulna@left'))!.matrix).toEqual(rest);
  expect((await state(page, 'brachialis@left'))!.alpha).toBe(1);
  expect(errors).toEqual([]);
});

test('the shared URL restores the pose', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, 'sel=femur&p=knee-joint@left:60,knee-joint@right:60');
  const slider = page.getByRole('region', { name: 'Mouvement' }).getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuetext', '60° de flexion');
  for (const side of ['left', 'right']) expect((await state(page, `semitendinosus@${side}`))!.alpha).toBeLessThan(1);
});

test('with reduced motion, play sweeps once and stops on its own', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, info.project.metadata.query as string, 'sel=tibia@left');
  const play = page.getByRole('button', { name: 'Lire le mouvement' });
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(play).toHaveAttribute('aria-pressed', 'false', { timeout: 8000 });
  expect(await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.getSnapshot().playing)).toBeNull();
});

test('performance budget while playing: mean frame under 16.7 ms (WebGPU)', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'budget measured on WebGPU only');
  await open(page, '', 'sel=humerus');
  await page.getByRole('button', { name: 'Lire le mouvement' }).click();
  await page.waitForTimeout(3000);
  const frameMs = await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.meanFrameMs());
  console.log(`[budget] playing the elbow, both sides: mean frame ${frameMs.toFixed(2)} ms`);
  expect(frameMs).toBeLessThan(16.7);
});
