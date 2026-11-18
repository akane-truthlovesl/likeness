/** The drawer: sittings and their portraits, kept on this device in IndexedDB. */

/** @returns {Promise<IDBDatabase>} */
let opening = null;
function db() {
  opening ||= new Promise((resolve, reject) => {
    const req = indexedDB.open('likeness', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('sittings', { keyPath: 'id' }); req.result.createObjectStore('portraits', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
  return opening;
}
const run = async (store, mode, fn) => { const d = await db(); return new Promise((resolve, reject) => { const tx = d.transaction(store, mode), req = fn(tx.objectStore(store)); tx.oncomplete = () => resolve(req?.result); tx.onerror = () => reject(tx.error); }); };

/** Object URLs are per-session; only what can be re-made from the record is stored. */
const lean = ({ url, before, ...rest }) => ({ ...rest, before: before ? { blob: before.blob || null } : undefined });

export const saveSitting = sitting => run('sittings', 'readwrite', s => s.put(lean(sitting))).catch(() => {});
export const savePortrait = portrait => run('portraits', 'readwrite', s => s.put(lean(portrait))).catch(() => {});
export const getSitting = id => run('sittings', 'readonly', s => s.get(id));
export const removePortrait = id => run('portraits', 'readwrite', s => s.delete(id));
export const emptyDrawer = () => Promise.all([run('portraits', 'readwrite', s => s.clear()), run('sittings', 'readwrite', s => s.clear())]);
/** Every portrait in the drawer, newest first. */
export const listPortraits = async () => ((await run('portraits', 'readonly', s => s.getAll()).catch(() => [])) || []).sort((a, b) => b.createdAt - a.createdAt);

/** Plates are numbered in the order they were made on this device. */
export function nextEdition() {
  const n = Number(localStorage.getItem('likeness.edition') || 0) + 1;
  localStorage.setItem('likeness.edition', String(n));
  return n;
}
export const editionNo = n => 'No. ' + String(n).padStart(4, '0');
