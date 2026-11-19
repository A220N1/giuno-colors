// Small helpers shared by the screens.

export const NS = 'http://www.w3.org/2000/svg';
export const $ = (sel) => document.querySelector(sel);
export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
export const fmt = (v) => String(Math.round(v * 10) / 10);

export function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export function showScreen(id) {
  for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id;
}

export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed */ }
}

// Dark or light text, whichever reads better on this background.
export function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lum = 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  return lum > 150 ? '#333' : '#fff';
}

export function face(profile) {
  const f = el('span', 'face', (profile.name.trim()[0] || '?').toUpperCase());
  f.style.background = profile.color;
  f.style.color = inkFor(profile.color);
  return f;
}

// Calls handler after a press held for `ms`; the click that follows the release is swallowed.
export function onLongPress(target, ms, handler) {
  let timer = 0, fired = false, x0 = 0, y0 = 0;
  target.addEventListener('pointerdown', (e) => {
    fired = false; x0 = e.clientX; y0 = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => { fired = true; vibrate(25); handler(); }, ms);
  });
  target.addEventListener('pointermove', (e) => {
    if (Math.hypot(e.clientX - x0, e.clientY - y0) > 10) clearTimeout(timer);
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) target.addEventListener(t, () => clearTimeout(timer));
  target.addEventListener('click', (e) => {
    if (fired) { fired = false; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  target.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function confirmDialog(text, okLabel = 'OK') {
  return new Promise((resolve) => {
    $('#confirm-text').textContent = text;
    $('#confirm-yes').textContent = okLabel;
    $('#confirm').hidden = false;
    const done = (v) => { $('#confirm').hidden = true; resolve(v); };
    $('#confirm-yes').onclick = () => done(true);
    $('#confirm-no').onclick = () => done(false);
  });
}
