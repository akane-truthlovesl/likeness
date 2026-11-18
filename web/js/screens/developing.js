/** Developing: three beats of studio work, each with something true to look at. Never a loading bar. */
import { h, icon, sleep } from '../core/dom.js';
import { back, go } from '../core/router.js';
import { worldById } from '../atelier/index.js';
import { savePortrait } from '../core/store.js';
import { develop } from '../studio/develop.js';
import { studio } from '../studio/studio.js';
import { pill } from './chrome.js';

const BEATS = ['Reading facial character', 'Composing light and medium', 'Refining fine detail'];
const LOUPE_PATH = [[0.4, 0.43], [0.6, 0.43], [0.5, 0.6], [0.5, 0.3], [0.5, 0.46]];

/** The landmarks as a constellation: each star joined to its two nearest neighbours. */
function constellation(points) {
  if (!points?.length) return '<svg viewBox="0 0 300 400"><path class="dev__sweep" d="M20 0H280"/></svg>';
  const p = points.map(([x, y]) => [x * 300, y * 400]), lines = new Set();
  p.forEach((a, i) => p.map((b, j) => [Math.hypot(a[0] - b[0], a[1] - b[1]), j]).filter(([, j]) => j !== i).sort((x, y) => x[0] - y[0]).slice(0, 2).forEach(([, j]) => lines.add(i < j ? i + '-' + j : j + '-' + i)));
  return `<svg viewBox="0 0 300 400" fill="none"><g class="dev__lines">${[...lines].map((k, n) => { const [i, j] = k.split('-').map(Number); return `<path d="M${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)}L${p[j][0].toFixed(1)} ${p[j][1].toFixed(1)}" style="animation-delay:${500 + n * 9}ms"/>`; }).join('')}</g>
<g class="dev__dots">${p.map(([x, y], n) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" style="animation-delay:${n * 14}ms"/>`).join('')}</g></svg>`;
}

/** The lighting plan, seen from above: sitter in the middle, camera at the foot, each lamp where the world puts it. */
function plan(world) {
  const cx = 150, cy = 186, lamps = world.lights.map(([name, x, y, colour], i) => {
    const lx = cx + x * 112, ly = cy + y * 132, a = Math.atan2(cy - ly, cx - lx), left = lx < cx - 20, mid = Math.abs(lx - cx) <= 20;
    const cone = `M${lx} ${ly}L${cx + Math.cos(a + Math.PI / 2) * 34} ${cy + Math.sin(a + Math.PI / 2) * 34}L${cx + Math.cos(a - Math.PI / 2) * 34} ${cy + Math.sin(a - Math.PI / 2) * 34}Z`;
    return `<g class="dev__lamp" style="animation-delay:${240 + i * 420}ms"><path d="${cone}" fill="${colour}" opacity=".22"/>
