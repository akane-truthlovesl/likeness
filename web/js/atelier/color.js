/** Colour maths in OKLab. Every world derives its palette from the sitter's own colours. */

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const gam = c => { c = Math.max(0, c); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055); };

/** @param {string} hex @returns {number[]} */
export function toLab(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = lin(n >> 16 & 255), g = lin(n >> 8 & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** @param {number[]} lab @returns {string} */
export function fromLab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const ch = v => Math.max(0, Math.min(255, Math.round(gam(v)))).toString(16).padStart(2, '0');
  return '#' + ch(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
    + ch(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
    + ch(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
}

export const mix = (a, b, t) => { const A = toLab(a), B = toLab(b); return fromLab(A.map((v, i) => v + (B[i] - v) * t)); };

/** Shift lightness (absolute), scale chroma, rotate hue (degrees). */
export function tone(hex, { l = 0, c = 1, h = 0 } = {}) {
  const [L, a, b] = toLab(hex);
  const C = Math.hypot(a, b) * c, H = Math.atan2(b, a) + h * Math.PI / 180;
  return fromLab([Math.max(0, Math.min(1, L + l)), C * Math.cos(H), C * Math.sin(H)]);
}

export const lightness = hex => toLab(hex)[0];
export const chroma = hex => { const [, a, b] = toLab(hex); return Math.hypot(a, b); };
export const hue = hex => { const [, a, b] = toLab(hex); return (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; };
