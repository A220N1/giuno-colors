// The free drawing screen: a blank page with brush, paint bucket, eraser, shapes, undo and redo.
import { $, el, showScreen, vibrate, inkFor, confirmDialog } from './util.js';
import { PAGE_W, PAGE_H, SIZES, COLORS, SHAPES, drawOp, drawPreview, renderLayers, renderFlat, clearCanvas, fillRegion } from './art.js';
import { getArt, putArt, deleteArt } from './artstore.js';
import { sharePng, canvasPng } from './share.js';

const TAP_SLOP_PX = 10;     // finger movement still counted as a tap
const MIN_STEP = 2;         // page units between two kept points of a line
const SMOOTH = 0.45;        // share of each finger move followed at once; the rest evens out the jitter
const SHAPE_TAP_SIZE = 180; // a tap with the shape tool drops a shape this big
const SAVE_DELAY_MS = 400;
const SHAPE_NAMES = { circle: 'Rond', square: 'Carré', triangle: 'Triangle', star: 'Étoile', heart: 'Cœur' };
const DOT_PX = [6, 11, 18, 28];  // the sizes as shown on their buttons

const stage = $('#draw-stage');
const sheet = stage.querySelector('.sheet');
const [fillCanvas, lineCanvas, liveCanvas] = sheet.querySelectorAll('canvas');
const fills = fillCanvas.getContext('2d');
const lines = lineCanvas.getContext('2d');
const live = liveCanvas.getContext('2d');
const pop = $('#draw-pop');
const tool = { kind: 'brush', color: COLORS[0], size: 1, shape: 'circle' };  // kept from one drawing to the next
let A = null;  // the drawing on screen
let pen = null;
let onBack = () => {};

export async function openDraw(id, profileId, back) {
  onBack = back;
  showScreen('draw');
  closePop();
  const a = { id, profileId, ops: [], redo: [], created: Date.now(), saved: false, dirty: false, loading: true,
    s: 1, k: 1, W: 0, H: 0, timer: 0 };
  A = a;
  layout();
  updateTools();
  updateButtons();
  let rec = null;
  try { rec = await getArt(id); } catch (e) { console.error('drawing not loaded:', e); }
  if (A !== a) return;
  if (rec && rec.profile !== profileId) { A = null; onBack(); return; }
  if (rec) { a.ops = rec.ops; a.created = rec.created; a.saved = true; }
  a.loading = false;
  renderAll();
  updateButtons();
}

export function leaveDraw() {
  if (!A) return;
  flushSave();
  A = null;
  pen = null;
  closePop();
}

function layout() {
  const r = stage.getBoundingClientRect();
  A.W = r.width; A.H = r.height;
  const s = Math.min(r.width / PAGE_W, r.height / PAGE_H) * 0.96;
  const w = PAGE_W * s, h = PAGE_H * s;
  Object.assign(sheet.style, { left: (r.width - w) / 2 + 'px', top: (r.height - h) / 2 + 'px', width: w + 'px', height: h + 'px' });
  const dpr = window.devicePixelRatio || 1;
  for (const c of [fillCanvas, lineCanvas, liveCanvas]) {
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
  }
  A.s = s;
  A.k = fillCanvas.width / PAGE_W;
  renderAll();
}

function renderAll() {
  renderLayers(fills, lines, A.ops, A.k);
  clearCanvas(live, A.k);
}

function onResize() {
  if (!A) return;
  const r = stage.getBoundingClientRect();
  if (Math.abs(r.width - A.W) < 0.5 && Math.abs(r.height - A.H) < 0.5) return;
  layout();
}
if (typeof ResizeObserver === 'function') new ResizeObserver(onResize).observe(stage);
addEventListener('resize', onResize);

function commit(op) {
  A.ops.push(op);
  A.redo = [];
  drawOp(fills, lines, op);
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
    putArt({ id: A.id, profile: A.profileId, created: A.created, updated: Date.now(), ops: A.ops.slice() }).catch(fail);
    A.saved = true;
  } else if (A.saved) {  // everything undone: an empty page is not kept
    deleteArt(A.id).catch(fail);
    A.saved = false;
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });

function undo() {
  if (!A || A.loading || !A.ops.length) return;
  A.redo.push(A.ops.pop());
  renderAll();
  changed();
}

function redo() {
  if (!A || A.loading || !A.redo.length) return;
  const op = A.redo.pop();
  A.ops.push(op);
  drawOp(fills, lines, op);
  changed();
}

function updateButtons() {
  $('#undo').disabled = !A || !A.ops.length;
  $('#redo').disabled = !A || !A.redo.length;
}

// Gestures: one finger draws; any other finger on the page meanwhile is ignored.
function toPage(e) {
  return [(e.clientX - A.left) / A.s, (e.clientY - A.top) / A.s];
}

function boxOf(x0, y0, x1, y1) {
  return [Math.round(Math.min(x0, x1)), Math.round(Math.min(y0, y1)), Math.round(Math.abs(x1 - x0)), Math.round(Math.abs(y1 - y0))];
}

function addPoint(x, y) {
  pen.sx += (x - pen.sx) * SMOOTH;
  pen.sy += (y - pen.sy) * SMOOTH;
  const p = pen.op.p;
  const qx = Math.round(pen.sx), qy = Math.round(pen.sy);
  if (Math.hypot(qx - p[p.length - 2], qy - p[p.length - 1]) >= MIN_STEP) p.push(qx, qy);
}

stage.addEventListener('pointerdown', (e) => {
  if (!A || A.loading || pen || e.target.closest('.pop')) return;
  if (!pop.hidden) { closePop(); return; }  // a tap beside the menu only closes it
  const r = sheet.getBoundingClientRect();
  A.left = r.left; A.top = r.top;
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  const [x, y] = toPage(e);
  pen = { id: e.pointerId, cx: e.clientX, cy: e.clientY, x, y, sx: x, sy: y, moved: false, op: null };
  const w = SIZES[tool.size], start = [Math.round(x), Math.round(y)];
  if (tool.kind === 'brush') pen.op = { t: 'line', c: tool.color, w, p: start };
  else if (tool.kind === 'eraser') pen.op = { t: 'erase', w, p: start };
  showLive();
});

stage.addEventListener('pointermove', (e) => {
  if (!A || !pen || e.pointerId !== pen.id) return;
  if (Math.hypot(e.clientX - pen.cx, e.clientY - pen.cy) > TAP_SLOP_PX) pen.moved = true;
  if (pen.op && pen.op.p) {
    const all = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of all.length ? all : [e]) addPoint(...toPage(ev));
  } else if (tool.kind === 'shape' && pen.moved) {
    const [x, y] = toPage(e);
    pen.op = { t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b: boxOf(pen.x, pen.y, x, y) };
  }
  showLive();
});

function penUp(e) {
  if (!pen || e.pointerId !== pen.id) return;
  const g = pen;
  pen = null;
  if (!A) return;
  clearLive();
  const [x, y] = toPage(e);
  if (g.op && g.op.p) {
    const p = g.op.p, qx = Math.round(x), qy = Math.round(y);
    if (g.moved && (qx !== p[p.length - 2] || qy !== p[p.length - 1])) p.push(qx, qy);  // end where the finger left
    commit(g.op);
  } else if (e.type !== 'pointerup') {
    return;
  } else if (tool.kind === 'shape') {
    const h = SHAPE_TAP_SIZE / 2;
    const b = g.moved ? boxOf(g.x, g.y, x, y) : boxOf(g.x - h, g.y - h, g.x + h, g.y + h);
    commit({ t: 'shape', k: tool.shape, c: tool.color, w: SIZES[tool.size], b });
  } else if (tool.kind === 'bucket' && !g.moved) {
    const loops = fillRegion(A.ops, g.x, g.y);
    if (loops && loops.length) { commit({ t: 'fill', c: tool.color, r: loops }); vibrate(12); }
  }
}
stage.addEventListener('pointerup', penUp);
stage.addEventListener('pointercancel', penUp);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