<rect x="${lx - 11}" y="${ly - 5}" width="22" height="10" rx="2" fill="${colour}" transform="rotate(${a * 180 / Math.PI + 90} ${lx} ${ly})"/>
<text x="${mid ? lx : left ? Math.max(8, lx - 12) : Math.min(292, lx + 12)}" y="${ly + (y < 0 ? -14 : 22)}" text-anchor="${mid ? 'middle' : left ? 'start' : 'end'}">${name}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 300 400" fill="none"><circle cx="${cx}" cy="${cy}" r="112" stroke="currentColor" stroke-width=".6" stroke-dasharray="1 5" opacity=".6"/>
${lamps}<ellipse cx="${cx}" cy="${cy - 4}" rx="34" ry="13" fill="#0e0d0c" stroke="currentColor" stroke-width=".8"/><circle cx="${cx}" cy="${cy}" r="16" fill="#0e0d0c" stroke="currentColor" stroke-width="1"/><path d="M${cx} ${cy + 16}v6" stroke="currentColor"/>
<g opacity=".8"><rect x="${cx - 12}" y="306" width="24" height="15" rx="2" stroke="currentColor" stroke-width=".8"/><circle cx="${cx}" cy="306" r="5" stroke="currentColor" stroke-width=".8"/><text x="${cx}" y="336" text-anchor="middle">camera</text></g></svg>`;
}

export function developing({ sitting, world: worldId, recipe = 'locked' }) {
  if (!sitting) return { el: h('section.screen.night'), enter: () => go('catalogue', {}, { replace: true }) };
  const world = worldById(worldId);
  let alive = true, loupeTimer = 0;
  const before = h('img.dev__before', { src: sitting.before.url, alt: '' }), result = h('img.dev__result', { alt: '' }), loupe = h('div.dev__loupe'), tag = h('span.dev__tag.mono', null, 'Preparing');
  const swatches = h('div.dev__palette', null, h('span.mono', null, 'Palette'), ...world.palette.map((c, i) => h('i', { style: { background: c, animationDelay: 900 + i * 90 + 'ms' } })));
  const tray = h('div.dev__tray', null, before, h('div.dev__stars', { html: constellation(sitting.points) }), h('div.dev__plan', { html: plan(world) }, swatches), result, loupe, tag);
  const rows = BEATS.map((title, i) => { const detail = h('span.beat__detail.mono', null, ' '); return { detail, el: h('li.beat', null, h('span.beat__n.mono', null, '0' + (i + 1)), h('span.beat__title', null, title), detail, h('i.beat__bar')) }; });
  const local = !studio.live || sitting.source === 'house';
  const el = h('section.screen.dev.night', { 'data-beat': '-1' },
    h('header.bar', null, h('button.bar__back', { onclick: () => back(), 'aria-label': 'Leave', html: icon('close') }), h('span.mono.bar__title', null, `Plate ${world.plate} · ${world.name}`), h('div.bar__side', null, pill())),
    h('div.dev__body', null, tray, h('ol.beats', null, rows.map(r => r.el)),
      h('p.mono.mono--soft.dev__foot', null, local ? 'The atelier · drawn on this device' : `${studio.info?.engine?.id || 'studio'} · ${studio.info?.engine?.device || location.host}`)));
  let beat = -1;

  function scan() {
    const r = tray.getBoundingClientRect(), d = r.width * 0.34, z = 2.3;
    let i = 0;
    const move = () => {
      const [px, py] = LOUPE_PATH[i++ % LOUPE_PATH.length];
      Object.assign(loupe.style, { width: d + 'px', height: d + 'px', transform: `translate(${px * r.width - d / 2}px, ${py * r.height - d / 2}px)`, backgroundSize: `${r.width * z}px ${r.height * z}px`, backgroundPosition: `${-(px * r.width * z - d / 2)}px ${-(py * r.height * z - d / 2)}px` });
    };
    move(); loupeTimer = setInterval(move, 520);
  }

  async function run() {
    try {
      for await (const ev of develop(sitting, worldId, recipe)) {
        if (!alive) return;
        if (ev.type === 'beat' && ev.beat !== beat) {
          beat = ev.beat; el.dataset.beat = String(beat);
          tag.textContent = ['01 · Reading', '02 · Composing', '03 · Refining'][beat];
          rows.forEach((r, i) => r.el.setAttribute('data-state', i < beat ? 'done' : i === beat ? 'now' : 'next'));
        } else if (ev.type === 'log') { if (rows[Math.max(0, beat)]) rows[Math.max(0, beat)].detail.textContent = ev.text; }
        else if (ev.type === 'preview') { result.src = ev.url; loupe.style.backgroundImage = `url(${ev.url})`; await result.decode().catch(() => {}); el.classList.add('has-preview'); scan(); }
        else if (ev.type === 'step') { tag.textContent = `03 · Refining · pass ${ev.i} of ${ev.n}`; el.style.setProperty('--soft', String(Math.pow(1 - ev.i / ev.n, 1.6))); }
        else if (ev.type === 'done') {
          el.style.setProperty('--soft', '0'); el.classList.add('is-done');
          rows.forEach(r => r.el.setAttribute('data-state', 'done'));
          if (ev.portrait.recipe === 'locked') savePortrait(ev.portrait);
          await sleep(640);
          if (alive) go('reveal', { portrait: ev.portrait, sitting, fresh: true }, { replace: true });
        }
      }
    } catch (err) {
      if (!alive) return;
      el.classList.add('is-lost');
      el.querySelector('.beats').replaceWith(h('div.dev__lost', null, h('p.title', null, 'The plate was lost.'), h('p.note', null, String(err?.message || err)),
        h('div.dev__lostbtns', null, h('button.btn.btn--primary', { onclick: () => go('developing', { sitting, world: worldId, recipe }, { replace: true }) }, 'Try again'), h('button.btn.btn--quiet', { onclick: () => back() }, 'Back'))));
    }
  }
  return { el, enter() { run(); }, leave() { alive = false; clearInterval(loupeTimer); } };
}
