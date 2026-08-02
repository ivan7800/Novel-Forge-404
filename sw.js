const CACHE_NAME = 'novel-forge-404-v1.4.0';
const ROOT_URL = new URL('./', self.registration.scope).href;
const INDEX_URL = new URL('index.html', self.registration.scope).href;
const APP_SHELL = [
  ROOT_URL,
  INDEX_URL,
  new URL('styles.css', self.registration.scope).href,
  new URL('app.js', self.registration.scope).href,
  new URL('manifest.webmanifest', self.registration.scope).href,
  new URL('assets/icon.svg', self.registration.scope).href,
  new URL('assets/icon-192.png', self.registration.scope).href,
  new URL('assets/icon-512.png', self.registration.scope).href
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(INDEX_URL)) || (await caches.match(ROOT_URL)))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
