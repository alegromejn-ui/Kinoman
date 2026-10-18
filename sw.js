/* Сервісний воркер: каркас додатка відкривається без інтернету.
   Сторінка береться з мережі (щоб приходили оновлення), а коли мережі немає, з кешу.
   Постери з інших адрес кешуються окремо (кеш зображень), щоб вони відкривалися й без інтернету. */
const VERSION = 'kinoman-v26';
const IMG = 'kinoman-img';
const IMG_MAX = 400;
const IMG_HOSTS = ['m.media-amazon.com', 'image.tmdb.org'];
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'ui.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/onest-cyrillic-ext-wght-normal.woff2', 'fonts/onest-cyrillic-wght-normal.woff2', 'fonts/onest-latin-ext-wght-normal.woff2', 'fonts/onest-latin-wght-normal.woff2',
  'fonts/unbounded-cyrillic-ext-wght-normal.woff2', 'fonts/unbounded-cyrillic-wght-normal.woff2', 'fonts/unbounded-latin-wght-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== IMG).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    // лише прості запити зображень (<img>); запити з CORS (картинка для поширення) йдуть напряму
    if (req.destination === 'image' && req.mode === 'no-cors' && url.protocol === 'https:' && IMG_HOSTS.indexOf(url.hostname) >= 0) e.respondWith(poster(req));
    return;
  }
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

async function poster(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - IMG_MAX; i++) await cache.delete(keys[i]);
    }
    return res;
  } catch (err) {
    return Response.error();
  }
}
