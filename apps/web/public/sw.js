// Service Worker para push notifications de AppleFamily Tree.
// Recibe push events del servidor, muestra la notificación al usuario y
// abre el app en la ruta correcta al hacer clic.
//
// Reglas de UX (v2):
//  - Cada notificación tiene tag ÚNICO (notificationId) → nunca se reemplaza
//    silenciosamente y todas se acumulan en la bandeja del sistema hasta que
//    el usuario las descarte.
//  - requireInteraction = true → la notif permanece visible hasta que el
//    usuario la toque o la descarte (importante en Android/Windows).
//  - renotify = true → si excepcionalmente llegara el mismo tag, vuelve a
//    sonar/vibrar (por defecto Chrome silencia el reemplazo).
//  - Al hacer clic, si el app ya está abierto lo enfocamos y le mandamos un
//    postMessage para navegar sin recargar.

const SW_VERSION = 'v2-2026-09-21'

self.addEventListener('install', () => {
  // Se activa de inmediato sin esperar a que se cierren las pestañas viejas.
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
  const notificationId = payload.notificationId || `af-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // El server puede marcar una notif como "silent" (no importante). Por
  // default TODAS son persistentes: se quedan hasta que el usuario las quite.
  const important = payload.important !== false

  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // tag único = cada notif se apila. Nunca reemplaza la anterior.
    tag: payload.tag || notificationId,
    // Si el server sí reusa un tag (ej. mismo chat), renotify garantiza que
    // el usuario reciba aviso audible/vibración de la nueva.
    renotify: true,
    // Persistencia: la notif no se auto-cierra.
    requireInteraction: important,
    silent: false,
    vibrate: [120, 60, 120, 60, 120],
    timestamp: payload.timestamp || Date.now(),
    data: {
      url: payload.url || '/',
      notificationId: payload.notificationId || null,
      swVersion: SW_VERSION,
    },
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

// Permite que la UI pida al SW que se actualice (skip waiting) cuando publicamos
// una versión nueva.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
