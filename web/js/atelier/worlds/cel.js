/** Inked Cel: one confident line, flat paint, a single hard shadow. */
import { lightness, mix, tone } from '../color.js';
import { PROPORTIONS, build, garment, poly } from '../geometry.js';
import { paintFigure, palette, remap } from '../figure.js';

const INK = '#1d1a2e';

const cloud = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})"><path d="M-150,40a46,46 0 0 1 30,-84a70,70 0 0 1 128,-22a56,56 0 0 1 96,34a40,40 0 0 1 22,72z" fill="#fff"/>
<path d="M-150,40a46,46 0 0 1 -6,-50q40,34 110,22q70,22 172,-8q30,14 -0,36z" fill="#cfe9fb"/></g>`;

export function paint(s, u) {
  const g = build(s, PROPORTIONS.cel), m = g.m, base = palette(s);
  /** @type {Record<string, string>} */
  const c = {
    ...remap(base, v => tone(v, { c: 1.22, l: 0.015 })), white: '#ffffff', line: INK, frame: INK,
    hair: lightness(base.hair) < 0.25 ? mix(base.hair, '#27356b', 0.34) : tone(base.hair, { c: 1.25 }),
    skinShade: tone(base.skin, { l: -0.085, c: 1.3, h: -10 }), skinDeep: tone(base.skin, { l: -0.16, c: 1.25, h: -14 }), brow: mix(base.brow, INK, 0.45),
  };
  c.hairShade = tone(c.hair, { l: -0.1 }); c.hairLight = tone(c.hair, { l: 0.26, c: 0.9 });
  const fig = paintFigure(g, s, c, {
    uid: u, light: -1, shade: { mode: 'hard', alpha: 1 }, blush: 0.3, shine: 0.85, strands: 0, lineW: 4, frameW: 6,
    outline: { color: INK, w: 5 }, eyes: 'ink', nose: 'hook', mouth: 'simple', lipAlpha: 0,
  });
  const coat = garment(g, 150, true), tee = garment(g, 16);
  const lapel = k => poly([[m.cx + k * m.nw * 1.1, m.shY - 10], [m.cx + k * m.nw * 2.3, m.shY + 22], [m.cx + k * 26, m.shY + 210], [m.cx, m.shY + 150]]);
  const wear = `<path d="${tee}" fill="#ffffff" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<clipPath id="${u}gm"><path d="${coat}"/></clipPath><path d="${coat}" fill="${c.cloth}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<g clip-path="url(#${u}gm)"><path d="M${m.cx + 60},${m.shY - 80}L${m.cx + 150},1240H980V${m.shY - 80}Z" fill="${c.clothShade}"/></g>
<path d="${lapel(-1)}" fill="${c.clothLight}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="${lapel(1)}" fill="${c.cloth}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
<path d="M${m.cx},${m.shY + 150}V1240" stroke="${INK}" stroke-width="4"/>`;
  const tilt = `rotate(${(s.expr.tilt * 5).toFixed(2)} ${m.cx} ${m.chin})`;
  const cast = `<g transform="translate(13 15)" fill="${INK}" opacity=".2"><path d="${g.bust}"/><g transform="${tilt}"><path d="${g.head}"/><path d="${g.hair.front}"/>${g.hair.back ? `<path d="${g.hair.back}"/>` : ''}</g></g>`;
  return `<defs>${fig.defs}<linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f8fe6"/><stop offset=".7" stop-color="#8fd2ff"/><stop offset="1" stop-color="#d9f2ff"/></linearGradient></defs>
<rect width="900" height="1200" fill="url(#${u}sky)"/>${cloud(170, 250, 1.25)}${cloud(760, 420, 1)}${cloud(660, 120, 0.6)}${cloud(90, 640, 0.8)}
${cast}${fig.behind}${fig.torso}${wear}${fig.head}
<rect y="1136" width="900" height="64" fill="#fff" opacity=".2"/><g fill="#101425" opacity=".6"><rect x="236" y="1156" width="74" height="24" rx="12"/><circle cx="450" cy="1168" r="14"/><rect x="590" y="1156" width="74" height="24" rx="12"/></g>
<text x="32" y="1175" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="19" fill="#101425" opacity=".7">SC.07  A-1</text>`;
}
