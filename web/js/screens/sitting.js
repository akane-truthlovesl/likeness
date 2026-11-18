/** The sitting: a viewfinder that helps you compose yourself, then a quiet moment to review what was read. */
import { clamp, h, icon, sheet } from '../core/dom.js';
import { go } from '../core/router.js';
import { WORLDS, worldById } from '../atelier/index.js';
import { BEARDS, GLASSES, HAIR_COLOURS, HAIR_STYLES, SITTERS, SKIN_TONES, anonymous, describe, sitterById } from '../atelier/sitters.js';
import { develop as fade, plate } from '../core/raster.js';
import { saveSitting } from '../core/store.js';
import { loadReader, read, watch } from '../studio/reading.js';
import { specimenPoints } from '../studio/showcase.js';
import { studio } from '../studio/studio.js';
import { SPECIMEN } from './catalogue.js';
import { arrow, bar } from './chrome.js';

const GUIDE = `<svg viewBox="0 0 300 400" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
<path d="M14 40V14h26M260 14h26v26M286 360v26h-26M40 386H14v-26" stroke-width="1.4"/>
<ellipse class="vf__oval" cx="150" cy="168" rx="64" ry="84" stroke-dasharray="2 5"/>
<path class="vf__oval" d="M36 400c0-74 52-108 114-108s114 34 114 108" stroke-dasharray="2 5"/>
<path d="M150 8v10M150 382v10M8 200h10M282 200h10" opacity=".6"/><g class="vf__level"><path d="M126 372h48" stroke-width="1.4"/></g></svg>`;

const canvasOf = (w, hgt) => { const c = document.createElement('canvas'); c.width = w; c.height = hgt; return c; };
const toBlob = canvas => new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
const cycle = (list, value) => list[(list.indexOf(value) + 1) % list.length];

