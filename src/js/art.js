// Free drawings: a page of fixed size and the list of operations drawn on it.
// Fills go on a lower layer and lines on an upper one, so a line drawn after a fill stays on top,
// and a fill can reach a little under the lines around it without leaving a white seam.
//
// Operations, in page units (integers):
//   { t: 'line', c, w, p: [x0, y0, x1, y1, ...] }   brush stroke
//   { t: 'erase', w, p: [...] }                     eraser stroke, clears both layers
//   { t: 'shape', k, c, w, b: [x, y, width, height] }
//   { t: 'fill', c, r: [[x0, y0, x1, y1, ...], ...] } closed loops, even-odd rule
//   { t: 'stamp', k, b: [x, y, width, height], c? }  sticker: 'e' + OpenMoji code, a profile animal, or
//                                                    a cloud or tuft of grass ('vcloud1'…) in colour c
//   { t: 'bg', k: 'paper' | 'night' | 'grid' | 'dots', c }  page background, the last one counts
//   { t: 'smudge', w, p: [...] }                    finger: spreads the paint of both layers along it
// A line may carry k, its kind of brush (see brushes.js); without it, the felt pen.
// The colour c is '#rrggbb' or 'rainbow': pastel hues turning along a stroke, or across a fill or shape.
// Lines, eraser strokes and shapes may carry m (2, 4 or 6): drawn again as their mirror images around
// the middle of the page. A fill with z uses the nonzero rule: its loops may come from several taps.

import { RAINBOW, rainbowAt, HEART, linePath, drawStroke, wallWidth, along } from './brushes.js';
import { stampImage, isAnimal, isNature } from './images.js';
import { drawNature } from './nature.js';

export const PAGE_W = 800, PAGE_H = 1000;
export const SIZES = [6, 14, 28, 52];
export const COLORS = [
  '#1f1f1f', '#9e9e9e', '#8d5a3b', '#e53935', '#fb8c00', '#fdd835', '#9ccc65', '#2e9d4a',
  '#ffffff', '#f5c9a0', '#f06292', '#c39bd3', '#8e44ad', '#1e63c9', '#64b5f6', '#26c6da',
];
export { RAINBOW, RAINBOW_LEN, rainbowAt, BRUSHES, BRUSH_NAMES, PIECEWISE } from './brushes.js';

// Mirror modes: 1 none, 2 left and right, 4 the four quarters, 6 a kaleidoscope of three turns.
export const MIRRORS = [1, 2, 4, 6];
const MID_X = PAGE_W / 2, MID_Y = PAGE_H / 2;
const mirrorCache = new Map();

// The copies of mode m as canvas matrices [a, b, c, d, e, f], the first one being the identity.
export function mirrorMatrices(m) {
  let list = mirrorCache.get(m);
  if (list) return list;
  list = [];
  const add = (a, b, c, d) => list.push([a, b, c, d, MID_X - a * MID_X - c * MID_Y, MID_Y - b * MID_X - d * MID_Y]);
  add(1, 0, 0, 1);
  if (m === 2 || m === 4) add(-1, 0, 0, 1);
  if (m === 4) { add(1, 0, 0, -1); add(-1, 0, 0, -1); }
  if (m === 6) {
    for (let i = 0; i < 3; i++) {
      const a = i * 2 * Math.PI / 3, co = Math.cos(a), si = Math.sin(a);
      if (i) add(co, si, -si, co);
      add(-co, -si, -si, co);  // the turn after a left-right flip
    }
  }
  mirrorCache.set(m, list);
  return list;
}

export function mirrorPoints(m, x, y) {
  return mirrorMatrices(m).map(([a, b, c, d, e, f]) => [a * x + c * y + e, b * x + d * y + f]);
}

// Run draw() once per copy of the operation's mirror mode, on each given context.
function mirrored(op, ctxs, draw) {
  const list = op.m > 1 ? mirrorMatrices(op.m) : null;
  if (!list) { draw(); return; }
  for (const mat of list) {
    for (const ctx of ctxs) if (ctx) { ctx.save(); ctx.transform(...mat); }
    draw();
    for (const ctx of ctxs) if (ctx) ctx.restore();
  }
}

