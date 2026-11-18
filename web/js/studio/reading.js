/**
 * The reading: what the device can tell about a face without sending it anywhere.
 * Landmarks and expression come from MediaPipe's Face Landmarker; colours are sampled from the photograph;
 * hair is outlined by a small segmenter. The result is a sitter the atelier can draw, and it is offered to
 * the person as a reading to correct, never as a fact.
 */
import { chroma, lightness, mix, tone } from '../atelier/color.js';

const VENDOR = new URL('../../vendor/mediapipe/', import.meta.url).href;
let reader = null;

/** MediaPipe writes its start-up notes to stderr, which the browser shows as errors. They are notes. */
function quietRuntimeNotes() {
  const error = console.error.bind(console), warn = console.warn.bind(console), note = /^(INFO|WARNING):|^[IWE]\d{4} |XNNPACK|gl_context|Graph successfully|OpenGL error checking/;
  const route = original => (...args) => (typeof args[0] === 'string' && note.test(args[0]) ? console.debug(...args) : original(...args));
  console.error = route(error); console.warn = route(warn);
}

/** Loads the reader once. Rejects where WebAssembly or the models are unavailable; callers fall back to asking. */
export function loadReader() {
  reader ||= (async () => {
    quietRuntimeNotes();
    const vision = await import(VENDOR + 'vision_bundle.mjs');
    const files = await vision.FilesetResolver.forVisionTasks(VENDOR + 'wasm');
    const face = await vision.FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: VENDOR + 'face_landmarker.task', delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 1, outputFaceBlendshapes: true,
    });
    let hair = null;
    try {
      hair = await vision.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: VENDOR + 'hair_segmenter.tflite', delegate: 'CPU' }, runningMode: 'IMAGE', outputCategoryMask: true, outputConfidenceMasks: false,
      });
    } catch { /* hair falls back to colour sampling */ }
    return { face, hair };
  })();
  reader.catch(() => { reader = null; });
  return reader;
}

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const unit = (v, lo, hi) => clamp((v - lo) / (hi - lo));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const hex = rgb => '#' + rgb.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
const luma = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const median = px => { if (!px.length) return null; const ch = k => px.map(p => p[k]).sort((a, b) => a - b)[px.length >> 1]; return [ch(0), ch(1), ch(2)]; };

/** Landmark indices of the canonical face mesh that the reading uses. */
const P = { top: 10, chin: 152, left: 234, right: 454, jawL: 172, jawR: 397, chinL: 148, chinR: 377, eyeLo: 33, eyeLi: 133, eyeLt: 159, eyeLb: 145, eyeRi: 362, eyeRo: 263,
  browLo: 70, browLm: 105, browLi: 107, bridge: 168, noseBase: 2, noseTip: 1, alaL: 129, alaR: 358, mouthL: 61, mouthR: 291, lipTop: 0, lipIn: 13, lipInLow: 14, lipLow: 17,
  cheekL: 205, cheekR: 425, forehead: 151, irisL: 468, irisR: 473 };
/** A constellation worth drawing: the points and the lines between them. */
const STARS = [10, 109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338,
  70, 63, 105, 66, 107, 336, 296, 334, 293, 300, 33, 160, 158, 133, 153, 144, 362, 385, 387, 263, 373, 380, 168, 6, 197, 195, 5, 1, 129, 358, 2, 61, 39, 0, 269, 291, 405, 17, 181, 468, 473];

