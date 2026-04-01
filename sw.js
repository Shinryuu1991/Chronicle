const CACHE = 'quest-log-v2';

const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/levels.js',
  './js/storage.js',
  './js/fx.js',
  './js/app.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=MedievalSharp&family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,500;1,300;1,400&family=IM+Fell+English:ital@0;1&display=swap',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
