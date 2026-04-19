'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'gamebuddi-install-dismissed'
const INSTALL_KEY = 'gamebuddi-install-tracked'
const DISMISS_DAYS = 7

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

function isDismissed(): boolean {
  if (typeof window === 'undefined') return true
  const raw = localStorage.getItem(DISMISS_KEY)
  if (!raw) return false
  const ts = parseInt(raw, 10)
  if (isNaN(ts)) return false
  const daysSince = (Date.now() - ts) / (1000 * 60 * 60 * 24)
  return daysSince < DISMISS_DAYS
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true
  )
}

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function trackInstallEvent(action: string) {
  try {
    const events = JSON.parse(localStorage.getItem(INSTALL_KEY) || '[]')
    events.push({ action, timestamp: Date.now(), platform: detectPlatform() })
    localStorage.setItem(INSTALL_KEY, JSON.stringify(events.slice(-20)))
  } catch {
    // Ignore storage errors
  }
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [visible, setVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [cachedCount, setCachedCount] = useState(0)

  useEffect(() => {
    // Already installed or recently dismissed
    if (isInStandaloneMode() || isDismissed()) return

    const detected = detectPlatform()
    setPlatform(detected)

    // Get cached game count for the banner
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'CACHED_GAMES') {
          setCachedCount(event.data.games?.length || 0)
          navigator.serviceWorker.removeEventListener('message', handler)
        }
      }
      navigator.serviceWorker.addEventListener('message', handler)
      navigator.serviceWorker.controller.postMessage('GET_CACHED_GAMES')
      setTimeout(() => navigator.serviceWorker.removeEventListener('message', handler), 3000)
    }

    // iOS Safari — show manual instructions after a short delay
    if (detected === 'ios') {
      const timer = setTimeout(() => {
        setShowBanner(true)
        trackInstallEvent('banner_shown_ios')
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setVisible(true))
        })
      }, 3000)
      return () => clearTimeout(timer)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
      trackInstallEvent('banner_shown')
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    }

    window.addEventListener('beforeinstallprompt', handler)

    const installHandler = () => {
      trackInstallEvent('installed')
      setShowBanner(false)
    }
    window.addEventListener('appinstalled', installHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installHandler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return
    trackInstallEvent('install_tapped')
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    trackInstallEvent(outcome === 'accepted' ? 'install_accepted' : 'install_dismissed')
    if (outcome === 'accepted') {
      setShowBanner(false)
    }
    setDeferredPrompt(null)
  }, [deferredPrompt])

  const handleDismiss = useCallback(() => {
    trackInstallEvent('banner_dismissed')
    setVisible(false)
    setTimeout(() => setShowBanner(false), 300)
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
  }, [])

  if (!showBanner) return null

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto max-w-lg px-4 pb-4">
        <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-[#0f0f2a]/95 shadow-[0_0_30px_rgba(139,92,246,0.15)] backdrop-blur-xl">
          {/* Neon glow accent line */}
          <div className="absolute left-0 right-0 top-0 h-[2px] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500" />

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          <div className="p-4">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-cyan-500 text-2xl shadow-lg">
                <img src="/icon-192.png" alt="" className="h-10 w-10 rounded-lg" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  Install GameBuddi
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  {cachedCount > 0
                    ? `Play ${cachedCount}+ games offline — perfect for road trips!`
                    : 'Play 30+ arcade games offline — perfect for road trips!'}
                </p>
              </div>
            </div>

            {/* Platform-specific install UI */}
            {platform === 'ios' ? (
              <div className="mt-3">
                <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-300 leading-relaxed">
                      Tap the{' '}
                      <span className="inline-flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="inline h-3.5 w-3.5 text-blue-400 mx-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3V15" />
                        </svg>
                      </span>
                      {' '}Share button, then <span className="font-semibold text-white">&quot;Add to Home Screen&quot;</span>
                    </p>
                  </div>
                </div>
              </div>
            ) : platform === 'android' ? (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 active:scale-95"
                >
                  Add to Home Screen
                </button>
              </div>
            ) : (
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 active:scale-95"
                >
                  Install App
                </button>
              </div>
            )}

            {/* Feature highlights */}
            <div className="mt-3 flex items-center gap-3 text-[0.6875rem] text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Works offline
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                No app store
              </span>
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Free forever
              </span>
            </div>
          </div>

          {/* Remind me later link */}
          <div className="border-t border-white/5 px-4 py-2">
            <button
              onClick={handleDismiss}
              className="w-full text-center text-[0.6875rem] text-gray-500 hover:text-gray-400 transition-colors"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
