// GameBuddi Service Worker v18
// Smart pre-caching, cache size management, tournament sync, warm cache,
// periodic health checks, game asset versioning, full offline support,
// navigation preload, tournament & multiplayer page caching, app badge.
// v18: added Snap card game to offline cache + route precache.

const CACHE_VERSION = 'v18'
const STATIC_CACHE = `gamebuddi-static-${CACHE_VERSION}`
const GAME_CACHE = `gamebuddi-games-${CACHE_VERSION}`
const PAGE_CACHE = `gamebuddi-pages-${CACHE_VERSION}`
const API_CACHE = `gamebuddi-api-${CACHE_VERSION}`
const ALL_CACHES = [STATIC_CACHE, GAME_CACHE, PAGE_CACHE, API_CACHE]

const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|gif|ico|webp|avif)$/
const MAX_CACHE_ENTRIES = 150
const MAX_RETRY_ATTEMPTS = 5
const HEALTH_CHECK_INTERVAL = 30000 // 30s when offline
const BATCH_DELAY = 200 // ms between batches during precache

// Game asset version — bump this when game logic changes to cache-bust
const GAME_ASSET_VERSION = '2026.04.4'

// All game routes to pre-cache (~40 games)
const GAME_ROUTES = [
  // Arcade classics
  '/play/snake',
  '/play/whack-a-mole',
  '/play/memory-match',
  '/play/tic-tac-toe',
  '/play/simon',
  '/play/dino-run',
  '/play/pong',
  '/play/connect-four',
  '/play/breakout',
  '/play/flappy-bird',
  '/play/hangman',
  '/play/2048',
  '/play/tetris',
  '/play/space-invaders',
  '/play/pac-man',
  '/play/asteroids',
  '/play/frogger',
  '/play/minesweeper',
  '/play/wordle',
  '/play/galaga',
  '/play/checkers',
  '/play/brick-breaker',
  '/play/crossy-road',
  '/play/doodle-jump',
  '/play/chess',
  // Card games
  '/play/rummy-500',
  '/play/crazy-eights',
  '/play/go-fish',
  '/play/hearts',
  '/play/spades',
  '/play/war',
  '/play/blackjack',
  '/play/solitaire',
  '/play/old-maid',
  '/play/poker',
  '/play/color-clash',
  '/play/gin-rummy',
  '/play/euchre',
  '/play/cribbage',
  '/play/snap',
]

// Single-player games that work fully offline
const OFFLINE_GAMES = [
  'snake', 'whack-a-mole', 'memory-match', 'tic-tac-toe', 'simon',
  'dino-run', 'pong', 'connect-four', 'breakout', 'flappy-bird',
  'hangman', '2048', 'tetris', 'space-invaders', 'pac-man',
  'asteroids', 'frogger', 'minesweeper', 'wordle', 'galaga',
  'checkers', 'brick-breaker', 'crossy-road', 'doodle-jump', 'chess',
  'solitaire', 'blackjack', 'war', 'old-maid', 'poker', 'color-clash',
  'gin-rummy', 'euchre', 'cribbage', 'rummy-500', 'snap',
]

// Top pages to precache beyond games
const PRECACHE_PAGES = [
  '/',
  '/manifest.json',
  '/offline.html',
  '/play',
  '/tournaments',
  '/tournaments/create',
  '/tournament',
  '/local',
  '/settings',
  '/family',
  '/leaderboard',
]

// What's new in this version — sent to clients on update
const CHANGELOG = [
  'Rummy 500 multiplayer added — play online with 2-4 players!',
  '16 more arcade games now support multiplayer score competitions',
  'New tournament presets: Friends Night In, Sunday Brunch Games',
  'Featured tournament challenges highlighted on the hub',
  'App badge shows pending tournament notifications',
]

// -------------------------------------------------------------------
// Utility: delay helper for batched precaching
// -------------------------------------------------------------------
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// -------------------------------------------------------------------
// Cache size limiter — evicts oldest entries when over limit
// -------------------------------------------------------------------
async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length <= maxEntries) return
    const toDelete = keys.slice(0, keys.length - maxEntries)
    await Promise.all(toDelete.map((key) => cache.delete(key)))
  } catch {
    // Ignore trim errors
  }
}

