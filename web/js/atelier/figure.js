/** The shared figure painter. Worlds supply colours, materials and proportions; this lays the forms down in order. */
import { lightness, mix, tone } from './color.js';
import { poly, rng } from './geometry.js';

/** Natural colours for a sitter. Worlds remap these to their own light. */
export function palette(s) {
  const skin = s.skin, L = lightness(skin);
  const hair = s.hair.grey ? mix(s.hair.color, '#cfccc6', s.hair.grey) : s.hair.color;
  return {
    skin, skinShade: tone(skin, { l: -0.12, c: 1.12, h: -8 }), skinDeep: tone(skin, { l: -0.26, c: 1.05, h: -14 }), skinLight: tone(skin, { l: 0.07, c: 0.9, h: 8 }),
    blush: mix(skin, '#d9534a', 0.4), lip: mix(tone(skin, { l: -0.1 }), '#a83c40', 0.5), lipLight: mix(skin, '#dd7a72', 0.5),
    hair, hairShade: tone(hair, { l: -0.09 }), hairLight: tone(hair, { l: 0.17, c: 1.1 }), brow: tone(hair, { l: L < 0.45 ? -0.06 : -0.02 }),
    iris: s.eyes.color, white: '#f5f0ea', line: tone(skin, { l: -0.42, c: 0.8, h: -20 }), frame: '#1c1a18',
    cloth: s.cloth, clothShade: tone(s.cloth, { l: -0.1 }), clothLight: tone(s.cloth, { l: 0.1 }),
  };
}

/** @param {Record<string,string>} c @param {(v: string, k: string) => string} fn */
/** @param {Record<string, string>} c @param {(v: string, k: string) => string} fn @returns {Record<string, string>} */
export const remap = (c, fn) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, fn(v, k)]));

const under = e => `M${e.inner}Q${e.x + e.d * e.a * 0.1},${e.y + e.b * 1.5} ${e.outer}`;

