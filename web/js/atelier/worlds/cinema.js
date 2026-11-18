/** Cinema 3D: the warm, rounded light of a feature-animation frame. */
import { mix, tone } from '../color.js';
import { PROPORTIONS, build, garment, rng } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';
import { vignette, volume } from '../kit.js';

export function paint(s, u) {
  const g = build(s, PROPORTIONS.cinema), m = g.m, r = rng(s.seed);
  const c = remap(palette(s), (v, k) => k === 'white' ? '#fbf8f4' : k === 'line' ? tone(v, { l: 0.05 })
    : tone(v, { c: 1.2, l: k === 'skin' || k === 'skinLight' ? 0.03 : 0 }));
  const vol = `${u}vol`;
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.3 }, blush: 0.42, shine: 0.65, strands: 0.3, lineW: 3,
    eyes: 'large', nose: 'soft', skinFill: `url(#${u}sk)`, hairFill: `url(#${u}hr)`,
    material: { head: vol, hair: vol, body: vol },
    headFx: `<ellipse cx="${m.cx + m.hw}" cy="${m.eyeY + 30}" rx="${m.hw * 0.17}" ry="${m.low * 1.25}" fill="#bfe6ff" opacity=".75" filter="url(#${u}softer)" style="mix-blend-mode:screen"/>`,
  });
  const roll = `M${m.cx - m.nw * 1.04},${m.shY - 46}Q${m.cx},${m.shY - 16} ${m.cx + m.nw * 1.04},${m.shY - 46}L${m.cx + m.nw * 1.16},${m.shY + 6}Q${m.cx},${m.shY + 48} ${m.cx - m.nw * 1.16},${m.shY + 6}Z`;
  const wear = `<g filter="url(#${vol})"><path d="${garment(g, 6)}" fill="url(#${u}cl)"/></g><g filter="url(#${vol})"><path d="${roll}" fill="${c.clothLight}"/></g>`;
  const bokeh = Array.from({ length: 16 }, () => {
    const x = r() * 900, y = r() * 860, rr = 24 + r() * 56;
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rr.toFixed(0)}" fill="${r() > 0.4 ? '#ffd9a0' : '#a5e3ea'}" opacity="${(0.1 + r() * 0.2).toFixed(2)}"/>`;
  }).join('');
  const dusk = mix('#1d4660', tone(s.cloth, { h: 180, l: -0.12 }), 0.22);
  const vg = vignette(u, 0.5, '#07141f', 0.5);
  return `<defs>${fig.defs}${vg.defs}${volume(vol, { bump: 10, depth: 9, gloss: 0.42, shine: 18, light: [200, 80, 520], tint: '#fff1dc' })}
<radialGradient id="${u}sk" gradientUnits="userSpaceOnUse" cx="${m.cx - m.hw * 0.35}" cy="${m.eyeY - m.low * 0.25}" r="${m.hw * 2.1}"><stop offset="0" stop-color="${c.skinLight}"/><stop offset=".5" stop-color="${c.skin}"/><stop offset=".8" stop-color="${mix(c.skin, '#e4553c', 0.2)}"/><stop offset="1" stop-color="${c.skinShade}"/></radialGradient>
<linearGradient id="${u}hr" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${c.hairLight}"/><stop offset=".45" stop-color="${c.hair}"/><stop offset="1" stop-color="${c.hairShade}"/></linearGradient>
<linearGradient id="${u}cl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.clothLight}"/><stop offset=".6" stop-color="${c.cloth}"/><stop offset="1" stop-color="${c.clothShade}"/></linearGradient>
<linearGradient id="${u}bgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone(dusk, { l: -0.08 })}"/><stop offset=".55" stop-color="${tone(dusk, { l: 0.12, c: 1.1 })}"/><stop offset="1" stop-color="#f0b271"/></linearGradient>
<filter id="${u}far" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
<filter id="${u}bloom" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="18" result="b"/><feColorMatrix in="b" values="1.1 0 0 0 -.3 0 1.1 0 0 -.3 0 0 1.1 0 -.3 0 0 0 1 0" result="h"/><feBlend in="SourceGraphic" in2="h" mode="screen"/></filter></defs>
<g filter="url(#${u}bloom)"><rect width="900" height="1200" fill="url(#${u}bgd)"/><g filter="url(#${u}far)">${bokeh}</g>
${fig.behind}${fig.torso}${wear}${fig.head}</g>${vg.body}`;
}
