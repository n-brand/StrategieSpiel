// Service Worker: macht StrategieSpiel installierbar und offline spielbar.
// - Eigene Dateien: zuerst das Netz (immer der neueste Stand, auch beim Entwickeln),
//   ohne Netz – oder wenn es zu lange dauert – die gespeicherte Fassung.
// - Three.js und die Schrift (fremde Server, feste Versionen): aus dem Speicher, sonst Netz.
// Neue Datei im Spiel → in ASSETS eintragen (tests/pwa.test.mjs prüft, dass nichts fehlt).
// VERSION erhöhen, wenn sich diese Liste oder die Logik hier ändert – alte Speicher werden dann gelöscht.

const VERSION = 5;
const CACHE = `kleine-reiche-v${VERSION}`;
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap';
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'js/main.js',
  'js/audio.js',
  'js/pwa.js',
  'js/game/ai.js',
  'js/game/engine.js',
  'js/game/mapgen.js',
  'js/game/rng.js',
  'js/game/rules.js',
  'js/ui/ui.js',
  'js/ui/panzoom.js',
  'js/ui/techicons.js',
  'js/ui/techinfo.js',
  'js/ui/techlayout.js',
  'js/ui/techtree.js',
  'js/view/board.js',
  'js/view/camera.js',
  'js/view/fire.js',
  'js/view/models.js',
  'js/view/scene.js',
  'js/view/thumbs.js',
  'icons/icon.svg',
  'icons/icon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // cache: 'reload' → frisch vom Server, nicht aus dem Browser-Cache
      await cache.addAll([...ASSETS.map((a) => new Request(new URL(a, self.location), { cache: 'reload' })), THREE]);
      await cacheFont(cache).catch(() => {}); // Schrift ist schön, aber nicht nötig (sonst Systemschrift)
      await self.skipWaiting();
    })(),
  );
});

// Schrift-CSS und die darin genannten Schriftdateien speichern
async function cacheFont(cache) {
  const res = await fetch(FONT_CSS);
  if (!res.ok) return;
  const css = await res.clone().text();
  await cache.put(FONT_CSS, res);
  const files = new Set([...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)\s]+)\)/g)].map((m) => m[1]));
  await Promise.all([...files].map((url) => cache.add(url).catch(() => {})));
}

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Nur eigene, veraltete Speicher löschen (andere Spiele auf derselben Domain bleiben unberührt)
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('kleine-reiche-') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    const network = fetch(req);
    event.waitUntil(store(req, network)); // vor respondWith: Kopie entsteht, bevor die Seite liest
    event.respondWith(networkFirst(req, network));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(event, req));
  }
});

// Frische Antwort für offline merken (nur vollständige, eigene Antworten)
function store(req, network) {
  return network
    .then((res) => {
      if (res.status !== 200 || res.type !== 'basic') return undefined;
      const copy = res.clone();
      return caches.open(CACHE).then((cache) => cache.put(req, copy));
    })
    .catch(() => {});
}

async function networkFirst(req, network) {
  let timer;
  const slow = new Promise((resolve) => {
    timer = setTimeout(resolve, NETWORK_TIMEOUT, null);
  });
  try {
    const res = await Promise.race([network, slow]);
    if (res) return res;
  } catch {
    // offline
  } finally {
    clearTimeout(timer);
  }
  const cache = await caches.open(CACHE);
  const navigate = req.mode === 'navigate';
  const hit = (await cache.match(req, { ignoreSearch: navigate })) || (navigate ? await cache.match(self.registration.scope) : undefined);
  return hit || network; // nichts gespeichert: doch auf das Netz warten
}

async function cacheFirst(event, req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') {
    const copy = res.clone();
    const saving = cache.put(req, copy).catch(() => {});
    try {
      event.waitUntil(saving);
    } catch {
      // Ereignis schon beendet – Speichern läuft trotzdem
    }
  }
  return res;
}
