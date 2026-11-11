import { expect, test, type Page } from '@playwright/test';

const BASE = '/'; // relative to use.baseURL (playwright.config.ts)
interface V { pickReadyMs: number; instanceState(name: string): { alpha: number } | null }
const alpha = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __viewer: V }).__viewer.instanceState(n)!.alpha, name);

async function open(page: Page, query: string, hash = '') {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}${hash ? `#${hash}` : ''}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  return errors;
}

test('systems: only the skeleton at startup; show all; hide one, a structure of two systems stays; isolate; the URL keeps it', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string);
  expect(await alpha(page, 'femur@left')).toBe(1);
  expect(await alpha(page, 'stomach')).toBe(0);
  expect(await alpha(page, 'cerebellum')).toBe(0);
  const layers = page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Calques/ });
  await expect(layers).not.toHaveAttribute('aria-label', /.+/); // the default: no mark
  await layers.click();
  const block = page.getByRole('region', { name: 'Calques' });
  await expect(block).toBeVisible();
  await expect(block.getByRole('checkbox', { name: 'Squelette et articulations' })).toBeChecked();
  await expect(block.getByRole('checkbox', { name: 'Appareil digestif' })).not.toBeChecked();

  await block.getByRole('button', { name: 'Tout afficher' }).click();
  expect(await alpha(page, 'stomach')).toBe(1);
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sys=none');

  await block.getByRole('checkbox', { name: 'Appareil digestif' }).uncheck();
  expect(await alpha(page, 'stomach')).toBe(0);
  expect(await alpha(page, 'pancreas')).toBe(1); // still endocrine
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('sys=digestive');

  await block.getByRole('button', { name: 'Solo : Système nerveux' }).click();
  expect(await alpha(page, 'cerebellum')).toBe(1);
  expect(await alpha(page, 'femur@left')).toBe(0);
  expect(await alpha(page, 'pancreas')).toBe(0);

  await block.getByRole('button', { name: 'Tout afficher' }).click();
  expect(await alpha(page, 'femur@left')).toBe(1);
  await expect(block.getByRole('button', { name: 'Tout afficher' })).toBeDisabled();

  // Tout masquer: back to the skeleton alone; the button then has nothing left to do
  await block.getByRole('button', { name: 'Tout masquer' }).click();
  expect(await alpha(page, 'femur@left')).toBe(1);
  expect(await alpha(page, 'stomach')).toBe(0);
  expect(await alpha(page, 'cerebellum')).toBe(0);
  await expect(block.getByRole('button', { name: 'Tout masquer' })).toBeDisabled();

  await page.goto('about:blank');
  await open(page, info.project.metadata.query as string, 'sys=skeletal');
  expect(await alpha(page, 'femur@left')).toBe(0);
  await page.getByRole('navigation', { name: 'Outils' }).getByRole('button', { name: /^Calques/ }).click();
  await expect(page.getByRole('region', { name: 'Calques' }).getByRole('checkbox', { name: 'Squelette et articulations' })).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('the card names the systems of the selection', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, 'sel=pancreas');
  await expect(page.getByRole('list', { name: 'Systèmes' }).getByRole('listitem')).toHaveText(['Appareil digestif', 'Système endocrinien']);
});
