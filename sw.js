const CACHE_NAME = 'academia-c1-v4';
const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data.js',
  './plan.js',
  './ai.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Solo cacheamos lo nuestro (no la API de Claude, ni el CDN, ni Google Fonts)
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return;
  // "Red primero": con internet coges siempre la última versión; sin
  // internet, la copia guardada. Así la app funciona offline.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
