const CACHE_NAME = 'finanzas-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept Firebase Auth, Google, or cross-origin calls.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/auth') || url.pathname.startsWith('/__/firebase')) return;

  event.respondWith(fetch(request));
});
