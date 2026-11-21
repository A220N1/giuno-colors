// The colouring screen: view, gestures, palette, numbers, magnifier and end of drawing.
import { $, clamp, fmt, svgEl, showScreen, vibrate, inkFor, confirmDialog } from './util.js';
import { instantiate, paint, analyse } from './drawings.js';
import { getProgress, setProgress } from './store.js';
import { shareDrawing } from './share.js';
import { t } from './i18n.js';
import { perfScene, perfStart, perfStop, timed } from './perf.js';

const LABEL_MIN_PX = 9;    // numbers smaller than this on screen are hidden until zoomed in
const TAP_SLOP_PX = 10;    // finger movement still counted as a tap
const TAP_REACH_PX = 16;   // a near miss still fills a matching zone this close
const MAX_ZOOM = 10;       // relative to the fitted view
const LONG_PRESS_MS = 450; // holding a zone this long picks its colour
const FINDABLE_PX = 6;     // a zone narrower than this on screen is hard to spot: the magnifier beckons
const AUTO_FILL_PX = 6;    // a zone still narrower than this at full zoom, or hidden, comes already coloured
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const CHECKER_PX = 5;      // squares of the checkerboard on the zones left in the chosen colour, on screen
const CHECKER_GREY = '#d4d4d4';
const STILL_MS = 250;      // fingers resting this long on a moved view: it is drawn sharp again

export const testing = { instant: false };  // tests skip the zoom animation
const stage = $('#stage');
let P = null;           // the drawing being coloured
let onBack = () => {};
let onFree = () => {};
perfScene('play', () => (P ? P.d.id : ''));

// `free`: opens the drawing as a page to paint freely.
export function openPlay(d, profileId, back, free = () => {}) {
  const t0 = perfStart();
  onBack = back;
  onFree = free;
  stopConfetti();
  showScreen('play');
  $('#bravo').hidden = true;
  const svg = svgEl('svg');
  const world = svgEl('g');
  const { g, zones, colors } = instantiate(d);
  const labels = svgEl('g', { class: 'labels' });
  const marks = svgEl('g', { class: 'marks' });
  world.append(g, labels, marks);
  svg.append(world);
  stage.querySelector(':scope > svg')?.remove();
  stage.prepend(svg);
  P = {
    d, profileId, svg, world, art: g, zones, colors, labels, marks,
    filled: new Set(getProgress(profileId, d.key).filter((i) => i < zones.length)),
    sel: -1, s: 1, tx: 0, ty: 0, fit: 1, W: 0, H: 0, left0: 0, top0: 0, anim: 0,
    drawn: { s: 0, tx: 0, ty: 0 }, still: 0,  // the view the drawing was last drawn at
  };
  zones.forEach((z, i) => {
    z.setAttribute('data-i', i);
    if (P.filled.has(i)) paint(z, d.palette[colors[i]]);
  });
  buildCheckers();
  buildPalette();  // before measuring: its rows take height from the drawing area
  measureStage();
  fitView();
  P.info = timed(`numéros ${d.id}`, () => analyse(d, g, zones));
  // a zone nobody can see or touch would keep the drawing from ever being finished
  const minR = AUTO_FILL_PX / (P.fit * MAX_ZOOM);
  let auto = 0;
  P.info.pos.forEach((p, i) => {
    if (P.filled.has(i) || (!p.hidden && p.r >= minR)) return;
    P.filled.add(i);
    paint(zones[i], d.palette[colors[i]]);
    auto++;
  });
  if (auto) buildPalette();  // same swatches, fresh counts
  buildLabels();
  updateProgress();
  const first = nextColor(-1);
  if (first >= 0) selectColor(first); else finish(false);
  perfStop(`ouverture du coloriage ${d.id}`, t0);
}

export function leavePlay() {
  if (!P) return;
  cancelAnimationFrame(P.anim);
  clearTimeout(P.still);
  P = null;
  stopConfetti();
  $('#find').classList.remove('hint');
  $('#confirm').hidden = true;
}

function measureStage() {
  const r = stage.getBoundingClientRect();
  P.W = r.width; P.H = r.height; P.left0 = r.left; P.top0 = r.top;
}

function fitView() {
  const [vx, vy, vw, vh] = P.d.vb;
  P.fit = Math.min(P.W / vw, P.H / vh) * 0.96;
  setView(P.fit, (P.W - vw * P.fit) / 2 - vx * P.fit, (P.H - vh * P.fit) / 2 - vy * P.fit);
}

