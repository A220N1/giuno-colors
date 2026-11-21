// The free drawing screen: a blank page with brush, paint bucket, eraser, shapes, undo and redo.
import { $, el, showScreen, vibrate, inkFor, confirmDialog } from './util.js';
import { PAGE_W, PAGE_H, SIZES, COLORS, SHAPES, RAINBOW, RAINBOW_LEN, MIRRORS, BRUSHES, BRUSH_NAMES, PIECEWISE, BACKGROUNDS, BG_NAMES, BG_CLOSE_UP,
  backgroundOf, sameBackground, paperColor, drawBackground, drawBase, mirrorPoints, smudgeOp, drawOp, drawPreview, drawDripping, renderLayers, renderFlat,
  clearCanvas, fillRegion } from './art.js';
import { getArt, putArt, deleteArt } from './artstore.js';
import { sharePng, canvasPng } from './share.js';
import { sparkler } from './sparkles.js';
import { STAMPS, stampUrl, isAnimal, isNature, prepareArt, preloadStamps } from './images.js';
import { isFirework, flakesOf } from './nature.js';
import { t } from './i18n.js';
import { perfScene, perfStart, perfStop, count } from './perf.js';

const TAP_SLOP_PX = 10;     // finger movement still counted as a tap
const MIN_STEP = 2;         // page units between two kept points of a line
const SMOOTH = 0.45;        // share of each finger move followed at once; the rest evens out the jitter
const SHAPE_TAP_SIZE = 180; // a tap with the shape tool drops a shape this big
const SAVE_DELAY_MS = 400;
const SHAPE_NAMES = { circle: 'Rond', square: 'Carré', triangle: 'Triangle', star: 'Étoile', heart: 'Cœur' };
const SPARKLE_EVERY_PX = 9;  // finger travel between two stars of a rainbow stroke
const STAR_HUE = 0.13;      // the gold of the stars a shooting-star stroke throws in a plain colour
const BUBBLE_EVERY_PX = 34; // finger travel between two bubbles flying off a bubble stroke
const DRIP_MS = 1300;       // how long dripping paint keeps running after the stroke
const SHAKE_ACCEL = 14;     // m/s² on top of gravity: a real shake, not a phone picked up
const SHAKE_GAP_MS = 1500;  // one snowfall per shake
const FLAKES = 70;          // flakes a shake lets fall
const MIRROR_NAMES = { 1: 'Sans miroir', 2: 'Miroir gauche-droite', 4: 'Miroir en quatre', 6: 'Kaléidoscope' };
const BAR_PX = [1.5, 2.5, 4, 5.5, 7.5];  // the sizes as bars on the thickness button
const STAMP_SIZES = [80, 130, 190, 260, 340];  // side of a sticker dropped by a tap, by size
const STAMP_MIN = 30;  // a drag smaller than this drops a sticker of the chosen size instead
const MAX_ZOOM = 4;

const stage = $('#draw-stage');
const sheet = stage.querySelector('.sheet');
const canvases = [...sheet.querySelectorAll('canvas')];
const paperEl = sheet.querySelector('.paper');
const guidesEl = sheet.querySelector('.guides');
const [bgCanvas, fillCanvas, lineCanvas, baseCanvas, liveCanvas] = canvases;
const back = bgCanvas.getContext('2d');
const fills = fillCanvas.getContext('2d');
const lines = lineCanvas.getContext('2d');
const baseLayer = baseCanvas.getContext('2d');
const live = liveCanvas.getContext('2d');
const pop = $('#draw-pop');
const sparkles = sparkler($('#sparkles'));
const tool = { kind: 'brush', brush: 'marker', color: COLORS[0], size: 1, shape: 'circle', stamp: STAMPS[0], mirror: 1 };  // kept from one drawing to the next
let A = null;  // the drawing on screen
let pen = null;
let onBack = () => {};
const opsInfo = () => `${count(A.ops.length, 'opération')}${tool.mirror > 1 ? `, miroir ${tool.mirror}` : ''}`;
perfScene('draw', () => (tool.kind === 'brush' ? tool.brush : tool.kind) + (tool.mirror > 1 ? ` miroir ${tool.mirror}` : ''));

// `baseId`: a colouring page to paint freely, for a new drawing.
export async function openDraw(id, profileId, goBack, baseId = '') {
  onBack = goBack;
  showScreen('draw');
  closePop();
  const a = { id, profileId, ops: [], redo: [], created: Date.now(), saved: false, dirty: false, loading: true,
    s: 1, k: 1, W: 0, H: 0, timer: 0, baseId, base: null, paper: '#ffffff', replay: null };
  A = a;
  layout();
  updateTools();
  updateButtons();
  let rec = null;
  try { rec = await getArt(id); } catch (e) { console.error('drawing not loaded:', e); }
  if (A !== a) return;
  if (rec && rec.profile !== profileId) { A = null; onBack(); return; }
  if (rec) { a.ops = rec.ops; a.created = rec.created; a.saved = true; a.baseId = rec.base || ''; }
  a.base = await prepareArt(a.ops, a.baseId);
  if (A !== a) return;
  a.loading = false;
  renderAll();
  updateButtons();
}

