import { expect, test, type Page } from '@playwright/test';

const BASE = 'http://localhost:5174/';
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __viewer?: { getSnapshot(): { ready: boolean } } }).__viewer?.getSnapshot().ready, null, { timeout: 60_000 });

test('after "make available offline", the app reloads and works without network', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE);
  await ready(page);
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30_000 });

  // Force a real download of every model: empty the model cache first.
  await page.evaluate(() => caches.delete('haac-assets'));
  await page.getByRole('button', { name: 'Hors ligne…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Utiliser l’atlas hors ligne' });
  await expect(dialog).toBeVisible();
  const state = dialog.getByTestId('offline-state');
  await expect(state).not.toHaveText(/Vérification/);
  const button = dialog.getByRole('button', { name: 'Rendre disponible hors ligne' });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(state).toContainText('Disponible hors ligne', { timeout: 90_000 });
  await expect(dialog.getByRole('alert')).toHaveCount(0); // no "download interrupted" after a successful download
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('button', { name: 'Hors ligne…' })).toBeFocused();

  // a view to restore from the URL
  const search = page.getByRole('combobox', { name: 'Rechercher une structure' });
  await search.fill('fémur');
  await search.press('Enter');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sel=femur');

  await context.setOffline(true);
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.reload();
  await ready(page);
  await expect(page.getByText('Hors ligne', { exact: true })).toBeVisible();
  await expect(page.locator('.info h2#panel-name')).toHaveText('fémur');
  await expect(page.locator('[role=alert]')).toHaveCount(0);
  await search.fill('cœur');
  await search.press('Enter');
  await expect(page.locator('.info h2#panel-name')).not.toHaveText('fémur');
  expect(errors).toEqual([]);
});
