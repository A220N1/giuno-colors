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
  await import('../js/main.js');
  await frames();

  check(!document.querySelector('#profiles').hidden, 'two profiles: "Qui colorie ?" first');
  const avatars = document.querySelectorAll('#profile-list .avatar');
  check(avatars.length === 3, 'two profiles and the add button');
  avatars[0].click();
  await frames();

  check(!document.querySelector('#gallery').hidden, 'gallery after picking a profile');
  check(document.querySelector('#who').textContent.includes('Alice'), 'gallery shows who is colouring');
  const cards = document.querySelectorAll('#cards .card');
  check(cards.length === drawings.length, `one card per drawing (${cards.length})`);
  const categories = new Set(drawings.map((d) => d.category));
  check(document.querySelectorAll('#cards .section').length === categories.size, 'one heading per category');
  const width = cards[0].querySelector('.bar > i').style.width;
  check(Math.abs(parseFloat(width) - 300 / zones) < 0.01, `saved progress shows on the card (${width})`);
  check(/Version \d\d\/\d\d\/\d{4}/.test(document.querySelector('#gallery').textContent), 'version shown');
});
