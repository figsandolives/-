const CACHE_NAME = 'hrms-basma-pwa-v6';
const APP_SHELL = [
  './',
  './index.html',
  './app-version.json',
  './hr-data-snapshot.js',
  './jsQR.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function canCache(request,response){
  if(!response || !response.ok) return false;
  const url = new URL(request.url);
  return url.origin === location.origin;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  const isVersionFile = url.pathname.endsWith('/app-version.json') || url.pathname.endsWith('/sw.js');

  if(isVersionFile){
    event.respondWith(
      fetch(request, {cache:'no-store'}).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if(canCache(request,response)){
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('./index.html')))
  );
});