export function leaveDraw() {
  if (!A) return;
  flushSave();
  stopReplay();
  A = null;
  pen = null;
  closePop();
  sparkles.clear();
}

// The layers cover the whole drawing area and show the page at A.s * zoom, moved by (ox, oy):
// only what is on screen is drawn, whatever the zoom.
function layout() {
  const r = stage.getBoundingClientRect();
  A.W = r.width; A.H = r.height;
  A.s = Math.min(r.width / PAGE_W, r.height / PAGE_H) * 0.96;
  A.dpr = window.devicePixelRatio || 1;
  for (const c of canvases) {
    c.width = Math.max(1, Math.round(r.width * A.dpr));
    c.height = Math.max(1, Math.round(r.height * A.dpr));
  }
  sparkles.resize(r.width, r.height);
  fitView();
  renderAll();
}

function fitView() {
  A.view = { z: 1, ox: (A.W - PAGE_W * A.s) / 2, oy: (A.H - PAGE_H * A.s) / 2 };
  applyView();
}

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(1, z));

// Keep the zoomed page over the middle of the screen. The zoom must be clamped before the offsets
// are worked out from it, or the page slides away once the fingers go past the maximum.
function clampView(v) {
  const z = clampZoom(v.z);
  if (z <= 1.001) return { z: 1, ox: (A.W - PAGE_W * A.s) / 2, oy: (A.H - PAGE_H * A.s) / 2 };
  const w = PAGE_W * A.s * z, h = PAGE_H * A.s * z;
  return { z, ox: Math.min(A.W / 2, Math.max(A.W / 2 - w, v.ox)), oy: Math.min(A.H / 2, Math.max(A.H / 2 - h, v.oy)) };
}

function applyView() {
  const { z, ox, oy } = A.view, scale = A.s * z;
  A.k = [A.dpr * scale, A.dpr * ox, A.dpr * oy];
  const box = { left: ox + 'px', top: oy + 'px', width: PAGE_W * scale + 'px', height: PAGE_H * scale + 'px' };
  Object.assign(paperEl.style, box);
  Object.assign(guidesEl.style, box);
  $('#zoom-fit').hidden = z <= 1.001;
}

const scale = () => A.s * A.view.z;

function renderAll() {
  const t0 = perfStart();
  stopDrips();  // everything is drawn whole below, drops at full length
  const bg = backgroundOf(A.ops);
  A.paper = paperColor(bg);
  drawBackground(back, bg, A.k);
  updateBgButton(bg);
  renderLayers(fills, lines, A.ops, A.k);
  drawBase(baseLayer, A.base, A.k);
  clearCanvas(live, A.k);
  perfStop('redessin complet', t0, () => count(A.ops.length, 'opération'));
}

// One more operation on screen: a background redraws its layer, the rest draws on top.
function showOp(op) {
  if (op.t === 'bg') renderAll(); else drawOp(fills, lines, op);
}

function onResize() {
  if (!A) return;
  const r = stage.getBoundingClientRect();
  if (Math.abs(r.width - A.W) < 0.5 && Math.abs(r.height - A.H) < 0.5) return;
  layout();
}
if (typeof ResizeObserver === 'function') new ResizeObserver(onResize).observe(stage);
addEventListener('resize', onResize);

// `shown`: the operation is already on screen (the finger works as it goes).
function commit(op, shown = false) {
  A.ops.push(op);
  A.redo = [];
  if (!shown) showOp(op);
  changed();
}

function changed() {
  A.dirty = true;
  updateButtons();
  clearTimeout(A.timer);
  A.timer = setTimeout(flushSave, SAVE_DELAY_MS);
}

