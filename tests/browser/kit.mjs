/** What every browser test shares: a clean-console rule, the screen on stage, and a few measurements. */
import { fileURLToPath } from 'node:url';
import { test as base, expect } from '@playwright/test';

/**
 * Chrome's own GL layer warns when MediaPipe reads pixels back on a machine without a GPU. It is the browser
 * talking about itself: the page cannot intercept it, and it is a warning, never an error. Nothing else is excused.
 */
const TOLERATED = [/GPU stall due to ReadPixels/];

export const test = base.extend({
  /** Runs for every test: a console error, an uncaught exception, a failed response or an unexpected warning fails it. */
  problems: [async ({ page }, use, testInfo) => {
    const problems = [], tolerated = [];
    page.on('console', m => {
      if (m.type() !== 'error' && m.type() !== 'warning') return;
      (m.type() === 'warning' && TOLERATED.some(r => r.test(m.text())) ? tolerated : problems).push(`console ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', e => problems.push(`page error: ${e.message}`));
    page.on('response', r => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
    await use(problems);
    if (tolerated.length) testInfo.annotations.push({ type: 'tolerated warning', description: `${tolerated.length} × ${tolerated[0].slice(0, 140)}` });
    expect(problems, 'the console and the network must stay clean').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** A synthetic photograph: one of the house sitters' snapshots, drawn by the atelier (node tools/sheet.mjs --plates …). */
export const fixture = name => fileURLToPath(new URL(`../fixtures/sitters/${name}.jpg`, import.meta.url));

/** The screen on stage, by its router name; a screen on its way out does not count. */
export const on = (page, name) => page.locator(`#stage > [data-screen="${name}"]:not(.is-leaving)`);
export const sheet = page => page.locator('#stage > .sheet');

/** Records each beat the developing screen passes through, in order. Call it before developing starts. */
export const recordBeats = page => page.evaluate(() => {
  const seen = (/** @type {any} */ (window).__beats = []);
  new MutationObserver(() => {
    const beat = document.querySelector('#stage > .dev:not(.is-leaving)')?.getAttribute('data-beat');
    if (beat != null && beat !== '-1' && seen.at(-1) !== beat) seen.push(beat);
  }).observe(document.getElementById('stage'), { subtree: true, childList: true, attributes: true, attributeFilter: ['data-beat'] });
});
export const beats = page => page.evaluate(() => /** @type {any} */ (window).__beats);

/** From the review, develops in the chosen world and waits for the print under its tissue. Returns the reveal. */
export async function develop(page) {
  await recordBeats(page);
  await on(page, 'sitting').locator('.review .btn--primary').click();
  const reveal = on(page, 'reveal');
  await expect(reveal.locator('.tissue')).toBeVisible({ timeout: 40_000 });
  expect(await beats(page), 'three beats, in order, none skipped').toEqual(['0', '1', '2']);
  return reveal;
}

/** Text of the screen on stage that pokes out of it sideways. The world strip scrolls on purpose and is excused. */
export const spills = page => page.evaluate(() => {
  const stage = document.getElementById('stage').getBoundingClientRect(), bad = [];
  for (const el of document.querySelectorAll('#stage > .screen:not(.is-leaving) :is(button, h1, h2, h3, p, li, dt, dd, figcaption, .mono)')) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('.strip, .sr')) continue;
    if (r.left < stage.left - 1 || r.right > stage.right + 1) bad.push(`${el.tagName.toLowerCase()}.${String(el.className).replace(/\s+/g, '.')}: ${el.textContent.trim().slice(0, 40)}`);
  }
  return bad;
});

/** Asserts that an element lies wholly on the stage: nothing important may sit under the fold of a fixed screen. */
export async function expectOnStage(page, locator) {
  const stage = await page.locator('#stage').boundingBox(), box = await locator.boundingBox();
  expect(box, 'the element is laid out').not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(stage.x - 1);
  expect(box.y).toBeGreaterThanOrEqual(stage.y - 1);
  expect(box.x + box.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
}

/** Width and height from a PNG's header. */
export const pngSize = bytes => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];

/** Keeps a picture of the stage with the test's results when LIKENESS_SHOTS is set, for judging by eye. */
export async function shot(page, testInfo, name) {
  if (process.env.LIKENESS_SHOTS) await page.screenshot({ path: testInfo.outputPath(name + '.png') });
}

export const WORLD_NAMES = ['Neon Noir', 'Chiaroscuro', 'Studio Clay', 'Cinema 3D', 'Brick Miniature', 'Inked Cel', 'The Order'];
export const STAGES = ['Capture', 'Normalise', 'Face gate', 'Identity pack', 'Style recipe', 'Render', 'Refine', 'Verify', 'Deliver'];
