/** Chiaroscuro: one north window on an umber ground, and half the face left unresolved. */
import { mix, tone } from '../color.js';
import { build, garment, mirror, spline } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';
import { vignette } from '../kit.js';

const UMBER = '#120a05';

export function paint(s, u) {
  const g = build(s), m = g.m;
  const c = remap(palette(s), (v, k) => k === 'skinDeep' ? mix(v, UMBER, 0.5) : k.startsWith('hair') || k === 'brow' ? mix(v, '#1a0f08', 0.35)
    : k === 'white' ? '#e4d8c2' : k.startsWith('skin') ? mix(tone(v, { c: 1.06 }), '#b5651d', 0.1) : mix(v, '#8a5a2a', 0.12));
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.62 }, blush: 0.24, shine: 0.22, strands: 0.4, neckFill: mix(c.skinShade, UMBER, 0.42),
    headFx: `<ellipse cx="${m.cx + m.hw * 0.44}" cy="${m.eyeY + m.low * 0.3}" rx="${m.hw * 0.2}" ry="${m.low * 0.15}" fill="${c.skin}" opacity=".7" filter="url(#${u}softer)"/>
<ellipse cx="${m.cx - m.hw * 0.4}" cy="${m.eyeY - 104}" rx="${m.hw * 0.34}" ry="42" fill="#fff0d0" opacity=".26" filter="url(#${u}soft)"/>
<ellipse cx="${m.cx - m.hw * 0.5}" cy="${m.eyeY + m.low * 0.3}" rx="${m.hw * 0.2}" ry="${m.low * 0.13}" fill="#ffe9c4" opacity=".24" filter="url(#${u}softer)"/>`,
  });
  const wing = [[m.cx, m.shY + 34], [m.cx + m.nw * 0.9, m.shY - 22], [m.cx + m.nw * 2.5, m.shY + 30], [m.cx + m.nw * 1.5, m.shY + 92]];
  const collar = `<path d="${spline(wing)}" fill="#a3957a"/><path d="${spline(mirror(wing, m.cx))}" fill="#f4ecd8"/>`;
  const vg = vignette(u, 0.8, '#070402', 0.4);
  const grey = '1.9 0 0 0 -.45 1.9 0 0 0 -.45 1.9 0 0 0 -.45 0 0 0 0 1';
  return `<defs>${fig.defs}${vg.defs}
<radialGradient id="${u}bgd" cx=".76" cy=".4" r=".8"><stop offset="0" stop-color="#6a5230"/><stop offset=".5" stop-color="#31220f"/><stop offset="1" stop-color="#100a05"/></radialGradient>
<linearGradient id="${u}cl" x1="0" x2="1"><stop offset="0" stop-color="#33271c"/><stop offset=".5" stop-color="#140e0a"/><stop offset="1" stop-color="#090605"/></linearGradient>
<filter id="${u}paint" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="0.018 0.036" numOctaves="2" seed="3" result="t"/>
<feDisplacementMap in="SourceGraphic" in2="t" scale="15" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="${u}brush" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.016 0.13" numOctaves="3" seed="7"/><feColorMatrix values="${grey}"/></filter>
<filter id="${u}impasto" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.055" numOctaves="4" seed="9" result="n"/>
<feDiffuseLighting in="n" surfaceScale="2.2" diffuseConstant="1.1" lighting-color="#fff"><feDistantLight azimuth="225" elevation="56"/></feDiffuseLighting></filter>
<filter id="${u}weave" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency="0.9 0.75" numOctaves="1" seed="2"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter></defs>
<g filter="url(#${u}paint)"><rect x="-40" y="-40" width="980" height="1280" fill="url(#${u}bgd)"/>
${fig.behind}${fig.torso}<path d="${garment(g, 26)}" fill="url(#${u}cl)"/>
<ellipse cx="${m.cx - m.sw * 0.62}" cy="${m.shY + 110}" rx="150" ry="64" fill="#7a5c3c" opacity=".3" filter="url(#${u}soft)"/>${collar}${fig.head}</g>
<rect x="-700" y="-500" width="2300" height="2200" transform="rotate(-34 450 600)" filter="url(#${u}brush)" opacity=".2" style="mix-blend-mode:soft-light"/>
<rect width="900" height="1200" filter="url(#${u}impasto)" opacity=".34" style="mix-blend-mode:soft-light"/>
<rect width="900" height="1200" filter="url(#${u}weave)" opacity=".1" style="mix-blend-mode:overlay"/>
<rect width="900" height="1200" fill="#c98f2a" opacity=".1" style="mix-blend-mode:multiply"/>${vg.body}`;
}
