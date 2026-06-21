import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// Precache assets injected by vite-plugin-pwa at build time
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST ?? []);

self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json() as { title: string; body: string; url?: string };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:      data.body,
      icon:      '/logo-192.png',
      badge:     '/logo-192.png',
      data:      { url: data.url ?? '/comprobantes' },
      tag:       'jas-store',
      renotify:  true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data as { url?: string } | null;
  const url = notifData?.url ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
