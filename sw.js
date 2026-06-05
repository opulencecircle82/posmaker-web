const CACHE = 'posmaker-v7';
const STATIC = [
  'js/config.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Never intercept Supabase — let browser handle directly
  if (url.includes('supabase.co')) return;

  // Never cache HTML pages — always fetch fresh, bypassing browser + CDN cache
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html') || url.endsWith('.html')) {
    e.respondWith(fetch(e.request, {cache:'no-cache'}).catch(() => new Response('Offline — check your connection', {status:503, headers:{'Content-Type':'text/plain'}})));
    return;
  }

  // Static assets only — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === 'GET') {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    }))
  );
});
