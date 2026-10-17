/* Сервісний воркер: каркас додатка відкривається без інтернету.
   Сторінка береться з мережі (щоб приходили оновлення), а коли мережі немає, з кешу.
   Запити до OMDb і постери йдуть на інші адреси й сюди не потрапляють. */
const VERSION = 'kinoman-v7';
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'ui.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/onest-cyrillic-ext-wght-normal.woff2', 'fonts/onest-cyrillic-wght-normal.woff2', 'fonts/onest-latin-ext-wght-normal.woff2', 'fonts/onest-latin-wght-normal.woff2',
  'fonts/unbounded-cyrillic-ext-wght-normal.woff2', 'fonts/unbounded-cyrillic-wght-normal.woff2', 'fonts/unbounded-latin-wght-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match('index.html').then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
