'use client'

// ---------------------------------------------------------------------------
// RetroRide Offline Queue
// Stores pending API actions in IndexedDB and replays them when back online.
// ---------------------------------------------------------------------------

const DB_NAME = 'retroride-offline'
const STORE_NAME = 'queue'
const DB_VERSION = 1

interface QueueEntry {
  id: string
  url: string
  method: string
  body: string
  timestamp: number
}

// ---------------------------------------------------------------------------
// IndexedDB helpers
// ---------------------------------------------------------------------------

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Queue an API action for later replay */
export async function queueAction(url: string, method: string, body: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
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

    // Try to register a background sync if supported
    if ('serviceWorker' in navigator && 'sync' in (await navigator.serviceWorker.ready)) {
      const reg = await navigator.serviceWorker.ready
      await (reg as any).sync.register('retroride-sync')
    }
  } catch (err) {
    console.warn('[OfflineQueue] Failed to queue action:', err)
  }
}

/** Replay all queued actions (called when back online) */
export async function flushQueue(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const items: QueueEntry[] = await new Promise((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    for (const item of items) {
      try {
        const response = await fetch(item.url, {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          body: item.body,
        })
        if (response.ok || response.status < 500) {
          // Remove from queue
          const deleteTx = db.transaction(STORE_NAME, 'readwrite')
          deleteTx.objectStore(STORE_NAME).delete(item.id)
        }
      } catch {
        // Still offline — stop trying
        break
      }
    }
    db.close()
  } catch (err) {
    console.warn('[OfflineQueue] Flush failed:', err)
  }
}

/** Get number of pending queued items */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
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
// Auto-flush on reconnect
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue()
    // Also ask the service worker to flush (it has background sync support)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage('FLUSH_QUEUE')
    }
  })
}
