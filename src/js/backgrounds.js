// Page backgrounds of free drawings: white paper, themed pictures, squared and dotted paper. Each is
// painted in page units, with fixed pseudo-random placements so it looks the same every time.
// Plain coloured papers are no longer offered (the paint bucket does that) but old drawings keep theirs.

const W = 800, H = 1000;

export const BACKGROUNDS = [
  { k: 'paper', c: '#ffffff' }, { k: 'night' }, { k: 'sea' }, { k: 'meadow' }, { k: 'magic' },
  { k: 'snow' }, { k: 'sunset' }, { k: 'candy' },
  { k: 'village' }, { k: 'firs' }, { k: 'pole' }, { k: 'sleigh' }, { k: 'hearth' },
  { k: 'scratch' }, { k: 'grid' }, { k: 'dots' },
];

export const BG_NAMES = {
  paper: 'Page blanche', night: 'Espace', sea: 'Sous la mer', meadow: 'Prairie', magic: 'Ciel magique',
  snow: 'Neige', sunset: 'Coucher de soleil', candy: 'Gourmandises', grid: 'Carreaux', dots: 'Points',
  village: 'Village de Noël', firs: 'Sapins illuminés', pole: 'Pôle Nord', sleigh: 'Nuit de Noël', hearth: 'Coin du feu',
  scratch: 'Carte à gratter', plate: 'Plaque de base', studs: 'Plaque de base',
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
const PAPER = { night: '#1d2552', sea: '#3fa9cf', meadow: '#cdeccf', magic: '#e3c6ec', snow: '#d9e8f6', sunset: '#f4a58f', candy: '#ffe6f0',
  village: '#2c417f', firs: '#9a72ad', pole: '#16305c', sleigh: '#22387a', hearth: '#f2dabb',
  plate: '#dff1ff', studs: '#4aa35a' };
// 'scratch' for the scratch card: what the eraser shows there is not one colour, see scratchPaint.
export function paperColor(bg) {
  if (!bg || bg.k === 'paper') return bg ? bg.c : '#ffffff';
  return bg.k === 'scratch' ? 'scratch' : PAPER[bg.k] || '#ffffff';
}

// The scratch card: bright colours under a black coat that covers the page (art.js lays the coat under
// everything drawn). The eraser scratches the coat off; its stroke in progress is painted with this.
export const SCRATCH_COAT = '#17171d';
export function scratchPaint(ctx) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  for (let i = 0; i <= 12; i++) g.addColorStop(i / 12, `hsl(${(i * 55 + 320) % 360}, 95%, 60%)`);
  return g;
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

const hillY = (x, base, waves) => waves.reduce((y, [amp, len, phase]) => y + amp * Math.sin(x / len + phase), base);

function disc(ctx, x, y, r, style) {
  if (style) ctx.fillStyle = style;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function stars(ctx, n, seed, maxY) {
  ctx.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.35 + 0.65 * rand(i, seed + 3);
    disc(ctx, rand(i, seed) * W, rand(i, seed + 1) * maxY, 0.8 + 2 * rand(i, seed + 2) ** 2);
  }
  ctx.globalAlpha = 1;
}

function snowfall(ctx, n, seed, maxY) {
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.55 + 0.45 * rand(i, seed);
    disc(ctx, rand(i, seed + 1) * W, rand(i, seed + 2) * maxY, 1.5 + 3 * rand(i, seed + 3) ** 2);
  }
  ctx.globalAlpha = 1;
}

