/* Сервісний воркер: каркас додатка відкривається без інтернету.
   Сторінка береться з мережі (щоб приходили оновлення), а коли мережі немає, з кешу.
   Постери з інших адрес кешуються окремо (кеш зображень), щоб вони відкривалися й без інтернету. */
const VERSION = 'kinoman-v37';
const IMG = 'kinoman-img';
const IMG_MAX = 400;
const IMG_HOSTS = ['m.media-amazon.com', 'image.tmdb.org'];
const SHELL = ['./', 'index.html', 'styles.css', 'core.js', 'ui.js', 'manifest.json', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'fonts/onest-cyrillic-ext-wght-normal.woff2', 'fonts/onest-cyrillic-wght-normal.woff2', 'fonts/onest-latin-ext-wght-normal.woff2', 'fonts/onest-latin-wght-normal.woff2',
  'fonts/unbounded-cyrillic-ext-wght-normal.woff2', 'fonts/unbounded-cyrillic-wght-normal.woff2', 'fonts/unbounded-latin-wght-normal.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
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
    e.respondWith(navigate(req));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    // свіжа копія з сервера, а не з кешу браузера (інакше після оновлення може лишитися стара версія)
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
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

// Відкриття сторінки: інтернет чекаємо максимум 3 с, далі збережена копія (а свіжа підтягнеться фоном).
// Так додаток відкривається і без мережі, і за дуже слабкого зв’язку, коли запит «висить».
const NAV_WAIT = 3000;
function offlinePage() {
  return new Response('<!doctype html><html lang="uk"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Немає зв’язку</title>' +
    '<body style="font:16px/1.5 system-ui,sans-serif;background:#111;color:#eee;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center">' +
    '<div><h1 style="font-size:20px">Немає зв’язку</h1><p>Додаток ще не встиг зберегтися в телефоні. Підключіться до інтернету й відкрийте його ще раз.</p>' +
    '<p><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:12px;border:0">Спробувати ще раз</button></p></div></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function navigate(req) {
  const cached = () => caches.match('index.html', { ignoreSearch: true }).then(r => r || caches.match('./', { ignoreSearch: true }));
  const net = fetch(req, { cache: 'no-cache' }).then(res => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put('index.html', copy)); }
    return res;
  });
  const quick = Promise.race([net.catch(() => null), new Promise(r => setTimeout(() => r(null), NAV_WAIT))]);
  return quick.then(res => {
    if (res && res.ok) return res;
    return cached().then(hit => hit || net.then(r => (r && r.ok ? r : offlinePage()), () => offlinePage()));
  });
}
