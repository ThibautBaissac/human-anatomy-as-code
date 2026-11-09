import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __viewer?: { getSnapshot(): { ready: boolean } } }).__viewer?.getSnapshot().ready, null, { timeout: 60_000 });
const panelName = (page: Page) => page.locator('.info h2#panel-name');

test('female model: loads, shows female organs and no male ones, switches models keeping or announcing the selection', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}#sex=f`);
  await ready(page);
  const model = page.getByRole('combobox', { name: 'Modèle' });
  await expect(model).toHaveValue('female');
  await expect(page.getByRole('note')).toContainText('Modèle féminin v1');

  const search = page.getByRole('combobox', { name: 'Rechercher une structure' });
  await search.fill('prostate');
  await expect(page.getByRole('status').filter({ hasText: 'Aucun résultat' })).toBeAttached();
  await search.fill('uterus');
  await expect(page.getByRole('option').first()).toBeVisible();
  await search.press('Enter');
  await expect(panelName(page)).toHaveText(/ut[ée]rus/i);

  // to the male model: the uterus is not there, the selection is cleared and announced
  await model.selectOption('male');
  await ready(page);
  await expect(page.getByTestId('announce')).toContainText('absent du modèle masculin');
  await expect(page.getByRole('note')).toHaveCount(0);

  // a shared structure survives the switch back
  await search.fill('fémur');
  await search.press('Enter');
  await expect(panelName(page)).toHaveText('fémur');
  await model.selectOption('female');
  await ready(page);
  await expect(panelName(page)).toHaveText('fémur');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sex=f');

  // the notice can be dismissed
  await page.getByRole('button', { name: 'Masquer ce message' }).click();
  await expect(page.getByRole('note')).toHaveCount(0);
  expect(errors).toEqual([]);
});