function night(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#0d1636'], [1, '#2d3166']]));
  stars(ctx, 150, 0, H);
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

function pine(ctx, x, y, s, green = '#2f7d5b') {
  ctx.fillStyle = '#7a5539';
  ctx.fillRect(x - 7 * s, y - 4, 14 * s, 28 * s);
  for (let i = 0; i < 3; i++) {
    const top = y - (60 + i * 42) * s, half = (62 - i * 14) * s, bottom = y - i * 42 * s;
    ctx.fillStyle = green;
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

// Christmas scenes. The middle of the page stays quiet in each of them, for what the child adds.

// A fir far away: three tiers in one colour, h high, standing on (x, y).
function fir(ctx, x, y, h, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const top = y - h + i * h * 0.24, bottom = y - h * 0.62 + i * h * 0.31, half = h * (0.2 + i * 0.08);
    ctx.moveTo(x, top); ctx.lineTo(x + half, bottom); ctx.lineTo(x - half, bottom); ctx.closePath();
  }
  ctx.fill();
}

function smoke(ctx, x, y, s) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  for (const [dx, dy, r] of [[0, -8, 7], [7, -24, 10], [1, -44, 13], [11, -68, 16]]) disc(ctx, x + dx * s, y + dy * s, r * s);
}

// A chalet seen from the front, standing on (x, y): snow on the roof and the chimney, lit windows.
function chalet(ctx, x, y, s, wall = '#8f5b3d') {
  const rect = (x0, y0, w, h) => ctx.fillRect(x + x0 * s, y + y0 * s, w * s, h * s);
  ctx.fillStyle = '#6a4330';
  rect(16, -98, 13, 42);
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(x - 40 * s, y); ctx.lineTo(x - 40 * s, y - 50 * s); ctx.lineTo(x, y - 90 * s); ctx.lineTo(x + 40 * s, y - 50 * s); ctx.lineTo(x + 40 * s, y);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 13 * s;
  ctx.beginPath(); ctx.moveTo(x - 49 * s, y - 45 * s); ctx.lineTo(x, y - 93 * s); ctx.lineTo(x + 49 * s, y - 45 * s); ctx.stroke();
  ctx.lineWidth = 7 * s;
  ctx.beginPath(); ctx.moveTo(x + 16 * s, y - 99 * s); ctx.lineTo(x + 29 * s, y - 99 * s); ctx.stroke();
  ctx.fillStyle = '#5a3826';
  rect(8, -32, 18, 32);
  glow(ctx, x - 20 * s, y - 26 * s, 34 * s, 'rgba(255, 214, 102, 0.5)', 'rgba(255, 214, 102, 0)');
  ctx.fillStyle = '#ffd966';
  rect(-31, -37, 21, 21);
  disc(ctx, x, y - 62 * s, 6.5 * s);
  ctx.strokeStyle = '#6a4330';
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 20.5 * s, y - 37 * s); ctx.lineTo(x - 20.5 * s, y - 16 * s);
  ctx.moveTo(x - 31 * s, y - 26.5 * s); ctx.lineTo(x - 10 * s, y - 26.5 * s);
  ctx.stroke();
}

function church(ctx, x, y, s) {
  const rect = (x0, y0, w, h) => ctx.fillRect(x + x0 * s, y + y0 * s, w * s, h * s);
  ctx.fillStyle = '#cdb99f';
  rect(20, -56, 78, 56);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x + 14 * s, y - 52 * s); ctx.lineTo(x + 22 * s, y - 86 * s); ctx.lineTo(x + 92 * s, y - 86 * s); ctx.lineTo(x + 104 * s, y - 52 * s);
  ctx.fill();
  ctx.fillStyle = '#dccab2';
  rect(-22, -122, 44, 122);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(x - 28 * s, y - 118 * s); ctx.lineTo(x, y - 196 * s); ctx.lineTo(x + 28 * s, y - 118 * s); ctx.fill();
  glow(ctx, x, y - 84 * s, 30 * s, 'rgba(255, 214, 102, 0.45)', 'rgba(255, 214, 102, 0)');
  ctx.fillStyle = '#ffd966';
  for (const [wx, wy, w, h] of [[0, -84, 14, 26], [40, -30, 11, 22], [60, -30, 11, 22], [80, -30, 11, 22]]) {
    ctx.beginPath();
    ctx.moveTo(x + (wx - w / 2) * s, y + (wy + h / 2) * s);
    ctx.lineTo(x + (wx - w / 2) * s, y + (wy - h / 2 + w / 2) * s);
    ctx.arc(x + wx * s, y + (wy - h / 2 + w / 2) * s, w / 2 * s, Math.PI, 0);
    ctx.lineTo(x + (wx + w / 2) * s, y + (wy + h / 2) * s);
    ctx.fill();
  }
  ctx.fillStyle = '#5a3826';
  ctx.beginPath(); ctx.moveTo(x - 9 * s, y); ctx.lineTo(x - 9 * s, y - 22 * s); ctx.arc(x, y - 22 * s, 9 * s, Math.PI, 0); ctx.lineTo(x + 9 * s, y); ctx.fill();
}

