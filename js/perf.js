// Fluidity meter, switched on in the grown-ups' corner: how smoothly the screen follows the fingers,
// and how long the heavy steps take. Shown at the top of the screen and shared as a text report, in
// French only: it is a tool for whoever works on the app. Off, it costs one test per measured step.
import { navlogText } from './navlog.js';
import { $ } from './util.js';
import { getPerf, setPerf } from './store.js';
import { shareFile } from './share.js';

const LATE = 1.5;        // a frame longer than this many refresh intervals means the screen skipped one
const AFTER_MS = 500;    // frames watched once the fingers lift, where the work done at the end shows
const MIN_FRAMES = 3;    // a gesture shorter than this has no smoothness to speak of
const KEEP = 4000;       // frame times kept per kind of gesture
const STUCK_MS = 60000;  // a gesture this long lost its last pointer event
const RATES = [30, 48, 60, 90, 120, 144];
const SCREENS = { gallery: 'galerie', profiles: 'profils', play: 'coloriage', draw: 'dessin libre' };

let on = false;
const details = {};       // screen id -> function telling what is on it (the drawing, the tool)
const kinds = new Map();  // kind of gesture -> its frames
const steps = new Map();  // step -> its times
let recent = [];          // frame times of the last gestures, for the refresh rate
let hz = 0;
let g = null;             // the gesture under way
let lastGesture = null, lastStep = null;

const ms = (v) => `${Math.round(v)} ms`;
export const count = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// What screen `id` shows, added to the name of the gestures made on it.
export function perfScene(id, detail) { details[id] = detail; }

export const perfStart = () => (on ? performance.now() : 0);

// The time since perfStart() for `step`; `info` (text, or a function giving it) says what it was done on.
export function perfStop(step, t0, info) {
  if (!on || !t0) return;
  const time = performance.now() - t0, text = (typeof info === 'function' ? info() : info) || '';
  let s = steps.get(step);
  if (!s) steps.set(step, s = { n: 0, total: 0, max: 0, maxInfo: '', last: 0, lastInfo: '' });
  s.n++; s.total += time; s.last = time; s.lastInfo = text;
  if (time >= s.max) { s.max = time; s.maxInfo = text; }
  lastStep = { step, time, info: text };
  if (!g) show();
}

export function timed(step, fn, info) {
  const t0 = perfStart();
  try { return fn(); } finally { perfStop(step, t0, info); }
}

function scene() {
  const s = document.querySelector('.screen:not([hidden])');
  const id = s ? s.id : '';
  const detail = details[id] ? details[id]() : '';
  return [SCREENS[id] || id || '?', detail].filter(Boolean).join(' ');
}

// A gesture runs from the first finger down to the last one up, then AFTER_MS more.
function down(e) {
  if (g && g.up) finish();
  if (!g) {
    g = { scene: scene(), ids: new Set(), most: 0, x: e.clientX, y: e.clientY, moved: false,
      during: [], after: [], t0: performance.now(), up: 0, last: 0, raf: 0 };
    g.raf = requestAnimationFrame(frame);
  }
  g.ids.add(e.pointerId);
  g.most = Math.max(g.most, g.ids.size);
}

function move(e) {
  if (g && !g.moved && g.ids.has(e.pointerId) && Math.hypot(e.clientX - g.x, e.clientY - g.y) > 10) g.moved = true;
}

function up(e) {
  if (!g || g.up || !g.ids.delete(e.pointerId) || g.ids.size) return;
  g.up = performance.now();
}

function frame(now) {
  if (!g) return;
  if (now - g.t0 > STUCK_MS) { drop(); return; }
  if (g.last) (g.up ? g.after : g.during).push(now - g.last);
  g.last = now;
  if (g.up && now - g.up >= AFTER_MS) finish(); else g.raf = requestAnimationFrame(frame);
}

function drop() {
  if (g) cancelAnimationFrame(g.raf);
  g = null;
}

function finish() {
  const r = g;
  drop();
  const kind = r.most >= 2 ? 'deux doigts' : r.moved ? 'un doigt' : 'appui';
  const label = `${r.scene}, ${kind}`;
  let k = kinds.get(label);
  if (!k) kinds.set(label, k = { n: 0, frames: [], count: 0, total: 0, late: 0, worst: 0, after: [] });
  const res = { label, after: Math.max(0, ...r.after) };
  if (kind !== 'appui' && r.during.length >= MIN_FRAMES) {
    recent = recent.concat(r.during).slice(-KEEP);
    hz = refreshRate();
    const sum = r.during.reduce((a, b) => a + b, 0);
    res.fps = r.during.length * 1000 / sum;
    res.late = r.during.filter((d) => d > LATE * 1000 / hz).length / r.during.length;
    res.worst = Math.max(...r.during);
    k.frames = k.frames.concat(r.during).slice(-KEEP);
    k.count += r.during.length; k.total += sum; k.late += res.late * r.during.length;
    k.worst = Math.max(k.worst, res.worst);
  }
  k.n++;
  k.after.push(res.after);
  lastGesture = res;
  show();
}

