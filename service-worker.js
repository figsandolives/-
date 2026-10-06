const CACHE_NAME = "rakaez-fingerprint-v16-portal-update";
const APP_SHELL = [
  "./services.css?v=20261006-portal-update",
  "./my-deductions.js?v=20261006-my-deductions",
  "./payroll-core.js?v=20261006-my-deductions",
  "./",
  "./index.html",
  "./style.css",
  "./notifications.css?v=20261006-portal-update",
  "./login-phone.css",
  "./app.js?v=20261006-portal-update",
  "./config.js",
  "./fingerprint-icon-192.png",
  "./fingerprint-icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const oldKeys = (await caches.keys()).filter(key => key.startsWith("rakaez-fingerprint-") && key !== CACHE_NAME);
    await Promise.all(oldKeys.map(key => caches.delete(key)));
    await self.clients.claim();
    // Existing installed apps need to load the document that references the new modules.
    if (oldKeys.length) {
      const windows = await self.clients.matchAll({type:"window"});
      // Do not await navigation: its fetch waits for activation to finish.
      windows.forEach(client => { client.navigate(client.url).catch(() => {}); });
    }
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) { const copy=response.clone(); event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy))); }
      return response;
    }).catch(async()=> (await caches.match(event.request)) || caches.match("./index.html")));
    return;
  }
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