// A view the fingers are moving (`moving`) only moves and stretches the drawing as last drawn, with a
// CSS transform: drawing it again at each frame, with its numbers and checkerboard, made zooming slow
// on phones. It is drawn again, sharp, once the fingers lift or rest.
function setView(s, tx, ty, moving = false) {
  const [vx, vy, vw, vh] = P.d.vb;
  s = clamp(s, P.fit, P.fit * MAX_ZOOM);
  // keep the middle of the screen over the drawing, centre it when it is smaller than the screen
  tx = vw * s <= P.W ? (P.W - vw * s) / 2 - vx * s : clamp(tx, P.W / 2 - (vx + vw) * s, P.W / 2 - vx * s);
  ty = vh * s <= P.H ? (P.H - vh * s) / 2 - vy * s : clamp(ty, P.H / 2 - (vy + vh) * s, P.H / 2 - vy * s);
  P.s = s; P.tx = tx; P.ty = ty;
  clearTimeout(P.still);
  if (!moving) { drawView(); return; }
  const d = P.drawn, r = s / d.s;
  P.svg.style.transform = `translate(${tx - r * d.tx}px, ${ty - r * d.ty}px) scale(${r})`;
  P.still = setTimeout(drawView, STILL_MS);
}

function drawView() {
  if (!P) return;
  clearTimeout(P.still);
  P.svg.style.transform = '';
  const d = P.drawn;
  if (P.s === d.s && P.tx === d.tx && P.ty === d.ty) return;
  const zoomed = P.s !== d.s;
  P.drawn = { s: P.s, tx: P.tx, ty: P.ty };
  P.world.setAttribute('transform', `matrix(${P.s} 0 0 ${P.s} ${P.tx} ${P.ty})`);
  if (zoomed) { updateLabelVisibility(); sizeCheckers(); }
  scheduleFindHint();
}

let hintRaf = 0;
function scheduleFindHint() {
  if (!hintRaf) hintRaf = requestAnimationFrame(updateFindHint);
}

// The magnifier beckons when no zone left in the chosen colour can be seen on screen.
function updateFindHint() {
  hintRaf = 0;
  if (!P || !P.info) return;
  let need = P.sel >= 0;
  for (let i = 0; need && i < P.zones.length; i++) {
    if (P.filled.has(i) || P.colors[i] !== P.sel) continue;
    const p = P.info.pos[i];
    const sx = P.tx + p.x * P.s, sy = P.ty + p.y * P.s;
    if (p.r * P.s >= FINDABLE_PX && sx >= 0 && sy >= 0 && sx <= P.W && sy <= P.H) need = false;
  }
  $('#find').classList.toggle('hint', need);
}

// The zones to colour show a checkerboard of constant size on screen. A pattern tiles in the
// coordinates of the zone using it, and zones inside scaled groups have their own scale: one pattern
// per scale, resized at each zoom.
function buildCheckers() {
  const defs = svgEl('defs');
  const toWorld = P.world.getCTM().inverse();
  const byScale = new Map();
  P.checkers = [];
  P.zones.forEach((z) => {
    const m = toWorld.multiply(z.getCTM());
    const key = (Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1).toPrecision(3);
    let c = byScale.get(key);
    if (!c) {
      const el = svgEl('pattern', { id: 'checker' + byScale.size, patternUnits: 'userSpaceOnUse', viewBox: '0 0 2 2', width: 1, height: 1 });
      el.append(svgEl('rect', { width: 2, height: 2, fill: '#fff' }),
        svgEl('rect', { width: 1, height: 1, fill: CHECKER_GREY }),
        svgEl('rect', { x: 1, y: 1, width: 1, height: 1, fill: CHECKER_GREY }));
      defs.append(el);
      c = { el, k: parseFloat(key) };
      byScale.set(key, c);
      P.checkers.push(c);
    }
    z.style.setProperty('--hl', `url(#${c.el.id})`);
  });
  P.svg.prepend(defs);
}

function sizeCheckers() {
  if (!P.checkers) return;
  for (const c of P.checkers) {
    const w = (2 * CHECKER_PX / (P.s * c.k)).toPrecision(4);
    c.el.setAttribute('width', w);
    c.el.setAttribute('height', w);
  }
}