// -------------------------------------------------------------------
// Install — pre-cache shell + game routes in batches of 5 with delays
// -------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      // Cache critical pages first
      const pageCache = await caches.open(PAGE_CACHE)
      await pageCache.addAll(PRECACHE_PAGES).catch(() => {})

      // Cache game routes in batches of 5 with delays to avoid bandwidth spikes
      const gameCache = await caches.open(GAME_CACHE)
      const batchSize = 5
      for (let i = 0; i < GAME_ROUTES.length; i += batchSize) {
        const batch = GAME_ROUTES.slice(i, i + batchSize)
        await Promise.allSettled(
          batch.map(async (route) => {
            try {
              const response = await fetch(route)
              if (response.ok) await gameCache.put(route, response)
            } catch { /* individual route fail is OK */ }
          })
        )
        // Delay between batches to avoid saturating bandwidth
        if (i + batchSize < GAME_ROUTES.length) {
          await delay(BATCH_DELAY)
        }
      }

      // Trim caches after precaching
      await trimCache(GAME_CACHE, MAX_CACHE_ENTRIES)
      await trimCache(PAGE_CACHE, MAX_CACHE_ENTRIES)
    })()
  )
  self.skipWaiting()
})

// -------------------------------------------------------------------
// Activate — clean up ALL old caches, register periodic sync
// -------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Enable navigation preload if supported (faster page loads)
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }

      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )

      // Register periodic background sync for tournament status checks
      if (self.registration.periodicSync) {
        try {
          await self.registration.periodicSync.register('check-tournaments', {
            minInterval: 15 * 60 * 1000,
          })
        } catch {
          // Periodic sync not granted
        }
      }

      // Notify all clients about the new version
      const allClients = await self.clients.matchAll()
      allClients.forEach((client) => {
        client.postMessage({
          type: 'SW_UPDATED',
          version: CACHE_VERSION,
          gameAssetVersion: GAME_ASSET_VERSION,
          changelog: CHANGELOG,
        })
      })
    })()
  )
  self.clients.claim()
})

// -------------------------------------------------------------------
// Fetch handler
// -------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.origin !== self.location.origin) return
  if (request.method !== 'GET') return

  // Health check endpoint — always network
  if (url.pathname === '/api/health') {
    event.respondWith(fetch(request).catch(() =>
      new Response(JSON.stringify({ status: 'offline' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 503,
      })
    ))
    return
  }

  // Tournament API — network-first with cache
  if (url.pathname.startsWith('/api/') && url.pathname.includes('tournament')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE))
    return
  }

  // Skip other API endpoints
  if (url.pathname.startsWith('/api/')) return

  // Next.js static chunks — stale-while-revalidate (immutable-ish)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
    return
  }

  // Static assets (images, fonts, etc) — cache-first
  if (STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  // Game pages — stale-while-revalidate for instant offline play
  if (url.pathname.startsWith('/play/')) {
    event.respondWith(staleWhileRevalidate(request, GAME_CACHE))
    return
  }

  // Tournament pages — stale-while-revalidate (like game pages)
  if (url.pathname.startsWith('/tournament') || url.pathname.startsWith('/local')) {
    event.respondWith(staleWhileRevalidate(request, PAGE_CACHE))
    return
  }

  // Other page navigations — network-first (with navigation preload)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, PAGE_CACHE, event.preloadResponse))
    return
  }

  // Everything else — stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE))
})

// -------------------------------------------------------------------
// Strategies
// -------------------------------------------------------------------

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      trimCache(cacheName, MAX_CACHE_ENTRIES)
    }
    return response
  } catch {
    return new Response('', { status: 503, statusText: 'Offline' })
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
        trimCache(cacheName, MAX_CACHE_ENTRIES)
      }
      return response
    })
    .catch(() => null)

  if (cached) {
    fetchPromise.catch(() => {})
    return cached
  }

  const response = await fetchPromise
  if (response) return response

  // Fallback for game pages
  const url = new URL(request.url)
  if (url.pathname.startsWith('/play/')) {
    const offlinePage = await caches.match('/offline.html')
    if (offlinePage) return offlinePage
  }

  return new Response('', { status: 503, statusText: 'Offline' })
}

