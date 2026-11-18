import { STAGES, develop, expect, fixture, on, sheet, shot, spills, test } from '../kit.mjs';

test.describe('the live studio, with the simulator', () => {
  test('the studio describes itself, and the app repeats it everywhere', async ({ page, request }, testInfo) => {
    for (const path of ['/studio.json', '/api/health']) {
      expect(await (await request.get(path)).json()).toMatchObject({ ok: true, edition: 'live', engine: { id: 'mock', kind: 'simulator' }, worlds: ['noir', 'oil', 'clay', 'cinema', 'brick', 'cel', 'knight'] });
    }
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-mode', 'simulator');
    const cover = on(page, 'catalogue').locator('.cover');
    await expect(cover.locator('.pill')).toHaveText(/^live · simulator$/i);
    await expect(cover.locator('.pill')).toHaveAttribute('data-mode', 'simulator');
    await cover.locator('.pill').click();
    await expect(sheet(page)).toContainText('Live, with a simulator in place of the GPU.');
    await expect(sheet(page)).toContainText('Plates made here are marked “Simulator render”.');
    await shot(page, testInfo, 'edition');
    await sheet(page).getByRole('button', { name: 'Understood' }).click();
    await expect(sheet(page)).toHaveCount(0);
  });

  test('a photograph makes the round trip: upload, gate, job, events, render, and a measured trace', async ({ page }, testInfo) => {
    const posts = [];
    page.on('request', r => { if (r.method() === 'POST') posts.push(new URL(r.url()).pathname.replace(/[0-9a-f]{12}/, ':id')); });
    await page.goto('/#/sitting?world=noir');
    const sit = on(page, 'sitting');
    await sit.locator('.sit__controls input[type=file]').setInputFiles(fixture('lena'));
    await expect(sit).toHaveAttribute('data-state', 'review', { timeout: 90_000 });
    await expect(sit.locator('.review__reading > .mono').first()).toHaveText(/the reading · sent as notes/i);
    await expect(sit.locator('.review__cta')).toHaveText('Develop in Neon Noir');
    expect(posts).toEqual([]);                                                     // nothing leaves until the sitter says develop

    const reveal = await develop(page);
    expect(posts).toEqual(['/api/sittings', '/api/sittings/:id/portraits']);
    await reveal.locator('.tissue').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.stamp')).toHaveText(/^render$/i);
    await expect(reveal.locator('.stamp')).toHaveAttribute('data-kind', 'render');
    await expect(reveal.locator('.reveal__caption')).toContainText(/Simulator render · mock · 8 steps · seed \d+ · \d+\.\d s/i);
    expect(await reveal.locator('.reveal__plate > img').first().evaluate(img => [img.naturalWidth, img.naturalHeight])).toEqual([896, 1200]);
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'reveal');

    // Behind it: measured by the studio, and honest about what the score is.
    await reveal.getByRole('button', { name: 'Behind it' }).click();
    const lab = on(page, 'lab'), sections = lab.locator('.lab__section'), cells = lab.locator('.tri__cell');
    await expect(sections.nth(0).locator('.badge')).toHaveText(/rendered/i);
    await expect(cells.nth(1)).toContainText(/not yet rendered/i);
    await expect(cells.nth(2).locator('b.num')).toHaveText(/^-?\d\.\d\d$/);
    await expect(cells.nth(2)).toContainText(/tone proxy/i);
    await expect(sections.nth(2).locator('.badge')).toHaveText(/measured/i);
    await expect(sections.nth(2).locator('.fall__row > .mono')).toHaveText(STAGES);
    await expect(sections.nth(2).locator('.lab__honest')).toContainText('Measured by the studio on');
    await expect(sections.nth(2).locator('.fall__row[data-stage="gate"] .fall__note')).toContainText('no face model installed');
    await expect(sections.nth(2).locator('.fall__row[data-stage="render"] .fall__note')).toHaveText('8 steps, 896 × 1200');

    // The comparison is a second real job, made from the description alone.
    await lab.getByRole('button', { name: 'Render the words-only plate to compare' }).click();
    await expect(cells.locator('img.is-in')).toHaveCount(3, { timeout: 40_000 });
    await expect(cells.locator('b.num')).toHaveText([/^-?\d\.\d\d$/, /^-?\d\.\d\d$/]);
    await expect(sections.nth(0).locator('.lab__verdict')).toContainText('No face model is installed there, so the score is only a proxy');
    expect(posts).toEqual(['/api/sittings', '/api/sittings/:id/portraits', '/api/sittings/:id/portraits']);   // one upload, two orders
    await shot(page, testInfo, 'lab');
  });

  test('a house sitter stays a showcase study, even with the studio connected', async ({ page }) => {
    const posts = [];
    page.on('request', r => { if (r.method() === 'POST') posts.push(r.url()); });
    await page.goto('/#/sitting?world=brick');
    const sit = on(page, 'sitting');
    await sit.getByRole('button', { name: 'House sitter' }).click();
    await sheet(page).locator('.sitters__item').nth(5).click();
    await expect(sit).toHaveAttribute('data-state', 'review');
    await sit.locator('.review .btn--primary').click();
    await expect(on(page, 'developing').locator('.dev__foot')).toHaveText(/the atelier · drawn on this device/i);
    const reveal = on(page, 'reveal');
    await expect(reveal.locator('.tissue')).toBeVisible({ timeout: 40_000 });
    await reveal.locator('.tissue').click();
    await expect(reveal.locator('.stamp')).toHaveText(/^study$/i);
    await expect(reveal.locator('.reveal__caption')).toContainText(/Showcase study · drawn on this device/i);
    await expect(reveal.locator('.pill')).toHaveText(/^live · simulator$/i);
    expect(posts).toEqual([]);
  });
});
