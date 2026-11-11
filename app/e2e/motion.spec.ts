import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';
interface V {
  getSnapshot(): { ready: boolean; playing: unknown; view: { selection: { slug: string } | null; pose: Record<string, number> } };
  pickReadyMs: number;
  instanceState(name: string): { matrix: number[]; alpha: number } | null;
  focus(slug: string, side: string): void;
  screenPointOf(name: string): { x: number; y: number } | null;
  setState(p: object): void;
  meanFrameMs(): number;
}
const state = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __viewer: V }).__viewer.instanceState(n), name);

async function open(page: Page, query: string, hash: string) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  // every system shown: the tests watch muscles and skin, hidden by the skeleton-only default
  await page.goto(`${BASE}${query}#${hash ? `sys=none&${hash}` : 'sys=none'}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  return errors;
}
/** Opens the Mouvement tool (a no-op when a same-document navigation left it open). */
async function openMotion(page: Page) {
  const button = page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Mouvement/ });
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await expect(page.getByRole('region', { name: 'Mouvement' })).toBeVisible();
}
const moved = (a: number[], b: number[]) => a.some((v, i) => Math.abs(v - b[i]) > 1e-3);

test('elbow: the Mouvement tool moves the forearm by keyboard, ghosts crossing tissues, picks the moved bone, rests', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  await openMotion(page);
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

  // a click on the moved ulna (bones only, seen from below, where ulna and radius lie side by side) selects it
  await page.evaluate(() => {
    const v = (window as unknown as { __viewer: V }).__viewer;
    v.setState({ hiddenKinds: ['artery', 'fascia', 'muscle', 'nerve', 'skin', 'vein', 'tendon', 'ligament', 'lymphatic', 'cns', 'organ', 'cartilage'],
      camera: { position: [235, -230, 700], target: [230, -160, 1040] } });
  });
  await page.waitForTimeout(300);
  const at = (await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.screenPointOf('ulna@left')))!;
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.getSnapshot().view.selection)).toEqual({ slug: 'ulna', side: 'left' });

  // rest puts everything back
  await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.setState({ hiddenKinds: [] }));
  await page.goto(`${BASE}${info.project.metadata.query}#sys=none&sel=humerus@left&p=elbow-joint@left:90`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  await openMotion(page);
  await page.getByRole('button', { name: 'Position de repos' }).click();
  expect((await state(page, 'ulna@left'))!.matrix).toEqual(rest);
  expect((await state(page, 'brachialis@left'))!.alpha).toBe(1);
  expect(errors).toEqual([]);
});

test('the shared URL restores the pose', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, 'sel=femur&p=knee-joint@left:60,knee-joint@right:60');
  await openMotion(page);
  const slider = page.getByRole('region', { name: 'Mouvement' }).getByRole('slider');
  await expect(slider).toHaveAttribute('aria-valuetext', '60° de flexion');
  for (const side of ['left', 'right']) expect((await state(page, `semitendinosus@${side}`))!.alpha).toBeLessThan(1);
});

test('with reduced motion, play sweeps once and stops on its own', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, info.project.metadata.query as string, 'sel=tibia@left');
  await openMotion(page);
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
  await openMotion(page);
  await page.getByRole('button', { name: 'Lire le mouvement' }).click();
  await page.waitForTimeout(3000);
  const frameMs = await page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.meanFrameMs());
  console.log(`[budget] playing the elbow, both sides: mean frame ${frameMs.toFixed(2)} ms`);
  expect(frameMs).toBeLessThan(16.7);
});

test('a model switch keeps the pose (female → male with the elbow flexed)', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string, 'sex=f&sel=humerus@left&p=elbow-joint@left:90');
  const flexed = (await state(page, 'ulna@left'))!.matrix;
  await page.getByRole('group', { name: 'Modèle' }).getByRole('button', { name: 'Homme' }).click();
  await page.waitForFunction(() => { const v = (window as unknown as { __viewer: V }).__viewer; return v.getSnapshot().ready && v.getSnapshot().view.selection; }, null, { timeout: 60_000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __viewer: { getSnapshot(): { view: { model: string } } } }).__viewer.getSnapshot().view.model)).toBe('male');
  expect((await state(page, 'ulna@left'))!.matrix).toEqual(flexed);
  expect((await state(page, 'brachialis@left'))!.alpha).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('the credits list each source with its licence notice (MIT, BSD-3)', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, '');
  await page.getByRole('button', { name: 'Licences', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Données et licences' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Rajagopal 2016 full-body musculoskeletal model (OpenSim)')).toBeVisible();
  await expect(dialog.getByText(/Permission is hereby granted/)).toHaveCount(1);
  await expect(dialog.getByText(/Redistribution and use in source and binary forms/)).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('button', { name: 'Licences', exact: true })).toBeFocused();
});
