import { expect, test, type Page } from '@playwright/test';

// Desktop layout of the redesign (spec 2026-11-10-refonte-ui): stage, drawer, tools, card, camera, hover.
const BASE = '/'; // relative to use.baseURL (playwright.config.ts)
interface V {
  pickReadyMs: number;
  getSnapshot(): { view: { selection: { slug: string; side: string | null } | null; camera: { position: number[]; target: number[] } | null; pose: Record<string, number> }; playing: unknown };
  instanceState(name: string): { alpha: number } | null;
  screenPointOf(name: string): { x: number; y: number } | null;
  setState(p: object): void;
  freeArea(): { left: number; top: number; right: number; bottom: number };
}
const viewer = <T,>(page: Page, f: (v: V) => T) => page.evaluate(f as never) as Promise<T>;
const alpha = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { __viewer: V }).__viewer.instanceState(n)!.alpha, name);
const camera = (page: Page) => viewer(page, (v) => (window as unknown as { __viewer: V }).__viewer.getSnapshot().view.camera!);

async function open(page: Page, query: string, hash = '') {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}${query}${hash ? `#${hash}` : ''}`);
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  return errors;
}

test('the 3D view fills the window; the drawer toggles and its state survives a reload', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string);
  const box = (await page.locator('canvas').boundingBox())!;
  const vp = page.viewportSize()!;
  expect(box.width * box.height).toBeGreaterThanOrEqual(vp.width * vp.height * 0.95);

  const toggle = page.getByRole('button', { name: 'Structures', exact: true });
  const drawer = page.getByRole('navigation', { name: 'Structures anatomiques' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true'); // 1440 px wide: open by default
  await expect(drawer).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(drawer).toBeHidden();
  // the canvas did not change size
  expect((await page.locator('canvas').boundingBox())!.width).toBe(box.width);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Structures', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect(errors).toEqual([]);
});

test('tools: one panel at a time, Échap closes it and gives focus back, a mark tells a tool is modified', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string);
  const tools = page.getByRole('navigation', { name: 'Outils' });
  const layers = tools.getByRole('button', { name: /^Calques/ });
  const sections = tools.getByRole('button', { name: /^Coupes/ });
  await layers.click();
  await expect(layers).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByRole('region', { name: 'Calques' });
  await expect(panel).toBeVisible();
  await sections.click();
  await expect(panel).toBeHidden();
  await expect(page.getByRole('region', { name: 'Coupes' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('region', { name: 'Coupes' })).toBeHidden();
  await expect(sections).toBeFocused();

  await expect(layers).toHaveAccessibleName('Calques');
  await layers.click();
  await panel.getByRole('checkbox', { name: 'Appareil digestif' }).check(); // hidden by default: showing it modifies
  await expect(layers).toHaveAccessibleName('Calques, modifié');
  await layers.click();
  await expect(panel).toBeHidden();

  // the × in the panel header closes it too, focus back on the tool button
  await sections.click();
  await page.getByRole('region', { name: 'Coupes' }).getByRole('button', { name: 'Fermer le panneau Coupes' }).click();
  await expect(page.getByRole('region', { name: 'Coupes' })).toBeHidden();
  await expect(sections).toBeFocused();
});

test('the card: appears on selection, Isoler ghosts the rest and survives a reload, Masquer hides, Ctrl+Z brings back', async ({ page }, info) => {
  const errors = await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  const card = page.getByRole('complementary', { name: /humérus/ });
  await expect(card).toBeVisible();
  await expect(card.getByRole('list', { name: 'Systèmes' })).toContainText('Squelette et articulations');
  await expect(card.getByText('Slug')).toBeHidden(); // folded under Détails techniques

  await card.getByRole('button', { name: 'Isoler' }).click();
  await expect(card.getByRole('button', { name: 'Isoler' })).toHaveAttribute('aria-pressed', 'true');
  expect(await alpha(page, 'humerus@left')).toBe(1);
  expect(await alpha(page, 'femur@left')).toBeLessThan(1);
  await expect(page.getByRole('button', { name: 'Quitter l’isolement' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toContain('iso=humerus@left');
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __viewer?: V }).__viewer?.pickReadyMs, null, { timeout: 60_000 });
  expect(await alpha(page, 'femur@left')).toBeLessThan(1);
  await page.getByRole('button', { name: 'Quitter l’isolement' }).click();
  expect(await alpha(page, 'femur@left')).toBe(1);

  await card.getByRole('button', { name: 'Masquer' }).click();
  expect(await alpha(page, 'humerus@left')).toBe(0);
  await expect(card).toBeHidden(); // hiding clears the selection
  await expect(page.getByText('1 structure masquée')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await alpha(page, 'humerus@left')).toBe(1);
  await expect(page.getByText('1 structure masquée')).toBeHidden();

  await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  await page.getByRole('complementary', { name: /humérus/ }).getByRole('button', { name: 'Fermer la sélection' }).click();
  await expect(page.getByRole('complementary', { name: /humérus/ })).toBeHidden();
  expect(errors).toEqual([]);
});

test('Animer opens the Mouvement tool on the joint and plays it', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  await page.getByRole('complementary', { name: /humérus/ }).getByRole('button', { name: 'Animer' }).click();
  const panel = page.getByRole('region', { name: 'Mouvement' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('combobox', { name: 'Articulation' })).toHaveValue('elbow-joint@left');
  await expect(panel.getByRole('button', { name: 'Lire le mouvement' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => viewer(page, () => (window as unknown as { __viewer: V }).__viewer.getSnapshot().playing)).not.toBeNull();
});

test('camera: Dos looks from behind keeping the target, Recentrer gives the first view back, a double-click selects and frames', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string);
  const first = await camera(page);
  const group = page.getByRole('group', { name: 'Vue caméra' });
  await group.getByRole('button', { name: 'Dos' }).click();
  await expect.poll(async () => (await camera(page)).position[1]).toBeGreaterThan(first.target[1]);
  const back = await camera(page);
  expect(back.target.map(Math.round)).toEqual(first.target.map(Math.round));
  await group.getByRole('button', { name: 'Recentrer la vue' }).click();
  await expect.poll(async () => (await camera(page)).position.map(Math.round)).toEqual(first.position.map(Math.round));

  const at = (await viewer(page, () => (window as unknown as { __viewer: V }).__viewer.screenPointOf('femur@left')))!;
  await page.mouse.dblclick(at.x, at.y);
  await expect.poll(() => viewer(page, () => (window as unknown as { __viewer: V }).__viewer.getSnapshot().view.selection)).not.toBeNull();
  await expect.poll(async () => {
    const c = await camera(page);
    return Math.hypot(c.position[0] - c.target[0], c.position[1] - c.target[1], c.position[2] - c.target[2]);
  }).toBeLessThan(Math.hypot(first.position[0] - first.target[0], first.position[1] - first.target[1], first.position[2] - first.target[2]));
});

test('hover: a label names the structure near the cursor, none while dragging', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string);
  const label = page.getByTestId('hover-label');
  // the middle of the free area, 40 % down: the body is centred between the panels
  const at = await viewer(page, () => {
    const a = (window as unknown as { __viewer: V }).__viewer.freeArea();
    return { x: (a.left + a.right) / 2, y: a.top + (a.bottom - a.top) * 0.4 };
  });
  await page.mouse.move(at.x, at.y);
  await expect(label).toBeVisible();
  await expect(label).not.toBeEmpty();
  const l = (await label.boundingBox())!;
  expect(Math.abs(l.x - (at.x + 14))).toBeLessThan(2);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + 20, { steps: 5 });
  await expect(label).toBeHidden();
  await page.mouse.up();
});

test('the ⋯ menu opens the licences and the help; no credit line over the view', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string);
  await expect(page.getByText(/^Données : BodyParts3D/)).toHaveCount(0);
  const more = page.getByRole('button', { name: 'Plus d’options' });
  await more.click();
  await page.getByRole('menuitem', { name: 'Données et licences…' }).click();
  const credits = page.getByRole('dialog', { name: 'Données et licences' });
  await expect(credits).toContainText('BodyParts3D');
  await credits.getByRole('button', { name: 'Fermer' }).click();
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('menuitem', { name: 'Aide et raccourcis' }).click();
  const help = page.getByRole('dialog', { name: 'Aide et raccourcis' });
  await expect(help).toContainText(info.project.metadata.query ? 'WebGL2' : 'WebGPU');
  await help.getByRole('button', { name: 'Fermer' }).click();
  await more.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
  await expect(more).toBeFocused();
});

test('with reduced motion a preset is instant; closing the card gives focus to the search', async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, info.project.metadata.query as string, 'sel=humerus@left');
  const before = await camera(page);
  await page.getByRole('group', { name: 'Vue caméra' }).getByRole('button', { name: 'Dos' }).click();
  // no glide: the camera is behind the body right after the click
  expect((await camera(page)).position[1]).toBeGreaterThan(before.target[1]);
  await page.getByRole('complementary', { name: /humérus/ }).getByRole('button', { name: 'Fermer la sélection' }).click();
  await expect(page.getByRole('combobox', { name: 'Rechercher une structure' })).toBeFocused();
});

test('a model switch drops an isolation and hidden structures the model lacks', async ({ page }, info) => {
  await open(page, info.project.metadata.query as string, 'iso=uterus&hid=uterus,femur@left&sex=f');
  await expect(page.getByRole('button', { name: 'Quitter l’isolement' })).toBeVisible();
  await expect(page.getByText('2 structures masquées')).toBeVisible();
  await page.getByRole('group', { name: 'Modèle' }).getByRole('button', { name: 'Homme' }).click();
  await expect(page.getByText('1 structure masquée')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Quitter l’isolement' })).toBeHidden();
  expect(await alpha(page, 'femur@left')).toBe(0);
});
