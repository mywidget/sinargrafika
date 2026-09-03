
const CACHE_NAME = 'printpro-cache-v1788449021492';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Hanya tangani permintaan GET
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  
  // Lewati caching untuk API, Pusher, atau data dinamis eksternal
  if (url.includes('/api/') || url.includes('/apiv2/') || url.includes('apiv2') || url.includes('pusher.com')) {
    return;
  }

  // Network-First (Jaringan dahulu, cadangan ke Cache jika offline)
  // Strategi ini memastikan pengguna selalu mendapatkan versi aplikasi terbaru secara instan saat online.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Simpan salinan respon baru ke dalam Cache jika status sukses (200)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Jika jaringan gagal (offline), ambil dari Cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Jika tidak ada di cache dan mencari dokumen HTML, arahkan ke Root (SPA fallback)
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/');
          }
        });
      })
  );
});