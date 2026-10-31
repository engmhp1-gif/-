/**
 * Service Worker for Procedure 155 Platform
 * Handles background push notifications, offline assets, and app lifecycle
 * Works even when the browser tab or app is closed!
 */

const CACHE_NAME = 'procedure-155-v2';

// Install event - skip waiting to activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate event - claim all open clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push event - received even when the browser / tab / app is completely closed!
self.addEventListener('push', (event) => {
  let data = {
    title: 'تنبيه جديد - منصة إجراء 155',
    body: 'تم تنفيذ إجراء جديد في منظومة تدقيق أوامر العمل',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `p155-${Date.now()}`,
    url: '/',
    timestamp: Date.now()
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const notificationTitle = data.title || 'منصة تدقيق أوامر العمل - إجراء 155';
  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icon.svg',
    badge: data.badge || '/icon.svg',
    vibrate: [300, 100, 300, 100, 300],
    tag: data.tag || `p155-order-${Date.now()}`,
    renotify: true,
    requireInteraction: true, // Remains on user's screen until acknowledged or dismissed
    lang: 'ar',
    dir: 'rtl',
    timestamp: data.timestamp || Date.now(),
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now(),
      ...(data.data || {})
    },
    actions: [
      {
        action: 'open_app',
        title: '👁️ فتح المنصة والاطلاع'
      },
      {
        action: 'dismiss',
        title: 'إغلاق'
      }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(notificationTitle, notificationOptions),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: data
          });
        });
      })
    ])
  );
});

// Notification click event - brings user to the platform or focuses existing window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing window/tab of the app is already open, focus it and notify
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: event.notification.data
          });
          if (client.url && !client.url.includes(targetUrl) && 'navigate' in client) {
            client.navigate(targetUrl);
          }
          return;
        }
      }

      // 2. If the platform or browser tab was closed, open a fresh window!
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Background sync support (if network was temporarily disconnected)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGERED' });
        });
      })
    );
  }
});
