const CACHE = 'posmaker-v13';
const STATIC = [
  'js/config.js',
  'js/store-plan.js',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  // All cashier pages — pre-cached so they open offline immediately
  'cashier.html',
  'cashier-agrisupply.html',
  'cashier-autoparts.html',
  'cashier-bakery.html',
  'cashier-barbershop.html',
  'cashier-bigasan.html',
  'cashier-buffet.html',
  'cashier-carinderya.html',
  'cashier-clothing.html',
  'cashier-coffeeshop.html',
  'cashier-drugstore.html',
  'cashier-electronics.html',
  'cashier-fastfood.html',
  'cashier-furniture.html',
  'cashier-hardware.html',
  'cashier-laundry.html',
  'cashier-lechon.html',
  'cashier-milktea.html',
  'cashier-petstore.html',
  'cashier-pizzapasta.html',
  'cashier-printing.html',
  'cashier-sarisari.html',
  'cashier-schoolsupplies.html',
  'cashier-seafood.html',
  'cashier-snackbar.html'
];

self.addEventListener('message', e => {
  if(e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if(e.data?.type === 'CACHE_PAGE') {
    const url = e.data.url;
    const base = url.split('?')[0];
    e.waitUntil(
      caches.open(CACHE).then(c =>
        fetch(base, {cache:'no-cache'}).then(r => {
          if(r && r.ok) { c.put(base, r.clone()); c.put(url, r.clone()); }
        }).catch(()=>{})
      )
    );
  }
});

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // Cache each file individually so one failure doesn't block the rest
      Promise.all(STATIC.map(url => c.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
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

  // Only intercept same-origin requests — let the browser handle CDN/external resources
  if (!url.startsWith(self.location.origin)) return;

  // Never intercept Supabase API calls
  if (url.includes('supabase.co')) return;

  // HTML pages — network-first, cache on success, serve cached version when offline
  if (e.request.mode === 'navigate' || e.request.headers.get('accept')?.includes('text/html') || url.endsWith('.html')) {
    e.respondWith(
      fetch(e.request, {cache:'no-cache'})
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE).then(c => {
              c.put(e.request, resp.clone());
              // Also cache without query string so bookmarks work offline
              const base = url.split('?')[0];
              if (base !== url) c.put(base, resp.clone());
            });
          }
          return resp;
        })
        .catch(() =>
          // Try exact URL first, then base URL without query string
          caches.match(e.request).then(cached => {
            if (cached) return cached;
            const base = url.split('?')[0];
            return caches.match(base).then(baseCached =>
              baseCached || new Response(
                '<!DOCTYPE html><html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#09090f;color:#f0f0f8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:12px;text-align:center;padding:20px}h2{color:#00b4d8}p{color:#8888aa;font-size:14px}</style></head><body><h2>⚠ Offline</h2><p>Open the POS at least once while online to enable offline access.</p></body></html>',
                {headers:{'Content-Type':'text/html;charset=utf-8'}}
              )
            );
          })
        )
    );
    return;
  }

  // store-plan.js — network-first so offline bootstrap updates are always fresh
  if (url.includes('/js/store-plan.js')) {
    e.respondWith(
      fetch(e.request, {cache: 'no-cache'})
        .then(resp => {
          if (resp && resp.status === 200) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // All other static assets — cache-first for speed
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      if (resp && resp.status === 200 && e.request.method === 'GET') {
        caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
      }
      return resp;
    }))
  );
});
