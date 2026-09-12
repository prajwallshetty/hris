/* eslint-disable no-restricted-globals */
// Expand Arabia HRIS - Production Safe Service Worker
const CACHE_NAME = "expand-arabia-hris-v1";

const STATIC_PRECACHE = [
  "/offline",
  "/branding/expand-arabia-logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-192.png",
  "/icons/maskable-512.png",
  "/icons/favicon.png",
];

// Install: precache offline fallback and essential brand assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old cache generations
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: enforce strict security & freshness policies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Non-GET requests (mutations, server actions): STRICT NETWORK-ONLY
  if (request.method !== "GET") {
    return;
  }

  // 2. API endpoints and sensitive data routes: STRICT NETWORK-ONLY
  // Never cache financial data, payroll, invoices, auth credentials, or personal documents.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/auth/") ||
    url.pathname.includes("_next/data") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-State-Tree")
  ) {
    return;
  }

  // 3. Navigation requests (HTML pages): Network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If response is valid, return it directly
          return response;
        })
        .catch(async () => {
          // If network failed, serve the branded offline fallback page
          const cache = await caches.open(CACHE_NAME);
          const offlineResponse = await cache.match("/offline");
          if (offlineResponse) {
            return offlineResponse;
          }
          return new Response(
            "<html><body><h1>Offline</h1><p>You are currently offline. Please reconnect to use Expand Arabia HRIS.</p></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // 4. Static assets (JS/CSS bundles, fonts, icons, branding images): Cache-first with network fallback
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/branding/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|woff2|woff|ttf|ico|css|js)$/);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
