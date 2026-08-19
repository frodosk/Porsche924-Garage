/* Porsche 924 Garage — Service Worker (App-Shell-Caching) */

const CACHE_NAME = 'p924-garage-v1';
const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/data.js',
  './js/sync.js',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache Firestore/Firebase or Google API calls — always go to network.
  if (url.hostname.includes('firestore') || url.hostname.includes('googleapis') || url.hostname.includes('gstatic') && url.pathname.includes('firebase')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
