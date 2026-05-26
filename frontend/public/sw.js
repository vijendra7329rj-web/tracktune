const CACHE_NAME = "tracktune-v2";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Handle share target
  if (event.request.url.includes('/?shared_url=')) {
    return; // Let it hit network/browser handler
  }
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
