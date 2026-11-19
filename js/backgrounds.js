// Page backgrounds of free drawings: white paper, themed pictures, squared and dotted paper. Each is
// painted in page units, with fixed pseudo-random placements so it looks the same every time.
// Plain coloured papers are no longer offered (the paint bucket does that) but old drawings keep theirs.

const W = 800, H = 1000;

export const BACKGROUNDS = [
  { k: 'paper', c: '#ffffff' }, { k: 'night' }, { k: 'sea' }, { k: 'meadow' }, { k: 'magic' },
  { k: 'snow' }, { k: 'sunset' }, { k: 'candy' }, { k: 'grid' }, { k: 'dots' },
];

export const BG_NAMES = {
  paper: 'Page blanche', night: 'Espace', sea: 'Sous la mer', meadow: 'Prairie', magic: 'Ciel magique',
  snow: 'Neige', sunset: 'Coucher de soleil', candy: 'Gourmandises', grid: 'Carreaux', dots: 'Points',
};

// Patterns are shown up close on their buttons, or their lines would be thinner than a pixel.
export const BG_CLOSE_UP = new Set(['grid', 'dots']);

const rand = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return v - Math.floor(v); };

export function backgroundOf(ops) {
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].t === 'bg') return ops[i];
  return null;
}

export const sameBackground = (a, b) => (a ? a.k : 'paper') === (b ? b.k : 'paper') && (a && a.c || '#ffffff') === (b && b.c || '#ffffff');

// The colour the eraser shows while erasing: roughly the background.
const PAPER = { night: '#1d2552', sea: '#3fa9cf', meadow: '#cdeccf', magic: '#e3c6ec', snow: '#d9e8f6', sunset: '#f4a58f', candy: '#ffe6f0' };
export function paperColor(bg) {
  if (!bg || bg.k === 'paper') return bg ? bg.c : '#ffffff';
  return PAPER[bg.k] || '#ffffff';
}

function vgrad(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [at, c] of stops) g.addColorStop(at, c);
  return g;
}

function fillAll(ctx, style, y0 = 0, y1 = H) {
  ctx.fillStyle = style;
  ctx.fillRect(0, y0, W, y1 - y0);
}

function glow(ctx, x, y, r, inner, outer) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function cloud(ctx, x, y, s, colour = '#ffffff') {
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (const [dx, dy, r] of [[-62, 10, 30], [-28, -14, 40], [18, -22, 46], [60, 0, 34], [0, 16, 36], [-34, 20, 26], [40, 20, 28]]) {
    ctx.moveTo(x + (dx + r) * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
  }
  ctx.fill();
}

// A twinkle: four long thin points.
function sparkle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// A wavy top edge from left to right, then down to the bottom of the page.
function ground(ctx, base, waves, style) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) {
    let y = base;
    for (const [amp, len, phase] of waves) y += amp * Math.sin(x / len + phase);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = style;
  ctx.fill();
}

function night(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#0d1636'], [1, '#2d3166']]));
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 150; i++) {
    ctx.globalAlpha = 0.35 + 0.65 * rand(i, 3);
    ctx.beginPath();
    ctx.arc(rand(i, 0) * W, rand(i, 1) * H, 0.8 + 2 * rand(i, 2) ** 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function sea(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#93def0'], [0.45, '#43aed3'], [1, '#1f72a3']]));
  // light coming down from the surface, fading out on its way
  ctx.fillStyle = vgrad(ctx, [[0, 'rgba(255, 255, 255, 0.16)'], [1, 'rgba(255, 255, 255, 0)']], 0, 820);
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * 170 + (rand(i, 40) - 0.5) * 60, w = 30 + rand(i, 41) * 45;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + w, 0); ctx.lineTo(x + w * 2.4 - 150, 820); ctx.lineTo(x - 150, 820);
    ctx.fill();
  }
  // seaweed swaying up from the sand
  for (const [x, h, c] of [[45, 300, '#2f9e5f'], [95, 210, '#4dbb73'], [705, 260, '#2f9e5f'], [755, 330, '#4dbb73'], [610, 150, '#3aa86a']]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, 940);
    for (let t = 1; t <= 12; t++) ctx.lineTo(x + 16 * Math.sin(t * 0.9 + x), 940 - h * t / 12);
    ctx.stroke();
  }
  ground(ctx, 905, [[12, 70, 0], [7, 23, 1]], vgrad(ctx, [[0, '#f6e0aa'], [1, '#e2bf7b']], 890, H));
  // a starfish and a few pebbles on the sand
  ctx.fillStyle = '#ff9a6b';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 27;
    ctx.lineTo(540 + r * Math.cos(a), 955 + r * Math.sin(a));
  }
  ctx.fill();
  ctx.fillStyle = '#d4b177';
  for (const [x, y, r] of [[200, 960, 9], [222, 968, 6], [340, 975, 7], [650, 950, 8]]) {
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2); ctx.fill();
  }
  // bubbles rising in three columns
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2.5;
  for (const [x0, y0] of [[150, 760], [470, 560], [660, 700]]) {
    for (let i = 0; i < 7; i++) {
      const r = 4 + i * 2.2, x = x0 + 14 * Math.sin(i * 1.7 + x0), y = y0 - i * 70 - i * i * 6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.stroke();
    }
  }
}

