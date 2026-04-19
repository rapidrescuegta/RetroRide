'use client'

// ---------------------------------------------------------------------------
// GameBuddi Offline Queue
// Stores pending API actions in IndexedDB and replays them when back online.
// Also manages cached game states for offline resume.
// ---------------------------------------------------------------------------

const DB_NAME = 'retroride-offline'
const QUEUE_STORE = 'queue'
const GAME_STATE_STORE = 'game-states'
const DB_VERSION = 2

interface QueueEntry {
  id: string
  url: string
  method: string
  body: string
  timestamp: number
  retryCount?: number
}

/** Max age for queued items before they're discarded (24 hours) */
const MAX_QUEUE_AGE = 24 * 60 * 60 * 1000

interface GameState {
  gameId: string
  state: unknown
  timestamp: number
  gameName: string
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(GAME_STATE_STORE)) {
        db.createObjectStore(GAME_STATE_STORE, { keyPath: 'gameId' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// Queue API — for pending network actions
// ---------------------------------------------------------------------------

/** Queue an API action for later replay */
export async function queueAction(url: string, method: string, body: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(QUEUE_STORE, 'readwrite')
    const store = tx.objectStore(QUEUE_STORE)
    const entry: QueueEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      url,
      method,
      body,
      timestamp: Date.now(),
    }
    store.add(entry)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()

    // Try to register a background sync if supported (use both tags for compat)
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready
        if ('sync' in reg) {
          await (reg as any).sync.register('gamebuddi-sync')
        }
      } catch {
        // Background sync not available -- will flush on reconnect
      }
    }
  } catch (err) {
    console.warn('[OfflineQueue] Failed to queue action:', err)
  }
}

/** Replay all queued actions (called when back online) */
export async function flushQueue(): Promise<{ synced: number; remaining: number }> {
  try {
    const db = await openDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const items: QueueEntry[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    let synced = 0

    // Sort by timestamp so oldest items are replayed first
    items.sort((a, b) => a.timestamp - b.timestamp)

    for (const item of items) {
      // Discard items that are too old
      if (Date.now() - item.timestamp > MAX_QUEUE_AGE) {
        const deleteTx = db.transaction(QUEUE_STORE, 'readwrite')
        deleteTx.objectStore(QUEUE_STORE).delete(item.id)
        synced++
        continue
      }

      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        })
        if (response.ok || response.status < 500) {
          // Success or client error (don't retry client errors)
          const deleteTx = db.transaction(QUEUE_STORE, 'readwrite')
          deleteTx.objectStore(QUEUE_STORE).delete(item.id)
          synced++
        }
        // Server errors (5xx) are left in queue for retry
      } catch {
        // Network error — stop trying remaining items
        break
      }
    }
    db.close()
    return { synced, remaining: items.length - synced }
  } catch (err) {
    console.warn('[OfflineQueue] Flush failed:', err)
    return { synced: 0, remaining: -1 }
  }
}

/** Get number of pending queued items */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction(QUEUE_STORE, 'readonly')
    const store = tx.objectStore(QUEUE_STORE)
    const count: number = await new Promise((resolve, reject) => {
      const req = store.count()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return count
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Game State API — save/restore game progress for offline resume
// ---------------------------------------------------------------------------

/** Save a game's state so it can be resumed after reconnecting */
export async function saveGameState(gameId: string, gameName: string, state: unknown): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(GAME_STATE_STORE, 'readwrite')
    const store = tx.objectStore(GAME_STATE_STORE)
    const entry: GameState = {
      gameId,
      gameName,
      state,
      timestamp: Date.now(),
    }
    store.put(entry) // put overwrites existing entry for this gameId
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.warn('[OfflineQueue] Failed to save game state:', err)
  }
}

/** Load a saved game state */
export async function loadGameState(gameId: string): Promise<unknown | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(GAME_STATE_STORE, 'readonly')
    const store = tx.objectStore(GAME_STATE_STORE)
    const result: GameState | undefined = await new Promise((resolve, reject) => {
      const req = store.get(gameId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result?.state ?? null
  } catch {
    return null
  }
}

/** Remove a saved game state */
export async function clearGameState(gameId: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(GAME_STATE_STORE, 'readwrite')
    tx.objectStore(GAME_STATE_STORE).delete(gameId)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (err) {
    console.warn('[OfflineQueue] Failed to clear game state:', err)
  }
}

/** Get all saved game states (for showing which games have save data) */
export async function getAllSavedGames(): Promise<{ gameId: string; gameName: string; timestamp: number }[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(GAME_STATE_STORE, 'readonly')
    const store = tx.objectStore(GAME_STATE_STORE)
    const items: GameState[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return items.map(({ gameId, gameName, timestamp }) => ({ gameId, gameName, timestamp }))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Cache query helpers — check which games are available offline
// ---------------------------------------------------------------------------

/** Get list of game URLs that are cached in the service worker cache */
export async function getCachedGameUrls(): Promise<string[]> {
  try {
    if (!('caches' in window)) return []
    // Ask the service worker for cached games
    return new Promise((resolve) => {
      if (!navigator.serviceWorker?.controller) {
        resolve([])
        return
      }

      const timeout = setTimeout(() => resolve([]), 2000)

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'CACHED_GAMES') {
          clearTimeout(timeout)
          navigator.serviceWorker.removeEventListener('message', handler)
          resolve(event.data.games || [])
        }
      }

      navigator.serviceWorker.addEventListener('message', handler)
      navigator.serviceWorker.controller.postMessage('GET_CACHED_GAMES')
    })
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Auto-flush on reconnect
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    // Ask the service worker to flush first (it has background sync support)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('FLUSH_QUEUE')
    } else {
      // Fallback: flush directly from the client
      flushQueue()
    }
  })
}