const WALL_ALPHA = 128;  // a pixel of a line at least this opaque stops the paint bucket
const GROW_PX = 2;       // how far a fill reaches under the lines that bound it
const REACH_PX = 12;     // a bucket tap on a line fills the nearest free pixel this close
const SIMPLIFY_PX = 0.8; // largest gap allowed between a fill's outline and the pixels it covers

function starPath() {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.4 : 1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const w = 2 * Math.cos(Math.PI / 10), top = -1, h = 1 + Math.sin(3 * Math.PI / 10);
  return 'M' + pts.map(([x, y]) => `${((x + w / 2) / w).toFixed(4)} ${((y - top) / h).toFixed(4)}`).join('L') + 'Z';
}

// Shapes in a unit box, as SVG path data: stretched to the box the child drags, and used as icons.
export const SHAPES = {
  circle: 'M0 .5A.5 .5 0 1 1 1 .5A.5 .5 0 1 1 0 .5Z',
  square: 'M0 0H1V1H0Z',
  triangle: 'M.5 0L1 1H0Z',
  star: starPath(),
  heart: HEART,
};

const cache = new WeakMap();  // op -> Path2D

function shapePath(k, [x, y, w, h]) {
  const path = new Path2D();
  path.addPath(new Path2D(SHAPES[k] || SHAPES.circle), new DOMMatrix([w, 0, 0, h, x, y]));
  return path;
}

function loopsPath(loops) {
  const path = new Path2D();
  for (const l of loops) {
    path.moveTo(l[0], l[1]);
    for (let i = 2; i < l.length; i += 2) path.lineTo(l[i], l[i + 1]);
    path.closePath();
  }
  return path;
}

function pathOf(op) {
  let path = cache.get(op);
  if (!path) {
    path = op.t === 'fill' ? loopsPath(op.r) : op.t === 'shape' ? shapePath(op.k, op.b) : linePath(op.p);
    cache.set(op, path);
  }
  return path;
}

function stroke(ctx, path, color, width) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.stroke(path);
}

// A diagonal pastel rainbow over a box, for fills and shapes.
function rainbowGradient(ctx, [x, y, w, h]) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, rainbowAt(i / 6));
  return g;
}

function loopsBox(loops) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of loops) {
    for (let i = 0; i < l.length; i += 2) {
      x0 = Math.min(x0, l[i]); x1 = Math.max(x1, l[i]);
      y0 = Math.min(y0, l[i + 1]); y1 = Math.max(y1, l[i + 1]);
    }
  }
  return [x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)];
}

// A line in its brush kind; for the paint bucket, only the whole line matters.
function drawLine(ctx, op, solid) {
  if (solid) stroke(ctx, linePath(op.p), '#000', wallWidth(op));
  else drawStroke(ctx, op);
}

function drawStamp(ctx, op) {
  if (isNature(op.k)) { drawNature(ctx, op); return; }
  const img = stampImage(op.k);
  if (!img) return;
  const [x, y, w, h] = op.b;
  if (!isAnimal(op.k)) { ctx.drawImage(img, x, y, w, h); return; }
  ctx.save();  // the animals are round stickers
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

// Page backgrounds: plain papers, a night sky, squared and dotted paper.
export const BACKGROUNDS = [
  { k: 'paper', c: '#ffffff' }, { k: 'paper', c: '#fdf1d8' }, { k: 'paper', c: '#fde2ea' }, { k: 'paper', c: '#e0effc' },
  { k: 'paper', c: '#dff4e7' }, { k: 'paper', c: '#fff5bf' }, { k: 'night' }, { k: 'grid' }, { k: 'dots' },
];
const hashRand = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

export function backgroundOf(ops) {
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].t === 'bg') return ops[i];
  return null;
}

export const sameBackground = (a, b) => (a ? a.k : 'paper') === (b ? b.k : 'paper') && (a && a.c || '#ffffff') === (b && b.c || '#ffffff');

// The colour the eraser shows while erasing: roughly the background.
export function paperColor(bg) {
  if (!bg || bg.k === 'paper') return bg ? bg.c : '#ffffff';
  return bg.k === 'night' ? '#1d2552' : '#ffffff';
}