function meadow(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#9fd9ff'], [0.7, '#e6f6ff']], 0, 720));
  glow(ctx, 670, 140, 150, 'rgba(255, 238, 160, 0.95)', 'rgba(255, 238, 160, 0)');
  ctx.fillStyle = '#ffe070';
  ctx.beginPath(); ctx.arc(670, 140, 58, 0, Math.PI * 2); ctx.fill();
  cloud(ctx, 170, 150, 1);
  cloud(ctx, 420, 260, 0.62);
  ground(ctx, 690, [[30, 160, 0.5], [10, 60, 2]], '#b8e391');
  ground(ctx, 780, [[24, 130, 3], [8, 45, 1]], '#95d272');
  ground(ctx, 880, [[16, 110, 1.3]], '#7bc464');
  // flowers in the grass, and a few blades
  const colours = ['#ffffff', '#ffd54f', '#f8a5c2', '#d1a3e8'];
  for (let i = 0; i < 48; i++) {
    const x = 20 + rand(i, 50) * 760, y = 790 + rand(i, 51) * 195, r = 3.5 + 2 * rand(i, 52);
    ctx.fillStyle = colours[i % colours.length];
    ctx.beginPath();
    for (let p = 0; p < 5; p++) {
      const a = p * Math.PI * 2 / 5 + rand(i, 53);
      ctx.moveTo(x + r * 1.15 * Math.cos(a) + r, y + r * 1.15 * Math.sin(a));
      ctx.arc(x + r * 1.15 * Math.cos(a), y + r * 1.15 * Math.sin(a), r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#ffb300';
    ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#5fae4c';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = rand(i, 60) * W, y = 800 + rand(i, 61) * 190;
    ctx.moveTo(x - 6, y - 12); ctx.lineTo(x, y); ctx.lineTo(x + 5, y - 14);
  }
  ctx.stroke();
}

function magic(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#f8c4de'], [0.5, '#d8c3f3'], [1, '#b6dbf7']]));
  // a pastel rainbow rising from the clouds
  const bands = ['#ffb3c7', '#ffd3a8', '#fff2a8', '#c6f0b8', '#b6e3f7', '#cdb9f5'];
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 26;
  bands.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath(); ctx.arc(400, 1040, 560 - i * 26, Math.PI, 2 * Math.PI); ctx.stroke();
  });
  ctx.globalAlpha = 1;
  // a crescent moon: a disc painted everywhere but inside a second disc
  glow(ctx, 140, 160, 110, 'rgba(255, 250, 220, 0.7)', 'rgba(255, 250, 220, 0)');
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(166, 142, 50, 0, Math.PI * 2);
  ctx.clip('evenodd');
  ctx.fillStyle = '#fff6c4';
  ctx.beginPath(); ctx.arc(150, 150, 56, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  for (let i = 0; i < 46; i++) {
    const x = rand(i, 70) * W, y = rand(i, 71) * 760, r = 3 + 11 * rand(i, 72) ** 2;
    ctx.fillStyle = i % 4 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 236, 140, 0.95)';
    sparkle(ctx, x, y, r);
  }
  for (const [x, s] of [[60, 0.9], [230, 0.7], [400, 1], [590, 0.75], [760, 0.95]]) cloud(ctx, x, 975, s, 'rgba(255, 255, 255, 0.92)');
}

function flake(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, cx = Math.cos(a), cy = Math.sin(a);
    ctx.moveTo(x, y); ctx.lineTo(x + r * cx, y + r * cy);
    const bx = x + r * 0.6 * cx, by = y + r * 0.6 * cy;
    for (const s of [-1, 1]) {
      const b = a + s * Math.PI / 4;
      ctx.moveTo(bx, by); ctx.lineTo(bx + r * 0.3 * Math.cos(b), by + r * 0.3 * Math.sin(b));
    }
  }
  ctx.stroke();
}

function pine(ctx, x, y, s) {
  ctx.fillStyle = '#7a5539';
  ctx.fillRect(x - 7 * s, y - 4, 14 * s, 28 * s);
  for (let i = 0; i < 3; i++) {
    const top = y - (60 + i * 42) * s, half = (62 - i * 14) * s, bottom = y - i * 42 * s;
    ctx.fillStyle = '#2f7d5b';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + half, bottom); ctx.lineTo(x - half, bottom); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + half * 0.42, top + (bottom - top) * 0.42); ctx.lineTo(x - half * 0.42, top + (bottom - top) * 0.42); ctx.fill();
  }
}

