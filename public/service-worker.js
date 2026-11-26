self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'AI news update', body: event.data?.text() ?? '' }
  }

  const title = typeof payload.title === 'string' ? payload.title : 'AI news update'
  const body = typeof payload.body === 'string' ? payload.body : ''
  const url = typeof payload.url === 'string' ? payload.url : '/veille/'
  const safeUrl = /^https:\/\//i.test(url) ? url : '/veille/'

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: typeof payload.tag === 'string' ? payload.tag : 'ai-news-watch',
    data: { url: safeUrl },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = event.notification.data?.url
  event.waitUntil((async () => {
    if (!destination) return
    const target = new URL(destination, self.location.origin)
    if (target.origin !== self.location.origin) {
      await self.clients.openWindow(target.href)
      return
    }

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(target.href)
        return
      }
    }
    await self.clients.openWindow(target.href)
  })())
})
