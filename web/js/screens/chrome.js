/** What every screen shares: the bar, the edition pill and its explanation, and a world's own colours. */
import { h, icon, sheet } from '../core/dom.js';
import { lightness } from '../atelier/color.js';
import { back } from '../core/router.js';
import { studio } from '../studio/studio.js';

const fact = (k, v) => h('div.readout', null, h('dt', null, k), h('dd', null, v));

const EDITIONS = {
  showcase: () => [
    h('span.mono.mono--soft', null, 'This edition'),
    h('h2', null, 'Showcase. Everything here is drawn on this device.'),
    h('p', null, 'No workstation is connected, so no model is running and nothing leaves your phone. The plates in the catalogue are house specimens of six fictional sitters.'),
    h('p', null, 'A portrait you sit for here is a study: the atelier reads your face on the device, then draws it from that reading in each world’s own hand. A likeness the way a sketch is one.'),
    h('p.note', null, 'Renders made from your photograph itself come from the workstation. When it is connected this label reads Live, and every plate says which engine made it.'),
    h('dl', null, fact('Engine', 'The atelier, on this device'), fact('Photograph', 'Never leaves this device'), fact('Plates', 'Marked “Showcase study”')),
  ],
  simulator: () => [
    h('span.mono.mono--soft', null, 'This edition'),
    h('h2', null, 'Live, with a simulator in place of the GPU.'),
    h('p', null, 'The studio server is answering: uploads, the face gate, jobs and their events all run for real. The engine behind them is a stand-in that develops your photograph with filters, so the plumbing can be proven without a graphics card.'),
    h('p.note', null, 'Plates made here are marked “Simulator render”. Start the server on the workstation with a GPU engine and this label changes again.'),
    h('dl', null, fact('Studio', location.host), fact('Engine', studio.info?.engine?.id || 'mock'), fact('Version', studio.info?.version || '—')),
  ],
  workstation: () => [
    h('span.mono.mono--soft', null, 'This edition'),
    h('h2', null, 'Live. Renders come from your own workstation.'),
    h('p', null, 'Your photograph is sent to the studio on your laptop, carried through the identity-locked pipeline and returned as a finished plate. Nothing goes further than that machine.'),
    h('dl', null, fact('Studio', location.host), fact('Engine', studio.info?.engine?.id || '—'), fact('Device', studio.info?.engine?.device || '—'), fact('Version', studio.info?.version || '—')),
  ],
};

export const aboutEdition = () => sheet(close => [...EDITIONS[studio.mode](), h('button.btn.btn--ink.btn--wide', { onclick: () => close(), style: { marginTop: '4cqw' } }, 'Understood')]);

/** The edition pill: always visible, always honest about who is drawing. */
export const pill = () => h('button.pill', { 'data-mode': studio.mode, onclick: aboutEdition, 'aria-label': `${studio.label} edition: about` }, h('i'), studio.label);

export function bar({ mark = false, title = '', onBack = back, side = [] } = {}) {
  return h('header.bar', null,
    mark ? h('span.bar__mark', null, 'Likeness') : h('button.bar__back', { onclick: () => onBack(), 'aria-label': 'Back', html: icon('back') }),
    title && h('span.mono.bar__title', null, title),
    h('div.bar__side', null, ...side, pill()));
}

const luminance = hex => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** A world's ground, ink and accent as custom properties, for any element that should stand inside it. */
export function worldTheme(world) {
  const dark = lightness(world.ground) < 0.6;
  return {
    '--bg': world.ground, '--fg': world.ink, '--accent': world.accent, '--on-accent': contrast(world.accent, '#1a1410') >= contrast(world.accent, '#fffaf2') ? '#1a1410' : '#fffaf2',
    '--fg-soft': `color-mix(in srgb, ${world.ink} 66%, ${world.ground})`, '--rule': `color-mix(in srgb, ${world.ink} 22%, transparent)`,
    '--bg-deep': `color-mix(in srgb, ${world.ground} 86%, #000)`, '--grain-mix': dark ? 'screen' : 'multiply', '--grain-a': dark ? '.1' : '.16',
  };
}

export const arrow = () => h('span.btn__icon', { html: icon('arrow') });
