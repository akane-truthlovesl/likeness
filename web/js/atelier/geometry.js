/** Portrait geometry: one parametric face that every world draws. Coordinates live on a 900 × 1200 plate. */

export const W = 900, H = 1200;

const f = n => Math.round(n * 10) / 10;
const pt = p => f(p[0]) + ',' + f(p[1]);

/** Catmull-Rom spline through the points, expressed as a cubic Bézier path. */
export function spline(pts, closed = true, k = 1) {
  const n = pts.length;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  let d = 'M' + pt(pts[0]);
  for (let i = 0, segs = closed ? n : n - 1; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += 'C' + pt([p1[0] + (p2[0] - p0[0]) / 6 * k, p1[1] + (p2[1] - p0[1]) / 6 * k]) + ' '
      + pt([p2[0] - (p3[0] - p1[0]) / 6 * k, p2[1] - (p3[1] - p1[1]) / 6 * k]) + ' ' + pt(p2);
  }
  return d + (closed ? 'Z' : '');
}

export const poly = (pts, closed = true) => 'M' + pts.map(pt).join('L') + (closed ? 'Z' : '');
export const mirror = (pts, cx = W / 2) => pts.map(([x, y]) => [2 * cx - x, y]);
/** Right half listed top-centre → bottom-centre; returns the whole symmetric outline. */
export const sym = (right, cx = W / 2) => [...right, ...mirror(right, cx).reverse().filter(p => Math.abs(p[0] - cx) > 0.5)];
export const oval = (cx, cy, rx, ry = rx) =>
  `M${f(cx - rx)},${f(cy)}a${f(rx)},${f(ry)} 0 1,0 ${f(rx * 2)},0a${f(rx)},${f(ry)} 0 1,0 ${f(-rx * 2)},0Z`;
export const rrect = (x, y, w, h, r) =>
  `M${f(x + r)},${f(y)}h${f(w - 2 * r)}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(r)}v${f(h - 2 * r)}a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(r)}h${f(2 * r - w)}a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(-r)}v${f(2 * r - h)}a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(-r)}Z`;

/** Deterministic random numbers, so a sitter always draws the same way. */
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** How each world bends the anatomy. Natural proportions are 1 throughout. */
export const PROPORTIONS = {
  natural: { headW: 1, headH: 1, lower: 1, jaw: 1, chin: 1, eye: 1, eyeTall: 1, eyeGap: 1, nose: 1, mouth: 1, neck: 1, neckLen: 1, shoulders: 1, hair: 1, dy: 0 },
  cinema: { headW: 1.14, headH: 1.06, lower: 0.9, jaw: 0.9, chin: 0.82, eye: 1.5, eyeTall: 1.9, eyeGap: 1.06, nose: 0.72, mouth: 0.92, neck: 0.7, neckLen: 0.9, shoulders: 0.82, hair: 1.12, dy: 10 },
  cel: { headW: 1.04, headH: 1.02, lower: 0.97, jaw: 0.84, chin: 0.5, eye: 1.3, eyeTall: 2.2, eyeGap: 1.02, nose: 0.6, mouth: 0.8, neck: 0.78, neckLen: 1, shoulders: 0.9, hair: 1.1, dy: 0 },
  clay: { headW: 1.12, headH: 1, lower: 0.98, jaw: 1.08, chin: 1.2, eye: 1, eyeTall: 1, eyeGap: 0.8, nose: 1.1, mouth: 1.1, neck: 0.95, neckLen: 0.8, shoulders: 0.92, hair: 1.08, dy: 10 },
};

