'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getQueueSize, getCachedGameUrls, flushQueue } from '@/lib/offline-queue'

// Map game URL slugs to display names
const GAME_NAMES: Record<string, string> = {
  'snake': 'Snake',
  'pac-man': 'Pac-Man',
  'tetris': 'Tetris',
  'space-invaders': 'Space Invaders',
  '2048': '2048',
  'pong': 'Pong',
  'breakout': 'Breakout',
  'flappy-bird': 'Flappy Bird',
  'whack-a-mole': 'Whack-a-Mole',
  'memory-match': 'Memory Match',
  'tic-tac-toe': 'Tic-Tac-Toe',
  'simon': 'Simon',
  'dino-run': 'Dino Run',
  'connect-four': 'Connect Four',
  'hangman': 'Hangman',
  'asteroids': 'Asteroids',
  'frogger': 'Frogger',
  'minesweeper': 'Minesweeper',
  'wordle': 'Wordle',
  'galaga': 'Galaga',
  'checkers': 'Checkers',
  'chess': 'Chess',
  'doodle-jump': 'Doodle Jump',
  'crossy-road': 'Crossy Road',
  'brick-breaker': 'Brick Breaker',
  'rummy-500': 'Rummy 500',
  'crazy-eights': 'Crazy Eights',
  'go-fish': 'Go Fish',
  'hearts': 'Hearts',
  'spades': 'Spades',
  'solitaire': 'Solitaire',
  'blackjack': 'Blackjack',
  'war': 'War',
  'old-maid': 'Old Maid',
  'poker': 'Texas Hold\'em',
  'color-clash': 'Color Clash',
  'gin-rummy': 'Gin Rummy',
  'euchre': 'Euchre',
}

