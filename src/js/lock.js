// The padlock of the colouring and drawing screens: once locked, the buttons that leave the drawing
// hide and the phone's Back does nothing, until someone holds the padlock for two seconds.
// Back is held by an extra history entry at the same address, put back each time it is used.
import { $, vibrate } from './util.js';
import { t } from './i18n.js';

const HOLD_MS = 2000;
const TOAST_MS = 2200;

let locked = false;
let unlocking = false;  // waiting for the guard entry to go before showing the buttons again
let toastTimer = 0;

export const isLocked = () => locked;

function render() {
  document.body.classList.toggle('locked', locked);
  for (const b of document.querySelectorAll('.lock')) {
    b.setAttribute('aria-label', t(locked ? 'Déverrouiller : garder le doigt appuyé' : "Verrouiller l'écran"));
    b.setAttribute('aria-pressed', String(locked));
  }
}

function lock() {
  if (locked) return;
  locked = true;
  history.pushState({ lock: true }, '');
  render();
  vibrate(20);
}

function unlock() {
  if (!locked || unlocking) return;
  vibrate(40);
  if (history.state && history.state.lock) {
    unlocking = true;
    history.back();
  } else {
    locked = false;
    render();
  }
}

// Called when the screen changes: a new screen always starts unlocked.
export function resetLock() {
  locked = unlocking = false;
  render();
}

function toast(text) {
  const box = $('#toast');
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, TOAST_MS);
}

function nudge() {
  for (const b of document.querySelectorAll('.lock')) {
    b.classList.remove('nudge');
    void b.offsetWidth;  // restart the animation
    b.classList.add('nudge');
  }
  toast(t('Garde le doigt sur le cadenas pour ouvrir'));
}

addEventListener('popstate', () => {
  if (unlocking) {
    unlocking = false;
    locked = false;
    render();
  } else if (locked) {
    history.pushState({ lock: true }, '');
    nudge();
  }
});

// A reload while locked leaves the guard entry on top: drop it.
if (history.state && history.state.lock) history.back();

for (const b of document.querySelectorAll('.lock')) {
  let timer = 0, held = false;
  const stop = () => { clearTimeout(timer); b.classList.remove('holding'); };
  b.addEventListener('pointerdown', () => {
    held = false;
    if (!locked) return;
    b.classList.add('holding');
    timer = setTimeout(() => { held = true; stop(); unlock(); }, HOLD_MS);
  });
  b.addEventListener('pointerup', () => {
    if (locked && !held && b.classList.contains('holding')) nudge();
    stop();
  });
  b.addEventListener('pointercancel', stop);
  b.addEventListener('pointerleave', stop);
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (held) { held = false; return; }  // the release that ended an unlock
    if (!locked) lock();
  });
}
render();

export const debug = { lock, unlock, HOLD_MS };
