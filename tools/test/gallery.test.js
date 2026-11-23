// Start-up with two profiles, then the gallery with some progress already saved.
import { run, check, note, clearStorage, frames, sleep } from './harness.js';

run(async () => {
  await clearStorage();
  localStorage.setItem('giuno.profiles', JSON.stringify([
    { id: 'p1', name: 'Alice', color: '#ec6fa5' },
    { id: 'p2', name: 'Zoé', color: '#43a047' },
  ]));
  let t0 = performance.now();
  const { drawings } = await import('../js/drawings.js');
  note(`${drawings.length} drawings parsed in ${Math.round(performance.now() - t0)} ms`);
  const first = drawings[0];
  const zones = (first.root.querySelectorAll('[data-c]')).length;
  localStorage.setItem(`giuno.progress.p1.${first.key}`, JSON.stringify([0, 1, 2]));
  const { putArt } = await import('../js/artstore.js');
  const line = (c, y) => ({ t: 'line', c, w: 28, p: [100, y, 400, y + 200, 700, y] });
  const fill = (c) => ({ t: 'fill', c, r: [[0, 0, 800, 0, 800, 1000, 0, 1000]] });
  await putArt({ id: 'a1', profile: 'p1', created: 1, updated: 10, ops: [fill('#64b5f6'), line('#e53935', 300)] });
  await putArt({ id: 'a2', profile: 'p1', created: 2, updated: 20, ops: [line('#2e9d4a', 500), { t: 'shape', k: 'heart', c: '#f06292', w: 14, b: [250, 150, 300, 260] }] });
  await putArt({ id: 'a3', profile: 'p2', created: 3, updated: 30, ops: [line('#1f1f1f', 400)] });
  await import('../js/main.js');
  await frames();

  check(!document.querySelector('#profiles').hidden, 'two profiles: "Qui colorie ?" first');
  const avatars = document.querySelectorAll('#profile-list .avatar');
  check(avatars.length === 3, 'two profiles and the add button');
  t0 = performance.now();
  avatars[0].click();
  await frames();
  note(`gallery shown in ${Math.round(performance.now() - t0)} ms`);

  check(!document.querySelector('#gallery').hidden, 'gallery after picking a profile');
  check(document.querySelector('#who').textContent.includes('Alice'), 'gallery shows who is colouring');
  // the phone's Back leads from the gallery to the choice of child, and never out of the app
  history.back();
  await sleep(250);
  check(!document.querySelector('#profiles').hidden && history.state && history.state.pushed, 'Back from the gallery asks who is colouring');
  history.back();
  await sleep(250);
  check(!document.querySelector('#profiles').hidden && history.state && history.state.pushed, 'Back from there stays in the app');
  document.querySelectorAll('#profile-list .avatar')[0].click();
  await frames();
  check(!document.querySelector('#gallery').hidden, 'and a child picked again shows the gallery');
  // the logo and the name of the app lead to the start screen; the name of the child fits in the header
  document.querySelector('#gallery .head .logo').click();
  await frames();
  check(!document.querySelector('#profiles').hidden, 'the logo leads to the start screen');
  document.querySelectorAll('#profile-list .avatar')[0].click();
  await frames();
  const head = document.querySelector('#gallery .head').getBoundingClientRect(), who = document.querySelector('#who').getBoundingClientRect();
  check(who.right <= innerWidth + 0.5 && head.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth + 1,
    `the header fits the screen (${Math.round(who.right)} of ${innerWidth})`);
  // session timer: set in the grown-ups' corner; when the time is up, the start screen and a message
  const timerStore = await import('../js/store.js');
  document.querySelector('#timer-row [data-min="10"]').click();
  check(timerStore.getTimerEnd() > Date.now() + 9 * 60000 && !document.querySelector('#timer-off').hidden
    && /10/.test(document.querySelector('#timer-left').textContent), 'the timer is set for ten minutes');
  timerStore.setTimerEnd(Date.now() - 1000);
  document.dispatchEvent(new Event('visibilitychange'));
  await frames();
  check(!document.querySelector('#timeup').hidden && !document.querySelector('#profiles').hidden && timerStore.getTimerEnd() === 0,
    'time up: back to the start screen, with a message');
  document.querySelector('#timeup-ok').click();
  document.querySelectorAll('#profile-list .avatar')[0].click();
  await frames();
  check(document.querySelector('#timeup').hidden && !document.querySelector('#gallery').hidden, 'and the app can be used again');
  const cards = document.querySelectorAll('#cards .cards .card');
  check(cards.length === drawings.length, `one card per drawing (${cards.length})`);
  const secrets = [...document.querySelectorAll('#cards .card.secret')];
  check(secrets.length === drawings.filter((d) => d.mystery).length && secrets.length === 3
    && secrets.every((c) => c.querySelector('.meta b').textContent === 'Coloriage mystère' && c.querySelector('svg.mystery')),
  `${secrets.length} mystery pages keep their picture and their name to themselves`);
  const categories = new Set(drawings.map((d) => d.category));
  const headings = [...document.querySelectorAll('#cards .section')].map((h) => h.textContent);
  check(headings.length === categories.size + 1 && headings[0] === 'Mes dessins', 'free drawings first, then one heading per category');
  check(document.querySelector('#cards .art-row .art-new'), 'new drawing card');
  await new Promise((r) => setTimeout(r, 200));
  const art = [...document.querySelectorAll('#cards .art-row .art-card')];
  check(art.length === 2, `only this child's drawings (${art.length})`);
  check(art.every((c) => c.querySelector('canvas.thumb')), 'drawings shown as thumbnails');

  // Back from a screen opened in the gallery returns to it, even before the page has finished
  // loading (the screenshot keeps it loading until the end of this test)
  const shown = (id) => !document.querySelector('#' + id).hidden;
  const settle = () => new Promise((r) => setTimeout(r, 150));
  document.querySelector('#who').click();
  await settle();
  check(shown('profiles'), 'profile choice from the gallery');
  document.querySelectorAll('#profile-list .avatar')[1].click();
  await settle();
  check(shown('gallery') && document.querySelector('#who').textContent.includes('Zoé'), 'back in the gallery as Zoé');
  check(document.querySelectorAll('#cards .art-card').length === 1, "Zoé's drawings");
  document.querySelector('#cards .cards .card').click();
  await settle();
  check(shown('play'), 'colouring screen from a card');
  document.querySelector('#back').click();
  await settle();
  check(shown('gallery'), 'Back returns to the gallery');
  document.querySelector('#who').click();
  await settle();
  document.querySelectorAll('#profile-list .avatar')[0].click();
  await settle();
  check(shown('gallery') && document.querySelector('#who').textContent.includes('Alice'), 'back to Alice');
  const width = cards[0].querySelector('.bar > i').style.width;
  check(Math.abs(parseFloat(width) - 300 / zones) < 0.01, `saved progress shows on the card (${width})`);
  check(/Version \d+\.\d+\.\d+ \d\d\/\d\d\/\d{4} \d\dh\d\d/.test(document.querySelector('#gallery').textContent), 'version number and date shown');

  // English on request, remembered on the device, then French again
  const firstTitle = () => document.querySelector('#cards .cards .card .meta b').textContent;
  check(document.documentElement.lang === 'fr' && firstTitle() === first.title, 'French by default');
  document.querySelector('#gallery .lang-switch').click();
  await settle();
  check(document.documentElement.lang === 'en' && document.querySelector('#cards .section').textContent === 'My drawings',
    'English after the switch');
  check(firstTitle() === first.titleEn && first.titleEn, `drawing titles in English (${firstTitle()})`);
  check(document.querySelector('#gallery .note a').textContent === 'Source code', 'page texts in English');
  check(localStorage.getItem('giuno.lang') === '"en"', 'language remembered');
  document.querySelector('#gallery .lang-switch').click();
  await settle();
  check(document.documentElement.lang === 'fr' && document.querySelector('#cards .section').textContent === 'Mes dessins'
    && localStorage.getItem('giuno.lang') === '"fr"', 'back to French');

  // a new profile picks an animal, the first one nobody has
  document.querySelector('#who').click();
  await settle();
  document.querySelector('#profile-list .avatar.add').click();
  await settle();
  const animals = document.querySelectorAll('#profile-animals button');
  check(animals.length === 15, `15 animals to pick from (${animals.length})`);
  check(document.querySelector('#profile-animals button.sel').dataset.animal === 'fox', 'first free animal picked');
  animals[4].click();
  document.querySelector('#profile-name').value = 'Lou';
  document.querySelector('#profile-form').requestSubmit();
  await settle();
  const img = document.querySelector('#who .face img');
  check(shown('gallery') && img && img.getAttribute('src') === 'avatars/owl.svg', 'the gallery shows the owl');
  let loaded = false;
  try { await img.decode(); loaded = img.naturalWidth > 0; } catch (e) { loaded = false; }
  check(loaded, 'avatar image loads');
  const saved = JSON.parse(localStorage.getItem('giuno.profiles')).find((p) => p.name === 'Lou');
  check(saved && saved.animal === 'owl' && !('color' in saved), 'profile saved with its animal');

  // grown-ups' corner: a backup holds profiles, progress and drawings, and puts them back as they were
  check(document.querySelector('#backup-save') && document.querySelector('#backup-load'), "grown-ups' corner buttons");
  const backup = await import('../js/backup.js');
  const { allArt } = await import('../js/artstore.js');
  const data = JSON.parse(JSON.stringify(await backup.makeBackup()));
  check(data.app === 'giuno-colors' && JSON.parse(data.storage.profiles).length === 3 && data.art.length === 3
    && data.storage[`progress.p1.${first.key}`], `backup: 3 profiles, progress, ${data.art.length} drawings`);
  await putArt({ id: 'extra', profile: 'p1', created: 5, updated: 50, ops: [line('#1f1f1f', 100)] });
  localStorage.setItem('giuno.profiles', '[]');
  check(await backup.restoreBackup(data), 'backup restored');
  check(JSON.parse(localStorage.getItem('giuno.profiles')).length === 3 && (await allArt()).length === 3
    && localStorage.getItem(`giuno.progress.p1.${first.key}`) === '[0,1,2]', 'restored as saved, nothing more');
  check(!(await backup.restoreBackup({ app: 'something else', storage: {}, art: [] })), 'a foreign file is refused');

  // a colouring page added from a file: cleaned of anything that could run, shown first, saved, removed
  const importer = await import('../js/importer.js');
  const { route } = await import('../js/main.js');
  const { allPages } = await import('../js/artstore.js');
  const nasty = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-palette="#ff0000 #00ff00" onload="window.hacked=1">'
    + '<script>window.hacked=2</script><rect data-c="1" width="50" height="100" onclick="window.hacked=3"/>'
    + '<rect data-c="2" x="50" width="50" height="100" fill="url(javascript:window.hacked=4)"/>'
    + '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>';
  const page = await importer.importPage(nasty, 'Essai.svg');
  check(!(page instanceof Error) && page.title === 'Essai' && drawings[0] === page, 'page added first, named after its file');
  const kept = new XMLSerializer().serializeToString(page.root);
  check(!/script|onload|onclick|javascript|foreignObject/i.test(kept) && page.root.querySelectorAll('[data-c]').length === 2,
    'only the shapes are kept');
  check((await importer.importPage('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>', 'x.svg')) instanceof Error
    && (await importer.importPage('not a drawing', 'y.svg')) instanceof Error, 'files that are not colouring pages are refused');
  route();
  await settle();
  const heads = [...document.querySelectorAll('#cards .section')].map((h) => h.textContent);
  check(heads[1] === 'Coloriages ajoutés' && document.querySelector('#cards .cards .card .meta b').textContent === 'Essai',
    'the added page heads the gallery');
  check(window.hacked === undefined, 'nothing from the file ran');
  check((await backup.makeBackup()).pages.length === 1, 'the backup holds the added page');
  check(!document.querySelector('#page-clear').hidden, 'a button offers to remove the added pages');
  document.querySelector('#page-clear').click();
  await settle();
  document.querySelector('#confirm-yes').click();
  await settle();
  check(!drawings.includes(page) && document.querySelector('#page-clear').hidden, 'the button removes them all');
  await importer.forgetPage(page.id);
  check(!drawings.includes(page) && (await allPages()).length === 0, 'the added page removed');

  // personal stickers: a picture or a pack added from a file, listed in the corner, saved, restored, removed
  const stickers = await import('../js/stickers.js');
  const { allStickers } = await import('../js/artstore.js');
  const picture = (w, h, colour) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = colour;
    ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    return c;
  };
  const blob = await new Promise((r) => picture(1600, 800, '#e53935').toBlob(r, 'image/png'));
  const one = await stickers.importStickerFile(new File([blob], 'rouge.png', { type: 'image/png' }));
  const big = stickers.customStickers()[0];
  check(one.added === 1 && big && big.name === 'rouge' && big.w === 640 && big.h === 320, 'a big picture is added scaled down, named after its file');
  const pack = { app: 'giuno-colors', kind: 'stickers', stickers: [
    { name: 'vert', image: picture(120, 200, '#2e9d4a').toDataURL('image/png') },
    { name: 'svg', image: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=' },
    { name: 'empty', image: 'data:image/png;base64,AAAA' },
  ] };
  const packFile = () => new File([JSON.stringify(pack)], 'pack.json', { type: 'application/json' });
  const two = await stickers.importStickerFile(packFile());
  const small = stickers.customStickers()[1];
  check(two.added === 1 && two.known === 0 && small.w === 120 && small.h === 200 && small.data === pack.stickers[0].image,
    'a pack adds its pictures, a small one kept as it is, the rest refused');
  const again = await stickers.importStickerFile(packFile());
  check(again.added === 0 && again.known === 1 && stickers.customStickers().length === 2, 'the same pack again adds nothing');
  check((await stickers.importStickerFile(new File(['{"app":"giuno-colors"}'], 'x.json', { type: 'application/json' }))) instanceof Error
    && (await stickers.importStickerFile(new File(['hello'], 'y.txt', { type: 'text/plain' }))) instanceof Error, 'other files are refused');
  backup.showStickers();
  const listed = document.querySelectorAll('#sticker-list [data-sticker]');
  check(listed.length === 2 && !document.querySelector('#sticker-list').hidden, "the stickers show in the grown-ups' corner");
  const withStickers = JSON.parse(JSON.stringify(await backup.makeBackup()));
  check(withStickers.stickers.length === 2, 'the backup holds the stickers');
  await stickers.forgetSticker(big.id);
  check(stickers.customStickers().length === 1 && (await allStickers()).length === 1, 'a sticker removed');
  withStickers.stickers.push({ id: 'bad', data: 'javascript:alert(1)', w: 1, h: 1 });
  check(await backup.restoreBackup(withStickers), 'backup with stickers restored');
  await stickers.loadStickers();
  check(stickers.customStickers().length === 2 && (await allStickers()).length === 2, 'the stickers come back, an invalid record left out');
  for (const s of [...stickers.customStickers()]) await stickers.forgetSticker(s.id);
  backup.showStickers();
  check(document.querySelector('#sticker-list').hidden, 'no sticker left');

  // fluidity meter: off by default; once on, it times a drag and the heavy steps, and reports them
  const hud = document.querySelector('#perf');
  check(hud.hidden && !document.querySelector('#perf-on').hidden && document.querySelector('#perf-share').hidden,
    'fluidity meter off by default');
  const perf = await import('../js/perf.js');
  document.querySelector('#perf-on').click();
  check(!hud.hidden && localStorage.getItem('giuno.perf') === 'true', 'fluidity meter on, remembered');
  route();
  await settle();
  document.querySelector('#cards .cards .card').click();
  await settle();
  const stage = document.querySelector('#stage'), sr = stage.getBoundingClientRect();
  const fire = (type, x, y) => stage.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true,
    clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  const cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
  fire('pointerdown', cx, cy);
  for (let i = 1; i <= 12; i++) { await frames(1); fire('pointermove', cx + 4 * i, cy); }
  fire('pointerup', cx + 48, cy);
  await sleep(700);
  const text = perf.perfReport();
  check(text.includes(`coloriage ${drawings[0].id}, un doigt : 1 ;`) && text.includes(`ouverture du coloriage ${drawings[0].id} : 1 ;`)
    && (text.includes(`numéros ${drawings[0].id} : 1 ;`) || text.includes(`carte des zones ${drawings[0].id} : 1 ;`)), 'the drag and the opening are in the report');
  check(/i\/s/.test(hud.textContent) && /lâcher/.test(hud.textContent), `the meter shows the drag (${hud.textContent.split('\n')[1]})`);
  note(text);
  document.querySelector('#back').click();
  await settle();
  document.querySelector('#perf-off').click();
  check(hud.hidden && localStorage.getItem('giuno.perf') === 'false', 'fluidity meter off again');
});
