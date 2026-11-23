// Building bricks seen from the side, for the free drawing: pieces that snap to a grid of studs and
// stack, in the colour in use. Proportions of real bricks: a stud every 5 units for a brick 6 high,
// three plates to a brick, a stud a sixth of a brick high.
// A brick operation is { t: 'brick', k, c, x, y }: piece k with its left side on stud column x and
// its underside y plates above the bottom row. Pieces seen from above (a mosaic) lie on a square grid
// of studs instead: y then counts studs from the bottom of the page.
// A brick moved elsewhere is a new brick carrying r, the rank of the brick it replaces in the list of
// operations; { t: 'unbrick', i } takes brick i away; { t: 'model', k } shows model k to build over.
import { RAINBOW } from './brushes.js';

export const STUD = 40;        // page units between two studs
export const PLATE = 16;       // height of a plate; a brick is three of them
export const BASE = 992;       // page y of the bottom row
export const COLS = 20;
export const ROWS = 62;        // in plates
const KNOB = 8;                // height of a stud
const BRICK = 3;

// Outlines in a box w wide and h high, the origin at its bottom left corner and y going up as negative.
const box = (w, h) => `M0 0H${w}V${-h}H0Z`;
const SHAPES = {
  box,
  slopeRight: (w, h) => `M0 0H${w}V-9L${STUD} ${-h}H0Z`,
  slopeLeft: (w, h) => `M0 0H${w}V${-h}H${w - STUD}L0 -9Z`,
  invertRight: (w, h) => `M0 0H${STUD}L${w} ${-h + 9}V${-h}H0Z`,
  invertLeft: (w, h) => `M${w - STUD} 0H${w}V${-h}H0V${-h + 9}Z`,
  round: (w, h) => `M9 0H${w - 9}Q${w} 0 ${w} -9V${-h + 9}Q${w} ${-h} ${w - 9} ${-h}H9Q0 ${-h} 0 ${-h + 9}V-9Q0 0 9 0Z`,
  cone: (w, h) => `M2 0H${w - 2}L${w * 0.68} ${-h}H${w * 0.32}Z`,
  arch: (w, h) => `M0 0H${STUD}A${w / 2 - STUD} ${h - 9} 0 0 1 ${w - STUD} 0H${w}V${-h}H0Z`,
  dome: (w, h) => `M0 0H${w}V-9C${w} ${-h * 0.75} ${w * 0.75} ${-h} ${w / 2} ${-h}C${w * 0.25} ${-h} 0 ${-h * 0.75} 0 -9Z`,
  wheel: (w) => `M0 ${-w / 2}A${w / 2} ${w / 2} 0 1 1 ${w} ${-w / 2}A${w / 2} ${w / 2} 0 1 1 0 ${-w / 2}Z`,
  flag: (w, h) => `M6 0H12V${-h + 36}L${w - 4} ${-h + 18}L12 ${-h}H6Z`,
  flower: () => 'M17 0H23V-21A13 13 0 1 0 17 -21Z',
  tile: (w, h) => `M4 0H${w - 4}Q${w} 0 ${w} -4V${-h + 4}Q${w} ${-h} ${w - 4} ${-h}H4Q0 ${-h} 0 ${-h + 4}V-4Q0 0 4 0Z`,
  disc: (w) => `M1 ${-w / 2}A${w / 2 - 1} ${w / 2 - 1} 0 1 1 ${w - 1} ${-w / 2}A${w / 2 - 1} ${w / 2 - 1} 0 1 1 1 ${-w / 2}Z`,
};

