import { expect, expectOnStage, on, sheet, shot, spills, test } from '../kit.mjs';

/** The stage is 9:16 wherever there is room for it, and a phone's whole screen where there is not. */
const VIEWPORTS = [['a 9:16 phone', 360, 640], ['a tall phone', 390, 844], ['a large phone', 412, 915], ['a small phone', 320, 568], ['a desktop window', 1280, 800]];

for (const [name, width, height] of VIEWPORTS) {
  test(`${name} (${width} × ${height}): every screen keeps to the stage`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const stage = await page.locator('#stage').boundingBox();
    expect(stage.width).toBeCloseTo(Math.min(width, height * 9 / 16), 0);
    expect(stage.height).toBe(height);
    expect(stage.x + stage.width / 2).toBeCloseTo(width / 2, 0);
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([width, height]);

    // The cover.
    const catalogue = on(page, 'catalogue');
    await expect(catalogue.locator('.cover__plate img.is-in')).toHaveCount(1);
    await expectOnStage(page, catalogue.locator('.cover h1.display'));
    await expectOnStage(page, catalogue.locator('.cover__plate'));
    await expectOnStage(page, catalogue.getByRole('button', { name: 'Begin a sitting' }));
    await expectOnStage(page, catalogue.getByRole('button', { name: 'The catalogue' }));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'cover');

    // A world page.
    const world = catalogue.locator('.page.world').nth(1);
    await world.scrollIntoViewIfNeeded();
    await expect(world.locator('.world__plate > img.is-in')).toHaveCount(1);
    await expect(world.locator('h2.title')).toBeInViewport({ ratio: 1 });
    await expectOnStage(page, world.locator('.world__plate'));
    await expectOnStage(page, world.locator('.world__note'));
    await expectOnStage(page, world.getByRole('button', { name: 'Sit for Chiaroscuro' }));
    await shot(page, testInfo, 'world');

    // The sitting: viewfinder, then the review.
    await world.getByRole('button', { name: 'Sit for Chiaroscuro' }).click();
    const sit = on(page, 'sitting');
    await expect(sit).toHaveAttribute('data-camera', 'on');
    await expectOnStage(page, sit.locator('.vf'));
    await expectOnStage(page, sit.getByRole('button', { name: 'Take the photograph' }));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'viewfinder');
    await sit.getByRole('button', { name: 'House sitter' }).click();
    await expect(sheet(page).locator('.sitters__item img.is-in')).toHaveCount(6);
    await expectOnStage(page, sheet(page));
    await sheet(page).locator('.sitters__item').nth(1).click();
    await expect(sit).toHaveAttribute('data-state', 'review');
    await expect(sit.locator('.strip__item img.is-in')).toHaveCount(7);
    await expectOnStage(page, sit.locator('.vf'));
    await expectOnStage(page, sit.locator('.review__words'));
    await expectOnStage(page, sit.locator('.review .btn--primary'));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'review');

    // Developing, then the print.
    await sit.locator('.review .btn--primary').click();
    const dev = on(page, 'developing');
    await expect(dev).toHaveClass(/has-preview/, { timeout: 30_000 });
    await expectOnStage(page, dev.locator('.dev__tray'));
    await expectOnStage(page, dev.locator('.beats'));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'developing');
    const reveal = on(page, 'reveal');
    await expect(reveal.locator('.tissue')).toBeVisible({ timeout: 30_000 });
    await reveal.locator('.tissue').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.tissue')).toHaveCount(0);
    await expectOnStage(page, reveal.locator('.reveal__plate'));
    await expectOnStage(page, reveal.locator('.reveal__caption'));
    await expectOnStage(page, reveal.locator('.reveal__actions'));
    await expectOnStage(page, reveal.locator('.remix__row'));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'reveal');
  });
}
