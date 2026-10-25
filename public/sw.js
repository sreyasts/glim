self.addEventListener('push', event => {
  if (!event.data) return;
  let message;
  try { message = event.data.json(); } catch { return; }
  event.waitUntil(self.registration.showNotification(message.title || 'A little update from Glim', {
    body: message.body || '', icon: '/favicon.svg', tag: message.tag || 'glim',
    data: { url: typeof message.url === 'string' && message.url.startsWith('/?camera=') ? message.url : '/' },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    for (const client of clients) {
      if ('focus' in client) { await client.navigate(url); return client.focus(); }
    }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
