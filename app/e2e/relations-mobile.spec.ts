import { expect, test, type Page } from '@playwright/test';

const BASE = '/'; // relative to use.baseURL (playwright.config.ts)
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __viewer?: { pickReadyMs: number } }).__viewer?.pickReadyMs, null, { timeout: 60_000 });

test('phone: the relation links and the network button are at least 44 px', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}#sel=popliteal-artery@left`);
  await ready(page);
  const sheet = page.getByRole('region', { name: 'Panneau' });
  await sheet.getByRole('button', { name: /panneau/ }).first().click();
  const link = sheet.getByRole('list', { name: 'Branches' }).getByRole('button', { name: /tibiale antérieure/ }).first();
  const show = sheet.getByRole('button', { name: 'Montrer le réseau' });
  for (const target of [link, show]) {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  await show.click();
  await expect(show).toHaveAttribute('aria-pressed', 'true');
});
