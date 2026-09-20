// Service Worker para push notifications de AppleFamily Tree.
// Recibe push events del servidor, muestra la notificación al usuario y
// abre el app en la ruta correcta al hacer clic.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'AppleFamily Tree', body: 'Tienes una nueva notificación' }
  }

  const title = payload.title || 'AppleFamily Tree'
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || 'af-notif',
    data: {
      url: payload.url || '/',
      notificationId: payload.notificationId || null,
    },
    requireInteraction: false,
    vibrate: [80, 40, 80],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si hay una ventana del app abierta, la enfocamos.
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('postMessage' in client) {
            client.postMessage({ type: 'notification-click', url: targetUrl })
          }
          return
        }
      }
      // Si no hay ventana, abrimos una nueva.
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})
