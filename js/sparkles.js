// Little stars that twinkle along a rainbow stroke and fade away, the burst of a firework and snow
// falling from a shake: animations over the page, not part of the drawing.
import { drawFlake } from './nature.js';

const LIFE_MS = 750;
const MAX_STARS = 140;

export function sparkler(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];
  const effects = [];  // { t0, dur, draw(age), done() }
  let raf = 0, dpr = 1;

  function play(effect) {
    effects.push({ ...effect, t0: performance.now() });
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // Sparks flying out from (x, y) to about R pixels and falling a little, with a flash first.
  function firework(x, y, R, colours) {
    const sparks = Array.from({ length: 28 }, (_, i) => ({
      a: (i / 28) * Math.PI * 2 + Math.random() * 0.2, sp: 0.7 + Math.random() * 0.4, c: colours[i % colours.length],
    }));
    const at = (s, t) => {
      const e = 1 - (1 - t) ** 3;
      return [x + Math.sin(s.a) * R * s.sp * e, y - Math.cos(s.a) * R * s.sp * e + R * 0.3 * t * t];
    };
    play({
      dur: 950,
      draw(t) {
        if (t < 0.18) {
          ctx.globalAlpha = 1 - t / 0.18;
          ctx.fillStyle = '#fff8d6';
          ctx.beginPath(); ctx.arc(x, y, R * 0.35 * (0.3 + t / 0.18), 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = Math.min(1, (1 - t) * 2.5);
        ctx.lineCap = 'round';
        for (const s of sparks) {
          const [x0, y0] = at(s, Math.max(0, t - 0.12)), [x1, y1] = at(s, t);
          ctx.strokeStyle = s.c;
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(x1, y1, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      },
    });
  }

  // Flakes falling from above the page to their places; `place(x, y)` gives the screen point of a
  // page point and `scale()` the screen pixels of a page unit, read at each frame (the page may move).
  function rain(flakes, place, scale, done) {
    const delays = flakes.map(() => Math.random() * 0.35);
    play({
      dur: 1400,
      done,
      draw(t) {
        const s = scale();
        flakes.forEach((f, i) => {
          const u = Math.min(1, Math.max(0, (t - delays[i]) / 0.65));
          if (!u) return;
          const [sx, sy] = place(f.x, f.y - (f.y + 40) * (1 - u) ** 2);
          drawFlake(ctx, f, sx, sy, s);
        });
      },
    });
  }

  function resize(w, h) {
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }

  // One star near (x, y) in canvas CSS pixels, of the given hue (0 to 1).
  function emit(x, y, hue, spread = 10) {
    if (stars.length >= MAX_STARS) stars.shift();
    const a = Math.random() * Math.PI * 2, d = Math.random() * spread;
    stars.push({
      x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
      vx: (Math.random() - 0.5) * 0.04, vy: -0.015 - Math.random() * 0.03,
      r: 5 + Math.random() * 7, rot: Math.random() * Math.PI, spin: (Math.random() - 0.5) * 0.004,
      hue: ((hue + (Math.random() - 0.5) * 0.12) % 1 + 1) % 1, t0: performance.now(), life: LIFE_MS * (0.7 + Math.random() * 0.6),
    });
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function burst(x, y, hue, n = 16, spread = 40) {
    for (let i = 0; i < n; i++) emit(x, y, hue + i / n, spread);
  }

  function star(s, k) {
    const R = s.r * k, r = R * 0.34;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, q = i % 2 ? r : R;
      ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
    }
    ctx.closePath();
    ctx.fillStyle = `hsl(${Math.round(s.hue * 360)}, 95%, 68%)`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function frame(now) {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    for (let i = stars.length - 1; i >= 0; i--) {
      const s = stars[i], age = (now - s.t0) / s.life;
      if (age >= 1) { stars.splice(i, 1); continue; }
      const dt = now - (s.last || s.t0);
      s.last = now;
      s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.spin * dt;
      // grows fast, twinkles, then shrinks away
      const k = Math.sin(Math.PI * Math.min(1, age * 1.15)) * (0.85 + 0.15 * Math.sin(age * 30));
      ctx.globalAlpha = age < 0.7 ? 1 : (1 - age) / 0.3;
      star(s, Math.max(0, k));
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < effects.length; i++) {
      const fx = effects[i], age = (now - fx.t0) / fx.dur;
      if (age >= 1) {
        effects.splice(i--, 1);
        if (fx.done) fx.done();
        continue;
      }
      fx.draw(age);
    }
    if (stars.length || effects.length) raf = requestAnimationFrame(frame);
  }

  function clear() {
    stars.length = 0;
    for (const fx of effects.splice(0)) if (fx.done) fx.done();
    cancelAnimationFrame(raf);
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { resize, emit, burst, firework, rain, clear, count: () => stars.length, busy: () => effects.length > 0 };
}
