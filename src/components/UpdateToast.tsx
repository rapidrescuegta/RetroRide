'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface VersionInfo {
  version: string
  changelog: string[]
}

export default function UpdateToast() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [visible, setVisible] = useState(false)
  const [show, setShow] = useState(false)
  const [showChangelog, setShowChangelog] = useState(false)
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Listen for version info from SW
    const swMessageHandler = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'SW_UPDATED' || data?.type === 'SW_VERSION') {
        setVersionInfo({
          version: data.version || 'new',
          changelog: data.changelog || [],
        })
      }
    }

    navigator.serviceWorker.addEventListener('message', swMessageHandler)

    // Check for existing registration
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return

      // If there's already a waiting worker
      if (reg.waiting) {
        setWaitingWorker(reg.waiting)
        // Ask for version info
        reg.waiting.postMessage('GET_VERSION')
        setShow(true)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true))
        })
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker)
            setShow(true)
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setVisible(true))
            })
          }
        })
      })
    })

    // Reload page when the new SW takes over
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })

    return () => {
      navigator.serviceWorker.removeEventListener('message', swMessageHandler)
    }
  }, [])

  // Auto-dismiss after 45 seconds (longer since we have changelog now)
  useEffect(() => {
    if (!show) return
    autoDismissRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setShow(false), 300)
    }, 45000)
    return () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current)
    }
  }, [show])

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage('SKIP_WAITING')
    }
    setVisible(false)
    setTimeout(() => setShow(false), 300)
  }, [waitingWorker])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => setShow(false), 300)
  }, [])

  const toggleChangelog = useCallback(() => {
    setShowChangelog((prev) => !prev)
    // Reset auto-dismiss when expanding
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current)
      autoDismissRef.current = setTimeout(() => {
        setVisible(false)
        setTimeout(() => setShow(false), 300)
      }, 45000)
    }
  }, [])

  if (!show) return null

  const changelog = versionInfo?.changelog || []
  const version = versionInfo?.version || 'new'

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[60] transition-all duration-300 ease-out ${
        visible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
    >
      <div className="mx-auto max-w-lg px-4 pt-3">
        <div className="relative overflow-hidden rounded-xl border border-cyan-500/30 bg-[#0f0f2a]/95 shadow-[0_4px_20px_rgba(6,182,212,0.15)] backdrop-blur-xl">
          {/* Neon accent line */}
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />

          {/* Main row */}
          <div className="flex items-center gap-3 px-4 py-2.5">
            {/* Pulsing dot */}
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
            </span>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200">
                New version available!
              </p>
              <p className="text-[0.6875rem] text-slate-500 mt-0.5">
                {version !== 'new' ? `Version ${version}` : 'Update ready'}
                {changelog.length > 0 && (
                  <>
                    {' · '}
                    <button
                      onClick={toggleChangelog}
                      className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      {showChangelog ? 'Hide' : 'What\'s new?'}
                    </button>
                  </>
                )}
              </p>
            </div>

            <button
              onClick={handleUpdate}
              className="shrink-0 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:shadow-cyan-500/40 active:scale-95"
            >
              Update now
            </button>

            <button
              onClick={handleDismiss}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-300"
              aria-label="Dismiss"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Changelog panel */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-out ${
              showChangelog && changelog.length > 0
                ? 'max-h-60 opacity-100'
                : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border-t border-white/5 px-4 py-3">
              <p className="text-[0.6875rem] font-medium text-slate-500 uppercase tracking-wider mb-2">
                What&apos;s New
              </p>
              <ul className="space-y-1.5">
                {changelog.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <span className="mt-1 flex h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