function buildLabels() {
  P.labels.replaceChildren();
  P.labelEls = new Array(P.zones.length).fill(null);
  const maxFs = Math.max(P.d.vb[2], P.d.vb[3]) * 0.055;
  P.zones.forEach((z, i) => {
    if (P.filled.has(i)) return;
    const { x, y, r } = P.info.pos[i];
    const num = String(P.colors[i] + 1);
    const fs = Math.min(maxFs, r * (num.length > 1 ? 0.95 : 1.25));
    const t = svgEl('text', { x: fmt(x), y: fmt(y), 'font-size': fmt(fs) });
    t.textContent = num;
    P.labels.append(t);
    P.labelEls[i] = { el: t, fs };
  });
  updateLabelVisibility();
}

function updateLabelVisibility() {
  if (!P.labelEls) return;
  for (const l of P.labelEls) if (l) l.el.classList.toggle('off', l.fs * P.s < LABEL_MIN_PX);
}

function buildPalette() {
  const pal = $('#palette');
  pal.replaceChildren();
  pal.classList.toggle('many', P.d.palette.length > 12);  // one scrolling row instead of many rows
  P.left = P.d.palette.map(() => 0);
  const used = P.d.palette.map(() => 0);
  P.colors.forEach((c, i) => { used[c]++; if (!P.filled.has(i)) P.left[c]++; });
  P.swatches = P.d.palette.map((color, ci) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (P.left[ci] === 0 ? ' done' : '');
    b.hidden = used[ci] === 0;
    b.style.background = color;
    b.style.color = inkFor(color);
    b.innerHTML = `<span>${ci + 1}</span>${CHECK_SVG}<i class="count">${P.left[ci]}</i>`;
    b.addEventListener('click', () => { if (P.left[ci] > 0) selectColor(ci); });
    b.addEventListener('animationend', () => b.classList.remove('hint'));
    pal.append(b);
    return b;
  });
}

function updateCount(ci) {
  P.swatches[ci].querySelector('.count').textContent = P.left[ci];
}

function nextColor(from) {
  const n = P.d.palette.length;
  for (let j = 1; j <= n; j++) {
    const c = (from + j + n) % n;
    if (P.left[c] > 0) return c;
  }
  return -1;
}

function selectColor(ci) {
  P.sel = ci;
  P.swatches.forEach((b, j) => b.classList.toggle('sel', j === ci));
  if (P.swatches[ci] && $('#palette').classList.contains('many')) {
    try { P.swatches[ci].scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) { /* old browser */ }
  }
  P.zones.forEach((z, i) => z.classList.toggle('hl', P.colors[i] === ci && !P.filled.has(i)));
  scheduleFindHint();
}

function updateProgress() {
  const bar = $('#progress');
  bar.firstElementChild.style.width = (100 * P.filled.size / P.zones.length) + '%';
  bar.classList.toggle('full', P.filled.size === P.zones.length);
}

function fillZone(i) {
  const ci = P.colors[i];
  P.filled.add(i);
  paint(P.zones[i], P.d.palette[ci]);
  if (P.labelEls[i]) { P.labelEls[i].el.remove(); P.labelEls[i] = null; }
  setProgress(P.profileId, P.d.key, [...P.filled]);
  vibrate(12);
  P.left[ci]--;
  updateCount(ci);
  updateProgress();
  scheduleFindHint();
  if (P.left[ci] === 0) {
    P.swatches[ci].classList.add('done');
    const next = nextColor(ci);
    if (next >= 0) selectColor(next); else finish(true);
  }
}

function finish(celebrate) {
  P.sel = -1;
  P.swatches.forEach((b) => b.classList.remove('sel'));
  P.zones.forEach((z) => z.classList.remove('hl'));
  updateFindHint();
  $('#bravo').hidden = false;
  if (celebrate) confetti(P.d.palette);
}

// Index of the unfilled zone drawn under a screen point, or -1.
function hitZone(clientX, clientY) {
  const hit = document.elementFromPoint(clientX, clientY);
  if (!hit || !hit.hasAttribute || !hit.hasAttribute('data-i') || !P.art.contains(hit)) return -1;
  const i = parseInt(hit.getAttribute('data-i'), 10);
  return P.filled.has(i) ? -1 : i;
}

function tapAt(clientX, clientY) {
  if (P.sel < 0) return;
  const hit = hitZone(clientX, clientY);
  if (hit >= 0 && P.colors[hit] === P.sel) return fillZone(hit);
  const i = nearZone(clientX - P.left0, clientY - P.top0, P.sel);
  if (i >= 0) return fillZone(i);
  // wrong number: show which colour that zone wants, without any penalty
  if (hit >= 0) P.swatches[P.colors[hit]].classList.add('hint');
}