function sampler(canvas) {
  const W = canvas.width, H = canvas.height, data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
  const at = (x, y) => { const i = (clamp(Math.round(y), 0, H - 1) * W + clamp(Math.round(x), 0, W - 1)) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const disc = (c, r) => { const px = [], q = Math.max(1, r / 5); for (let y = -r; y <= r; y += q) for (let x = -r; x <= r; x += q) if (x * x + y * y <= r * r) px.push(at(c[0] + x, c[1] + y)); return median(px); };
  return { at, disc, inside: c => c[0] > 2 && c[1] > 2 && c[0] < W - 2 && c[1] < H - 2 };
}

/** Reads the hair from the segmenter's mask: how high it stands, how far it falls, how wide it spreads. Medians, so stray pixels decide nothing. */
function hairFromMask(mask, mw, mh, s, g) {
  const sx = mw / s.W, sy = mh / s.H, on = (x, y) => { x = Math.round(x * sx); y = Math.round(y * sy); return x >= 0 && y >= 0 && x < mw && y < mh && mask[y * mw + x] > 0; };
  const step = Math.max(1, g.FH / 80), col = g.FW / 24, mid = v => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : null);
  const tops = [], heights = [], falls = [], colour = [];
  let wide = 0, wideAll = 0, area = 0;
  for (let x = g.cx - g.FW * 0.9; x <= g.cx + g.FW * 0.9; x += col) {
    let top = null, low = null;
    for (let y = 0; y < s.H; y += step) if (on(x, y)) {
      top ??= y; low = y; area += step * col;
      if (colour.length < 500 && on(x - col, y) && on(x + col, y) && on(x, y - step * 2) && on(x, y + step * 2)) colour.push(s.at(x, y));
    }
    const off = Math.abs(x - g.cx) / g.FW;
    if (off < 0.3) { tops.push(top); if (top != null) heights.push((g.top[1] - top) / g.FH); }
    if (off > 0.42 && off < 0.75) falls.push(low == null ? 0 : (low - g.eyeY) / g.FH);
    if (off > 0.58) { wideAll++; if (top != null && top < g.eyeY) wide++; }
  }
  let rough = 0, n = 0;
  for (let i = 1; i < tops.length - 1; i++) if (tops[i - 1] != null && tops[i] != null && tops[i + 1] != null) { rough += Math.abs(tops[i - 1] - 2 * tops[i] + tops[i + 1]); n++; }
  const m = { height: mid(heights) ?? 0, fall: Math.max(0, mid(falls) ?? 0), spread: wideAll ? wide / wideAll : 0, rough: n ? rough / n / g.FH : 0, covered: heights.length / Math.max(1, tops.length), area: area / (g.FW * g.FH) };
  const big = m.height > 0.4 && m.spread > 0.45;
  const style = m.covered < 0.3 || m.area < 0.06 ? null   // nothing outlined: shaved, or simply not seen; the caller decides by colour
    : m.fall > 0.95 ? (m.rough > 0.024 || big ? 'waves' : 'long')
    : m.fall > 0.45 ? (big ? 'curls' : 'bob')
    : m.height > 0.72 && m.spread < 0.2 ? 'bun' : big || m.height > 0.5 ? 'curls' : m.height > 0.24 ? 'part' : 'crop';
  return { style, colour: median(colour), measures: m };
}

/**
 * Reads a face from a canvas. Resolves null when no face is found.
 * @param {HTMLCanvasElement} canvas
 * @returns {Promise<null | { sitter: any, points: number[][], frame: { size: number, x: number, y: number, roll: number, light: number }, measures: any, ms: number }>}
 */
