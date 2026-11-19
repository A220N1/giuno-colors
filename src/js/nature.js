// Clouds and tufts of grass: stickers drawn as shapes in the colour in use, rather than pictures.
// Each lies in a unit box stretched over the sticker's box; a slightly darker outline keeps a white
// cloud visible on white paper.

// [cx, cy, r] puffs, drawn as one outline then filled, so only the outer edge shows
const CLOUDS = {
  vcloud1: [[0.24, 0.6, 0.18], [0.44, 0.45, 0.25], [0.66, 0.5, 0.21], [0.82, 0.63, 0.14], [0.5, 0.66, 0.2], [0.33, 0.68, 0.14]],
  vcloud2: [[0.13, 0.6, 0.11], [0.3, 0.5, 0.18], [0.52, 0.41, 0.22], [0.73, 0.5, 0.17], [0.88, 0.6, 0.1], [0.5, 0.63, 0.17],
    [0.3, 0.65, 0.13], [0.7, 0.64, 0.13]],
  vcloud3: [[0.33, 0.6, 0.2], [0.56, 0.44, 0.24], [0.73, 0.6, 0.18], [0.5, 0.66, 0.19]],
};

// [base x, tip x, tip y, half width at the base] blades growing from the bottom of the box
const GRASS = {
  vgrass1: [[0.3, 0.12, 0.35, 0.05], [0.4, 0.3, 0.12, 0.05], [0.5, 0.52, 0.04, 0.055], [0.6, 0.72, 0.18, 0.05],
    [0.7, 0.9, 0.42, 0.045], [0.45, 0.4, 0.4, 0.04], [0.56, 0.62, 0.45, 0.04]],
  vgrass2: [[0.12, 0.02, 0.5, 0.04], [0.2, 0.16, 0.22, 0.045], [0.3, 0.34, 0.05, 0.05], [0.38, 0.28, 0.38, 0.04],
    [0.46, 0.5, 0.15, 0.05], [0.54, 0.62, 0.0, 0.05], [0.62, 0.58, 0.32, 0.04], [0.7, 0.8, 0.12, 0.05],
    [0.78, 0.74, 0.42, 0.04], [0.86, 0.98, 0.3, 0.045]],
  vgrass3: [[0.35, 0.2, 0.45, 0.06], [0.45, 0.42, 0.2, 0.07], [0.55, 0.6, 0.28, 0.07], [0.64, 0.82, 0.5, 0.06],
    [0.5, 0.5, 0.55, 0.05]],
};

// [rays, droop]: a round burst whose sparks fall a little, and a star of long and short rays
const FIREWORKS = { fwork1: [16, 0.14], fwork2: [12, 0] };

export const NATURE_STAMPS = [...Object.keys(CLOUDS), ...Object.keys(GRASS), ...Object.keys(FIREWORKS)];
export const isNature = (k) => k in CLOUDS || k in GRASS || k in FIREWORKS;
export const isFirework = (k) => k in FIREWORKS;

function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function hslRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

// Towards white (shade > 0) or black (shade < 0).
function css([r, g, b], shade = 0, alpha = 1) {
  const m = (v) => Math.round(shade >= 0 ? v + (255 - v) * shade : v * (1 + shade));
  return `rgba(${m(r)},${m(g)},${m(b)},${alpha})`;
}

// The colour of part i of n: the colour in use, or the rainbow spread over the parts.
function partColour(c, i, n) {
  return c === 'rainbow' ? hslRgb(i / Math.max(1, n), 0.88, 0.76) : rgbOf(c);
}

const isPale = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b > 225;

