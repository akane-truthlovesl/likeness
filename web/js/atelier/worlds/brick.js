/** Brick Miniature: the sitter reduced to moulded plastic, a handful of colours and a printed face. */
import { mix, toLab, tone } from '../color.js';
import { rng, rrect } from '../geometry.js';
import { palette } from '../figure.js';
import { vignette } from '../kit.js';

const SKINS = ['#f3cfa9', '#e0a070', '#bb8053', '#8a5433', '#5b3924'];
const HAIRS = ['#17171a', '#3a2418', '#7a3a1e', '#b85c1e', '#e0c27e', '#8d9094', '#c3c4c4', '#eeece6'];
const CLOTHS = ['#c4281c', '#1e5aa8', '#2e8b43', '#f2b90f', '#e96f1b', '#2a9bc7', '#efece4', '#5b6068', '#1d1d21', '#7c3f98', '#d9a066', '#6b8f71', '#0f6f73'];
const STAGES = ['#f6c517', '#3aa9d8', '#ee6240', '#8cc152', '#f08fb0'];
const LEGS = { apron: '#2f4a6b', cardigan: '#4a4f57', chef: '#26262b', vest: '#6b5a44', jacket: '#3b4048' };
const INK = '#1f1a17', CX = 450;

const d2 = (a, b) => { const x = toLab(a), y = toLab(b); return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2; };
const nearest = (hex, set) => set.reduce((best, k) => d2(hex, k) < d2(hex, best) ? k : best);
const apart = (k, avoid) => Math.min(...avoid.map(a => d2(k, a)));
const farthest = (set, avoid) => set.reduce((best, k) => apart(k, avoid) > apart(best, avoid) ? k : best);
const disc = (x, y, r) => `M${x - r},${y}a${r},${r} 0 1 0 ${r * 2},0a${r},${r} 0 1 0 ${-r * 2},0`;
const X = (k, dx) => CX + k * dx;

/** The moulded colours a sitter resolves to. */
export function plastics(s) {
  const base = palette(s), skin = nearest(s.skin, SKINS), hair = nearest(base.hair, HAIRS), cloth = nearest(s.cloth, CLOTHS);
  return { skin, hair, cloth, legs: LEGS[s.outfit] || cloth, stage: farthest(STAGES, [cloth, hair, skin]) };
}

const tress = k => `M${X(k, 196)},340Q${X(k, 224)},600 ${X(k, 190)},704Q${X(k, 150)},726 ${X(k, 118)},692L${X(k, 124)},340Z`;
const cap = 'M262,436Q240,202 450,190Q660,202 638,436L608,436Q612,330 450,278Q288,330 292,436Z';
const HAIR = {
  shaved: () => ({}),
  crop: () => ({ front: 'M274,338Q262,206 450,198Q638,206 626,338L610,340Q604,300 556,290Q450,270 344,290Q296,300 290,340Z' }),
  part: () => ({ front: 'M272,350Q258,200 450,190Q642,200 628,350L612,346Q604,306 544,312Q436,322 366,262Q336,292 300,296Q290,322 288,350Z' }),
  bun: () => ({ front: 'M276,330Q266,210 450,202Q634,210 624,330L610,330Q598,296 450,280Q302,296 290,330Z' + disc(CX, 174, 62) }),
  bob: () => ({ front: 'M258,516Q236,206 450,192Q664,206 642,516Q622,540 598,518L600,352Q450,306 300,352L302,518Q278,540 258,516Z' }),
  long: () => ({ back: tress(-1) + tress(1), front: cap }),
  waves: () => ({ back: [-1, 1].map(k => Array.from({ length: 6 }, (_, i) => disc(X(k, 172 + (i % 2) * 16), 384 + i * 62, 52)).join('')).join(''), front: cap }),
  curls: () => ({
    front: Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (170 + i * 25) / 180; return disc(CX + Math.cos(a) * 170, 334 + Math.sin(a) * 124, 58); }).join('')
      + disc(CX, 250, 86) + disc(366, 262, 70) + disc(534, 262, 70),
  }),
};