const EYES = {
  natural(e, c, o, u, i, gaze) {
    const r = Math.max(e.b * 1.22, e.a * 0.44), gx = e.x + gaze * 4;
    return `<clipPath id="${u}e${i}"><path d="${e.almond}"/></clipPath><path d="${e.almond}" fill="${c.white}"/>
<g clip-path="url(#${u}e${i})"><circle cx="${gx}" cy="${e.y}" r="${r}" fill="${c.iris}"/><circle cx="${gx}" cy="${e.y}" r="${r * 0.46}" fill="#0c0908"/>
<ellipse cx="${e.x}" cy="${e.y - e.b * 1.1}" rx="${e.a * 1.1}" ry="${e.b * 0.7}" fill="#000" opacity=".3"/>
<circle cx="${gx - r * 0.38}" cy="${e.y - r * 0.4}" r="${r * 0.2}" fill="#fff" opacity=".92"/></g>
<path d="${e.lid}" fill="none" stroke="${c.line}" stroke-width="${o.lineW + 1.5}" stroke-linecap="round"/>
<path d="${under(e)}" fill="none" stroke="${c.line}" stroke-width="1.6" opacity=".35"/>
<path d="${e.lid}" transform="translate(0 ${-e.b * 0.95 - 3})" fill="none" stroke="${c.skinDeep}" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>`;
  },
  large(e, c, o, u, i, gaze) {
    const r = Math.min(e.a * 0.68, e.b * 0.94), gx = e.x + gaze * 5;
    return `<clipPath id="${u}e${i}"><path d="${e.almond}"/></clipPath><path d="${e.almond}" fill="${c.white}"/>
<g clip-path="url(#${u}e${i})"><circle cx="${gx}" cy="${e.y + e.b * 0.06}" r="${r}" fill="url(#${u}iris)"/><circle cx="${gx}" cy="${e.y + e.b * 0.06}" r="${r * 0.44}" fill="#0b0907"/>
<ellipse cx="${e.x}" cy="${e.y - e.b * 1.05}" rx="${e.a * 1.1}" ry="${e.b * 0.55}" fill="#1a0f1c" opacity=".32"/>
<circle cx="${gx - r * 0.36}" cy="${e.y - r * 0.36}" r="${r * 0.3}" fill="#fff"/><circle cx="${gx + r * 0.36}" cy="${e.y + r * 0.42}" r="${r * 0.13}" fill="#fff" opacity=".75"/></g>
<path d="${e.lid}" fill="none" stroke="${c.line}" stroke-width="${o.lineW + 4}" stroke-linecap="round"/>
<path d="${under(e)}" fill="none" stroke="${c.skinDeep}" stroke-width="2" opacity=".5"/>
<path d="${e.lid}" transform="translate(0 ${-e.b * 0.6 - 8})" fill="none" stroke="${c.skinDeep}" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>`;
  },
  ink(e, c, o, u, i, gaze) {
    const rx = Math.min(e.a * 0.62, e.b * 0.8), ry = e.b * 1.02, gx = e.x + gaze * 5, ink = o.outline.color;
    return `<clipPath id="${u}e${i}"><path d="${e.almond}"/></clipPath><path d="${e.almond}" fill="#fff"/>
<g clip-path="url(#${u}e${i})"><ellipse cx="${gx}" cy="${e.y}" rx="${rx}" ry="${ry}" fill="${c.iris}"/>
<ellipse cx="${gx}" cy="${e.y - ry * 0.55}" rx="${rx}" ry="${ry * 0.62}" fill="${tone(c.iris, { l: -0.16 })}"/>
<ellipse cx="${gx}" cy="${e.y + ry * 0.08}" rx="${rx * 0.42}" ry="${ry * 0.46}" fill="#14121f"/>
<ellipse cx="${gx - rx * 0.36}" cy="${e.y - ry * 0.42}" rx="${rx * 0.36}" ry="${ry * 0.26}" fill="#fff"/><circle cx="${gx + rx * 0.4}" cy="${e.y + ry * 0.5}" r="${rx * 0.17}" fill="#fff" opacity=".9"/>
<rect x="${e.x - e.a}" y="${e.y - e.b * 1.7}" width="${e.a * 2}" height="${e.b * 0.8}" fill="${ink}" opacity=".16"/></g>
<path d="${e.lid}" fill="none" stroke="${ink}" stroke-width="${o.lineW + 5}" stroke-linecap="round"/>
<path d="M${e.outer}l${e.d * 12},-9" fill="none" stroke="${ink}" stroke-width="${o.lineW + 1}" stroke-linecap="round"/>
<path d="${e.lid}" transform="translate(0 ${-e.b * 0.5 - 11})" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" opacity=".45"/>`;
  },
  bead(e, c, o, u, i, gaze, mat, s) {
    const r = e.a * 1.08, gx = e.x + gaze * 4, lid = e.open < 0.66 ? r * 2 * (1 - e.open) * 0.6 : 0, y0 = e.y - r * 1.66 - 12 * s.expr.brow;
    return `<clipPath id="${u}e${i}"><circle cx="${e.x}" cy="${e.y}" r="${r}"/></clipPath>
<circle cx="${e.x}" cy="${e.y}" r="${r}" fill="#f6f1e8"${mat('feature')}/>
<circle cx="${gx}" cy="${e.y + r * 0.12}" r="${r * 0.44}" fill="#17110e"/><circle cx="${gx - r * 0.16}" cy="${e.y - r * 0.06}" r="${r * 0.13}" fill="#fff"/>
${lid ? `<g clip-path="url(#${u}e${i})"><rect x="${e.x - r}" y="${e.y - r}" width="${r * 2}" height="${lid}" fill="${c.skinShade}"/></g>` : ''}
<path d="M${e.x - e.d * r * 0.95},${y0 + 3}Q${e.x + e.d * r * 0.1},${y0 - 9 - 12 * s.brows.arch} ${e.x + e.d * r * 1.2},${y0 + 7}" fill="none" stroke="${c.brow}" stroke-width="${13 + 10 * s.brows.weight}" stroke-linecap="round"${mat('feature')}/>`;
  },
};

