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


// =========================================================
// WEB-PUSH: додай ЦЕ В КІНЕЦЬ файлу sw.js (у корені репо)
// Нічого зі старого sw.js не міняй — це просто нові слухачі.
// =========================================================

// Прийшов пуш із сервера (Edge Function) → показуємо сповіщення
self.addEventListener('push', function(event) {
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch (e) { data = { body: event.data ? event.data.text() : '' }; }

  var title = data.title || 'ХочуКупити';
  var options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
    tag: data.tag || undefined,          // однаковий tag «схлопує» дублі
    renotify: !!data.tag
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Клік по сповіщенню → фокус на вкладку або відкрити потрібний екран
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if ('focus' in c) {
          c.focus();
          if (url !== '/' && 'navigate' in c) { try { c.navigate(url); } catch (e) {} }
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});