function face(s, u, skin, hairCol) {
  const e = s.expr, ex = 50 + 14 * s.eyes.spacing, ey = 392, er = 14 + 6 * s.eyes.size, specs = s.glasses !== 'none';
  const browCol = mix(hairCol, INK, 0.5), bw = 8 + 7 * s.brows.weight, lift = 32 + er * 0.5 + 12 * e.brow + (specs ? 14 : 0), arch = 5 + 14 * s.brows.arch;
  const crease = tone(skin, { l: -0.2, c: 1.1 });
  const eyes = [-1, 1].map(k => { const x = CX + k * ex; return `<ellipse cx="${x}" cy="${ey}" rx="${er}" ry="${er * (1 - 0.3 * e.squint)}" fill="${INK}"/><circle cx="${x - er * 0.3}" cy="${ey - er * 0.34}" r="${er * 0.3}" fill="#fff"/>
<path d="M${x - k * 26},${ey - lift + 5}Q${x},${ey - lift - arch} ${x + k * 30},${ey - lift + 5}" fill="none" stroke="${browCol}" stroke-width="${bw}" stroke-linecap="round"/>`; }).join('');
  const mw = 52 + 46 * s.mouth.width, my = 466, d = 2 + 26 * e.smile, bearded = s.beard === 'full';
  const curve = `M${CX - mw / 2},${my}Q${CX},${my + d * 1.5} ${CX + mw / 2},${my}`;
  let mouth;
  if (e.open > 0.3) {
    const shape = `M${CX - mw / 2},${my}Q${CX},${my + d * 0.25} ${CX + mw / 2},${my}Q${CX},${my + d * 2.3} ${CX - mw / 2},${my}Z`;
    mouth = `<clipPath id="${u}bm"><path d="${shape}"/></clipPath><path d="${shape}" fill="#3a0f14" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/>
<g clip-path="url(#${u}bm)"><rect x="${CX - mw / 2}" y="${my - 4}" width="${mw}" height="${d * 0.5 + 6}" fill="#fff"/><ellipse cx="${CX}" cy="${my + d * 1.3}" rx="${mw * 0.26}" ry="${d * 0.42}" fill="#d9534f"/></g>`;
  } else mouth = (bearded ? `<path d="${curve}" fill="none" stroke="${tone(skin, { l: -0.04 })}" stroke-width="19" stroke-linecap="round"/>` : '')
    + `<path d="${curve}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`;
  const lip = s.mouth.full > 0.6 && !bearded ? `<path d="M${CX - 20},${my + d * 1.1 + 15}Q${CX},${my + d * 1.1 + 22} ${CX + 20},${my + d * 1.1 + 15}" fill="none" stroke="${crease}" stroke-width="5" stroke-linecap="round"/>` : '';
  const lens = k => s.glasses === 'round' ? disc(CX + k * ex, ey, er + 25) : rrect(CX + k * ex - er - 28, ey - er - 19, (er + 28) * 2, (er + 19) * 2, 12);
  const glasses = specs ? `<path d="${lens(-1)}${lens(1)}" fill="#fff" fill-opacity=".16" stroke="${INK}" stroke-width="7"/>
<path d="M${CX - ex + er + 24},${ey - 4}Q${CX},${ey - 14} ${CX + ex - er - 24},${ey - 4}" fill="none" stroke="${INK}" stroke-width="7"/>` : '';
  const mass = 'M280,428Q330,452 382,444Q450,426 518,444Q570,452 620,428V540H280Z';
  const beard = bearded ? `<path d="${mass}" fill="${hairCol}"/>` : s.beard === 'stubble' ? `<path d="${mass}" fill="${hairCol}" opacity=".24"/>`
    : s.beard === 'moustache' ? `<path d="M450,440Q420,428 390,452Q424,460 450,450Q476,460 510,452Q480,428 450,440Z" fill="${hairCol}"/>` : '';
  const freckles = s.freckles ? [-1, 1].map(k => [0, 1, 2].map(i => `<circle cx="${X(k, ex + 20 + i * 13)}" cy="${430 + (i % 2) * 10}" r="3.6" fill="${crease}"/>`).join('')).join('') : '';
  const years = s.age > 0.6 ? [-1, 1].map(k => `<path d="M${X(k, 54)},440Q${X(k, 68)},458 ${X(k, 60)},478M${X(k, ex + er + 12)},${ey - 6}l${k * 14},-7M${X(k, ex + er + 12)},${ey + 4}l${k * 14},5" fill="none" stroke="${crease}" stroke-width="4" stroke-linecap="round"/>`).join('')
    + `<path d="M408,326Q450,318 492,326" fill="none" stroke="${crease}" stroke-width="4" stroke-linecap="round"/>` : '';
  return beard + years + freckles + eyes + mouth + lip + glasses;
}

