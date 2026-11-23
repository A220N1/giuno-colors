// Drawings: parsing, copies for display, and the zone map that places the numbers.
import { DRAWINGS } from './drawings-data.js';
import { svgEl } from './util.js';

function parseDrawing(entry) {
  try {
    const doc = new DOMParser().parseFromString(entry.svg, 'image/svg+xml');
    const root = doc.documentElement;
    if (root.localName !== 'svg') throw new Error('not an svg');
    return {
      id: entry.id,
      category: entry.category || '',
      categoryEn: entry.category_en || '',
      titleEn: entry.title_en || '',
      key: entry.id + '.' + entry.hash,  // a changed drawing starts over instead of mixing up zones
      title: root.getAttribute('data-title') || entry.id,
      level: parseInt(root.getAttribute('data-level'), 10) || 1,
      mystery: root.hasAttribute('data-mystery'),  // nothing of it shows until it is coloured
      vb: root.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number),
      palette: root.getAttribute('data-palette').trim().split(/[\s,]+/),
      root,
    };
  } catch (e) {
    console.error('drawing ' + entry.id + ' skipped:', e);
    return null;
  }
}

export const drawings = DRAWINGS.map(parseDrawing).filter(Boolean);

export const IMPORTED = 'Coloriages ajoutés', IMPORTED_EN = 'Added coloring pages';

function fnv(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

// A colouring page imported on this phone, shown first in the gallery; null if it does not parse.
export function addImported(page) {
  const d = parseDrawing({ id: page.id, svg: page.svg, hash: fnv(page.svg), category: IMPORTED, category_en: IMPORTED_EN });
  if (!d) return null;
  d.imported = true;
  drawings.splice(drawings.filter((x) => x.imported).length, 0, d);
  return d;
}

export function removeImported(id) {
  const i = drawings.findIndex((x) => x.imported && x.id === id);
  if (i >= 0) drawings.splice(i, 1);
}

export function instantiate(d) {
  const g = svgEl('g', { class: 'art' });
  for (const child of d.root.childNodes) g.append(document.importNode(child, true));
  const zones = [...g.querySelectorAll('[data-c]')];
  const colors = zones.map((z) => parseInt(z.getAttribute('data-c'), 10) - 1);
  return { g, zones, colors };
}

// `fill`: what the zone is filled with when it is not the plain colour (a gradient or a pattern).
export function paint(zone, color, fill = color) {
  zone.classList.remove('hl');
  zone.classList.add('done');
  zone.style.setProperty('--c', fill);
  zone.style.setProperty('--s', color);
}

// Lighter (k > 0) or darker (k < 0) shade of a '#rrggbb' colour.
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const m = (v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)).toString(16).padStart(2, '0');
  return '#' + m(n >> 16) + m((n >> 8) & 255) + m(n & 255);
}

// Fill styles for coloured zones, as SVG markup: a gradient from light to dark across each zone, and
// a tile of the colour strewn with glitter, `size` units wide.
export const shadeMarkup = (id, color) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">`
  + `<stop offset="0" stop-color="${shade(color, 0.45)}"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.28)}"/></linearGradient>`;
// [x, y, size, kind] in a tile of 40: stars (0 white, 1 pale gold), dots (2 lighter, 3 darker than the colour)
const SPARKS = [[5, 6, 3.4, 0], [19, 3, 1.8, 1], [31, 9, 2.6, 0], [12, 15, 1.4, 2], [25, 17, 3, 1], [37, 22, 1.6, 0], [4, 24, 2.2, 3],
  [16, 28, 2.8, 0], [29, 30, 1.5, 2], [9, 36, 1.9, 1], [22, 37, 1.3, 3], [35, 35, 2.4, 0], [38, 3, 1.2, 3], [1, 14, 1.2, 2]];
export function glitterMarkup(id, color, size) {
  const marks = SPARKS.map(([x, y, r, kind]) => {
    if (kind > 1) return `<circle cx="${x}" cy="${y}" r="${r}" fill="${shade(color, kind === 2 ? 0.4 : -0.22)}"/>`;
    return `<path fill="${kind ? '#fff1a8' : '#ffffff'}" d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z"/>`;
  }).join('');
  return `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${size}" height="${size}" viewBox="0 0 40 40">`
    + `<rect width="40" height="40" fill="${color}"/>${marks}</pattern>`;
}

