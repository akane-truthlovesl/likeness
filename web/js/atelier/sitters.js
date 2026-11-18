/** The house sitters: six fictional people whose ordinary snapshots hang in the showcase. */
import { chroma, hue, lightness } from './color.js';
import { rng } from './geometry.js';

const sitter = (id, caption, scene, note, traits) => ({
  id, caption, scene, note, seed: [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0,
  face: { width: 0.5, jaw: 0.5, chin: 0.5, cheek: 0.5, length: 0.5 }, eyes: { size: 0.5, spacing: 0.5, tilt: 0.5, color: '#4a3020' },
  brows: { weight: 0.5, arch: 0.5 }, nose: { size: 0.5, width: 0.5 }, mouth: { width: 0.5, full: 0.5 },
  beard: 'none', glasses: 'none', age: 0.2, freckles: false, outfit: 'jacket', cloth: '#56616d',
  expr: { smile: 0.5, open: 0, brow: 0, squint: 0, tilt: 0, gaze: 0 }, ...traits,
});

export const SITTERS = [
  sitter('ines', 'I., who repairs bicycles', 'stairwell', 'Stairwell, flash on', {
    skin: '#a9714b', hair: { style: 'curls', color: '#1d1512', grey: 0 }, face: { width: 0.55, jaw: 0.5, chin: 0.45, cheek: 0.65, length: 0.42 },
    eyes: { size: 0.6, spacing: 0.5, tilt: 0.56, color: '#3b2415' }, brows: { weight: 0.55, arch: 0.55 }, nose: { size: 0.5, width: 0.62 }, mouth: { width: 0.72, full: 0.72 },
    outfit: 'apron', cloth: '#4f6475', expr: { smile: 0.95, open: 0.72, brow: 0.35, squint: 0.35, tilt: -0.3, gaze: 0 },
  }),
  sitter('tomas', 'T., night-shift nurse', 'breakroom', 'Break room, 3 a.m.', {
    skin: '#e6b999', hair: { style: 'part', color: '#a2542a', grey: 0 }, face: { width: 0.42, jaw: 0.42, chin: 0.55, cheek: 0.35, length: 0.66 },
    eyes: { size: 0.42, spacing: 0.44, tilt: 0.46, color: '#4d6f7a' }, brows: { weight: 0.38, arch: 0.3 }, nose: { size: 0.66, width: 0.36 }, mouth: { width: 0.42, full: 0.3 },
    beard: 'stubble', glasses: 'round', age: 0.3, freckles: true, outfit: 'scrubs', cloth: '#3f8f8a', expr: { smile: 0.38, open: 0, brow: 0.1, squint: 0.3, tilt: 0.2, gaze: 0 },
  }),
  sitter('mei', 'M., who sells secondhand books', 'bookshop', 'Behind the counter', {
    skin: '#eccba8', hair: { style: 'bob', color: '#17151a', grey: 0 }, face: { width: 0.5, jaw: 0.36, chin: 0.34, cheek: 0.6, length: 0.4 },
    eyes: { size: 0.5, spacing: 0.56, tilt: 0.66, color: '#2a1d16' }, brows: { weight: 0.3, arch: 0.4 }, nose: { size: 0.34, width: 0.44 }, mouth: { width: 0.4, full: 0.56 },
    glasses: 'square', outfit: 'cardigan', cloth: '#8a4f3d', expr: { smile: 0.55, open: 0, brow: 0.2, squint: 0.12, tilt: 0.12, gaze: 0 },
  }),
  sitter('kofi', 'K., a line cook', 'kitchen', 'End of service', {
    skin: '#6b4430', hair: { style: 'crop', color: '#120e0c', grey: 0 }, face: { width: 0.62, jaw: 0.72, chin: 0.66, cheek: 0.5, length: 0.52 },
    eyes: { size: 0.48, spacing: 0.52, tilt: 0.5, color: '#2c1a10' }, brows: { weight: 0.78, arch: 0.62 }, nose: { size: 0.6, width: 0.78 }, mouth: { width: 0.66, full: 0.8 },
    beard: 'full', outfit: 'chef', cloth: '#e9e4d8', expr: { smile: 0.42, open: 0, brow: 0.55, squint: 0.2, tilt: -0.14, gaze: 0 },
  }),
  sitter('ruth', 'R., a retired cartographer', 'garden', 'In the garden, overcast', {
    skin: '#e9c4ad', hair: { style: 'bun', color: '#6a5a4c', grey: 0.86 }, face: { width: 0.46, jaw: 0.44, chin: 0.42, cheek: 0.42, length: 0.56 },
    eyes: { size: 0.4, spacing: 0.48, tilt: 0.42, color: '#6b7f8c' }, brows: { weight: 0.24, arch: 0.52 }, nose: { size: 0.58, width: 0.42 }, mouth: { width: 0.5, full: 0.28 },
    age: 0.82, outfit: 'vest', cloth: '#5d6b4a', expr: { smile: 0.62, open: 0, brow: 0.25, squint: 0.42, tilt: 0.1, gaze: 0 },
  }),
  sitter('lena', 'L., a swimming teacher', 'pool', 'Poolside, before the first class', {
    skin: '#d99f7a', hair: { style: 'waves', color: '#7a3b22', grey: 0 }, face: { width: 0.5, jaw: 0.5, chin: 0.44, cheek: 0.55, length: 0.48 },
    eyes: { size: 0.56, spacing: 0.5, tilt: 0.54, color: '#4f6b3a' }, brows: { weight: 0.46, arch: 0.46 }, nose: { size: 0.44, width: 0.48 }, mouth: { width: 0.62, full: 0.5 },
    freckles: true, outfit: 'tracksuit', cloth: '#c0392b', expr: { smile: 0.82, open: 0.45, brow: 0.3, squint: 0.3, tilt: 0.3, gaze: 0 },
  }),
];

export const sitterById = id => SITTERS.find(s => s.id === id);

/** A sitter nobody has read yet: middling in every measure, to be described by hand. */
export const anonymous = () => ({
  ...sitter('me-' + Date.now().toString(36), 'You', 'stairwell', 'Described by hand', { skin: '#e0ac85', hair: { style: 'crop', color: '#3a2a1e', grey: 0 }, expr: { smile: 0.45, open: 0, brow: 0.1, squint: 0.1, tilt: 0, gaze: 0 } }),
  seed: (Date.now() * 2654435761) >>> 0,
});
export const SKIN_TONES = ['#f6dcc8', '#eccba8', '#e0ac85', '#c98d62', '#a9714b', '#7d5236', '#56382a'];
export const HAIR_COLOURS = [['#17151a', 0], ['#3a2a1e', 0], ['#6b4a2f', 0], ['#a2542a', 0], ['#d9b36c', 0], ['#6a5a4c', 0.86]];
export const HAIR_STYLES = ['shaved', 'crop', 'part', 'curls', 'bob', 'long', 'waves', 'bun'];
export const BEARDS = ['none', 'stubble', 'moustache', 'full'];
export const GLASSES = ['none', 'round', 'square'];

/** @type {[number, string][]} */
const SKIN_WORDS = [[0.84, 'porcelain'], [0.78, 'ivory'], [0.72, 'warm sand'], [0.65, 'golden olive'], [0.57, 'sienna'], [0.48, 'umber'], [0, 'deep espresso']];
const HAIR_LABELS = { shaved: 'shaved close', crop: 'cropped', part: 'short, side-parted', curls: 'full curls', bob: 'a bob with a fringe', long: 'long and straight', waves: 'long waves', bun: 'drawn up in a bun' };

function hairColour(s) {
  if (s.hair.grey > 0.6) return 'silver';
  const L = lightness(s.hair.color), C = chroma(s.hair.color), h = hue(s.hair.color);
  if (L < 0.22) return 'black';
  if (C > 0.07 && h < 62) return L < 0.42 ? 'auburn' : 'copper';
  if (L > 0.68) return 'blond';
  return L < 0.36 ? 'dark brown' : 'chestnut';
}

/** The identity sheet in words: the narrowest channel a portrait can travel through. */
export function describe(s) {
  const e = s.expr;
  const smile = e.smile > 0.8 ? (e.open > 0.4 ? 'a broad, open smile' : 'a broad smile') : e.smile > 0.5 ? 'a soft smile' : e.smile > 0.25 ? 'a half smile' : e.smile > -0.05 ? 'a level, quiet mouth' : 'a set mouth';
  return {
    skin: SKIN_WORDS.find(([l]) => lightness(s.skin) >= l)[1] + ' skin',
    hair: s.hair.style === 'shaved' ? 'hair shaved close' : `${hairColour(s)} hair, ${HAIR_LABELS[s.hair.style]}`,
    glasses: s.glasses === 'none' ? 'no glasses' : `${s.glasses} glasses`,
    beard: { none: 'clean-shaven', stubble: 'stubble', moustache: 'a moustache', full: 'a full beard' }[s.beard],
    expression: smile + (e.brow > 0.45 ? ', one brow lifted' : e.brow < -0.3 ? ', brows drawn' : ''),
  };
}

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * What a text-only prompt keeps of a person: the nameable traits survive, the geometry is re-rolled
 * toward a pleasant average, the expression is replaced by a stock one and the years are smoothed away.
 */
export function drift(s) {
  const r = rng(s.seed * 2654435761 >>> 0), toward = v => lerp(v, 0.5, 0.55) + (r() - 0.5) * 0.5;
  const each = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'number' ? Math.max(0, Math.min(1, toward(v))) : v]));
  return {
    ...s, id: s.id + '~naive', seed: s.seed ^ 0x9e3779b9,
    face: each(s.face), eyes: { ...each(s.eyes), size: Math.min(1, s.eyes.size * 0.5 + 0.5) }, brows: each(s.brows), nose: { size: lerp(s.nose.size, 0.3, 0.7), width: lerp(s.nose.width, 0.35, 0.7) },
    mouth: each(s.mouth), age: s.age * 0.25, freckles: false,
    expr: { smile: 0.5, open: 0, brow: 0, squint: 0.05, tilt: 0, gaze: 0 },
  };
}