type SyncState = 'offline' | 'syncing' | 'synced' | 'online'

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [cachedGames, setCachedGames] = useState<string[]>([])
  const [expanded, setExpanded] = useState(false)
  const [syncState, setSyncState] = useState<SyncState>('online')
  const [syncedCount, setSyncedCount] = useState(0)
  const [showToast, setShowToast] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const autoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wasOfflineRef = useRef(false)

  useEffect(() => {
    const offline = !navigator.onLine
    setIsOffline(offline)
    if (offline) {
      wasOfflineRef.current = true
      setSyncState('offline')
      // Animate banner in
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBannerVisible(true))
      })
      // Tell SW to start health checking
      navigator.serviceWorker?.controller?.postMessage('START_HEALTH_CHECK')
    }

    const goOffline = () => {
      setIsOffline(true)
      wasOfflineRef.current = true
      setSyncState('offline')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBannerVisible(true))
      })
      navigator.serviceWorker?.controller?.postMessage('START_HEALTH_CHECK')
    }

    const goOnline = async () => {
      setIsOffline(false)
      navigator.serviceWorker?.controller?.postMessage('STOP_HEALTH_CHECK')

      if (wasOfflineRef.current) {
        const pendingCount = await getQueueSize()
        if (pendingCount > 0) {
          setSyncState('syncing')
          // Trigger both client-side and SW-side flush
          flushQueue()
          navigator.serviceWorker?.controller?.postMessage('FLUSH_QUEUE')
        } else {
          setSyncState('synced')
          setSyncedCount(0)
          showSyncToastFn(0)
          autoDismissTimer.current = setTimeout(() => {
            setBannerVisible(false)
            setTimeout(() => {
              setSyncState('online')
              wasOfflineRef.current = false
            }, 300)
          }, 3000)
        }
      }
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    // Listen for sync complete messages from SW
    const swMessageHandler = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'SYNC_COMPLETE') {
        const count = data.syncedCount || 0
        setSyncedCount(count)
        if (data.remaining === 0) {
          setSyncState('synced')
          setQueueCount(0)
          showSyncToastFn(count)
          autoDismissTimer.current = setTimeout(() => {
            setBannerVisible(false)
            setTimeout(() => {
              setSyncState('online')
              wasOfflineRef.current = false
              setSyncedCount(0)
            }, 300)
          }, 3000)
        } else {
          setQueueCount(data.remaining)
        }
      }

      if (data?.type === 'TOURNAMENT_SCORES_SYNCED') {
        const count = data.syncedCount || 0
        showSyncToastFn(count)
      }

      // SW detected we're back online via health check
      if (data?.type === 'ONLINE_DETECTED') {
        goOnline()
      }
    }

    navigator.serviceWorker?.addEventListener('message', swMessageHandler)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      navigator.serviceWorker?.removeEventListener('message', swMessageHandler)
      if (autoDismissTimer.current) clearTimeout(autoDismissTimer.current)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showSyncToastFn = (count: number) => {
    setSyncedCount(count)
    setShowToast(true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setToastVisible(true))
    })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => {
      setToastVisible(false)
      setTimeout(() => setShowToast(false), 300)
    }, 4000)
  }

  // Poll queue size while offline
  useEffect(() => {
    if (!isOffline) return

    const checkQueue = async () => {
      const size = await getQueueSize()
      setQueueCount(size)
    }

    checkQueue()
    const interval = setInterval(checkQueue, 3000)
    return () => clearInterval(interval)
  }, [isOffline])

  // Fetch cached games when going offline
  useEffect(() => {
    if (!isOffline) {
      setCachedGames([])
      return
    }

    const fetchCached = async () => {
      const urls = await getCachedGameUrls()
      setCachedGames(urls)
    }
    fetchCached()
  }, [isOffline])

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev)
  }, [])

  // Sync toast (shown briefly when back online)
  const SyncToast = () => {
    if (!showToast) return null
    return (
      <div
        className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
          toastVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-4 opacity-0'
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-[#0f0f2a]/95 px-4 py-2 shadow-[0_0_20px_rgba(16,185,129,0.15)] backdrop-blur-xl">
          <svg className="h-4 w-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="text-sm font-medium text-emerald-300">
            {syncedCount > 0
              ? `Back online — ${syncedCount} action${syncedCount !== 1 ? 's' : ''} synced!`
              : 'Back online!'}
          </span>
        </div>
      </div>
    )
  }

  // Nothing to show when online and no sync happening
  if (syncState === 'online' && !isOffline && !showToast) return null

  // Only show toast (not the full indicator) when synced and online
  if (syncState === 'online' && !isOffline) {
    return <SyncToast />
  }

  const gameNames = cachedGames
    .map((url) => {
      const slug = url.replace('/play/', '')
      return GAME_NAMES[slug] || slug
    })
    .sort()

  // Connection status icon
  const StatusIcon = () => {
    if (syncState === 'syncing') {
      return (
        <div className="flex-shrink-0 w-5 h-5 relative">
          <div className="absolute inset-0 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
        </div>
      )
    }
    if (syncState === 'synced') {
      return (
        <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          <svg className="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'scale-in 0.3s ease-out forwards' }}>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )
    }
    // Offline - pulsing dot
    return (
      <div className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
    )
  }

  const borderColor = syncState === 'synced'
    ? 'border-emerald-500/30'
    : syncState === 'syncing'
      ? 'border-amber-500/30'
      : 'border-cyan-500/30'

  return (
    <>
      <SyncToast />
      <div
        className={`mx-4 mb-4 rounded-xl border ${borderColor} bg-slate-900/80 backdrop-blur-sm transition-all duration-300 ease-out ${
          bannerVisible
            ? 'translate-y-0 opacity-100'
            : '-translate-y-2 opacity-0'
        }`}
        style={{
          animation: syncState === 'syncing' ? 'pulse-border 1.5s ease-in-out infinite' : undefined,
        }}
      >
        {/* Main bar */}
        <button
          onClick={toggleExpanded}
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
        >
          <StatusIcon />
          <div className="flex-1 min-w-0">
            {syncState === 'syncing' ? (
              <>
                <p className="text-sm font-medium text-amber-300" style={{ textShadow: '0 0 10px rgba(251,191,36,0.4)' }}>
                  Syncing...
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sending {queueCount} queued action{queueCount !== 1 ? 's' : ''}
                </p>
              </>
            ) : syncState === 'synced' ? (
              <>
                <p className="text-sm font-medium text-emerald-300" style={{ textShadow: '0 0 10px rgba(16,185,129,0.4)' }}>
                  All synced!
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {syncedCount > 0 ? `${syncedCount} item${syncedCount !== 1 ? 's' : ''} synced successfully` : 'Back online'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-cyan-300" style={{ textShadow: '0 0 10px rgba(34,211,238,0.4)' }}>
                  You&apos;re offline
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {cachedGames.length > 0
                    ? `${cachedGames.length} games available offline`
                    : 'Games still work!'}
                  {queueCount > 0 && ` \u00B7 ${queueCount} action${queueCount !== 1 ? 's' : ''} pending`}
                </p>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {queueCount > 0 && (
              <div className={`px-2.5 py-1 rounded-lg border transition-colors duration-200 ${
                syncState === 'syncing'
                  ? 'bg-amber-500/20 border-amber-500/30'
                  : 'bg-purple-500/20 border-purple-500/30'
              }`}>
                <span className={`text-xs font-semibold transition-colors duration-200 ${
                  syncState === 'syncing' ? 'text-amber-300' : 'text-purple-300'
                }`}>
                  {queueCount} {syncState === 'syncing' ? 'syncing' : 'queued'}
                </span>
              </div>
            )}
            {isOffline && (
              <svg
                className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </button>

        {/* Expanded panel -- cached games list */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-out ${
            expanded && isOffline && cachedGames.length > 0
              ? 'max-h-96 opacity-100'
              : 'max-h-0 opacity-0'
          }`}
        >
          <div className="border-t border-slate-700/50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Available Offline
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gameNames.map((name) => (
                <a
                  key={name}
                  href={`/play/${Object.entries(GAME_NAMES).find(([, v]) => v === name)?.[0] || name.toLowerCase()}`}
                  className="inline-flex items-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-colors"
                >
                  {name}
                </a>
              ))}
            </div>
            {queueCount > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {queueCount} pending action{queueCount !== 1 ? 's' : ''} (scores, challenges, tournament data) will automatically sync when you reconnect.
              </p>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes scale-in {
            0% { transform: scale(0); }
            50% { transform: scale(1.2); }
            100% { transform: scale(1); }
          }
          @keyframes pulse-border {
            0%, 100% { border-color: rgba(245, 158, 11, 0.3); }
            50% { border-color: rgba(245, 158, 11, 0.6); }
          }
        `}</style>
      </div>
    </>
  )
}
