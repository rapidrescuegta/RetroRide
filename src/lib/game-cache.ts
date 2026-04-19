'use client'

// ---------------------------------------------------------------------------
// GameBuddi Game Cache Utility
// Check which games are cached, pre-cache on demand, manage storage.
// ---------------------------------------------------------------------------

export interface CacheStatus {
  totalCached: number
  cachedGames: string[]
  offlineGames: string[]
  gameRouteCount: number
  storageEstimate: { usage?: number; quota?: number } | null
  cacheVersion: string
}

export interface GameCacheInfo {
  gameId: string
  isCached: boolean
  isOfflineCapable: boolean
}

// Single-player games that work fully offline (no server needed)
const OFFLINE_CAPABLE_GAMES = new Set([
  'snake', 'whack-a-mole', 'memory-match', 'tic-tac-toe', 'simon',
  'dino-run', 'pong', 'connect-four', 'breakout', 'flappy-bird',
  'hangman', '2048', 'tetris', 'space-invaders', 'pac-man',
  'asteroids', 'frogger', 'minesweeper', 'wordle', 'galaga',
  'checkers', 'brick-breaker', 'crossy-road', 'doodle-jump', 'chess',
  'solitaire', 'blackjack', 'war', 'old-maid',
])

// ---------------------------------------------------------------------------
// Query the service worker for cache status
// ---------------------------------------------------------------------------

function sendSWMessage<T>(message: string | object, timeoutMs = 3000): Promise<T | null> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker?.controller) {
      resolve(null)
      return
    }

    const timeout = setTimeout(() => {
      navigator.serviceWorker.removeEventListener('message', handler)
      resolve(null)
    }, timeoutMs)

    const handler = (event: MessageEvent) => {
      // Accept any response message type
      if (event.data && typeof event.data === 'object') {
        clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('message', handler)
        resolve(event.data as T)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    navigator.serviceWorker.controller.postMessage(message)
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get full cache status from the service worker */
export async function getCacheStatus(): Promise<CacheStatus | null> {
  try {
    const response = await sendSWMessage<CacheStatus & { type: string }>('GET_CACHE_STATUS')
    if (response?.type === 'CACHE_STATUS') {
      return {
        totalCached: response.totalCached,
        cachedGames: response.cachedGames,
        offlineGames: response.offlineGames || [],
        gameRouteCount: response.gameRouteCount || 0,
        storageEstimate: response.storageEstimate,
        cacheVersion: response.cacheVersion || 'unknown',
      }
    }
    return null
  } catch {
    return null
  }
}

/** Get list of game URLs currently in the cache */
export async function getCachedGameList(): Promise<string[]> {
  try {
    const response = await sendSWMessage<{ type: string; games: string[] }>('GET_CACHED_GAMES')
    if (response?.type === 'CACHED_GAMES') {
      return response.games || []
    }
    return []
  } catch {
    return []
  }
}

/** Check if a specific game is cached and available offline */
export async function isGameCached(gameId: string): Promise<boolean> {
  const games = await getCachedGameList()
  return games.includes(`/play/${gameId}`)
}

/** Check if a game works offline (single-player, no server needed) */
export function isOfflineCapable(gameId: string): boolean {
  return OFFLINE_CAPABLE_GAMES.has(gameId)
}

/** Get cache info for a specific game */
export async function getGameCacheInfo(gameId: string): Promise<GameCacheInfo> {
  const cached = await isGameCached(gameId)
  return {
    gameId,
    isCached: cached,
    isOfflineCapable: isOfflineCapable(gameId),
  }
}

/** Get cache info for all games */
export async function getAllGamesCacheInfo(gameIds: string[]): Promise<GameCacheInfo[]> {
  const cachedGames = await getCachedGameList()
  const cachedSet = new Set(cachedGames.map((url) => url.replace('/play/', '')))

  return gameIds.map((gameId) => ({
    gameId,
    isCached: cachedSet.has(gameId),
    isOfflineCapable: isOfflineCapable(gameId),
  }))
}

/** Pre-cache a specific game on demand */
export async function precacheGame(gameId: string): Promise<boolean> {
  try {
    const response = await sendSWMessage<{ type: string; success: boolean }>(
      { type: 'PRECACHE_GAME', url: `/play/${gameId}` },
      10000 // longer timeout for network fetch
    )
    return response?.type === 'PRECACHE_COMPLETE' && response.success === true
  } catch {
    return false
  }
}

/** Pre-cache multiple games at once */
export async function precacheGames(gameIds: string[]): Promise<{ id: string; success: boolean }[]> {
  const results: { id: string; success: boolean }[] = []
  // Process sequentially to avoid overwhelming the network
  for (const id of gameIds) {
    const success = await precacheGame(id)
    results.push({ id, success })
  }
  return results
}

/** Get storage usage information */
export async function getStorageUsage(): Promise<{ usage: number; quota: number; percent: number } | null> {
  try {
    if (!navigator.storage?.estimate) return null
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    return {
      usage,
      quota,
      percent: quota > 0 ? Math.round((usage / quota) * 100) : 0,
    }
  } catch {
    return null
  }
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/** Clear old caches (keeps current version) */
export async function clearOldCaches(): Promise<number> {
  try {
    const response = await sendSWMessage<{ type: string; cleared: number }>('CLEAR_OLD_CACHES')
    return response?.type === 'CACHES_CLEARED' ? response.cleared : 0
  } catch {
    return 0
  }
}

/** Clear ALL caches (factory reset) */
export async function clearAllCaches(): Promise<number> {
  try {
    const response = await sendSWMessage<{ type: string; cleared: number }>('CLEAR_ALL_CACHES')
    return response?.type === 'ALL_CACHES_CLEARED' ? response.cleared : 0
  } catch {
    return 0
  }
}
