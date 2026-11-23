// Free drawing: brush, shapes, paint bucket, eraser, undo and redo, saving in the gallery, sharing, deleting,
// the rainbow colour with its stars, and the padlock.
import { run, check, note, clearStorage, frames, sleep, tap, hold, drag, waitFor } from './harness.js';

const hex = (d) => '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
const pixel = (canvas, x, y) => hex(canvas.getContext('2d').getImageData(x, y, 1, 1).data);
const $ = (sel) => document.querySelector(sel);

run(async () => {
  await clearStorage();
  localStorage.setItem('giuno.profiles', JSON.stringify([{ id: 'p1', name: 'Test', color: '#3088c4' }]));
  const draw = await import('../js/draw.js');
  const art = await import('../js/art.js');
  const store = await import('../js/artstore.js');
  const { canvasPng } = await import('../js/share.js');
  // the app starts inside a colouring page, as when the phone brings it back after closing it:
  // Back must lead to the gallery, not out of the app
  history.replaceState(null, '', '#01_poisson');
  await import('../js/main.js');
  await frames();
  check(!$('#play').hidden && history.state && history.state.base, 'started inside a colouring page');
  document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));  // a first touch of the screen
  await sleep(60);
  check(history.state && history.state.pushed, 'the first touch readies the Back button');
  history.back();
  await waitFor(() => !$('#gallery').hidden, 'gallery after Back from a page the app started in');
  check(location.hash === '' && history.state && history.state.pushed, 'Back from there shows the gallery, ready for the next Back');
  history.back();
  await sleep(250);
  check(!$('#gallery').hidden && history.state && history.state.pushed, 'with one child, Back from the gallery stays in the app');

  const stage = $('#draw-stage');
  const flat = () => art.renderFlat(draw.debug.state().ops, art.PAGE_W);  // one pixel per page unit
  const at = (x, y) => draw.debug.toClient(x, y);
  const ring = (cx, cy, r, n = 120) => Array.from({ length: n + 1 }, (_, i) =>
    at(cx + r * Math.cos(2 * Math.PI * i / n), cy + r * Math.sin(2 * Math.PI * i / n)));
  const segment = (x0, y0, x1, y1, n = 60) => Array.from({ length: n + 1 }, (_, i) =>
    at(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n));
  const pickTool = (k) => $(`#draw .tool[data-tool="${k}"]`).click();
  const pickShape = (k) => { pickTool('shape'); $(`#draw-pop [data-shape="${k}"]`).click(); };
  const pickColor = (c) => $(`#draw-colors [data-color="${c}"]`).click();
  const bucket = (c, x, y) => { pickTool('bucket'); pickColor(c); tap(stage, ...at(x, y)); };
  const [BLACK, , BROWN, RED, , YELLOW, , GREEN, WHITE, , , , , BLUE, SKY] = art.COLORS;
  const opened = () => !$('#draw').hidden && draw.debug.state() && !draw.debug.state().loading;
  const inGallery = () => !$('#gallery').hidden;

  // an empty page left at once is not kept
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const sr = stage.getBoundingClientRect(), pr = $('.sheet .paper').getBoundingClientRect();
  check(pr.left >= sr.left - 0.5 && pr.right <= sr.right + 0.5 && pr.top >= sr.top - 0.5 && pr.bottom <= sr.bottom + 0.5 && pr.width > 100,
    `page fits on screen (${Math.round(pr.width)} x ${Math.round(pr.height)})`);
  check(Math.abs(pr.width / pr.height - art.PAGE_W / art.PAGE_H) < 0.01, 'page keeps its proportions');
  check($('.tools').getBoundingClientRect().top >= sr.bottom - 0.5, 'tools below the page');
  check($('#undo').disabled && $('#redo').disabled, 'nothing to undo on a new page');
  $('#draw-back').click();
  await waitFor(inGallery, 'gallery');
  await sleep(100);
  check(!document.querySelector('#cards .art-card') && (await store.listArt('p1')).length === 0, 'empty page not saved');

  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const A = draw.debug.state();
  check(draw.debug.tool.kind === 'brush', 'brush selected at first');

  pickColor(BLACK);
  drag(stage, ring(400, 300, 150));
  check(A.ops.length === 1 && A.ops[0].t === 'line' && A.ops[0].c === BLACK, 'brush stroke recorded');
  note(`circle: ${A.ops[0].p.length / 2} points kept out of 121 moves`);

  pickTool('shape');
  check(!$('#draw-pop').hidden, 'shape menu opens');
  $('#draw-pop [data-shape="square"]').click();
  check($('#draw-pop').hidden && draw.debug.tool.shape === 'square', 'square picked');
  drag(stage, segment(100, 600, 350, 900, 10));
  const sq = A.ops[1];
  check(sq && sq.t === 'shape' && sq.k === 'square' && Math.abs(sq.b[0] - 100) <= 1 && Math.abs(sq.b[2] - 250) <= 2 && Math.abs(sq.b[3] - 300) <= 2,
    'square sized by the drag');
  pickShape('star');
  tap(stage, ...at(620, 750));
  check(A.ops[2] && A.ops[2].k === 'star' && A.ops[2].b[2] === 180, 'a tap drops a star');

  pickTool('bucket');
  pickColor(RED);
  check(draw.debug.tool.kind === 'bucket', 'picking a colour keeps the bucket');
  const t0 = performance.now();
  tap(stage, ...at(400, 300));
  note(`bucket fill: ${Math.round(performance.now() - t0)} ms`);
  check(A.ops.length === 4 && A.ops[3].t === 'fill', 'bucket adds a fill');
  let img = flat();
  check(pixel(img, 400, 300) === RED, 'inside the circle is red');
  check(pixel(img, 400, 300 + 175) === WHITE, 'outside the circle stays white');

  bucket(BLUE, 225, 750);
  bucket(YELLOW, 620, 750);
  bucket(SKY, 20, 20);
  img = flat();
  check(pixel(img, 225, 750) === BLUE, 'square is blue');
  check(pixel(img, 620, 750) === YELLOW, 'star is yellow');
  check(pixel(img, 780, 980) === SKY && pixel(img, 400, 300) === RED, 'background is sky blue, circle still red');
  // no white seam along the circle between the red fill, the line and the sky
  const seam = [];
  for (let r = 120; r <= 180; r++) {
    for (const a of [0, Math.PI / 3, 2, 4]) {
      const c = pixel(img, Math.round(400 + r * Math.cos(a)), Math.round(300 + r * Math.sin(a)));
      if (c === WHITE) seam.push(r);
    }
  }
  check(seam.length === 0, `no white seam around the circle (${seam.length} white pixels)`);
  // the innermost pixel of the circle's line at the top, so the nearest free side is inside
  let onLine = 150;
  for (let y = 135; y <= 170; y++) if (pixel(img, 400, y) === BLACK) onLine = y;
  tap(stage, ...at(400, onLine));
  check(A.ops.length === 8 && A.ops[7].t === 'fill', 'a tap on a line fills the nearest side');

  pickTool('eraser');
  drag(stage, segment(250, 300, 550, 300));
  img = flat();
  check(pixel(img, 400, 300) === WHITE, 'eraser clears the fill');
  check(pixel(img, 400, 250) === SKY, 'eraser leaves the rest');
  $('#undo').click();
  check(pixel(flat(), 400, 300) === SKY, 'undo brings it back');
  $('#redo').click();
  check(pixel(flat(), 400, 300) === WHITE, 'redo erases again');
  $('#undo').click();
  check(!$('#redo').disabled, 'redo available after undo');
  pickColor(GREEN);
  check(draw.debug.tool.kind === 'brush', 'a colour after the eraser goes back to the brush');
  $('#size').click();
  check($('#draw-pop').querySelectorAll('[data-size]').length === art.SIZES.length && art.SIZES.length === 5, 'five line sizes');
  $('#draw-pop [data-size="3"]').click();
  drag(stage, segment(30, 960, 770, 960));
  check(A.ops[A.ops.length - 1].w === art.SIZES[3], 'thick brush');
  check($('#redo').disabled, 'a new stroke clears redo');

  const n = A.ops.length;
  $('#draw-back').click();
  await waitFor(() => document.querySelectorAll('#cards .art-card').length === 1, 'drawing card in the gallery');
  const rec = (await store.listArt('p1'))[0];
  check(rec && rec.ops.length === n && rec.profile === 'p1', 'saved with all its operations');
  $('#cards .art-card').click();
  await waitFor(() => opened() && draw.debug.state().ops.length === n, 'drawing reopened');
  check(draw.debug.state() !== A && !$('#undo').disabled, 'reopened from storage, undo still possible');

  const png = await canvasPng(art.renderFlat(draw.debug.state().ops, 1200));
  const bmp = await createImageBitmap(png);
  check(png.type === 'image/png' && bmp.width === 1200 && bmp.height === 1500, 'PNG export 1200 x 1500');

  $('#draw-delete').click();
  await sleep(0);
  check(!$('#confirm').hidden, 'deleting asks first');
  $('#confirm-yes').click();
  await waitFor(inGallery, 'gallery after deleting');
  await sleep(100);
  check(!document.querySelector('#cards .art-card') && (await store.listArt('p1')).length === 0, 'drawing deleted');

  // rainbow: pastel hues turning along the stroke, stars while drawing, a rainbow fill
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const R = draw.debug.state();
  pickColor(art.RAINBOW);
  check(draw.debug.tool.color === art.RAINBOW && $('#draw-colors [data-color="rainbow"]').classList.contains('sel'), 'rainbow picked');
  $('#size').click();
  $('#draw-pop [data-size="2"]').click();
  drag(stage, segment(60, 200, 740, 200, 80));
  check(draw.debug.sparkles.count() > 10, `stars along the rainbow stroke (${draw.debug.sparkles.count()})`);
  check(R.ops.length === 1 && R.ops[0].c === art.RAINBOW, 'rainbow stroke recorded');
  img = flat();
  const hues = [80, 400, 720].map((x) => pixel(img, x, 200));
  const pastel = (c) => [1, 3, 5].every((i) => parseInt(c.slice(i, i + 2), 16) >= 0x70) && c !== WHITE;
  check(new Set(hues).size === 3 && hues.every(pastel), `pastel hues changing along the stroke (${hues.join(' ')})`);
  pickTool('bucket');
  tap(stage, ...at(400, 600));
  img = flat();
  const g1 = pixel(img, 30, 400), g2 = pixel(img, 770, 970);
  check(R.ops[1] && R.ops[1].t === 'fill' && R.ops[1].c === art.RAINBOW && pastel(g1) && pastel(g2) && g1 !== g2,
    `rainbow fill (${g1} to ${g2})`);
  await sleep(1300);
  check(draw.debug.sparkles.count() === 0, 'the stars fade away');

  // padlock: the exits hide, Back stays on the drawing, holding the padlock unlocks
  const lockBtn = $('#draw .lock');
  const shownEl = (sel) => getComputedStyle($(sel)).display !== 'none';
  lockBtn.click();
  check(document.body.classList.contains('locked') && !shownEl('#draw-back') && !shownEl('#draw-delete') && !shownEl('#draw-share'),
    'locked: back, share and delete hidden');
  check(shownEl('#undo') && history.state && history.state.lock, 'locked: undo still there, Back held by a history entry');
  history.back();
  await sleep(300);
  check(!$('#draw').hidden && draw.debug.state() === R && document.body.classList.contains('locked'), 'Back while locked stays on the drawing');
  check(!$('#toast').hidden, 'Back while locked says how to unlock');
  const lr = lockBtn.getBoundingClientRect(), lx = lr.left + lr.width / 2, ly = lr.top + lr.height / 2;
  await hold(lockBtn, lx, ly, 600);
  await sleep(100);
  check(document.body.classList.contains('locked'), 'a short press does not unlock');
  await hold(lockBtn, lx, ly, 1500);
  await sleep(300);
  check(!document.body.classList.contains('locked') && shownEl('#draw-back'), 'holding the padlock a little over a second unlocks');
  check(history.state && !history.state.lock && history.state.pushed, 'history back to the drawing entry');
  $('#draw-back').click();
  await waitFor(inGallery, 'gallery after unlocking');

  // mirror: what is drawn on one side shows on the other, the bucket fills both, undo takes both back
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const M = draw.debug.state();
  $('#mirror').click();
  check(!$('#draw-pop').hidden && $('#draw-pop').querySelectorAll('[data-mirror]').length === 4, 'mirror menu with four modes');
  $('#draw-pop [data-mirror="2"]').click();
  check(draw.debug.tool.mirror === 2 && $('.sheet .guides line'), 'left and right mirror on, its axis shown');
  $('#size').click();
  $('#draw-pop [data-size="1"]').click();
  pickTool('brush');
  pickColor(BLACK);
  drag(stage, ring(200, 400, 100));
  check(M.ops[0].m === 2, 'stroke recorded with its mirror');
  img = flat();
  let left = 0, both = 0;
  for (let x = 0; x < 400; x++) if (pixel(img, x, 400) === BLACK) { left++; if (pixel(img, 799 - x, 400) === BLACK) both++; }
  check(left > 10 && both >= left - 2, `the circle on the left is drawn on the right too (${both} of ${left})`);
  bucket(RED, 200, 400);
  img = flat();
  check(pixel(img, 200, 400) === RED && pixel(img, 600, 400) === RED && pixel(img, 400, 400) === WHITE, 'the bucket fills both circles');
  $('#undo').click();
  check(pixel(flat(), 600, 400) === WHITE && pixel(flat(), 200, 400) === WHITE, 'undo takes both fills back');
  $('#mirror').click();
  $('#draw-pop [data-mirror="6"]').click();
  pickTool('brush');
  pickColor(BLACK);
  drag(stage, segment(400, 300, 400, 150, 20));
  check(M.ops[M.ops.length - 1].m === 6 && $('.sheet .guides').children.length === 3, 'kaleidoscope stroke, three axes shown');
  img = flat();
  // the point 250 above the middle, turned 120 degrees round it
  check(pixel(img, 400, 250) === BLACK && pixel(img, 617, 625) === BLACK && pixel(img, 183, 625) === BLACK, 'kaleidoscope copies');
  $('#mirror').click();
  $('#draw-pop [data-mirror="1"]').click();
  check(draw.debug.tool.mirror === 1 && !$('.sheet .guides').children.length, 'mirror off');
  $('#draw-back').click();
  await waitFor(inGallery, 'gallery after the mirror');

  // kinds of brush: each one draws and is recorded; a closed pencil line still holds the paint bucket
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const K = draw.debug.state();
  const pickBrush = (k) => {
    if (draw.debug.tool.kind !== 'brush') pickTool('brush');
    pickTool('brush');  // a second tap opens the menu
    $(`#draw-pop [data-brush="${k}"]`).click();
  };
  pickColor(BLACK);
  art.BRUSHES.forEach((k, i) => {
    pickBrush(k);
    drag(stage, segment(100, 60 + 50 * i, 300, 60 + 50 * i, 30));
    const op = K.ops[K.ops.length - 1];
    const im = flat();
    let inked = 0;
    for (let x = 100; x <= 300; x++) for (let dy = -8; dy <= 8; dy += 4) if (pixel(im, x, 60 + 50 * i + dy) !== WHITE) inked++;
    check(op.t === 'line' && (op.k || 'marker') === k && inked > 40, `${k} draws (${inked} inked pixels)`);
    if (k === 'bubbles') check(draw.debug.sparkles.floating() >= 2, `bubbles fly off the stroke (${draw.debug.sparkles.floating()})`);
  });
  pickBrush('pastel');
  drag(stage, ring(600, 600, 120));
  bucket(RED, 600, 600);
  img = flat();
  check(pixel(img, 600, 600) === RED && pixel(img, 600, 780) !== RED && pixel(img, 420, 600) !== RED, 'a closed pastel line holds the bucket');

  // stickers: a tap drops one of the chosen size, a drag sizes it
  const pop = $('#draw-pop');
  const stampCount = () => pop.querySelectorAll('[data-stamp]').length;
  const pickStamp = (k, tab) => { pickTool('stamp'); if (tab) pop.querySelector(`[data-tab="${tab}"]`).click(); pop.querySelector(`[data-stamp="${k}"]`).click(); };
  pickTool('stamp');
  check(stampCount() === 35 && pop.querySelectorAll('[data-tab]').length === 3 && pop.querySelector('[data-tab="draw"].sel'),
    'sticker menu, first of three pages: 6 clouds and grass, 2 fireworks, 27 emojis');
  pop.querySelector('[data-tab="animals"]').click();
  check(stampCount() === 15 && !pop.hidden, 'second page: 15 animals');
  pop.querySelector('[data-tab="xmas"]').click();
  check(stampCount() === 36, 'third page: 36 Christmas stickers');
  const xmas = [...pop.querySelectorAll('[data-stamp] img')];
  await Promise.all(xmas.map((i) => i.decode().catch(() => {})));
  const broken = xmas.filter((i) => !i.naturalWidth).map((i) => i.parentNode.dataset.stamp);
  check(xmas.length === 36 && !broken.length, `every Christmas sticker has its picture${broken.length ? ' (missing: ' + broken.join(' ') + ')' : ''}`);
  const tabsY = pop.querySelector('.tabs').getBoundingClientRect().bottom;
  pop.querySelector('[data-tab="animals"]').click();
  check(Math.abs(pop.querySelector('.tabs').getBoundingClientRect().bottom - tabsY) < 1, 'the tabs stay put from one page to the next');
  pop.querySelector('[data-tab="xmas"]').click();
  pop.querySelector('[data-stamp="exmas-chalet"]').click();
  const beforeChalet = pixel(flat(), 180, 905);
  tap(stage, ...at(180, 900));
  check(K.ops[K.ops.length - 1].k === 'exmas-chalet', 'a tap drops a snowy chalet');
  await waitFor(() => pixel(flat(), 180, 905) !== beforeChalet, 'chalet sticker drawn');
  pickTool('stamp');
  check(stampCount() === 36 && pop.querySelector('[data-tab="xmas"].sel'), 'the menu opens again on the page of the sticker in use');
  pickTool('stamp');
  $('#undo').click();

  // a personal sticker from a pack: a picture twice as wide as high keeps its proportions in its square box
  const stickers = await import('../js/stickers.js');
  const images = await import('../js/images.js');
  const wide = document.createElement('canvas');
  wide.width = 200; wide.height = 100;
  const wctx = wide.getContext('2d');
  wctx.fillStyle = BLUE;
  wctx.fillRect(0, 0, 200, 100);
  const pack = { app: 'giuno-colors', kind: 'stickers', stickers: [{ name: 'bleu', image: wide.toDataURL('image/png') }] };
  const got = await stickers.importStickerFile(new File([JSON.stringify(pack)], 'pack.json', { type: 'application/json' }));
  await images.preloadStamps();
  const mine = stickers.customStickers()[0];
  check(got.added === 1 && mine && mine.w === 200 && mine.h === 100, 'a pack adds a personal sticker');
  pickTool('stamp');
  check(pop.querySelectorAll('[data-tab]').length === 4, 'the personal stickers get their own page');
  pop.querySelector('[data-tab="mine"]').click();
  check(stampCount() === 1, 'one personal sticker');
  pop.querySelector(`[data-stamp="u:${mine.id}"]`).click();
  const beforeMine = [pixel(flat(), 180, 900), pixel(flat(), 180, 850)];
  tap(stage, ...at(180, 900));
  const ps = K.ops[K.ops.length - 1];
  img = flat();
  check(ps.k === 'u:' + mine.id && pixel(img, 180, 900) === BLUE && pixel(img, 125, 900) === BLUE && pixel(img, 180, 850) === beforeMine[1],
    'the personal sticker is drawn in its proportions');
  await stickers.forgetSticker(mine.id);
  img = flat();
  check(pixel(img, 180, 900) === beforeMine[0], 'a removed sticker vanishes from the drawing');
  $('#undo').click();
  pickTool('stamp');
  check(pop.querySelectorAll('[data-tab]').length === 3 && draw.debug.tool.stamp === 'e2B50', 'its page goes with it, and another sticker is in use');
  pickTool('stamp');

  pickStamp('e2764', 'draw');
  tap(stage, ...at(400, 860));
  const st = K.ops[K.ops.length - 1];
  check(st.t === 'stamp' && st.k === 'e2764' && st.b[2] === 130, 'a tap drops a heart sticker');
  await waitFor(() => pixel(flat(), 400, 860) !== WHITE, 'heart sticker drawn');
  pickStamp('fox', 'animals');
  drag(stage, segment(80, 720, 230, 840, 10));
  const sized = K.ops[K.ops.length - 1].b;
  check(sized[2] === 150, 'a drag sizes the sticker');
  check(sized[1] + sized[3] < 840 && Math.abs(sized[0] + 75 - 230) <= 1, 'under a finger the sticker sits above it, not under it');
  check($('#draw .tool[data-tool="stamp"] .sticker-badge'), 'the sticker button shows a peeling sticker');

  // bricks: 18 pieces, snapped to the stud grid, a second one resting on the first
  const bricks = await import('../js/bricks.js');
  pickTool('brick');
  check(pop.querySelectorAll('[data-brick]').length === 25 && bricks.BRICKS.length === 25, '25 brick pieces seen from the side');
  check(pop.querySelectorAll('[data-model]').length === 5 && pop.querySelector('[data-plate="plate"]'), 'four models to build, or none, and a baseplate');
  check($('.guides .grid') !== null, 'the stud grid shows with the bricks');
  pop.querySelector('[data-brick="b2"]').click();
  pickColor(GREEN);
  tap(stage, ...at(410, 955));
  const b1 = K.ops[K.ops.length - 1];
  const brickPixel = (b) => pixel(flat(), b.x * bricks.STUD + bricks.STUD, bricks.BASE - b.y * bricks.PLATE - 24);
  check(b1.t === 'brick' && b1.k === 'b2' && Number.isInteger(b1.x) && b1.y % 3 === 0 && Math.abs(b1.x * 40 + 40 - 410) <= 20,
    `a tap lays a brick on the grid (${b1.x}, ${b1.y})`);
  check(brickPixel(b1) === GREEN, 'the brick is drawn in the colour in use');
  pickColor(RED);
  tap(stage, ...at(410, 955 - 50));
  const b2 = K.ops[K.ops.length - 1];
  check(b2.t === 'brick' && b2.x === b1.x && b2.y === b1.y + 3 && brickPixel(b2) === RED, 'a second brick rests on the first');
  pickTool('brick');
  pop.querySelector('[data-brick="p2"]').click();
  tap(stage, ...at(410, 955 - 96 - 4));
  const b3 = K.ops[K.ops.length - 1];
  check(b3.k === 'p2' && b3.y === b2.y + 3, `a plate rests on the bricks (${b3.y})`);
  tap(stage, ...at(410, 955 - 96 - 22));
  check(K.ops[K.ops.length - 1].y === b3.y + 1, 'a plate rests on a plate');
  check($('#brick-count').textContent === '4' && !$('#brick-count').hidden, 'the bricks are counted');
  // a tap of the eraser takes a whole brick away; holding a brick picks it up, and it is laid again where the finger lifts
  const [bx, by, bw, bh] = bricks.brickBox(b1);
  pickTool('eraser');
  tap(stage, ...at(bx + bw / 2, by + bh / 2));
  const gone = K.ops[K.ops.length - 1];
  check(gone.t === 'unbrick' && K.ops[gone.i] === b1 && bricks.liveBricks(K.ops).length === 3 && brickPixel(b1) !== GREEN, 'the eraser takes a brick away');
  $('#undo').click();
  check(bricks.liveBricks(K.ops).length === 4 && brickPixel(b1) === GREEN, 'and undo puts it back');
  pickTool('brick');
  pop.querySelector('[data-brick="p2"]').click();
  const [rx, ry, rw, rh] = bricks.brickBox(b2);
  await hold(stage, ...at(rx + rw / 2, ry + rh / 2), 520);
  const moved = K.ops[K.ops.length - 1];
  check(moved.t === 'brick' && moved.k === 'b2' && K.ops[moved.r] === b2 && bricks.liveBricks(K.ops).length === 4, 'a brick held is picked up and laid again');
  $('#undo').click();
  // a model shows pale under the bricks; the baseplate is a background of its own
  pickTool('brick');
  pop.querySelector('[data-model="rocket"]').click();
  check(bricks.modelOf(K.ops) === 'rocket' && bricks.modelLeft(K.ops, 'rocket').length === bricks.MODELS.rocket.length, 'a model to build over');
  pickTool('brick');
  pop.querySelector('[data-plate="plate"]').click();
  check(K.ops[K.ops.length - 1].k === 'plate', 'the baseplate is laid under the bricks');
  $('#undo').click();
  $('#undo').click();
  pickTool('brick');
  check(!pop.querySelector('[data-tab]'), 'the bricks have one page of pieces');
  pop.querySelector('[data-brick="b2"]').click();
  for (let i = 0; i < 4; i++) $('#undo').click();
  check($('.guides .grid') !== null && K.ops[K.ops.length - 1].t !== 'brick', 'the bricks are undone');

  // a stencil keeps the paint inside its shape
  $('#stencil').click();
  check(pop.querySelectorAll('[data-stencil]').length === 10, 'nine stencils, or none');
  pop.querySelector('[data-stencil="circle"]').click();
  check($('.guides .veil') && $('#stencil').classList.contains('on'), 'the stencil veils the page around its shape');
  pickBrush('marker');
  pickColor(BLUE);
  const beforeStencil = [pixel(flat(), 400, 500), pixel(flat(), 40, 500)];
  drag(stage, segment(20, 500, 780, 500, 30));
  const cut = K.ops[K.ops.length - 1];
  check(cut.s === 'circle' && pixel(flat(), 400, 500) === BLUE && pixel(flat(), 40, 500) === beforeStencil[1], 'paint only stays inside the stencil');
  $('#undo').click();
  $('#stencil').click();
  pop.querySelector('[data-stencil=""]').click();
  check(!$('.guides .veil') && !$('#stencil').classList.contains('on'), 'the stencil put away');

  // sounds: none of them breaks anything, and they can be turned off
  const sound = await import('../js/sound.js');
  for (const name of ['pop', 'click', 'unclick', 'fill', 'splash', 'tick', 'nope', 'chime', 'bravo', 'boom']) sound.sfx(name);
  sound.setSoundOn(false);
  check(!sound.soundOn(), 'sounds turned off');
  sound.setSoundOn(true);
  pickColor(RED);
  pickStamp('vcloud1', 'draw');
  tap(stage, ...at(600, 160));
  const cl = K.ops[K.ops.length - 1];
  img = flat();
  check(cl.k === 'vcloud1' && cl.c === RED && pixel(img, 600, 160) === RED, 'a cloud sticker in the colour in use');
  // a firework bursts over the page and leaves its sparks
  pickStamp('fwork1');
  tap(stage, ...at(620, 420));
  const fw = K.ops[K.ops.length - 1];
  check(fw.k === 'fwork1' && fw.c === RED && draw.debug.sparkles.busy(), 'a firework sticker bursts');
  img = flat();
  let sparks = 0;
  for (let x = fw.b[0]; x < fw.b[0] + fw.b[2]; x += 2) for (let y = fw.b[1]; y < fw.b[1] + fw.b[3]; y += 2) if (pixel(img, x, y) !== WHITE) sparks++;
  check(sparks > 30, `the firework leaves its sparks (${sparks})`);
  // a shake lets glitter fall in the colour in use; it settles as one operation, undone at once
  const opsBefore = K.ops.length;
  draw.debug.shake();
  await waitFor(() => K.ops.length === opsBefore + 1, 'the glitter settles', 4000);
  const fl = K.ops[K.ops.length - 1];
  check(fl.t === 'flakes' && fl.k === 'glitter' && fl.c === RED && fl.n === 70, 'a shake leaves glitter');
  $('#undo').click();
  check(K.ops.length === opsBefore, 'the glitter is undone');

  // the finger spreads the paint: red pushed out of a thick line into the white beside it, undone, redone
  // (the finger is switched off while it is made faster: then its drawing is left out)
  if (!$('#draw .tool[data-tool="smudge"]').hidden) {
  pickBrush('marker');
  $('#size').click();
  $('#draw-pop [data-size="3"]').click();
  drag(stage, segment(250, 300, 250, 700, 20));
  check(pixel(flat(), 330, 500) === WHITE, 'white beside the red line');
  pickTool('smudge');
  $('#size').click();
  $('#draw-pop [data-size="2"]').click();
  drag(stage, segment(240, 500, 420, 500, 30));
  const sm = K.ops[K.ops.length - 1];
  const reddish = (c) => c !== WHITE && parseInt(c.slice(1, 3), 16) > parseInt(c.slice(5, 7), 16) + 20;
  check(sm.t === 'smudge' && reddish(pixel(flat(), 330, 500)), `the finger spreads the red (${pixel(flat(), 330, 500)})`);
  $('#undo').click();
  check(pixel(flat(), 330, 500) === WHITE, 'undo takes the smudge back');
  $('#redo').click();
  check(reddish(pixel(flat(), 330, 500)), 'redo spreads it again');
  }

  // background: the night sky, undone
  $('#draw-bg').click();
  const tiles = [...$('#draw-pop').querySelectorAll('[data-bg]')];
  check(tiles.length === art.BACKGROUNDS.length && tiles.length === 16, `${tiles.length} backgrounds`);
  const popBox = $('#draw-pop').getBoundingClientRect(), stageBox = stage.getBoundingClientRect();
  check(popBox.top >= stageBox.top && popBox.bottom <= stageBox.bottom, 'the background menu fits in the drawing area');
  // every button shows its background: only the white page is plain white
  const plain = tiles.filter((b) => {
    const c = b.querySelector('canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 235 || d[i + 1] < 235 || d[i + 2] < 235) return false;
    return true;
  }).map((b) => b.dataset.bg);
  check(plain.length === 1 && plain[0] === 'paper#ffffff', `background buttons show their picture (plain: ${plain.join(' ')})`);
  check($('#draw-bg svg.scenery'), 'background button shows a landscape on white paper');
  $('#draw-pop [data-bg="night"]').click();
  const dark = (c) => parseInt(c.slice(1, 3), 16) < 90 && parseInt(c.slice(5, 7), 16) < 140;
  check(K.ops[K.ops.length - 1].t === 'bg' && dark(pixel(flat(), 795, 995)), 'night background');
  $('#undo').click();
  check(pixel(flat(), 795, 995) === WHITE, 'background undone');
  $('#redo').click();
  check($('#draw-bg canvas.bg'), 'background button shows the night sky');
  $('#draw-bg').click();
  $('#draw-pop [data-bg="sea"]').click();
  const sea = pixel(flat(), 400, 400);
  check(parseInt(sea.slice(5, 7), 16) > parseInt(sea.slice(1, 3), 16) + 60, `sea background is blue (${sea})`);
  $('#undo').click();
  // a scratch card: black all over, the eraser in hand, bright colours where it scratches
  const sizeBefore = draw.debug.tool.size;
  $('#draw-bg').click();
  $('#draw-pop [data-bg="scratch"]').click();
  check(draw.debug.tool.kind === 'eraser' && pixel(flat(), 795, 995) === '#17171d', 'a scratch card is black, with the eraser in hand');
  drag(stage, segment(700, 980, 790, 980, 10));
  const scratched = pixel(flat(), 760, 980);
  check(scratched !== '#17171d' && scratched !== WHITE, `scratching shows the colours under the coat (${scratched})`);
  $('#undo').click();
  $('#undo').click();
  check(pixel(flat(), 795, 995) !== '#17171d', 'the scratch card undone');
  pickTool('brush');
  draw.debug.tool.size = sizeBefore;

  // replay: the drawing draws itself again and ends as it was; a tap stops it
  const before = [[200, 60], [600, 600], [400, 860], [795, 995]].map(([x, y]) => pixel(flat(), x, y));
  draw.debug.replay();
  check(K.replay && stage.classList.contains('replaying'), 'replay running');
  await waitFor(() => !K.replay, 'replay to end', 15000);
  check([[200, 60], [600, 600], [400, 860], [795, 995]].every(([x, y], i) => pixel(flat(), x, y) === before[i]) && !stage.classList.contains('replaying'),
    'replay ends on the same drawing');
  draw.debug.replay();
  tap(stage, ...at(400, 500));
  check(!K.replay && K.ops.length === draw.debug.state().ops.length, 'a tap stops the replay without drawing');
  $('#draw-back').click();
  await waitFor(inGallery, 'gallery after the brushes');

  // a colouring page painted freely: its outlines stay on top and hold the bucket
  $('#cards .cards .card').click();
  await waitFor(() => !$('#play').hidden, 'colouring screen');
  $('#paint-free').click();
  await waitFor(opened, 'free painting screen');
  const F = draw.debug.state();
  check(F.baseId && F.base && F.base.canvas.width > 100, `outlines of ${F.baseId} loaded`);
  pickTool('bucket');
  pickColor(GREEN);
  tap(stage, ...at(400, 500));
  const fimg = art.renderFlat(F.ops, art.PAGE_W, F.base);
  let green = 0, dk = 0;
  for (let y = 0; y < art.PAGE_H; y += 5) for (let x = 0; x < art.PAGE_W; x += 5) {
    const c = pixel(fimg, x, y);
    if (c === GREEN) green++;
    else if (parseInt(c.slice(1, 3), 16) < 110) dk++;
  }
  check(F.ops.length === 1 && green > 50 && green < 0.6 * 160 * 200 && dk > 200, `bucket stays inside the outlines (${green} green, ${dk} dark samples)`);
  $('#draw-back').click();
  await waitFor(() => !$('#play').hidden, 'back to the colouring screen');
  $('#back').click();
  await waitFor(inGallery, 'gallery');
  await sleep(200);
  const recs = await store.listArt('p1');
  check(recs.some((r) => r.base === F.baseId && r.ops.length === 1), 'painted page saved with its colouring page');

  // two fingers zoom on the page; drawing then lands where the finger is; the button shows the whole page
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const Z = draw.debug.state();
  const finger = (type, id, [x, y]) => stage.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch',
    isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true, buttons: type === 'pointerup' ? 0 : 1 }));
  const zmid = at(400, 500);  // between the two fingers, before zooming
  finger('pointerdown', 1, at(380, 500));
  finger('pointerdown', 2, at(420, 500));
  for (let i = 1; i <= 10; i++) { finger('pointermove', 1, at(380 - 12 * i, 500)); finger('pointermove', 2, at(420 + 12 * i, 500)); }
  finger('pointerup', 2, at(540, 500));
  finger('pointerup', 1, at(260, 500));
  check(Z.view.z > 2.5 && !$('#zoom-fit').hidden && Z.ops.length === 0, `pinch zooms in (x${Z.view.z.toFixed(1)}), nothing drawn`);
  // the fingers went past the maximum zoom: the point between them must not have slid away
  const zr = stage.getBoundingClientRect(), zs = Z.s * Z.view.z;
  const [zmx, zmy] = zmid;
  const under = [(zmx - zr.left - Z.view.ox) / zs, (zmy - zr.top - Z.view.oy) / zs];
  check(Math.abs(under[0] - 400) < 2 && Math.abs(under[1] - 500) < 2, `zoomed past the maximum, the page stays under the fingers (${under.map(Math.round).join(', ')})`);
  pickBrush('marker');
  pickColor(BLUE);
  drag(stage, segment(390, 480, 410, 520, 10));
  const zl = Z.ops[0];
  check(zl && Math.abs(zl.p[0] - 390) <= 1 && Math.abs(zl.p[1] - 480) <= 1 && pixel(flat(), 400, 500) === BLUE, 'drawing while zoomed lands under the finger');
  $('#zoom-fit').click();
  check(Z.view.z === 1 && $('#zoom-fit').hidden, 'the whole page again');
  $('#draw-back').click();
  await waitFor(inGallery, 'gallery after zooming');

  // a small house for the screenshot
  $('#cards .art-new').click();
  await waitFor(opened, 'drawing screen');
  const B = draw.debug.state();
  $('#size').click();
  $('#draw-pop [data-size="1"]').click();
  pickColor(BLACK);
  pickShape('square');
  drag(stage, segment(200, 520, 600, 850, 8));
  pickShape('triangle');
  drag(stage, segment(160, 280, 640, 520, 8));
  pickShape('square');
  drag(stage, segment(340, 680, 460, 850, 8));
  pickShape('circle');
  drag(stage, segment(610, 60, 760, 210, 8));
  pickTool('brush');
  drag(stage, segment(0, 850, 800, 850));
  bucket(YELLOW, 260, 600);
  bucket(RED, 400, 420);
  bucket(BROWN, 400, 760);
  bucket(YELLOW, 685, 135);
  bucket(SKY, 40, 40);
  bucket(GREEN, 100, 930);
  pickTool('brush');
  img = flat();
  check(pixel(img, 260, 600) === YELLOW && pixel(img, 400, 420) === RED && pixel(img, 400, 760) === BROWN
    && pixel(img, 40, 40) === SKY && pixel(img, 100, 930) === GREEN && pixel(img, 685, 135) === YELLOW, 'house coloured zone by zone');
  check(B.ops.length === 11, `house: ${B.ops.length} operations`);
  draw.debug.flushSave();
  pickTool('shape');
  check(document.querySelectorAll('#draw-pop [data-shape]').length === 5, 'five shapes in the menu');
});
