// Service worker: оболочка сайта работает офлайн, обновления подхватываются сразу (network-first).
const CACHE = 'trueestimation-v2';
const SHELL = ['./', 'index.html', 'script.js', 'styles.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // кэшируем только свои GET-файлы; аудио, Supabase и CDN не трогаем
  if (req.method !== 'GET' || url.origin !== location.origin || req.headers.has('range') || req.destination === 'audio') return;
  e.respondWith(
    fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html')))
  );
});
