/* Service Worker · WorkBuddy PWA
 * 离线缓存 + Web Push 监听
 */
/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'pwb-v2.3.0'
const CORE = ['/', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(CORE).catch(() => null)))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    (async () => {
      const cached = await caches.match(req)
      if (cached) {
        // 后台异步刷新
        fetch(req)
          .then((res) => {
            if (res && res.ok) caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()))
          })
          .catch(() => null)
        return cached
      }
      try {
        const res = await fetch(req)
        if (res && res.ok && req.url.startsWith(self.location.origin)) {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, copy))
        }
        return res
      } catch (err) {
        // 离线兜底
        if (req.mode === 'navigate') return caches.match('/')
        throw err
      }
    })()
  )
})

self.addEventListener('push', (e) => {
  let data = { title: '个人工作台', body: '该晚间打卡啦 ✨' }
  try {
    if (e.data) data = { ...data, ...e.data.json() }
  } catch (_) {}
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-32.png',
      tag: data.tag || 'pwb-push',
      renotify: true,
      data: data.url || '/',
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const target = (e.notification.data || '/').startsWith('http')
        ? e.notification.data
        : self.location.origin + (e.notification.data || '/')
      const existing = all.find((w) => w.url === target)
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    })()
  )
})
