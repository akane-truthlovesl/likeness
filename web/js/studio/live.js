/** The live studio: the same sitting, sent to the workstation and followed event by event. */
import { studio } from './studio.js';
import { describe } from '../atelier/sitters.js';
import { nextEdition } from '../core/store.js';

const json = async res => { if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `The studio answered ${res.status}`); return res.json(); };
const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(json);

/** Uploads the photograph once per sitting; the studio answers with its own reading of the face. */
async function seat(sitting) {
  if (sitting.remote) return sitting.remote;
  const form = new FormData();
  form.append('photo', sitting.before.blob, 'sitting.jpg');
  form.append('reading', JSON.stringify({ sitter: sitting.sitter, words: describe(sitting.sitter), read_on_device: !sitting.unread }));
  sitting.remote = await fetch('api/sittings', { method: 'POST', body: form }).then(json);
  return sitting.remote;
}

/** Follows a job over server-sent events, falling back to polling where a proxy swallows the stream. */
async function* follow(job) {
  const queue = [], wake = { now: () => {} }, push = ev => { queue.push(ev); wake.now(); };
  let source = null, polling = false, seen = 0, finished = false;
  const poll = async () => {
    polling = true;
    while (!finished) {
      const state = await fetch(`api/jobs/${job}`).then(json).catch(() => null);
      if (state) { state.events.slice(seen).forEach(push); seen = state.events.length; }
      await new Promise(r => setTimeout(r, 600));
    }
  };
  try {
    source = new EventSource(`api/jobs/${job}/events`);
    for (const type of ['stage', 'step', 'log', 'done', 'failed']) source.addEventListener(type, e => { seen++; push({ type, ...JSON.parse(/** @type {MessageEvent} */ (e).data) }); });
    source.onerror = () => { source.close(); if (!finished && !polling) poll(); };
  } catch { poll(); }
  try {
    while (true) {
      while (queue.length) { const ev = queue.shift(); yield ev; if (ev.type === 'done' || ev.type === 'failed') return; }
      await new Promise(r => { wake.now = () => r(undefined); });
    }
  } finally { finished = true; source?.close(); }
}

export async function* develop(sitting, worldId, recipe = 'locked') {
  yield { type: 'beat', beat: 0 };
  yield { type: 'log', text: 'sending the sitting to the studio' };
  const seated = await seat(sitting);
  if (!seated.gate.ok) throw new Error(seated.gate.reason || 'The studio could not find a face in this photograph.');
  yield { type: 'log', text: seated.gate.note || 'face found by the studio' };
  const { job } = await post(`api/sittings/${seated.id}/portraits`, { world: worldId, recipe });
  for await (const ev of follow(job)) {
    if (ev.type === 'stage') { yield { type: 'beat', beat: ev.beat }; yield { type: 'log', text: ev.note ? `${ev.label.toLowerCase()}: ${ev.note}` : ev.label.toLowerCase() }; }
    else if (ev.type === 'step') yield { type: 'step', i: ev.i, n: ev.n };
    else if (ev.type === 'log') yield ev;
    else if (ev.type === 'failed') throw new Error(ev.message || 'The studio could not finish this plate.');
    else if (ev.type === 'done') {
      const made = ev.portrait, blob = await fetch(made.url).then(r => r.blob()), url = URL.createObjectURL(blob), sim = studio.mode === 'simulator';
      yield { type: 'preview', url };
      yield {
        type: 'done',
        portrait: {
          id: 'p-' + made.id, sittingId: sitting.id, world: worldId, recipe, mode: studio.mode, edition: recipe === 'locked' ? nextEdition() : 0, createdAt: Date.now(), url, blob, similarity: made.similarity ?? null, measure: made.measure || 'face',
          provenance: { kind: 'render', label: sim ? 'Simulator render' : 'Studio render', engine: made.engine, detail: [made.engine, made.steps && `${made.steps} steps`, made.seed != null && `seed ${made.seed}`, `${(made.ms / 1000).toFixed(1)} s`].filter(Boolean).join(' · ') },
          trace: { simulated: false, engine: made.engine, device: studio.info?.engine?.device || '', steps: made.steps, seed: made.seed, total: made.ms, stages: made.trace || [] },
        },
      };
    }
  }
}

/** The Lab's comparison, live: the naive render is made on request, and both are scored by the studio. */
export async function compare(sitting, worldId, locked) {
  let naive = null;
  for await (const ev of develop(sitting, worldId, 'naive')) if (ev.type === 'done') naive = ev.portrait;
  return { kind: 'render', measure: locked.measure, locked: { url: locked.url, similarity: locked.similarity }, naive: { url: naive.url, similarity: naive.similarity } };
}