export async function read(canvas) {
  const { face, hair } = await loadReader(), t0 = performance.now();
  const found = face.detect(canvas), lm = found.faceLandmarks?.[0];
  if (!lm) return null;
  const W = canvas.width, H = canvas.height, pt = i => [lm[i].x * W, lm[i].y * H], s = { ...sampler(canvas), W, H };
  const shape = Object.fromEntries((found.faceBlendshapes?.[0]?.categories || []).map(c => [c.categoryName, c.score])), bs = (...k) => k.reduce((t, n) => t + (shape[n] || 0), 0) / k.length;
  const top = pt(P.top), chin = pt(P.chin), L = pt(P.left), Rt = pt(P.right), FW = dist(L, Rt), FH = dist(top, chin);
  const eyeL = [(pt(P.eyeLo)[0] + pt(P.eyeLi)[0]) / 2, (pt(P.eyeLo)[1] + pt(P.eyeLi)[1]) / 2], eyeR = [(pt(P.eyeRi)[0] + pt(P.eyeRo)[0]) / 2, (pt(P.eyeRi)[1] + pt(P.eyeRo)[1]) / 2];
  const g = { top, FW, FH, cx: (L[0] + Rt[0]) / 2, eyeY: (eyeL[1] + eyeR[1]) / 2 }, roll = Math.atan2(eyeR[1] - eyeL[1], eyeR[0] - eyeL[0]) * 180 / Math.PI;

  // Colour: medians of small discs, so a highlight or a stray hair does not decide anything.
  const q = FW * 0.045, skinPx = [P.cheekL, P.cheekR, P.forehead].map(i => s.disc(pt(i), q)).filter(Boolean), skin = median(skinPx) || [200, 160, 130];
  const iris = median([P.irisL, P.irisR].filter(i => lm[i]).map(i => s.disc(pt(i), FW * 0.016)).filter(Boolean)) || [70, 50, 40];
  const chest = [[g.cx, chin[1] + FH * 0.78], [g.cx - FW * 0.5, chin[1] + FH * 0.86], [g.cx + FW * 0.5, chin[1] + FH * 0.86]].filter(s.inside).map(c => s.disc(c, q * 1.4)).filter(Boolean);
  const jawPatch = median([[(chin[0] + pt(P.jawL)[0]) / 2, (chin[1] + pt(P.jawL)[1]) / 2 - FH * 0.03], [(chin[0] + pt(P.jawR)[0]) / 2, (chin[1] + pt(P.jawR)[1]) / 2 - FH * 0.03], [chin[0], (chin[1] + pt(P.lipLow)[1]) / 2]].map(c => s.disc(c, q)).filter(Boolean)) || skin;
  const lipPatch = s.disc([(pt(P.noseBase)[0] + pt(P.lipTop)[0]) / 2, (pt(P.noseBase)[1] + pt(P.lipTop)[1]) / 2], q * 0.7) || skin;
  const browPatch = median([P.browLm, 334].map(i => s.disc(pt(i), q * 0.5)).filter(Boolean)) || skin;

  // Glasses leave a thin dark rim under each eye and a bridge between them.
  const rim = (from, down) => { let lowest = 1, ref = luma(s.at(from[0], from[1] + down * 1.1)); for (let k = 0.25; k <= 1; k += 0.05) lowest = Math.min(lowest, luma(s.at(from[0], from[1] + down * k))); return ref - lowest; };
  const rims = [rim(pt(P.eyeLb), FH * 0.13), rim(pt(374), FH * 0.13)], glasses = Math.min(...rims) > 0.26 ? 'round' : 'none';   // deliberately hard to trigger: a missed pair is one tap, a phantom pair is a stranger

  let hairRead = null;
  if (hair) {
    try {
      const seg = hair.segment(canvas), mask = seg.categoryMask;
      hairRead = hairFromMask(mask.getAsUint8Array(), mask.width, mask.height, s, g);
      seg.close?.();
    } catch { /* the outline is a refinement, not a requirement */ }
  }
  const above = s.disc([top[0], Math.max(2, top[1] - FH * 0.14)], q * 1.2) || skin;
  const hairRgb = (hairRead?.style && hairRead.colour) || above, hairHex = hex(hairRgb), silver = chroma(hairHex) < 0.03 && lightness(hairHex) > 0.62;
  const style = hairRead?.style || (Math.abs(luma(above) - luma(skin)) < 0.08 ? 'shaved' : 'crop');

  const dJaw = luma(skin) - luma(jawPatch), dLip = luma(skin) - luma(lipPatch);
  const beard = dJaw > 0.3 ? 'full' : dJaw > 0.2 ? 'stubble' : dLip > 0.24 ? 'moustache' : 'none';
  const smile = bs('mouthSmileLeft', 'mouthSmileRight'), frown = bs('mouthFrownLeft', 'mouthFrownRight');
  const browArch = (((pt(P.browLo)[1] + pt(P.browLi)[1]) / 2 - pt(P.browLm)[1]) / dist(pt(P.browLo), pt(P.browLi)));

  const raw = { chin: dist(pt(P.chinL), pt(P.chinR)) / FW, length: FH / FW, brow: luma(skin) - luma(browPatch), nose: dist(pt(P.bridge), pt(P.noseBase)) / FH, noseWidth: dist(pt(P.alaL), pt(P.alaR)) / FW };
  const sitter = {
    id: 'me-' + Date.now().toString(36), caption: 'You', scene: 'stairwell', note: 'Read on this device', seed: (Date.now() ^ Math.round(FW * 7919 + FH * 104729)) >>> 0,
    skin: hex(skin), hair: silver ? { style, color: '#6a5a4c', grey: unit(lightness(hairHex), 0.45, 0.85) } : { style, color: hairHex, grey: 0 },
    face: { width: unit(FW / dist(eyeL, eyeR), 1.95, 2.55), jaw: unit(dist(pt(P.jawL), pt(P.jawR)) / FW, 0.74, 0.96), chin: unit(raw.chin, 0.1, 0.24), cheek: 0.5, length: unit(raw.length, 1.0, 1.36) },
    eyes: { size: unit(dist(pt(P.eyeLo), pt(P.eyeLi)) / FW, 0.17, 0.25), spacing: unit(dist(pt(P.eyeLi), pt(P.eyeRi)) / FW, 0.2, 0.3), tilt: clamp(0.5 + (pt(P.eyeLi)[1] - pt(P.eyeLo)[1]) / FW * 4), color: lightness(hex(iris)) < 0.3 ? mix(hex(iris), '#3b2a1e', 0.6) : tone(hex(iris), { l: 0.04, c: 1.2 }) },
    brows: { weight: unit(raw.brow, 0.03, 0.26), arch: unit(browArch, 0.04, 0.26) },
    nose: { size: unit(raw.nose, 0.25, 0.37), width: unit(raw.noseWidth, 0.24, 0.4) },
    mouth: { width: unit(dist(pt(P.mouthL), pt(P.mouthR)) / FW - smile * 0.05, 0.3, 0.44), full: unit((dist(pt(P.lipTop), pt(P.lipIn)) + dist(pt(P.lipInLow), pt(P.lipLow))) / FH, 0.05, 0.13) },
    beard, glasses, age: 0.25, freckles: false, outfit: 'jacket', cloth: chest.length ? hex(median(chest)) : '#56616d',
    expr: {
      smile: clamp(0.18 + smile * 0.9 - frown * 0.6, -0.3, 1), open: clamp(Math.max(bs('jawOpen') * 1.5, dist(pt(P.lipIn), pt(P.lipInLow)) / FH * 9) - 0.08), brow: clamp(bs('browInnerUp', 'browOuterUpLeft', 'browOuterUpRight') * 1.5 - Math.max(0, bs('browDownLeft', 'browDownRight') - 0.45) * 1.2, -0.4, 1),
      squint: clamp(bs('eyeSquintLeft', 'eyeSquintRight') * 0.9 + bs('eyeBlinkLeft', 'eyeBlinkRight') * 0.4), tilt: clamp(roll / 12, -1, 1), gaze: clamp((shape.eyeLookOutLeft || 0) - (shape.eyeLookInLeft || 0), -1, 1) * 0.6,
    },
  };
  return {
    sitter, points: STARS.filter(i => lm[i]).map(i => [lm[i].x, lm[i].y]),
    frame: { size: FW / W, x: g.cx / W - 0.5, y: (g.eyeY / H) - 0.42, roll, light: luma(skin) },
    measures: { ...(hairRead?.measures || {}), ...raw, rimL: rims[0], rimR: rims[1], dJaw, dLip }, ms: performance.now() - t0,
  };
}

