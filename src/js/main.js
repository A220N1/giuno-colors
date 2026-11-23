// Start-up, navigation between the screens, offline support and the install button.
import { $ } from './util.js';
import { drawings } from './drawings.js';
import { profiles, currentProfile, setCurrent, requestPersistence } from './store.js';
import { showGallery } from './gallery.js';
import { showProfiles } from './profiles.js';
import { openPlay, leavePlay } from './play.js';
import { openDraw, leaveDraw } from './draw.js';
import { resetLock } from './lock.js';
import { showStickers, showAdded } from './backup.js';
import { loadImported } from './importer.js';
import { loadStickers } from './stickers.js';
import { preloadStamps } from './images.js';
import { newArtId } from './artstore.js';
import { lang, setLanguage, translatePage } from './i18n.js';
import { soundOn, setSoundOn, sfx } from './sound.js';
import { navlog } from './navlog.js';
import { startTimer } from './timer.js';

// Screens map to the address: '' gallery, '#profils' profile choice, '#<drawing id>' colouring,
// '#libre/<id>' free drawing.
// The phone's Back button never leaves the app: it leads from a drawing to the gallery, from the
// gallery to the choice of child, and does nothing there. The history holds two entries for that: the
// one the app started on, and above it a working entry (marked `pushed`) whose address follows the
// screens. Back lands on the first one; the app shows the screen before and puts the working entry back.
// The working entry is only added once the screen has been touched: a phone skips, on Back, the
// entries the user never touched, and would leave the app. The first entry is marked `base`, which
// tells a Back onto it from a change of address by hand, which also lands on an entry without mark.
let startupPick = profiles().length >= 2 && !location.hash;  // two children or more: ask who is colouring
let screen = '';  // 'pick' (who is colouring), 'who' (profiles from the gallery), 'gallery', 'play' or 'draw'
let up = '';      // the address Back leads to from a drawing: the gallery, or the colouring page being painted freely

export function route() {
  const hash = decodeURIComponent(location.hash.slice(1));
  leavePlay();
  leaveDraw();
  resetLock();
  const profile = currentProfile();
  if (!profile || startupPick || hash === 'profils') {
    screen = hash === 'profils' && profile && !startupPick ? 'who' : 'pick';
    return showProfiles(pickProfile);
  }
  const d = drawings.find((x) => x.id === hash);
  screen = 'play';
  up = '';
  if (d) return openPlay(d, profile.id, goBack, (page) => show(`libre/${newArtId()}@${encodeURIComponent(page.id)}`));
  // '#libre/<id>', or '#libre/<id>@<colouring page>' for a page painted freely
  if (hash.startsWith('libre/') && hash.length > 6) {
    const [id, baseId = ''] = hash.slice(6).split('@');
    screen = 'draw';
    up = baseId && drawings.some((x) => x.id === baseId) ? encodeURIComponent(baseId) : '';
    return openDraw(id, profile.id, goBack, baseId);
  }
  screen = 'gallery';
  showGallery(profile, openDrawing, openProfiles, openArt);
  showAdded();
}

const pushed = () => Boolean(history.state && history.state.pushed);
const onBase = () => Boolean(history.state && history.state.base);
const addressOf = (hash) => (hash ? '#' + hash : location.pathname + location.search);
let lastBack = -1e9;  // when Back was last dealt with: the hash change that comes with it is not a navigation

// Shows the screen of an address, on the working entry.
function show(hash) {
  if (pushed()) history.replaceState({ pushed: true }, '', addressOf(hash));
  else history.pushState({ pushed: true }, '', addressOf(hash));
  route();
}

function pickProfile(id) {
  setCurrent(id);
  requestPersistence();
  startupPick = false;
  show('');
}

function openProfiles() { show('profils'); }
function openDrawing(d) { show(encodeURIComponent(d.id)); }
function openArt(id) { show('libre/' + encodeURIComponent(id)); }
function goBack() { show(up); }

// The start screen: who is colouring. The logo and the name of the app lead there from the gallery,
// and so does the session timer once the time is up.
function goHome() {
  startupPick = true;
  show('');
}
for (const e of document.querySelectorAll('#gallery .head .logo, #gallery .head h1')) e.addEventListener('click', goHome);

// The working entry, added after the first touch if nothing was opened yet.
function arm() {
  removeEventListener('pointerup', arm, true);
  removeEventListener('keydown', arm, true);
  setTimeout(() => {
    if (!onBase()) return;
    history.pushState({ pushed: true }, '', location.href);
    navlog('entrée de travail posée');
  });
}
addEventListener('pointerup', arm, true);
addEventListener('keydown', arm, true);

addEventListener('popstate', () => {
  if (!onBase()) return;  // the working entry, the padlock's or an address typed by hand: not a Back onto the first entry
  navlog(`retour depuis ${screen}`);
  // where Back leads: out of a drawing or the profiles to the gallery, from the gallery to the choice
  // of child when there are several, and nowhere from there
  let hash = decodeURIComponent(location.hash.slice(1)), move = false;
  if (screen === 'play' || screen === 'draw') { hash = up; move = true; }
  else if (screen === 'who') { hash = ''; move = true; }
  else if (screen === 'gallery' && profiles().length >= 2) { startupPick = true; hash = ''; move = true; }
  else if (screen === 'gallery' || screen === 'pick') hash = '';
  history.pushState({ pushed: true }, '', addressOf(hash));
  lastBack = performance.now();
  if (move) route();
});

addEventListener('hashchange', () => {
  if (performance.now() - lastBack < 400) return;
  route();
});

for (const b of document.querySelectorAll('.lang-switch')) {
  b.addEventListener('click', () => {
    setLanguage(lang() === 'fr' ? 'en' : 'fr');
    route();  // the screen shown is drawn again in the new language
  });
}

const showSound = () => { for (const b of document.querySelectorAll('.sound-switch')) b.classList.toggle('off', !soundOn()); };
for (const b of document.querySelectorAll('.sound-switch')) {
  b.addEventListener('click', () => {
    setSoundOn(!soundOn());
    showSound();
    sfx('pop');
  });
}
showSound();

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

if (!history.state) history.replaceState({ base: true }, '', location.href);
navlog('démarrage');
translatePage();
// the colouring pages imported on this phone join the gallery before it shows
try { await loadImported(); } catch (e) { console.error('imported pages not loaded:', e); }
try { await loadStickers(); preloadStamps(); showStickers(); } catch (e) { console.error('personal stickers not loaded:', e); }
route();
startTimer(goHome);
