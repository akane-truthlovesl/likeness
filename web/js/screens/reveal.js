/** The reveal: a print under tissue. Lift it, compare it with the sitting, keep it, or sit again in another world. */
import { clamp, h, icon, toast } from '../core/dom.js';
import { go } from '../core/router.js';
import { drag, spring } from '../core/motion.js';
import { WORLDS, worldById } from '../atelier/index.js';
import { sitterById } from '../atelier/sitters.js';
import { keepsake, longDate, printName } from '../core/keepsake.js';
import { develop as fade, plate } from '../core/raster.js';
import { editionNo } from '../core/store.js';
import { studio } from '../studio/studio.js';
import { SPECIMEN } from './catalogue.js';
import { bar } from './chrome.js';

/** @param {{ portrait?: any, sitting?: any, fresh?: boolean }} params */
export function reveal(params) {
  const { portrait, sitting, fresh = false } = params;
  if (!portrait || !sitting) return { el: h('section.screen.paper'), enter: () => go('catalogue', {}, { replace: true }) };
  const world = worldById(portrait.world);
  let wipe = 0, motion = null, holdTimer = 0, mode = '';
  const after = h('img.is-in', { src: portrait.url, alt: `The portrait: ${world.name}` }), beforeImg = h('img.reveal__before.is-in', { src: sitting.before.url, alt: 'The sitting' });
  const frame = h('div.plate.reveal__plate', { oncontextmenu: e => e.preventDefault() }, after, beforeImg, h('i.reveal__line'),
    h('span.reveal__tag.reveal__tag--before.mono', null, 'The sitting'), h('span.reveal__tag.reveal__tag--after.mono', null, `Plate ${world.plate}`));
  const setWipe = v => { wipe = clamp(v); frame.style.setProperty('--wipe', String(wipe)); frame.dataset.comparing = String(wipe > 0.02); };
  const settle = to => { motion?.stop(); motion = spring({ from: wipe, to, stiffness: 210, damping: 26, onUpdate: setWipe }); };

  drag(frame, {
    start: () => { if (frame.querySelector('.tissue')) return false; motion?.stop(); mode = ''; holdTimer = setTimeout(() => { mode = 'hold'; settle(1); }, 260); },
    move: d => {
      if (mode === 'hold') return;
      if (!mode && Math.abs(d.dx) > 7) { mode = 'wipe'; clearTimeout(holdTimer); }
      if (mode === 'wipe') { const r = frame.getBoundingClientRect(); setWipe((d.x - r.left) / r.width); }
    },
    end: () => { clearTimeout(holdTimer); settle(0); mode = ''; },
  });

  const el = h('section.screen.reveal.paper', null);
  const revealed = () => { el.classList.add('is-revealed'); };

  if (fresh) {
    const sheet = h('div.tissue', null, h('span.mono', null, `Plate ${world.plate}`), h('em.tissue__name', null, world.name), h('span.tissue__hint.mono', null, h('span', { html: icon('down') }), 'Lift the tissue'));
    frame.append(sheet);
    let y = 0, flight = null;
    const place = v => { y = v; sheet.style.transform = `translateY(${v}px) rotate(${v * -0.008}deg)`; sheet.style.setProperty('--lift', String(clamp(-v / 300))); };
    const lift = velocity => { params.fresh = false; const hgt = sheet.getBoundingClientRect().height; flight?.stop(); flight = spring({ from: y, to: -hgt * 1.3, velocity, stiffness: 70, damping: 17, precision: 0.5, onUpdate: place, onRest: () => { sheet.remove(); } }); setTimeout(revealed, 260); };
    drag(sheet, {
      start: e => { e.stopPropagation(); flight?.stop(); },
      move: d => place(d.dy < 0 ? d.dy : d.dy * 0.18),
      end: d => { const hgt = sheet.getBoundingClientRect().height; if (d.dy < -hgt * 0.2 || d.vy < -520 || (Math.abs(d.dy) < 6 && d.ms < 350)) lift(Math.min(d.vy, -900)); else flight = spring({ from: y, to: 0, velocity: d.vy, stiffness: 260, damping: 24, precision: 0.5, onUpdate: place }); },
    });
  }

  async function print() { return new File([await keepsake(portrait)], printName(portrait), { type: 'image/png' }); }
  function download(file) { const a = h('a', { href: URL.createObjectURL(file), download: file.name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function save(e) { const btn = e.currentTarget; btn.disabled = true; try { download(await print()); toast('The print is saved'); } catch { toast('The print could not be made'); } btn.disabled = false; }
  async function share(e) {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const file = await print();
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Likeness', text: `${world.name}, ${editionNo(portrait.edition)}` });
      else { download(file); toast('No share sheet here. Saved instead'); }
    } catch (err) { if (err?.name !== 'AbortError') toast('Sharing did not go through'); }
    btn.disabled = false;
  }

  const remix = WORLDS.map(w => {
    const img = h('img', { alt: '' }), subject = studio.live && sitting.source !== 'house' ? sitterById(SPECIMEN[w.id]) : sitting.sitter;
    plate(subject, w.id, 240).then(p => fade(img, p.url));
    return h('button.remix__item', { 'aria-label': `Develop in ${w.name}`, 'aria-current': String(w.id === world.id), onclick: () => w.id !== world.id && go('developing', { sitting, world: w.id }, { replace: true }) }, h('div.plate', null, img), h('span.mono', null, w.plate));
  });

  el.append(
    bar({ title: `Plate ${world.plate}`, side: [h('button.icon-btn', { onclick: () => go('drawer'), 'aria-label': 'The drawer', html: icon('drawer') })] }),
    h('div.reveal__body', null,
      h('div.reveal__stage', null, frame),
      h('p.mono.mono--soft.reveal__hint', null, 'Drag across to compare · hold for the sitting'),
      h('div.reveal__caption', null,
        h('div.reveal__row', null, h('h2.title', null, world.name), h('span.stamp', { 'data-kind': portrait.provenance.kind }, portrait.provenance.kind === 'study' ? 'Study' : 'Render')),
        h('p.mono', null, `${editionNo(portrait.edition)} · ${longDate(portrait.createdAt)}`),
        h('p.mono.mono--soft', null, `${portrait.provenance.label} · ${portrait.provenance.detail}`)),
      h('div.reveal__actions', null,
        h('button.btn.btn--ink', { onclick: save }, h('span.btn__icon', { html: icon('save') }), 'Keep'),
        h('button.btn.btn--quiet', { onclick: share }, h('span.btn__icon', { html: icon('share') }), 'Share'),
        h('button.btn.btn--quiet', { onclick: () => go('lab', { portrait, sitting }) }, h('span.btn__icon', { html: icon('loupe') }), 'Behind it')),
      h('div.remix', null, h('span.mono.mono--soft', null, 'Remix · the same sitting, another world'), h('div.remix__row', null, remix))));

  return { el, enter() { setWipe(0); if (!fresh) revealed(); } };
}
