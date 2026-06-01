const CACHE = 'posmaker-v5';
// HTML pages use network-first so updates deploy immediately.
// Other static assets (icons, config) use cache-first for offline support.
const HTML_FILES = ['cashier.html', 'dashboard.html'];
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
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => Promise.all(clients.map(c => c.navigate(c.url))))
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Supabase API — never intercept, let browser handle all requests directly
  if (url.includes('supabase.co')) return;
  // HTML pages — network-first so fixes deploy immediately; fallback to cache offline
  const isHtml = HTML_FILES.some(f => url.endsWith(f) || url.endsWith(f + '?') || url.includes(f + '?'));
  if (isHtml || e.request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // Everything else — cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === 'GET') {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    }))
  );
});
