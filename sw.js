// Offline support: every file of this version is cached at install, then served from the cache.
// A new version installs in the background and is used from the next start.
const VERSION = 'c97fe9a7';
const FILES = ["./", "avatars/bear.svg", "avatars/cat.svg", "avatars/dog.svg", "avatars/duck.svg", "avatars/fawn.svg", "avatars/fox.svg", "avatars/frog.svg", "avatars/hedgehog.svg", "avatars/lamb.svg", "avatars/mouse.svg", "avatars/owl.svg", "avatars/rabbit.svg", "avatars/red-panda.svg", "avatars/seal.svg", "avatars/squirrel.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.svg", "index.html", "js/art.js", "js/artstore.js", "js/draw.js", "js/drawings-data.js", "js/drawings.js", "js/gallery.js", "js/i18n.js", "js/lock.js", "js/main.js", "js/play.js", "js/profiles.js", "js/share.js", "js/sparkles.js", "js/store.js", "js/util.js", "manifest.webmanifest", "style.css"];
const CACHE = 'giuno-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('giuno-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