const NOSES = {
  natural: (g, c, o, dir, blurS) => `<path d="M${g.nose.x - dir * 4},${g.m.eyeY + 22}L${g.nose.x - dir * 5},${g.nose.y - 16}" stroke="${c.skinLight}" stroke-width="8" stroke-linecap="round" opacity=".5"${blurS}/>
<path d="${g.nose.base}" fill="none" stroke="${c.line}" stroke-width="${o.lineW}" stroke-linecap="round" opacity=".6"/>
${[-1, 1].map(k => `<ellipse cx="${g.nose.x + k * g.nose.w * 0.5}" cy="${g.nose.y + 1}" rx="${g.nose.w * 0.2}" ry="${3.4 * g.nose.s}" fill="${c.line}" opacity=".55"/>`).join('')}`,
  soft: (g, c, o, dir, blurS) => `<ellipse cx="${g.nose.x - dir * 3}" cy="${g.nose.y - 8}" rx="${g.nose.w * 0.66}" ry="${g.nose.w * 0.52}" fill="${c.skinLight}" opacity=".6"${blurS}/>
<path d="${g.nose.base}" fill="none" stroke="${c.skinDeep}" stroke-width="${o.lineW}" stroke-linecap="round" opacity=".55"/>
<circle cx="${g.nose.x - dir * 5}" cy="${g.nose.y - 12}" r="4.5" fill="#fff" opacity=".5"/>`,
  hook: (g, c, o, dir) => `<path d="M${g.nose.x + dir * 4},${g.nose.y - 26}L${g.nose.x + dir * 11},${g.nose.y - 3}L${g.nose.x + dir},${g.nose.y + 1}" fill="none" stroke="${o.outline.color}" stroke-width="${o.lineW}" stroke-linecap="round" stroke-linejoin="round"/>`,
  blob: (g, c, o, dir, blurS, mat) => `<ellipse cx="${g.nose.x}" cy="${g.nose.y - 12}" rx="${g.nose.w * 0.95}" ry="${g.nose.w * 0.82 * g.nose.s}" fill="${c.skinLight}"${mat('feature')}/>`,
};

/** Combed strands or curl marks inside the hair mass, so it reads as hair and not as a cap. */
function strands(g, s, c, amount) {
  const { cx, top, hw, eyeY } = g.m, r = rng(s.seed + 911), st = s.hair.style, n = v => v.toFixed(0);
  let dark = '', light = '';
  if (st === 'curls' || st === 'crop') {
    for (let i = 0; i < 96; i++) {
      const x = cx + (r() - 0.5) * hw * 3.2, y = top - 70 + r() * (eyeY - top + 110), q = st === 'crop' ? 3 + r() * 3 : 9 + r() * 12, d = `M${n(x)},${n(y)}a${n(q)},${n(q)} 0 1 1 ${n(q * 1.5)},${n(q * 0.5)}`;
      if (i % 2) dark += d; else light += d;
    }
  } else {
    const px = cx + (st === 'part' ? -hw * 0.42 : 0), wave = st === 'waves' ? 30 : 0;
    for (let i = 0; i < 34; i++) {
      const t = (i + r() * 0.8) / 34 * 2 - 1, a = Math.abs(t);
      const d = `M${n(px + t * 14)},${n(top + 4)}Q${n(cx + t * hw * 1.36 + (r() - 0.5) * wave)},${n(top + 6 + a * 70)} ${n(cx + t * hw * 1.4)},${n(eyeY - 96 + a * a * 420)}`;
      if (i % 2) dark += d; else light += d;
    }
  }
  return `<g fill="none" stroke-linecap="round"><path d="${dark}" stroke="${c.hairShade}" stroke-width="3" opacity="${amount}"/><path d="${light}" stroke="${c.hairLight}" stroke-width="2.2" opacity="${(amount * 0.6).toFixed(2)}"/></g>`;
}

function paintMouth(g, c, o, u, ol) {
  const mo = g.mouth, simple = o.mouth === 'simple';
  const cavity = mo.inner ? `<clipPath id="${u}mo"><path d="${mo.inner}"/></clipPath><path d="${mo.inner}" fill="${o.mouthDark || '#3a1218'}"${simple ? ol : ''}/>
<g clip-path="url(#${u}mo)"><ellipse cx="${mo.x}" cy="${mo.dip + mo.gap + 4}" rx="${mo.w * 0.5}" ry="${mo.gap * 0.5}" fill="#b4545a"/><path d="${mo.teeth}" fill="#f5efe6"/></g>` : '';
  if (simple) {
    const ink = o.outline ? o.outline.color : c.line, y = mo.dip + mo.full + mo.gap + 10;
    return cavity + (o.lipAlpha ? `<path d="${mo.upper}" fill="${c.lip}" opacity="${o.lipAlpha}"/><path d="${mo.lower}" fill="${c.lipLight}" opacity="${o.lipAlpha}"/>` : '')
      + `<path d="${mo.seam}" fill="none" stroke="${ink}" stroke-width="${o.lineW + 1.5}" stroke-linecap="round"/>
<path d="M${mo.x - mo.w * 0.3},${y}Q${mo.x},${y + 6} ${mo.x + mo.w * 0.3},${y}" fill="none" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>`;
  }
  return cavity + `<path d="${mo.upper}" fill="${c.lip}"/><path d="${mo.lower}" fill="${c.lipLight}"/>
<ellipse cx="${mo.x}" cy="${mo.dip + mo.gap + mo.full * 0.8 + 3}" rx="${mo.w * 0.3}" ry="3" fill="#fff" opacity=".22"/>`
    + (mo.inner ? '' : `<path d="${mo.seam}" fill="none" stroke="${c.line}" stroke-width="${o.lineW - 0.5}" stroke-linecap="round" opacity=".8"/>`);
}

