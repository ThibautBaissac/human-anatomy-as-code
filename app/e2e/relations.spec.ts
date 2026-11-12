import { expect, test, type Page } from '@playwright/test';

const BASE = '/'; // relative to use.baseURL (playwright.config.ts)
interface V { pickReadyMs: number; instanceState(name: string): { alpha: number } | null }
const alpha = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __viewer: V }).__viewer.instanceState(n)!.alpha, name);
const hash = (page: Page) => page.evaluate(() => location.hash);

async function open(page: Page, query: string, h = '') {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}${h ? `#${h}` : ''}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  return errors;
}

test('relations: branches in the card, follow a link, show the network of the artery, press again to end it', async ({ page }, info) => {
  const q = info.project.metadata.query as string;
  const errors = await open(page, q, 'sel=popliteal-artery@left');
  const card = page.locator('aside.card');
  await expect(card.getByRole('heading', { name: 'Branches' })).toBeVisible();
  await card.getByRole('list', { name: 'Branches' }).getByRole('button', { name: /tibiale antérieure/ }).first().click();
  await expect.poll(() => hash(page)).toContain('sel=anterior-tibial-artery@left');

  await page.goto('about:blank');
  errors.push(...await open(page, q, 'sel=popliteal-artery@left'));
  const show = page.getByRole('button', { name: 'Montrer le réseau' });
  await expect(show).toHaveAttribute('aria-pressed', 'false');
  await show.click();
  await expect(show).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => hash(page)).toContain('net=popliteal-artery@left');
  expect(await alpha(page, 'anterior-tibial-artery@left')).toBe(1); // member, though the cardiovascular system is hidden by default
  expect(await alpha(page, 'femur@left')).toBeLessThan(1);
  await expect(page.getByRole('status').filter({ hasText: 'Réseau' })).toBeVisible();

  await show.click();
  await expect(show).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => hash(page)).not.toContain('net=');
  expect(errors).toEqual([]);
});

test('relations: the banner button ends the network', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string, 'net=popliteal-artery@left');
  const banner = page.getByRole('status').filter({ hasText: 'Réseau' });
  await expect(banner).toBeVisible();
  await banner.getByRole('button', { name: 'Quitter le réseau' }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => hash(page)).not.toContain('net=');
  expect(errors).toEqual([]);
});
