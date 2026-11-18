/** The keepsake: a 5 × 7 studio print with the plate, its number and an honest line about how it was made. */
import { worldById } from '../atelier/index.js';
import { editionNo } from './store.js';

const SERIF = "Fraunces, Georgia, serif", MONO = "'IBM Plex Mono', ui-monospace, monospace";
export const longDate = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
export const printName = p => `likeness-${String(p.edition).padStart(4, '0')}-${worldById(p.world).name.toLowerCase().replace(/\s+/g, '-')}.png`;

/** @returns {Promise<Blob>} */
export async function keepsake(portrait) {
  const world = worldById(portrait.world), W = 1500, H = 2100, canvas = document.createElement('canvas'), c = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  await Promise.all([`360 96px Fraunces`, `italic 400 46px Fraunces`, `400 26px 'IBM Plex Mono'`].map(f => document.fonts.load(f).catch(() => {})));
  const img = new Image();
  img.src = portrait.url;
  await img.decode();

  c.fillStyle = '#f3eee4'; c.fillRect(0, 0, W, H);
  const shade = c.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.45, H * 0.75);
  shade.addColorStop(0, 'rgba(120,100,70,0)'); shade.addColorStop(1, 'rgba(120,100,70,.1)');
  c.fillStyle = shade; c.fillRect(0, 0, W, H);

  const px = 165, py = 150, pw = 1170, ph = 1560;
  c.save(); c.shadowColor = 'rgba(40,28,14,.34)'; c.shadowBlur = 46; c.shadowOffsetY = 22; c.fillStyle = '#1a1714'; c.fillRect(px, py, pw, ph); c.restore();
  c.drawImage(img, px, py, pw, ph);
  c.strokeStyle = 'rgba(26,23,20,.25)'; c.lineWidth = 2; c.strokeRect(px, py, pw, ph);

  const mono = (text, x, y, size = 26, colour = '#6b6258', align = 'left') => { c.font = `400 ${size}px ${MONO}`; c.fillStyle = colour; c.textAlign = /** @type {CanvasTextAlign} */ (align); try { c.letterSpacing = `${size * 0.12}px`; } catch { /* older canvases */ } c.fillText(text.toUpperCase(), x, y); };
  mono(`Plate ${world.plate}`, px, 1800);
  mono(editionNo(portrait.edition), px + pw, 1800, 26, '#1a1714', 'right');
  mono(longDate(portrait.createdAt), px + pw, 1842, 22, '#6b6258', 'right');
  try { c.letterSpacing = '-2px'; } catch { /* older canvases */ }
  c.font = `360 96px ${SERIF}`; c.fillStyle = '#1a1714'; c.textAlign = 'left'; c.fillText(world.name, px - 4, 1900);
  try { c.letterSpacing = '0px'; } catch { /* older canvases */ }
  c.font = `italic 340 40px ${SERIF}`; c.fillStyle = '#6b6258'; c.fillText(world.line, px, 1960);
  c.fillStyle = 'rgba(26,23,20,.2)'; c.fillRect(px, 1996, pw, 2);
  mono(`${portrait.provenance.label} · ${portrait.provenance.detail}`, px, 2040, 21);
  c.font = `italic 400 46px ${SERIF}`; c.fillStyle = '#1a1714'; c.textAlign = 'right'; c.fillText('Likeness', px + pw - 62, 2048);
  c.fillStyle = '#d8432b'; c.fillRect(px + pw - 44, 2010, 44, 44);
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('The print could not be made'))), 'image/png'));
}
