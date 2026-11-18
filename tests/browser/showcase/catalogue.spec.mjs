import { WORLD_NAMES, expect, expectOnStage, on, sheet, shot, spills, test } from '../kit.mjs';

test.describe('the catalogue', () => {
  test('opens on the cover, on a 9:16 stage, as the showcase edition', async ({ page }, testInfo) => {
    await page.goto('/');
    const cover = on(page, 'catalogue').locator('.cover');
    await expect(cover.locator('h1.display')).toContainText('Seven studios.');
    await expect(cover.locator('h1.display')).toContainText('One face.');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'showcase');
    await expect(cover.locator('.pill')).toHaveText(/^showcase$/i);
    await expect(cover.locator('.cover__plate img.is-in')).toHaveCount(1);
    await expect(cover.locator('.cover__snap img.is-in')).toHaveCount(1);
    await expect(cover.locator('.cover__caption')).toContainText(/Plate [IV]+ — /);

    const stage = await page.locator('#stage').boundingBox();
    expect(stage).toEqual({ x: 0, y: 0, width: 360, height: 640 });
    expect(stage.width / stage.height).toBeCloseTo(9 / 16, 5);
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([360, 640]);
    await expectOnStage(page, cover.getByRole('button', { name: 'Begin a sitting' }));
    await expectOnStage(page, cover.getByRole('button', { name: 'The catalogue' }));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'cover');
  });

  test('turns through seven worlds, each with its light, its medium and a curator’s note', async ({ page }, testInfo) => {
    await page.goto('/');
    const pages = on(page, 'catalogue').locator('.page.world');
    await expect(pages).toHaveCount(7);
    await expect(on(page, 'catalogue').locator('.catalogue__index button')).toHaveCount(9);
    for (let i = 0; i < 7; i++) {
      const world = pages.nth(i);
      await world.scrollIntoViewIfNeeded();
      await expect(world.locator('h2.title')).toHaveText(WORLD_NAMES[i]);
      await expect(world.locator('.world__plate > img.is-in')).toHaveCount(1);
      await expect(world.locator('.world__facts dt')).toHaveText(['Light', 'Medium']);
      for (const part of ['.lede', '.world__facts dd >> nth=0', '.world__facts dd >> nth=1', '.world__note']) expect((await world.locator(part).innerText()).trim().length).toBeGreaterThan(12);
      await expect(world.getByRole('button', { name: `Sit for ${WORLD_NAMES[i]}` })).toBeVisible();
      await expect(world.locator('.pill')).toHaveText(/^showcase$/i);
      if (i === 0 || i === 5) await shot(page, testInfo, 'world-' + i);
    }
    expect(await spills(page)).toEqual([]);
  });

  test('holding a plate shows the sitter it was made from, and any house sitter can stand in', async ({ page }) => {
    await page.goto('/');
    const world = on(page, 'catalogue').locator('.page.world').nth(2);
    await world.scrollIntoViewIfNeeded();
    const plate = world.locator('.world__plate'), before = plate.locator('.world__before');
    await expect(plate.locator('> img.is-in')).toHaveCount(1);
    await expect(before).not.toHaveClass(/is-in/);
    await plate.hover();
    await page.mouse.down();
    await expect(before).toHaveClass(/is-in/);
    await page.mouse.up();
    await expect(before).not.toHaveClass(/is-in/);

    const dots = world.locator('.dot'), who = world.locator('.world__under > .mono');
    await expect(dots).toHaveCount(6);
    const first = await who.innerText();
    await dots.nth(4).click();
    await expect(dots.nth(4)).toHaveAttribute('aria-pressed', 'true');
    await expect(who).not.toHaveText(first);
    await expect(plate.locator('> img.is-in')).toHaveCount(1);
  });

  test('the edition pill says in plain words what is and is not real here', async ({ page }, testInfo) => {
    await page.goto('/');
    await on(page, 'catalogue').locator('.cover .pill').click();
    await expect(sheet(page)).toContainText('Showcase. Everything here is drawn on this device.');
    await expect(sheet(page)).toContainText('No workstation is connected, so no model is running and nothing leaves your phone.');
    await expect(sheet(page).locator('.readout')).toHaveCount(3);
    await expect(sheet(page)).toHaveClass(/is-in/);
    await shot(page, testInfo, 'edition');
    await sheet(page).getByRole('button', { name: 'Understood' }).click();
    await expect(sheet(page)).toHaveCount(0);
  });

  test('the colophon leads behind the portrait, and the cover leads to a sitting', async ({ page }) => {
    await page.goto('/');
    const catalogue = on(page, 'catalogue'), colophon = catalogue.locator('.page.colophon');
    await colophon.scrollIntoViewIfNeeded();
    await expect(colophon.locator('h2.title')).toHaveText('How the plates are made');
    await colophon.getByRole('button', { name: 'Behind the portrait' }).click();
    await expect(on(page, 'lab').locator('h1.title')).toHaveText('Why it still looks like them.');
    await on(page, 'lab').locator('.bar__back').click();
    await expect(catalogue.locator('.page.colophon h2.title')).toBeInViewport();      // back where the reader was
    await catalogue.locator('.page.world').first().getByRole('button', { name: 'Sit for Neon Noir' }).evaluate(el => el.click());
    await expect(on(page, 'sitting').locator('.bar__title')).toHaveText(/the sitting/i);
  });

  test('an address typed by hand opens its screen', async ({ page }) => {
    await page.goto('/');
    await expect(on(page, 'catalogue')).toBeVisible();
    await page.evaluate(() => { location.hash = '#/drawer'; });
    await expect(on(page, 'drawer').locator('.drawer__empty')).toContainText('Nothing in the drawer yet.');
    await page.evaluate(() => { location.hash = '#/nowhere'; });
    await expect(on(page, 'catalogue').locator('h1.display')).toBeVisible();
  });
});
