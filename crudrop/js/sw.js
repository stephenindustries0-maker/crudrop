const CACHE_NAME = 'crudrop-v3';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // 1. Don't cache API requests
  if (e.request.url.includes('/api/')) return fetch(e.request);
  
  // 2. Network First strategy (Always try to get live data from Vercel)
  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // If network works, save a copy to cache
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // If offline, serve from cache
        return caches.match(e.request);
      })
  );
});