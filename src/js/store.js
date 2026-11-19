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

export function addProfile(name, color) {
  const p = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, color };
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

// Ask the browser not to clear our data when space runs low (granted silently to installed apps).
export function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* unsupported */ }
}
