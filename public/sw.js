const CACHE_NAME = 'mhtoolkit-wellbeing-v1';
const OFFLINE_PATHS = ['/mind-games'];

async function precacheOfflinePaths() {
  const cache = await caches.open(CACHE_NAME);

  for (const path of OFFLINE_PATHS) {
    try {
      const response = await fetch(path, { cache: 'reload' });
      if (!response.ok) continue;

      await cache.put(path, response.clone());
      const html = await response.text();
      const assetPaths = Array.from(
        html.matchAll(/(?:src|href)="([^"]+)"/g),
        (match) => match[1]
      ).filter((assetPath) => assetPath.startsWith('/_next/'));

      await Promise.allSettled(
        Array.from(new Set(assetPaths)).map((assetPath) => cache.add(assetPath))
      );
    } catch {
      // The runtime cache can fill on the next successful online visit.
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheOfflinePaths());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('mhtoolkit-') && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && (url.pathname === '/mind-games' || url.pathname.startsWith('/_next/'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || Response.error()))
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'MHtoolkit reminder',
    body: 'A small step is ready when you are.',
    route: '/habits',
    tag: 'mhtoolkit-reminder',
  };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      data: { route: payload.route },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data?.route || '/dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        existing.navigate(route);
        return existing.focus();
      }
      return self.clients.openWindow(route);
    })
  );
});
