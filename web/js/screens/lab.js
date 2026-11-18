/** Behind the portrait: the studio's reasoning laid out like the back of a watch. */
import { h, icon, sheet } from '../core/dom.js';
import { go } from '../core/router.js';
import { WORLDS, worldById } from '../atelier/index.js';
import { SITTERS, sitterById } from '../atelier/sitters.js';
import { plate } from '../core/raster.js';
import { compare } from '../studio/develop.js';
import { simulatedTrace, specimenPoints } from '../studio/showcase.js';
import { bar } from './chrome.js';

/** @type {[string, string, number, boolean, boolean][]} */
const CHANNELS = [
  ['Pixels', 'The photograph as structure: pose, framing, the fall of the hair.', 0.5, false, true],
  ['Reference tokens', 'The photograph read by the model as something it can look back at while it paints.', 0.9, false, true],
  ['Face embedding', 'A signature of the face in 512 numbers. It steers the render, then checks it.', 0.72, false, true],
  ['Words', 'What can be named: hair, glasses, a beard, a smile.', 0.22, true, true],
];
const ms = v => (v >= 1000 ? (v / 1000).toFixed(1) + ' s' : Math.round(v) + ' ms');
const signed = v => (v > 0 ? '+' : '−') + Math.abs(v).toFixed(2);
let recipes = null;
const loadRecipes = () => (recipes ||= fetch('data/recipes.json').then(r => (r.ok ? r.json() : null)).catch(() => null));

/** A specimen sitting and plate for when the Lab is opened from the catalogue. */
async function specimen(sitter, worldId) {
  const [snap, made] = await Promise.all([plate(sitter, 'snapshot', 900), plate(sitter, worldId, 900)]);
  return {
    sitting: { id: 'house-' + sitter.id, source: 'house', sitter, before: { url: snap.url }, points: specimenPoints(sitter), readMs: 0 },
    portrait: { world: worldId, mode: 'showcase', url: made.url, provenance: { kind: 'study', label: 'Showcase study', detail: '' }, trace: { measured: { read: 0, draw: Math.round(made.ms) }, ...simulatedTrace(sitter.seed, worldId) } },
  };
}

