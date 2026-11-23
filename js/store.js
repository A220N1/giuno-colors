// Profiles and colouring progress, kept in the browser's localStorage.
// Without storage (private mode, blocked site data) everything still works for the session.

const PREFIX = 'giuno.';
const mem = new Map();
let ok = false;
try {
  localStorage.setItem(PREFIX + 'probe', '1');
  ok = localStorage.getItem(PREFIX + 'probe') === '1';
  localStorage.removeItem(PREFIX + 'probe');
} catch (e) { ok = false; }

export const storageOk = () => ok;

function read(key, fallback) {
  if (mem.has(key)) return mem.get(key);
  let v = fallback;
  if (ok) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw !== null) v = JSON.parse(raw);
    } catch (e) { v = fallback; }
  }
  mem.set(key, v);
  return v;
}

function write(key, value) {
  mem.set(key, value);
  if (!ok) return;
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* quota */ }
}

export function profiles() {
  const list = read('profiles', []);
  return Array.isArray(list) ? list : [];
}

export function currentProfile() {
  const list = profiles();
  const id = read('current', null);
  return list.find((p) => p.id === id) || (list.length === 1 ? list[0] : null);
}

export function setCurrent(id) { write('current', id); }

// Interface language for this device, French unless English was picked.
export const getLang = () => (read('lang', 'fr') === 'en' ? 'en' : 'fr');
export const setLang = (lang) => write('lang', lang);

// When the session timer runs out (a time in milliseconds), or 0 without a timer.
export const getTimerEnd = () => Number(read('timer', 0)) || 0;
export const setTimerEnd = (end) => write('timer', end);

// The little sounds, on unless turned off on this device.
export const getSound = () => read('sound', true) !== false;
export const setSound = (on) => write('sound', Boolean(on));

// How filled zones are painted for a child: 'flat', 'shade' or 'glitter'.
export const getFillStyle = (profileId) => { const v = read(`fill.${profileId}`, 'flat'); return v === 'shade' || v === 'glitter' ? v : 'flat'; };
export const setFillStyle = (profileId, style) => write(`fill.${profileId}`, style);

// The fluidity meter of the grown-ups' corner, on or off on this device.
export const getPerf = () => read('perf', false) === true;
export const setPerf = (on) => write('perf', on);

export function addProfile(name, fields) {
  const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, ...fields };
  write('profiles', [...profiles(), p]);
  return p;
}

export function updateProfile(id, changes) {
  write('profiles', profiles().map((p) => (p.id === id ? { ...p, ...changes } : p)));
}

export function removeProfile(id) {
  write('profiles', profiles().filter((p) => p.id !== id));
  const prefix = `progress.${id}.`;
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
  if (ok) {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX + prefix)) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* storage went away */ }
  }
  if (read('current', null) === id) write('current', null);
}

export function getProgress(profileId, drawingKey) {
  const v = read(`progress.${profileId}.${drawingKey}`, []);
  return Array.isArray(v) ? v : [];
}

export function setProgress(profileId, drawingKey, list) {
  write(`progress.${profileId}.${drawingKey}`, list);
}

// Everything kept in localStorage under our prefix, as stored (JSON text), for a backup.
export function storageEntries() {
  const out = {};
  if (!ok) { for (const [k, v] of mem) out[k] = JSON.stringify(v); return out; }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && k !== PREFIX + 'probe') out[k.slice(PREFIX.length)] = localStorage.getItem(k);
  }
  return out;
}

// Replace everything under our prefix by the entries of a backup.
export function replaceStorage(entries) {
  mem.clear();
  if (!ok) { for (const [k, v] of Object.entries(entries)) mem.set(k, JSON.parse(v)); return; }
  const doomed = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) doomed.push(k);
  }
  doomed.forEach((k) => localStorage.removeItem(k));
  for (const [k, v] of Object.entries(entries)) localStorage.setItem(PREFIX + k, v);
}

// Ask the browser not to clear our data when space runs low (granted silently to installed apps).
export function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* unsupported */ }
}
