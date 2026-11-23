// The free drawing screen: a blank page with brush, paint bucket, eraser, shapes, undo and redo.
import { $, el, showScreen, vibrate, inkFor, confirmDialog } from './util.js';
import { PAGE_W, PAGE_H, SIZES, COLORS, SHAPES, RAINBOW, RAINBOW_LEN, MIRRORS, BRUSHES, BRUSH_NAMES, PIECEWISE, BACKGROUNDS, BG_NAMES, BG_CLOSE_UP,
  backgroundOf, sameBackground, paperColor, drawBackground, drawBase, mirrorPoints, smudgeOp, drawOp, drawPreview, drawDripping, renderLayers, renderFlat,
  clearCanvas, clearLayers, fillRegion, STENCILS, STENCIL_BOX, SCRATCH_COAT, scratchPaint } from './art.js';
import { getArt, putArt, deleteArt } from './artstore.js';
import { sharePng, canvasPng } from './share.js';
import { sparkler } from './sparkles.js';
import { STAMPS, stampUrl, stampGroups, isAnimal, isNature, isCustom, customSticker, prepareArt, preloadStamps } from './images.js';
import { isFirework, flakesOf } from './nature.js';
import { BRICKS, PIECES, STUD, PLATE, BASE, MODELS, drawPiece, drawModel, snapBrick, brickBox, brickAt, liveBricks, removedOps,
  modelOf, modelLeft } from './bricks.js';
import { sfx, rubStart, rubMove, rubStop } from './sound.js';
import { toast } from './lock.js';
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
const DRIP_MS = 3800;       // how long dripping paint keeps running after the stroke
const SHAKE_ACCEL = 14;     // m/s² on top of gravity: a real shake, not a phone picked up
const SHAKE_GAP_MS = 1500;  // one snowfall per shake
const FLAKES = 70;          // flakes a shake lets fall
const MIRROR_NAMES = { 1: 'Sans miroir', 2: 'Miroir gauche-droite', 4: 'Miroir en quatre', 6: 'Kaléidoscope' };
const DOT_PX = [6, 11, 17, 24, 32];  // the line sizes as dots in the brush and eraser menus
const STAMP_SIZES = [80, 130, 190, 260, 340];  // side of a sticker dropped by a tap, by size
const STAMP_MIN = 30;  // a drag smaller than this drops a sticker of the chosen size instead
const LIFT_PX = 26;    // a sticker being sized, or a brick being placed, shows this far above the finger
const PICK_MS = 380;   // holding a brick this long picks it up, to move it or throw it off the page
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
const DEFAULT_STAMP = 'e2B50';
const tool = { kind: 'brush', brush: 'marker', color: COLORS[0], size: 1, shape: 'circle', stamp: DEFAULT_STAMP, brick: 'b2', stencil: '', mirror: 1 };  // kept from one drawing to the next
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
    s: 1, k: 1, W: 0, H: 0, timer: 0, baseId, base: null, paper: '#ffffff', replay: null, memo: {}, keep: {} };
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
  a.modelDone = modelOf(a.ops) && !modelLeft(a.ops, modelOf(a.ops)).length ? modelOf(a.ops) : '';
  renderAll();
  updateButtons();
}

export function leaveDraw() {
  if (!A) return;
  flushSave();
  stopReplay();
  A = null;
  pen = null;
  rubStop();
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
  A.card = A.paper === 'scratch';  // a scratch card: the brush scratches, the eraser lays the coat again
  $('#draw-colors').classList.toggle('off', A.card && (tool.kind === 'brush' || tool.kind === 'eraser'));
  drawBackground(back, bg, A.k, A.keep);
  const model = modelOf(A.ops);
  if (model) drawModel(back, model, modelLeft(A.ops, model));  // what is left to build, pale, under the bricks
  updateBgButton(bg);
  renderLayers(fills, lines, A.ops, A.k, A.lift, A.memo);
  drawBase(baseLayer, A.base, A.k);
  clearCanvas(live, A.k);
  perfStop('redessin complet', t0, () => count(A.ops.length, 'opération'));
}

// One more operation on screen: a background redraws its layer, the rest draws on top.
function showOp(op) {
  if (op.t === 'bg' || op.t === 'unbrick' || op.t === 'model' || op.r != null) renderAll(); else drawOp(fills, lines, op);
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
  sfx('tick');
}

