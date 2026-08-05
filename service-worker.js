const CACHE_NAME = "rakaez-fingerprint-v7-attendance-alerts";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./notifications.css?v=20260805-attendance-alerts",
  "./login-phone.css",
  "./app.js?v=20260805-attendance-alerts",
  "./config.js",
  "./fingerprint-icon-192.png",
  "./fingerprint-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const notificationUrl = new URL("./?view=notifications", self.location.href).href;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(windows => {
      const existing = windows[0];
      if (existing) return existing.focus().then(() => existing.navigate(notificationUrl));
      return clients.openWindow(notificationUrl);
    })
  );
});
