/** The "before": an ordinary phone snapshot. Flat flash, careless framing, a room nobody chose. */
import { tone } from '../color.js';
import { build, garment, poly, rng } from '../geometry.js';
import { paintFigure, palette } from '../figure.js';
import { grain, vignette } from '../kit.js';

const SCENES = {
  stairwell: () => `<rect width="900" height="1200" fill="#b9b2a4"/><rect y="760" width="900" height="440" fill="#8f8a80"/><rect y="748" width="900" height="16" fill="#6f6a62"/>
<path d="M-20,640L920,330" stroke="#4a4640" stroke-width="22"/><path d="M-20,700L920,390" stroke="#5c5850" stroke-width="8"/>
<rect x="640" y="60" width="210" height="700" fill="#a39c8e"/><rect x="655" y="80" width="180" height="660" fill="#8d8779"/>`,
  breakroom: () => `<rect width="900" height="1200" fill="#c5d0bd"/><rect width="900" height="70" fill="#eef2ea"/><rect x="250" y="16" width="400" height="26" fill="#fff"/>
<rect x="60" y="170" width="300" height="380" fill="#b08a5a"/><rect x="84" y="200" width="110" height="140" fill="#f2efe6"/><rect x="214" y="220" width="120" height="90" fill="#f6d77a"/><rect x="100" y="370" width="150" height="110" fill="#e9e6dc"/>
<rect x="600" y="330" width="260" height="170" fill="#8d9296"/><rect x="620" y="350" width="150" height="130" fill="#3d4347"/><rect x="560" y="500" width="340" height="24" fill="#d8d3c6"/>`,
  bookshop: r => `<rect width="900" height="1200" fill="#4c3a2c"/>` + [80, 300, 520, 740].map(y => `<rect y="${y + 190}" width="900" height="22" fill="#2f241b"/>`
    + Array.from({ length: 22 }, (_, i) => { const h = 120 + r() * 60; return `<rect x="${i * 42 + 4}" y="${y + 190 - h}" width="${28 + r() * 10}" height="${h}" fill="${['#8c3b2e', '#c9a34e', '#3d5a6c', '#dcd3bf', '#5c7a4f', '#7a4a6a', '#b86b3a'][Math.floor(r() * 7)]}"/>`; }).join('')).join(''),
  kitchen: () => `<rect width="900" height="1200" fill="#dedfd9"/>` + Array.from({ length: 9 }, (_, i) => `<path d="M0,${i * 90 + 40}H900M${i * 110 + 20},0V820" stroke="#c3c5be" stroke-width="4"/>`).join('')
    + `<rect y="820" width="900" height="380" fill="#9a9c98"/><rect x="0" y="250" width="900" height="16" fill="#8a8d8c"/>` + [140, 230, 690, 780].map(x => `<path d="M${x},266v110" stroke="#70747a" stroke-width="10"/><circle cx="${x}" cy="396" r="26" fill="#7d8187"/>`).join(''),
  garden: () => `<rect width="900" height="1200" fill="#cdd5d8"/><rect y="520" width="900" height="680" fill="#55704a"/>`
    + [[90, 500, 150], [300, 470, 190], [560, 500, 170], [790, 460, 180], [430, 560, 200]].map(([x, y, rr]) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="#617c52"/>`).join('')
    + [70, 250, 650, 830].map(x => `<rect x="${x}" y="640" width="26" height="560" fill="#8a7a66"/>`).join('') + `<rect y="760" width="900" height="20" fill="#93836e"/>`,
  pool: () => `<rect width="900" height="1200" fill="#c4e2e6"/>` + Array.from({ length: 12 }, (_, i) => `<path d="M0,${i * 64 + 20}H900M${i * 82 + 10},0V640" stroke="#a9cfd6" stroke-width="4"/>`).join('')
    + `<rect y="640" width="900" height="560" fill="#2f9fb8"/><rect y="640" width="900" height="16" fill="#e9f3f2"/>` + Array.from({ length: 16 }, (_, i) => `<circle cx="${i * 60 + 20}" cy="770" r="14" fill="${i % 2 ? '#f4f1ea' : '#d2473b'}"/>`).join(''),
};
const CAST = {
  stairwell: '1.06 0 0 0 .02 0 1 0 0 0 0 0 .9 0 0 0 0 0 1 0', breakroom: '.96 0 0 0 0 0 1.04 0 0 .02 0 0 .95 0 0 0 0 0 1 0', bookshop: '1.05 0 0 0 .02 0 .98 0 0 0 0 0 .86 0 0 0 0 0 1 0',
  kitchen: '1 0 0 0 .02 0 1.01 0 0 .02 0 0 1.02 0 .03 0 0 0 1 0', garden: '.95 0 0 0 0 0 .98 0 0 0 0 0 1.03 0 .02 0 0 0 1 0', pool: '.93 0 0 0 0 0 1.01 0 0 0 0 0 1.06 0 .02 0 0 0 1 0',
};

/** Everyday clothes: what the sitter happened to be wearing. */
export function casual(g, c, s) {
  const { cx, shY, nw } = g.m, vee = ['scrubs', 'cardigan', 'vest'].includes(s.outfit);
  const buttons = (x, n, gapY, col) => Array.from({ length: n }, (_, i) => `<circle cx="${x}" cy="${shY + 150 + i * gapY}" r="9" fill="${col}"/>`).join('');
  const shirt = `<path d="${poly([[cx - nw * 1.1, shY - 6], [cx, shY + 112], [cx + nw * 1.1, shY - 6]])}" fill="#ebe5d9"/>`;
  const detail = {
    apron: `<path d="${poly([[cx - 120, shY + 150], [cx + 120, shY + 150], [cx + 150, 1240], [cx - 150, 1240]])}" fill="${c.clothShade}"/><path d="M${cx - 110},${shY + 152}L${cx - nw * 1.4},${shY + 10}M${cx + 110},${shY + 152}L${cx + nw * 1.4},${shY + 10}" stroke="${c.clothShade}" stroke-width="16"/>`,
    scrubs: `<path d="M${cx + 70},${shY + 190}h76v62h-76z" fill="none" stroke="${c.clothShade}" stroke-width="5"/>`,
    cardigan: shirt + buttons(cx, 3, 62, c.clothShade),
    chef: buttons(cx - 52, 3, 70, '#b9b3a6') + buttons(cx + 52, 3, 70, '#b9b3a6'),
    vest: shirt + buttons(cx, 3, 62, c.clothLight),
    tracksuit: `<path d="M${cx},${shY + 44}V1240" stroke="#f2f2f2" stroke-width="6"/><path d="M${cx - nw * 1.2},${shY - 4}Q${cx},${shY + 70} ${cx + nw * 1.2},${shY - 4}" fill="none" stroke="#f2f2f2" stroke-width="14"/>`,
    jacket: '',
  }[s.outfit] || '';
  return `<path d="${garment(g, vee ? 112 : 36, vee)}" fill="${c.cloth}"/>` + detail;
}

/** How the careless photographer framed the sitter: the SVG transform from figure space to the plate, and the same as a point mapper. */
export function framing(s) {
  const r = rng(s.seed), rot = (r() - 0.5) * 5, dx = (r() - 0.5) * 70, dy = 30 + r() * 30, a = rot * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  return {
    transform: `translate(${dx.toFixed(1)} ${dy.toFixed(1)}) rotate(${rot.toFixed(2)} 450 700) translate(36 96) scale(0.92)`,
    map: p => { const px = p[0] * 0.92 + 36 - 450, py = p[1] * 0.92 + 96 - 700; return [450 + px * cos - py * sin + dx, 700 + px * sin + py * cos + dy]; },
  };
}

export function paint(s, u) {
  const g = build(s), c = palette(s), m = g.m, r = rng(s.seed + 1);
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.2 }, blush: 0.2,
    headFx: `<ellipse cx="${m.cx}" cy="${m.eyeY - 118}" rx="80" ry="30" fill="#fff" opacity=".22" filter="url(#${u}softer)"/>`,
  });
  const gr = grain(u, 0.3, 1.1), vg = vignette(u, 0.34);
  return `<defs>${fig.defs}${gr.defs}${vg.defs}<filter id="${u}bg"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="${u}post" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation="0.9"/><feColorMatrix values="${CAST[s.scene] || CAST.stairwell}"/></filter></defs>
<g filter="url(#${u}post)"><g filter="url(#${u}bg)">${(SCENES[s.scene] || SCENES.stairwell)(r)}</g>
<g transform="${framing(s).transform}">
<path d="${g.head}" transform="translate(32 26)" fill="#000" opacity=".2" filter="url(#${u}softer)"/>
${fig.behind}${fig.torso}${casual(g, c, s)}
<path d="${g.bust}" fill="${tone(c.cloth, { l: -0.3 })}" opacity=".12"/>${fig.head}</g></g>${gr.body}${vg.body}`;
}