async function networkFirst(request, cacheName, preloadResponse) {
  try {
    // Use navigation preload response if available (faster)
    const response = (await preloadResponse) || (await fetch(request))
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      trimCache(cacheName, MAX_CACHE_ENTRIES)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached

    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match('/offline.html')
      if (offlinePage) return offlinePage
    }

    return new Response(
      '<html><body style="background:#0a0a1a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:2rem">GameBuddi</h1><p>You\'re offline — open a cached game to play!</p></div></body></html>',
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    )
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
      trimCache(cacheName, MAX_CACHE_ENTRIES)
    }
    return response
  } catch {
    const cached = await caches.match(request)
    if (cached) return cached
    return new Response(JSON.stringify({ error: 'offline' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    })
  }
}

// -------------------------------------------------------------------
// Background sync — replay queued actions
// -------------------------------------------------------------------
self.addEventListener('sync', (event) => {
  if (event.tag === 'retroride-sync' || event.tag === 'gamebuddi-sync') {
    event.waitUntil(replayQueue())
  }
  if (event.tag === 'tournament-score-sync') {
    event.waitUntil(syncTournamentScores())
  }
})

// -------------------------------------------------------------------
// Periodic background sync — check tournament status
// -------------------------------------------------------------------
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-tournaments') {
    event.waitUntil(checkTournamentUpdates())
  }
})

async function checkTournamentUpdates() {
  try {
    const response = await fetch('/api/tournament?check=updates')
    if (!response.ok) return

    const data = await response.json()
    if (data.updates && data.updates.length > 0) {
      for (const update of data.updates) {
        await self.registration.showNotification(update.title || 'Tournament Update', {
          body: update.body || 'Something happened in your tournament!',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: `tournament-${update.id || 'update'}`,
          data: { url: update.url || '/tournaments' },
        })
      }
    }
  } catch {
    // Offline or API error — skip
  }
}

// -------------------------------------------------------------------
// Tournament score sync — auto-submit queued scores when back online
// -------------------------------------------------------------------
async function syncTournamentScores() {
  try {
    const db = await openDB()
    const tx = db.transaction('queue', 'readonly')
    const store = tx.objectStore('queue')
    const items = await getAllFromStore(store)
    db.close()

    const tournamentItems = items.filter((item) =>
      item.url && item.url.includes('tournament') && item.url.includes('score')
    )

    let syncedCount = 0
    for (const item of tournamentItems) {
      try {
        const response = await fetch(item.url, {
          method: item.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        })
        if (response.ok || response.status < 500) {
          const deleteTx = (await openDB()).transaction('queue', 'readwrite')
          deleteTx.objectStore('queue').delete(item.id)
          syncedCount++
        }
      } catch {
        break // Still offline
      }
    }

    if (syncedCount > 0) {
      const allClients = await self.clients.matchAll()
      allClients.forEach((client) => {
        client.postMessage({
          type: 'TOURNAMENT_SCORES_SYNCED',
          syncedCount,
        })
      })
    }
  } catch {
    // DB or network error — skip
  }
}

async function replayQueue() {
  const db = await openDB()
  const tx = db.transaction('queue', 'readonly')
  const store = tx.objectStore('queue')
  const items = await getAllFromStore(store)

  let syncedCount = 0
  const failedItems = []

  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: item.body,
      })
      if (response.ok || response.status < 500) {
        const deleteTx = db.transaction('queue', 'readwrite')
        deleteTx.objectStore('queue').delete(item.id)
        syncedCount++
      } else {
        failedItems.push(item)
      }
    } catch {
      failedItems.push(item)
      break
    }
  }

  // Update retry counts for failed items
  for (const item of failedItems) {
    const retryCount = (item.retryCount || 0) + 1
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      const deleteTx = db.transaction('queue', 'readwrite')
      deleteTx.objectStore('queue').delete(item.id)
    } else {
      const updateTx = db.transaction('queue', 'readwrite')
      updateTx.objectStore('queue').put({ ...item, retryCount })
    }
  }

  db.close()

  // Notify all clients about sync completion
  const remaining = items.length - syncedCount
  const allClients = await self.clients.matchAll()
  allClients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_COMPLETE',
      syncedCount,
      remaining,
    })
  })
}

