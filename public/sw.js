const CACHE_NAME = 'vaishnavi-crm-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache local asset requests. Do not intercept Firebase or external API traffic.
  if (event.request.url.startsWith(self.location.origin)) {
    const url = new URL(event.request.url);
    if (!url.pathname.startsWith('/api') && !url.pathname.startsWith('/_next')) {
      event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).catch(() => {
            // Optional offline fallback for page navigation
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
          });
        })
      );
    }
  }
});