function print(s, cloth, skin) {
  const line = tone(cloth, { l: -0.17 }), light = tone(cloth, { l: 0.13 }), shirt = '#efece4';
  const buttons = (x, y0, n, gap, col, r = 9) => Array.from({ length: n }, (_, i) => `<circle cx="${x}" cy="${y0 + i * gap}" r="${r}" fill="${col}"/>`).join('');
  const stroke = (d, col = line, w = 6) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return {
    apron: `<path d="M366,654H534L562,940H338Z" fill="${line}"/>` + stroke('M374,656L398,560M526,656L502,560', line, 16) + stroke('M398,800H502V872H398Z', tone(cloth, { l: -0.27 }), 5),
    scrubs: `<path d="M390,560L450,646L510,560Z" fill="${skin}"/>` + stroke('M390,560L450,646L510,560', line, 7) + stroke('M500,700h78v64h-78z') + `<rect x="336" y="700" width="56" height="36" rx="4" fill="#f4f1ea"/><rect x="344" y="712" width="40" height="5" fill="#8a9099"/>`,
    cardigan: `<path d="M386,560L450,700L514,560Z" fill="${shirt}"/>` + stroke('M386,560L450,700L514,560', line, 7) + stroke('M450,700V940') + buttons(472, 748, 3, 66, line),
    chef: stroke('M392,560L450,604L508,560', line, 7) + stroke('M528,560L494,940') + buttons(408, 650, 3, 84, line, 11) + buttons(490, 650, 3, 84, line, 11),
    vest: `<path d="M378,560L450,730L522,560Z" fill="${shirt}"/>` + stroke('M378,560L450,730L522,560', line, 7) + buttons(450, 776, 3, 58, light),
    tracksuit: stroke('M450,600V940', '#f4f1ea', 7) + stroke('M390,562Q450,626 510,562', '#f4f1ea', 16),
    jacket: `<path d="M390,560L450,704L426,560ZM510,560L450,704L474,560Z" fill="${line}"/>` + stroke('M450,704V940'),
  }[s.outfit] || '';
}

const brick = (x, y, col) => `<rect x="${x}" y="${y}" width="416" height="156" rx="6" fill="${col}"/><rect x="${x}" y="${y}" width="416" height="18" fill="#fff" opacity=".2"/>`
  + [0, 1, 2, 3].map(i => `<rect x="${x + i * 104 + 21}" y="${y - 22}" width="62" height="26" rx="4" fill="${tone(col, { l: 0.03 })}"/>`).join('');

