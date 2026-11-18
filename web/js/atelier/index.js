/**
 * The atelier: an on-device portrait engine. Each world is a painter that draws a sitter as an SVG plate
 * (900 × 1200). The showcase edition is made entirely here; the workstation replaces it with real renders.
 */
import * as snapshot from './worlds/snapshot.js';
import * as noir from './worlds/noir.js';
import * as oil from './worlds/oil.js';
import * as clay from './worlds/clay.js';
import * as cinema from './worlds/cinema.js';
import * as brick from './worlds/brick.js';
import * as cel from './worlds/cel.js';
import * as knight from './worlds/knight.js';

export { framing } from './worlds/snapshot.js';
export { arms } from './worlds/knight.js';
export { plastics } from './worlds/brick.js';

const PAINTERS = { snapshot, noir, oil, clay, cinema, brick, cel, knight };

/** @typedef {{ id: string, plate: string, name: string, line: string, light: string, medium: string, note: string, ground: string, ink: string, accent: string, lights: [string, number, number, string][], palette: string[] }} World */

/** @type {World[]} */
export const WORLDS = [
  { id: 'noir', plate: 'I', name: 'Neon Noir', line: 'Rain-slick, after midnight.', light: 'Two rims, no key.', medium: 'Neon, rain, sodium haze.',
    note: 'Lit only by what the street leaves on: a magenta sign on one side, a cyan one on the other, and rain to carry both. The face is kept in the dark between the two rims, where it keeps its secrets.',
    ground: '#0d0818', ink: '#f3e9ff', accent: '#ff2e88',
    lights: [['magenta rim', -0.9, -0.3, '#ff2e88'], ['cyan rim', 0.9, -0.3, '#19e3ff']], palette: ['#120a22', '#43145a', '#ff2e88', '#19e3ff', '#ffb347'] },
  { id: 'oil', plate: 'II', name: 'Chiaroscuro', line: 'One window. Everything else is shadow.', light: 'Single window, 45° high.', medium: 'Oil on linen, umber ground.',
    note: 'A single high window, an umber ground, and the patience to leave half the face unresolved. Painted wet-in-wet, the way a sitter was recorded before there was any quicker way.',
    ground: '#1a110a', ink: '#f1e4c8', accent: '#c98f2a',
    lights: [['north window', -0.74, 0.5, '#ffe2b0']], palette: ['#120a05', '#31220f', '#6a5230', '#b5651d', '#f4ecd8'] },
  { id: 'clay', plate: 'III', name: 'Studio Clay', line: 'Thumbprints left in on purpose.', light: 'Soft box, tabletop.', medium: 'Plasticine, wire, patience.',
    note: 'Rolled, pressed and smoothed by thumb at tabletop scale, then lit like a film set the size of a shoebox. The fingerprints stay in. They are the signature.',
    ground: '#d9a35b', ink: '#2b1a0c', accent: '#b5462f',
    lights: [['soft box', -0.55, 0.72, '#fff3dc'], ['bounce card', 0.82, 0.36, '#f1d9b0']], palette: ['#d9a35b', '#b5462f', '#f6f1e8', '#4a1f1c', '#7a5a3a'] },
  { id: 'cinema', plate: 'IV', name: 'Cinema 3D', line: 'A kinder world, rendered.', light: 'Warm key, cool fill, rim.', medium: 'Subsurface, soft shadow.',
    note: 'The rounded light of a feature-animation frame: a key the colour of late afternoon, a cool fill, and a rim to lift you off the background. Every edge is softened. Nothing here is unkind.',
    ground: '#1d4660', ink: '#fdf3e3', accent: '#f0b271',
    lights: [['warm key', -0.62, 0.66, '#ffd9a0'], ['cool fill', 0.78, 0.46, '#a5e3ea'], ['rim', 0.56, -0.74, '#bfe6ff']], palette: ['#1d4660', '#3f7483', '#f0b271', '#ffd9a0', '#bfe6ff'] },
  { id: 'brick', plate: 'V', name: 'Brick Miniature', line: 'You, at four studs wide.', light: 'Product table, hard gloss.', medium: 'ABS, eight colours.',
    note: 'Your likeness reduced to its essentials and moulded in a handful of plastic colours. What survives the reduction (the brows, the glasses, the grin) turns out to be most of you.',
    ground: '#f6c517', ink: '#1f1a17', accent: '#c4281c',
    lights: [['product top', -0.3, 0.84, '#ffffff'], ['card fill', 0.86, 0.28, '#fff3c4']], palette: ['#f6c517', '#c4281c', '#1e5aa8', '#2e8b43', '#efece4'] },
  { id: 'cel', plate: 'VI', name: 'Inked Cel', line: 'Decisive line, flat light.', light: 'Flat, with one hard shadow.', medium: 'Ink and cel vinyl.',
    note: 'Drawn in one confident line and painted on the back of acetate: flat colour, a single hard shadow, a streak of light in the hair. A frame pulled from a film that was never made.',
    ground: '#1f76d2', ink: '#ffffff', accent: '#1d1a2e',
    lights: [['flat front', 0, 0.94, '#ffffff'], ['one hard shadow', -0.82, 0.26, '#ffe9a8']], palette: ['#2f8fe6', '#8fd2ff', '#ffffff', '#1d1a2e', '#ffd166'] },
  { id: 'knight', plate: 'VII', name: 'The Order', line: 'Steel, heraldry, torchlight.', light: 'Cold key, torch rim.', medium: 'Steel, wool, gesso.',
    note: 'Cold daylight from an arrow-slit, a torch behind the shoulder, and steel that has seen use. The arms on the banner are drawn fresh from each sitting; no two are alike.',
    ground: '#1b1f27', ink: '#e8e4da', accent: '#f09a48',
    lights: [['cold key', -0.7, 0.58, '#9db8d8'], ['torch rim', 0.76, -0.58, '#ff8a2a']], palette: ['#1b1f27', '#44546a', '#cfd9e3', '#c9a23c', '#f09a48'] },
];

export const worldById = id => WORLDS.find(w => w.id === id);

/** Plate dimensions of every portrait the atelier draws. */
export const PLATE = { w: 900, h: 1200 };

const wrap = body => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1200" width="900" height="1200" color-interpolation-filters="sRGB">${body}</svg>`;

/**
 * Draws a sitter in a world. `uid` prefixes every id in the plate, so plates can share a document.
 * @param {object} sitter @param {string} worldId one of the WORLDS ids, or 'snapshot' for the ordinary photograph
 */
export function portrait(sitter, worldId, uid = 'p') {
  const painter = PAINTERS[worldId];
  if (!painter) throw new Error(`Unknown world: ${worldId}`);
  return wrap(painter.paint(sitter, uid));
}