function hairShapes(s, m, p) {
  const { cx, eyeY, hw, top, chin } = m, v = p.hair, st = s.hair.style;
  const up = n => top - n * v;
  const capOuter = lift => [[cx, up(lift)], [cx + hw * 0.6, up(lift * 0.55)], [cx + hw * 1.04, top + 74], [cx + hw * 1.08, eyeY - 60], [cx + hw * 1.03, eyeY - 6]];
  const capInner = hl => [[cx + hw * 0.93, eyeY - 30], [cx + hw * 0.87, eyeY - 96], [cx + hw * 0.58, eyeY - hl + 14], [cx + hw * 0.2, eyeY - hl], [cx, eyeY - hl - 2]];
  const cap = (lift, hl) => {
    const o = capOuter(lift), i = capInner(hl);
    return spline([...o, ...i, ...mirror(i, cx).reverse().slice(1), ...mirror(o, cx).reverse().slice(0, -1)]);
  };
  const scallop = (ox, oy, R, from, to, n, amp, phase) => Array.from({ length: n + 1 }, (_, i) => {
    const a = (from + (to - from) * i / n) * Math.PI / 180, r = R * (1 + amp * Math.sin(i * 2.4 + phase));
    return [ox + r * Math.cos(a), oy - r * Math.sin(a)];
  });
  let back = '', front = '', bun = null;

  if (st === 'shaved') front = cap(3, 150);
  else if (st === 'crop') front = cap(24, 160);
  else if (st === 'bun') { front = cap(18, 166); bun = { x: cx + hw * 0.1, y: up(60), r: hw * 0.44 * v }; }
  else if (st === 'part') {
    front = spline([[cx - hw * 0.3, up(40)], [cx + hw * 0.5, up(38)], [cx + hw * 1.08, top + 66], [cx + hw * 1.1, eyeY - 58], [cx + hw * 1.03, eyeY - 6],
      [cx + hw * 0.93, eyeY - 34], [cx + hw * 0.9, eyeY - 84], [cx + hw * 0.64, eyeY - 112], [cx + hw * 0.12, eyeY - 142], [cx - hw * 0.44, eyeY - 176],
      [cx - hw * 0.72, eyeY - 138], [cx - hw * 0.89, eyeY - 88], [cx - hw * 0.93, eyeY - 30], [cx - hw * 1.03, eyeY - 6], [cx - hw * 1.07, eyeY - 62], [cx - hw * 0.98, top + 60]]);
  } else if (st === 'curls') {
    const R = hw * 1.34 * v, oy = eyeY - 92;
    const fringe = Array.from({ length: 6 }, (_, i) => [cx + hw * (0.62 - 0.248 * i), eyeY - 132 + (i % 2 ? 9 : -5)]);
    front = spline([...scallop(cx, oy, R, 198, -18, 26, 0.055, s.seed % 7),
      [cx + hw * 0.99, eyeY - 14], [cx + hw * 0.88, eyeY - 90], ...fringe, [cx - hw * 0.88, eyeY - 90], [cx - hw * 0.99, eyeY - 14]]);
    back = spline(scallop(cx, eyeY - 66, R * 0.98, 0, 346, 30, 0.05, 2));
  } else if (st === 'bob') {
    const outer = [[cx, up(30)], [cx + hw * 0.78, up(8)], [cx + hw * 1.22, eyeY - 104], [cx + hw * 1.3, eyeY + 40], [cx + hw * 1.24, chin - 30]];
    const inner = [[cx + hw * 1.0, chin - 14], [cx + hw * 0.88, chin - 70], [cx + hw * 0.9, eyeY + 4], [cx + hw * 0.84, eyeY - 56], [cx + hw * 0.4, eyeY - 70], [cx, eyeY - 64]];
    back = spline(sym([...outer, [cx + hw * 0.96, chin + 10], [cx, chin - 4]], cx));
    front = spline([...outer, ...inner, ...mirror(inner, cx).reverse().slice(1), ...mirror(outer, cx).reverse().slice(0, -1)]);
  } else { // long, waves
    const wav = st === 'waves' ? 1 : 0, wx = (y, a = 1) => wav * a * hw * 0.075 * Math.sin(y * 0.034);
    const outer = [[cx, up(28)], [cx + hw * 0.8, up(6)], [cx + hw * 1.22, eyeY - 100], [cx + hw * 1.32 + wx(eyeY + 60), eyeY + 60],
      [cx + hw * 1.36 + wx(chin + 40), chin + 40], [cx + hw * 1.44 + wx(chin + 150), chin + 150], [cx + hw * 1.4 + wx(chin + 250), chin + 250]];
    back = spline(sym([...outer, [cx + hw * 0.9, chin + 300], [cx, chin + 286]], cx));
    const panel = [[cx + 3, up(26)], ...outer.slice(1), [cx + hw * 0.98, chin + 262], [cx + hw * 0.9 + wx(chin + 120, -1), chin + 120], [cx + hw * 0.94, chin - 20],
      [cx + hw * 0.91, eyeY + 24], [cx + hw * 0.8, eyeY - 66], [cx + hw * 0.46, eyeY - 142], [cx + 3, eyeY - 176]];
    front = spline(panel) + spline(mirror(panel, cx).reverse());
  }
  return { back, front, bun };
}

/**
 * Builds every path of the portrait for a sitter under a set of proportions.
 * @param {any} s sitter @param {typeof PROPORTIONS.natural} p
 */