// -------------------------------------------------------------------
// Periodic online health check — polls /api/health when offline
// -------------------------------------------------------------------
let healthCheckTimer = null
let isCurrentlyOffline = false

function startHealthCheck() {
  if (healthCheckTimer) return
  isCurrentlyOffline = true
  healthCheckTimer = setInterval(async () => {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' })
      if (response.ok) {
        // We're back online
        stopHealthCheck()
        isCurrentlyOffline = false

        // Auto-sync tournament scores
        syncTournamentScores()

        // Auto-replay general queue
        replayQueue()

        // Notify all clients
        const allClients = await self.clients.matchAll()
        allClients.forEach((client) => {
          client.postMessage({ type: 'ONLINE_DETECTED' })
        })
      }
    } catch {
      // Still offline
    }
  }, HEALTH_CHECK_INTERVAL)
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer)
    healthCheckTimer = null
  }
}

// -------------------------------------------------------------------
// IndexedDB helpers
// -------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('retroride-offline', 2)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queue')) {
        db.createObjectStore('queue', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('game-states')) {
        db.createObjectStore('game-states', { keyPath: 'gameId' })
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
// Push notifications
// -------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: 'GameBuddi', body: 'You have a new notification!' }

  if (event.data) {
    try {
      data = event.data.json()
    } catch {
      data = { title: 'GameBuddi', body: event.data.text() }
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    tag: data.tag || 'gamebuddi-notification',
    renotify: !!data.tag,
    actions: data.actions || [
      { action: 'view-tournament', title: 'View' },
      { action: 'play-now', title: 'Play Now' },
    ],
    data: {
      url: data.url || '/',
      ...data.data,
    },
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, options)
      // Set app badge if supported
      if (navigator.setAppBadge) {
        try { await navigator.setAppBadge(1) } catch { /* not supported */ }
      }
    })()
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  // Clear app badge on notification click
  if (navigator.clearAppBadge) {
    navigator.clearAppBadge().catch(() => {})
  }

  const url = event.notification.data?.url || '/'
  const action = event.action

  if (action === 'view-tournament') {
    event.waitUntil(clients.openWindow('/tournaments'))
    return
  }
  if (action === 'play-now') {
    event.waitUntil(clients.openWindow(url))
    return
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})