export function paint(s, u) {
  const p = plastics(s), r = rng(s.seed), hair = (HAIR[s.hair.style] || HAIR.crop)();
  const dark = col => tone(col, { l: -0.26, c: 0.9 });
  const cyl = (id, col) => `<linearGradient id="${u}${id}" x1="0" x2="1"><stop offset="0" stop-color="${tone(col, { l: -0.16 })}"/><stop offset=".12" stop-color="${tone(col, { l: -0.04 })}"/><stop offset=".28" stop-color="${tone(col, { l: 0.07 })}"/><stop offset=".56" stop-color="${col}"/><stop offset=".86" stop-color="${tone(col, { l: -0.09 })}"/><stop offset="1" stop-color="${tone(col, { l: -0.2 })}"/></linearGradient>`;
  const slab = (id, col) => `<linearGradient id="${u}${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${tone(col, { l: 0.08 })}"/><stop offset=".5" stop-color="${col}"/><stop offset="1" stop-color="${tone(col, { l: -0.13 })}"/></linearGradient>`;
  const edge = col => ` stroke="${dark(col)}" stroke-width="2.5" stroke-linejoin="round"`;
  const head = rrect(287, 250, 326, 286, 76), torso = 'M287,562H613L668,936H232Z';
  const sleeve = s.outfit === 'vest' ? '#efece4' : p.cloth;
  const arm = k => `<path d="M${X(k, 146)},606Q${X(k, 250)},632 ${X(k, 262)},790L${X(k, 248)},924" fill="none" stroke="${tone(sleeve, { l: k < 0 ? -0.03 : -0.12 })}" stroke-width="86" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M${X(k, 168)},596Q${X(k, 262)},630 ${X(k, 276)},780" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="${k < 0 ? 0.28 : 0.1}" filter="url(#${u}blur)"/>
${s.outfit === 'tracksuit' ? `<path d="M${X(k, 196)},584Q${X(k, 296)},640 ${X(k, 304)},800" fill="none" stroke="#f4f1ea" stroke-width="9" opacity=".9"/>` : ''}
<rect x="${X(k, 248) - 30}" y="918" width="60" height="34" rx="8" fill="${tone(p.skin, { l: -0.08 })}"/>
<path d="M${X(k, 248) - 35},1000a37,37 0 1 1 70,0" fill="none" stroke="${tone(p.skin, { l: k < 0 ? 0 : -0.07 })}" stroke-width="27" stroke-linecap="round"/>`;
  const stack = `${brick(-232, 1044, CLOTHS[Math.floor(r() * 6)])}${brick(-336, 888, '#efece4')}${brick(-232, 732, CLOTHS[Math.floor(r() * 6)])}${brick(716, 1044, '#efece4')}${brick(820, 888, CLOTHS[Math.floor(r() * 6)])}`;
  const vg = vignette(u, 0.3, dark(p.stage), 0.55);
  return `<defs>${vg.defs}${cyl('sk', p.skin)}${cyl('lg', p.legs)}${slab('cl', p.cloth)}${slab('hr', p.hair)}
<radialGradient id="${u}bgd" cx=".5" cy=".34" r=".8"><stop offset="0" stop-color="${tone(p.stage, { l: 0.07 })}"/><stop offset="1" stop-color="${tone(p.stage, { l: -0.1 })}"/></radialGradient>
<clipPath id="${u}hd"><path d="${head}"/></clipPath><clipPath id="${u}ts"><path d="${torso}"/></clipPath>${hair.front ? `<clipPath id="${u}hf"><path d="${hair.front}"/></clipPath>` : ''}
<filter id="${u}blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
<filter id="${u}far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="10"/></filter>
<filter id="${u}cast" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
<filter id="${u}drop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#000" flood-opacity=".3"/></filter></defs>
<rect width="900" height="1200" fill="url(#${u}bgd)"/><g filter="url(#${u}far)" opacity=".9">${stack}</g>
<g transform="translate(56 40)" opacity=".26" filter="url(#${u}cast)"><path d="${head}${torso}M150,600H750V1240H150Z" fill="${dark(p.stage)}"/></g>
<path d="${rrect(232, 990, 208, 280, 8)}${rrect(460, 990, 208, 280, 8)}" fill="url(#${u}lg)"${edge(p.legs)}/><path d="${rrect(232, 936, 436, 58, 8)}" fill="${tone(p.legs, { l: -0.05 })}"${edge(p.legs)}/>
<path d="${torso}" fill="url(#${u}cl)" stroke="${dark(p.cloth)}" stroke-width="2.5" stroke-linejoin="round"/>
<g clip-path="url(#${u}ts)">${print(s, p.cloth, p.skin)}<path d="M300,562H410L318,940H240Z" fill="#fff" opacity=".08"/><ellipse cx="450" cy="566" rx="176" ry="20" fill="#000" opacity=".3" filter="url(#${u}blur)"/></g>
${arm(-1)}${arm(1)}
<rect x="384" y="524" width="132" height="44" fill="${tone(p.skin, { l: -0.14 })}"/>
${hair.back ? `<path d="${hair.back}" fill="${tone(p.hair, { l: -0.05 })}"${edge(p.hair)}/>` : ''}
${hair.front ? '' : `<path d="${rrect(382, 214, 136, 50, 10)}" fill="url(#${u}sk)"${edge(p.skin)}/>`}
<path d="${head}" fill="url(#${u}sk)"${edge(p.skin)}/>
<g clip-path="url(#${u}hd)">${hair.front ? '' : `<path d="${HAIR.crop().front}" fill="${p.hair}" opacity=".2"/>`}${face(s, u, p.skin, p.hair)}
<rect x="330" y="282" width="24" height="170" rx="12" fill="#fff" opacity=".36" filter="url(#${u}blur)"/></g>
${hair.front ? `<g filter="url(#${u}drop)"><path d="${hair.front}" fill="url(#${u}hr)"${edge(p.hair)}/></g>
<g clip-path="url(#${u}hf)"><ellipse cx="372" cy="232" rx="76" ry="15" transform="rotate(-16 372 232)" fill="#fff" opacity=".34" filter="url(#${u}blur)"/></g>` : ''}${vg.body}`;
}