export function build(s, p = PROPORTIONS.natural) {
  const cx = W / 2, eyeY = 520 + p.dy;
  const hw = 150 * (0.93 + 0.14 * s.face.width) * p.headW;
  const top = eyeY - 236 * p.headH;
  const low = 206 * (0.95 + 0.1 * s.face.length) * p.headH * p.lower;      // eye line → chin
  const chin = eyeY + low;
  const jw = hw * (0.7 + 0.22 * s.face.jaw) * p.jaw;
  const cw = hw * (0.26 + 0.26 * s.face.chin) * p.chin;
  const jawY = eyeY + low * 0.62, mouthY = eyeY + low * 0.7, noseY = eyeY + low * 0.43;

  const head = spline(sym([
    [cx, top], [cx + hw * 0.56, top + 22 * p.headH], [cx + hw * 0.94, top + 100 * p.headH],
    [cx + hw, eyeY - 34], [cx + hw * (0.97 + 0.03 * s.face.cheek), eyeY + low * 0.3],
    [cx + jw, jawY], [cx + jw * 0.5 + cw * 0.62, chin - low * 0.15], [cx + cw * 0.72, chin - 7], [cx, chin],
  ], cx));

  const nw = jw * 0.64 * p.neck, shY = chin + 92 * p.neckLen, sw = 322 * p.shoulders;
  const neck = poly([[cx - nw, jawY - 10], [cx - nw * 1.1, shY + 40], [cx + nw * 1.1, shY + 40], [cx + nw, jawY - 10]]);
  const shoulder = [[cx + nw * 1.05, shY - 6], [cx + sw * 0.55, shY + 26], [cx + sw, shY + 78], [cx + sw + 44, shY + 190], [cx + sw + 62, H + 40]];
  const bust = spline([...mirror(shoulder, cx).reverse(), ...shoulder], false) + 'Z';
  const ears = [-1, 1].map(d => ({ x: cx + d * (hw + 5), y: eyeY + 20 * p.headH, rx: 19 * p.headW + 3, ry: 40 * p.headH, d }));

  const es = hw * (0.43 + 0.07 * s.eyes.spacing) * p.eyeGap;               // half the distance between pupils
  const ea = hw * (0.2 + 0.035 * s.eyes.size) * p.eye;                     // half an eye's width
  const open = Math.max(0.28, 1 - 0.55 * s.expr.squint - 0.22 * Math.max(0, s.expr.smile - 0.5));
  const eb = ea * 0.46 * p.eyeTall * open;
  const slant = (s.eyes.tilt - 0.5) * 10;
  const eyes = [-1, 1].map(d => {
    const x = cx + d * es, y = eyeY;
    const inner = [x - d * ea, y + 2 + slant * 0.3], outer = [x + d * ea, y - slant];
    const lid = `M${pt(inner)}Q${f(x - d * ea * 0.1)},${f(y - eb * 1.75)} ${pt(outer)}`;
    return { x, y, d, a: ea, b: eb, open, lid, almond: lid + `Q${f(x + d * ea * 0.1)},${f(y + eb * 1.5)} ${pt(inner)}Z`, inner, outer };
  });

  const bw = 7 + 9 * s.brows.weight, raise = s.expr.brow;
  const by = eyeY - eb - 27 * p.headH - 9 * raise;
  const brows = eyes.map(e => {
    const d = e.d, a = [e.x - d * e.a * 1.15, by + 5 + 9 * Math.max(0, -raise)];
    const peak = [e.x + d * e.a * 0.35, by - 6 - 8 * s.brows.arch], tail = [e.x + d * e.a * 1.3, by + 5];
    return spline([a, peak, tail, [peak[0], peak[1] + bw * 0.8], [a[0], a[1] + bw]]);
  });

  const ns = (0.9 + 0.3 * s.nose.size) * p.nose, nwid = (20 + 12 * s.nose.width) * p.nose;
  const nose = {
    x: cx, y: noseY, w: nwid, s: ns,
    base: spline([[cx - nwid, noseY - 7 * ns], [cx - nwid * 0.58, noseY + 4 * ns], [cx - nwid * 0.2, noseY], [cx, noseY + 6 * ns], [cx + nwid * 0.2, noseY], [cx + nwid * 0.58, noseY + 4 * ns], [cx + nwid, noseY - 7 * ns]], false),
  };

  const mw = hw * (0.34 + 0.09 * s.mouth.width) * p.mouth, S = s.expr.smile, O = s.expr.open, full = 4 + 7 * s.mouth.full;
  const cyc = mouthY - 13 * S, dip = mouthY + 6 * S + 2, gap = O * 30 * p.mouth;
  const L = [cx - mw, cyc], Rt = [cx + mw, cyc];
  const seamPts = [L, [cx - mw * 0.45, dip - 1], [cx, dip + 1], [cx + mw * 0.45, dip - 1], Rt];
  const dropPts = [[cx + mw * 0.45, dip - 1 + gap * 0.8], [cx, dip + 1 + gap], [cx - mw * 0.45, dip - 1 + gap * 0.8]];
  const mouth = {
    x: cx, y: mouthY, w: mw, gap, full, cornerY: cyc, dip,
    upper: spline([L, [cx - mw * 0.42, mouthY - full - 5 - 2 * S], [cx, mouthY - full * 0.55 - 3], [cx + mw * 0.42, mouthY - full - 5 - 2 * S], Rt, ...seamPts.slice(1, 4).reverse()]),
    lower: spline([L, ...dropPts.slice().reverse(), Rt, [cx + mw * 0.5, dip + full * 1.1 + gap * 0.95 + 4], [cx, dip + full * 1.5 + gap + 6], [cx - mw * 0.5, dip + full * 1.1 + gap * 0.95 + 4]]),
    seam: spline(seamPts, false),
    inner: gap > 4 ? spline([...seamPts, ...dropPts]) : '',
    teeth: gap > 4 ? spline([[cx - mw * 0.78, cyc + 3 + 3 * S], ...seamPts.slice(1, 4), [cx + mw * 0.78, cyc + 3 + 3 * S], [cx + mw * 0.42, dip + gap * 0.42], [cx, dip + 2 + gap * 0.5], [cx - mw * 0.42, dip + gap * 0.42]]) : '',
  };

  const beard = { kind: s.beard, moustache: '', mass: '' };
  if (s.beard === 'moustache' || s.beard === 'full') {
    const t = mouthY - full;
    beard.moustache = spline([[cx - mw * 0.98, cyc - 4], [cx - mw * 0.5, t - 16], [cx, t - 11], [cx + mw * 0.5, t - 16], [cx + mw * 0.98, cyc - 4], [cx + mw * 0.5, t - 3], [cx, t - 6], [cx - mw * 0.5, t - 3]]);
  }
  if (s.beard === 'full' || s.beard === 'stubble') {
    const drop = s.beard === 'full' ? 24 : 0;
    beard.mass = spline(sym([[cx, noseY + 18], [cx + mw * 0.7, mouthY - full - 16], [cx + hw * 0.6, mouthY - 30], [cx + hw * 0.9, eyeY + low * 0.26], [cx + hw * 1.0, eyeY + low * 0.12],
      [cx + hw * 0.99, eyeY + low * 0.36], [cx + jw * 1.02, jawY + 4], [cx + jw * 0.52 + cw * 0.64, chin - low * 0.13 + drop * 0.7], [cx + cw * 0.74, chin - 4 + drop], [cx, chin + 2 + drop]], cx));
  }

  const glasses = s.glasses === 'none' ? null : eyes.map(e => {
    const r = Math.max(e.a * 1.45, e.b * 1.5 + 8, 40 * p.headW), y = e.y + 3;
    const half = s.glasses === 'round' ? r : r * 1.08;
    return { x: e.x, y, r, half, d: s.glasses === 'round' ? oval(e.x, y, r, r * 0.96) : rrect(e.x - half, y - r * 0.76, half * 2, r * 1.52, r * 0.3) };
  });

  const lines = [];
  if (s.age > 0.35) {
    const fold = [[cx + nwid * 1.25, noseY - 2], [cx + mw * 1.12, mouthY - 22], [cx + mw * 1.2, mouthY + 8]];
    lines.push(spline(fold, false), spline(mirror(fold, cx), false));
    for (const e of eyes) for (const k of [-1, 1]) lines.push(poly([[e.x + e.d * e.a * 1.18, e.y + k * 3], [e.x + e.d * e.a * 1.55, e.y + k * 13 - 2]], false));
    if (s.age > 0.6) for (const k of [0, 1]) lines.push(spline([[cx - hw * 0.5, eyeY - 108 - k * 24], [cx, eyeY - 114 - k * 24], [cx + hw * 0.5, eyeY - 108 - k * 24]], false));
  }
  const rnd = rng(s.seed || 7);
  const freckles = s.freckles ? Array.from({ length: 34 }, () => {
    const side = rnd() < 0.5 ? -1 : 1, onNose = rnd() < 0.22;
    return { x: cx + (onNose ? (rnd() - 0.5) * nwid * 1.4 : side * hw * (0.28 + rnd() * 0.44)), y: eyeY + low * (0.2 + rnd() * 0.22), r: 1.6 + rnd() * 1.8 };
  }) : [];

  const m = { cx, eyeY, hw, top, chin, low, jw, cw, jawY, mouthY, noseY, nw, shY, sw };
  const hair = hairShapes(s, m, p);
  return { m, head, neck, bust, shoulder, ears, eyes, brows, nose, mouth, beard, glasses, lines, freckles, hair };
}

/** Clothing outline over the bust: a crew or V neckline, `depth` below the shoulder line. */
export function garment(g, depth = 40, vee = false) {
  const { cx, shY } = g.m, Rr = g.shoulder, Ll = mirror(Rr, cx).reverse(), b = Rr[0];
  const neckline = vee ? `L${f(cx)},${f(shY + depth)}L${pt(b)}` : `Q${f(cx)},${f(shY + depth * 1.9)} ${pt(b)}`;
  return spline(Ll, false) + neckline + spline(Rr, false).replace(/^M[^C]*/, '') + 'Z';
}
