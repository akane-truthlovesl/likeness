#!/usr/bin/env node
/**
 * Contact sheet: draws sitters × worlds with the atelier and photographs the result,
 * so the portraits can be judged by eye.
 *   node tools/sheet.mjs --sitters ines,kofi --worlds snapshot,noir,oil --cell 300 --out sheet.png [--naive]
 *
 * With --plates it writes one JPEG per sitter and world instead (900 × 1200), which is how the
 * synthetic photographs in tests/fixtures/sitters are made: drawn people, so no real face is ever committed.
 *   node tools/sheet.mjs --plates tests/fixtures/sitters --worlds snapshot
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { SITTERS, drift, sitterById } from '../web/js/atelier/sitters.js';
import { WORLDS, portrait } from '../web/js/atelier/index.js';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const sitters = arg('sitters', SITTERS.map(s => s.id).join(',')).split(',').map(sitterById);
const plates = arg('plates', '');
const worlds = arg('worlds', plates ? 'snapshot' : ['snapshot', ...WORLDS.map(w => w.id)].join(',')).split(',');
const cell = Number(arg('cell', '240')), out = arg('out', 'sheet.png'), naive = process.argv.includes('--naive');
const draw = (s, w, uid) => portrait(naive && w !== 'snapshot' ? drift(s) : s, w, uid);

const browser = await chromium.launch({ channel: 'chrome' });
const problems = [], t0 = Date.now();
const watch = page => { page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') problems.push(m.text()); }); page.on('pageerror', e => problems.push(String(e))); };

if (plates) {
  mkdirSync(plates, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  watch(page);
  const written = [];
  for (const s of sitters) for (const w of worlds) {
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0}svg{display:block}</style>${draw(s, w, 'p_')}`, { waitUntil: 'load' });
    const path = join(plates, worlds.length > 1 ? `${s.id}-${w}.jpg` : `${s.id}.jpg`);
    await page.screenshot({ path, type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 900, height: 1200 } });
    written.push(path);
  }
  await browser.close();
  console.log(JSON.stringify({ plates: written, ms: Date.now() - t0, problems }));
} else {
  const cells = sitters.flatMap((s, i) => worlds.map((w, j) => draw(s, w, `s${i}w${j}_`)));
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#1b1a19}
main{display:grid;grid-template-columns:repeat(${worlds.length},${cell}px);gap:6px;padding:6px;width:max-content}
svg{width:${cell}px;height:${Math.round(cell * 4 / 3)}px;display:block}</style><main>${cells.join('')}</main>`;
  const page = await browser.newPage({ viewport: { width: worlds.length * (cell + 6) + 6, height: 600 } });
  watch(page);
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log(JSON.stringify({ out, cells: cells.length, ms: Date.now() - t0, bytes: html.length, problems }));
}