const SHAPE_KEYS = [['face', 'width'], ['face', 'jaw'], ['face', 'chin'], ['face', 'length'], ['eyes', 'size'], ['eyes', 'spacing'], ['eyes', 'tilt'], ['brows', 'weight'], ['brows', 'arch'], ['nose', 'size'], ['nose', 'width'], ['mouth', 'width'], ['mouth', 'full']];
const EXPR_KEYS = ['smile', 'open', 'brow', 'squint', 'tilt'];
const LABELS = { 'face.width': 'face width', 'face.jaw': 'jaw', 'face.chin': 'chin', 'face.length': 'face length', 'eyes.size': 'eye size', 'eyes.spacing': 'eye spacing', 'eyes.tilt': 'eye tilt', 'brows.weight': 'brow weight', 'brows.arch': 'brow arch', 'nose.size': 'nose length', 'nose.width': 'nose width', 'mouth.width': 'mouth width', 'mouth.full': 'lip fullness' };

/**
 * Likeness between two readings of a face, 0–1, with the largest differences named.
 * On the showcase edition this is measured on drawing parameters; the workstation measures it on face embeddings.
 */
export function likeness(a, b) {
  const gaps = SHAPE_KEYS.map(([g, k]) => ({ key: g + '.' + k, label: LABELS[g + '.' + k], delta: b[g][k] - a[g][k] }));
  const shape = Math.sqrt(gaps.reduce((t, x) => t + x.delta ** 2, 0) / gaps.length);
  const expr = Math.sqrt(EXPR_KEYS.reduce((t, k) => t + (b.expr[k] - a.expr[k]) ** 2, 0) / EXPR_KEYS.length);
  const age = Math.abs(a.age - b.age);
  return {
    score: Math.max(0, 1 - shape * 2.1 - age * 0.25), expression: Math.max(0, 1 - expr * 1.6),
    drift: gaps.filter(x => Math.abs(x.delta) > 0.08).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, 4),
    smoothed: a.age - b.age > 0.15, held: gaps.filter(x => Math.abs(x.delta) <= 0.08).length, total: gaps.length,
  };
}
