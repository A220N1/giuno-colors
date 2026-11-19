// Offline support: every file of this version is cached at install, then served from the cache.
// A new version installs in the background and is used from the next start.
const VERSION = 'e2682b75';
const FILES = ["./", "avatars/bear.svg", "avatars/cat.svg", "avatars/dog.svg", "avatars/duck.svg", "avatars/fawn.svg", "avatars/fox.svg", "avatars/frog.svg", "avatars/hedgehog.svg", "avatars/lamb.svg", "avatars/mouse.svg", "avatars/owl.svg", "avatars/rabbit.svg", "avatars/red-panda.svg", "avatars/seal.svg", "avatars/squirrel.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/logo.svg", "index.html", "js/art.js", "js/artstore.js", "js/backup.js", "js/brushes.js", "js/draw.js", "js/drawings-data.js", "js/drawings.js", "js/gallery.js", "js/i18n.js", "js/images.js", "js/importer.js", "js/lock.js", "js/main.js", "js/nature.js", "js/play.js", "js/profiles.js", "js/share.js", "js/sparkles.js", "js/store.js", "js/util.js", "manifest.webmanifest", "stamps/1F308.svg", "stamps/1F319.svg", "stamps/1F338.svg", "stamps/1F33B.svg", "stamps/1F353.svg", "stamps/1F366.svg", "stamps/1F381.svg", "stamps/1F382.svg", "stamps/1F388.svg", "stamps/1F3F0.svg", "stamps/1F419.svg", "stamps/1F41E.svg", "stamps/1F422.svg", "stamps/1F427.svg", "stamps/1F42C.svg", "stamps/1F431.svg", "stamps/1F436.svg", "stamps/1F43C.svg", "stamps/1F451.svg", "stamps/1F680.svg", "stamps/1F984.svg", "stamps/1F98B.svg", "stamps/1F995.svg", "stamps/1F9C1.svg", "stamps/2600.svg", "stamps/2764.svg", "stamps/2B50.svg", "style.css"];
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
