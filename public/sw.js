const CACHE_NAME = 'xml-converter-v1';
const urlsToCache = [
  '/images/trinity-logo.webp',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Only cache files that exist, ignore errors
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(err => console.log('Failed to cache:', url))
          )
        );
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip caching for dev server hot reload and source files
  if (event.request.url.includes('/@vite') || 
      event.request.url.includes('/@fs') ||
      event.request.url.includes('.tsx') ||
      event.request.url.includes('.ts') ||
      event.request.url.includes('node_modules')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).catch(() => {
          // Return a basic response if fetch fails
          return new Response('Offline', { status: 503 });
        });
      })
  );
});