/** Weighted motion: a spring for anything a finger lets go of, and a pointer drag with velocity. */

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Drives a value toward `to` with a damped spring. Returns a handle that can be stopped mid-flight.
 * @param {{ from?: number, to?: number, velocity?: number, stiffness?: number, damping?: number, precision?: number, onUpdate: (v: number) => void, onRest?: () => void }} o
 */
export function spring({ from = 0, to = 1, velocity = 0, stiffness = 170, damping = 24, precision = 0.002, onUpdate, onRest }) {
  let x = from, v = velocity, raf = 0, last = performance.now();
  if (reduced) { onUpdate(to); onRest?.(); return { stop() {} }; }
  const tick = now => {
    const dt = Math.min(0.034, (now - last) / 1000) / 2; last = now;
    for (let i = 0; i < 2; i++) { v += (-stiffness * (x - to) - damping * v) * dt; x += v * dt; }
    if (Math.abs(v) < precision * 10 && Math.abs(x - to) < precision) { onUpdate(to); onRest?.(); return; }
    onUpdate(x); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop() { cancelAnimationFrame(raf); } };
}

/**
 * Pointer drag with smoothed velocity (px/s). The element should set touch-action in CSS.
 * @param {HTMLElement} el
 * @param {{ start?: (e: PointerEvent) => void|false, move?: (d: Drag) => void, end?: (d: Drag) => void }} on
 * @typedef {{ dx: number, dy: number, vx: number, vy: number, x: number, y: number, ms: number, e: PointerEvent }} Drag
 */
export function drag(el, on) {
  let id = null, x0 = 0, y0 = 0, lx = 0, ly = 0, lt = 0, t0 = 0, vx = 0, vy = 0;
  const pack = e => ({ dx: e.clientX - x0, dy: e.clientY - y0, vx, vy, x: e.clientX, y: e.clientY, ms: e.timeStamp - t0, e });
  const down = e => {
    if (id !== null || e.button > 0) return;
    if (on.start?.(e) === false) return;
    id = e.pointerId; x0 = lx = e.clientX; y0 = ly = e.clientY; lt = t0 = e.timeStamp; vx = vy = 0;
    try { el.setPointerCapture(id); } catch { /* synthetic pointers cannot be captured */ }
  };
  const move = e => {
    if (e.pointerId !== id) return;
    const dt = Math.max(1, e.timeStamp - lt);
    vx = 0.55 * vx + 0.45 * (e.clientX - lx) / dt * 1000; vy = 0.55 * vy + 0.45 * (e.clientY - ly) / dt * 1000;
    lx = e.clientX; ly = e.clientY; lt = e.timeStamp;
    on.move?.(pack(e));
  };
  const up = e => { if (e.pointerId !== id) return; id = null; on.end?.(pack(e)); };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
}
