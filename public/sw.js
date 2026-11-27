// Ketoko POS & Portal Karyawan - Offline-First Service Worker
const CACHE_NAME = 'ketoko-pos-pwa-v28';

const STATIC_PRECACHE = [
  '/',
  '/index.html',
  '/karyawan',
  '/manifest.json',
  '/manifest-karyawan.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-koperasi.svg',
  '/icon-koperasi-192.png',
  '/icon-koperasi-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(STATIC_PRECACHE.map((u) => cache.add(u)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle HTTP/HTTPS GET requests from same origin
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Do not intercept external API calls (e.g. Supabase, CDNs, Cloudflare tunnels)
  if (url.origin !== self.location.origin) {
    return;
  }

  // API LAN selalu langsung ke jaringan tanpa di-cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req));
    return;
  }

  // Portal Karyawan (/karyawan & /karyawan.html) -> Network-first segar, fallback ke cache bila offline di kebun
  if (url.pathname.startsWith('/karyawan')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/karyawan', copy.clone());
              cache.put(req, copy);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(req).then((m) => m || caches.match('/karyawan') || caches.match('/karyawan.html'));
        })
    );
    return;
  }

  // Navigation requests (HTML pages) -> Network first, cache update, fallback to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // JS & CSS Bundles -> Network-first agar update kode terbaru langsung aktif, fallback ke cache saat offline
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static Assets lainnya (Images, Fonts, Manifest, Icons) -> Stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
