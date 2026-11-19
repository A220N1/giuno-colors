// Start-up, navigation between the screens, offline support and the install button.
import { $ } from './util.js';
import { drawings } from './drawings.js';
import { profiles, currentProfile, setCurrent, requestPersistence } from './store.js';
import { showGallery } from './gallery.js';
import { showProfiles } from './profiles.js';
import { openPlay, leavePlay } from './play.js';

// Screens map to the address: '' gallery, '#profils' profile choice, '#<drawing id>' colouring.
let fromGallery = false;    // the drawing was opened from the gallery, so Back can pop the history
let pushedProfiles = false;
let startupPick = profiles().length >= 2 && !location.hash;  // two children or more: ask who is colouring

export function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  leavePlay();
  if (hash !== 'profils') pushedProfiles = false;
  const profile = currentProfile();
  if (!profile || startupPick || hash === 'profils') return showProfiles(pickProfile);
  const d = drawings.find((x) => x.id === hash);
  if (d) return openPlay(d, profile.id, goBack);
  fromGallery = false;
  showGallery(profile, openDrawing, openProfiles);
}

function clearHash() {
  history.replaceState(null, '', location.pathname + location.search);
}

function pickProfile(id) {
  setCurrent(id);
  requestPersistence();
  startupPick = false;
  if (pushedProfiles) { pushedProfiles = false; history.back(); return; }
  if (location.hash) clearHash();
  route();
}

function openProfiles() {
  pushedProfiles = true;
  location.hash = 'profils';
}

function openDrawing(d) {
  location.hash = encodeURIComponent(d.id);
  fromGallery = true;
}

function goBack() {
  if (fromGallery) { fromGallery = false; history.back(); return; }
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
