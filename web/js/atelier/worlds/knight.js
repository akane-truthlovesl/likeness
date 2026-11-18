/** The Order: cold daylight from an arrow-slit, a torch behind the shoulder, steel that has seen use. */
import { mix, tone } from '../color.js';
import { build, garment, poly, rng } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';
import { grain, vignette } from '../kit.js';

const TINCTURES = ['#8f1d21', '#1f3f7a', '#1f5a3a', '#5a2a6a', '#22232b'], METALS = ['#d8d2c2', '#c9a23c'];

/** A coat of arms drawn from the sitting's seed: a field, an ordinary and a charge. */
export function arms(seed) {
  const r = rng((seed ^ 0x51ed270b) >>> 0), field = TINCTURES[Math.floor(r() * 5)], metal = METALS[Math.floor(r() * 2)], ord = Math.floor(r() * 6), ch = Math.floor(r() * 4);
  const ordinary = [
    `<rect x="64" width="52" height="520" fill="${metal}"/>`,
    `<rect y="230" width="180" height="60" fill="${metal}"/>`,
    `<path d="M-10,60L40,20L190,400L140,440Z" fill="${metal}"/>`,
    `<path d="M-10,370L90,250L190,370" fill="none" stroke="${metal}" stroke-width="46"/>`,
    `<rect x="72" width="36" height="520" fill="${metal}"/><rect y="170" width="180" height="36" fill="${metal}"/>`,
    `<path d="M-10,90L190,420M190,90L-10,420" stroke="${metal}" stroke-width="34"/>`,
  ][ord];
  const cy = ord === 4 || ord === 5 ? 74 : 124, ink = ord === 0 || ord === 4 ? field : metal;
  const charge = [
    `<circle cx="90" cy="${cy}" r="26" fill="${ink}"/>`,
    `<path d="${poly(Array.from({ length: 10 }, (_, i) => { const a = Math.PI * (i / 5 - 0.5), q = i % 2 ? 13 : 32; return [90 + Math.cos(a) * q, cy + Math.sin(a) * q]; }))}" fill="${ink}"/>`,
    `<path d="M${90 - 28},${cy - 8}a30,30 0 1 0 56,0a34,34 0 0 1 -56,0z" fill="${ink}"/>`,
    `<path d="M90,${cy - 36}l26,36l-26,36l-26,-36z" fill="${ink}"/>`,
  ][ch];
  return { field, metal, body: `<rect width="180" height="520" fill="${field}"/>${ordinary}${ord === 0 || ord === 4 ? '' : charge}` };
}

