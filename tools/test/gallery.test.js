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
  check(/Version \d\d\/\d\d\/\d{4}/.test(document.querySelector('#gallery').textContent), 'version shown');
});
