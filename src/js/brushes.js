// The kinds of brush of the free drawing and how a stroke of each kind is drawn.
// Textured kinds put small marks along the stroke at fixed lengths. The randomness of each mark comes
// from the stroke and the mark's rank, so a stroke looks the same each time it is drawn, and a stroke
// still being drawn can be drawn piece by piece: only the marks not drawn yet.

export const RAINBOW = 'rainbow';
export const RAINBOW_LEN = 600;  // page units of stroke for one full turn of the rainbow
export const rainbowAt = (turn) => `hsl(${Math.round((((turn % 1) + 1) % 1) * 360)}, 88%, 76%)`;
export const HEART = 'M.5 .24C.42 .06 .27 0 .18 0 .07 0 0 .1 0 .26 0 .52 .26 .74 .5 1 .74 .74 1 .52 1 .26 1 .1 .93 0 .82 0 .73 0 .58 .06 .5 .24Z';

export const BRUSHES = ['marker', 'pen', 'pencil', 'pastel', 'paint', 'glitter', 'neon', 'hearts'];
export const BRUSH_NAMES = {
  marker: 'Feutre', pen: 'Stylo', pencil: 'Crayon', pastel: 'Pastel', paint: 'Pinceau',
  glitter: 'Paillettes', neon: 'Néon', hearts: 'Cœurs',
};
// Kinds drawn mark by mark: while drawing, only the new marks are added to the screen.
export const PIECEWISE = new Set(['pencil', 'pastel', 'paint', 'hearts']);

// Width of the line a stroke makes for the paint bucket, which needs it whole.
export function wallWidth(op) {
  const k = op.k || 'marker';
  return op.w * (k === 'pen' ? 0.4 : k === 'pastel' ? 1.15 : k === 'neon' ? 0.7 : 1);
}

// ---- colours

function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

const hexCache = new Map();
function hexRgb(hex) {
  let v = hexCache.get(hex);
  if (!v) {
    const n = parseInt(hex.slice(1), 16);
    v = [n >> 16, (n >> 8) & 255, n & 255];
    hexCache.set(hex, v);
  }
  return v;
}

// The colour of a stroke at a length along it; rainbow hues in steps of 3 degrees so marks group.
function colourOf(op) {
  if (op.c !== RAINBOW) { const rgb = hexRgb(op.c); return () => rgb; }
  return (len) => {
    const turn = (((len / RAINBOW_LEN) % 1) + 1) % 1;
    return hslToRgb(Math.round(turn * 120) / 120, 0.88, 0.76);
  };
}

// Towards white (shade > 0) or black (shade < 0), with an opacity.
function css([r, g, b], shade = 0, alpha = 1) {
  const m = (v) => Math.round(shade >= 0 ? v + (255 - v) * shade : v * (1 + shade));
  return `rgba(${m(r)},${m(g)},${m(b)},${alpha})`;
}

// ---- randomness

// From the first point only: a stroke keeps its seed while it grows.
function seedOf(op) {
  let h = 2166136261 ^ op.w;
  h = Math.imul(h ^ op.p[0], 16777619);
  h = Math.imul(h ^ op.p[1], 16777619);
  return h >>> 0;
}

