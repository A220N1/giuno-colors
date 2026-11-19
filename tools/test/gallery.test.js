// Start-up with two profiles, then the gallery with some progress already saved.
import { run, check, clearStorage, frames } from './harness.js';

run(async () => {
  await clearStorage();
  localStorage.setItem('giuno.profiles', JSON.stringify([
    { id: 'p1', name: 'Alice', color: '#ec6fa5' },
    { id: 'p2', name: 'Zoé', color: '#43a047' },
  ]));
  const { drawings } = await import('../js/drawings.js');
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
  avatars[0].click();
  await frames();

  check(!document.querySelector('#gallery').hidden, 'gallery after picking a profile');
  check(document.querySelector('#who').textContent.includes('Alice'), 'gallery shows who is colouring');
  const cards = document.querySelectorAll('#cards .cards .card');
  check(cards.length === drawings.length, `one card per drawing (${cards.length})`);
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
  await importer.forgetPage(page.id);
  check(!drawings.includes(page) && (await allPages()).length === 0, 'the added page removed');
});
