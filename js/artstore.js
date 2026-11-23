// Free drawings, imported colouring pages and personal stickers, kept in IndexedDB: a few dozen of
// them would not fit in localStorage. Without IndexedDB they only last for the session.
// Drawing: { id, profile, created, updated, ops, base? }   Page (store 'pages'): { id, svg, added }
// Sticker (store 'stickers'): { id, name, data, w, h, added }

const DB = 'giuno', STORE = 'art', PAGES = 'pages', STICKERS = 'stickers';
const mem = new Map();
const memPages = new Map();
const memStickers = new Map();
let opening = null;

function open() {
  if (!opening) {
    opening = new Promise((resolve) => {
      try {
        const q = indexedDB.open(DB, 3);
        q.onupgradeneeded = () => {
          const db = q.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('profile', 'profile');
          if (!db.objectStoreNames.contains(PAGES)) db.createObjectStore(PAGES, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STICKERS)) db.createObjectStore(STICKERS, { keyPath: 'id' });
        };
        q.onsuccess = () => {
          q.result.onversionchange = () => q.result.close();
          resolve(q.result);
        };
        q.onerror = q.onblocked = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }
  return opening;
}

// Run one request in its own transaction; resolves once the transaction has committed.
async function request(mode, make, store = STORE) {
  const db = await open();
  if (!db) return undefined;
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const q = make(t.objectStore(store));
    t.oncomplete = () => resolve(q.result);
    t.onerror = t.onabort = () => reject(t.error);
  });
}

export function newArtId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export async function listArt(profile) {
  const db = await open();
  const list = db ? await request('readonly', (s) => s.index('profile').getAll(profile))
    : [...mem.values()].filter((r) => r.profile === profile);
  return list.sort((a, b) => b.updated - a.updated);
}

export async function getArt(id) {
  if (!(await open())) return mem.get(id) || null;
  return (await request('readonly', (s) => s.get(id))) || null;
}

export async function putArt(record) {
  if (!(await open())) { mem.set(record.id, record); return; }
  await request('readwrite', (s) => s.put(record));
}

export async function deleteArt(id) {
  if (!(await open())) { mem.delete(id); return; }
  await request('readwrite', (s) => s.delete(id));
}

export async function allArt() {
  if (!(await open())) return [...mem.values()];
  return request('readonly', (s) => s.getAll());
}

export async function clearArt() {
  if (!(await open())) { mem.clear(); return; }
  await request('readwrite', (s) => s.clear());
}

export async function allPages() {
  if (!(await open())) return [...memPages.values()];
  return request('readonly', (s) => s.getAll(), PAGES);
}

export async function putPage(record) {
  if (!(await open())) { memPages.set(record.id, record); return; }
  await request('readwrite', (s) => s.put(record), PAGES);
}

export async function deletePage(id) {
  if (!(await open())) { memPages.delete(id); return; }
  await request('readwrite', (s) => s.delete(id), PAGES);
}

export async function clearPages() {
  if (!(await open())) { memPages.clear(); return; }
  await request('readwrite', (s) => s.clear(), PAGES);
}

export async function allStickers() {
  if (!(await open())) return [...memStickers.values()];
  return request('readonly', (s) => s.getAll(), STICKERS);
}

export async function putSticker(record) {
  if (!(await open())) { memStickers.set(record.id, record); return; }
  await request('readwrite', (s) => s.put(record), STICKERS);
}

export async function deleteSticker(id) {
  if (!(await open())) { memStickers.delete(id); return; }
  await request('readwrite', (s) => s.delete(id), STICKERS);
}

export async function clearStickers() {
  if (!(await open())) { memStickers.clear(); return; }
  await request('readwrite', (s) => s.clear(), STICKERS);
}

export async function deleteArtOf(profile) {
  for (const r of await listArt(profile)) await deleteArt(r.id);
}