function snow(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#9cc0e6'], [0.75, '#dbe9f7']]));
  ground(ctx, 760, [[34, 150, 0.4], [10, 55, 2]], '#e8f0fa');
  pine(ctx, 110, 790, 1.1);
  pine(ctx, 690, 770, 1.25);
  pine(ctx, 600, 830, 0.8);
  ground(ctx, 860, [[22, 120, 2.2]], '#ffffff');
  ctx.strokeStyle = '#c9dbef';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 10) ctx[x ? 'lineTo' : 'moveTo'](x, 862 + 22 * Math.sin(x / 120 + 2.2));
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 140; i++) {
    ctx.globalAlpha = 0.6 + 0.4 * rand(i, 80);
    ctx.beginPath(); ctx.arc(rand(i, 81) * W, rand(i, 82) * 880, 1.5 + 3 * rand(i, 83) ** 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 14; i++) flake(ctx, rand(i, 84) * W, rand(i, 85) * 720, 8 + 9 * rand(i, 86));
  ctx.globalAlpha = 1;
}

function sunset(ctx) {
  const horizon = 640;
  fillAll(ctx, vgrad(ctx, [[0, '#6c5cae'], [0.45, '#e488b3'], [0.8, '#ffb36e'], [1, '#ffd57d']], 0, horizon), 0, horizon);
  glow(ctx, 400, horizon, 260, 'rgba(255, 236, 160, 0.9)', 'rgba(255, 236, 160, 0)');
  ctx.fillStyle = '#fff0a6';
  ctx.beginPath(); ctx.arc(400, horizon, 112, Math.PI, 2 * Math.PI); ctx.fill();
  fillAll(ctx, vgrad(ctx, [[0, '#f6a98b'], [1, '#6f6db3']], horizon, 850), horizon, 850);
  // the sun's reflection, in shorter and shorter strokes
  ctx.strokeStyle = 'rgba(255, 240, 170, 0.75)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const y = horizon + 14 + i * 24, half = 110 - i * 12;
    ctx.lineWidth = 7 - i * 0.5;
    ctx.beginPath(); ctx.moveTo(400 - half + 20 * rand(i, 90), y); ctx.lineTo(400 + half - 20 * rand(i, 91), y); ctx.stroke();
  }
  ground(ctx, 860, [[12, 90, 0.7], [5, 30, 2]], vgrad(ctx, [[0, '#f8dcaa'], [1, '#efc387']], 840, H));
  // birds far away
  ctx.strokeStyle = '#4f3f7a';
  ctx.lineWidth = 3.5;
  for (const [x, y, s] of [[180, 230, 1], [235, 270, 0.75], [590, 180, 0.9]]) {
    ctx.beginPath();
    ctx.moveTo(x - 22 * s, y); ctx.quadraticCurveTo(x - 10 * s, y - 14 * s, x, y);
    ctx.quadraticCurveTo(x + 10 * s, y - 14 * s, x + 22 * s, y);
    ctx.stroke();
  }
}

function candy(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#ffd9e8'], [1, '#fff1f6']]));
  const colours = ['#ff8fb1', '#7cc8f5', '#ffd84d', '#8fdca0', '#c3a3ff', '#ffffff', '#ffab6b'];
  for (let i = 0; i < 150; i++) {
    const x = rand(i, 100) * W, y = 150 + rand(i, 101) * 840, a = rand(i, 102) * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillStyle = colours[i % colours.length];
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-12, -3.6, 24, 7.2, 3.6); else ctx.rect(-12, -3.6, 24, 7.2);
    ctx.fill();
    ctx.restore();
  }
  // icing running down from the top
  ctx.fillStyle = '#fff8fb';
  ctx.strokeStyle = '#f4b8cf';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 70);
  let x = 0;
  for (let i = 0; x < W; i++) {
    const w = 60 + 50 * rand(i, 110), drip = 30 + 110 * rand(i, 111) ** 1.5, r = Math.min(20, w / 4);
    const mid = x + w / 2;
    ctx.quadraticCurveTo(mid - r * 1.6, 72, mid - r, 72 + drip - r);
    ctx.arc(mid, 72 + drip - r, r, Math.PI, 0, true);
    ctx.quadraticCurveTo(mid + r * 1.6, 72, x + w, 70);
    x += w;
  }
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function grid(ctx) {
  fillAll(ctx, '#ffffff');
  ctx.strokeStyle = '#c9dcf3';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let x = 40; x < W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 40; y < H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
}

function dots(ctx) {
  fillAll(ctx, '#ffffff');
  ctx.fillStyle = '#bfc4d6';
  ctx.beginPath();
  for (let x = 40; x < W; x += 40) for (let y = 40; y < H; y += 40) { ctx.moveTo(x + 2.6, y); ctx.arc(x, y, 2.6, 0, Math.PI * 2); }
  ctx.fill();
}

const PAINTERS = { night, sea, meadow, magic, snow, sunset, candy, grid, dots };

// Paints background `bg` (null for white paper) over the whole page, in page units.
export function paintBackground(ctx, bg) {
  const paint = bg && PAINTERS[bg.k];
  ctx.save();
  if (paint) paint(ctx);
  else fillAll(ctx, bg && bg.k === 'paper' ? bg.c : '#ffffff');
  ctx.restore();
}