export function drawBackground(ctx, bg, k) {
  clearCanvas(ctx, k);
  const kind = bg ? bg.k : 'paper';
  if (kind === 'night') {
    const g = ctx.createLinearGradient(0, 0, 0, PAGE_H);
    g.addColorStop(0, '#0d1636');
    g.addColorStop(1, '#2d3166');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) {
      ctx.globalAlpha = 0.35 + 0.65 * hashRand(i, 3);
      ctx.beginPath();
      ctx.arc(hashRand(i, 0) * PAGE_W, hashRand(i, 1) * PAGE_H, 0.8 + 2 * hashRand(i, 2) ** 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillStyle = kind === 'paper' && bg ? bg.c : '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  if (kind === 'grid') {
    ctx.strokeStyle = '#c9dcf3';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = 40; x < PAGE_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, PAGE_H); }
    for (let y = 40; y < PAGE_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); }
    ctx.stroke();
  } else if (kind === 'dots') {
    ctx.fillStyle = '#bfc4d6';
    ctx.beginPath();
    for (let x = 40; x < PAGE_W; x += 40) for (let y = 40; y < PAGE_H; y += 40) { ctx.moveTo(x + 2.6, y); ctx.arc(x, y, 2.6, 0, Math.PI * 2); }
    ctx.fill();
  }
}

// Finger: soft dabs along the stroke, each made of the paint a little behind it, laid at partial
// opacity. Done on the layer's own pixels, whatever its scale, so it replays the same way.
const SMUDGE_KEEP = 0.6;
let dab = null;

function smudgeLayer(ctx, op, from) {
  if (op.p.length < 4) return from;  // a tap has no direction to spread the paint along
  const t = ctx.getTransform(), scale = Math.hypot(t.a, t.b);
  const R = Math.max(1, Math.round(op.w / 2 * scale)), size = 2 * R;
  if (!dab) dab = document.createElement('canvas');
  if (dab.width < size || dab.height < size) { dab.width = size; dab.height = size; }
  const d = dab.getContext('2d');
  const lag = Math.max(1.5, op.w * 0.3);
  return along(op.p, Math.max(1, op.w * 0.12), from, (k, x, y, nx, ny) => {
    // the paint comes from `lag` units back along the stroke (its direction is (ny, -nx))
    const px = x - ny * lag, py = y + nx * lag;
    const sx = t.a * px + t.c * py + t.e, sy = t.b * px + t.d * py + t.f;
    const dx = t.a * x + t.c * y + t.e, dy = t.b * x + t.d * y + t.f;
    d.globalCompositeOperation = 'copy';
    d.drawImage(ctx.canvas, sx - R, sy - R, size, size, 0, 0, size, size);
    d.globalCompositeOperation = 'destination-in';
    const g = d.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.8)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    d.fillStyle = g;
    d.fillRect(0, 0, size, size);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = SMUDGE_KEEP;
    ctx.drawImage(dab, 0, 0, size, size, dx - R, dy - R, size, size);
    ctx.restore();
  });
}

// The finger's dabs from mark `from` on, on both layers (and their mirror images); the next mark.
export function smudgeOp(fills, lines, op, from = 0) {
  let next = from;
  mirrored(op, [fills, lines], () => {
    for (const ctx of [fills, lines]) if (ctx) next = smudgeLayer(ctx, op, from);
  });
  return next;
}

// The outlines of a colouring page painted freely, above everything else.
export function drawBase(ctx, base, k) {
  clearCanvas(ctx, k);
  if (base) ctx.drawImage(base.canvas, ...base.box);
}

function drawShape(ctx, op, path) {
  stroke(ctx, path, op.c === RAINBOW ? rainbowGradient(ctx, op.b) : op.c, op.w);
}

