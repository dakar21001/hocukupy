// ХочуКупити — service worker (PWA)
// Стратегія: HTML (навігації) — network-first (щоб бачити свіжий деплой), офлайн-фолбек із кешу.
// Своя статика (іконки) — cache-first. Supabase/CDN — не кешуємо, йдуть у мережу як є.
var CACHE = 'hocukupy-v1';
var CORE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(CORE).catch(function() {}); }));
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // Кешуємо лише власний origin. Supabase (auth/API/realtime) і CDN — завжди мережа.
  if (url.origin !== self.location.origin) return;

  // Навігації (HTML) — network-first: свіжий деплой онлайн, кеш офлайн.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put('/', copy); });
        return res;
      }).catch(function() {
        return caches.match('/').then(function(m) { return m || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Своя статика — cache-first.
  e.respondWith(
    caches.match(req).then(function(m) {
      return m || fetch(req).then(function(res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
