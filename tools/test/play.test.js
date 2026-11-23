// Colouring screen: every drawing coloured to the end with simulated taps, at the window size run.py picked.
import { run, check, note, clearStorage, go, tap, hold, sleep } from './harness.js';

run(async () => {
  await clearStorage();
  localStorage.setItem('giuno.profiles', JSON.stringify([{ id: 'p1', name: 'Test', color: '#3088c4' }]));
  const { drawings } = await import('../js/drawings.js');
  const play = await import('../js/play.js');
  const { renderPng } = await import('../js/share.js');
  await import('../js/main.js');
  play.testing.instant = true;
  play.testing.snap = false;  // gestures move the drawing itself, but where the gesture picture is tried below
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
    if (d.mystery) {
      await sleep(300);  // the zones turn grey in a short fade
      const deco = P.art.querySelector(':not(g):not([data-c])');
      const blank = P.zones.find((z, i) => !P.filled.has(i) && !z.classList.contains('hl'));
      check(P.svg.classList.contains('mystery') && (!deco || getComputedStyle(deco).visibility === 'hidden')
        && (!blank || getComputedStyle(blank).fill === 'rgb(222, 222, 222)'), `${d.id}: a mystery page shows nothing of its picture`);
    }
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

      // fingers only move and stretch the drawing as a picture; it is drawn again when they lift or rest
      const fire = (type, x, y, id = 1) => stage.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch',
        isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
      const drawnAt = () => P.world.getAttribute('transform');
      let before = drawnAt();
      const tx0 = P.tx, ty0 = P.ty, w1 = parseFloat(pat.getAttribute('width'));
      fire('pointerdown', cx, cy);
      fire('pointermove', cx + 30, cy + 20);
      fire('pointermove', cx + 60, cy + 40);
      check(drawnAt() === before && /translate/.test(P.svg.style.transform), `${d.id}: a drag moves the drawing as a picture`);
      fire('pointerup', cx + 60, cy + 40);
      check(!P.svg.style.transform && (P.tx !== tx0 || P.ty !== ty0)
        && drawnAt() === `matrix(${P.s} 0 0 ${P.s} ${P.tx} ${P.ty})`, `${d.id}: drawn again where the finger left it`);
      before = drawnAt();
      const s1 = P.s;
      fire('pointerdown', cx - 50, cy);
      fire('pointerdown', cx + 50, cy, 2);
      fire('pointermove', cx + 100, cy, 2);
      check(drawnAt() === before && /scale/.test(P.svg.style.transform) && parseFloat(pat.getAttribute('width')) === w1,
        `${d.id}: a pinch stretches the drawing without drawing it again`);
      await sleep(400);
      check(!P.svg.style.transform && drawnAt() !== before && Math.abs(P.s / s1 - 1.5) < 0.01
        && Math.abs(parseFloat(pat.getAttribute('width')) - w1 / 1.5) < w1 * 0.01, `${d.id}: fingers at rest, drawn again with its checkerboard`);
      fire('pointerup', cx + 100, cy, 2);
      fire('pointerup', cx - 50, cy);
      play.debug.setView(P.fit, 0, 0);
    }

    // the magnifier brings a zone of the chosen colour on screen with a readable number
    // (to the middle, unless the view cannot move further)
    document.querySelector('#find').click();
    const found = P.zones.some((z, i) => {
      if (P.filled.has(i) || P.colors[i] !== P.sel) return false;
      const [x, y] = screen(P.info.pos[i]);
      const shown = x >= sr.left && x <= sr.right && y >= sr.top && y <= sr.bottom;
      // 20 px, or as big as the maximum zoom (10 times the fitted view) allows on a small screen
      const want = Math.min(20, P.labelEls[i].fs * P.fit * 10 * 0.99);
      return shown && !P.labelEls[i].el.classList.contains('off') && P.labelEls[i].fs * P.s >= want;
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
    if (d.mystery) check(!P.svg.classList.contains('mystery'), `${d.id}: the mystery page shows once coloured`);
    if (n === 1) {
      // the gesture picture: once made, a drag moves it in place of the drawing, which comes back when the finger lifts
      await play.debug.makeSnap();
      const snap = document.querySelector('#stage canvas.snap');
      const fire2 = (type, x, y) => stage.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true,
        clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
      const mx = sr.left + sr.width / 2, my = sr.top + sr.height / 2;
      check(P.snap.ok && snap.width > 100, `${d.id}: a picture of the page is made for gestures (${snap.width} x ${snap.height})`);
      fire2('pointerdown', mx, my);
      fire2('pointermove', mx + 30, my + 20);
      fire2('pointermove', mx + 60, my + 40);
      check(snap.style.visibility === 'visible' && P.svg.style.visibility === 'hidden' && /translate/.test(snap.style.transform) && !P.svg.style.transform,
        `${d.id}: a drag moves the picture, the drawing is put aside`);
      // the picture lies where the drawing would: its top left corner at the same point of the screen
      const sb = snap.getBoundingClientRect();
      check(Math.abs(sb.left - (sr.left + P.tx + d.vb[0] * P.s)) < 0.6 && Math.abs(sb.top - (sr.top + P.ty + d.vb[1] * P.s)) < 0.6
        && Math.abs(sb.width - d.vb[2] * P.s) < 1.5, `${d.id}: the picture lies exactly where the drawing is`);
      fire2('pointerup', mx + 60, my + 40);
      check(snap.style.visibility === 'hidden' && P.svg.style.visibility === '', `${d.id}: the drawing is back when the finger lifts`);
      play.debug.setView(P.fit, 0, 0);
      // opened again, the page takes its numbers from this device, and maps its zones a moment later
      check(localStorage.getItem('giunocache.pos.' + d.key), `${d.id}: the places of the numbers are kept`);

      // fill styles: shaded, then glitter, then plain again; kept for the child
      const fillOf = () => getComputedStyle(P.zones[0]).fill;
      const flat = fillOf();
      document.querySelector('#fill-style').click();
      const shaded = fillOf();
      document.querySelector('#fill-style').click();
      const glitter = fillOf();
      check(!flat.startsWith('url(') && shaded.startsWith('url(') && glitter.startsWith('url(') && shaded !== glitter && P.style === 'glitter'
        && localStorage.getItem('giuno.fill.p1') === '"glitter"', `${d.id}: zones filled plain, shaded, then with glitter`);
      const png = await createImageBitmap(await renderPng(d, P.filled, 300, 'glitter'));
      check(png.width === 300, `${d.id}: PNG export with glitter`);
      document.querySelector('#fill-style').click();
      check(P.style === 'flat' && fillOf() === flat, `${d.id}: back to plain colours`);
    }
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
