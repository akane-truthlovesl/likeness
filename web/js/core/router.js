/**
 * A stack of screens with the browser's history underneath, so the system back gesture does what it should.
 * A screen is a function (params, nav) => { el, enter?, leave? }.
 */
import { stage } from './dom.js';

/** @typedef {{ el: HTMLElement, enter?: () => void, leave?: () => void }} Screen */
/** @type {Record<string, (params: any) => Screen | Promise<Screen>>} */
const screens = {};
const memory = new Map();
let current = /** @type {(Screen & { name: string }) | null} */ (null), serial = 0;

export const register = (name, factory) => { screens[name] = factory; };

async function show(name, params) {
  const next = { name, ...(await screens[name](params || {})) }, prev = current;
  current = next;
  if (prev) {
    prev.leave?.();
    prev.el.classList.add('is-leaving');
    setTimeout(() => prev.el.remove(), 280);
  }
  next.el.classList.add('is-entering');
  next.el.dataset.screen = name;
  stage().append(next.el);
  setTimeout(() => next.el.classList.remove('is-entering'), 700);
  next.enter?.();
}

/** Opens a screen. Parameters may hold anything (blobs, sittings); they are kept in memory, not in the URL. */
export function go(name, params = {}, { replace = false } = {}) {
  const key = ++serial;
  memory.set(key, params);
  history[replace ? 'replaceState' : 'pushState']({ name, key }, '', '#/' + name);
  return show(name, params);
}

export const back = () => (history.length > 1 && history.state?.key > 1 ? history.back() : go('catalogue', {}, { replace: true }));
export const here = () => current?.name;

/** Starts at the screen named in the URL when it can be opened cold, otherwise at the catalogue. */
export function start(cold = ['catalogue', 'sitting', 'lab', 'drawer']) {
  const fromAddress = () => {
    const [, name, query = ''] = location.hash.match(/^#\/([a-z]+)(?:\?(.*))?$/) || [];
    return cold.includes(name) ? go(name, Object.fromEntries(new URLSearchParams(query)), { replace: true }) : go('catalogue', {}, { replace: true });
  };
  addEventListener('popstate', e => {
    const st = e.state;
    if (st && screens[st.name] && memory.has(st.key)) show(st.name, memory.get(st.key));
    else fromAddress();   // an address typed by hand, or an entry from before a reload
  });
  return fromAddress();
}