export function paint(s, u) {
  const g = build(s), m = g.m, r = rng(s.seed), coat = arms(s.seed);
  const c = remap(palette(s), (v, k) => k === 'white' ? '#e6e3dc' : mix(tone(v, { c: 0.88 }), '#44546a', k.startsWith('hair') || k === 'brow' ? 0.1 : 0.14));
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.5 }, blush: 0.14, shine: 0.3,
    headFx: `<ellipse cx="${m.cx + m.hw * 0.98}" cy="${m.eyeY + 30}" rx="${m.hw * 0.2}" ry="${m.low * 1.2}" fill="#ff9a3c" opacity=".6" filter="url(#${u}softer)" style="mix-blend-mode:screen"/>`,
  });
  const wool = mix(tone(coat.field, { c: 1.1 }), '#0c0708', 0.35);
  const cloak = `<path d="M${m.cx - m.nw * 1.4},${m.shY - 26}L${m.cx - m.sw - 70},${m.shY + 110}L${m.cx - m.sw - 120},1240H${m.cx + m.sw + 120}L${m.cx + m.sw + 70},${m.shY + 110}L${m.cx + m.nw * 1.4},${m.shY - 26}Z" fill="${wool}"/>`;
  const gorget = poly([[m.cx - m.nw * 1.16, m.shY - 74], [m.cx + m.nw * 1.16, m.shY - 74], [m.cx + m.nw * 1.9, m.shY + 22], [m.cx, m.shY + 78], [m.cx - m.nw * 1.9, m.shY + 22]]);
  const brass = '#c9a23c';
  const pauldron = k => { const x = m.cx + k * m.sw * 0.8, y = m.shY + 100; return `<ellipse cx="${x + k * 12}" cy="${y + 84}" rx="138" ry="92" fill="url(#${u}p${k > 0 ? 'b' : 'a'})" stroke="#0f1317" stroke-width="4"/>
<ellipse cx="${x + k * 6}" cy="${y + 40}" rx="146" ry="98" fill="url(#${u}p${k > 0 ? 'b' : 'a'})" stroke="#0f1317" stroke-width="4"/>
<ellipse cx="${x}" cy="${y}" rx="150" ry="104" fill="url(#${u}p${k > 0 ? 'b' : 'a'})" stroke="#0f1317" stroke-width="4"/>
<path d="M${x - 146},${y + 14}A150,104 0 0 0 ${x + 146},${y + 14}" fill="none" stroke="${brass}" stroke-width="5" opacity=".75"/>
<circle cx="${x - k * 96}" cy="${y + 26}" r="8" fill="${brass}" stroke="#0f1317" stroke-width="3"/>`; };
  const rivets = [-1.4, -0.7, 0, 0.7, 1.4].map(k => `<circle cx="${m.cx + k * m.nw}" cy="${m.shY + 30 - Math.abs(k) * 22}" r="5.5" fill="#dfe7ee" stroke="#0f1317" stroke-width="2"/>`).join('');
  const steel = `<path d="${garment(g, 20)}" fill="url(#${u}st)" stroke="#0f1317" stroke-width="4"/>
<path d="M${m.cx - 170},${m.shY + 150}Q${m.cx},${m.shY + 230} ${m.cx + 170},${m.shY + 150}" fill="none" stroke="${brass}" stroke-width="5" opacity=".7"/>
<path d="M${m.cx - 190},${m.shY + 172}Q${m.cx},${m.shY + 256} ${m.cx + 190},${m.shY + 172}" fill="none" stroke="#0b0e11" stroke-width="3" opacity=".5"/>
<path d="M${m.cx},${m.shY + 40}V1240" stroke="#eef3f7" stroke-width="3" opacity=".4"/><path d="M${m.cx + 5},${m.shY + 40}V1240" stroke="#0b0e11" stroke-width="4" opacity=".5"/>
${pauldron(-1)}${pauldron(1)}<path d="${gorget}" fill="url(#${u}go)" stroke="#0f1317" stroke-width="4" stroke-linejoin="round"/>${rivets}`;
  const embers = Array.from({ length: 16 }, () => `<circle cx="${(560 + r() * 330).toFixed(0)}" cy="${(80 + r() * 760).toFixed(0)}" r="${(1.6 + r() * 3.2).toFixed(1)}" fill="#ffb347" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`).join('');
  const gr = grain(u, 0.2), vg = vignette(u, 0.78, '#05060a', 0.4);
  return `<defs>${fig.defs}${gr.defs}${vg.defs}
<linearGradient id="${u}st" gradientUnits="userSpaceOnUse" x1="${m.cx - m.sw - 60}" x2="${m.cx + m.sw + 60}"><stop offset="0" stop-color="#3a444e"/><stop offset=".2" stop-color="#cfd9e3"/><stop offset=".36" stop-color="#7d8996"/><stop offset=".62" stop-color="#262d34"/><stop offset=".88" stop-color="#4a3f38"/><stop offset="1" stop-color="#f09a48"/></linearGradient>
<linearGradient id="${u}go" x1="0" x2="1"><stop offset="0" stop-color="#55606b"/><stop offset=".26" stop-color="#e3ebf2"/><stop offset=".5" stop-color="#6d7986"/><stop offset=".8" stop-color="#2a3037"/><stop offset="1" stop-color="#c9793a"/></linearGradient>
<radialGradient id="${u}pa" cx=".34" cy=".22" r=".95"><stop offset="0" stop-color="#f6fafc"/><stop offset=".3" stop-color="#b3bfca"/><stop offset=".72" stop-color="#5d6975"/><stop offset="1" stop-color="#2a3138"/></radialGradient>
<radialGradient id="${u}pb" cx=".3" cy=".22" r=".98"><stop offset="0" stop-color="#d5dee6"/><stop offset=".36" stop-color="#7f8b97"/><stop offset=".74" stop-color="#363d45"/><stop offset="1" stop-color="#f09a48"/></radialGradient>
<radialGradient id="${u}cold" cx=".08" cy=".16" r=".8"><stop offset="0" stop-color="#7d9bbd" stop-opacity=".55"/><stop offset="1" stop-color="#7d9bbd" stop-opacity="0"/></radialGradient>
<radialGradient id="${u}torch" cx="1" cy=".36" r=".62"><stop offset="0" stop-color="#ff8a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff8a2a" stop-opacity="0"/></radialGradient>
<pattern id="${u}stone" width="220" height="150" patternUnits="userSpaceOnUse"><rect width="220" height="150" fill="#1d222b"/><rect x="4" y="4" width="212" height="67" fill="#232934"/><rect x="-106" y="79" width="212" height="67" fill="#20252f"/><rect x="114" y="79" width="212" height="67" fill="#262c38"/></pattern>
<clipPath id="${u}ban"><path d="M0,0H180V520L90,468L0,520Z"/></clipPath>
<filter id="${u}far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.5"/></filter>
<filter id="${u}glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
<g filter="url(#${u}far)"><rect x="-20" y="-20" width="940" height="1240" fill="url(#${u}stone)"/>
<g transform="translate(58 -16)"><g clip-path="url(#${u}ban)">${coat.body}<rect width="180" height="520" fill="#05070b" opacity=".3"/><rect width="60" height="520" fill="#fff" opacity=".07"/></g><rect x="-14" y="8" width="208" height="14" fill="#2b2118"/></g></g>
<rect width="900" height="1200" fill="url(#${u}cold)"/><rect width="900" height="1200" fill="url(#${u}torch)"/>
${cloak}${fig.behind}${fig.torso}${steel}${fig.head}<g filter="url(#${u}glow)">${embers}</g>${gr.body}${vg.body}`;
}
