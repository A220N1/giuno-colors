// Minimal test kit for the browser tests: checks, notes, simulated touches, and the report run.py waits for.

let checks = 0;
const failures = [];
const notes = [];
let reported = false;

export function check(ok, what) {
  checks++;
  if (!ok) failures.push(what);
  return ok;
}

export function note(text) { notes.push(text); }

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const frames = (n = 2) => new Promise((r) => {
  const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
  requestAnimationFrame(step);
});

// Wipe what earlier runs left in this browser profile, before the app reads any of it.
export async function clearStorage() {
  localStorage.clear();
  await new Promise((r) => {
    const q = indexedDB.deleteDatabase('giuno');
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });
}

export async function go(hash) {
  if (location.hash.slice(1) !== hash) {
    const changed = new Promise((r) => addEventListener('hashchange', r, { once: true }));
    location.hash = hash;
    await changed;
  }
  await frames();
}

export async function waitFor(cond, what, ms = 3000) {
  const t0 = performance.now();
  while (!cond()) {
    if (performance.now() - t0 > ms) throw new Error('timed out waiting for ' + what);
    await sleep(20);
  }
}

function pointer(target, type, x, y, id) {
  target.dispatchEvent(new PointerEvent(type, {
    pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y,
    bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));
}

export function tap(target, x, y, id = 1) {
  pointer(target, 'pointerdown', x, y, id);
  pointer(target, 'pointerup', x, y, id);
}

export async function hold(target, x, y, ms) {
  pointer(target, 'pointerdown', x, y, 1);
  await sleep(ms);
  pointer(target, 'pointerup', x, y, 1);
}

// A finger moving through the given client points, one move per point.
export function drag(target, points, id = 1) {
  const [first, ...rest] = points;
  pointer(target, 'pointerdown', first[0], first[1], id);
  for (const [x, y] of rest) pointer(target, 'pointermove', x, y, id);
  const [lx, ly] = points[points.length - 1];
  pointer(target, 'pointerup', lx, ly, id);
}

function report() {
  if (reported) return;
  reported = true;
  const body = JSON.stringify({ checks, failures, log: notes });
  fetch('__result', { method: 'POST', body }).catch((e) => console.error('report failed', e));
}

addEventListener('error', (e) => { failures.push('uncaught: ' + e.message); });
addEventListener('unhandledrejection', (e) => { failures.push('unhandled rejection: ' + (e.reason && e.reason.stack || e.reason)); });

export async function run(test) {
  try {
    await test();
  } catch (e) {
    failures.push('exception: ' + (e && e.message) + '\n' + (e && e.stack || e));
  }
  await sleep(500);  // let transitions end before the screenshot
  report();
}