// A number in [0, 1) from a stroke seed, a mark rank and a draw number.
function rnd(seed, k, j) {
  let x = (seed ^ Math.imul(k + 1, 0x9e3779b1) ^ Math.imul(j + 7, 0x85ebca77)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// Fills grouped by style, so thousands of marks make a few fill calls.
function painter(ctx) {
  const paths = new Map();
  const flush = () => {
    for (const [style, path] of paths) { ctx.fillStyle = style; ctx.fill(path); }
    paths.clear();
  };
  return {
    path(style) {
      let p = paths.get(style);
      if (!p) {
        if (paths.size >= 32) flush();
        p = new Path2D();
        paths.set(style, p);
      }
      return p;
    },
    flush,
  };
}

// ---- geometry

export function linePath(p) {
  const path = new Path2D();
  const n = p.length / 2;
  path.moveTo(p[0], p[1]);
  if (n === 1) { path.lineTo(p[0] + 0.01, p[1]); return path; }  // a dot
  // through the midpoints, with the recorded points as control points: smooth and drawable as it comes
  for (let i = 1; i < n - 1; i++) {
    path.quadraticCurveTo(p[2 * i], p[2 * i + 1], (p[2 * i] + p[2 * i + 2]) / 2, (p[2 * i + 1] + p[2 * i + 3]) / 2);
  }
  path.lineTo(p[2 * n - 2], p[2 * n - 1]);
  return path;
}

// The curve of linePath piece by piece, each piece stroked in the style given for its length.
function strokePieces(ctx, p, style) {
  const n = p.length / 2;
  let x = p[0], y = p[1], len = 0;
  if (n === 1) {
    style(0);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.01, y); ctx.stroke();
    return;
  }
  for (let i = 1; i < n; i++) {
    const last = i === n - 1;
    const qx = p[2 * i], qy = p[2 * i + 1];
    const ex = last ? qx : (qx + p[2 * i + 2]) / 2, ey = last ? qy : (qy + p[2 * i + 3]) / 2;
    const d = last ? Math.hypot(qx - x, qy - y) : Math.hypot(qx - x, qy - y) + Math.hypot(ex - qx, ey - qy);
    style(len + d / 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (last) ctx.lineTo(ex, ey); else ctx.quadraticCurveTo(qx, qy, ex, ey);
    ctx.stroke();
    len += d; x = ex; y = ey;
  }
}

function strokeLine(ctx, op, width, style) {
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (op.c === RAINBOW) {
    const colour = colourOf(op);
    strokePieces(ctx, op.p, (len) => style(ctx, colour(len)));
  } else {
    style(ctx, hexRgb(op.c));
    ctx.stroke(linePath(op.p));
  }
}

// Marks every `spacing` units along the recorded points, from mark `from` on; returns the next mark.
function along(p, spacing, from, mark) {
  const n = p.length / 2;
  if (n === 1) {
    if (from === 0) mark(0, p[0], p[1], 1, 0, 0);
    return Math.max(from, 1);
  }
  let len = 0, k = from;
  for (let i = 1; i < n; i++) {
    const x0 = p[2 * i - 2], y0 = p[2 * i - 1], dx = p[2 * i] - x0, dy = p[2 * i + 1] - y0;
    const d = Math.hypot(dx, dy);
    if (!d) continue;
    while (k * spacing <= len + d) {
      const t = (k * spacing - len) / d;
      if (t >= 0) mark(k, x0 + dx * t, y0 + dy * t, -dy / d, dx / d, k * spacing);
      k++;
    }
    len += d;
  }
  return k;
}

// ---- the kinds

function grain(ctx, op, from, o) {
  const w = op.w * (o.widthFactor || 1);
  const g = Math.max(1, w / (o.grain || 14));  // bigger grains on wide strokes, so the number of marks stays sane
  const spacing = g;
  const per = Math.max(2, Math.round(o.density * w / g));
  const seed = seedOf(op), colour = colourOf(op), pt = painter(ctx);
  const next = along(op.p, spacing, from, (k, x, y, nx, ny, len) => {
    const rgb = colour(len);
    for (let j = 0; j < per; j++) {
      const off = (rnd(seed, k, 5 * j) + rnd(seed, k, 5 * j + 1) - 1) * w * o.spread;
      const tan = (rnd(seed, k, 5 * j + 2) - 0.5) * 1.2 * g;
      const s = (o.size[0] + o.size[1] * rnd(seed, k, 5 * j + 3)) * g;
      const a = o.alpha[Math.floor(rnd(seed, k, 5 * j + 4) * o.alpha.length)];
      pt.path(css(rgb, o.shade || 0, a)).rect(x + nx * off + ny * tan - s / 2, y + ny * off - nx * tan - s / 2, s, s);
    }
  });
  pt.flush();
  return next;
}

function paint(ctx, op, from) {
  const w = op.w;
  const bristles = Math.max(4, Math.min(16, Math.round(w / 2.2)));
  const seed = seedOf(op), colour = colourOf(op), pt = painter(ctx);
  const hairs = Array.from({ length: bristles }, (_, j) => ({
    off: ((j + 0.5) / bristles - 0.5) * w * 0.92 + (rnd(seed, -1, 3 * j) - 0.5) * w / bristles * 0.6,
    r: (w / bristles) * (0.6 + 0.35 * rnd(seed, -1, 3 * j + 1)),
    shade: Math.round((rnd(seed, -1, 3 * j + 2) - 0.5) * 6) / 16,  // a few shades, lighter and darker
  }));
  const spacing = Math.max(0.7, w * 0.05);
  const next = along(op.p, spacing, from, (k, x, y, nx, ny, len) => {
    const rgb = colour(len);
    for (let j = 0; j < bristles; j++) {
      if (rnd(seed, k, j) < 0.05) continue;  // a dry hair now and then streaks the paint
      const h = hairs[j];
      const p = pt.path(css(rgb, h.shade, 0.92));
      p.moveTo(x + nx * h.off + h.r, y + ny * h.off);
      p.arc(x + nx * h.off, y + ny * h.off, h.r, 0, Math.PI * 2);
    }
  });
  pt.flush();
  return next;
}

const heartPath = typeof Path2D === 'function' ? new Path2D(HEART) : null;
function hearts(ctx, op, from) {
  const seed = seedOf(op), colour = colourOf(op);
  const size = Math.max(9, op.w * 1.1);
  return along(op.p, size * 1.25, from, (k, x, y, nx, ny, len) => {
    const s = size * (k % 2 ? 0.8 : 1.1);
    const path = new Path2D();
    const m = new DOMMatrix().translate(x, y).rotate((rnd(seed, k, 0) - 0.5) * 40).scale(s).translate(-0.5, -0.5);
    path.addPath(heartPath, m);
    ctx.fillStyle = css(colour(len));
    ctx.fill(path);
  });
}

function glitter(ctx, op, from) {
  if (from === 0) strokeLine(ctx, op, op.w, (c, rgb) => { c.strokeStyle = css(rgb); });
  const seed = seedOf(op), colour = colourOf(op), pt = painter(ctx), w = op.w;
  const next = along(op.p, Math.max(2.5, w * 0.32), 0, (k, x, y, nx, ny, len) => {
    const off = (rnd(seed, k, 0) - 0.5) * w * 0.85;
    const s = Math.max(1.4, (0.1 + 0.18 * rnd(seed, k, 1)) * w);
    const pick = rnd(seed, k, 2);
    const style = pick < 0.45 ? 'rgba(255,255,255,0.95)' : pick < 0.75 ? css(colour(len), 0.65) : 'rgba(255,226,140,0.95)';
    const cx = x + nx * off, cy = y + ny * off, q = s * 0.28;
    pt.path(style).moveTo(cx, cy - s);
    const p = pt.path(style);
    p.lineTo(cx + q, cy - q); p.lineTo(cx + s, cy); p.lineTo(cx + q, cy + q);
    p.lineTo(cx, cy + s); p.lineTo(cx - q, cy + q); p.lineTo(cx - s, cy); p.lineTo(cx - q, cy - q); p.closePath();
  });
  pt.flush();
  return next;
}

function neon(ctx, op) {
  const t = ctx.getTransform(), scale = Math.hypot(t.a, t.b);
  ctx.save();
  ctx.shadowBlur = op.w * 0.9 * scale;
  strokeLine(ctx, op, op.w * 0.6, (c, rgb) => { c.strokeStyle = css(rgb, -0.05); c.shadowColor = css(rgb); });
  ctx.shadowBlur = 0;
  strokeLine(ctx, op, op.w * 0.24, (c, rgb) => { c.strokeStyle = css(rgb, 0.75); });
  ctx.restore();
}

// Draw a line operation, or for a piecewise kind its marks from `from` on; returns the next mark.
export function drawStroke(ctx, op, from = 0) {
  switch (op.k || 'marker') {
    case 'pen': strokeLine(ctx, op, Math.max(2, op.w * 0.4), (c, rgb) => { c.strokeStyle = css(rgb, -0.08); }); return 0;
    case 'pencil': return grain(ctx, op, from, { density: 1.2, spread: 0.5, size: [0.6, 0.9], alpha: [0.35, 0.55, 0.8] });
    case 'pastel': return grain(ctx, op, from, { widthFactor: 1.15, grain: 24, density: 2.4, spread: 0.6, size: [0.7, 1.1], alpha: [0.45, 0.65, 0.85], shade: 0.05 });
    case 'paint': return paint(ctx, op, from);
    case 'glitter': return glitter(ctx, op, from);
    case 'neon': neon(ctx, op); return 0;
    case 'hearts': return hearts(ctx, op, from);
    default: strokeLine(ctx, op, op.w, (c, rgb) => { c.strokeStyle = css(rgb); }); return 0;
  }
}
