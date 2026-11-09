import { expect, test } from '@playwright/test';

const BASE = 'http://localhost:5174/';

test('phone: 3D on top, tabs below; a tap shows the Info tab; arrows move between tabs', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: { pickReadyMs: number } }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveText(['Arbre', 'Infos', 'Commandes']);

  await page.getByRole('tab', { name: 'Arbre' }).click();
  await expect(page.getByRole('tab', { name: 'Arbre' })).toHaveAttribute('aria-selected', 'true');
  const box = (await page.locator('canvas').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.4);
  await expect(page.getByRole('tab', { name: 'Infos' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-name')).not.toBeEmpty();

  await page.getByRole('tab', { name: 'Infos' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Commandes' })).toBeFocused();
  await expect(page.getByRole('tabpanel', { name: 'Commandes' })).toBeVisible();
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab', { name: 'Arbre' })).toHaveAttribute('aria-selected', 'true');
});

test('phone: the Mouvement section is in the Info tab and its slider moves the joint', async ({ page }, info) => {
  await page.goto(`${BASE}${info.project.metadata.query}#sel=humerus@left`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: { pickReadyMs: number } }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  await page.getByRole('tab', { name: 'Infos' }).click();
  const slider = page.getByRole('region', { name: 'Mouvement' }).getByRole('slider');
  await slider.scrollIntoViewIfNeeded();
  await expect(slider).toBeVisible();
  await slider.fill('100');
  await expect(slider).toHaveAttribute('aria-valuetext', '100° de flexion');
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('p=elbow-joint@left:100');
});