function flushSave() {
  if (!A || !A.dirty) return;
  clearTimeout(A.timer);
  A.dirty = false;
  const fail = (e) => console.error('drawing not saved:', e);
  if (A.ops.length) {
    const rec = { id: A.id, profile: A.profileId, created: A.created, updated: Date.now(), ops: A.ops.slice() };
    if (A.baseId) rec.base = A.baseId;
    putArt(rec).catch(fail);
    A.saved = true;
  } else if (A.saved) {  // everything undone: an empty page is not kept
    deleteArt(A.id).catch(fail);
    A.saved = false;
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

function undo() {
  stopReplay();
  if (!A || A.loading || !A.ops.length) return;
  A.redo.push(A.ops.pop());
  renderAll();
  changed();
}

function redo() {
  stopReplay();
  if (!A || A.loading || !A.redo.length) return;
  const op = A.redo.pop();
  A.ops.push(op);
  showOp(op);
  changed();
}

function updateButtons() {
  $('#undo').disabled = !A || !A.ops.length;
  $('#redo').disabled = !A || !A.redo.length;
  $('#replay').disabled = !A || !A.ops.some((op) => op.t !== 'bg');
}

// Gestures: one finger draws; two fingers zoom and move the page (the stroke they interrupt is
// dropped); a wheel zooms on a computer.
function toPage(e) {
  return [(e.clientX - A.left - A.view.ox) / scale(), (e.clientY - A.top - A.view.oy) / scale()];
}

const fingers = new Map();
let pinch = null;

function pinchState() {
  const [a, b] = [...fingers.values()];
  return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2 - A.left, my: (a.y + b.y) / 2 - A.top };
}

function startPinch() {
  if (pen) { pen = null; clearLive(); }
  closePop();
  pinch = { ...pinchState(), v0: { ...A.view }, v: { ...A.view } };
}

// While the fingers move, the layers are only stretched; they are drawn again when the fingers lift.
function movePinch() {
  const now = pinchState(), v0 = pinch.v0;
  const z = clampZoom(v0.z * now.d / pinch.d);
  const px = (pinch.mx - v0.ox) / (A.s * v0.z), py = (pinch.my - v0.oy) / (A.s * v0.z);
  pinch.v = clampView({ z, ox: now.mx - px * A.s * z, oy: now.my - py * A.s * z });
  const r = pinch.v.z / v0.z;
  sheet.style.transform = `translate(${pinch.v.ox - r * v0.ox}px, ${pinch.v.oy - r * v0.oy}px) scale(${r})`;
}

function endPinch() {
  A.view = pinch.v;
  pinch = null;
  sheet.style.transform = '';
  applyView();
  renderAll();
}

function boxOf(x0, y0, x1, y1) {
  return [Math.round(Math.min(x0, x1)), Math.round(Math.min(y0, y1)), Math.round(Math.abs(x1 - x0)), Math.round(Math.abs(y1 - y0))];
}

const stampOp = (b) => (isNature(tool.stamp) ? { t: 'stamp', k: tool.stamp, b, c: tool.color } : { t: 'stamp', k: tool.stamp, b });

// A sticker stays square: the drag sets its side from the corner where it started.
function stampBox(x0, y0, x1, y1) {
  const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (side < STAMP_MIN) return null;
  return boxOf(x0, y0, x1 < x0 ? x0 - side : x0 + side, y1 < y0 ? y0 - side : y0 + side);
}

// Replay: the drawing draws itself again in a few seconds, stroke by stroke.
const replayCost = (op) => (op.p ? op.p.length / 2 : 12);

function replay() {
  if (!A || A.loading || !A.ops.length) return;
  stopReplay();
  closePop();
  const a = A, ops = a.ops.slice();
  const total = ops.reduce((n, op) => n + replayCost(op), 0);
  const duration = Math.min(10000, Math.max(2500, total * 5));
  // the page starts blank on its final background
  clearCanvas(fills, a.k); clearCanvas(lines, a.k); clearCanvas(live, a.k);
  const R = { i: 0, done: 0, from: 0, t0: performance.now(), raf: 0 };
  a.replay = R;
  stage.classList.add('replaying');
  const step = (now) => {
    if (A !== a || a.replay !== R) return;
    const target = total * Math.min(1, (now - R.t0) / duration);
    while (R.i < ops.length && R.done + replayCost(ops[R.i]) <= target) {
      if (ops[R.i].t !== 'bg') drawOp(fills, lines, ops[R.i]);
      R.done += replayCost(ops[R.i]);
      R.i++;
      R.from = 0;
      clearCanvas(live, a.k);
    }
    if (R.i >= ops.length) { stopReplay(); return; }
    const op = ops[R.i];
    if (op.p && op.t !== 'smudge') {
      const part = { ...op, p: op.p.slice(0, 2 * Math.max(1, Math.floor(target - R.done))) };
      if (op.t === 'line' && PIECEWISE.has(op.k)) R.from = drawPreview(live, part, R.from);
      else { clearCanvas(live, a.k); drawPreview(live, op.t === 'erase' ? { ...part, paper: a.paper } : part); }
    }
    R.raf = requestAnimationFrame(step);
  };
  R.raf = requestAnimationFrame(step);
}

function stopReplay() {
  if (!A || !A.replay) return;
  cancelAnimationFrame(A.replay.raf);
  A.replay = null;
  stage.classList.remove('replaying');
  renderAll();
}

function addPoint(x, y) {
  pen.sx += (x - pen.sx) * SMOOTH;
  pen.sy += (y - pen.sy) * SMOOTH;
  const p = pen.op.p;
  const qx = Math.round(pen.sx), qy = Math.round(pen.sy);
  const d = Math.hypot(qx - p[p.length - 2], qy - p[p.length - 1]);
  if (d >= MIN_STEP) { p.push(qx, qy); pen.len += d; }
}

const isRainbow = (op) => op && op.c === RAINBOW;
// Strokes that throw stars while drawn, and the hue of their stars at a length along them.
const throwsStars = (op) => op && (op.c === RAINBOW || op.k === 'stars');
const starHue = (op, len) => (op.c === RAINBOW ? len / RAINBOW_LEN : STAR_HUE);

// Soap bubbles flying off a bubble stroke, in its colour there, from the point and its mirror images.
function hueRgb(h) {
  const f = (n) => { const k = (n + h * 12) % 12; return Math.round(255 * (0.76 - 0.2112 * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return `${f(0)},${f(8)},${f(4)}`;
}
function floatBubble(op, x, y, len) {
  const n = op.c === RAINBOW ? 0 : parseInt(op.c.slice(1), 16);
  const tint = op.c === RAINBOW ? hueRgb((((len / RAINBOW_LEN) % 1) + 1) % 1) : `${n >> 16},${(n >> 8) & 255},${n & 255}`;
  for (const [px, py] of copiesOf(x, y)) {
    const r = Math.max(8, Math.min(40, op.w * scale() * (0.6 + 0.8 * Math.random())));
    sparkles.bubble(A.view.ox + px * scale(), A.view.oy + py * scale(), r, tint);
  }
}

// Dripping paint runs down for a moment after the stroke, each frame painting longer drops.
const dripping = new Set();
function runDrips(op) {
  const a = A, t0 = performance.now(), run = { raf: 0 };
  const step = (now) => {
    if (A !== a || !dripping.has(run)) return;
    const t = Math.min(1, (now - t0) / DRIP_MS);
    drawDripping(lines, op, 1 - (1 - t) ** 2, true);
    if (t < 1) run.raf = requestAnimationFrame(step); else dripping.delete(run);
  };
  dripping.add(run);
  run.raf = requestAnimationFrame(step);
}
function stopDrips() {
  for (const run of dripping) cancelAnimationFrame(run.raf);
  dripping.clear();
}

// The burst of a firework sticker over the page, and over its mirror images.
function fireworkBurst(op) {
  const [x, y, w] = op.b;
  const colours = op.c === RAINBOW ? [0, 50, 120, 190, 260, 320].map((h) => `hsl(${h}, 90%, 70%)`)
    : [op.c === '#ffffff' ? '#ffe28a' : op.c, '#fff3b0', '#ffffff'];
  for (const [px, py] of copiesOf(x + w / 2, y + w / 2)) {
    sparkles.firework(A.view.ox + px * scale(), A.view.oy + py * scale(), w * 0.62 * scale(), colours);
  }
}

// A shake lets snow (in white) or glitter (in the colour in use) fall over the page; it stays there.
function shake() {
  if (!A || A.loading || A.replay) return;
  const a = A;
  const op = { t: 'flakes', k: tool.color === '#ffffff' ? 'snow' : 'glitter', c: tool.color, s: Math.floor(Math.random() * 1e9), n: FLAKES };
  vibrate(30);
  sparkles.rain(flakesOf(op), (x, y) => (A === a ? [a.view.ox + x * scale(), a.view.oy + y * scale()] : [-99, -99]),
    () => (A === a ? scale() : 1), () => { if (A === a && !a.loading) commit(op); });
}

let lastShake = 0;
addEventListener('devicemotion', (e) => {
  if (!A) return;
  let m;
  const a = e.acceleration;
  if (a && a.x != null) m = Math.hypot(a.x, a.y, a.z);
  else {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    m = Math.abs(Math.hypot(g.x, g.y, g.z) - 9.81);
  }
  const now = performance.now();
  if (m < SHAKE_ACCEL || now - lastShake < SHAKE_GAP_MS) return;
  lastShake = now;
  shake();
});

// iPhones only report motion once asked, from a touch.
let motionAsked = false;
function askMotion() {
  motionAsked = true;
  const D = window.DeviceMotionEvent;
  if (D && typeof D.requestPermission === 'function') D.requestPermission().catch(() => {});
}

// A new operation takes the mirror mode in use.
function mirrorable(op) {
  if (tool.mirror > 1) op.m = tool.mirror;
  return op;
}

const copiesOf = (x, y) => (tool.mirror > 1 ? mirrorPoints(tool.mirror, x, y) : [[x, y]]);

// Stars around a point of the page and its mirror images, in the hue the rainbow has there.
function sparkleAt(x, y, turn, n = 1, spread = 0) {
  const reach = spread || SIZES[tool.size] * scale() / 2 + 6;
  for (const [px, py] of copiesOf(x, y)) {
    const cx = A.view.ox + px * scale(), cy = A.view.oy + py * scale();
    if (n === 1) sparkles.emit(cx, cy, turn, reach);
    else sparkles.burst(cx, cy, turn, n, reach);
  }
}

stage.addEventListener('pointerdown', (e) => {
  if (!A || A.loading || e.target.closest('.pop, #zoom-fit')) return;
  if (!motionAsked) askMotion();
  const r = stage.getBoundingClientRect();
  A.left = r.left; A.top = r.top;
  fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  if (fingers.size === 2 && !A.replay) { startPinch(); return; }
  if (fingers.size > 1 || pinch || pen) return;
  if (A.replay) { stopReplay(); return; }  // a tap during the replay only stops it
  if (!pop.hidden) { closePop(); return; }  // a tap beside the menu only closes it
  const [x, y] = toPage(e);
  pen = { id: e.pointerId, cx: e.clientX, cy: e.clientY, lx: e.clientX, ly: e.clientY, x, y, sx: x, sy: y,
    moved: false, op: null, len: 0, spark: 0, bub: 0 };
  const w = SIZES[tool.size], start = [Math.round(x), Math.round(y)];
  if (tool.kind === 'brush') {
    pen.op = mirrorable({ t: 'line', c: tool.color, w, p: start });
    if (tool.brush !== 'marker') pen.op.k = tool.brush;
  }
  else if (tool.kind === 'eraser') pen.op = mirrorable({ t: 'erase', w, p: start });
  else if (tool.kind === 'smudge') pen.op = mirrorable({ t: 'smudge', w, p: start });
  if (throwsStars(pen.op)) sparkleAt(x, y, starHue(pen.op, 0), 3);
  if (pen.op && pen.op.k === 'bubbles') floatBubble(pen.op, x, y, 0);
  pen.from = 0;
  clearCanvas(live, A.k);
  showLive();
});

stage.addEventListener('pointermove', (e) => {
  if (!A) return;
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) { if (fingers.size >= 2) movePinch(); return; }
  if (!pen || e.pointerId !== pen.id) return;
  if (Math.hypot(e.clientX - pen.cx, e.clientY - pen.cy) > TAP_SLOP_PX) pen.moved = true;
  if (pen.op && pen.op.p) {
    const all = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of all.length ? all : [e]) addPoint(...toPage(ev));
    if (throwsStars(pen.op)) {
      pen.spark += Math.hypot(e.clientX - pen.lx, e.clientY - pen.ly);
      for (; pen.spark >= SPARKLE_EVERY_PX; pen.spark -= SPARKLE_EVERY_PX) sparkleAt(pen.sx, pen.sy, starHue(pen.op, pen.len));
    }
    if (pen.op.k === 'bubbles') {
      pen.bub += Math.hypot(e.clientX - pen.lx, e.clientY - pen.ly);
      for (; pen.bub >= BUBBLE_EVERY_PX; pen.bub -= BUBBLE_EVERY_PX) floatBubble(pen.op, pen.sx, pen.sy, pen.len);
    }
    pen.lx = e.clientX; pen.ly = e.clientY;
  } else if (tool.kind === 'shape' && pen.moved) {
    const [x, y] = toPage(e);
    pen.op = mirrorable({ t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b: boxOf(pen.x, pen.y, x, y) });
  } else if (tool.kind === 'stamp' && pen.moved) {
    const b = stampBox(pen.x, pen.y, ...toPage(e));
    pen.op = b ? mirrorable(stampOp(b)) : null;
  }
  showLive();
});

function penUp(e) {
  fingers.delete(e.pointerId);
  if (pinch) { if (fingers.size < 2) endPinch(); return; }
  if (!pen || e.pointerId !== pen.id) return;
  const g = pen;
  pen = null;
  if (!A) return;
  clearLive();
  const [x, y] = toPage(e);
  if (g.op && g.op.p) {
    const p = g.op.p, qx = Math.round(x), qy = Math.round(y);
    if (g.moved && (qx !== p[p.length - 2] || qy !== p[p.length - 1])) p.push(qx, qy);  // end where the finger left
    if (g.op.t === 'smudge') { smudgeOp(fills, lines, g.op, g.from); commit(g.op, true); }
    else if (g.op.k === 'drip') { drawDripping(lines, g.op, 0); commit(g.op, true); runDrips(g.op); }
    else commit(g.op);
  } else if (e.type !== 'pointerup') {
    return;
  } else if (tool.kind === 'stamp') {
    const h = STAMP_SIZES[tool.size] / 2;
    const b = (g.moved && stampBox(g.x, g.y, x, y)) || boxOf(g.x - h, g.y - h, g.x + h, g.y + h);
    const op = mirrorable(stampOp(b));
    commit(op);
    vibrate(12);
    if (isFirework(op.k)) fireworkBurst(op);
  } else if (tool.kind === 'shape') {
    const h = SHAPE_TAP_SIZE / 2;
    const b = g.moved ? boxOf(g.x, g.y, x, y) : boxOf(g.x - h, g.y - h, g.x + h, g.y + h);
    commit(mirrorable({ t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b }));
    if (tool.color === RAINBOW) sparkleAt(b[0] + b[2] / 2, b[1] + b[3] / 2, 0, 18, Math.max(b[2], b[3]) * scale() / 2);
  } else if (tool.kind === 'bucket' && !g.moved) {
    // with a mirror, the mirror images of the tap fill too, in one operation (nonzero rule: two taps
    // in the same area add up instead of cancelling out)
    const loops = [], t0 = perfStart();
    for (const [px, py] of copiesOf(g.x, g.y)) loops.push(...(fillRegion(A.ops, px, py, A.base) || []));
    perfStop('seau', t0, opsInfo);
    if (loops.length) {
      commit(tool.mirror > 1 ? { t: 'fill', c: tool.color, r: loops, z: 1 } : { t: 'fill', c: tool.color, r: loops });
      vibrate(12);
      if (tool.color === RAINBOW) sparkleAt(g.x, g.y, 0, 20, 50);
    }
  }
}
stage.addEventListener('pointerup', penUp);
stage.addEventListener('pointercancel', penUp);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

stage.addEventListener('wheel', (e) => {
  if (!A || A.loading || pen || pinch) return;
  e.preventDefault();
  const r = stage.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = A.view;
  const z = clampZoom(v.z * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)));
  const px = (mx - v.ox) / (A.s * v.z), py = (my - v.oy) / (A.s * v.z);
  A.view = clampView({ z, ox: mx - px * A.s * z, oy: my - py * A.s * z });
  applyView();
  renderAll();
}, { passive: false });

