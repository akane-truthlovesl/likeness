/** Neon Noir: no key light, two coloured rims. The city does the lighting. */
import { mix, tone } from '../color.js';
import { build, garment, poly, rng } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';
import { grain, vignette } from '../kit.js';

const MAG = '#ff2e88', CYAN = '#19e3ff', AMBER = '#ffb347', NIGHT = '#120a22';

export function paint(s, u) {
  const g = build(s), m = g.m, r = rng(s.seed);
  const c = remap(palette(s), (v, k) => k === 'white' ? '#d5dcf0' : k === 'iris' ? mix(v, CYAN, 0.35) : k === 'frame' ? '#05040a'
    : mix(tone(v, { c: 0.55 }), NIGHT, k.startsWith('hair') || k === 'brow' ? 0.78 : k === 'line' ? 0.7 : 0.54));
  const rim = (id, col, half, k = 1) => `<linearGradient id="${u}${id}" gradientUnits="userSpaceOnUse" x1="${m.cx - half}" x2="${m.cx + half}">
<stop offset="0" stop-color="${mix(col, '#ff7ab4', 0.96 * k)}"/><stop offset=".1" stop-color="${mix(col, MAG, 0.8 * k)}"/><stop offset=".27" stop-color="${mix(col, MAG, 0.34 * k)}"/><stop offset=".43" stop-color="${col}"/>
<stop offset=".6" stop-color="${col}"/><stop offset=".76" stop-color="${mix(col, CYAN, 0.3 * k)}"/><stop offset=".9" stop-color="${mix(col, CYAN, 0.7 * k)}"/><stop offset="1" stop-color="${mix(col, '#a5f4ff', 0.95 * k)}"/></linearGradient>`;
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.12 }, blush: 0, shine: 0.2, strands: 0.35,
    skinFill: `url(#${u}sk)`, hairFill: `url(#${u}hr)`, hairBackFill: `url(#${u}hr)`, lens: `url(#${u}lens)`,
    headFx: `<ellipse cx="${m.cx - m.hw * 0.8}" cy="${m.eyeY + 40}" rx="${m.hw * 0.3}" ry="${m.low}" fill="${MAG}" opacity=".34" filter="url(#${u}soft)" style="mix-blend-mode:screen"/>
<ellipse cx="${m.cx + m.hw * 0.8}" cy="${m.eyeY + 40}" rx="${m.hw * 0.3}" ry="${m.low}" fill="${CYAN}" opacity=".3" filter="url(#${u}soft)" style="mix-blend-mode:screen"/>
<ellipse cx="${m.cx - m.hw * 0.56}" cy="${m.eyeY + m.low * 0.3}" rx="${m.hw * 0.13}" ry="${m.low * 0.11}" fill="#ffc2dc" opacity=".3" filter="url(#${u}softer)"/>
<ellipse cx="${m.cx + m.hw * 0.56}" cy="${m.eyeY + m.low * 0.3}" rx="${m.hw * 0.11}" ry="${m.low * 0.1}" fill="#c9f8ff" opacity=".24" filter="url(#${u}softer)"/>`,
  });
  const lapel = k => poly([[m.cx + k * m.nw * 1.05, m.shY - 8], [m.cx + k * m.nw * 2.4, m.shY + 18], [m.cx + k * 36, m.shY + 262], [m.cx, m.shY + 150]]);
  const coatPath = garment(g, 150, true);
  const coat = `<path d="${poly([[m.cx - m.nw * 1.2, m.shY - 30], [m.cx, m.shY + 160], [m.cx + m.nw * 1.2, m.shY - 30]])}" fill="#0a0812"/>
<path d="${coatPath}" fill="url(#${u}cl)"/><path d="${coatPath}" fill="none" stroke="url(#${u}edge)" stroke-width="5"/>
<path d="${lapel(-1)}" fill="#1c1430" stroke="#3a2a5c" stroke-width="3"/><path d="${lapel(1)}" fill="#130f22" stroke="#243a5c" stroke-width="3"/>
<path d="M${m.cx},${m.shY + 156}V1210" stroke="${CYAN}" stroke-width="3" opacity=".8" filter="url(#${u}glow)"/>`;
  const glyph = (x, y, q, col) => `<rect x="${x}" y="${y}" width="${q}" height="${q}" rx="${q * 0.16}" fill="none" stroke="${col}" stroke-width="${q * 0.14}"/><path d="M${x + q * 0.3},${y + q * 0.3}h${q * 0.4}M${x + q * 0.5},${y + q * 0.3}v${q * 0.42}" stroke="${col}" stroke-width="${q * 0.12}"/>`;
  const towers = Array.from({ length: 7 }, (_, i) => { const x = i * 140 - 30 + r() * 30, top = 120 + r() * 420, w = 100 + r() * 60;
    return `<rect x="${x.toFixed(0)}" y="${top.toFixed(0)}" width="${w.toFixed(0)}" height="1100" fill="#0b0816"/>` + Array.from({ length: 14 }, () => `<rect x="${(x + 10 + r() * (w - 26)).toFixed(0)}" y="${(top + 16 + r() * 560).toFixed(0)}" width="9" height="13" fill="${r() > 0.5 ? '#ffd9a0' : '#8fd8ff'}" opacity="${(0.2 + r() * 0.5).toFixed(2)}"/>`).join(''); }).join('');
  const signs = `<g filter="url(#${u}glow)">${[0, 1, 2, 3].map(i => glyph(74, 150 + i * 84, 60, MAG)).join('')}<rect x="60" y="132" width="88" height="356" rx="10" fill="none" stroke="${MAG}" stroke-width="5" opacity=".7"/>
<rect x="640" y="226" width="216" height="22" rx="7" fill="${CYAN}"/><rect x="700" y="276" width="156" height="12" rx="6" fill="${CYAN}" opacity=".7"/>${glyph(664, 316, 44, CYAN)}${glyph(722, 316, 44, CYAN)}
<circle cx="776" cy="540" r="52" fill="none" stroke="${AMBER}" stroke-width="12"/><rect x="36" y="620" width="124" height="14" rx="6" fill="${CYAN}" opacity=".8"/><rect x="752" y="700" width="110" height="12" rx="6" fill="${MAG}" opacity=".8"/></g>`
    + [[210, 320, 34, MAG], [690, 660, 46, CYAN], [120, 780, 28, AMBER], [806, 110, 24, MAG], [300, 120, 20, CYAN], [596, 96, 16, AMBER]].map(([x, y, q, col]) => `<circle cx="${x}" cy="${y}" r="${q}" fill="${col}" opacity=".26"/>`).join('');
  const gr = grain(u, 0.2), vg = vignette(u, 0.66, '#04020a', 0.44);
  return `<defs>${fig.defs}${gr.defs}${vg.defs}${rim('sk', c.skin, m.hw * 1.04)}${rim('hr', c.hair, m.hw * 1.42, 0.85)}${rim('cl', '#0e0b19', m.sw + 40, 0.42)}
<linearGradient id="${u}edge" gradientUnits="userSpaceOnUse" x1="${m.cx - m.sw - 30}" x2="${m.cx + m.sw + 30}"><stop offset="0" stop-color="#ff8cc0"/><stop offset=".3" stop-color="${MAG}" stop-opacity="0"/><stop offset=".7" stop-color="${CYAN}" stop-opacity="0"/><stop offset="1" stop-color="#b5f6ff"/></linearGradient>
<linearGradient id="${u}bgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#06050d"/><stop offset=".62" stop-color="#190c30"/><stop offset="1" stop-color="#43145a"/></linearGradient>
<linearGradient id="${u}lens" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MAG}" stop-opacity=".6"/><stop offset="1" stop-color="${CYAN}" stop-opacity=".5"/></linearGradient>
<linearGradient id="${u}haze" x1="0" y1="0" x2="0" y2="1"><stop offset=".5" stop-color="${MAG}" stop-opacity="0"/><stop offset="1" stop-color="${MAG}" stop-opacity=".26"/></linearGradient>
<filter id="${u}glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<filter id="${u}far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4.5"/></filter><filter id="${u}halo" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="46"/></filter>
<filter id="${u}split" x="0" y="0" width="100%" height="100%"><feColorMatrix in="SourceGraphic" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="r"/><feOffset in="r" dx="-2.5" result="ro"/>
<feColorMatrix in="SourceGraphic" values="0 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" result="gb"/><feOffset in="gb" dx="2.5" result="gbo"/><feBlend in="ro" in2="gbo" mode="screen"/></filter>
<pattern id="${u}rain" width="46" height="130" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path d="M10,0v62M33,70v44" stroke="#a9c0ff" stroke-width="1.5" opacity=".34"/></pattern>
<pattern id="${u}rain2" width="170" height="340" patternUnits="userSpaceOnUse" patternTransform="rotate(12)"><path d="M40,20v120M128,210v90" stroke="#e3ecff" stroke-width="2.6" stroke-linecap="round" opacity=".42"/></pattern></defs>
<g filter="url(#${u}split)"><rect width="900" height="1200" fill="url(#${u}bgd)"/><g filter="url(#${u}far)">${towers}${signs}</g>
<ellipse cx="${m.cx}" cy="${m.eyeY + 60}" rx="${m.hw * 2}" ry="${m.low * 2.3}" fill="#5a2a9a" opacity=".5" filter="url(#${u}halo)"/>
${fig.behind}${fig.torso}${coat}${fig.head}
<rect width="900" height="1200" fill="url(#${u}rain)"/><rect width="900" height="1200" fill="url(#${u}rain2)"/><rect width="900" height="1200" fill="url(#${u}haze)"/></g>${gr.body}${vg.body}`;
}
