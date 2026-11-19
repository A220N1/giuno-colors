// Little stars that twinkle along a rainbow stroke and fade away; they are not part of the drawing.
const LIFE_MS = 750;
const MAX_STARS = 140;

export function sparkler(canvas) {
  const ctx = canvas.getContext('2d');
  const stars = [];
  let raf = 0, dpr = 1;

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
    if (stars.length) raf = requestAnimationFrame(frame);
  }

  function clear() {
    stars.length = 0;
    cancelAnimationFrame(raf);
    raf = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  return { resize, emit, burst, clear, count: () => stars.length };
}