const all = (n) => Array.from({ length: n }, (_, i) => i);
// w in studs, h in plates, the studs that stand on top, and what is drawn on the face.
export const PIECES = {
  b1: { w: 1, h: BRICK, shape: 'box', studs: all(1) },
  b2: { w: 2, h: BRICK, shape: 'box', studs: all(2) },
  b3: { w: 3, h: BRICK, shape: 'box', studs: all(3) },
  b4: { w: 4, h: BRICK, shape: 'box', studs: all(4) },
  b6: { w: 6, h: BRICK, shape: 'box', studs: all(6) },
  p1: { w: 1, h: 1, shape: 'box', studs: all(1) },
  p2: { w: 2, h: 1, shape: 'box', studs: all(2) },
  p4: { w: 4, h: 1, shape: 'box', studs: all(4) },
  sl: { w: 2, h: BRICK, shape: 'slopeLeft', studs: [1] },
  sr: { w: 2, h: BRICK, shape: 'slopeRight', studs: [0] },
  il: { w: 2, h: BRICK, shape: 'invertLeft', studs: all(2) },
  ir: { w: 2, h: BRICK, shape: 'invertRight', studs: all(2) },
  arch: { w: 4, h: BRICK, shape: 'arch', studs: all(4) },
  dome: { w: 2, h: BRICK, shape: 'dome', studs: [] },
  r1: { w: 1, h: BRICK, shape: 'round', studs: all(1) },
  cone: { w: 1, h: BRICK, shape: 'cone', studs: [] },
  eye: { w: 1, h: BRICK, shape: 'box', studs: all(1), face: 'eye' },
  wheel: { w: 2, h: 5, shape: 'wheel', studs: [], face: 'hub' },
  head: { w: 1, h: BRICK, shape: 'round', studs: all(1), face: 'smile' },
  win: { w: 2, h: 2 * BRICK, shape: 'box', studs: all(2), face: 'window' },
  door: { w: 2, h: 3 * BRICK, shape: 'box', studs: all(2), face: 'door' },
  flag: { w: 2, h: 2 * BRICK, shape: 'flag', studs: [], face: 'pole' },
  flower: { w: 1, h: BRICK, shape: 'flower', studs: [], face: 'flower' },
  t1: { w: 1, h: BRICK, shape: 'box', studs: all(1), clear: true },
  t2: { w: 2, h: BRICK, shape: 'box', studs: all(2), clear: true },
};
// Seen from above: w studs across and d studs deep.
for (const [w, d] of [[1, 1], [2, 1], [1, 2], [3, 1], [1, 3], [4, 1], [1, 4], [2, 2], [3, 2], [2, 3], [4, 2], [2, 4]]) {
  PIECES[`m${w}${d}`] = { top: true, w, d, shape: 'tile' };
}
PIECES.mr = { top: true, w: 1, d: 1, shape: 'disc' };
PIECES.ms = { top: true, w: 1, d: 1, shape: 'tile', smooth: true };
export const BRICKS = Object.keys(PIECES).filter((k) => !PIECES[k].top);
export const TOP_BRICKS = Object.keys(PIECES).filter((k) => PIECES[k].top);
export const TOP_ROWS = 25;

// Height of a piece in page units, and its box on the page.
const tall = (piece) => (piece.top ? piece.d * STUD : piece.h * PLATE);
const floor = (piece, y) => (piece.top ? 1000 - y * STUD : BASE - y * PLATE);
export function brickBox(op) {
  const piece = PIECES[op.k];
  return [op.x * STUD, floor(piece, op.y) - tall(piece), piece.w * STUD, tall(piece)];
}

// The operations that no longer show: bricks taken away or moved elsewhere.
export function removedOps(ops) {
  const gone = new Set();
  for (const op of ops) {
    if (op.t === 'unbrick') gone.add(ops[op.i]);
    else if (op.t === 'brick' && op.r != null) gone.add(ops[op.r]);
  }
  return gone;
}

export function liveBricks(ops) {
  const gone = removedOps(ops);
  return ops.filter((op) => op.t === 'brick' && PIECES[op.k] && !gone.has(op));
}

// Rank of the brick on top at a page point, or -1.
export function brickAt(ops, px, py) {
  const gone = removedOps(ops);
  for (let i = ops.length - 1; i >= 0; i--) {
    const op = ops[i];
    if (op.t !== 'brick' || !PIECES[op.k] || gone.has(op)) continue;
    const [x, y, w, h] = brickBox(op);
    if (px >= x && px < x + w && py >= y && py < y + h) return i;
  }
  return -1;
}

