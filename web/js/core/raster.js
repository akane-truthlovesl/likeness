/**
 * Plates leave the atelier as SVG and are fixed to bitmaps here, once, so that everything afterwards
 * (wipes, tissue, loupes) moves a picture and not a filter graph.
 */
import { portrait } from '../atelier/index.js';

const cache = new Map();
/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/** @returns {Promise<Blob>} */
export async function rasterise(svg, width = 900, type = 'image/jpeg', quality = 0.92) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = Math.round(width * 4 / 3);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('Could not fix the plate'))), type, quality));
  } finally { URL.revokeObjectURL(url); }
}

const hash = text => { let x = 2166136261; for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 16777619); return (x >>> 0).toString(36); };
/** A stable key for a sitter as drawn: the same traits always fix to the same plate. */
export const sitterKey = s => s.id + ':' + hash(JSON.stringify(s));

/**
 * The atelier's plate for a sitter in a world, as an object URL. Drawn once per size, one at a time.
 * @returns {Promise<{ url: string, blob: Blob, ms: number }>}
 */
export function plate(sitter, worldId, width = 720) {
  const key = `${sitterKey(sitter)}|${worldId}|${width}`;
  if (!cache.has(key)) {
    const job = queue.then(async () => {
      const t0 = performance.now(), blob = await rasterise(portrait(sitter, worldId), width);
      return { url: URL.createObjectURL(blob), blob, ms: performance.now() - t0 };
    });
    queue = job.catch(() => {});
    cache.set(key, job);
  }
  return cache.get(key);
}

/** Fades a picture into an <img> once it has decoded. */
export async function develop(img, url) {
  img.classList.remove('is-in');
  img.src = url;
  try { await img.decode(); } catch { /* a detached image still shows once attached */ }
  img.classList.add('is-in');
}