let liveRaf = 0;
function showLive() {
  if (!liveRaf) liveRaf = requestAnimationFrame(drawLive);
}
function drawLive() {
  liveRaf = 0;
  if (!A) return;
  const op = pen && pen.op;
  if (op && op.t === 'smudge') { pen.from = smudgeOp(fills, lines, op, pen.from); return; }  // straight on the paint
  // textured strokes only add their new marks; the others are drawn again whole
  if (op && op.t === 'line' && PIECEWISE.has(op.k)) { pen.from = drawPreview(live, op, pen.from); return; }
  clearCanvas(live, A.k);
  if (op) drawPreview(live, op.t === 'erase' ? { ...op, paper: A.paper } : op);
}
function clearLive() {
  cancelAnimationFrame(liveRaf);
  liveRaf = 0;
  clearCanvas(live, A.k);
}

// Toolbar: tools, the brush, shape, mirror and size menus, colours.
const shapeIcon = (k) => `<svg viewBox="-0.2 -0.2 1.4 1.4" class="shape"><path d="${SHAPES[k]}"/></svg>`;

// A sticker as its button; clouds and grass drawn in the colour in use.
function stampIcon(k) {
  if (isNature(k)) {
    const c = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    c.width = c.height = Math.round(36 * dpr);
    c.className = 'sample stamp';
    const ctx = c.getContext('2d');
    ctx.setTransform(c.width / 100, 0, 0, c.width / 100, 0, 0);
    drawOp(null, ctx, { t: 'stamp', k, b: [6, 10, 88, 80], c: tool.color });
    return c;
  }
  const img = el('img', isAnimal(k) ? 'sample round' : 'sample');
  img.src = stampUrl(k);
  img.alt = '';
  img.draggable = false;
  return img;
}

