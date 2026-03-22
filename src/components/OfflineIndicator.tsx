'use client'

import { useState, useEffect } from 'react'
import { getQueueSize } from '@/lib/offline-queue'

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    // Set initial state
    setIsOffline(!navigator.onLine)

    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)

    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  // Poll queue size while offline
  useEffect(() => {
    if (!isOffline) {
      setQueueCount(0)
      return
    }

    const checkQueue = async () => {
      const size = await getQueueSize()
      setQueueCount(size)
    }

    checkQueue()
    const interval = setInterval(checkQueue, 3000)
    return () => clearInterval(interval)
  }, [isOffline])

  if (!isOffline) return null

  return (
    <div className="mx-4 mb-4 px-4 py-3 rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-cyan-300" style={{ textShadow: '0 0 10px rgba(34,211,238,0.4)' }}>
            You&apos;re offline
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Games still work! Messages will sync when you&apos;re back.
          </p>
        </div>
        {queueCount > 0 && (
          <div className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/30">
            <span className="text-xs font-semibold text-purple-300">
              {queueCount} queued
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