// Draw one operation on the fill and line layers (either may be null). `solid` draws lines plain and
// whole, as the paint bucket sees them.
export function drawOp(fills, lines, op, solid = false) {
  if (op.t === 'fill') {
    if (!fills) return;
    fills.fillStyle = op.c === RAINBOW ? rainbowGradient(fills, loopsBox(op.r)) : op.c;
    fills.fill(pathOf(op), op.z ? 'nonzero' : 'evenodd');
  } else if (op.t === 'erase') {
    mirrored(op, [fills, lines], () => {
      for (const ctx of [fills, lines]) {
        if (!ctx) continue;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        stroke(ctx, pathOf(op), '#000', op.w);
        ctx.restore();
      }
    });
  } else if (op.t === 'bg') {
    // drawn on its own layer, see drawBackground
  } else if (op.t === 'smudge') {
    if (!solid) smudgeOp(fills, lines, op);  // the paint bucket does not see it
  } else if (lines) {
    mirrored(op, [lines], () => {
      if (op.t === 'shape') drawShape(lines, op, pathOf(op));
      else if (op.t === 'stamp') drawStamp(lines, op);
      else drawLine(lines, op, solid);
    });
  }
}

// An operation still being drawn, on the layer above both: the eraser shows as white paper.
// A line of a piecewise kind draws its marks from `from` on; the next mark is returned.
export function drawPreview(ctx, op, from = 0) {
  let next = 0;
  mirrored(op, [ctx], () => {
    if (op.t === 'erase') stroke(ctx, linePath(op.p), op.paper || '#fff', op.w);
    else if (op.t === 'shape') drawShape(ctx, op, shapePath(op.k, op.b));
    else if (op.t === 'stamp') { ctx.save(); ctx.globalAlpha = 0.85; drawStamp(ctx, op); ctx.restore(); }
    else next = drawStroke(ctx, op, from);
  });
  return next;
}

// Clear a layer and set it to draw in page units: `k` is a scale, or [scale, x, y] for a page moved
// and zoomed on a layer the size of the screen. Nothing is drawn outside the page.
export function clearCanvas(ctx, k) {
  const [s, tx, ty] = Array.isArray(k) ? k : [k, 0, 0];
  ctx.restore();  // the clip of the previous clear; nothing happens the first time
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.save();
  ctx.setTransform(s, 0, 0, s, tx, ty);
  ctx.beginPath();
  ctx.rect(0, 0, PAGE_W, PAGE_H);
  ctx.clip();
}

export function renderLayers(fills, lines, ops, k) {
  clearCanvas(fills, k);
  clearCanvas(lines, k);
  for (const op of ops) drawOp(fills, lines, op);
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// The drawing flattened on its background, `width` pixels wide, with its colouring page if any.
export function renderFlat(ops, width, base = null) {
  const k = width / PAGE_W, height = Math.round(PAGE_H * k);
  const b = makeCanvas(width, height), f = makeCanvas(width, height), l = makeCanvas(width, height), out = makeCanvas(width, height);
  drawBackground(b.getContext('2d'), backgroundOf(ops), k);
  renderLayers(f.getContext('2d'), l.getContext('2d'), ops, k);
  const ctx = out.getContext('2d');
  for (const c of [b, f, l]) ctx.drawImage(c, 0, 0);
  if (base) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.drawImage(base.canvas, ...base.box);
  }
  return out;
}

// Paint bucket: the part of the page reached from (x, y) without crossing a line, as closed loops
// around its pixels (one pixel per page unit). Null when the tap is on a thick line or off the page.
export function fillRegion(ops, x, y, base = null) {
  const W = PAGE_W, H = PAGE_H;
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return null;
  const ctx = makeCanvas(W, H).getContext('2d', { willReadFrequently: true });
  for (const op of ops) if (op.t !== 'fill') drawOp(null, ctx, op, true);
  if (base) ctx.drawImage(base.canvas, ...base.box);
  const px = ctx.getImageData(0, 0, W, H).data;
  const open = new Uint8Array(W * H);
  for (let p = 0; p < open.length; p++) open[p] = px[4 * p + 3] < WALL_ALPHA ? 1 : 0;

  let seed = open[y * W + x] ? y * W + x : -1;
  if (seed < 0) {
    let best = REACH_PX * REACH_PX + 1;
    for (let dy = -REACH_PX; dy <= REACH_PX; dy++) {
      for (let dx = -REACH_PX; dx <= REACH_PX; dx++) {
        const qx = x + dx, qy = y + dy, d = dx * dx + dy * dy;
        if (d < best && qx >= 0 && qy >= 0 && qx < W && qy < H && open[qy * W + qx]) { best = d; seed = qy * W + qx; }
      }
    }
  }
  if (seed < 0) return null;

  // scanline flood fill
  const inside = new Uint8Array(W * H);
  const stack = [seed];
  while (stack.length) {
    const p = stack.pop();
    if (inside[p]) continue;
    const row = p - (p % W), py = row / W;
    let l = p % W, r = l;
    while (l > 0 && open[row + l - 1] && !inside[row + l - 1]) l--;
    while (r < W - 1 && open[row + r + 1] && !inside[row + r + 1]) r++;
    inside.fill(1, row + l, row + r + 1);
    for (const ny of [py - 1, py + 1]) {
      if (ny < 0 || ny >= H) continue;
      let prev = false;
      for (let i = l; i <= r; i++) {
        const q = ny * W + i, ok = open[q] && !inside[q];
        if (ok && !prev) stack.push(q);
        prev = ok;
      }
    }
  }

  // reach under the bounding lines: everything next to the region that is not in it is line
  for (let g = 0; g < GROW_PX; g++) {
    const was = inside.slice();
    for (let yy = 0, p = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++, p++) {
        if (!was[p] && ((xx > 0 && was[p - 1]) || (xx < W - 1 && was[p + 1]) || (yy > 0 && was[p - W]) || (yy < H - 1 && was[p + W]))) inside[p] = 1;
      }
    }
  }
  return traceLoops(inside, W, H);
}