function longPress() {
  if (!P || !gest || !gest.tap) return;
  gest.tap = false;  // lifting the finger afterwards must not fill anything
  let i = hitZone(gest.lx, gest.ly);
  if (i < 0) i = nearZone(gest.lx - P.left0, gest.ly - P.top0, -1);
  if (i < 0) return;
  selectColor(P.colors[i]);
  P.swatches[P.colors[i]].classList.add('hint');
  vibrate(25);
}

// Nearest unfilled zone of colour `want` (any colour when -1) within reach of a stage point.
function nearZone(sx, sy, want) {
  const { k, W, H, lab } = P.info;
  const [vx, vy] = P.d.vb;
  const px = ((sx - P.tx) / P.s - vx) * k, py = ((sy - P.ty) / P.s - vy) * k;
  const R = TAP_REACH_PX / P.s * k;
  let best = -1, bestD = R * R;
  for (let y = Math.max(0, Math.floor(py - R)); y <= Math.min(H - 1, Math.ceil(py + R)); y++) {
    for (let x = Math.max(0, Math.floor(px - R)); x <= Math.min(W - 1, Math.ceil(px + R)); x++) {
      const L = lab[y * W + x];
      if (!L) continue;
      const i = L - 1;
      if (P.filled.has(i) || (want >= 0 && P.colors[i] !== want)) continue;
      const dd = (x + 0.5 - px) ** 2 + (y + 0.5 - py) ** 2;
      if (dd <= bestD) { bestD = dd; best = i; }
    }
  }
  return best;
}

function findZone() {
  if (!P || P.sel < 0) return;
  const cx = (P.W / 2 - P.tx) / P.s, cy = (P.H / 2 - P.ty) / P.s;
  let bi = -1, bd = Infinity;
  P.zones.forEach((z, i) => {
    if (P.filled.has(i) || P.colors[i] !== P.sel) return;
    const p = P.info.pos[i];
    const dd = (p.x - cx) ** 2 + (p.y - cy) ** 2;
    if (dd < bd) { bd = dd; bi = i; }
  });
  if (bi < 0) return;
  const p = P.info.pos[bi];
  const fs = P.labelEls[bi] ? P.labelEls[bi].fs : p.r;
  const s = clamp(26 / fs, P.s, P.fit * MAX_ZOOM);
  animateView(s, P.W / 2 - p.x * s, P.H / 2 - p.y * s, () => {
    const ring = svgEl('circle', { cx: fmt(p.x), cy: fmt(p.y), r: fmt(Math.max(p.r, 14 / P.s)), class: 'ring' });
    P.marks.append(ring);
    setTimeout(() => ring.remove(), 1900);
  });
}

function animateView(s1, tx1, ty1, done) {
  cancelAnimationFrame(P.anim);
  if (testing.instant) { setView(s1, tx1, ty1); if (done) done(); return; }
  const s0 = P.s, tx0 = P.tx, ty0 = P.ty, t0 = performance.now(), dur = 380;
  const step = (now) => {
    if (!P) return;
    const t = Math.min(1, (now - t0) / dur);
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    setView(s0 + (s1 - s0) * e, tx0 + (tx1 - tx0) * e, ty0 + (ty1 - ty0) * e, t < 1);
    if (t < 1) P.anim = requestAnimationFrame(step); else if (done) done();
  };
  P.anim = requestAnimationFrame(step);
}

// Touch: one finger taps or drags, holding picks a colour, two fingers pinch. A wheel zooms on a computer.
const pointers = new Map();
let gest = null;

function pinchStart() {
  const [a, b] = [...pointers.values()];
  const mx = (a.x + b.x) / 2 - P.left0, my = (a.y + b.y) / 2 - P.top0;
  return { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: P.s, wx: (mx - P.tx) / P.s, wy: (my - P.ty) / P.s };
}

stage.addEventListener('pointerdown', (e) => {
  if (!P || e.target.closest('.bravo')) return;
  cancelAnimationFrame(P.anim);
  onStageResize();
  const r = stage.getBoundingClientRect();  // the stage can move without changing size
  P.left0 = r.left; P.top0 = r.top;
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer */ }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    gest = { tap: true, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, lx: e.clientX, ly: e.clientY, pinch: null,
      timer: setTimeout(longPress, LONG_PRESS_MS) };
  } else if (gest) {
    gest.tap = false;
    clearTimeout(gest.timer);
    gest.pinch = pinchStart();
  }
});

