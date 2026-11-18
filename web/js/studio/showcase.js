/**
 * The showcase studio: everything the workstation would do, done honestly at the scale of a phone.
 * The plate is drawn by the atelier from the sitter's reading; the beats are real pauses around real work,
 * and anything that is simulated says so.
 */
import { framing, worldById } from '../atelier/index.js';
import { build, rng } from '../atelier/geometry.js';
import { describe, drift, likeness } from '../atelier/sitters.js';
import { sleep } from '../core/dom.js';
import { plate } from '../core/raster.js';
import { nextEdition } from '../core/store.js';

/** A constellation for a house sitter, registered to their snapshot (0–1 of the plate). */
export function specimenPoints(sitter) {
  const g = build(sitter), m = g.m, f = framing(sitter), a = sitter.expr.tilt * 5 * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const tilt = p => [m.cx + (p[0] - m.cx) * cos - (p[1] - m.chin) * sin, m.chin + (p[0] - m.cx) * sin + (p[1] - m.chin) * cos];
  const pts = [[m.cx, m.top], [m.cx - m.hw * 0.72, m.top + 60], [m.cx + m.hw * 0.72, m.top + 60], [m.cx - m.hw, m.eyeY - 30], [m.cx + m.hw, m.eyeY - 30], [m.cx - m.hw * 0.98, m.eyeY + 60], [m.cx + m.hw * 0.98, m.eyeY + 60],
    [m.cx - m.jw, m.jawY], [m.cx + m.jw, m.jawY], [m.cx - m.jw * 0.62, m.chin - 34], [m.cx + m.jw * 0.62, m.chin - 34], [m.cx, m.chin], [m.cx, m.eyeY + 8], [g.nose.x, g.nose.y - 30], [g.nose.x, g.nose.y],
    [g.nose.x - g.nose.w, g.nose.y - 6], [g.nose.x + g.nose.w, g.nose.y - 6], [g.mouth.x - g.mouth.w, g.mouth.cornerY], [g.mouth.x + g.mouth.w, g.mouth.cornerY], [g.mouth.x, g.mouth.dip], [g.mouth.x, g.mouth.dip + g.mouth.full * 2 + g.mouth.gap + 8]];
  for (const e of g.eyes) pts.push([e.x, e.y], [e.x - e.a, e.y], [e.x + e.a, e.y], [e.x, e.y - e.b], [e.x, e.y + e.b], [e.x - e.a * 1.1, e.y - e.b - 24], [e.x, e.y - e.b - 34], [e.x + e.a * 1.1, e.y - e.b - 24]);
  return pts.map(p => f.map(tilt(p))).map(([x, y]) => [x / 900, y / 1200]);
}

/** What the workstation's trace typically looks like for this recipe. Simulated, and labelled so wherever it is shown. */
export function simulatedTrace(seed, worldId) {
  const r = rng((seed ^ 0x7f4a7c15) >>> 0), j = (ms, spread = 0.18) => Math.round(ms * (1 + (r() - 0.5) * spread)), steps = 8;
  const st = (id, label, ms, note) => ({ id, label, ms, note });
  const stages = [
    st('capture', 'Capture', j(140), 'photograph received'), st('normalise', 'Normalise', j(46), 'upright, 3:4, 960 × 1280'), st('gate', 'Face gate', j(58), 'one face, well framed'),
    st('identity', 'Identity pack', j(132), 'face embedding and the reading kept'), st('recipe', 'Style recipe', j(9), worldById(worldId).name + ', locked'), st('render', 'Render', j(steps * 1060, 0.1), steps + ' steps, 896 × 1200'),
    st('refine', 'Refine', j(3), 'face detail pass: off in this recipe'), st('verify', 'Verify', j(92), 'face similarity against the sitting'), st('deliver', 'Deliver', j(64), 'plate written'),
  ];
  return { simulated: true, engine: 'qwen-image-2.1-turbo', device: 'RTX 5090 Laptop GPU · 24 GB', steps, seed: seed % 100000, vram: (20.6 + r() * 1.6).toFixed(1), total: stages.reduce((t, s) => t + s.ms, 0), stages };
}

/**
 * Develops a sitting in a world. Yields the same events a live studio streams:
 * beat, log, preview, step and finally done with the portrait.
 */
export async function* develop(sitting, worldId, recipe = 'locked') {
  const world = worldById(worldId), subject = recipe === 'naive' ? drift(sitting.sitter) : sitting.sitter, words = describe(sitting.sitter);
  const work = plate(subject, worldId, 900);
  work.catch(() => {});
  yield { type: 'beat', beat: 0 };
  for (const [text, ms] of [['face found, framed and levelled', 560], ['thirteen measures taken from the face', 560], [`${words.hair} · ${words.glasses}`, 520], [words.expression, 460]]) { yield { type: 'log', text }; await sleep(ms); }
  yield { type: 'beat', beat: 1 };
  for (const [text, ms] of [[`light: ${world.light.toLowerCase()}`, 600], [`medium: ${world.medium.toLowerCase()}`, 600], [recipe === 'naive' ? 'conditioning: words only' : 'conditioning: identity-locked', 560]]) { yield { type: 'log', text }; await sleep(ms); }
  yield { type: 'beat', beat: 2 };
  const made = await work;
  yield { type: 'preview', url: made.url };
  for (let i = 1; i <= 8; i++) { yield { type: 'step', i, n: 8 }; await sleep(i === 8 ? 420 : 235); }
  yield { type: 'log', text: 'plate fixed' };
  const seconds = Math.max(0.1, made.ms / 1000).toFixed(1);
  yield {
    type: 'done',
    portrait: {
      id: 'p-' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), sittingId: sitting.id, world: worldId, recipe, mode: 'showcase', edition: recipe === 'locked' ? nextEdition() : 0,
      createdAt: Date.now(), url: made.url, blob: made.blob,
      provenance: { kind: 'study', label: 'Showcase study', engine: 'atelier', detail: `drawn on this device in ${seconds} s` },
      trace: { measured: { read: Math.round(sitting.readMs || 0), draw: Math.round(made.ms) }, ...simulatedTrace(sitting.sitter.seed, worldId) },
    },
  };
}

/** The Lab's specimen: the same sitter drawn from the full reading, and from only what a prompt can say. */
export async function compare(sitting, worldId, width = 600) {
  const naive = drift(sitting.sitter), [locked, loose] = await Promise.all([plate(sitting.sitter, worldId, width), plate(naive, worldId, width)]);
  return { kind: 'specimen', locked: { url: locked.url, ...likeness(sitting.sitter, sitting.sitter) }, naive: { url: loose.url, ...likeness(sitting.sitter, naive) }, words: describe(sitting.sitter) };
}
