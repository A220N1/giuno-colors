// Free drawing: brush, shapes, paint bucket, eraser, undo and redo, saving in the gallery, sharing, deleting.
import { run, check, note, clearStorage, frames, sleep, tap, drag, waitFor } from './harness.js';

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
  await import('../js/main.js');
  await frames();

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
  const sr = stage.getBoundingClientRect(), pr = $('.sheet').getBoundingClientRect();
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
  tap(stage, ...at(400, 300 - 150 + 1));
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
