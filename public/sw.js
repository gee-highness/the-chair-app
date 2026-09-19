// public/sw.js
const CACHE_VERSION = 'chair-app-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/logo-192.png',
  '/logo-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      // NOT cache.addAll(): addAll is atomic and rejects the whole install
      // if a single asset 404s, silently breaking every offline feature
      // (audit finding). Cache each asset independently instead — one
      // missing icon shouldn't take down the service worker.
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          fetch(url).then((response) => {
            if (response.ok) return cache.put(url, response);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith(CACHE_VERSION)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip API requests (let them go through)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((cached) => cached || new Response('Offline')))
    );
    return;
  }

  // Cache-first for static assets
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/)) {
    event.respondWith(
      caches.match(request).then((response) => {
        return (
          response ||
          fetch(request).then((response) => {
            const clonedResponse = response.clone();
            caches.open(STATIC_CACHE).then((cache) => {
              cache.put(request, clonedResponse);
            });
            return response;
          })
        );
      })
    );
    return;
  }

  // Network-first for HTML and other requests
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clonedResponse = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => {
          cache.put(request, clonedResponse);
        });
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('/').then((home) => home || caches.match('/offline.html')))
      )
  );
});
