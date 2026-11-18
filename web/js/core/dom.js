/** Small DOM vocabulary: an element builder, a few icons, sheets and toasts. */

/**
 * h('button.btn.btn--primary', { onclick }, 'Label') — tag.classes, props, children.
 * @param {string} tag @param {Record<string, any>|null} [props] @param {...any} kids @returns {any}
 */
export function h(tag, props, ...kids) {
  const [name, ...cls] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (cls.length) el.className = cls.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'style') for (const [p, val] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.flat(Infinity).filter(x => x != null && x !== false));
  return el;
}

const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', sitter: '<circle cx="12" cy="9" r="3.6"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  drawer: '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
  loupe: '<circle cx="10.5" cy="10.5" r="5.5"/><path d="M15 15l5 5"/>', save: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
  share: '<path d="M12 15V4M8 8l4-4 4 4M6 12v8h12v-8"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', retake: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>',
  flip: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
};
/** An inline stroke icon. */
export const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;

export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const frame = () => new Promise(r => requestAnimationFrame(() => r(undefined)));
export const stage = () => /** @type {HTMLElement} */ (document.getElementById('stage'));
export const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

let toastTimer = 0;
/** A short line of confirmation at the foot of the stage. */
export function toast(text) {
  let el = stage().querySelector('.toast');
  if (!el) stage().append(el = h('div.toast', { role: 'status' }));
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-in'), 2200);
}

/**
 * Raises a sheet from the bottom edge. Resolves when it has been dismissed.
 * @param {(close: (value?: any) => void) => Node[]} build @param {{ theme?: 'paper' | 'night' }} [opts]
 */
export function sheet(build, { theme = 'paper' } = {}) {
  return new Promise(resolve => {
    const scrim = h('div.scrim'), body = h('div.sheet__body');
    const panel = h(`div.sheet.${theme}`, { role: 'dialog', 'aria-modal': 'true' }, h('div.sheet__grip'), body);
    const close = value => {
      scrim.classList.remove('is-in'); panel.classList.remove('is-in');
      setTimeout(() => { scrim.remove(); panel.remove(); resolve(value); }, 420);
    };
    body.append(...build(close));
    scrim.addEventListener('click', () => close());
    stage().append(scrim, panel);
    requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('is-in'); panel.classList.add('is-in'); }));
  });
}