// A wave drawn with a kind of brush in the colour in use, as its button.
function brushSample(kind, px = 40) {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = c.height = Math.round(px * dpr);
  c.className = 'sample';
  const ctx = c.getContext('2d');
  ctx.setTransform(c.width / 100, 0, 0, c.width / 100, 0, 0);
  const p = [];
  for (let i = 0; i <= 24; i++) p.push(Math.round(14 + 72 * i / 24), Math.round(50 - 24 * Math.sin(i / 24 * 2 * Math.PI)));
  const color = tool.color === '#ffffff' ? '#9e9e9e' : tool.color;  // white would not show on the button
  const op = { t: 'line', c: color, w: kind === 'hearts' ? 11 : 15, p };
  if (kind !== 'marker') op.k = kind;
  drawOp(null, ctx, op);
  return c;
}

// A background as its button: the whole page in small, or a close-up of a pattern.
function bgSample(bg, w, h) {
  const c = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.className = 'sample bg';
  drawBackground(c.getContext('2d'), bg, c.width / (BG_CLOSE_UP.has(bg ? bg.k : 'paper') ? 280 : PAGE_W));
  return c;
}

const bgKey = (bg) => bg ? bg.k + (bg.c || '') : 'paper#ffffff';
const SCENERY_ICON = '<svg viewBox="0 0 24 24" class="scenery"><rect x="3" y="4" width="18" height="16" rx="3" fill="#9fd9ff"/>'
  + '<circle cx="16.5" cy="9" r="2.6" fill="#ffd54f"/><path d="M3 16.5c3-3.5 5.5-4.5 8.5-2s5.5 1 9.5-1.5V17a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#7bc464"/></svg>';

