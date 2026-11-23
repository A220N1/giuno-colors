// Little sounds made on the spot with the Web Audio API, so there is no sound file to download.
// The loudspeaker button of the gallery turns them off; the choice is kept on this device.
import { getSound, setSound } from './store.js';

let ctx = null, noise = null, rub = null, rubTimer = 0;

export const soundOn = () => getSound();
export function setSoundOn(on) {
  setSound(on);
  if (!on) rubStop();
}

// The audio output, once sounds are wanted and a touch has allowed them; null otherwise.
function audio() {
  if (!getSound()) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch (e) {
    return null;
  }
}

// A note gliding from f0 to f1 hertz.
function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(a) {
  if (!noise) {
    noise = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = a.createBufferSource();
  src.buffer = noise;
  return src;
}

// A short puff of noise around `freq` hertz.
function puff(dur, freq, vol) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime, src = hiss(a), f = a.createBiquadFilter(), g = a.createGain();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = 1.2;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const SOUNDS = {
  pop: () => tone(420, 880, 0.09, 0.14),
  click: () => { puff(0.03, 2600, 0.25); tone(1500, 900, 0.04, 0.06, 'square'); },
  unclick: () => { puff(0.04, 1400, 0.2); tone(500, 300, 0.07, 0.07, 'triangle'); },
  fill: () => tone(560, 330, 0.11, 0.12),
  splash: () => { puff(0.18, 900, 0.18); tone(300, 160, 0.16, 0.08); },
  tick: () => tone(700, 600, 0.04, 0.06, 'triangle'),
  nope: () => tone(220, 180, 0.12, 0.06, 'triangle'),
  chime: () => [880, 1320].forEach((f, i) => tone(f, f, 0.25, 0.08, 'sine', i * 0.09)),
  bravo: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.32, 0.1, 'triangle', i * 0.11)),
  boom: () => { puff(0.5, 500, 0.3); tone(160, 60, 0.4, 0.12); },
};

export function sfx(name) {
  try { if (SOUNDS[name]) SOUNDS[name](); } catch (e) { /* no sound is no harm */ }
}

// The rub of a brush or an eraser on the page while it moves: soft noise, louder the faster it goes,
// silent as soon as it stops.
export function rubStart(kind) {
  rubStop();
  const a = audio();
  if (!a) return;
  try {
    const src = hiss(a), f = a.createBiquadFilter(), g = a.createGain();
    src.loop = true;
    f.type = 'bandpass';
    f.frequency.value = kind === 'eraser' ? 3200 : 1500;
    f.Q.value = 0.8;
    g.gain.value = 0;
    src.connect(f).connect(g).connect(a.destination);
    src.start();
    rub = { src, g, a };
  } catch (e) { rub = null; }
}

export function rubMove(px) {
  if (!rub) return;
  rub.g.gain.setTargetAtTime(Math.min(0.05, px * 0.003), rub.a.currentTime, 0.03);
  clearTimeout(rubTimer);
  rubTimer = setTimeout(() => { if (rub) rub.g.gain.setTargetAtTime(0, rub.a.currentTime, 0.04); }, 70);
}

export function rubStop() {
  clearTimeout(rubTimer);
  if (!rub) return;
  try { rub.src.stop(); } catch (e) { /* already stopped */ }
  rub = null;
}