// -------------------------------------------------------------------
// Message handler — flush, cache queries, precache, warm cache, mgmt
// -------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data === 'FLUSH_QUEUE') {
    replayQueue()
  }

  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }

  // Start health check polling (called when client detects offline)
  if (event.data === 'START_HEALTH_CHECK') {
    startHealthCheck()
  }

  // Stop health check polling
  if (event.data === 'STOP_HEALTH_CHECK') {
    stopHealthCheck()
  }

  // Return list of cached game routes
  if (event.data === 'GET_CACHED_GAMES') {
    (async () => {
      const gameCache = await caches.open(GAME_CACHE)
      const keys = await gameCache.keys()
      const gameUrls = keys
        .map((r) => new URL(r.url).pathname)
        .filter((p) => p.startsWith('/play/'))
      event.source.postMessage({ type: 'CACHED_GAMES', games: gameUrls })
    })()
  }

  // Return full cache status
  if (event.data === 'GET_CACHE_STATUS') {
    (async () => {
      let totalCached = 0
      for (const name of ALL_CACHES) {
        try {
          const cache = await caches.open(name)
          const keys = await cache.keys()
          totalCached += keys.length
        } catch { /* skip */ }
      }

      const gameCache = await caches.open(GAME_CACHE)
      const gameKeys = await gameCache.keys()
      const gameUrls = gameKeys
        .map((r) => new URL(r.url).pathname)
        .filter((p) => p.startsWith('/play/'))

      let estimate = null
      if (navigator.storage && navigator.storage.estimate) {
        estimate = await navigator.storage.estimate()
      }

      event.source.postMessage({
        type: 'CACHE_STATUS',
        totalCached,
        cachedGames: gameUrls,
        offlineGames: OFFLINE_GAMES,
        gameRouteCount: GAME_ROUTES.length,
        storageEstimate: estimate,
        cacheVersion: CACHE_VERSION,
        gameAssetVersion: GAME_ASSET_VERSION,
        changelog: CHANGELOG,
      })
    })()
  }

  // Get SW version info
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({
      type: 'SW_VERSION',
      version: CACHE_VERSION,
      gameAssetVersion: GAME_ASSET_VERSION,
      changelog: CHANGELOG,
      gameCount: GAME_ROUTES.length,
    })
  }

  // Pre-cache a specific game on demand
  if (event.data?.type === 'PRECACHE_GAME') {
    const gameUrl = event.data.url
    if (gameUrl) {
      (async () => {
        try {
          const cache = await caches.open(GAME_CACHE)
          await cache.add(gameUrl)
          await trimCache(GAME_CACHE, MAX_CACHE_ENTRIES)
          event.source.postMessage({
            type: 'PRECACHE_COMPLETE',
            url: gameUrl,
            success: true,
          })
        } catch (err) {
          event.source.postMessage({
            type: 'PRECACHE_COMPLETE',
            url: gameUrl,
            success: false,
            error: err.message,
          })
        }
      })()
    }
  }

  // Warm cache — pre-cache multiple specific routes on demand
  if (event.data?.type === 'WARM_CACHE') {
    const routes = event.data.routes || []
    if (routes.length > 0) {
      (async () => {
        const cache = await caches.open(event.data.cacheName || GAME_CACHE)
        let successCount = 0
        let failCount = 0

        // Process in batches of 5 with delays
        const batchSize = 5
        for (let i = 0; i < routes.length; i += batchSize) {
          const batch = routes.slice(i, i + batchSize)
          const results = await Promise.allSettled(
            batch.map(async (route) => {
              try {
                const response = await fetch(route)
                if (response.ok) {
                  await cache.put(route, response)
                  return true
                }
                return false
              } catch {
                return false
              }
            })
          )
          results.forEach((r) => {
            if (r.status === 'fulfilled' && r.value) successCount++
            else failCount++
          })
          if (i + batchSize < routes.length) await delay(BATCH_DELAY)
        }

        await trimCache(event.data.cacheName || GAME_CACHE, MAX_CACHE_ENTRIES)

        event.source.postMessage({
          type: 'WARM_CACHE_COMPLETE',
          successCount,
          failCount,
          total: routes.length,
        })
      })()
    }
  }

  // Invalidate game cache (for versioning — when game logic changes)
  if (event.data?.type === 'INVALIDATE_GAME_CACHE') {
    const gameId = event.data.gameId
    if (gameId) {
      (async () => {
        const cache = await caches.open(GAME_CACHE)
        const deleted = await cache.delete(`/play/${gameId}`)
        event.source.postMessage({
          type: 'GAME_CACHE_INVALIDATED',
          gameId,
          deleted,
        })
      })()
    }
  }

  // Clear old caches
  if (event.data === 'CLEAR_OLD_CACHES') {
    (async () => {
      const keys = await caches.keys()
      const oldCaches = keys.filter((k) => !ALL_CACHES.includes(k))
      await Promise.all(oldCaches.map((k) => caches.delete(k)))
      event.source.postMessage({
        type: 'CACHES_CLEARED',
        cleared: oldCaches.length,
      })
    })()
  }

  // Clear ALL caches (factory reset)
  if (event.data === 'CLEAR_ALL_CACHES') {
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      event.source.postMessage({
        type: 'ALL_CACHES_CLEARED',
        cleared: keys.length,
      })
    })()
  }
})
