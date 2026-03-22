// ── Empty Cups Service Worker ─────────────────────────────────────────────
// 版本號：每次更新靜態資源時，遞增 CACHE_VERSION
const CACHE_VERSION = 'v1';
const STATIC_CACHE  = `empty-cups-static-${CACHE_VERSION}`;
const CDN_CACHE     = `empty-cups-cdn-${CACHE_VERSION}`;

// ── 本地靜態檔案（每次都從快取優先）────────────────────────────────────────
const STATIC_ASSETS = [
  './index.html',
  './manifest.json',
  './tailwind.css',
  './react.production.min.js',
  './react-dom.production.min.js',
  './elements.cardmeister.full.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── CDN 資源（網路優先，失敗時走快取）──────────────────────────────────────
const CDN_ORIGINS = [];

// ── Install：預先快取靜態資源 ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate：清除舊版快取 ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== CDN_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch：攔截請求 ───────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 非 GET 請求不攔截
  if (event.request.method !== 'GET') return;

  const isCDN = CDN_ORIGINS.some((origin) => event.request.url.startsWith(origin));

  if (isCDN) {
    // CDN：網路優先，失敗時走快取（確保 CDN 有更新時能取到新版）
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CDN_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // 本地靜態資源：快取優先，快取不存在時走網路
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
