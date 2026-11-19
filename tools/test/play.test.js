// Colouring screen: every drawing coloured to the end with simulated taps, at the window size run.py picked.
import { run, check, note, clearStorage, go, tap, hold } from './harness.js';

run(async () => {
  await clearStorage();
  localStorage.setItem('giuno.profiles', JSON.stringify([{ id: 'p1', name: 'Test', color: '#3088c4' }]));
  const { drawings } = await import('../js/drawings.js');
  const play = await import('../js/play.js');
  const { renderPng } = await import('../js/share.js');
  await import('../js/main.js');
  play.testing.instant = true;
  const stage = document.querySelector('#stage');
  check(drawings.length > 0, 'drawings are loaded');
  note(`${drawings.length} drawings at ${innerWidth} x ${innerHeight}`);
  let zonesTotal = 0, autoTotal = 0;

  for (const [n, d] of drawings.entries()) {
    const t0 = performance.now();
    await go(d.id);
    const P = play.debug.state();
    if (P && P.zones.length > 120) note(`${d.id}: ${P.zones.length} zones, opened in ${Math.round(performance.now() - t0)} ms`);
    if (!check(P && P.d === d, `${d.id}: colouring screen opens`)) continue;
    const sr = stage.getBoundingClientRect();
    const screen = (p) => [sr.left + P.tx + p.x * P.s, sr.top + P.ty + p.y * P.s];

    // the whole drawing fits between the top bar and the palette
    const [vx, vy, vw, vh] = d.vb;
    const left = P.tx + vx * P.s, top = P.ty + vy * P.s;
    check(left >= -0.5 && top >= -0.5 && left + vw * P.s <= sr.width + 0.5 && top + vh * P.s <= sr.height + 0.5,
      `${d.id}: whole drawing visible`);
    check(document.querySelector('#palette').getBoundingClientRect().top >= sr.bottom - 0.5, `${d.id}: palette below the drawing`);

    const auto = P.filled.size;
    zonesTotal += P.zones.length; autoTotal += auto;
    P.zones.forEach((z, i) => {
      if (!P.filled.has(i)) check(P.labelEls[i], `${d.id}: zone ${i} has a number`);
    });

    if (n === 0) {
      const hl = P.zones.find((z) => z.classList.contains('hl'));
      check(hl && getComputedStyle(hl).fill.startsWith('url('), `${d.id}: zones to colour show a checkerboard`);
      const pat = document.querySelector('#stage pattern');
      const w0 = parseFloat(pat.getAttribute('width'));
      play.debug.setView(P.s * 2, P.tx, P.ty);
      check(Math.abs(parseFloat(pat.getAttribute('width')) - w0 / 2) < w0 * 0.01, `${d.id}: checkerboard keeps its size on screen when zooming`);
      play.debug.setView(P.fit, 0, 0);
    }

    // the magnifier brings a zone of the chosen colour on screen with a readable number
    // (to the middle, unless the view cannot move further)
    document.querySelector('#find').click();
    const found = P.zones.some((z, i) => {
      if (P.filled.has(i) || P.colors[i] !== P.sel) return false;
      const [x, y] = screen(P.info.pos[i]);
      const shown = x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom;
      return shown && !P.labelEls[i].el.classList.contains('off') && P.labelEls[i].fs * P.s >= 20;
    });
    check(found, `${d.id}: magnifier shows a zone of colour ${P.sel + 1}`);

    // a zone of another colour: tapping does nothing, holding picks its colour
    const other = P.zones.findIndex((z, i) => !P.filled.has(i) && P.colors[i] !== P.sel);
    if (other >= 0) {
      const p = P.info.pos[other];
      const s = Math.min(P.fit * 10, Math.max(P.fit, 20 / p.r));
      play.debug.setView(s, P.W / 2 - p.x * s, P.H / 2 - p.y * s);
      const [x, y] = screen(p);
      tap(stage, x, y);
      check(!P.filled.has(other), `${d.id}: wrong colour leaves zone ${other} empty`);
      check(P.swatches[P.colors[other]].classList.contains('hint'), `${d.id}: wrong colour shakes the right swatch`);
      await hold(stage, x, y, 600);
      check(P.sel === P.colors[other], `${d.id}: holding zone ${other} picks colour ${P.colors[other] + 1}`);
    }

    // colour every zone like a child would: the app moves to the next colour on its own
    let taps = 0;
    while (P.sel >= 0 && taps <= P.zones.length) {
      const i = P.zones.findIndex((z, j) => !P.filled.has(j) && P.colors[j] === P.sel);
      if (!check(i >= 0, `${d.id}: colour ${P.sel + 1} still has a zone`)) break;
      const p = P.info.pos[i];
      const s = Math.min(P.fit * 10, Math.max(P.fit, 14 / p.r));
      play.debug.setView(s, P.W / 2 - p.x * s, P.H / 2 - p.y * s);
      const [x, y] = screen(p);
      check(x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom, `${d.id}: zone ${i} can be brought on screen`);
      const hit = document.elementFromPoint(x, y);
      check(hit && hit.getAttribute('data-i') === String(i), `${d.id}: number of zone ${i} sits on its zone`);
      tap(stage, x, y);
      taps++;
      if (!check(P.filled.has(i), `${d.id}: tap fills zone ${i}`)) break;
    }
    check(P.filled.size === P.zones.length, `${d.id}: every zone filled (${P.filled.size}/${P.zones.length})`);
    check(!document.querySelector('#bravo').hidden, `${d.id}: bravo shows`);
    const saved = JSON.parse(localStorage.getItem(`giuno.progress.p1.${d.key}`) || '[]');
    check(saved.length === P.zones.length, `${d.id}: progress saved`);

    if (n === 0) {
      document.querySelector('#reset').click();
      document.querySelector('#confirm-yes').click();
      await new Promise((r) => setTimeout(r, 0));
      const Q = play.debug.state();
      check(Q !== P && Q.filled.size === auto, `${d.id}: reset starts over`);
      check(JSON.parse(localStorage.getItem(`giuno.progress.p1.${d.key}`)).length === 0, `${d.id}: reset clears saved progress`);
    }
  }
  note(`${zonesTotal} zones, ${autoTotal} filled from the start`);

  // the last drawing as a PNG
  const P = play.debug.state();
  const blob = await renderPng(P.d, P.filled, 400);
  const img = await createImageBitmap(blob);
  check(blob.type === 'image/png' && img.width === 400 && img.height === Math.round(400 * P.d.vb[3] / P.d.vb[2]), 'PNG export');
});