const paths = new Map();
function outline(k) {
  let p = paths.get(k);
  if (!p) {
    const piece = PIECES[k];
    p = new Path2D(SHAPES[piece.shape](piece.w * STUD, tall(piece)));
    paths.set(k, p);
  }
  return p;
}

// Body, seam and stud colours of a brick: the seam darker, or lighter on a dark brick. A rainbow
// brick takes its hue from where it stands, so a wall of them turns through the colours.
function colours(op) {
  if (op.c === RAINBOW) {
    const hue = Math.round((((op.x || 0) * 23 + (op.y || 0) * 7) % 360 + 360) % 360);
    return { body: `hsl(${hue}, 85%, 72%)`, seam: `hsl(${hue}, 55%, 50%)` };
  }
  const n = parseInt(op.c.slice(1), 16), rgb = [n >> 16, (n >> 8) & 255, n & 255];
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  const k = lum < 70 ? 0.38 : -0.3;
  const seam = rgb.map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return { body: op.c, seam: `rgb(${seam.join(',')})` };
}

// The piece with its bottom left corner at the origin.
export function drawPiece(ctx, op) {
  const piece = PIECES[op.k];
  if (!piece) return;
  const w = piece.w * STUD, h = tall(piece), path = outline(op.k), { body, seam } = colours(op);
  if (piece.top) { drawTop(ctx, piece, w, h, path, body, seam); return; }
  const wheel = piece.face === 'hub';
  ctx.fillStyle = wheel ? '#2b2b2b' : body;
  if (piece.clear) ctx.globalAlpha *= 0.5;
  ctx.fill(path);
  if (piece.clear) ctx.globalAlpha /= 0.5;
  ctx.save();
  ctx.clip(path);
  if (wheel) {
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(w / 2, -w / 2, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = seam;
    ctx.beginPath(); ctx.arc(w / 2, -w / 2, w * 0.08, 0, Math.PI * 2); ctx.fill();
  } else {
    // light from the top left
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, -h, w, 5);
    ctx.fillRect(0, -h, 4, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, -5, w, 5);
    ctx.fillRect(w - 4, -h, 4, h);
  }
  ctx.restore();
  if (piece.face === 'eye') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w / 2, -h / 2, w * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f1f1f';
    ctx.beginPath(); ctx.arc(w / 2 + 2, -h / 2 + 1, w * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w / 2 + 5, -h / 2 - 3, w * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  if (piece.face && FACES[piece.face]) FACES[piece.face](ctx, w, h, body, seam);
  ctx.strokeStyle = wheel ? '#151515' : seam;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  // the studs go behind whatever already stands on the brick, and a brick laid on it later hides them
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  for (const i of piece.studs) {
    const x = i * STUD + STUD * 0.2, sw = STUD * 0.6;
    ctx.strokeStyle = seam;
    ctx.strokeRect(x, -h - KNOB, sw, KNOB + 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(x, -h - KNOB, sw, 3);
    ctx.fillStyle = body;
    if (piece.clear) ctx.globalAlpha *= 0.5;
    ctx.fillRect(x, -h - KNOB, sw, KNOB + 2);
    if (piece.clear) ctx.globalAlpha /= 0.5;
  }
  ctx.restore();
}

// What is printed or built on the face of some pieces.
const FACES = {
  smile(ctx, w, h) {
    ctx.fillStyle = '#1f1f1f';
    ctx.beginPath(); ctx.arc(w * 0.33, -h * 0.58, 3, 0, Math.PI * 2); ctx.arc(w * 0.67, -h * 0.58, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1f1f1f';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(w / 2, -h * 0.46, w * 0.24, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  },
  window(ctx, w, h, body) {
    ctx.fillStyle = '#c6e8ff';
    ctx.fillRect(9, -h + 9, w - 18, h - 18);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, -h + 34); ctx.lineTo(34, -h + 16); ctx.moveTo(22, -h + 46); ctx.lineTo(48, -h + 20); ctx.stroke();
    ctx.fillStyle = body;
    ctx.fillRect(w / 2 - 2.5, -h + 9, 5, h - 18);
    ctx.fillRect(9, -h / 2 - 2.5, w - 18, 5);
  },
  door(ctx, w, h, body, seam) {
    ctx.strokeStyle = seam;
    ctx.lineWidth = 2;
    ctx.strokeRect(10, -h + 12, w - 20, h * 0.4);
    ctx.strokeRect(10, -h * 0.5 + 6, w - 20, h * 0.5 - 16);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(w - 15, -h * 0.47, 4.5, 0, Math.PI * 2); ctx.fill();
  },
  pole(ctx, w, h) {
    ctx.fillStyle = '#9e9e9e';
    ctx.fillRect(6, -h, 6, h);
  },
  flower(ctx) {
    ctx.fillStyle = '#2e9d4a';
    ctx.fillRect(17, -22, 6, 22);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
      ctx.beginPath(); ctx.arc(20 + 7.5 * Math.cos(a), -33.6 + 7.5 * Math.sin(a), 4.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(20, -33.6, 4.4, 0, Math.PI * 2); ctx.fill();
  },
};

// A piece seen from above: a tile with its round studs.
function drawTop(ctx, piece, w, h, path, body, seam) {
  ctx.fillStyle = body;
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillRect(0, -h, w, 4);
  ctx.fillRect(0, -h, 4, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
  ctx.fillRect(0, -4, w, 4);
  ctx.fillRect(w - 4, -h, 4, h);
  ctx.restore();
  ctx.strokeStyle = seam;
  ctx.lineWidth = 2;
  ctx.stroke(path);
  if (piece.smooth) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(9, -h + 17); ctx.lineTo(17, -h + 9); ctx.stroke();
    return;
  }
  for (let i = 0; i < piece.w; i++) {
    for (let j = 0; j < piece.d; j++) {
      const cx = (i + 0.5) * STUD, cy = -(j + 0.5) * STUD;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.beginPath(); ctx.arc(cx + 1.5, cy + 2, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = seam;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cx, cy, 8.5, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
    }
  }
}

export function drawBrick(ctx, op) {
  ctx.save();
  ctx.translate(op.x * STUD, floor(PIECES[op.k] || PIECES.b1, op.y));
  drawPiece(ctx, op);
  ctx.restore();
}

// Where piece k goes when its underside is wanted centred on page point (px, py): on the stud grid,
// resting on a full row of bricks or on the top of a brick under it, whichever is nearer. A piece
// seen from above only follows its square grid.
export function snapBrick(ops, k, px, py) {
  const piece = PIECES[k];
  const x = Math.min(COLS - piece.w, Math.max(0, Math.round(px / STUD - piece.w / 2)));
  if (piece.top) return { x, y: Math.min(TOP_ROWS - piece.d, Math.max(0, Math.round((1000 - py) / STUD))) };
  const raw = (BASE - py) / PLATE;
  let y = Math.round(raw / BRICK) * BRICK, gap = Math.abs(y - raw);
  for (const op of liveBricks(ops)) {
    const q = PIECES[op.k];
    if (q.top || op.x >= x + piece.w || op.x + q.w <= x) continue;
    const top = op.y + q.h;
    if (Math.abs(top - raw) < gap - 0.01) { y = top; gap = Math.abs(top - raw); }
  }
  return { x, y: Math.min(ROWS - piece.h, Math.max(0, y)) };
}

// Models to build over, shown pale under the bricks: [piece, colour, x, y] from the bottom row up.
const G = '#2e9d4a', L = '#9ccc65', Y = '#fdd835', R = '#e53935', W = '#ffffff',
  B = '#1e63c9', S = '#64b5f6', N = '#8d5a3b', E = '#9e9e9e';
export const MODELS = {
  dragon: [
    ['b2', G, 5, 0], ['b2', G, 11, 0],
    ['sl', G, 0, 3], ['b2', G, 2, 3], ['b6', G, 4, 3], ['b4', G, 10, 3],
    ['sl', G, 2, 6], ['b4', L, 4, 6], ['b4', L, 8, 6], ['b2', G, 12, 6], ['sr', G, 14, 6],
    ['il', G, 4, 9], ['b4', G, 6, 9], ['ir', G, 10, 9], ['b2', G, 12, 9],
    ['cone', Y, 5, 12], ['cone', Y, 7, 12], ['cone', Y, 9, 12], ['b2', G, 12, 12],
    ['b4', G, 12, 15], ['b2', G, 16, 15], ['sr', G, 18, 15],
    ['b2', G, 12, 18], ['eye', G, 14, 18], ['sr', G, 15, 18],
    ['cone', Y, 12, 21], ['cone', Y, 13, 21],
  ],
  castle: [
    ['b4', E, 2, 0], ['b2', E, 6, 0], ['door', N, 9, 0], ['b2', E, 12, 0], ['b4', E, 14, 0],
    ['b2', E, 2, 3], ['win', S, 4, 3], ['b3', E, 6, 3], ['b3', E, 11, 3], ['win', S, 14, 3], ['b2', E, 16, 3],
    ['b2', E, 2, 6], ['b3', E, 6, 6], ['b3', E, 11, 6], ['b2', E, 16, 6],
    ['b6', E, 2, 9], ['arch', E, 8, 9], ['b6', E, 12, 9],
    ['b2', E, 2, 12], ['b1', E, 5, 12], ['b1', E, 7, 12], ['b2', E, 9, 12], ['b1', E, 12, 12], ['b1', E, 14, 12], ['b2', E, 16, 12],
    ['b2', E, 2, 15], ['b2', E, 9, 15], ['b2', E, 16, 15],
    ['sl', R, 1, 18], ['sr', R, 3, 18], ['sl', R, 8, 18], ['sr', R, 10, 18], ['sl', R, 15, 18], ['sr', R, 17, 18],
    ['flag', Y, 2, 21], ['flag', Y, 9, 21], ['flag', Y, 16, 21],
  ],
  rocket: [
    ['sl', R, 6, 0], ['b4', E, 8, 0], ['sr', R, 12, 0],
    ['sl', R, 6, 3], ['b4', W, 8, 3], ['sr', R, 12, 3],
    ['b4', W, 8, 6], ['b4', B, 8, 9],
    ['b1', W, 8, 12], ['win', S, 9, 12], ['b1', W, 11, 12], ['b1', W, 8, 15], ['b1', W, 11, 15],
    ['b4', B, 8, 18], ['b4', W, 8, 21],
    ['sl', R, 8, 24], ['sr', R, 10, 24], ['cone', R, 9, 27], ['cone', R, 10, 27],
  ],
  fir: [
    ['b2', N, 9, 0], ['b2', N, 9, 3],
    ['sl', G, 3, 6], ['b6', G, 5, 6], ['b4', G, 11, 6], ['sr', G, 15, 6],
    ['sl', G, 5, 9], ['b6', G, 7, 9], ['sr', G, 13, 9],
    ['sl', G, 4, 12], ['b4', G, 6, 12], ['b4', G, 10, 12], ['sr', G, 14, 12],
    ['sl', G, 6, 15], ['b4', G, 8, 15], ['sr', G, 12, 15],
    ['sl', G, 5, 18], ['b6', G, 7, 18], ['sr', G, 13, 18],
    ['sl', G, 7, 21], ['b2', G, 9, 21], ['sr', G, 11, 21],
    ['sl', G, 8, 24], ['sr', G, 10, 24], ['cone', Y, 9, 27], ['cone', Y, 10, 27],
  ],
};

export function modelOf(ops) {
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].t === 'model') return MODELS[ops[i].k] ? ops[i].k : '';
  return '';
}

// The bricks of a model that no brick of the drawing stands on yet (same piece at the same place).
export function modelLeft(ops, key) {
  const laid = new Set(liveBricks(ops).map((op) => `${op.k},${op.x},${op.y}`));
  return (MODELS[key] || []).filter(([k, , x, y]) => !laid.has(`${k},${x},${y}`));
}

// The model as pale bricks, or whole and in colour for its button.
export function drawModel(ctx, key, bricks = MODELS[key] || [], alpha = 0.3) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (const [k, c, x, y] of bricks) drawBrick(ctx, { k, c, x, y });
  ctx.restore();
}
