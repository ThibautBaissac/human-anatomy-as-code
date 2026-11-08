import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';

interface ViewerHandle { getSnapshot(): { ready: boolean; backend: string }; loadMs: number; meanFrameMs(): number }

async function open(page: Page, query: string, hash = '') {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}${hash}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: ViewerHandle }).__viewer?.getSnapshot().ready, null, { timeout: 60_000 });
  return errors;
}

const panelName = (page: Page) => page.locator('.info h2#panel-name');

test('loads, selects by click and by search, cuts, and restores the view from the URL', async ({ page }, info) => {
  const query = info.project.metadata.query as string;
  const errors = await open(page, query);
  const backend = await page.evaluate(() => (window as unknown as { __viewer: ViewerHandle }).__viewer.getSnapshot().backend);
  expect(backend).toBe(query ? 'WebGL2' : 'WebGPU');

  // 1. click in the middle of the canvas selects something
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(panelName(page)).not.toBeEmpty();

  // 2. search "fémur", pick the first result: panel and hash follow
  const search = page.getByRole('combobox', { name: 'Rechercher une structure' });
  await search.fill('fémur');
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.press('Enter');
  await expect(panelName(page)).toHaveText('fémur');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sel=femur');

  // 3. an axial section, without console errors
  await page.getByRole('checkbox', { name: 'Axiale' }).check();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('cut=axial:0.500');
  await page.waitForTimeout(500);

  // 4. reloading the URL restores the selection
  const url = page.url();
  await page.goto('about:blank');
  const errors2 = await open(page, '', url.slice(url.indexOf('?') >= 0 ? url.indexOf('?') : url.indexOf('#')).replace(/^\//, ''));
  await expect(panelName(page)).toHaveText('fémur');
  await expect(page.getByRole('checkbox', { name: 'Axiale' })).toBeChecked();

  expect([...errors, ...errors2]).toEqual([]);
});

test('performance budget: full load under 3 s, mean frame under 16.7 ms (WebGPU)', async ({ page }, info) => {
  test.skip(info.project.name !== 'webgpu', 'budget measured on WebGPU only');
  await open(page, '');
  await page.waitForTimeout(3000);
  const { loadMs, frameMs } = await page.evaluate(() => {
    const v = (window as unknown as { __viewer: ViewerHandle }).__viewer;
    return { loadMs: v.loadMs, frameMs: v.meanFrameMs() };
  });
  console.log(`[budget] load ${Math.round(loadMs)} ms · mean frame ${frameMs.toFixed(2)} ms`);
  expect(loadMs).toBeLessThan(3000);
  expect(frameMs).toBeLessThan(16.7);
});
