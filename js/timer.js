// The session timer of the grown-ups' corner: once the time is up, the app goes back to the start
// screen with a message. The end is kept on this device, so closing the app does not stop the clock.
import { $ } from './util.js';
import { getTimerEnd, setTimerEnd } from './store.js';
import { t } from './i18n.js';
import { toast } from './lock.js';
import { sfx } from './sound.js';

const STALE_MS = 60 * 60 * 1000;  // a timer that ran out longer ago than this, app closed, belongs to another day
let onTimeUp = () => {};
let warned = false;

function show() {
  const end = getTimerEnd();
  $('#timer-off').hidden = !end;
  $('#timer-left').hidden = !end;
  $('#timer-left').textContent = end ? t('Fin dans {n} min', { n: Math.max(1, Math.ceil((end - Date.now()) / 60000)) }) : '';
}

function tick() {
  const end = getTimerEnd();
  if (!end) return;
  const left = end - Date.now();
  if (left > 0) {
    if (left <= 60000 && !warned) { warned = true; toast(t('Encore une minute')); sfx('chime'); }
    show();
    return;
  }
  setTimerEnd(0);
  warned = false;
  show();
  if (-left > STALE_MS) return;
  onTimeUp();
  $('#timeup').hidden = false;
  sfx('chime');
}

// `timeUp` closes the session: it must lead back to the start screen.
export function startTimer(timeUp) {
  onTimeUp = timeUp;
  for (const b of document.querySelectorAll('#timer-row [data-min]')) {
    b.addEventListener('click', () => {
      setTimerEnd(Date.now() + Number(b.dataset.min) * 60000);
      warned = false;
      show();
      toast(t('Minuteur : {n} minutes', { n: b.dataset.min }));
    });
  }
  $('#timer-off').addEventListener('click', () => { setTimerEnd(0); show(); });
  $('#timeup-ok').addEventListener('click', () => { $('#timeup').hidden = true; });
  setInterval(tick, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
  show();
}
