/** The drawer: every plate made on this device, as a contact sheet. */
import { h, icon, sheet, toast } from '../core/dom.js';
import { go } from '../core/router.js';
import { worldById } from '../atelier/index.js';
import { sitterById } from '../atelier/sitters.js';
import { plate } from '../core/raster.js';
import { editionNo, emptyDrawer, getSitting, listPortraits } from '../core/store.js';
import { specimenPoints } from '../studio/showcase.js';
import { arrow, bar } from './chrome.js';

/** Stored records hold blobs; a session needs URLs again. */
async function revive(record) {
  const portrait = { ...record, url: URL.createObjectURL(record.blob) }, stored = await getSitting(record.sittingId).catch(() => null);
  if (record.sittingId.startsWith('house-')) {
    const sitter = sitterById(record.sittingId.slice(6));
    return { portrait, sitting: { id: record.sittingId, source: 'house', sitter, before: { url: (await plate(sitter, 'snapshot', 900)).url }, points: specimenPoints(sitter), readMs: 0 } };
  }
  if (!stored?.before?.blob) return { portrait, sitting: null };
  return { portrait, sitting: { ...stored, before: { blob: stored.before.blob, url: URL.createObjectURL(stored.before.blob) } } };
}

export function drawer() {
  const grid = h('div.sheetgrid'), count = h('span.mono.mono--soft', null, ''), foot = h('div.drawer__foot');
  const el = h('section.screen.drawer.paper', null, bar({ title: 'The drawer' }),
    h('div.drawer__scroll', null, h('header.drawer__head', null, h('h1.title', null, 'Your sittings'), count), grid, foot));

  async function fill() {
    const all = await listPortraits();
    count.textContent = all.length ? `${all.length} ${all.length === 1 ? 'plate' : 'plates'} · kept on this device` : '';
    if (!all.length) {
      grid.replaceChildren(h('div.drawer__empty', null, h('p.lede', null, 'Nothing in the drawer yet.'), h('p.note', null, 'Plates you develop are kept here, on this device only, until you clear them.'),
        h('button.btn.btn--primary', { onclick: () => go('sitting') }, 'Begin a sitting', arrow())));
      return foot.replaceChildren();
    }
    grid.replaceChildren(...all.map(record => {
      const world = worldById(record.world), url = URL.createObjectURL(record.blob);
      return h('button.sheetgrid__item', { onclick: async () => { const { portrait, sitting } = await revive(record); sitting ? go('reveal', { portrait, sitting }) : toast('This sitting’s photograph is gone'); } },
        h('div.plate', null, h('img.is-in', { src: url, alt: world.name, loading: 'lazy' })), h('span.mono', null, `${editionNo(record.edition)} · ${world.plate}`), h('span.sheetgrid__kind.mono', { 'data-kind': record.provenance.kind }, record.provenance.kind));
    }));
    foot.replaceChildren(h('button.link', { onclick: clear }, h('span.link__icon', { html: icon('close') }), 'Empty the drawer'));
  }
  async function clear() {
    const sure = await sheet(close => [h('span.mono.mono--soft', null, 'The drawer'), h('h2', null, 'Empty it?'), h('p', null, 'Every plate and photograph kept on this device will be removed. Saved prints are not touched.'),
      h('button.btn.btn--primary.btn--wide', { onclick: () => close(true) }, 'Empty the drawer'), h('button.btn.btn--quiet.btn--wide', { onclick: () => close(false), style: { marginTop: '2.4cqw' } }, 'Keep everything')]);
    if (sure) { await emptyDrawer(); fill(); }
  }
  return { el, enter() { fill(); } };
}
