import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __viewer?: { pickReadyMs: number } }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
const sheet = (page: Page) => page.getByRole('region', { name: 'Panneau' });

test('phone: one-line header, the 3D view under a folded sheet; a tap opens Infos at half height; the handle cycles the heights', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}`);
  await ready(page);
  const header = (await page.locator('header').boundingBox())!;
  expect(header.height).toBeLessThanOrEqual(60);
  const vp = page.viewportSize()!;
  const canvas = (await page.locator('canvas').boundingBox())!;
  expect(canvas.height).toBeGreaterThanOrEqual(vp.height * 0.95);
  await expect(sheet(page)).toHaveAttribute('data-height', 'folded');
  await expect(sheet(page)).toContainText('Touchez une structure');

  await page.touchscreen.tap(canvas.x + canvas.width / 2, canvas.y + canvas.height * 0.3);
  await expect(sheet(page)).toHaveAttribute('data-height', 'half');
  await expect(page.getByRole('tab', { name: 'Infos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-name')).not.toBeEmpty();
  await expect(page.getByRole('tab')).toHaveText(['Infos', 'Arbre', 'Outils']);

  const handle = sheet(page).getByRole('button', { name: /panneau/ }).first();
  await handle.click();
  await expect(sheet(page)).toHaveAttribute('data-height', 'full');
  await handle.click();
  await expect(sheet(page)).toHaveAttribute('data-height', 'folded');
  await handle.click();
  await expect(sheet(page)).toHaveAttribute('data-height', 'half');

  await page.getByRole('tab', { name: 'Infos' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Arbre' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Outils' })).toHaveAttribute('aria-selected', 'true');
});

test('phone: Outils holds the four tools; the system filter and the joint slider work by touch', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}#sys=none&sel=humerus@left`);
  await ready(page);
  await sheet(page).getByRole('button', { name: /panneau/ }).first().click();
  await page.getByRole('tab', { name: 'Outils' }).click();
  const tools = page.getByRole('group', { name: 'Outil' });
  await expect(tools.getByRole('button')).toHaveText(['Calques', 'Dissection', 'Coupes', 'Mouvement']);
  const digestive = page.getByRole('region', { name: 'Calques' }).getByRole('checkbox', { name: 'Appareil digestif' });
  await digestive.scrollIntoViewIfNeeded();
  await digestive.tap();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sys=digestive');

  await tools.getByRole('button', { name: 'Mouvement' }).tap();
  const slider = page.getByRole('region', { name: 'Mouvement' }).getByRole('slider');
  await slider.scrollIntoViewIfNeeded();
  await slider.fill('100');
  await expect(slider).toHaveAttribute('aria-valuetext', '100° de flexion');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('p=elbow-joint@left:100');
});

test('phone: the ⋯ menu switches the model and the language; the search opens from the header', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}`);
  await ready(page);
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitemradio', { name: 'Latin' }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('lang=la');
  await page.getByRole('button', { name: 'Plus d’options' }).click();
  await page.getByRole('menuitemradio', { name: 'Femme' }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sex=f');

  await page.getByRole('button', { name: 'Rechercher une structure' }).click();
  const search = page.getByRole('combobox', { name: 'Rechercher une structure' });
  await expect(search).toBeFocused();
  await page.getByRole('button', { name: 'Fermer la recherche' }).click();
  await expect(page.getByRole('button', { name: 'Rechercher une structure' })).toBeFocused();
});