/** @param {{ world?: string }} [params] */
export function sitting({ world: preferred } = {}) {
  let stream = null, stopWatch = null, current = null, worldId = worldById(preferred) ? preferred : 'clay', alive = true, thumbRun = 0, noticeUntil = 0;

  const video = h('video.vf__video', { playsInline: true, muted: true, autoplay: true }), still = h('img.vf__still', { alt: 'The photograph for this sitting' });
  const readout = label => { const v = h('b', null, '—'); return { el: h('span.vf__readout.mono', null, label, v), set: t => { v.textContent = t; } }; };
  const ro = { face: readout('Face'), light: readout('Light'), frame: readout('Frame'), level: readout('Level') };
  const empty = h('div.vf__empty', null, h('p.title', null, 'No camera here.'), h('p.note', null, 'This page cannot open the camera: it needs permission, and a secure address. Take or choose a photograph instead, or borrow a house sitter.'));
  const guide = h('div.vf__guide', { html: GUIDE });
  const vf = h('div.vf', null, video, still, guide, h('div.vf__readouts', null, ro.face.el, ro.light.el, ro.frame.el, ro.level.el), empty, h('i.vf__curtain'), h('i.vf__curtain'));
  const cue = h('p.lede.sit__cue', { 'aria-live': 'polite' }, 'Chin level. Look just past the lens.');
  const picker = h('input.sr', { type: 'file', accept: 'image/*', capture: 'user', onchange: e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) fromFile(f); } });
  const shutter = h('button.shutter', { onclick: capture, 'aria-label': 'Take the photograph' }, h('i'));
  const controls = h('div.sit__controls', null,
    h('button.sit__side', { onclick: () => picker.click() }, h('span', { html: icon('upload') }), h('span.mono', null, 'Photograph')),
    shutter,
    h('button.sit__side', { onclick: borrow }, h('span', { html: icon('sitter') }), h('span.mono', null, 'House sitter')), picker);

  // Review: what was read, to correct; then the world to be developed in.
  const words = h('ul.review__words'), chips = h('div.review__chips'), strip = h('div.strip', { role: 'listbox', 'aria-label': 'Worlds' });
  const source = h('span.mono.mono--soft', null, ''), status = h('p.mono.mono--soft.review__status', null, '');
  const developBtn = h('button.btn.btn--primary.btn--wide', { onclick: () => current && go('developing', { sitting: current, world: worldId }) }, h('span.review__cta', null, ''), arrow());
  const review = h('div.review', null,
    h('div.review__reading', null, source, words, status, h('button.link.review__retake', { onclick: retake }, h('span.link__icon', { html: icon('retake') }), 'Another photograph')),
    chips,
    h('div.review__worlds', null, h('span.mono.mono--soft', null, 'Choose a world'), strip),
    developBtn);
  const items = WORLDS.map(w => {
    const img = h('img', { alt: '' });
    const el = h('button.strip__item', { role: 'option', onclick: () => choose(w.id) }, h('div.plate', null, img), h('span.mono', null, w.plate), h('span.strip__name', null, w.name));
    return { w, el, img };
  });
  strip.append(...items.map(i => i.el));

  const el = h('section.screen.sit.night', { 'data-state': 'frame', 'data-camera': 'wait' }, bar({ title: 'The sitting' }), h('div.sit__body', null, vf, cue, controls, review));

  function choose(id) {
    worldId = id;
    items.forEach(i => i.el.setAttribute('aria-selected', String(i.w.id === id)));
    developBtn.firstChild.textContent = `Develop in ${worldById(id).name}`;
  }

  async function thumbs() {
    const run = ++thumbRun, mine = current;
    for (const i of items) {
      const subject = studio.live && mine.source !== 'house' ? sitterById(SPECIMEN[i.w.id]) : mine.sitter;
      const { url } = await plate(subject, i.w.id, 240);
      if (run !== thumbRun || !alive) return;
      fade(i.img, url);
    }
  }

  function describeSitting() {
    const s = current.sitter, d = describe(s), own = current.source !== 'house';
    words.replaceChildren(...[d.skin, d.hair, d.glasses, d.beard, d.expression].map(t => h('li', null, t)));
    const chip = (label, value, next) => h('button.chip', { onclick: () => { current.sitter = next(current.sitter); current.edited = true; describeSitting(); thumbs(); saveSitting(current); } }, h('small', null, label), value);
    const swatch = colour => h('i.chip__dot', { style: { background: colour } });
    chips.replaceChildren(...(own ? [
      chip('Hair', s.hair.style, t => ({ ...t, hair: { ...t.hair, style: cycle(HAIR_STYLES, t.hair.style) } })),
      chip('Colour', swatch(s.hair.grey > 0.5 ? '#c9c6c0' : s.hair.color), t => { const i = (HAIR_COLOURS.findIndex(([c, g]) => c === t.hair.color && g === t.hair.grey) + 1) % HAIR_COLOURS.length; return { ...t, hair: { ...t.hair, color: HAIR_COLOURS[i][0], grey: HAIR_COLOURS[i][1] } }; }),
      chip('Skin', swatch(s.skin), t => ({ ...t, skin: cycle(SKIN_TONES, t.skin) })),
      chip('Glasses', s.glasses, t => ({ ...t, glasses: cycle(GLASSES, t.glasses) })),
      chip('Beard', s.beard, t => ({ ...t, beard: cycle(BEARDS, t.beard) })),
    ] : []));
  }

  /** Seats a sitting and turns the screen to the review. */
  function seat(next, note) {
    current = next;
    source.textContent = next.source === 'house' ? 'House sitter' : studio.live ? 'The reading · sent as notes' : 'The reading · tap to correct';
    status.textContent = note;
    el.dataset.state = 'review';
    cue.textContent = next.source === 'house' ? next.sitter.caption : 'Is this how you would like to be seen?';
    describeSitting(); choose(worldId); thumbs(); saveSitting(next);
    requestAnimationFrame(() => items.find(i => i.w.id === worldId)?.el.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }

  /** Reads a 900 × 1200 canvas and seats whatever could be learned from it. */
  async function readAndSeat(canvas, origin) {
    const blob = await toBlob(canvas), url = URL.createObjectURL(blob);
    still.src = url; el.dataset.state = 'reading'; cue.textContent = 'Reading the face…';
    closeCamera();
    let reading = null, note = '';
    try { reading = await read(canvas); note = reading ? `Read on this device in ${Math.round(reading.ms)} ms. Nothing was sent.` : 'No face was found. Describe the sitter below, or take another.'; }
    catch { note = 'The reader could not start here. Describe the sitter below.'; }
    if (!alive) return;
    seat({ id: 's-' + Date.now().toString(36), source: origin, createdAt: Date.now(), sitter: reading?.sitter || anonymous(), before: { url, blob }, points: reading?.points || [], readMs: reading?.ms || 0, unread: !reading }, note);
  }

  async function capture() {
    if (!video.videoWidth) return;
    el.classList.add('is-firing');
    setTimeout(() => el.classList.remove('is-firing'), 520);
    await new Promise(r => setTimeout(r, 170));
    const vw = video.videoWidth, vh = video.videoHeight, cw = Math.min(vw, vh * 0.75), ch = cw / 0.75, canvas = canvasOf(900, 1200);
    canvas.getContext('2d', { willReadFrequently: true }).drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, 900, 1200);
    readAndSeat(canvas, 'camera');
  }

  /** A chosen photograph is framed around its face before it is read, so any snapshot will do. */
  async function fromFile(file) {
    el.dataset.state = 'reading'; cue.textContent = 'Reading the face…';
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
      const work = canvasOf(Math.round(bmp.width * k), Math.round(bmp.height * k));
      work.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, work.width, work.height);
      const first = await read(work).catch(() => null), W = work.width, H = work.height;
      let cw = Math.min(W, H * 0.75), cx = W / 2, cy = H / 2;
      if (first) { cw = clamp(first.frame.size * W / 0.46, 80, cw); cx = (first.frame.x + 0.5) * W; cy = (first.frame.y + 0.42) * H + cw / 0.75 * 0.08; }
      const ch = cw / 0.75, x = clamp(cx - cw / 2, 0, W - cw), y = clamp(cy - ch / 2, 0, H - ch), canvas = canvasOf(900, 1200);
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(work, x, y, cw, ch, 0, 0, 900, 1200);
      await readAndSeat(canvas, 'upload');
    } catch {
      el.dataset.state = 'frame'; cue.textContent = 'That file could not be opened as a photograph.'; noticeUntil = performance.now() + 4200;
    }
  }

  async function borrow() {
    const chosen = await sheet(close => [
      h('span.mono.mono--soft', null, 'House sitters'), h('h2', null, 'Borrow a face.'),
      h('p.note', null, 'Six fictional sitters, each caught in an ordinary snapshot. Their plates are showcase studies in every edition.'),
      h('div.sitters', null, SITTERS.map(s => { const img = h('img', { alt: '' }); plate(s, 'snapshot', 240).then(p => fade(img, p.url)); return h('button.sitters__item', { onclick: () => close(s) }, h('div.plate', null, img), h('span', null, s.caption)); })),
    ], { theme: 'night' });
    if (!chosen || !alive) return;
    const { url } = await plate(chosen, 'snapshot', 900);
    still.src = url; closeCamera();
    seat({ id: 'house-' + chosen.id, source: 'house', createdAt: Date.now(), sitter: chosen, before: { url }, points: specimenPoints(chosen), readMs: 0 }, chosen.note);
  }

  function retake() { current = null; el.dataset.state = 'frame'; cue.textContent = 'Chin level. Look just past the lens.'; openCamera(); }

  function onCue(c) {
    if (el.dataset.state !== 'frame') return;
    if (c.cue && performance.now() > noticeUntil) cue.textContent = c.cue;
    vf.dataset.ok = String(c.ok);
    ro.face.set(c.face); ro.frame.set(c.frame ? Math.round(c.frame.size * 100) + '%' : '—');
    ro.level.set(c.frame ? (c.frame.roll > 0 ? '+' : '') + c.frame.roll.toFixed(0) + '°' : '—');
    ro.light.set(c.frame ? (c.frame.light < 0.26 ? 'low' : c.frame.light > 0.9 ? 'hot' : 'even') : '—');
    guide.style.setProperty('--roll', (c.frame?.roll || 0) + 'deg');
  }

  async function openCamera() {
    if (stream || !alive) return;
    if (!navigator.mediaDevices?.getUserMedia) { el.dataset.camera = 'none'; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } });
      if (!alive || el.dataset.state !== 'frame') return closeCamera();
      video.srcObject = stream; await video.play().catch(() => {});
      el.dataset.camera = 'on'; ro.face.set('warming');
      loadReader().then(() => { if (stream && alive) stopWatch = watch(video, onCue); }).catch(() => ro.face.set('unread'));
    } catch { el.dataset.camera = 'none'; }
  }
  function closeCamera() { stopWatch?.(); stopWatch = null; stream?.getTracks().forEach(t => t.stop()); stream = null; video.srcObject = null; }

  return { el, enter() { openCamera(); loadReader().catch(() => {}); }, leave() { alive = false; closeCamera(); } };
}
