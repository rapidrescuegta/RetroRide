// GameBuddi Service Worker
// Cache-first for static assets, network-first for pages, background sync for API actions

const CACHE_NAME = 'retroride-v9'
const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|gif|ico|webp|avif|json)$/
const API_SYNC_URLS = ['/api/chat', '/api/scores', '/api/challenge']

// -------------------------------------------------------------------
// Install — pre-cache the shell
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
      ])
    })
  )
  // Activate immediately
  self.skipWaiting()
})

// -------------------------------------------------------------------
// Activate — clean up old caches
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    })
  )
  // Take control of all open pages immediately
  self.clients.claim()
})

// -------------------------------------------------------------------
// Fetch handler
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return

  // Skip API mutation requests (POST/PATCH/PUT/DELETE) — handled by background sync
  if (request.method !== 'GET') return

  // Skip API polling endpoints — always want fresh data
  if (url.pathname.startsWith('/api/')) return

  // Static assets — cache-first
  if (STATIC_EXTENSIONS.test(url.pathname) || url.pathname.startsWith('/_next/')) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Page navigations — network-first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Everything else — cache-first
  event.respondWith(cacheFirst(request))
})

// -------------------------------------------------------------------
// Strategies
// -------------------------------------------------------------------

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    // Return a basic offline response for non-critical assets
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    // Return cached home page as fallback for any navigation
    const fallback = await caches.match('/')
    if (fallback) return fallback

    return new Response(
      '<html><body style="background:#0a0a1a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:2rem">🎮</h1><p>You\'re offline — open a cached game to play!</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    )
  }
}

// -------------------------------------------------------------------
// Background sync — replay queued actions
// -------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'retroride-sync') {
    event.waitUntil(replayQueue())
  }
})

async function replayQueue() {
  const db = await openDB()
  const tx = db.transaction('queue', 'readonly')
  const store = tx.objectStore('queue')
  const items = await getAllFromStore(store)

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body,
      })
      if (response.ok || response.status < 500) {
        // Remove from queue on success or client error (don't retry 4xx)
        const deleteTx = db.transaction('queue', 'readwrite')
        deleteTx.objectStore('queue').delete(item.id)
      }
    } catch {
      // Still offline — stop trying, will retry on next sync
      break
    }
  }
  db.close()
}

// -------------------------------------------------------------------
// IndexedDB helpers (for background sync in SW context)
// -------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('retroride-offline', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// -------------------------------------------------------------------
// Message handler — manual flush trigger from client
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'FLUSH_QUEUE') {
    replayQueue().then(() => {
      // Notify all clients that flush is complete
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage('QUEUE_FLUSHED'))
      })
    })
  }

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