// Outlines of a pixel mask along the pixel edges, inside on the right going round.
// Every vertex has as many edges in as out, so walking unused edges always closes a loop.
function traceLoops(m, W, H) {
  const V = W + 1;
  const next = new Map();
  const add = (a, b) => { const l = next.get(a); if (l) l.push(b); else next.set(a, [b]); };
  for (let y = 0, p = 0; y < H; y++) {
    for (let x = 0; x < W; x++, p++) {
      if (!m[p]) continue;
      const tl = y * V + x, tr = tl + 1, bl = tl + V, br = bl + 1;
      if (y === 0 || !m[p - W]) add(tl, tr);
      if (x === W - 1 || !m[p + 1]) add(tr, br);
      if (y === H - 1 || !m[p + W]) add(br, bl);
      if (x === 0 || !m[p - 1]) add(bl, tl);
    }
  }
  const loops = [];
  for (const [start, out] of next) {
    while (out.length) {
      const pts = [];
      let v = start;
      do {
        pts.push(v % V, (v - (v % V)) / V);
        v = next.get(v).pop();
      } while (v !== start);
      const loop = simplify(corners(pts), SIMPLIFY_PX);
      if (loop.length >= 6) loops.push(loop);
    }
  }
  return loops;
}

// Drop the points where a closed loop goes straight on.
function corners(pts) {
  const n = pts.length / 2, out = [];
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n, b = (i + 1) % n;
    const dx1 = pts[2 * i] - pts[2 * a], dy1 = pts[2 * i + 1] - pts[2 * a + 1];
    const dx2 = pts[2 * b] - pts[2 * i], dy2 = pts[2 * b + 1] - pts[2 * i + 1];
    if (dx1 * dy2 - dy1 * dx2 !== 0) out.push(pts[2 * i], pts[2 * i + 1]);
  }
  return out;
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  const ex = ax + t * dx - px, ey = ay + t * dy - py;
  return ex * ex + ey * ey;
}

// Ramer-Douglas-Peucker on a closed loop, split at the point farthest from the first.
function simplify(pts, eps) {
  const n = pts.length / 2;
  if (n <= 4) return pts;
  let far = 0, fd = -1;
  for (let i = 1; i < n; i++) {
    const d = (pts[2 * i] - pts[0]) ** 2 + (pts[2 * i + 1] - pts[1]) ** 2;
    if (d > fd) { fd = d; far = i; }
  }
  const keep = new Uint8Array(n + 1);
  keep[0] = keep[far] = keep[n] = 1;
  const at = (i) => (i % n) * 2;
  const stack = [[0, far], [far, n]];
  const e2 = eps * eps;
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bd = e2;
    for (let i = a + 1; i < b; i++) {
      const d = segDist2(pts[at(i)], pts[at(i) + 1], pts[at(a)], pts[at(a) + 1], pts[at(b)], pts[at(b) + 1]);
      if (d > bd) { bd = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i], pts[2 * i + 1]);
  return out;
}
