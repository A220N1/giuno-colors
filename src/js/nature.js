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

export const NATURE_STAMPS = [...Object.keys(CLOUDS), ...Object.keys(GRASS)];
export const isNature = (k) => k in CLOUDS || k in GRASS;

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

export function drawNature(ctx, op) {
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
