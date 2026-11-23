// Building bricks seen from the side, for the free drawing: pieces that snap to a grid of studs and
// stack, in the colour in use. Proportions of real bricks: a stud every 5 units for a brick 6 high,
// three plates to a brick, a stud a sixth of a brick high.
// A brick operation is { t: 'brick', k, c, x, y }: piece k with its left side on stud column x and
// its underside y plates above the bottom row.
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
};
export const BRICKS = Object.keys(PIECES);

const paths = new Map();
function outline(k) {
  let p = paths.get(k);
  if (!p) {
    const piece = PIECES[k];
    p = new Path2D(SHAPES[piece.shape](piece.w * STUD, piece.h * PLATE));
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
  const w = piece.w * STUD, h = piece.h * PLATE, path = outline(op.k), { body, seam } = colours(op);
  const wheel = piece.face === 'hub';
  ctx.fillStyle = wheel ? '#2b2b2b' : body;
  ctx.fill(path);
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
    ctx.fillRect(x, -h - KNOB, sw, KNOB + 2);
  }
  ctx.restore();
}

export function drawBrick(ctx, op) {
  ctx.save();
  ctx.translate(op.x * STUD, BASE - op.y * PLATE);
  drawPiece(ctx, op);
  ctx.restore();
}

// Where piece k goes when its underside is wanted centred on page point (px, py): on the stud grid,
// resting on a full row of bricks or on the top of a brick under it, whichever is nearer.
export function snapBrick(ops, k, px, py) {
  const piece = PIECES[k];
  const x = Math.min(COLS - piece.w, Math.max(0, Math.round(px / STUD - piece.w / 2)));
  const raw = (BASE - py) / PLATE;
  let y = Math.round(raw / BRICK) * BRICK, gap = Math.abs(y - raw);
  for (const op of ops) {
    const q = op.t === 'brick' && PIECES[op.k];
    if (!q || op.x >= x + piece.w || op.x + q.w <= x) continue;
    const top = op.y + q.h;
    if (Math.abs(top - raw) < gap - 0.01) { y = top; gap = Math.abs(top - raw); }
  }
  return { x, y: Math.min(ROWS - piece.h, Math.max(0, y)) };
}
