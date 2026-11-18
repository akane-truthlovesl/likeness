import { develop, expect, expectOnStage, fixture, on, shot, spills, test } from '../kit.mjs';

test.describe('the sitting', () => {
  test('the viewfinder coaches, the shutter fires, and a face that cannot be read can be described', async ({ page }, testInfo) => {
    // No share sheet here: the print must fall back to a plain download.
    await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined }));
    await page.goto('/#/sitting?world=clay');
    const sit = on(page, 'sitting'), face = sit.locator('.vf__readout b').first();
    await expect(sit).toHaveAttribute('data-state', 'frame');
    await expect(sit).toHaveAttribute('data-camera', 'on');                        // Chrome's fake camera
    await expect(sit.locator('.vf__readout')).toHaveCount(4);
    await expect(face).toHaveText('none', { timeout: 60_000 });                    // its test pattern has nobody in it
    await expect(sit.locator('.sit__cue')).toHaveText('Step into the frame.');
    await expectOnStage(page, sit.getByRole('button', { name: 'Take the photograph' }));
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'viewfinder');

    await sit.getByRole('button', { name: 'Take the photograph' }).click();
    await expect(sit).toHaveAttribute('data-state', 'review', { timeout: 60_000 });
    await expect(sit.locator('.review__status')).toHaveText('No face was found. Describe the sitter below, or take another.');
    expect(await page.evaluate(() => /** @type {HTMLVideoElement} */ (document.querySelector('.vf__video')).srcObject)).toBeNull();   // the camera is let go

    // Describe the sitter by hand: every chip turns to its next value.
    const chips = sit.locator('.review__chips .chip');
    await expect(chips).toHaveCount(5);
    await expect(chips.locator('small')).toHaveText(['Hair', 'Colour', 'Skin', 'Glasses', 'Beard']);
    for (const i of [0, 3, 4]) {
      const was = await chips.nth(i).innerText();
      await chips.nth(i).click();
      await expect(chips.nth(i)).not.toHaveText(was);
    }
    const words = await sit.locator('.review__words').innerText();
    await chips.nth(1).click();
    await chips.nth(2).click();
    await expect(sit.locator('.review__words')).not.toHaveText(words);
    await sit.locator('.strip__item').nth(6).click();
    await expect(sit.locator('.review__cta')).toHaveText('Develop in The Order');
    await shot(page, testInfo, 'described');

    const reveal = await develop(page);
    await reveal.locator('.tissue').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.stamp')).toHaveText(/^study$/i);
    const saving = page.waitForEvent('download');
    await reveal.getByRole('button', { name: 'Share' }).click();
    expect((await saving).suggestedFilename()).toBe('likeness-0001-the-order.png');
    await expect(page.locator('.toast')).toHaveText('No share sheet here. Saved instead');

    // Another photograph: back to a live viewfinder.
    await reveal.locator('.bar__back').click();
    await expect(sit).toHaveAttribute('data-state', 'frame');
    await expect(sit).toHaveAttribute('data-camera', 'on');
  });

  test('a chosen photograph is read on the device, corrected by a tap, and nothing is sent', async ({ page, baseURL }, testInfo) => {
    const requests = [];
    page.on('request', r => requests.push([r.method(), r.url()]));
    await page.goto('/#/sitting?world=cinema');
    const sit = on(page, 'sitting');
    await sit.locator('.sit__controls input[type=file]').setInputFiles(fixture('ines'));
    await expect(sit).toHaveAttribute('data-state', 'review', { timeout: 90_000 });
    await expect(sit.locator('.review__status')).toHaveText(/^Read on this device in \d+ ms\. Nothing was sent\.$/);
    await expect(sit.locator('.review__reading > .mono').first()).toHaveText(/the reading · tap to correct/i);
    await expect(sit.locator('.review__words li')).toHaveCount(5);
    await expect(sit.locator('.review__chips .chip')).toHaveCount(5);
    await expect(sit.locator('.strip__item img.is-in')).toHaveCount(7);            // the reading, tried on in every world
    await expect(sit.locator('.strip__item[aria-selected="true"] .strip__name')).toHaveText('Cinema 3D');
    expect(await spills(page)).toEqual([]);
    await shot(page, testInfo, 'reading');

    const reveal = await develop(page);
    await reveal.locator('.tissue').click();
    await expect(reveal).toHaveClass(/is-revealed/);
    await expect(reveal.locator('.reveal__caption')).toContainText(/Showcase study · drawn on this device/i);
    await reveal.getByRole('button', { name: 'Behind it' }).click();
    const lab = on(page, 'lab');
    await expect(lab.locator('h1.title')).toHaveText('Why it still looks like you.');
    await expect(lab.locator('.tri__cell').first()).toContainText(/your photograph/i);
    await expect(lab.locator('.lab__section').nth(2).locator('.lab__honest')).toContainText(/Measured on this device: read \d+ ms/);
    await shot(page, testInfo, 'lab-own');

    // Nothing was sent: every request was a GET, to this origin or to a picture already in memory.
    expect(requests.filter(([method]) => method !== 'GET')).toEqual([]);
    expect(requests.filter(([, url]) => !url.startsWith(baseURL) && !url.startsWith('blob:') && !url.startsWith('data:'))).toEqual([]);
  });

  test('a file that is not a photograph is refused kindly', async ({ page }) => {
    await page.goto('/#/sitting');
    const sit = on(page, 'sitting');
    await sit.locator('.sit__controls input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photograph') });
    await expect(sit.locator('.sit__cue')).toHaveText('That file could not be opened as a photograph.');
    await expect(sit).toHaveAttribute('data-state', 'frame');
  });
});
