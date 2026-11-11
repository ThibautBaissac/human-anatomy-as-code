import { expect, test, type Page } from '@playwright/test';

const BASE = '/'; // relative to use.baseURL (playwright.config.ts)

interface ViewerHandle { getSnapshot(): { ready: boolean; backend: string }; loadMs: number; meanFrameMs(): number }

async function open(page: Page, query: string, hash = '') {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}${hash}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: ViewerHandle }).__viewer?.getSnapshot().ready, null, { timeout: 60_000 });
  return errors;
}

const panelName = (page: Page) => page.locator('#panel-name');
/** Middle of the area the panels leave free over the view, 40 % down: the body is there (it is centred in that area). */
const freePoint = (page: Page) => page.evaluate(() => {
  const a = (window as unknown as { __viewer: { freeArea(): { left: number; top: number; right: number; bottom: number } } }).__viewer.freeArea();
  return { x: (a.left + a.right) / 2, y: a.top + (a.bottom - a.top) * 0.4 };
});

test('loads, selects by click and by search, cuts, and restores the view from the URL', async ({ page }, info) => {
  const query = info.project.metadata.query as string;
  const errors = await open(page, query);
  const backend = await page.evaluate(() => (window as unknown as { __viewer: ViewerHandle }).__viewer.getSnapshot().backend);
  expect(backend).toBe(query ? 'WebGL2' : 'WebGPU');

  // 1. click in the middle of the view (the area the panels leave free) selects something
  const at = await freePoint(page);
  await page.mouse.click(at.x, at.y);
  await expect(panelName(page)).not.toBeEmpty();

  // 2. search "fémur", pick the first result: panel and hash follow
  const search = page.getByRole('combobox', { name: 'Rechercher une structure' });
  await search.fill('fémur');
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.press('Enter');
  await expect(panelName(page)).toHaveText('fémur');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sel=femur');

  // 3. an axial section, without console errors
  await page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Coupes/ }).click();
  await page.getByRole('checkbox', { name: 'Axiale' }).check();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('cut=axial:0.500');
  await page.waitForTimeout(500);

  // 4. reloading the URL restores the selection
  const url = page.url();
  await page.goto('about:blank');
  const errors2 = await open(page, '', url.slice(url.indexOf('?') >= 0 ? url.indexOf('?') : url.indexOf('#')).replace(/^\//, ''));
  await expect(panelName(page)).toHaveText('fémur');
  await page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Coupes/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Axiale' })).toBeChecked();

  expect([...errors, ...errors2]).toEqual([]);
});

test('in ghost mode, clicks go through the ghosted layers', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, '#sys=none');
  type V = { setLayerCut(n: number): void; setGhost(b: boolean): void; select(s: null): void; getSnapshot(): { view: { selection: { slug: string } | null } }; catalog: { structure(s: string): { layer: number } } };
  const at = await freePoint(page);
  const selected = () => page.evaluate(() => (window as unknown as { __viewer: V }).__viewer.getSnapshot().view.selection?.slug ?? null);
  // What is on top at that point, and its layer.
  await page.mouse.click(at.x, at.y);
  const top = await selected();
  expect(top).not.toBeNull();
  // Ghost that layer: the same click must now reach something deeper.
  await page.evaluate((slug) => {
    const v = (window as unknown as { __viewer: V }).__viewer;
    v.select(null); v.setGhost(true); v.setLayerCut(v.catalog.structure(slug!).layer + 1);
  }, top);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(300);
  expect(await selected()).not.toBe(top); // something deeper, or nothing — never the ghost
});

test('performance budget: full load (atlas, GLB, BVH) under 4 s, mean frame under 16.7 ms with panels open (WebGPU)', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'budget measured on WebGPU only');
  await open(page, '');
  await page.waitForFunction(() => (window as unknown as { __viewer: { pickReadyMs: number } }).__viewer.pickReadyMs > 0);
  // measured with the drawer and a tool panel open over the view (spec 2026-11-10-refonte-ui)
  await expect(page.getByRole('navigation', { name: 'Structures anatomiques' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Calques/ }).click();
  await expect(page.getByRole('region', { name: 'Calques' })).toBeVisible();
  // Rendering is on demand: frame cost is measured while orbiting, which redraws every frame.
  const { loadMs, firstFrameMs, frameMs } = await page.evaluate(async () => {
    const v = (window as unknown as { __viewer: ViewerHandle & { firstFrameMs: number; orbitFor(ms: number): Promise<number[]> } }).__viewer;
    const times = await v.orbitFor(3000);
    return { loadMs: v.loadMs, firstFrameMs: v.firstFrameMs, frameMs: times.reduce((a, b) => a + b, 0) / times.length };
  });
  console.log(`[budget] first frame ${Math.round(firstFrameMs)} ms · pick ready ${Math.round(loadMs)} ms · mean frame ${frameMs.toFixed(2)} ms`);
  // 4 s since the refinement of faceted meshes (decisions of spec 2026-11-10-refonte-ui): BVH build grows with the triangles
  expect(loadMs).toBeLessThan(4000);
  expect(frameMs).toBeLessThan(16.7);
});
