const CACHE = 'posmaker-v8';
const STATIC = [
  'js/config.js',
  'js/store-plan.js',
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

  // HTML pages — network-first, fall back to cached version when offline
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html') || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, {cache:'no-cache'})
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(e.request).then(cached =>
          cached || new Response(
            '<!DOCTYPE html><html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#09090f;color:#f0f0f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;text-align:center;padding:20px}h2{color:#00b4d8}p{color:#8888aa;font-size:14px}</style></head><body><h2>⚠ Offline</h2><p>Open the POS at least once while online to enable offline access.</p></body></html>',
            {headers:{'Content-Type':'text/html;charset=utf-8'}}
          )
        ))
    );
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
