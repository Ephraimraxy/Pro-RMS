// Push notification handler — imported by the generated service worker
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'RMS Portal';
  const url = data.url ?? '/';
  const options = {
    body: data.body ?? 'You have a new update.',
    icon: '/CSS_Favicon.png',
    badge: '/CSS_Favicon.png',
    tag: data.tag ?? `rms-${Date.now()}`,
    renotify: true,
    data: { url },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If app is already open, navigate the focused window to the target URL
      for (const client of list) {
        if ('navigate' in client) {
          client.navigate(url);
          client.focus();
          return;
        }
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      // No window open — open a new one
      return clients.openWindow(url);
    })
  );
});
