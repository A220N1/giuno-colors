// Start-up, navigation between the screens, offline support and the install button.
import { $ } from './util.js';
import { drawings } from './drawings.js';
import { profiles, currentProfile, setCurrent, requestPersistence } from './store.js';
import { showGallery } from './gallery.js';
import { showProfiles } from './profiles.js';
import { openPlay, leavePlay } from './play.js';
import { openDraw, leaveDraw } from './draw.js';

// Screens map to the address: '' gallery, '#profils' profile choice, '#<drawing id>' colouring,
// '#libre/<id>' free drawing. A screen opened from the gallery gets its own history entry, marked so
// that Back returns to the gallery; opened from a bookmark or a reload, Back goes to the gallery directly.
let startupPick = profiles().length >= 2 && !location.hash;  // two children or more: ask who is colouring

export function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  leavePlay();
  leaveDraw();
  const profile = currentProfile();
  if (!profile || startupPick || hash === 'profils') return showProfiles(pickProfile);
  const d = drawings.find((x) => x.id === hash);
  if (d) return openPlay(d, profile.id, goBack);
  if (hash.startsWith('libre/') && hash.length > 6) return openDraw(hash.slice(6), profile.id, goBack);
  showGallery(profile, openDrawing, openProfiles, openArt);
}

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

// pushState rather than setting location.hash: while the page is still loading, a hash change
// replaces the current entry, and Back would then leave the app.
function push(hash) {
  history.pushState({ pushed: true }, '', '#' + hash);
  route();
}

const pushed = () => Boolean(history.state && history.state.pushed);

function pickProfile(id) {
  setCurrent(id);
  requestPersistence();
  startupPick = false;
  if (pushed()) { history.back(); return; }
  if (location.hash) clearHash();
  route();
}

function openProfiles() { push('profils'); }
function openDrawing(d) { push(encodeURIComponent(d.id)); }
function openArt(id) { push('libre/' + encodeURIComponent(id)); }

function goBack() {
  if (pushed()) { history.back(); return; }
  clearHash();
  route();
}

addEventListener('hashchange', route);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('service worker:', e));
  });
}

let installEvent = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvent = e;
  $('#install').hidden = false;
});
$('#install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  $('#install').hidden = true;
});
addEventListener('appinstalled', () => { $('#install').hidden = true; });

route();