stage.addEventListener('pointermove', (e) => {
  if (!P || !gest || !pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 1) {
    if (gest.tap && Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > TAP_SLOP_PX) {
      gest.tap = false;
      clearTimeout(gest.timer);
    }
    if (!gest.tap) setView(P.s, P.tx + e.clientX - gest.lx, P.ty + e.clientY - gest.ly, true);
    gest.lx = e.clientX; gest.ly = e.clientY;
  } else if (gest.pinch) {
    const [a, b] = [...pointers.values()];
    const s = clamp(gest.pinch.s0 * Math.hypot(a.x - b.x, a.y - b.y) / gest.pinch.d0, P.fit, P.fit * MAX_ZOOM);
    const mx = (a.x + b.x) / 2 - P.left0, my = (a.y + b.y) / 2 - P.top0;
    setView(s, mx - gest.pinch.wx * s, my - gest.pinch.wy * s, true);
  }
});

function pointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!P || !gest) return;
  clearTimeout(gest.timer);
  if (pointers.size === 0) {
    drawView();
    if (gest.tap && e.type === 'pointerup' && e.timeStamp - gest.t0 < 700) tapAt(e.clientX, e.clientY);
    gest = null;
  } else if (pointers.size === 1) {
    const [a] = pointers.values();
    gest.pinch = null; gest.lx = a.x; gest.ly = a.y;
  } else {
    gest.pinch = pinchStart();
  }
}
stage.addEventListener('pointerup', pointerEnd);
stage.addEventListener('pointercancel', pointerEnd);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

stage.addEventListener('wheel', (e) => {
  if (!P) return;
  e.preventDefault();
  const s = clamp(P.s * Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), P.fit, P.fit * MAX_ZOOM);
  const mx = e.clientX - P.left0, my = e.clientY - P.top0;
  const wx = (mx - P.tx) / P.s, wy = (my - P.ty) / P.s;
  setView(s, mx - wx * s, my - wy * s, true);  // drawn again when the wheel rests
}, { passive: false });

// The drawing area changes size when the browser bars show or hide, or the phone turns:
// refit if the whole drawing was shown, else keep the same point in the middle.
function onStageResize() {
  if (!P) return;
  const r = stage.getBoundingClientRect();
  if (Math.abs(r.width - P.W) < 0.5 && Math.abs(r.height - P.H) < 0.5) return;
  const wasFit = P.s <= P.fit * 1.001;
  const cx = (P.W / 2 - P.tx) / P.s, cy = (P.H / 2 - P.ty) / P.s;
  measureStage();
  const [, , vw, vh] = P.d.vb;
  P.fit = Math.min(P.W / vw, P.H / vh) * 0.96;
  if (wasFit) fitView();
  else setView(P.s, P.W / 2 - cx * P.s, P.H / 2 - cy * P.s);
}
if (typeof ResizeObserver === 'function') new ResizeObserver(onStageResize).observe(stage);
addEventListener('resize', onStageResize);

let confettiRaf = 0;
function confetti(colors) {
  const c = $('#confetti');
  const ctx = c.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  c.hidden = false;
  const parts = Array.from({ length: 90 }, () => ({
    x: Math.random() * innerWidth, y: -20 - Math.random() * innerHeight * 0.6,
    vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
    a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.3,
    w: 7 + Math.random() * 6, color: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (now) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
      ctx.restore();
    }
    if (now - t0 < 3500) confettiRaf = requestAnimationFrame(frame); else stopConfetti();
  };
  confettiRaf = requestAnimationFrame(frame);
}
function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  $('#confetti').hidden = true;
}

async function share() {
  if (!P) return;
  try {
    await shareDrawing(P.d, P.filled);
  } catch (e) {
    console.error('share failed:', e);
  }
}

$('#back').addEventListener('click', () => onBack());
$('#bravo-back').addEventListener('click', () => onBack());
$('#find').addEventListener('click', findZone);
$('#paint-free').addEventListener('click', () => { if (P) onFree(P.d); });
$('#share').addEventListener('click', share);
$('#bravo-share').addEventListener('click', share);
$('#reset').addEventListener('click', async () => {
  if (!P) return;
  const { d, profileId } = P;
  if (!(await confirmDialog(t('Tout effacer et recommencer ce dessin ?'), t('Effacer')))) return;
  if (!P || P.d !== d) return;
  setProgress(profileId, d.key, []);
  openPlay(d, profileId, onBack, onFree);
});

// Hooks for the automated tests.
export const debug = {
  state: () => P, longPress, findZone, updateFindHint, selectColor, nextColor, finish, onStageResize, setView,
};
