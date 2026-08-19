const CACHE_NAME = 'finanzas-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A simple pass-through fetch handler is enough to satisfy PWA installability
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response('Estás sin conexión.');
    })
  );
});