// Geometry of a shape element as path data, for canvas rendering.
function shapePath(el) {
  const n = (name) => parseFloat(el.getAttribute(name)) || 0;
  switch (el.localName) {
    case 'path': return el.getAttribute('d');
    case 'rect': return `M${n('x')} ${n('y')}h${n('width')}v${n('height')}h${-n('width')}z`;
    case 'circle': {
      const cx = n('cx'), cy = n('cy'), r = n('r');
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
    }
    case 'ellipse': {
      const cx = n('cx'), cy = n('cy'), rx = n('rx'), ry = n('ry');
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
    }
    case 'polygon': return 'M' + el.getAttribute('points').trim() + 'z';
    case 'polyline': return 'M' + el.getAttribute('points').trim();
    case 'line': return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    default: return null;
  }
}

const idCheck = (id) => (id * 151 + 89) & 255;

// Rasterize the drawing with one colour per zone, then find for each zone the visible point
// farthest from its edges: that is where its number fits best. The map also serves near-miss taps.
// The zones must be on screen (getCTM) and carry data-i. Detailed drawings get a finer map,
// or their small zones would be lost between its pixels.
export function analyse(d, art, zones) {
  const [vx, vy, vw, vh] = d.vb;
  const k = (zones.length > 120 ? 1600 : 640) / Math.max(vw, vh);
  const W = Math.ceil(vw * k), H = Math.ceil(vh * k);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const base = new DOMMatrix([k, 0, 0, k, -vx * k, -vy * k]);
  const toArt = art.getCTM().inverse();
  const n = zones.length;
  for (const node of art.querySelectorAll('*')) {
    if (node.closest('defs, clipPath, mask, pattern, symbol')) continue;
    const geom = shapePath(node);
    const ctm = geom && node.getCTM();
    if (!ctm) continue;
    ctx.setTransform(base.multiply(toArt.multiply(ctm)));
    const path = new Path2D(geom);
    const cs = getComputedStyle(node);
    const rule = cs.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
    if (node.hasAttribute('data-c')) {
      const id = parseInt(node.getAttribute('data-i'), 10) + 1;
      ctx.fillStyle = `rgb(${id & 255},${(id >> 8) & 255},${idCheck(id)})`;
      ctx.fill(path, rule);
    } else if (cs.display !== 'none' && cs.visibility !== 'hidden') {
      // decorations hide what is under them but belong to no zone
      ctx.fillStyle = ctx.strokeStyle = 'rgb(0,0,1)';
      if (cs.fill !== 'none') ctx.fill(path, rule);
      const sw = parseFloat(cs.strokeWidth);
      if (cs.stroke !== 'none' && sw > 0) {
        ctx.lineWidth = sw;
        ctx.lineCap = cs.strokeLinecap || 'butt';
        ctx.lineJoin = cs.strokeLinejoin || 'miter';
        ctx.stroke(path);
      }
    }
  }
  const px = ctx.getImageData(0, 0, W, H).data;
  const lab = new Uint16Array(W * H);
  for (let p = 0, q = 0; p < lab.length; p++, q += 4) {
    if (px[q + 3] !== 255) continue;
    const id = px[q] | (px[q + 1] << 8);
    // antialiased edges blend two ids; the check byte rejects most of those
    if (id > 0 && id <= n && px[q + 2] === idCheck(id)) lab[p] = id;
  }

  // chamfer 3-4 distance to the nearest pixel of another zone
  const dist = new Float32Array(W * H);
  for (let p = 0; p < dist.length; p++) dist[p] = lab[p] ? 1e9 : 0;
  const near = (x, y, L) => (x < 0 || y < 0 || x >= W || y >= H || lab[y * W + x] !== L) ? 0 : dist[y * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x, L = lab[p];
      if (!L) continue;
      dist[p] = Math.min(dist[p], near(x - 1, y, L) + 3, near(x - 1, y - 1, L) + 4,
        near(x, y - 1, L) + 3, near(x + 1, y - 1, L) + 4);
    }
  }
  for (let y = H - 1; y >= 0; y--) {
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x, L = lab[p];
      if (!L) continue;
      dist[p] = Math.min(dist[p], near(x + 1, y, L) + 3, near(x + 1, y + 1, L) + 4,
        near(x, y + 1, L) + 3, near(x - 1, y + 1, L) + 4);
    }
  }
  const best = new Float32Array(n + 1);
  const at = new Int32Array(n + 1).fill(-1);
  for (let p = 0; p < lab.length; p++) {
    const L = lab[p];
    if (L && dist[p] > best[L]) { best[L] = dist[p]; at[L] = p; }
  }
  const pos = zones.map((z, i) => {
    const p = at[i + 1];
    if (p >= 0) return { x: vx + ((p % W) + 0.5) / k, y: vy + (Math.floor(p / W) + 0.5) / k, r: best[i + 1] / 3 / k };
    const b = z.getBBox();  // nothing of it shows: covered by other shapes or too thin for the raster
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, r: 0, hidden: true };
  });
  return { k, W, H, lab, pos };
}
