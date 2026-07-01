self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const title = data.title || '알림'
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: { url: data.url || '/' },
  }

  const badgePromise = ('setAppBadge' in navigator)
    ? navigator.setAppBadge().catch(() => {})
    : Promise.resolve()

  event.waitUntil(
    Promise.all([
      Promise.resolve(self.registration.showNotification(title, options)),
      badgePromise,
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  if ('clearAppBadge' in navigator) {
    navigator.clearAppBadge()
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        if (windowClients.length > 0 && 'focus' in windowClients[0]) {
          windowClients[0].focus()
          windowClients[0].navigate(url)
          return
        }
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
  )
})
