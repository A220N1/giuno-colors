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
      key: entry.id + '.' + entry.hash,  // a changed drawing starts over instead of mixing up zones
      title: root.getAttribute('data-title') || entry.id,
      level: parseInt(root.getAttribute('data-level'), 10) || 1,
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

export function instantiate(d) {
  const g = svgEl('g', { class: 'art' });
  for (const child of d.root.childNodes) g.append(document.importNode(child, true));
  const zones = [...g.querySelectorAll('[data-c]')];
  const colors = zones.map((z) => parseInt(z.getAttribute('data-c'), 10) - 1);
  return { g, zones, colors };
}

export function paint(zone, color) {
  zone.classList.remove('hl');
  zone.classList.add('done');
  zone.style.setProperty('--c', color);
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
// The zones must be on screen (getCTM) and carry data-i.
export function analyse(d, art, zones) {
  const [vx, vy, vw, vh] = d.vb;
  const k = 640 / Math.max(vw, vh);
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