function moon(ctx, x, y, r) {
  glow(ctx, x, y, r * 2.4, 'rgba(255, 246, 205, 0.5)', 'rgba(255, 246, 205, 0)');
  disc(ctx, x, y, r, '#fff6cf');
  ctx.fillStyle = 'rgba(226, 210, 160, 0.5)';
  for (const [dx, dy, k] of [[-0.35, -0.22, 0.2], [0.28, 0.16, 0.14], [-0.1, 0.42, 0.11], [0.4, -0.38, 0.09], [-0.5, 0.2, 0.07]]) {
    disc(ctx, x + dx * r, y + dy * r, k * r);
  }
}

function village(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#0e1740'], [0.65, '#2c417f'], [1, '#6377b4']], 0, 760));
  stars(ctx, 120, 120, 600);
  moon(ctx, 610, 180, 64);
  const far = [[36, 170, 1], [10, 60, 0.3]], mid = [[28, 140, 2.6], [8, 50, 1]];
  ground(ctx, 650, far, '#7f95c8');
  for (let i = 0; i < 16; i++) {
    const x = 20 + i * 52 + 30 * rand(i, 130);
    fir(ctx, x, hillY(x, 650, far) + 8, 46 + 34 * rand(i, 131), '#3b4f86');
  }
  ground(ctx, 745, mid, '#bccdeb');
  const on = (x) => hillY(x, 745, mid);
  for (const [x, s] of [[215, 0.6], [470, 0.5], [600, 0.7]]) pine(ctx, x, on(x) + 6, s, '#2a6a55');
  church(ctx, 370, on(390) + 10, 0.95);
  for (const [x, s, wall] of [[110, 1, '#8f5b3d'], [285, 0.8, '#a2654a'], [545, 0.9, '#7d5138'], [700, 1.05, '#96603f']]) {
    smoke(ctx, x + 22 * s, on(x) - 96 * s, s);
    chalet(ctx, x, on(x) + 12 * s, s, wall);
  }
  ground(ctx, 880, [[20, 120, 0.8], [6, 40, 2]], '#eef4fc');
  pine(ctx, 55, 950, 1.5);
  pine(ctx, 772, 965, 1.45);
  snowfall(ctx, 110, 140, 900);
}