// The screen's rate: most frames of a gesture come on time, so a fast tenth of them gives it.
function refreshRate() {
  const raw = 1000 / pct(recent, 0.1);
  return RATES.reduce((best, r) => (Math.abs(r - raw) < Math.abs(best - raw) ? r : best));
}

function pct(list, p) {
  if (!list.length) return 0;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
}

function show() {
  $('#perf-on').hidden = on;
  $('#perf-off').hidden = $('#perf-share').hidden = !on;
  const hud = $('#perf');
  hud.hidden = !on;
  if (!on) return;
  const lines = [(hz ? `${hz} Hz` : '? Hz') + (lastGesture ? ` · ${lastGesture.label}` : '')];
  if (lastGesture) {
    const end = `lâcher ${ms(lastGesture.after)}`;
    const { fps, late, worst } = lastGesture;
    lines.push(fps == null ? end : `${Math.round(fps)} i/s · ${Math.round(100 * late)} % en retard · pire ${ms(worst)} · ${end}`);
  }
  if (lastStep) lines.push(`${lastStep.step} ${ms(lastStep.time)}${lastStep.info ? ` (${lastStep.info})` : ''}`);
  hud.textContent = lines.join('\n');
}

export function perfReport() {
  const build = $('#build') ? $('#build').textContent : '';
  const installed = matchMedia('(display-mode: standalone)').matches;
  const lines = [
    `Giuno Colors ${build}, mesures du ${new Date().toLocaleString('fr-FR')}`,
    `Navigateur : ${navigator.userAgent}`,
    `Écran : ${innerWidth} x ${innerHeight} points, densité ${devicePixelRatio}, ${hz || '?'} Hz, ${installed ? 'appli installée' : 'onglet du navigateur'}`,
    '',
    'Gestes : nombre ; images par seconde ; images en retard ; image médiane, 95 %, pire ; au lâcher, médiane et pire',
  ];
  for (const [label, k] of kinds) {
    const moving = k.count
      ? `${Math.round(k.count * 1000 / k.total)} i/s ; ${Math.round(100 * k.late / k.count)} % ; ${ms(pct(k.frames, 0.5))}, ${ms(pct(k.frames, 0.95))}, ${ms(k.worst)}`
      : '- ; - ; -';
    lines.push(`${label} : ${k.n} ; ${moving} ; ${ms(pct(k.after, 0.5))}, ${ms(Math.max(...k.after))}`);
  }
  lines.push('', 'Étapes : nombre ; moyenne ; plus longue ; dernière');
  for (const [step, s] of steps) {
    lines.push(`${step} : ${s.n} ; ${ms(s.total / s.n)} ; ${ms(s.max)}${s.maxInfo ? ` (${s.maxInfo})` : ''} ; ${ms(s.last)}${s.lastInfo ? ` (${s.lastInfo})` : ''}`);
  }
  lines.push('', 'Navigation (bouton retour) :', navlogText());
  return lines.join('\n') + '\n';
}

const LISTEN = [['pointerdown', down], ['pointermove', move], ['pointerup', up], ['pointercancel', up]];
const OPTS = { capture: true, passive: true };

// Switching on starts a fresh set of measurements.
export function setPerfOn(v) {
  on = Boolean(v);
  setPerf(on);
  drop();
  for (const [type, fn] of LISTEN) {
    if (on) addEventListener(type, fn, OPTS); else removeEventListener(type, fn, OPTS);
  }
  if (on) { kinds.clear(); steps.clear(); recent = []; hz = 0; lastGesture = lastStep = null; }
  show();
}

async function sharePerf() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '');
  const blob = new Blob([perfReport()], { type: 'text/plain' });
  await shareFile(blob, `giuno-mesures-${stamp}.txt`, 'Giuno Colors', 'text/plain');
}

$('#perf-on').addEventListener('click', () => setPerfOn(true));
$('#perf-off').addEventListener('click', () => setPerfOn(false));
$('#perf-share').addEventListener('click', () => sharePerf().catch((e) => console.error('report not shared:', e)));
// frames stop while the app is hidden: the gap would read as one huge frame
document.addEventListener('visibilitychange', () => { if (document.hidden) drop(); });
setPerfOn(getPerf());
