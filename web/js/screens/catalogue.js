/** The catalogue: a cover, seven world plates and a colophon, turned like the pages of a monograph. */
import { h, icon } from '../core/dom.js';
import { go } from '../core/router.js';
import { WORLDS } from '../atelier/index.js';
import { SITTERS, sitterById } from '../atelier/sitters.js';
import { develop, plate } from '../core/raster.js';
import { studio } from '../studio/studio.js';
import { arrow, bar, pill, worldTheme } from './chrome.js';

/** The house sitter each world is first shown with. */
export const SPECIMEN = { noir: 'tomas', oil: 'kofi', clay: 'ines', cinema: 'mei', brick: 'lena', cel: 'mei', knight: 'ruth' };

let lastPage = 0;

export function catalogue() {
  const scroll = h('div.catalogue__scroll'), timers = [];
  const index = h('nav.catalogue__index', { 'aria-label': 'Plates' });
  const pages = [cover(), ...WORLDS.map(worldPage), colophon()];
  scroll.append(...pages.map(p => p.el));
  const marks = pages.map((p, i) => h('button', { onclick: () => p.el.scrollIntoView({ behavior: 'smooth' }), 'aria-label': p.label }, i === 0 || i === pages.length - 1 ? '·' : WORLDS[i - 1].plate));
  index.append(...marks);

  const seen = new IntersectionObserver(entries => {
    for (const e of entries) {
      const i = pages.findIndex(p => p.el === e.target);
      if (e.isIntersecting) pages[i].load?.();
      if (e.intersectionRatio > 0.6) {
        lastPage = i;
        marks.forEach((m, j) => m.setAttribute('aria-current', String(j === i)));
        const cs = getComputedStyle(pages[i].el);
        index.style.color = cs.color;
        pages.forEach((p, j) => (j === i ? p.wake?.() : p.rest?.()));
      }
    }
  }, { root: scroll, threshold: [0.05, 0.6] });

  function cover() {
    const sitter = sitterById('ines'), order = ['clay', 'noir', 'cinema', 'oil', 'cel', 'knight', 'brick'];
    const a = h('img', { alt: '' }), b = h('img', { alt: '' }), snap = h('img', { alt: 'An ordinary snapshot of the sitter' });
    const caption = h('span.mono', null, ' '), count = h('span.mono.mono--soft', null, ' ');
    let turn = 0, front = a, timer = 0;
    const show = async () => {
      const world = WORLDS.find(w => w.id === order[turn % order.length]), { url } = await plate(sitter, world.id, 720);
      const next = front === a ? b : a;
      await develop(next, url); front.classList.remove('is-in'); front = next;
      caption.textContent = `Plate ${world.plate} — ${world.name}`; count.textContent = `${world.plate} / VII`;
    };
    const el = h('article.page.cover.paper', null,
      bar({ mark: true, side: [h('button.icon-btn', { onclick: () => go('drawer'), 'aria-label': 'The drawer', html: icon('drawer') })] }),
      h('div.cover__head', null, h('h1.display', { html: 'Seven studios.<br><em>One face.</em>' }),
        h('p.lede', null, 'Sit once. Be painted in neon, in oil, in clay, in ink, in brick.')),
      h('div.cover__hero', null, h('div.plate.cover__plate', null, a, b),
        h('figure.cover__snap', null, h('div.plate', null, snap), h('figcaption.mono', null, 'The sitter'))),
      h('div.cover__caption', null, caption, count),
      h('div.cover__foot', null,
        h('button.btn.btn--primary.btn--wide', { onclick: () => go('sitting') }, 'Begin a sitting', arrow()),
        h('button.link', { onclick: () => pages[1].el.scrollIntoView({ behavior: 'smooth' }) }, 'The catalogue', h('span.link__icon', { html: icon('down') }))));
    return {
      el, label: 'Cover',
      load: once(async () => { develop(snap, (await plate(sitter, 'snapshot', 360)).url); await show(); }),
      wake() { clearInterval(timer); timer = setInterval(() => { turn++; show(); }, 3600); timers.push(timer); },
      rest() { clearInterval(timer); },
    };
  }

  function worldPage(world) {
    let sitter = sitterById(SPECIMEN[world.id]);
    const img = h('img', { alt: `${world.name}: a specimen portrait` }), before = h('img.world__before', { alt: '' });
    const who = h('span.mono.mono--soft', null, sitter.caption);
    const dots = SITTERS.map(s => h('button.dot', { 'aria-label': s.caption, 'aria-pressed': String(s === sitter), onclick: () => choose(s) }));
    const load = async () => {
      const mine = sitter, [p, s] = await Promise.all([plate(mine, world.id, 720), plate(mine, 'snapshot', 720)]);
      if (mine !== sitter) return;
      develop(img, p.url); before.src = s.url;
    };
    function choose(s) {
      sitter = s; who.textContent = s.caption;
      dots.forEach((d, i) => d.setAttribute('aria-pressed', String(SITTERS[i] === s)));
      img.classList.remove('is-in'); load();
    }
    const held = on => () => before.classList.toggle('is-in', on);
    const frame = h('div.plate.world__plate', { onpointerdown: held(true), onpointerup: held(false), onpointerleave: held(false), onpointercancel: held(false), oncontextmenu: e => e.preventDefault() }, img, before,
      h('span.world__hold.mono', null, 'Hold: the sitter'));
    const el = h('article.page.world', { style: worldTheme(world), 'data-world': world.id },
      h('header.bar', null, h('span.mono', null, `Plate ${world.plate} of VII`), h('div.bar__side', null, pill())),
      h('div.world__head', null, h('h2.title', null, world.name), h('p.lede', null, world.line)),
      h('div.world__stage', null, frame),
      h('div.world__under', null, h('div.dots', { role: 'group', 'aria-label': 'House sitters' }, dots), who),
      h('dl.world__facts', null, h('div', null, h('dt.mono', null, 'Light'), h('dd', null, world.light)), h('div', null, h('dt.mono', null, 'Medium'), h('dd', null, world.medium))),
      h('p.note.world__note', null, world.note),
      h('button.btn.btn--primary.btn--wide', { onclick: () => go('sitting', { world: world.id }) }, `Sit for ${world.name}`, arrow()));
    return { el, label: `Plate ${world.plate}, ${world.name}`, load: once(load) };
  }

  function colophon() {
    const el = h('article.page.colophon.paper', null,
      h('header.bar', null, h('span.mono', null, 'Colophon'), h('div.bar__side', null, pill())),
      h('h2.title', null, 'How the plates are made'),
      h('div.colophon__cols', null,
        h('section', null, h('h3.mono', null, studio.live ? 'Without the workstation' : 'In this edition'),
          h('p', null, 'Every plate is drawn on the device by the atelier, a small procedural portrait engine. The six sitters are fictional. When you sit, your face is read on the device and never leaves it; what you receive is a study drawn from that reading.')),
        h('section', null, h('h3.mono', null, studio.live ? 'In this edition' : 'With the workstation'),
          h('p', null, 'The same app, served from your own GPU. Your photograph is carried through an identity-locked edit model, checked against your face, and returned as a finished render in about fifteen seconds.'))),
      h('div.colophon__links', null,
        h('button.btn.btn--ink.btn--wide', { onclick: () => go('lab') }, 'Behind the portrait', arrow()),
        h('button.btn.btn--quiet.btn--wide', { onclick: () => go('drawer') }, 'The drawer: your sittings')),
      h('p.mono.mono--soft.colophon__small', null, 'Set in Fraunces and IBM Plex Mono. Faces read with MediaPipe. Edition 0.1, made for one phone and one laptop.'));
    return { el, label: 'Colophon' };
  }

  const el = h('section.screen.catalogue.paper', null, scroll, index);
  return {
    el,
    enter() { pages.forEach(p => seen.observe(p.el)); if (lastPage) requestAnimationFrame(() => { scroll.scrollTop = lastPage * scroll.clientHeight; }); },
    leave() { seen.disconnect(); timers.forEach(clearInterval); },
  };
}

const once = fn => { let done = false; return (...a) => { if (!done) { done = true; return fn(...a); } }; };
