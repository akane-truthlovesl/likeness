import { STAGES, expect, on, sheet, shot, spills, test } from '../kit.mjs';

test.describe('behind the portrait', () => {
  test('shows why a locked likeness holds where words drift, and how the plate was made', async ({ page }, testInfo) => {
    await page.goto('/#/lab');
    const lab = on(page, 'lab'), sections = lab.locator('.lab__section');
    await expect(lab.locator('h1.title')).toHaveText('Why it still looks like them.');
    await expect(sections).toHaveCount(4);

    // 01: the sitting, the words-only plate and the identity-locked plate, side by side, each with its score.
    const cells = lab.locator('.tri__cell');
    await expect(cells.locator('figcaption > .mono:first-child')).toHaveText(['The sitting', 'Words only', 'Identity-locked']);
    await expect(cells.locator('img.is-in')).toHaveCount(3);
    const [naive, locked] = (await cells.locator('b.num').allInnerTexts()).map(t => t.split('/').map(Number));
    expect(locked[0]).toBe(locked[1]);                                             // the locked plate holds every measure
    expect(naive[1]).toBe(locked[1]);
    expect(naive[0]).toBeLessThan(locked[0] - 2);                                  // words alone lose several
    await expect(sections.nth(0).locator('.badge')).toHaveText(/specimen/i);
    await expect(sections.nth(0).locator('.lab__verdict')).toContainText('A prompt keeps what can be said aloud');
    expect(await sections.nth(0).locator('.lab__drift li').count()).toBeGreaterThan(2);
    await expect(sections.nth(0).locator('.lab__honest')).toContainText('In this edition both plates are drawn by the atelier');
    await shot(page, testInfo, 'lab-compare');

    // The same place in all three pictures, full size.
    await cells.nth(1).click();
    await expect(sheet(page).locator('.viewer__tabs .chip')).toHaveText(['The sitting', 'Words only', 'Identity-locked']);
    await expect(sheet(page).locator('.viewer__tabs .chip[aria-pressed="true"]')).toHaveText('Words only');
    const shown = await sheet(page).locator('.viewer__plate img').getAttribute('src');
    await sheet(page).locator('.viewer__tabs .chip').nth(2).click();
    await expect(sheet(page).locator('.viewer__plate img')).not.toHaveAttribute('src', shown);
    await shot(page, testInfo, 'lab-viewer');
    await sheet(page).getByRole('button', { name: 'Close' }).click();
    await expect(sheet(page)).toHaveCount(0);

    // 02: four ways a face can travel; a plain prompt has only the last.
    await expect(sections.nth(1).locator('.channels > li b')).toHaveText(['Pixels', 'Reference tokens', 'Face embedding', 'Words']);
    expect(await sections.nth(1).locator('.channels__use i[data-on="true"]').count()).toBe(5);

    // 03: the pipeline, stage by stage, and an honest word about where the numbers come from.
    await sections.nth(2).scrollIntoViewIfNeeded();
    await expect(sections.nth(2).locator('.badge')).toHaveText(/simulated/i);
    await expect(sections.nth(2).locator('.fall__row > .mono')).toHaveText(STAGES);
    await expect(sections.nth(2).locator('.fall__head b')).toHaveText(/^\d+\.\d s$/);
    await expect(sections.nth(2).locator('.fall__head .mono')).toContainText(/qwen-image-2\.1-turbo · 8 steps · seed \d+ · \d+\.\d GB peak/i);
    await expect(sections.nth(2).locator('.lab__honest')).toContainText('Not measured here: no workstation is connected.');
    await shot(page, testInfo, 'lab-pipeline');

    // 04: the recipe, exactly as the workstation will run it.
    await sections.nth(3).scrollIntoViewIfNeeded();
    await expect(sections.nth(3).locator('.lab__label')).toContainText(/the recipe · chiaroscuro/i);
    await expect(sections.nth(3).locator('.recipe dt')).toHaveText(['Engine', 'Steps', 'Guidance', 'Size', 'Reference', 'Likeness floor']);
    const [lockedPrompt, naivePrompt] = await sections.nth(3).locator('.recipe__prompt').allInnerTexts();
    expect(lockedPrompt).toMatch(/person in the input photograph/i);
    expect(naivePrompt).not.toMatch(/input photograph/i);
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'lab-recipe');
  });

  test('any house sitter can be examined in any world', async ({ page }) => {
    await page.goto('/#/lab');
    const lab = on(page, 'lab'), picks = lab.locator('.lab__pick');
    await expect(picks).toHaveCount(2);
    await expect(picks.nth(0).locator('.chip')).toHaveCount(6);
    await expect(picks.nth(1).locator('.chip')).toHaveText(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
    await expect(lab.locator('.tri__cell img.is-in')).toHaveCount(3);
    const before = await lab.locator('.tri__cell img').nth(2).getAttribute('src');
    await picks.nth(1).locator('.chip').nth(4).click();
    await expect(lab.locator('.lab__section').nth(3).locator('.lab__label')).toContainText(/the recipe · brick miniature/i);
    await picks.nth(0).locator('.chip').nth(0).click();
    await expect(picks.nth(0).locator('.chip').nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(lab.locator('.tri__cell img.is-in')).toHaveCount(3);
    await expect(lab.locator('.tri__cell img').nth(2)).not.toHaveAttribute('src', before);
    await lab.getByRole('button', { name: 'Begin a sitting' }).click();
    await expect(on(page, 'sitting')).toHaveAttribute('data-state', 'frame');
  });
});
