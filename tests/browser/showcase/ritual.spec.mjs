import { readFileSync } from 'node:fs';
import { beats, expect, on, pngSize, recordBeats, sheet, shot, spills, test, expectOnStage } from '../kit.mjs';

const wipeOf = plate => plate.evaluate(el => Number(el.style.getPropertyValue('--wipe')));

test.describe('the portrait ritual', () => {
  test('a sitting is developed beat by beat, unveiled, compared, kept, explained and remixed', async ({ page }, testInfo) => {
    // A share sheet stands in for the phone's own, so the hand-off can be seen.
    await page.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: data => Boolean(data?.files?.length) });
      Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async data => { /** @type {any} */ (window).__shared = { title: data.title, text: data.text, files: data.files.map(f => [f.name, f.type, f.size > 100_000]) }; } });
    });
    await page.goto('/#/sitting?world=oil');
    const sit = on(page, 'sitting');

    // Before: borrow a house sitter, review what will be developed.
    await sit.getByRole('button', { name: 'House sitter' }).click();
    await expect(sheet(page).locator('.sitters__item')).toHaveCount(6);
    await expect(sheet(page).locator('.sitters__item img.is-in')).toHaveCount(6);
    await shot(page, testInfo, 'house-sitters');
    await sheet(page).locator('.sitters__item').nth(3).click();
    await expect(sit).toHaveAttribute('data-state', 'review');
    await expect(sit.locator('.review__reading > .mono').first()).toHaveText(/house sitter/i);
    await expect(sit.locator('.review__words li')).toHaveCount(5);
    await expect(sit.locator('.review__chips .chip')).toHaveCount(0);            // a house sitter is not yours to correct
    await expect(sit.locator('.strip__item')).toHaveCount(7);
    await expect(sit.locator('.strip__item[aria-selected="true"] .strip__name')).toHaveText('Chiaroscuro');
    await expect(sit.locator('.strip__item img.is-in')).toHaveCount(7);
    await expect(sit.locator('.review__cta')).toHaveText('Develop in Chiaroscuro');
    await expectOnStage(page, sit.locator('.review .btn--primary'));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'review');

    // During: three beats, each with something true to look at.
    await recordBeats(page);
    await sit.locator('.review .btn--primary').click();
    const dev = on(page, 'developing');
    await expect(dev.locator('.beat__title')).toHaveText(['Reading facial character', 'Composing light and medium', 'Refining fine detail']);
    await expect(dev.locator('.bar__title')).toHaveText(/plate ii · chiaroscuro/i);
    await expect(dev.locator('.dev__foot')).toHaveText(/the atelier · drawn on this device/i);
    expect(await dev.locator('.dev__stars circle').count()).toBeGreaterThan(30);   // the constellation over the face
    expect(await dev.locator('.dev__lamp').count()).toBeGreaterThan(0);            // the lighting plan (Chiaroscuro: one lamp)
    expect(await dev.locator('.dev__palette i').count()).toBeGreaterThan(3);
    expect(await dev.locator('progress, [role="progressbar"]').count()).toBe(0);   // never a loading bar
    await expect(dev).toHaveClass(/has-preview/, { timeout: 20_000 });
    await expect(dev.locator('.dev__tag')).toHaveText(/03 · Refining · pass \d of 8/i);
    await shot(page, testInfo, 'developing');

    // Reveal: a print under tissue, lifted by hand.
    const reveal = on(page, 'reveal'), tissue = reveal.locator('.tissue');
    await expect(tissue).toBeVisible({ timeout: 30_000 });
    expect(await beats(page)).toEqual(['0', '1', '2']);
    await expect(tissue).toContainText('Chiaroscuro');
    await expect(reveal).not.toHaveClass(/is-revealed/);
    await shot(page, testInfo, 'tissue');
    await tissue.hover();
    const tb = await tissue.boundingBox(), tx = tb.x + tb.width / 2;
    await page.mouse.move(tx, tb.y + tb.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(tx, tb.y + tb.height * 0.62, { steps: 3 });
    expect(await tissue.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).m42)).toBeLessThan(-20);   // it follows the finger
    await page.mouse.move(tx, tb.y + tb.height * 0.3, { steps: 6 });
    await page.mouse.up();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(tissue).toHaveCount(0);

    await expect(reveal.locator('.stamp')).toHaveText(/^study$/i);
    await expect(reveal.locator('.stamp')).toHaveAttribute('data-kind', 'study');
    await expect(reveal.locator('.reveal__caption h2')).toHaveText('Chiaroscuro');
    await expect(reveal.locator('.reveal__caption')).toContainText('No. 0001');
    await expect(reveal.locator('.reveal__caption')).toContainText(/Showcase study · drawn on this device in \d+\.\d s/i);
    await expectOnStage(page, reveal.locator('.remix__row'));
    expect(await spills(page)).toEqual([]);

    // Compare: drag across for a wipe, hold for the whole sitting.
    const plate = reveal.locator('.reveal__plate');
    await plate.hover({ position: { x: 30, y: 120 } });
    const pb = await plate.boundingBox();
    await page.mouse.down();
    await page.mouse.move(pb.x + pb.width * 0.6, pb.y + 120, { steps: 6 });
    await expect(plate).toHaveAttribute('data-comparing', 'true');
    expect(await wipeOf(plate)).toBeCloseTo(0.6, 1);
    await shot(page, testInfo, 'compare');
    await page.mouse.up();
    await expect.poll(() => wipeOf(plate)).toBeLessThan(0.02);
    await expect(plate).toHaveAttribute('data-comparing', 'false');
    await plate.hover();
    await page.mouse.down();
    await expect.poll(() => wipeOf(plate)).toBeGreaterThan(0.97);                  // held: the whole sitting
    await page.mouse.up();
    await expect.poll(() => wipeOf(plate)).toBeLessThan(0.02);
    await shot(page, testInfo, 'reveal');

    // Keep: a studio print with its plate, number and an honest line about how it was made.
    const saving = page.waitForEvent('download');
    await reveal.getByRole('button', { name: 'Keep' }).click();
    const print = await saving;
    expect(print.suggestedFilename()).toBe('likeness-0001-chiaroscuro.png');
    await print.saveAs(testInfo.outputPath('keepsake.png'));
    expect(pngSize(readFileSync(testInfo.outputPath('keepsake.png')))).toEqual([1500, 2100]);
    await expect(page.locator('.toast')).toHaveText('The print is saved');

    // Share: the same print, handed to the phone's share sheet.
    await reveal.getByRole('button', { name: 'Share' }).click();
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__shared)).toEqual({ title: 'Likeness', text: 'Chiaroscuro, No. 0001', files: [['likeness-0001-chiaroscuro.png', 'image/png', true]] });

    // Behind it, and back: the print stays unveiled.
    await reveal.getByRole('button', { name: 'Behind it' }).click();
    await expect(on(page, 'lab').locator('h1.title')).toHaveText('Why it still looks like them.');
    await expect(on(page, 'lab').locator('.tri__cell img.is-in')).toHaveCount(3);
    await on(page, 'lab').locator('.bar__back').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.tissue')).toHaveCount(0);

    // Remix: the same sitting, another world. A tap lifts the tissue too.
    await expect(reveal.locator('.remix__item')).toHaveCount(7);
    await expect(reveal.locator('.remix__item[aria-current="true"]')).toHaveAttribute('aria-label', 'Develop in Chiaroscuro');
    await recordBeats(page);
    await reveal.getByRole('button', { name: 'Develop in Neon Noir' }).click();
    await expect(reveal.locator('.tissue')).toBeVisible({ timeout: 40_000 });
    expect(await beats(page)).toEqual(['0', '1', '2']);
    await reveal.locator('.tissue').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.reveal__caption h2')).toHaveText('Neon Noir');
    await expect(reveal.locator('.reveal__caption')).toContainText('No. 0002');
    await shot(page, testInfo, 'remix');

    // The drawer keeps both, across a reload.
    await reveal.getByRole('button', { name: 'The drawer' }).click();
    const drawer = on(page, 'drawer');
    await expect(drawer.locator('.sheetgrid__item')).toHaveCount(2);
    await expect(drawer.locator('.drawer__head .mono')).toHaveText(/2 plates · kept on this device/i);
    await page.reload();
    await expect(drawer.locator('.sheetgrid__item')).toHaveCount(2);
    await expect(drawer.locator('.sheetgrid__item').first()).toContainText(/No\. 0002 · I/i);
    await expect(drawer.locator('.sheetgrid__kind').first()).toHaveText(/study/i);
    await shot(page, testInfo, 'drawer');
    await drawer.locator('.sheetgrid__item').nth(1).click();
    await expect(reveal).toHaveClass(/is-revealed/);                                // an old print has no tissue
    await expect(reveal.locator('.tissue')).toHaveCount(0);
    await expect(reveal.locator('.reveal__caption')).toContainText('No. 0001');
    await reveal.locator('.bar__back').click();

    await drawer.getByRole('button', { name: 'Empty the drawer' }).click();
    await expect(sheet(page)).toContainText('Empty it?');
    await sheet(page).getByRole('button', { name: 'Empty the drawer' }).click();
    await expect(drawer.locator('.drawer__empty')).toContainText('Nothing in the drawer yet.');
    await page.reload();
    await expect(drawer.locator('.drawer__empty')).toContainText('Nothing in the drawer yet.');
  });
});
