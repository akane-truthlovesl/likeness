/** Studio Clay: built by hand at tabletop scale, thumbprints left in on purpose. */
import { mix, tone } from '../color.js';
import { PROPORTIONS, build, garment } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';
import { vignette, volume } from '../kit.js';

export function paint(s, u) {
  const g = build(s, PROPORTIONS.clay), m = g.m;
  const c = remap(palette(s), (v, k) => k === 'line' ? '#4a1f1c' : tone(v, { c: 1.1, l: k === 'skin' ? 0.02 : 0 }));
  const lump = `${u}clay`, bead = `${u}bead`;
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'soft', alpha: 0.22 }, blush: 0.34, shine: 0, strands: 0, lineW: 5.5,
    eyes: 'bead', nose: 'blob', mouth: 'simple', mouthDark: '#5a1d22',
    material: { head: lump, hair: lump, body: lump, feature: bead },
  });
  const wall = mix(s.cloth, '#d9a35b', 0.78), knit = c.cloth;
  const jumper = `<g filter="url(#${lump})"><path d="${garment(g, 24)}" fill="${knit}"/></g>
<path d="M${m.cx - m.nw * 1.08},${m.shY - 4}Q${m.cx},${m.shY + 52} ${m.cx + m.nw * 1.08},${m.shY - 4}" fill="none" stroke="${tone(knit, { l: 0.1 })}" stroke-width="26" stroke-linecap="round" filter="url(#${bead})"/>
${[0, 1].map(i => `<circle cx="${m.cx}" cy="${m.shY + 150 + i * 84}" r="17" fill="${tone(knit, { l: -0.16 })}" filter="url(#${bead})"/>`).join('')}`;
  const vg = vignette(u, 0.32, '#2b1a0c', 0.6);
  return `<defs>${fig.defs}${vg.defs}${volume(lump, { bump: 11, depth: 7, wobble: 9, gloss: 0.14, shine: 7 })}${volume(bead, { bump: 5, depth: 5, wobble: 3, gloss: 0.3, shine: 16 })}
<linearGradient id="${u}bgd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone(wall, { l: 0.05 })}"/><stop offset="1" stop-color="${tone(wall, { l: -0.08 })}"/></linearGradient>
<filter id="${u}cast" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="20"/></filter>
<filter id="${u}print" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.22" numOctaves="2" seed="11"/><feColorMatrix values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1"/></filter></defs>
<rect width="900" height="1200" fill="url(#${u}bgd)"/><rect y="1040" width="900" height="160" fill="${tone(wall, { l: -0.24, c: 0.7 })}"/><rect y="1034" width="900" height="10" fill="${tone(wall, { l: -0.34, c: 0.6 })}"/>
<g transform="translate(46 30)" opacity=".3" filter="url(#${u}cast)"><path d="${g.head}" fill="#2b1608"/><path d="${g.bust}" fill="#2b1608"/>${g.hair.back ? `<path d="${g.hair.back}" fill="#2b1608"/>` : ''}</g>
${fig.behind}${fig.torso}${jumper}${fig.head}
<rect width="900" height="1200" filter="url(#${u}print)" opacity=".22" style="mix-blend-mode:multiply"/>${vg.body}`;
}