/**
 * Paints the figure in four strata the world can interleave with its own layers.
 * @returns {{ defs: string, behind: string, torso: string, head: string }}
 */
export function paintFigure(g, s, c, o) {
  o = { lineW: 3.5, blush: 0.28, shine: 0.4, strands: 0.5, eyes: 'natural', nose: 'natural', mouth: 'natural', ...o };
  const u = o.uid, m = g.m, dir = -o.light, gaze = s.expr.gaze || 0;
  const ol = o.outline ? ` stroke="${o.outline.color}" stroke-width="${o.outline.w}" stroke-linejoin="round" stroke-linecap="round"` : '';
  const soft = o.shade.mode === 'soft', A = o.shade.alpha;
  const blur = soft ? ` filter="url(#${u}soft)"` : '', blurS = soft ? ` filter="url(#${u}softer)"` : '';
  const shadeCol = soft ? c.skinDeep : c.skinShade, sa = v => soft ? Math.min(1, A * v) : (A ? 1 : 0);
  const tilt = `rotate(${(s.expr.tilt * 5).toFixed(2)} ${m.cx} ${m.chin})`;
  const skinFill = o.skinFill || c.skin, hairFill = o.hairFill || c.hair, beardCol = c.beard || c.hairShade;
  const mat = k => o.material && o.material[k] ? ` filter="url(#${o.material[k]})"` : '';
  const shaved = s.hair.style === 'shaved';

  const defs = `<clipPath id="${u}head"><path d="${g.head}"/></clipPath><clipPath id="${u}neck"><path d="${g.neck}"/></clipPath><clipPath id="${u}hair"><path d="${g.hair.front}"/></clipPath>
<filter id="${u}soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="16"/></filter>
<filter id="${u}softer" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6"/></filter>
${o.eyes === 'large' ? `<radialGradient id="${u}iris" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${tone(c.iris, { l: 0.22, c: 1.25 })}"/><stop offset=".62" stop-color="${c.iris}"/><stop offset="1" stop-color="${tone(c.iris, { l: -0.14 })}"/></radialGradient>` : ''}`;

  const behind = g.hair.back ? `<g transform="${tilt}"${mat('hair')}><path d="${g.hair.back}" fill="${o.hairBackFill || c.hairShade}"${ol}/></g>` : '';

  const torso = `<path d="${g.bust}" fill="${skinFill}"/><g${mat('body')}><path d="${g.neck}" fill="${o.neckFill || c.skinShade}"${ol}/></g>
<g clip-path="url(#${u}neck)"><ellipse cx="${m.cx}" cy="${m.chin + 10}" rx="${m.jw * 1.15}" ry="50" fill="${c.skinDeep}" opacity="${sa(1.6)}"${blurS}/></g>`;

  const shading = `<ellipse cx="${m.cx + dir * m.hw * (soft ? 1.05 : 1.42)}" cy="${m.eyeY + 30}" rx="${m.hw * 0.9}" ry="${m.low * 1.7}" fill="${shadeCol}" opacity="${sa(1)}"${blur}/>
${o.blush ? [-1, 1].map(k => `<ellipse cx="${m.cx + k * m.hw * 0.56}" cy="${m.eyeY + m.low * 0.36}" rx="${m.hw * 0.26}" ry="${m.hw * 0.19}" fill="${c.blush}" opacity="${o.blush}"${blurS}/>`).join('') : ''}
${shaved ? '' : `<path d="${g.hair.front}" transform="translate(${dir * -6} 16)" fill="${shadeCol}" opacity="${sa(0.9)}"${blurS}/>`}
${soft ? g.eyes.map(e => `<ellipse cx="${e.x}" cy="${e.y - e.b * 0.9}" rx="${e.a * 1.35}" ry="${e.b * 1.4 + 8}" fill="${shadeCol}" opacity="${A * 0.45}"${blurS}/>`).join('')
    + `<ellipse cx="${m.cx}" cy="${g.mouth.dip + g.mouth.full * 1.5 + g.mouth.gap + 15}" rx="${g.mouth.w * 0.45}" ry="7" fill="${shadeCol}" opacity="${A * 0.6}"${blurS}/>` : ''}
${o.nose === 'hook' || o.nose === 'blob' ? '' : `<path d="${poly([[m.cx + dir * 3, m.eyeY + 8], [m.cx + dir * g.nose.w * 1.1, g.nose.y - 6], [m.cx + dir * 4, g.nose.y + 3]])}" fill="${shadeCol}" opacity="${sa(0.75)}"${blurS}/>`}
${o.headFx || ''}`;

  const beard = g.beard.kind === 'full' ? `<path d="${g.beard.mass}" fill="${beardCol}"${ol}${mat('hair')}/>`
    : g.beard.kind === 'stubble' ? `<g clip-path="url(#${u}head)"><path d="${g.beard.mass}" fill="${beardCol}" opacity=".3" filter="url(#${u}softer)"/></g>` : '';
  const marks = g.lines.map(d => `<path d="${d}" fill="none" stroke="${c.line}" stroke-width="2.4" stroke-linecap="round" opacity="${0.22 + s.age * 0.3}"/>`).join('')
    + g.freckles.map(k => `<circle cx="${k.x.toFixed(1)}" cy="${k.y.toFixed(1)}" r="${k.r.toFixed(1)}" fill="${c.skinDeep}" opacity=".45"/>`).join('');

  let glasses = '';
  if (g.glasses) {
    const [a, b] = g.glasses, fw = o.frameW || 7, lens = o.lens || 'rgba(255,255,255,.1)';
    glasses = g.glasses.map(k => `<path d="${k.d}" fill="${lens}" stroke="${c.frame}" stroke-width="${fw}"/><path d="M${k.x - k.r * 0.5},${k.y - k.r * 0.2}l${k.r * 0.34},${-k.r * 0.3}" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>`).join('')
      + `<path d="M${a.x + a.half},${a.y - 4}Q${m.cx},${a.y - 15} ${b.x - b.half},${b.y - 4}M${a.x - a.half},${a.y - 6}L${m.cx - m.hw * 1.02},${a.y - 12}M${b.x + b.half},${b.y - 6}L${m.cx + m.hw * 1.02},${b.y - 12}" fill="none" stroke="${c.frame}" stroke-width="${fw}" stroke-linecap="round"/>`;
  }

  const hair = `<g${mat('hair')}><path d="${g.hair.front}" fill="${hairFill}"${ol}${shaved ? ' opacity=".45"' : ''}/>
${g.hair.bun ? `<circle cx="${g.hair.bun.x}" cy="${g.hair.bun.y}" r="${g.hair.bun.r}" fill="${hairFill}"${ol}/>` : ''}</g>
${shaved ? '' : `<g clip-path="url(#${u}hair)">${o.strands ? strands(g, s, c, o.strands) : ''}<ellipse cx="${m.cx + dir * m.hw * 0.95}" cy="${m.eyeY - 60}" rx="${m.hw * 0.7}" ry="${m.low * 2.2}" fill="${c.hairShade}" opacity=".55"${blur}/>
<ellipse cx="${m.cx - dir * m.hw * 0.34}" cy="${m.top + 44}" rx="${m.hw * 0.5}" ry="19" transform="rotate(${dir * -14} ${m.cx} ${m.top + 44})" fill="${c.hairLight}" opacity="${o.shine}"${blurS}/></g>`}`;

  const head = `<g transform="${tilt}"><g${mat('head')}>${g.ears.map(e => `<ellipse cx="${e.x}" cy="${e.y}" rx="${e.rx}" ry="${e.ry}" fill="${skinFill}"${ol}/><ellipse cx="${e.x - e.d * 2}" cy="${e.y + 2}" rx="${e.rx * 0.48}" ry="${e.ry * 0.6}" fill="${c.skinShade}" opacity=".7"/>`).join('')}
<path d="${g.head}" fill="${skinFill}"${ol}/></g>
<g clip-path="url(#${u}head)">${shading}</g>
${beard}${marks}
${g.eyes.map((e, i) => EYES[o.eyes](e, c, o, u, i, gaze, mat, s)).join('')}
${NOSES[o.nose](g, c, o, dir, blurS, mat)}
${paintMouth(g, c, o, u, ol)}
${g.beard.moustache ? `<path d="${g.beard.moustache}" fill="${beardCol}"${ol}${mat('hair')}/>` : ''}
${o.eyes === 'bead' ? '' : g.brows.map(d => `<path d="${d}" fill="${c.brow}"/>`).join('')}
${hair}${glasses}${o.afterHead || ''}</g>`;

  return { defs, behind, torso, head };
}