// The background button shows the page's background, or a little coloured landscape on white paper,
// so it stands out among the tools.
function updateBgButton(bg) {
  const b = $('#draw-bg'), key = bgKey(bg);
  if (b.dataset.key === key) return;
  b.dataset.key = key;
  if (key === 'paper#ffffff') b.innerHTML = SCENERY_ICON;
  else b.replaceChildren(bgSample(bg, 26, 33));
}

function mirrorIcon(m) {
  const dot = ([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4"/>`;
  const axis = (d) => `<path d="${d}" stroke-dasharray="2 2.2" stroke-width="1.4"/>`;
  if (m === 2) return `<svg viewBox="0 0 24 24">${axis('M12 3v18')}${[[6.5, 12], [17.5, 12]].map(dot).join('')}</svg>`;
  if (m === 4) {
    return `<svg viewBox="0 0 24 24">${axis('M12 3v18M3 12h18')}${[[7, 7], [17, 7], [7, 17], [17, 17]].map(dot).join('')}</svg>`;
  }
  if (m === 6) {
    const pts = Array.from({ length: 6 }, (_, i) => [12 + 7.5 * Math.cos(i * Math.PI / 3), 12 + 7.5 * Math.sin(i * Math.PI / 3)]);
    return `<svg viewBox="0 0 24 24">${pts.map(dot).join('')}<circle cx="12" cy="12" r="1.2"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24">${dot([12, 12])}</svg>`;
}

// Dashed axes over the page while a mirror is on; they are not part of the drawing.
function updateGuides() {
  const g = guidesEl;
  const line = (deg) => {
    const a = deg * Math.PI / 180, dx = Math.cos(a) * 1400, dy = Math.sin(a) * 1400;
    return `<line x1="${(PAGE_W / 2 - dx).toFixed(0)}" y1="${(PAGE_H / 2 - dy).toFixed(0)}" x2="${(PAGE_W / 2 + dx).toFixed(0)}" y2="${(PAGE_H / 2 + dy).toFixed(0)}"/>`;
  };
  const axes = { 1: [], 2: [90], 4: [90, 0], 6: [90, 30, 150] }[tool.mirror] || [];
  g.innerHTML = axes.map(line).join('');
}

// Paints an element in the colour in use; a pale colour gets an outline so it shows on white.
function inColour(e) {
  if (tool.color === RAINBOW) e.classList.add('rainbow');
  else e.style.background = tool.color;
  if (tool.color === RAINBOW || inkFor(tool.color) !== '#fff') e.style.boxShadow = 'inset 0 0 0 1.5px rgba(0, 0, 0, .25)';
  return e;
}

// The thickness button: bars from thin to thick, the one in use in the colour in use, so it reads as
// a choice of thickness and not as one more round tool.
function sizeBars() {
  const bars = el('span', 'size-bars');
  BAR_PX.forEach((h, i) => {
    const bar = el('i', i === tool.size ? 'on' : null);
    bar.style.height = h + 'px';
    bars.append(i === tool.size ? inColour(bar) : bar);
  });
  return bars;
}

// A thickness in the menu: a stroke as thick as it will be drawn on the screen at this zoom.
function sizeLine(i) {
  const px = Math.max(2, Math.min(36, SIZES[i] * (A ? scale() : 0.5)));
  const line = inColour(el('span', 'size-line'));
  line.style.height = px.toFixed(1) + 'px';
  return line;
}

function updateTools() {
  for (const b of document.querySelectorAll('#draw .tool[data-tool]')) b.classList.toggle('sel', b.dataset.tool === tool.kind);
  const brushBtn = $('#draw .tool[data-tool="brush"]');
  brushBtn.replaceChildren(brushSample(tool.brush));
  brushBtn.setAttribute('aria-label', t('Dessiner : {name}', { name: t(BRUSH_NAMES[tool.brush]) }));
  const shapeBtn = $('#draw .tool[data-tool="shape"]');
  shapeBtn.innerHTML = shapeIcon(tool.shape);
  shapeBtn.setAttribute('aria-label', t('Formes : {name}', { name: t(SHAPE_NAMES[tool.shape]) }));
  $('#size').replaceChildren(sizeBars());
  $('#size').setAttribute('aria-label', t('Épaisseur'));
  const stampBtn = $('#draw .tool[data-tool="stamp"]');
  stampBtn.replaceChildren(stampIcon(tool.stamp));
  const mirrorBtn = $('#mirror');
  mirrorBtn.innerHTML = mirrorIcon(tool.mirror);
  mirrorBtn.classList.toggle('on', tool.mirror > 1);
  mirrorBtn.setAttribute('aria-label', t('Miroir : {name}', { name: t(MIRROR_NAMES[tool.mirror]) }));
  updateGuides();
  for (const b of $('#draw-colors').children) b.classList.toggle('sel', b.dataset.color === tool.color);
}

function openPop(kind) {
  if (!pop.hidden && pop.dataset.kind === kind) { closePop(); return; }
  pop.dataset.kind = kind;
  pop.classList.remove('grid', 'sizes', 'backgrounds');
  pop.replaceChildren();
  if (kind === 'stamp') {
    pop.classList.add('grid');
    for (const k of STAMPS) {
      const b = el('button', 'tool' + (k === tool.stamp ? ' sel' : ''));
      b.append(stampIcon(k));
      b.dataset.stamp = k;
      b.addEventListener('click', () => { tool.stamp = k; tool.kind = 'stamp'; closePop(); updateTools(); });
      pop.append(b);
    }
  } else if (kind === 'bg') {
    pop.classList.add('backgrounds');
    const current = backgroundOf(A ? A.ops : []);
    for (const bg of BACKGROUNDS) {
      const b = el('button', 'tool' + (sameBackground(bg, current) ? ' sel' : ''));
      b.append(bgSample(bg, 48, 60), el('span', null, t(BG_NAMES[bg.k])));
      b.dataset.bg = bg.k + (bg.c || '');
      b.setAttribute('aria-label', t(BG_NAMES[bg.k]));
      b.addEventListener('click', () => {
        closePop();
        if (A && !A.loading && !sameBackground(bg, backgroundOf(A.ops))) commit({ t: 'bg', ...bg });
      });
      pop.append(b);
    }
  } else if (kind === 'brush') {
    for (const k of BRUSHES) {
      const b = el('button', 'tool' + (k === tool.brush ? ' sel' : ''));
      b.append(brushSample(k));
      b.dataset.brush = k;
      b.setAttribute('aria-label', t(BRUSH_NAMES[k]));
      b.addEventListener('click', () => { tool.brush = k; tool.kind = 'brush'; closePop(); updateTools(); });
      pop.append(b);
    }
  } else if (kind === 'mirror') {
    for (const m of MIRRORS) {
      const b = el('button', 'tool' + (m === tool.mirror ? ' sel' : ''));
      b.innerHTML = mirrorIcon(m);
      b.dataset.mirror = m;
      b.setAttribute('aria-label', t(MIRROR_NAMES[m]));
      b.addEventListener('click', () => { tool.mirror = m; closePop(); updateTools(); });
      pop.append(b);
    }
  } else if (kind === 'shape') {
    for (const k of Object.keys(SHAPES)) {
      const b = el('button', 'tool' + (k === tool.shape ? ' sel' : ''));
      b.innerHTML = shapeIcon(k);
      b.dataset.shape = k;
      b.setAttribute('aria-label', t(SHAPE_NAMES[k]));
      b.addEventListener('click', () => { tool.shape = k; tool.kind = 'shape'; closePop(); updateTools(); });
      pop.append(b);
    }
  } else {
    pop.classList.add('sizes');
    SIZES.forEach((w, i) => {
      const b = el('button', 'tool' + (i === tool.size ? ' sel' : ''));
      b.append(sizeLine(i));
      b.dataset.size = i;
      b.setAttribute('aria-label', t('Épaisseur {n}', { n: i + 1 }));
      b.addEventListener('click', () => { tool.size = i; closePop(); updateTools(); });
      pop.append(b);
    });
  }
  pop.hidden = false;
}

function closePop() { pop.hidden = true; }

for (const b of document.querySelectorAll('#draw .tool[data-tool]')) {
  b.addEventListener('click', () => {
    const again = tool.kind === b.dataset.tool;
    tool.kind = b.dataset.tool;
    // the brush draws at once; its menu opens on a second tap, so a first stroke is never lost
    if (tool.kind === 'shape' || tool.kind === 'stamp' || (tool.kind === 'brush' && again)) openPop(tool.kind); else closePop();
    updateTools();
  });
}
$('#size').addEventListener('click', () => openPop('size'));
$('#mirror').addEventListener('click', () => openPop('mirror'));

for (const c of [...COLORS, RAINBOW]) {
  const b = el('button', 'dot');
  if (c === RAINBOW) b.classList.add('rainbow'); else b.style.background = c;
  b.dataset.color = c;
  if (c === RAINBOW) b.setAttribute('data-t-aria', '');  // translated with the page
  b.setAttribute('aria-label', c === RAINBOW ? 'Arc-en-ciel' : t('Couleur {c}', { c }));
  b.addEventListener('click', () => {
    tool.color = c;
    if (tool.kind === 'eraser') tool.kind = 'brush';  // picking a colour means painting again
    closePop();
    updateTools();
  });
  $('#draw-colors').append(b);
}

async function share() {
  if (!A || !A.ops.length) return;
  try {
    await sharePng(await canvasPng(renderFlat(A.ops, 1200, A.base)), `giuno-dessin-${A.id}.png`, t('Mon dessin'));
  } catch (e) {
    console.error('share failed:', e);
  }
}

$('#draw-back').addEventListener('click', () => onBack());
$('#zoom-fit').addEventListener('click', () => { if (A) { fitView(); renderAll(); } });
$('#replay').addEventListener('click', () => { if (A && A.replay) stopReplay(); else replay(); });
$('#draw-bg').addEventListener('click', () => { stopReplay(); openPop('bg'); });
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#draw-share').addEventListener('click', share);
$('#draw-delete').addEventListener('click', async () => {
  if (!A) return;
  const a = A;
  if (a.ops.length && !(await confirmDialog(t('Jeter ce dessin ?'), t('Jeter')))) return;
  if (A !== a) return;
  clearTimeout(a.timer);
  a.ops = [];
  a.dirty = false;
  try { await deleteArt(a.id); } catch (e) { console.error('drawing not deleted:', e); }
  if (A === a) onBack();
});

// Hooks for the automated tests.
export const debug = {
  state: () => A,
  tool,
  toClient(x, y) {
    const r = stage.getBoundingClientRect();
    return [r.left + A.view.ox + x * scale(), r.top + A.view.oy + y * scale()];
  },
  flushSave,
  sparkles,
  replay,
  stopReplay,
  shake,
};

preloadStamps();
