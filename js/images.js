// Pictures drawn into free drawings: stickers (OpenMoji emojis, the profile animals, the Christmas
// set and the personal ones) and the outlines of a colouring page painted freely. Each loads once; a
// drawing waits for its own.
import { drawings } from './drawings.js';
import { NATURE_STAMPS, isNature } from './nature.js';
import { customStickers, customKey, customSticker, isCustom } from './stickers.js';

const PAGE_W = 800, PAGE_H = 1000;
const OUTLINE_PX = 2;  // pixels per page unit of a colouring page's outlines

export const EMOJI_STAMPS = [
  '2B50', '2764', '1F308', '2600', '1F319', '1F338', '1F33B', '1F98B', '1F984', '1F41E', '1F422', '1F42C', '1F419', '1F995',
  '1F431', '1F436', '1F43C', '1F427', '1F388', '1F382', '1F9C1', '1F366', '1F353', '1F451', '1F680', '1F3F0', '1F381',
];
export const ANIMAL_STAMPS = ['fox', 'cat', 'rabbit', 'bear', 'owl', 'hedgehog', 'fawn', 'squirrel', 'mouse', 'frog',
  'red-panda', 'dog', 'seal', 'duck', 'lamb'];
// Christmas: OpenMoji emojis by their code, and the stickers drawn for the app in the same style.
export const XMAS_STAMPS = [
  '1F384', '1F385', '1F936', 'xmas-elf', 'xmas-reindeer', '1F98C',
  'xmas-chalet', 'xmas-snowy-fir', '1F332', '2603', '2744', 'xmas-santa-hat',
  'xmas-sleigh', '1F6F7', 'xmas-bauble', 'xmas-stocking', 'xmas-candy-cane', 'xmas-gingerbread',
  'xmas-wreath', 'xmas-holly', '1F514', '1F56F', '1F31F', '1F380',
  '1F381', '1F9F8', '1F36A', '1F36C', '1F36D', '2615',
  '1F9E3', '1F9E4', '26F8', '1F3D4', '1F47C', '1F43B-200D-2744-FE0F',
];
const emoji = (c) => 'e' + c;
// Clouds and grass first (drawn as shapes, in the colour in use), then pictures keyed 'e' + their file
// name, then the animals by their name. A personal sticker is keyed 'u:' + its id.
export const STAMPS = [...new Set([...NATURE_STAMPS, ...EMOJI_STAMPS.map(emoji), ...ANIMAL_STAMPS, ...XMAS_STAMPS.map(emoji)])];
export const isAnimal = (k) => ANIMAL_STAMPS.includes(k);
export { isNature, isCustom, customSticker };
export const stampUrl = (k) => (isCustom(k) ? (customSticker(k) || { data: '' }).data
  : isAnimal(k) ? `avatars/${k}.svg` : `stamps/${k.slice(1)}.svg`);

// The pages of the sticker menu, each with the sticker shown on its tab; an empty page is left out.
export function stampGroups() {
  const mine = customStickers().map(customKey);
  return [
    { id: 'draw', name: 'Dessins', icon: 'e2B50', keys: [...NATURE_STAMPS, ...EMOJI_STAMPS.map(emoji)] },
    { id: 'animals', name: 'Animaux', icon: 'fox', keys: ANIMAL_STAMPS },
    { id: 'xmas', name: 'Noël', icon: 'e1F384', keys: XMAS_STAMPS.map(emoji) },
    { id: 'mine', name: 'Mes autocollants', icon: mine[0], keys: mine },
  ].filter((g) => g.keys.length);
}

const stamps = new Map();
const MISSING = { img: null, ok: false, ready: Promise.resolve() };

function loadStamp(k) {
  if (isCustom(k) && !customSticker(k)) return MISSING;  // removed from this phone, or never on it
  let e = stamps.get(k);
  if (!e) {
    const img = new Image();
    e = { img, ok: false };
    e.ready = new Promise((resolve) => {
      img.onload = () => { e.ok = true; resolve(); };
      img.onerror = () => resolve();
    });
    img.src = stampUrl(k);
    stamps.set(k, e);
  }
  return e;
}

export function stampImage(k) {
  const e = loadStamp(k);
  return e.ok ? e.img : null;
}

// The outlines of a colouring page, white made transparent, fitted in the middle of the page.
const bases = new Map();

function outlineSvg(d, width) {
  const root = d.root.cloneNode(true);
  const [, , vw, vh] = d.vb;
  const sw = 2.6 * Math.max(vw, vh) / 1000;
  // zones stay white, so they hide the outlines under them as in the colouring screen
  for (const z of root.querySelectorAll('[data-c]')) {
    z.setAttribute('style', `fill:#ffffff;stroke:#4a4a4a;stroke-width:${sw};stroke-linejoin:round`);
  }
  root.setAttribute('width', width);
  root.setAttribute('height', Math.round(width * vh / vw));
  return new XMLSerializer().serializeToString(root);
}

async function buildBase(d) {
  const [, , vw, vh] = d.vb;
  const s = Math.min(PAGE_W * 0.96 / vw, PAGE_H * 0.96 / vh);
  const box = [(PAGE_W - vw * s) / 2, (PAGE_H - vh * s) / 2, vw * s, vh * s];
  const cw = Math.round(box[2] * OUTLINE_PX), ch = Math.round(box[3] * OUTLINE_PX);
  const url = URL.createObjectURL(new Blob([outlineSvg(d, cw)], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    // undo the white paper: each pixel becomes the ink that, laid on white, gives that pixel
    const im = ctx.getImageData(0, 0, cw, ch), px = im.data;
    for (let i = 0; i < px.length; i += 4) {
      const a = 255 - Math.min(px[i], px[i + 1], px[i + 2]);
      if (a === 0) { px[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) px[i + c] = Math.round(255 - (255 - px[i + c]) * 255 / a);
      px[i + 3] = a;
    }
    ctx.putImageData(im, 0, 0);
    return { canvas, box };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// The outlines of colouring page `id`, or null if there is no such page.
export function loadBase(id) {
  if (!id) return Promise.resolve(null);
  let p = bases.get(id);
  if (!p) {
    const d = drawings.find((x) => x.id === id);
    p = d ? buildBase(d).catch((e) => { console.error('outlines not made:', e); return null; }) : Promise.resolve(null);
    bases.set(id, p);
  }
  return p;
}

// Everything a saved drawing needs before it can be drawn: its stickers and its colouring page.
export async function prepareArt(ops, baseId) {
  const keys = new Set(ops.filter((op) => op.t === 'stamp' && !isNature(op.k)).map((op) => op.k));
  await Promise.all([...keys].map((k) => loadStamp(k).ready));
  return loadBase(baseId);
}

// Called again when personal stickers were loaded or added: a sticker must be ready when it is dropped.
export function preloadStamps() {
  const keys = [...STAMPS.filter((k) => !isNature(k)), ...customStickers().map(customKey)];
  return Promise.all(keys.map((k) => loadStamp(k).ready));
}
