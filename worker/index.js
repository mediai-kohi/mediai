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

  const badgePromise = (async () => {
    try {
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        await navigator.setAppBadge(1)
      }
    } catch {}
  })()

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      badgePromise,
    ])
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  try {
    if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
      navigator.clearAppBadge()
    }
  } catch {}

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
