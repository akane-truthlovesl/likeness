/**
 * Which studio is speaking. The showcase edition is a folder of static files and draws everything on the device;
 * a live studio is the same app served by the workstation, which answers studio.json with its engine.
 */
export const studio = {
  /** @type {'showcase' | 'simulator' | 'workstation'} */ mode: 'showcase',
  /** @type {any} */ info: null,
  get live() { return this.mode !== 'showcase'; },
  get label() { return { showcase: 'Showcase', simulator: 'Live · Simulator', workstation: 'Live · Workstation' }[this.mode]; },
};

export async function connect() {
  try {
    const res = await fetch('studio.json', { cache: 'no-store', signal: AbortSignal.timeout(2500) });
    const info = res.ok ? await res.json() : null;
    if (info?.edition === 'live' && info.engine) { studio.mode = info.engine.kind === 'gpu' ? 'workstation' : 'simulator'; studio.info = info; }
  } catch { /* no studio answered: showcase */ }
  document.documentElement.dataset.mode = studio.mode;
  return studio;
}