// A sparkle with four long points.
function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// Rays of sparks from the middle of the box, a sparkle at the end of each, in the colour in use or
// the rainbow ray by ray. A pale colour gets a grey edge so it shows on white paper.
function drawFirework(ctx, op) {
  const [x, y, w, h] = op.b, c = op.c || '#ffffff';
  const cx = x + w / 2, cy = y + h / 2, R = Math.min(w, h) / 2;
  const [n, droop] = FIREWORKS[op.k];
  const pale = c !== 'rainbow' && isPale(rgbOf(c));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (op.k === 'fwork1' ? 0.2 : 0);
    const reach = op.k === 'fwork2' && i % 2 ? 0.62 : 1;
    const rgb = partColour(c, i, n);
    const at = (t) => [cx + Math.sin(a) * R * reach * t, cy - Math.cos(a) * R * reach * t + droop * R * t * t];
    for (let j = 0; j < 6; j++) {
      const t = 0.22 + j * 0.13, [px, py] = at(t), r = R * (0.045 - j * 0.004);
      if (pale) { ctx.fillStyle = '#b9c6d6'; ctx.beginPath(); ctx.arc(px, py, r + 1, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = css(rgb, j > 3 ? 0.25 : 0, 0.95);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
    const [tx, ty] = at(1);
    if (pale) { ctx.fillStyle = '#b9c6d6'; sparkle(ctx, tx, ty, R * 0.13); }
    ctx.fillStyle = css(rgb, 0.15);
    sparkle(ctx, tx, ty, R * 0.11);
  }
  ctx.fillStyle = pale ? '#b9c6d6' : css(partColour(c, 0, 1), 0.4);
  sparkle(ctx, cx, cy, R * 0.16);
}

// Snow or glitter from a shake: n flakes over the page, placed from the seed s, a little more of them
// low down where they settle. The same list makes the falling animation and the drawing.
export function flakesOf(op) {
  const out = [];
  const r = (i, j) => { const v = Math.sin((op.s % 100000) * 0.013 + i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };
  const golds = ['#ffffff', '#ffe28a', '#ffd1ec'];
  for (let i = 0; i < op.n; i++) {
    const x = 10 + 780 * r(i, 0), y = 990 - 960 * r(i, 1) ** 1.3;
    if (op.k === 'snow') {
      out.push({ x, y, r: 3 + 6 * r(i, 2) ** 2, colour: '#f3f8ff', star: r(i, 3) < 0.15 });
    } else {
      // a dark colour would fall as specks of dirt: those shake out rainbow glitter
      const dark = op.c !== 'rainbow' && 0.299 * rgbOf(op.c)[0] + 0.587 * rgbOf(op.c)[1] + 0.114 * rgbOf(op.c)[2] < 90;
      const own = op.c === 'rainbow' || dark ? css(hslRgb(r(i, 4), 0.88, 0.7)) : op.c;
      out.push({ x, y, r: 4 + 7 * r(i, 2) ** 2, colour: r(i, 5) < 0.6 ? own : golds[i % golds.length], star: r(i, 3) < 0.55 });
    }
  }
  return out;
}

// One flake: a sparkle or a dot, with a blue-grey edge so white shows on white paper.
export function drawFlake(ctx, f, x, y, s = 1) {
  const r = f.r * s;
  ctx.fillStyle = '#9fb3cf';
  if (f.star) sparkle(ctx, x, y, r * 1.5 + s); else { ctx.beginPath(); ctx.arc(x, y, r + 0.8 * s, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = f.colour;
  if (f.star) sparkle(ctx, x, y, r * 1.5); else { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
}

export function drawFlakes(ctx, op) {
  for (const f of flakesOf(op)) drawFlake(ctx, f, f.x, f.y);
}

export function drawNature(ctx, op) {
  if (op.k in FIREWORKS) { drawFirework(ctx, op); return; }
  const [x, y, w, h] = op.b;
  const c = op.c || '#ffffff';
  if (op.k in CLOUDS) {
    const puffs = CLOUDS[op.k], s = (w + h) / 2;
    const base = partColour(c, 0, 1);
    const edge = Math.max(1.5, s * 0.025);
    ctx.fillStyle = isPale(base) ? '#b9c6d6' : css(base, -0.3);
    for (const [cx, cy, r] of puffs) { ctx.beginPath(); ctx.arc(x + cx * w, y + cy * h, r * s + edge, 0, Math.PI * 2); ctx.fill(); }
    puffs.forEach(([cx, cy, r], i) => {
      ctx.fillStyle = css(partColour(c, i, puffs.length));
      ctx.beginPath(); ctx.arc(x + cx * w, y + cy * h, r * s, 0, Math.PI * 2); ctx.fill();
    });
    // a soft shine on the top puffs
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [cx, cy, r] of puffs) {
      if (cy > 0.55) continue;
      ctx.beginPath(); ctx.ellipse(x + (cx - r * 0.3) * w, y + (cy - r * 0.35) * h, r * s * 0.35, r * s * 0.22, -0.5, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  const blades = GRASS[op.k];
  blades.forEach(([bx, tx, ty, hw], i) => {
    const rgb = partColour(c, i, blades.length);
    const shade = [-0.12, 0, 0.12][i % 3];
    const x0 = x + (bx - hw) * w, x1 = x + (bx + hw) * w, yb = y + h, xt = x + tx * w, yt = y + ty * h;
    ctx.beginPath();
    ctx.moveTo(x0, yb);
    ctx.quadraticCurveTo(x + (bx - hw * 0.2) * w + (xt - x - bx * w) * 0.25, y + (1 + ty) / 2 * h, xt, yt);
    ctx.quadraticCurveTo(x + (bx + hw * 0.6) * w + (xt - x - bx * w) * 0.25, y + (1 + ty) / 2 * h, x1, yb);
    ctx.closePath();
    ctx.fillStyle = css(rgb, shade);
    ctx.fill();
    ctx.lineWidth = Math.max(1, w * 0.008);
    ctx.strokeStyle = css(rgb, -0.4);
    ctx.stroke();
  });
}