let liveRaf = 0;
function showLive() {
  if (!liveRaf) liveRaf = requestAnimationFrame(drawLive);
}
function drawLive() {
  liveRaf = 0;
  if (!A) return;
  clearCanvas(live, A.k);
  if (pen && pen.op) drawPreview(live, pen.op);
}
function clearLive() {
  cancelAnimationFrame(liveRaf);
  liveRaf = 0;
  clearCanvas(live, A.k);
}

// Toolbar: tools, the shape and size menus, colours.
const shapeIcon = (k) => `<svg viewBox="-0.2 -0.2 1.4 1.4" class="shape"><path d="${SHAPES[k]}"/></svg>`;

function sizeDot(i) {
  const dot = el('span', 'size-dot');
  dot.style.width = dot.style.height = DOT_PX[i] + 'px';
  dot.style.background = tool.color;
  if (inkFor(tool.color) !== '#fff') dot.style.boxShadow = 'inset 0 0 0 1.5px rgba(0, 0, 0, .3)';
  return dot;
}

function updateTools() {
  for (const b of document.querySelectorAll('#draw .tool[data-tool]')) b.classList.toggle('sel', b.dataset.tool === tool.kind);
  const shapeBtn = $('#draw .tool[data-tool="shape"]');
  shapeBtn.innerHTML = shapeIcon(tool.shape);
  shapeBtn.setAttribute('aria-label', 'Formes : ' + SHAPE_NAMES[tool.shape]);
  $('#size').replaceChildren(sizeDot(tool.size));
  for (const b of $('#draw-colors').children) b.classList.toggle('sel', b.dataset.color === tool.color);
}

function openPop(kind) {
  if (!pop.hidden && pop.dataset.kind === kind) { closePop(); return; }
  pop.dataset.kind = kind;
  pop.replaceChildren();
  if (kind === 'shape') {
    for (const k of Object.keys(SHAPES)) {
      const b = el('button', 'tool' + (k === tool.shape ? ' sel' : ''));
      b.innerHTML = shapeIcon(k);
      b.dataset.shape = k;
      b.setAttribute('aria-label', SHAPE_NAMES[k]);
      b.addEventListener('click', () => { tool.shape = k; tool.kind = 'shape'; closePop(); updateTools(); });
      pop.append(b);
    }
  } else {
    SIZES.forEach((w, i) => {
      const b = el('button', 'tool' + (i === tool.size ? ' sel' : ''));
      b.append(sizeDot(i));
      b.dataset.size = i;
      b.setAttribute('aria-label', 'Épaisseur ' + (i + 1));
      b.addEventListener('click', () => { tool.size = i; closePop(); updateTools(); });
      pop.append(b);
    });
  }
  pop.hidden = false;
}

function closePop() { pop.hidden = true; }

for (const b of document.querySelectorAll('#draw .tool[data-tool]')) {
  b.addEventListener('click', () => {
    tool.kind = b.dataset.tool;
    if (tool.kind === 'shape') openPop('shape'); else closePop();
    updateTools();
  });
}
$('#size').addEventListener('click', () => openPop('size'));

for (const c of COLORS) {
  const b = el('button', 'dot');
  b.style.background = c;
  b.dataset.color = c;
  b.setAttribute('aria-label', 'Couleur ' + c);
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
    await sharePng(await canvasPng(renderFlat(A.ops, 1200)), `giuno-dessin-${A.id}.png`, 'Mon dessin');
  } catch (e) {
    console.error('share failed:', e);
  }
}

$('#draw-back').addEventListener('click', () => onBack());
$('#undo').addEventListener('click', undo);
$('#redo').addEventListener('click', redo);
$('#draw-share').addEventListener('click', share);
$('#draw-delete').addEventListener('click', async () => {
  if (!A) return;
  const a = A;
  if (a.ops.length && !(await confirmDialog('Jeter ce dessin ?', 'Jeter'))) return;
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
    const r = sheet.getBoundingClientRect();
    return [r.left + x * A.s, r.top + y * A.s];
  },
  flushSave,
};
