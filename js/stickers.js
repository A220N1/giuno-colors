// Personal stickers: pictures, usually cut out on a transparent background, added from the grown-ups'
// corner one by one or as a pack file. They stay on this phone and are only ever shown as pictures,
// so a file cannot run code in the app.
import { allStickers, putSticker, deleteSticker } from './artstore.js';

const APP = 'giuno-colors';
const MAX_STICKERS = 80;
const MAX_SIDE = 640;                     // a bigger picture is scaled down to this
const KEEP_CHARS = 560 * 1024;            // a small picture is kept as it is, up to about 400 KB
const MAX_CHARS = 3 * 1024 * 1024;
const MAX_PACK_BYTES = 24 * 1024 * 1024;
const DATA_URL = /^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/;

const list = [];  // { id, name, data, w, h, added }, oldest first

export const customStickers = () => list;
export const customKey = (s) => 'u:' + s.id;
export const isCustom = (k) => k.startsWith('u:');
export const customSticker = (k) => list.find((s) => 'u:' + s.id === k) || null;

export function validSticker(s) {
  return Boolean(s) && typeof s.id === 'string' && /^[a-z0-9]{4,24}$/.test(s.id) && typeof s.data === 'string'
    && s.data.length <= MAX_CHARS && DATA_URL.test(s.data) && s.w > 0 && s.h > 0;
}

export async function loadStickers() {
  const records = ((await allStickers()) || []).filter(validSticker);
  list.length = 0;
  list.push(...records.sort((a, b) => a.added - b.added));
}

// The same picture always gets the same id, so a pack added twice adds nothing.
function idOf(text) {
  let a = 0x811c9dc5, b = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x85ebca6b);
  }
  return (a >>> 0).toString(36).padStart(7, '0') + (b >>> 0).toString(36).padStart(7, '0');
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// The picture as it will be kept: as it came when small enough, else scaled down and encoded again.
async function fitted(dataUrl) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('image vide');
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  if (k === 1 && dataUrl.length <= KEEP_CHARS) return { data: dataUrl, w, h };
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  let data = c.toDataURL('image/webp', 0.9);
  if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/png');  // a browser that cannot write WebP
  if (data.length > MAX_CHARS) throw new Error('image trop lourde');
  return { data, w: c.width, h: c.height };
}

// 'added', 'known' (already on this phone), or an Error.
async function addOne(name, dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_PACK_BYTES || !DATA_URL.test(dataUrl)) return new Error('pas une image');
  let pic;
  try { pic = await fitted(dataUrl); } catch (e) { return new Error('image illisible'); }
  const id = idOf(pic.data);
  if (list.some((s) => s.id === id)) return 'known';
  if (list.length >= MAX_STICKERS) return new Error('trop d\'autocollants');
  const record = { id, name: String(name || '').slice(0, 40), ...pic, added: Date.now() + list.length };
  await putSticker(record);
  list.push(record);
  return 'added';
}

// Adds what one file holds: a picture, or a pack of them
// ({ app: 'giuno-colors', kind: 'stickers', stickers: [{ name, image: 'data:image/…;base64,…' }] }).
// Returns { added, known }, or an Error when nothing in the file could be used.
export async function importStickerFile(file) {
  const count = { added: 0, known: 0 };
  let entries;
  if (/^image\/(png|webp|jpeg)$/.test(file.type)) {
    entries = [{ name: file.name.replace(/\.\w+$/, ''), image: await fileDataUrl(file) }];
  } else {
    if (file.size > MAX_PACK_BYTES) return new Error('fichier trop gros');
    let pack = null;
    try { pack = JSON.parse(await file.text()); } catch (e) { pack = null; }
    if (!pack || pack.app !== APP || pack.kind !== 'stickers' || !Array.isArray(pack.stickers)) return new Error('pas un pack');
    entries = pack.stickers.filter((s) => s && typeof s === 'object');
  }
  let last = new Error('pack vide');
  for (const s of entries) {
    const r = await addOne(s.name, s.image);
    if (r instanceof Error) last = r; else count[r]++;
  }
  return count.added || count.known ? count : last;
}

export async function forgetSticker(id) {
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list.splice(i, 1);
  await deleteSticker(id);
}