function redo() {
  stopReplay();
  if (!A || A.loading || !A.redo.length) return;
  const op = A.redo.pop();
  A.ops.push(op);
  showOp(op);
  changed();
  sfx('tick');
}

function updateButtons() {
  $('#undo').disabled = !A || !A.ops.length;
  $('#redo').disabled = !A || !A.redo.length;
  $('#replay').disabled = !A || !A.ops.some((op) => op.t !== 'bg' && op.t !== 'model');
  const n = A && tool.kind === 'brick' ? liveBricks(A.ops).length : 0;
  $('#brick-count').hidden = !n;
  $('#brick-count').textContent = n;
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
  if (pen) { clearTimeout(pen.hold); pen = null; rubStop(); clearLive(); }
  A.lift = null;
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

// A finger hides what is under it, and the hand what is below: under a finger, things show a little
// above it, whichever hand it is. A mouse hides nothing.
const liftOf = (e) => (e.pointerType === 'touch' ? LIFT_PX / scale() : 0);

// A sticker stays square: its side is how far the finger went from where it started. Under a finger
// it sits just above it; with a mouse it grows from the corner where the drag started.
function stampBox(x0, y0, x1, y1, lift) {
  const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (side < STAMP_MIN) return null;
  if (lift) return boxOf(x1 - side / 2, y1 - lift - side, x1 + side / 2, y1 - lift);
  return boxOf(x0, y0, x1 < x0 ? x0 - side : x0 + side, y1 < y0 ? y0 - side : y0 + side);
}

// A brick where the pointer wants it: resting just above a finger, or under a mouse. The brick in
// use in the colour in use, or a brick picked up from the page.
function brickOp(e, k = tool.brick, c = tool.color) {
  const [x, y] = toPage(e), lift = liftOf(e);
  const under = lift ? y - lift : y + brickBox({ k, x: 0, y: 0 })[3] / 2;
  return mirrorable({ t: 'brick', k, c, ...snapBrick(A.ops, k, x, under) });
}

// A model just finished: every brick of it stands. Celebrated once.
function checkModel() {
  const k = modelOf(A.ops), done = k && !modelLeft(A.ops, k).length ? k : '';
  if (done && A.modelDone !== done) {
    sfx('bravo');
    vibrate(60);
    const colours = ['#ffd23f', '#ff5a5f', '#5db7ff', '#4cd08a', '#ffffff'];
    for (const [x, y] of [[200, 300], [600, 260], [400, 480]]) {
      sparkles.firework(A.view.ox + x * scale(), A.view.oy + y * scale(), 150 * scale(), colours);
    }
  }
  A.modelDone = done;
}

// Replay: the drawing draws itself again in a few seconds, stroke by stroke.
const replayCost = (op) => (op.p ? op.p.length / 2 : 12);

function replay() {
  if (!A || A.loading || !A.ops.length) return;
  stopReplay();
  closePop();
  const a = A, ops = a.ops.slice();
  const gone = removedOps(ops);
  const skip = (op) => op.t === 'bg' || gone.has(op);  // bricks taken away since are left out
  const total = ops.reduce((n, op) => n + replayCost(op), 0);
  const duration = Math.min(10000, Math.max(2500, total * 5));
  // the page starts blank on its final background
  clearLayers(fills, lines, ops, a.k); clearCanvas(live, a.k);
  const R = { i: 0, done: 0, from: 0, t0: performance.now(), raf: 0 };
  a.replay = R;
  stage.classList.add('replaying');
  const step = (now) => {
    if (A !== a || a.replay !== R) return;
    const target = total * Math.min(1, (now - R.t0) / duration);
    while (R.i < ops.length && R.done + replayCost(ops[R.i]) <= target) {
      if (!skip(ops[R.i])) drawOp(fills, lines, ops[R.i]);
      R.done += replayCost(ops[R.i]);
      R.i++;
      R.from = 0;
      clearCanvas(live, a.k);
    }
    if (R.i >= ops.length) { stopReplay(); return; }
    const op = ops[R.i];
    if (op.p && op.t !== 'smudge' && !skip(op)) {
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
const throwsStars = (op) => op && (op.c === RAINBOW || op.k === 'stars' || (op.t === 'erase' && A.card));
const starHue = (op, len) => (op.c === RAINBOW || op.t === 'erase' ? len / RAINBOW_LEN : STAR_HUE);

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

// Dripping paint runs down for a few seconds after the stroke. The drops are shown over the page
// while they run, since they change shape as they go, then painted on the drawing once they stopped.
const dripping = new Set();
function runDrips(op) {
  const a = A, run = {};
  dripping.add(run);
  sparkles.effect(DRIP_MS, (t, ctx) => {
    if (A !== a || !dripping.has(run)) return;
    ctx.translate(a.view.ox, a.view.oy);
    ctx.scale(scale(), scale());
    ctx.beginPath();
    ctx.rect(0, 0, PAGE_W, PAGE_H);
    ctx.clip();
    drawDripping(ctx, op, t, true);
  }, () => {
    if (A === a && dripping.delete(run)) drawDripping(lines, op, 1, true);
  });
}
// Called before the page is drawn again whole: the drops are then painted at full length.
function stopDrips() {
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
  sfx('chime');
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

// A new operation takes the mirror mode and the stencil in use.
function mirrorable(op) {
  if (tool.mirror > 1) op.m = tool.mirror;
  if (tool.stencil) op.s = tool.stencil;
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
  if (tool.kind === 'brush' && A.card) pen.op = mirrorable({ t: 'erase', w, p: start });
  else if (tool.kind === 'brush') {
    pen.op = mirrorable({ t: 'line', c: tool.color, w, p: start });
    if (tool.brush !== 'marker') pen.op.k = tool.brush;
  }
  else if (tool.kind === 'eraser' && A.card) pen.op = mirrorable({ t: 'line', c: SCRATCH_COAT, w, p: start });
  else if (tool.kind === 'eraser') pen.op = mirrorable({ t: 'erase', w, p: start });
  else if (tool.kind === 'smudge') pen.op = mirrorable({ t: 'smudge', w, p: start });
  else if (tool.kind === 'brick') {
    pen.op = brickOp(e);
    const p = pen;
    // held still on a brick: it is picked up, to be moved or thrown off the page
    p.hold = setTimeout(() => {
      if (pen !== p || p.moved || !A) return;
      const i = brickAt(A.ops, p.x, p.y);
      if (i < 0) return;
      p.pick = i;
      A.lift = A.ops[i];  // it leaves the page and follows the finger, with its shadow
      renderAll();
      p.op = { ...brickOp(e, A.ops[i].k, A.ops[i].c), lift: true };
      vibrate(40);
      sfx('pick');
      showLive();
    }, PICK_MS);
  }
  if (pen.op && pen.op.p) rubStart(pen.op.t === 'erase' ? 'eraser' : 'brush');
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
    rubMove(Math.hypot(e.clientX - pen.lx, e.clientY - pen.ly));
    pen.lx = e.clientX; pen.ly = e.clientY;
  } else if (tool.kind === 'shape' && pen.moved) {
    const [x, y] = toPage(e);
    pen.op = mirrorable({ t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b: boxOf(pen.x, pen.y, x, y) });
  } else if (tool.kind === 'stamp' && pen.moved) {
    const b = stampBox(pen.x, pen.y, ...toPage(e), liftOf(e));
    pen.op = b ? mirrorable(stampOp(b)) : null;
  } else if (tool.kind === 'brick') {
    pen.op = pen.pick != null ? { ...brickOp(e, A.ops[pen.pick].k, A.ops[pen.pick].c), lift: true } : brickOp(e);
  }
  showLive();
});

function penUp(e) {
  fingers.delete(e.pointerId);
  if (pinch) { if (fingers.size < 2) endPinch(); return; }
  if (!pen || e.pointerId !== pen.id) return;
  const g = pen;
  pen = null;
  clearTimeout(g.hold);
  rubStop();
  if (!A) return;
  clearLive();
  const carried = A.lift;
  A.lift = null;
  if (carried && e.type !== 'pointerup') { renderAll(); return; }  // the gesture was taken away: the brick goes back
  const [x, y] = toPage(e);
  if (g.op && g.op.p) {
    // a tap of the eraser on a brick takes the whole brick away
    const brick = g.op.t === 'erase' && !g.moved && e.type === 'pointerup' ? brickAt(A.ops, g.x, g.y) : -1;
    if (brick >= 0) { commit({ t: 'unbrick', i: brick }); sfx('unclick'); vibrate(8); checkModel(); return; }
    const p = g.op.p, qx = Math.round(x), qy = Math.round(y);
    if (g.moved && (qx !== p[p.length - 2] || qy !== p[p.length - 1])) p.push(qx, qy);  // end where the finger left
    if (g.op.t === 'smudge') { smudgeOp(fills, lines, g.op, g.from); commit(g.op, true); }
    else if (g.op.k === 'drip' && !g.op.s) { drawDripping(lines, g.op, 0); commit(g.op, true); runDrips(g.op); }
    else commit(g.op);
  } else if (e.type !== 'pointerup') {
    return;
  } else if (tool.kind === 'stamp') {
    const h = STAMP_SIZES[tool.size] / 2;
    const b = (g.moved && stampBox(g.x, g.y, x, y, liftOf(e))) || boxOf(g.x - h, g.y - h, g.x + h, g.y + h);
    const op = mirrorable(stampOp(b));
    commit(op);
    vibrate(12);
    if (isFirework(op.k)) { fireworkBurst(op); sfx('boom'); } else sfx('pop');
  } else if (tool.kind === 'brick') {
    if (g.pick == null) {
      commit(brickOp(e));
      sfx('click');
    } else if (x < 0 || y < 0 || x > PAGE_W || y > PAGE_H) {  // dropped off the page: taken away
      commit({ t: 'unbrick', i: g.pick });
      sfx('unclick');
    } else {
      commit({ ...brickOp(e, A.ops[g.pick].k, A.ops[g.pick].c), r: g.pick });
      sfx('click');
    }
    vibrate(8);
    checkModel();
  } else if (tool.kind === 'shape') {
    const h = SHAPE_TAP_SIZE / 2;
    const b = g.moved ? boxOf(g.x, g.y, x, y) : boxOf(g.x - h, g.y - h, g.x + h, g.y + h);
    commit(mirrorable({ t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b }));
    sfx('pop');
    if (tool.color === RAINBOW) sparkleAt(b[0] + b[2] / 2, b[1] + b[3] / 2, 0, 18, Math.max(b[2], b[3]) * scale() / 2);
  } else if (tool.kind === 'bucket' && !g.moved) {
    // with a mirror, the mirror images of the tap fill too, in one operation (nonzero rule: two taps
    // in the same area add up instead of cancelling out)
    const loops = [], t0 = perfStart();
    for (const [px, py] of copiesOf(g.x, g.y)) loops.push(...(fillRegion(A.ops, px, py, A.base) || []));
    perfStop('seau', t0, opsInfo);
    if (loops.length) {
      const fill = tool.mirror > 1 ? { t: 'fill', c: tool.color, r: loops, z: 1 } : { t: 'fill', c: tool.color, r: loops };
      if (tool.stencil) fill.s = tool.stencil;
      commit(fill);
      sfx('splash');
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

// A stencil as its button: the shape with a dashed edge, coloured inside, as paint stays inside it.
const stencilIcon = (k) => `<svg viewBox="-0.12 -0.12 1.24 1.24" class="stencil"><defs><clipPath id="stencil-${k}"><path d="${STENCILS[k]}"/></clipPath></defs>`
  + `<g clip-path="url(#stencil-${k})"><path stroke="#ff8fb1" d="M-.2 .12L1.2 -.08"/><path stroke="#ffd84d" d="M-.2 .42L1.2 .22"/>`
  + `<path stroke="#7cc8f5" d="M-.2 .72L1.2 .52"/><path stroke="#b79cf0" d="M-.2 1.02L1.2 .82"/></g><path class="edge" d="${STENCILS[k]}"/></svg>`;
const NO_STENCIL = '<svg viewBox="0 0 24 24" class="remove"><circle cx="12" cy="12" r="9"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/></svg>';

const PLATE_ICON = '<svg viewBox="0 0 24 24" class="scenery"><path d="M5 12h4v3H5zM10 12h4v3h-4zM15 12h4v3h-4z" fill="#3f9a4f"/>'
  + '<rect x="2" y="15" width="20" height="4" rx="1" fill="#4aa35a"/></svg>';

// A model to build in small, in its colours; without a model, an empty frame crossed out.
function modelIcon(k) {
  if (!MODELS[k]) return '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3" stroke-dasharray="3 3"/><path d="M7 17L17 7"/></svg>';
  const dpr = window.devicePixelRatio || 1, c = document.createElement('canvas');
  c.width = c.height = Math.round(40 * dpr);
  c.className = 'sample';
  const ctx = c.getContext('2d');
  const boxes = MODELS[k].map(([piece, , x, y]) => brickBox({ k: piece, x, y }));
  const x0 = Math.min(...boxes.map((b) => b[0])), x1 = Math.max(...boxes.map((b) => b[0] + b[2]));
  const y0 = Math.min(...boxes.map((b) => b[1])) - 8, y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
  const s = c.width * 0.94 / Math.max(x1 - x0, y1 - y0);
  ctx.setTransform(s, 0, 0, s, (c.width - (x1 - x0) * s) / 2 - x0 * s, (c.height - (y1 - y0) * s) / 2 - y0 * s);
  drawModel(ctx, k, MODELS[k], 1);
  return c;
}

// A brick piece in the colour in use, `unit` pixels to a stud.
function brickIcon(k, unit) {
  const piece = PIECES[k], dpr = window.devicePixelRatio || 1, s = unit / STUD;
  const w = piece.w * unit + 4, h = (piece.h * PLATE + 8) * s + 4;
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = w + 'px';
  c.style.height = h + 'px';
  c.className = 'sample brick';
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr * s, 0, 0, dpr * s, 2 * dpr, (h - 2) * dpr);
  drawPiece(ctx, { k, c: tool.color, x: 3, y: 9 });
  return c;
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
  const ctx = c.getContext('2d');
  drawBackground(ctx, bg, c.width / (BG_CLOSE_UP.has(bg ? bg.k : 'paper') ? 280 : PAGE_W));
  if (bg && bg.k === 'scratch') {  // as the page looks: black, with a few scratches showing the colours
    ctx.fillStyle = SCRATCH_COAT;
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.strokeStyle = scratchPaint(ctx);
    ctx.lineWidth = 80;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(130, 260); ctx.lineTo(660, 170); ctx.lineTo(160, 520); ctx.lineTo(650, 470); ctx.lineTo(200, 800); ctx.lineTo(620, 770);
    ctx.stroke();
  }
  return c;
}

// A scratch card just laid: a word of what to do, and a scratch that draws itself across the page
// and fades, showing the colours hidden under the black.
function scratchHint() {
  toast(t('Gratte avec ton doigt : des couleurs se cachent dessous'));
  const a = A;
  const pts = Array.from({ length: 46 }, (_, i) => [170 + i * 10, 500 + 90 * Math.sin(i / 5)]);
  sparkles.effect(1900, (age, ctx) => {
    if (A !== a || !a.card) return;
    ctx.translate(a.view.ox, a.view.oy);
    ctx.scale(scale(), scale());
    ctx.globalAlpha = age < 0.7 ? 1 : (1 - age) / 0.3;
    ctx.strokeStyle = scratchPaint(ctx);
    ctx.lineWidth = 34;
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.beginPath();
    const n = Math.max(2, Math.round(pts.length * Math.min(1, age / 0.55)));
    pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  });
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
  // with the bricks, a dot at every corner of the grid they snap to
  const row = 3 * PLATE, low = BASE;
  const grid = tool.kind === 'brick' ? `<defs><pattern id="brick-grid" x="${-STUD / 2}" y="${low % row - row / 2}" width="${STUD}" height="${row}" patternUnits="userSpaceOnUse">`
    + `<circle cx="${STUD / 2}" cy="${row / 2}" r="2.4"/></pattern></defs><rect class="grid" width="${PAGE_W}" height="${PAGE_H}" fill="url(#brick-grid)"/>` : '';
  // a stencil veils the page around its shape
  const [sx, sy, sw, sh] = STENCIL_BOX, place = `transform="translate(${sx} ${sy}) scale(${sw} ${sh})"`;
  const veil = STENCILS[tool.stencil] ? `<defs><mask id="stencil-hole"><rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff"/><path ${place} d="${STENCILS[tool.stencil]}" fill="#000"/></mask></defs>`
    + `<rect class="veil" width="${PAGE_W}" height="${PAGE_H}" mask="url(#stencil-hole)"/><path class="stencil-edge" ${place} d="${STENCILS[tool.stencil]}"/>` : '';
  g.innerHTML = veil + grid + axes.map(line).join('');
}

// Paints an element in the colour in use; a pale colour gets an outline so it shows on white.
function inColour(e) {
  if (tool.color === RAINBOW) e.classList.add('rainbow');
  else e.style.background = tool.color;
  if (tool.color === RAINBOW || inkFor(tool.color) !== '#fff') e.style.boxShadow = 'inset 0 0 0 1.5px rgba(0, 0, 0, .25)';
  return e;
}

// The line sizes as a row of dots in the colour in use, in the brush and eraser menus.
function sizesRow() {
  const row = el('div', 'sizes');
  SIZES.forEach((w, i) => {
    const b = el('button', 'tool' + (i === tool.size ? ' sel' : ''));
    const dot = inColour(el('span', 'size-dot'));
    dot.style.width = dot.style.height = DOT_PX[i] + 'px';
    b.append(dot);
    b.dataset.size = i;
    b.setAttribute('aria-label', t('Épaisseur {n}', { n: i + 1 }));
    b.addEventListener('click', () => { tool.size = i; closePop(); updateTools(); });
    row.append(b);
  });
  return row;
}

// A personal sticker may have been removed since it was picked.
function checkStamp() {
  if (isCustom(tool.stamp) && !customSticker(tool.stamp)) tool.stamp = DEFAULT_STAMP;
}

function updateTools() {
  checkStamp();
  for (const b of document.querySelectorAll('#draw .tool[data-tool]')) b.classList.toggle('sel', b.dataset.tool === tool.kind);
  const brushBtn = $('#draw .tool[data-tool="brush"]');
  brushBtn.replaceChildren(brushSample(tool.brush));
  brushBtn.setAttribute('aria-label', t('Dessiner : {name}', { name: t(BRUSH_NAMES[tool.brush]) }));
  const shapeBtn = $('#draw .tool[data-tool="shape"]');
  shapeBtn.innerHTML = shapeIcon(tool.shape);
  shapeBtn.setAttribute('aria-label', t('Formes : {name}', { name: t(SHAPE_NAMES[tool.shape]) }));
  shapeBtn.classList.toggle('on', Boolean(tool.stencil));
  const stampBtn = $('#draw .tool[data-tool="stamp"]');
  stampBtn.replaceChildren(stampIcon(tool.stamp));
  $('#draw-colors').classList.toggle('off', Boolean(A && A.card) && (tool.kind === 'brush' || tool.kind === 'eraser'));
  const brickBtn = $('#draw .tool[data-tool="brick"]');
  const unit = Math.min(15, 30 / PIECES[tool.brick].w);
  brickBtn.replaceChildren(brickIcon(tool.brick, unit));
  const mirrorBtn = $('#mirror');
  mirrorBtn.innerHTML = mirrorIcon(tool.mirror);
  mirrorBtn.classList.toggle('on', tool.mirror > 1);
  mirrorBtn.setAttribute('aria-label', t('Miroir : {name}', { name: t(MIRROR_NAMES[tool.mirror]) }));
  updateGuides();
  updateButtons();
  for (const b of $('#draw-colors').children) b.classList.toggle('sel', b.dataset.color === tool.color);
}

// `tab`: the page of the sticker menu to show, when a tab was tapped.
function openPop(kind, tab = '') {
  if (!pop.hidden && pop.dataset.kind === kind && !tab) { closePop(); return; }
  pop.dataset.kind = kind;
  pop.classList.remove('grid', 'backgrounds', 'bricks', 'shapes', 'brushes');
  pop.replaceChildren();
  if (kind === 'stamp') {
    pop.classList.add('grid');
    checkStamp();
    // the menu opens on the page of the sticker in use; the tabs sit at the bottom, where they stay
    // put whatever the number of stickers above them
    const groups = stampGroups();
    const has = (g) => g.keys.includes(tool.stamp);
    const group = groups.find((g) => g.id === tab) || groups.find((g) => g.id === tool.stampTab && has(g)) || groups.find(has) || groups[0];
    for (const k of group.keys) {
      const b = el('button', 'tool' + (k === tool.stamp ? ' sel' : ''));
      b.append(stampIcon(k));
      b.dataset.stamp = k;
      b.addEventListener('click', () => { tool.stamp = k; tool.stampTab = group.id; tool.kind = 'stamp'; closePop(); updateTools(); });
      pop.append(b);
    }
    const tabs = el('div', 'tabs');
    for (const g of groups) {
      const b = el('button', 'tool' + (g === group ? ' sel' : ''));
      b.append(stampIcon(g.icon));
      b.dataset.tab = g.id;
      b.setAttribute('aria-label', t(g.name));
      b.addEventListener('click', () => openPop('stamp', g.id));
      tabs.append(b);
    }
    pop.append(tabs);
  } else if (kind === 'brick') {
    pop.classList.add('bricks');
    for (const k of BRICKS) {
      const b = el('button', 'tool' + (k === tool.brick ? ' sel' : ''));
      b.append(brickIcon(k, Math.min(15, 36 * STUD / (PIECES[k].h * PLATE + 8))));
      b.dataset.brick = k;
      b.setAttribute('aria-label', t('Brique {name}', { name: k }));
      b.addEventListener('click', () => { tool.brick = k; tool.kind = 'brick'; closePop(); updateTools(); });
      pop.append(b);
    }
    // the baseplate under the bricks, on or off, and the models to build
    const extras = el('div', 'extras');
    const now = backgroundOf(A ? A.ops : []), plateKey = 'plate', on = Boolean(now && now.k === plateKey);
    const plate = el('button', 'tool' + (on ? ' sel' : ''));
    plate.innerHTML = PLATE_ICON;
    plate.dataset.plate = plateKey;
    plate.setAttribute('aria-label', t('Plaque de base'));
    plate.addEventListener('click', () => {
      closePop();
      if (A && !A.loading) commit(on ? { t: 'bg', k: 'paper', c: '#ffffff' } : { t: 'bg', k: plateKey });
    });
    extras.append(plate);
    const current = modelOf(A ? A.ops : []);
    for (const m of ['', ...Object.keys(MODELS)]) {
      const b = el('button', 'tool' + (m === current ? ' sel' : ''));
      const icon = modelIcon(m);
      if (typeof icon === 'string') b.innerHTML = icon; else b.append(icon);
      b.dataset.model = m;
      b.setAttribute('aria-label', m ? t('Modèle {name}', { name: m }) : t('Sans modèle'));
      b.addEventListener('click', () => {
        closePop();
        if (A && !A.loading && m !== modelOf(A.ops)) { commit({ t: 'model', k: m }); checkModel(); }
      });
      extras.append(b);
    }
    pop.append(extras);
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
        // a scratch card is scratched with the brush, wide enough to see the colours come
        if (bg.k === 'scratch') { tool.kind = 'brush'; tool.size = Math.max(tool.size, 2); updateTools(); scratchHint(); }
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
    pop.classList.add('brushes');
    pop.append(sizesRow());
  } else if (kind === 'eraser') {
    pop.classList.add('brushes');
    pop.append(sizesRow());
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
    pop.classList.add('shapes');
    for (const k of Object.keys(SHAPES)) {
      const b = el('button', 'tool' + (k === tool.shape ? ' sel' : ''));
      b.innerHTML = shapeIcon(k);
      b.dataset.shape = k;
      b.setAttribute('aria-label', t(SHAPE_NAMES[k]));
      b.addEventListener('click', () => { tool.shape = k; tool.kind = 'shape'; closePop(); updateTools(); });
      pop.append(b);
    }
    // stencils: paint only stays inside the shape picked, whatever draws it; the cross puts it away
    const row = el('div', 'stencils');
    row.append(el('span', 'caption', t('Pochoirs')));
    const pick = (k) => { tool.stencil = k; if (k) tool.kind = 'brush'; closePop(); updateTools(); };
    if (tool.stencil) {
      const off = el('button', 'tool');
      off.innerHTML = NO_STENCIL;
      off.dataset.stencil = '';
      off.setAttribute('aria-label', t('Retirer le pochoir'));
      off.addEventListener('click', () => pick(''));
      row.append(off);
    }
    for (const k of Object.keys(STENCILS)) {
      const b = el('button', 'tool' + (k === tool.stencil ? ' sel' : ''));
      b.innerHTML = stencilIcon(k);
      b.dataset.stencil = k;
      b.setAttribute('aria-label', t('Pochoir {name}', { name: k }));
      b.addEventListener('click', () => pick(k === tool.stencil ? '' : k));
      row.append(b);
    }
    pop.append(row);
  }
  pop.hidden = false;
}

function closePop() { pop.hidden = true; }

for (const b of document.querySelectorAll('#draw .tool[data-tool]')) {
  b.addEventListener('click', () => {
    const again = tool.kind === b.dataset.tool;
    tool.kind = b.dataset.tool;
    // the brush and the eraser work at once; their menu opens on a second tap, so a first stroke is never lost
    if (tool.kind === 'shape' || tool.kind === 'stamp' || tool.kind === 'brick' || ((tool.kind === 'brush' || tool.kind === 'eraser') && again)) openPop(tool.kind);
    else closePop();
    updateTools();
  });
}
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