export function lab(params = {}) {
  const cold = !params.portrait;
  let sitter = sitterById('kofi'), worldId = cold ? 'oil' : params.portrait.world, alive = true, run = 0;
  const content = h('div.lab__content');
  const el = h('section.screen.lab.paper', null, bar({ title: 'Behind the portrait' }), h('div.lab__scroll', null, content));

  function viewer(shots, start) {
    sheet(close => {
      const img = h('img.is-in', { src: shots[start][1], alt: shots[start][0] });
      const tabs = shots.map(([label, url], i) => h('button.chip', { 'aria-pressed': String(i === start), onclick: () => { img.src = url; tabs.forEach((t, j) => t.setAttribute('aria-pressed', String(i === j))); } }, label));
      return [h('span.mono.mono--soft', null, 'Same place, three pictures'), h('div.plate.viewer__plate', null, img), h('div.viewer__tabs', null, tabs), h('button.btn.btn--ink.btn--wide', { onclick: () => close() }, 'Close')];
    });
  }

  async function draw() {
    const mine = ++run, { sitting, portrait } = cold ? await specimen(sitter, worldId) : params;
    if (mine !== run || !alive) return;
    const world = worldById(portrait.world), own = sitting.source !== 'house', showcase = portrait.mode === 'showcase', trace = portrait.trace;
    const tri = h('div.tri'), verdict = h('div.lab__verdict'), drift = h('div.lab__drift'), proxy = portrait.measure === 'proxy', measure = proxy ? 'tone proxy' : 'face similarity';

    const cell = (label, url, score, sub) => h('figure.tri__cell', null, h('div.plate', null, url ? h('img.is-in', { src: url, alt: label }) : h('span.tri__wait.mono', null, 'not yet rendered')), h('figcaption', null, h('span.mono', null, label), score != null && h('b.num', null, score), sub && h('span.mono.mono--soft', null, sub)));
    const fill = result => {
      const shots = [['The sitting', sitting.before.url], ['Words only', result.naive.url], ['Identity-locked', result.locked.url]];
      const score = r => (result.kind === 'specimen' ? `${r.held}/${r.total}` : r.similarity != null ? r.similarity.toFixed(2) : '—'), unit = result.kind === 'specimen' ? 'measures held' : measure;
      tri.replaceChildren(cell('The sitting', sitting.before.url, null, own ? 'your photograph' : 'an ordinary snapshot'), cell('Words only', result.naive.url, score(result.naive), unit), cell('Identity-locked', result.locked.url, score(result.locked), unit));
      [...tri.children].forEach((c, i) => c.addEventListener('click', () => viewer(shots, i)));
      if (result.kind === 'specimen') {
        const n = result.naive, lost = [...n.drift.map(d => [d.label, signed(d.delta)]), ...(n.expression < 0.75 ? [['expression', 'stock smile']] : []), ...(n.smoothed ? [['years', 'smoothed away']] : [])];
        verdict.replaceChildren(h('p', null, `A prompt keeps what can be said aloud (${[result.words.hair, result.words.glasses, result.words.beard].join('; ')}) and re-rolls the rest. The face on the left of the pair is a stranger with ${own ? 'your' : 'the sitter’s'} haircut.`));
        drift.replaceChildren(h('span.mono.mono--soft', null, 'What words lost'), h('ul', null, lost.map(([k, v]) => h('li', null, h('span', null, k), h('b.num', null, v)))));
      } else {
        verdict.replaceChildren(h('p', null, proxy ? 'Both plates were made by the studio from the same sitting. No face model is installed there, so the score is only a proxy: how closely each plate’s tones follow the photograph. It shows that the photograph was used, not that the face was kept.' : 'Both plates were rendered by the studio from the same sitting. The score is the cosine similarity between the face embedding of each render and of your photograph: closer to 1 is closer to you.'));
        drift.replaceChildren();
      }
    };

    if (showcase) compare(sitting, portrait.world, portrait).then(r => { if (mine === run && alive) fill(r); });
    else {
      tri.append(cell('The sitting', sitting.before.url, null, 'your photograph'), cell('Words only', null, '—', measure), cell('Identity-locked', portrait.url, portrait.similarity != null ? portrait.similarity.toFixed(2) : '—', measure));
      const btn = h('button.btn.btn--ink.btn--wide', { onclick: async () => { btn.disabled = true; btn.textContent = 'Rendering the words-only plate…'; try { fill(await compare(sitting, portrait.world, portrait)); btn.remove(); } catch (e) { btn.disabled = false; btn.textContent = 'Try the comparison again'; } } }, 'Render the words-only plate to compare');
      verdict.append(h('p', null, 'The comparison needs a second render from the studio, made from the description alone.'), btn);
    }

    const total = trace.total || trace.stages.reduce((t, s) => t + s.ms, 0);
    let at = 0;
    const rows = trace.stages.map(s => { const left = at / total; at += s.ms; return h('li.fall__row', { 'data-stage': s.id }, h('span.mono', null, s.label), h('span.fall__track', null, h('i', { style: { left: left * 100 + '%', width: `max(.7cqw, ${s.ms / total * 100}%)` } })), h('b.num', null, ms(s.ms)), h('span.fall__note', null, s.note || '')); });

    const recipe = (await loadRecipes())?.worlds?.[portrait.world];
    if (mine !== run || !alive) return;
    const pick = (label, list, isOn, choose) => h('div.lab__pick', null, h('span.mono.mono--soft', null, label), h('div.lab__opts', null, list.map(x => h('button.chip', { 'aria-pressed': String(isOn(x)), onclick: () => choose(x) }, x.plate || x.caption.split(',')[0]))));

    content.replaceChildren(...[
      h('header.lab__head', null, h('h1.title', null, own ? 'Why it still looks like you.' : 'Why it still looks like them.'),
        h('p.lede', null, 'A face is not a description. The studio keeps yours by carrying the photograph itself through the render, not a sentence about it.')),
      cold && h('div.lab__picks', null, pick('Sitter', SITTERS, s => s === sitter, s => { sitter = s; draw(); }), pick('World', WORLDS, w => w.id === worldId, w => { worldId = w.id; draw(); })),
      h('section.lab__section', null, h('div.lab__label', null, h('span.mono', null, '01 · Side by side'), h('span.badge', { 'data-kind': showcase ? 'specimen' : 'measured' }, showcase ? 'Specimen' : 'Rendered')), tri, verdict, drift,
        showcase && h('p.lab__honest.mono', null, 'In this edition both plates are drawn by the atelier: one from the whole reading, one from only what a prompt can say. With the workstation the same comparison is two renders, scored by face embedding.')),
      h('section.lab__section', null, h('div.lab__label', null, h('span.mono', null, '02 · Four ways a face can travel')),
        h('ul.channels', null, CHANNELS.map(([name, text, cap, naive, locked]) => h('li', null, h('div', null, h('b', null, name), h('p.note', null, text)), h('span.channels__meter', null, h('i', { style: { width: cap * 100 + '%' } })), h('span.channels__use.mono', null, h('i', { 'data-on': String(naive) }), 'words only'), h('span.channels__use.mono', null, h('i', { 'data-on': String(locked) }), 'locked')))),
        h('p.note', null, 'The meter is how much of a likeness each channel can carry. Words carry the least, and they are all a plain prompt has.')),
      h('section.lab__section', null, h('div.lab__label', null, h('span.mono', null, '03 · The pipeline, stage by stage'), h('span.badge', { 'data-kind': trace.simulated ? 'simulated' : 'measured' }, trace.simulated ? 'Simulated' : 'Measured')),
        h('div.fall__head', null, h('b.num', null, ms(total)), h('span.mono.mono--soft', null, [trace.engine, trace.steps && trace.steps + ' steps', trace.seed != null && 'seed ' + trace.seed, trace.vram && trace.vram + ' GB peak'].filter(Boolean).join(' · '))),
        h('ol.fall', null, rows),
        h('p.lab__honest.mono', null, trace.simulated ? `Typical of this recipe on ${trace.device}. Not measured here: no workstation is connected.${trace.measured ? ` Measured on this device: read ${ms(trace.measured.read)}, drawn and fixed ${ms(trace.measured.draw)}.` : ''}` : `Measured by the studio on ${trace.device || 'the workstation'} for this plate.`)),
      recipe && h('section.lab__section', null, h('div.lab__label', null, h('span.mono', null, `04 · The recipe · ${world.name}`)),
        h('dl.recipe', null, [['Engine', recipe.locked.engine_label], ['Steps', recipe.locked.steps], ['Guidance', recipe.locked.guidance], ['Size', `${recipe.locked.width} × ${recipe.locked.height}`], ['Reference', recipe.locked.reference], ['Likeness floor', recipe.locked.identity_floor]].map(([k, v]) => h('div', null, h('dt.mono', null, k), h('dd.num', null, String(v))))),
        h('span.mono.mono--soft', null, 'Identity-locked instruction'), h('p.recipe__prompt', null, recipe.locked.prompt),
        h('span.mono.mono--soft', null, 'Words-only prompt'), h('p.recipe__prompt', null, recipe.naive.prompt)),
      h('footer.lab__foot', null, h('button.btn.btn--primary.btn--wide', { onclick: () => go('sitting', { world: portrait.world }) }, 'Begin a sitting', h('span.btn__icon', { html: icon('arrow') }))),
    ].filter(Boolean));
  }
  return { el, enter() { draw(); }, leave() { alive = false; } };
}