/** How a framed face sits in the viewfinder, in words a photographer would use. */
export function composure(frame) {
  if (!frame) return { ok: false, cue: 'Step into the frame.', face: 'none' };
  const cue = frame.size < 0.3 ? 'Come a little closer.' : frame.size > 0.62 ? 'A half-step back.'
    : Math.abs(frame.x) > 0.12 ? 'Drift to the centre.' : Math.abs(frame.y) > 0.14 ? (frame.y > 0 ? 'Lift the phone a little.' : 'Lower the phone a little.')
    : Math.abs(frame.roll) > 8 ? 'Level your head.' : frame.light < 0.26 ? 'Find a window, if you can.' : frame.light > 0.9 ? 'Step out of the glare.' : '';
  return { ok: !cue, cue: cue || 'Hold that.', face: 'found' };
}

/**
 * Watches a video a few times a second and reports how the sitter is framed. Returns a function that stops it.
 * @param {HTMLVideoElement} video @param {(c: ReturnType<typeof composure> & { frame?: any }) => void} onCue
 */
export function watch(video, onCue) {
  const small = document.createElement('canvas'), ctx = small.getContext('2d', { willReadFrequently: true });
  small.width = 240; small.height = 320;
  let live = true, busy = false;
  const timer = setInterval(async () => {
    if (!live || busy || video.readyState < 2 || !video.videoWidth) return;
    busy = true;
    try {
      const { face } = await loadReader(), vw = video.videoWidth, vh = video.videoHeight, cw = Math.min(vw, vh * 0.75), ch = cw / 0.75;
      ctx.drawImage(video, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, 240, 320);
      const lm = face.detect(small).faceLandmarks?.[0];
      if (!live) return;
      if (!lm) return onCue(composure(null));
      const d = ctx.getImageData(Math.round(lm[P.forehead].x * 240), Math.round(lm[P.forehead].y * 320), 1, 1).data;
      const eL = lm[P.eyeLo], eR = lm[P.eyeRo], frame = { size: lm[P.right].x - lm[P.left].x, x: (lm[P.left].x + lm[P.right].x) / 2 - 0.5, y: (eL.y + eR.y) / 2 - 0.42, roll: Math.atan2((eR.y - eL.y) * 320, (eR.x - eL.x) * 240) * 180 / Math.PI, light: luma([d[0], d[1], d[2]]) };
      onCue({ ...composure(frame), frame });
    } catch { live = false; onCue({ ok: false, cue: '', face: 'unread' }); } finally { busy = false; }
  }, 320);
  return () => { live = false; clearInterval(timer); };
}
