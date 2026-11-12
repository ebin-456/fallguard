// FallGuard Monitor - Progressive Web App Service Worker
// Cache-First offline strategy for app assets; Network-Only bypass for ESP32 hardware endpoints

const CACHE_NAME = 'fallguard-cache-v1';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install: Precache shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Precache failed partially (dev mode assets will be cached on demand):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: Claim clients and purge stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Intercept requests
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. HARDWARE ENDPOINT BYPASS:
  // Never cache live sensor polling (/data) or remote alert cancellations (/cancel)
  // or requests going directly to local IPs / ESP32 AP
  if (
    url.pathname.endsWith('/data') ||
    url.pathname.endsWith('/cancel') ||
    url.hostname === '192.168.4.1' ||
    url.hostname.startsWith('192.168.') ||
    url.hostname.endsWith('.local')
  ) {
    // Network-only bypass with no caching
    event.respondWith(
      fetch(request).catch((err) => {
        // Return 503 so client-side poll catches disconnection cleanly
        return new Response(
          JSON.stringify({ error: 'Device offline or unreachable', offline: true }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // 2. Navigation requests: App Shell fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 3. Static assets (JS, CSS, SVGs, Fonts): Cache-First with Network fallback & cache update
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached immediately, fetch in background to revalidate if online
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          })
          .catch(() => {
            // Offline - ignore background refresh failure
          });
        return cachedResponse;
      }

      // If not cached, fetch from network and cache for next time
      return fetch(request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache);
        });
        return networkResponse;
      });
    })
  );
});