// Coloured bulbs on a wire hanging between two points.
function garland(ctx, x0, y0, x1, y1, sag, n, first) {
  const colours = ['#ff5a5f', '#ffd23f', '#4cd08a', '#5db7ff', '#ff8ad0'];
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + 2 * sag;
  ctx.strokeStyle = '#2b2f55';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
  for (let i = 1; i < n; i++) {
    const t = i / n, u = 1 - t;
    const x = u * u * x0 + 2 * u * t * mx + t * t * x1, y = u * u * y0 + 2 * u * t * my + t * t * y1 + 9;
    const c = colours[(i + first) % colours.length];
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
    glow(ctx, x, y, 24, `rgba(${r}, ${g}, ${b}, 0.55)`, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.ellipse(x, y, 6.5, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2f55';
    ctx.fillRect(x - 3, y - 12, 6, 5);
  }
}

// Baubles on a fir drawn by pine().
function baubles(ctx, x, y, s) {
  const colours = ['#ff5a5f', '#ffd23f', '#5db7ff', '#ff8ad0'];
  [[-34, -12], [8, -20], [38, -8], [-20, -52], [18, -58], [-8, -96], [10, -104]].forEach(([dx, dy], i) => {
    disc(ctx, x + dx * s, y + dy * s, 5 * s, colours[i % colours.length]);
  });
}

function firs(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#34356f'], [0.45, '#8f66a8'], [0.8, '#f1a9a0'], [1, '#fbd3b5']], 0, 720));
  stars(ctx, 60, 150, 300);
  for (let i = 0; i < 22; i++) fir(ctx, -10 + i * 39 + 22 * rand(i, 160), 690, 120 + 90 * rand(i, 161), '#7d74b3');
  for (let i = 0; i < 15; i++) fir(ctx, 10 + i * 56 + 30 * rand(i, 162), 745, 150 + 110 * rand(i, 163), '#4f5a96');
  ground(ctx, 730, [[18, 150, 0.4]], '#dfe6f6');
  pine(ctx, 165, 800, 1.2);
  pine(ctx, 640, 790, 1.1);
  ground(ctx, 850, [[22, 130, 2]], '#ffffff');
  pine(ctx, 50, 935, 2.3);
  baubles(ctx, 50, 935, 2.3);
  pine(ctx, 752, 945, 2.5);
  baubles(ctx, 752, 945, 2.5);
  garland(ctx, -20, 70, 820, 50, 70, 15, 0);
  garland(ctx, -20, 215, 820, 235, 55, 13, 2);
  snowfall(ctx, 90, 180, 880);
}

// A curtain of northern lights: a bright wavy ribbon at `base`, with rays fading upwards over `depth`.
function aurora(ctx, base, amp, len, phase, rgb, depth, seed) {
  const edge = (x) => base + amp * Math.sin(x / len + phase) + amp * 0.4 * Math.sin(x / (len * 0.37) + phase * 2);
  const ribbon = () => {
    ctx.beginPath();
    ctx.moveTo(-20, edge(-20));
    for (let x = -10; x <= W + 20; x += 10) ctx.lineTo(x, edge(x));
  };
  ribbon();
  ctx.lineTo(W + 20, base - depth);
  ctx.lineTo(-20, base - depth);
  ctx.fillStyle = vgrad(ctx, [[0, `rgba(${rgb}, 0)`], [1, `rgba(${rgb}, 0.26)`]], base - depth, base + amp);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [n, width, alpha, reach] of [[120, 8, 0.1, 1], [50, 4, 0.2, 0.7]]) {
    ctx.strokeStyle = `rgba(${rgb}, ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = rand(i, seed + width) * W;
      ctx.moveTo(x, edge(x));
      ctx.lineTo(x + 6, edge(x) - depth * reach * (0.3 + 0.7 * rand(i, seed + width + 1)));
    }
    ctx.stroke();
  }
  for (const [width, style] of [[22, `rgba(${rgb}, 0.28)`], [9, `rgba(${rgb}, 0.6)`], [3, 'rgba(255, 255, 255, 0.55)']]) {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ribbon();
    ctx.stroke();
  }
}

function igloo(ctx, x, y, r) {
  ctx.fillStyle = vgrad(ctx, [[0, '#fbfdff'], [1, '#c5d9ef']], y - r, y);
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.fill();
  ctx.strokeStyle = '#9fbcdc';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(x, y, r, Math.PI, 0); ctx.stroke();
  ctx.beginPath();
  const courses = [0, 0.33, 0.62, 0.86, 1];
  const half = (k) => Math.sqrt(Math.max(0, 1 - k * k)) * r;
  for (let j = 0; j < 4; j++) {
    const k0 = courses[j], k1 = courses[j + 1];
    if (j) { ctx.moveTo(x - half(k0), y - k0 * r); ctx.lineTo(x + half(k0), y - k0 * r); }
    for (let m = -4; m <= 4; m++) {
      const dx = (m + (j % 2) / 2) * r * 0.42;
      if (Math.abs(dx) < half(k1) - 4) { ctx.moveTo(x + dx, y - k0 * r); ctx.lineTo(x + dx, y - k1 * r); }
    }
  }
  ctx.stroke();
  ctx.fillStyle = '#eaf2fc';
  ctx.beginPath(); ctx.arc(x, y, r * 0.46, Math.PI, 0); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r * 0.46, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = '#2f4a73';
  ctx.beginPath(); ctx.arc(x, y, r * 0.31, Math.PI, 0); ctx.fill();
}

// The pole itself: red and white stripes under a golden ball.
function stripedPole(ctx, x, y, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 11, y - h, 22, h); ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 11, y - h, 22, h);
  ctx.fillStyle = '#e04a43';
  for (let yy = y - h - 30; yy < y; yy += 36) {
    ctx.beginPath(); ctx.moveTo(x - 11, yy + 22); ctx.lineTo(x + 11, yy); ctx.lineTo(x + 11, yy + 18); ctx.lineTo(x - 11, yy + 40); ctx.fill();
  }
  ctx.fillStyle = 'rgba(40, 60, 110, 0.18)';
  ctx.fillRect(x + 3, y - h, 8, h);
  ctx.restore();
  disc(ctx, x, y - h - 14, 18, '#ffcf4a');
  disc(ctx, x - 6, y - h - 20, 5, 'rgba(255, 255, 255, 0.7)');
}

function pole(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#06102c'], [1, '#1d4170']], 0, 740));
  stars(ctx, 130, 190, 560);
  aurora(ctx, 250, 26, 170, 4, '190, 130, 255', 190, 250);
  aurora(ctx, 380, 40, 120, 1.9, '110, 220, 255', 270, 260);
  aurora(ctx, 500, 46, 150, 0.3, '90, 255, 170', 330, 270);
  const far = [[26, 180, 0.9], [9, 70, 2]];
  ground(ctx, 700, far, '#a9c8e8');
  smoke(ctx, 432, hillY(410, 700, far) - 78, 0.9);
  chalet(ctx, 410, hillY(410, 700, far) + 10, 0.9, '#b8433c');
  for (const [x, h] of [[300, 70], [335, 95], [505, 85], [540, 60]]) fir(ctx, x, hillY(x, 700, far) + 6, h, '#2c5f6e');
  ground(ctx, 790, [[22, 150, 2.4], [7, 50, 0.5]], '#d6e6f6');
  igloo(ctx, 165, 872, 100);
  stripedPole(ctx, 640, 890, 170);
  ground(ctx, 905, [[14, 110, 1.2]], '#f6faff');
  snowfall(ctx, 80, 200, 900);
}

// One reindeer of the team in full gallop, seen as a shadow against the moon.
function reindeer(ctx, x, y) {
  ctx.beginPath(); ctx.ellipse(x, y, 26, 10.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 8); ctx.lineTo(x + 30, y - 30); ctx.lineTo(x + 40, y - 26); ctx.lineTo(x + 26, y + 2);
  ctx.moveTo(x - 24, y - 5); ctx.lineTo(x - 34, y - 12); ctx.lineTo(x - 26, y + 2);
  ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 39, y - 28, 10, 6, 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 4); ctx.lineTo(x + 34, y + 14); ctx.lineTo(x + 46, y + 10);
  ctx.moveTo(x + 12, y + 6); ctx.lineTo(x + 24, y + 22); ctx.lineTo(x + 36, y + 22);
  ctx.moveTo(x - 18, y + 4); ctx.lineTo(x - 34, y + 16); ctx.lineTo(x - 46, y + 12);
  ctx.moveTo(x - 12, y + 6); ctx.lineTo(x - 22, y + 24); ctx.lineTo(x - 34, y + 26);
  ctx.stroke();
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(x + 35, y - 33); ctx.lineTo(x + 29, y - 52); ctx.moveTo(x + 32, y - 42); ctx.lineTo(x + 39, y - 50);
  ctx.moveTo(x + 40, y - 33); ctx.lineTo(x + 47, y - 50); ctx.moveTo(x + 43, y - 41); ctx.lineTo(x + 51, y - 44);
  ctx.stroke();
}

// Santa's sleigh and three reindeer, about 380 units long around (0, 0), flying to the right.
function team(ctx) {
  ctx.fillStyle = ctx.strokeStyle = '#1b2150';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  reindeer(ctx, 140, -6);
  reindeer(ctx, 60, 4);
  reindeer(ctx, -20, -4);
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-78, -6); ctx.lineTo(-20, -10); ctx.lineTo(60, -2); ctx.lineTo(140, -12); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-178, -20);
  ctx.quadraticCurveTo(-164, -30, -160, -6);
  ctx.lineTo(-104, -6); ctx.lineTo(-92, -32); ctx.lineTo(-76, -34);
  ctx.quadraticCurveTo(-72, 14, -100, 16);
  ctx.lineTo(-160, 16);
  ctx.quadraticCurveTo(-184, 12, -178, -20);
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-186, 18); ctx.quadraticCurveTo(-186, 28, -172, 28); ctx.lineTo(-86, 28); ctx.quadraticCurveTo(-70, 28, -68, 16);
  ctx.moveTo(-150, 16); ctx.lineTo(-150, 28); ctx.moveTo(-104, 16); ctx.lineTo(-104, 28);
  ctx.stroke();
  disc(ctx, -152, -22, 19);
  ctx.beginPath(); ctx.ellipse(-122, -22, 15, 19, 0, 0, Math.PI * 2); ctx.fill();
  disc(ctx, -118, -47, 9);
  ctx.beginPath(); ctx.moveTo(-127, -50); ctx.lineTo(-109, -53); ctx.lineTo(-134, -70); ctx.fill();
  disc(ctx, -135, -70, 4);
}

function sleigh(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#0a1034'], [0.7, '#253d7c'], [1, '#42609f']]));
  stars(ctx, 140, 210, 800);
  ctx.fillStyle = 'rgba(255, 244, 190, 0.9)';
  for (let i = 0; i < 14; i++) sparkle(ctx, rand(i, 215) * W, rand(i, 216) * 640, 5 + 9 * rand(i, 217) ** 2);
  moon(ctx, 400, 320, 185);
  ctx.save();
  ctx.translate(404, 322);
  ctx.rotate(-0.2);
  ctx.scale(0.86, 0.86);
  team(ctx);
  ctx.restore();
  for (let i = 0; i < 14; i++) fir(ctx, 10 + i * 60 + 30 * rand(i, 220), 905, 90 + 70 * rand(i, 221), '#1a2456');
  for (const [x, y, s, wall] of [[95, 1012, 1.75, '#39407a'], [262, 1020, 1.5, '#4b3f6e'], [425, 1008, 1.9, '#33487d'],
    [600, 1022, 1.55, '#4b3f6e'], [745, 1010, 1.7, '#39407a']]) {
    smoke(ctx, x + 22 * s, y - 100 * s, s * 0.8);
    chalet(ctx, x, y, s, wall);
  }
  snowfall(ctx, 90, 225, 960);
}

function flame(ctx, x, y, w, h, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.bezierCurveTo(x - w * 0.62, y - h * 0.45, x - w * 0.12, y - h * 0.6, x + w * 0.06, y - h);
  ctx.bezierCurveTo(x + w * 0.2, y - h * 0.62, x + w * 0.62, y - h * 0.42, x + w / 2, y);
  ctx.fill();
}

function gift(ctx, x, y, w, h, colour, ribbon) {
  ctx.fillStyle = colour;
  ctx.fillRect(x, y - h, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.fillRect(x, y - h, w, h * 0.16);
  ctx.fillStyle = ribbon;
  ctx.fillRect(x + w / 2 - 5, y - h, 10, h);
  ctx.beginPath();
  ctx.ellipse(x + w / 2 - 9, y - h - 5, 10, 6, -0.5, 0, Math.PI * 2);
  ctx.ellipse(x + w / 2 + 9, y - h - 5, 10, 6, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function stocking(ctx, x, y, colour) {
  ctx.strokeStyle = '#7a4a2e';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 9); ctx.stroke();
  ctx.fillStyle = colour;
  ctx.fillRect(x - 11, y + 20, 22, 36);
  ctx.beginPath(); ctx.ellipse(x + 7, y + 58, 20, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 14, y + 8, 28, 15, 5); else ctx.rect(x - 14, y + 8, 28, 15);
  ctx.fill();
}

function hearth(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#f6e3c8'], [1, '#efd3b0']], 0, 800), 0, 800);
  ctx.fillStyle = 'rgba(214, 170, 120, 0.16)';
  for (let x = 0; x < W; x += 80) ctx.fillRect(x, 0, 40, 800);
  fillAll(ctx, vgrad(ctx, [[0, '#b98859'], [1, '#9c6d43']], 800, H), 800, H);
  ctx.strokeStyle = 'rgba(110, 70, 40, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  [850, 905, 962].forEach((y, j) => {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    for (let x = 90 + j * 130; x < W; x += 300) { ctx.moveTo(x, y); ctx.lineTo(x, y - 52); }
  });
  ctx.stroke();
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(0, 780, W, 22);

  // a window on the snowy night
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(38, 228, 204, 264);
  ctx.fillStyle = vgrad(ctx, [[0, '#17245a'], [1, '#3c5aa0']], 240, 480);
  ctx.fillRect(50, 240, 180, 240);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 34; i++) disc(ctx, 54 + rand(i, 230) * 172, 244 + rand(i, 231) * 222, 1.6 + 2.6 * rand(i, 232) ** 2);
  ctx.beginPath(); ctx.moveTo(50, 480); ctx.quadraticCurveTo(95, 452, 140, 470); ctx.quadraticCurveTo(190, 448, 230, 480); ctx.fill();
  ctx.fillRect(136, 240, 8, 240);
  ctx.fillRect(50, 352, 180, 8);
  ctx.fillRect(28, 488, 224, 16);

  // the fireplace, its fire, the stockings on the mantel
  ctx.fillStyle = '#b4553e';
  ctx.fillRect(270, 560, 260, 240);
  ctx.strokeStyle = 'rgba(240, 190, 165, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let j = 0; j < 8; j++) {
    const y = 590 + j * 30;
    ctx.moveTo(270, y); ctx.lineTo(530, y);
    for (let x = 270 + (j % 2 ? 26 : 52); x < 530; x += 52) { ctx.moveTo(x, y - 30); ctx.lineTo(x, y); }
  }
  ctx.stroke();
  ctx.fillStyle = '#2b1a17';
  ctx.beginPath(); ctx.moveTo(322, 800); ctx.lineTo(322, 690); ctx.arc(400, 690, 78, Math.PI, 0); ctx.lineTo(478, 800); ctx.fill();
  glow(ctx, 400, 770, 130, 'rgba(255, 170, 60, 0.6)', 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = '#6b4226';
  ctx.save(); ctx.translate(400, 790); ctx.rotate(0.12); ctx.fillRect(-62, -9, 124, 16); ctx.rotate(-0.26); ctx.fillRect(-58, -12, 116, 15); ctx.restore();
  flame(ctx, 400, 788, 92, 128, '#ff8a2b');
  flame(ctx, 362, 788, 50, 82, '#ff8a2b');
  flame(ctx, 440, 788, 56, 94, '#ff8a2b');
  flame(ctx, 400, 788, 50, 78, '#ffd34d');
  flame(ctx, 364, 788, 26, 46, '#ffd34d');
  flame(ctx, 438, 788, 28, 52, '#ffd34d');
  ctx.fillStyle = '#8b8fa0';
  ctx.fillRect(254, 796, 292, 16);
  ctx.fillStyle = '#7a4a2e';
  ctx.fillRect(244, 536, 312, 30);
  ctx.fillStyle = '#93603f';
  ctx.fillRect(244, 536, 312, 8);
  stocking(ctx, 305, 566, '#d9463e');
  stocking(ctx, 400, 566, '#3f9b5b');
  stocking(ctx, 495, 566, '#d9463e');
  for (let i = 0; i < 15; i++) disc(ctx, 254 + i * 21, 530 + 4 * Math.sin(i * 1.3), 14, i % 2 ? '#3f8f55' : '#347c49');
  for (let i = 0; i < 7; i++) disc(ctx, 264 + i * 45, 532, 4.5, '#e04a43');

  // a rug, then the tree and its presents
  ctx.fillStyle = '#c8504a';
  ctx.beginPath(); ctx.ellipse(330, 918, 215, 50, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f3d9a4';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(330, 918, 190, 38, 0, 0, Math.PI * 2); ctx.stroke();
  const tx = 662;
  ctx.fillStyle = '#7a5539';
  ctx.fillRect(tx - 13, 838, 26, 40);
  ctx.fillStyle = '#b4553e';
  ctx.beginPath(); ctx.moveTo(tx - 34, 868); ctx.lineTo(tx + 34, 868); ctx.lineTo(tx + 26, 912); ctx.lineTo(tx - 26, 912); ctx.fill();
  const colours = ['#ff5a5f', '#ffd23f', '#5db7ff', '#ff8ad0', '#ffffff'];
  for (let i = 3; i >= 0; i--) {
    const top = 432 + i * 82, bottom = top + 158, half = 58 + i * 34;
    ctx.fillStyle = i % 2 ? '#2f8a57' : '#37975f';
    ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx + half, bottom); ctx.quadraticCurveTo(tx, bottom + 22, tx - half, bottom); ctx.fill();
    ctx.strokeStyle = '#ffe28a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(tx - half * 0.62, bottom - 50); ctx.quadraticCurveTo(tx, bottom - 8, tx + half * 0.7, bottom - 44); ctx.stroke();
    for (let b = 0; b < 3 + i; b++) {
      const f = (b + 0.5) / (3 + i), x = tx + (f - 0.5) * 1.5 * half, y = bottom - 14 - 26 * Math.sin(f * Math.PI) + 8 * rand(i * 7 + b, 240);
      disc(ctx, x, y, 8.5, colours[(i * 2 + b) % colours.length]);
    }
  }
  glow(ctx, tx, 428, 60, 'rgba(255, 220, 110, 0.6)', 'rgba(255, 220, 110, 0)');
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28;
    ctx.lineTo(tx + r * Math.cos(a), 428 + r * Math.sin(a));
  }
  ctx.fill();
  gift(ctx, 520, 930, 74, 62, '#d9463e', '#ffd23f');
  gift(ctx, 590, 950, 58, 46, '#4a8fd9', '#ffffff');
  gift(ctx, 706, 940, 70, 58, '#3f9b5b', '#e04a43');
}

function scratch(ctx) {
  fillAll(ctx, scratchPaint(ctx));
}

// For the bricks seen from the side: a sky and a green baseplate along the bottom, its studs showing
// until bricks stand on them.
function plate(ctx) {
  fillAll(ctx, vgrad(ctx, [[0, '#cfe9ff'], [1, '#f4fbff']]));
  ctx.fillStyle = '#3f9a4f';
  for (let x = 8; x < W; x += 40) ctx.fillRect(x, 984, 24, 9);
  ctx.fillStyle = '#4aa35a';
  ctx.fillRect(0, 992, W, 8);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(0, 992, W, 2);
}

// For the bricks seen from above: a baseplate covering the page, a stud in every square.
let studTile = null;
function studs(ctx) {
  if (!studTile) {
    studTile = document.createElement('canvas');
    studTile.width = studTile.height = 80;  // twice the size of a square, to stay sharp when zoomed
    const c = studTile.getContext('2d');
    c.scale(2, 2);
    c.fillStyle = '#4aa35a';
    c.fillRect(0, 0, 40, 40);
    c.fillStyle = 'rgba(0, 0, 0, 0.18)';
    c.beginPath(); c.arc(21.5, 22, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#55b066';
    c.beginPath(); c.arc(20, 20, 12, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(20, 20, 8.5, Math.PI * 1.05, Math.PI * 1.55); c.stroke();
  }
  const pattern = ctx.createPattern(studTile, 'repeat');
  if (pattern.setTransform) pattern.setTransform(new DOMMatrix([0.5, 0, 0, 0.5, 0, 0]));
  fillAll(ctx, pattern);
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

const PAINTERS = { night, sea, meadow, magic, snow, sunset, candy, village, firs, pole, sleigh, hearth, scratch, plate, studs, grid, dots };

// Paints background `bg` (null for white paper) over the whole page, in page units.
export function paintBackground(ctx, bg) {
  const paint = bg && PAINTERS[bg.k];
  ctx.save();
  if (paint) paint(ctx);
  else fillAll(ctx, bg && bg.k === 'paper' ? bg.c : '#ffffff');
  ctx.restore();
}
