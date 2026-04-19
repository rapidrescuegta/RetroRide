'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useFamily } from '@/lib/family-context'
import Link from 'next/link'
import {
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  hasActivePushSubscription,
  getNotificationPermission,
} from '@/lib/push-notifications'

type RankingFrequency = 'daily' | 'weekly' | 'off'

interface Preferences {
  rankingEmail: RankingFrequency
  challengeEmail: boolean
  newMemberEmail: boolean
}

interface CacheStatus {
  totalCached: number
  cachedGames: string[]
  offlineGames: string[]
  gameRouteCount: number
  storageEstimate: { usage?: number; quota?: number } | null
  cacheVersion: string
}

const DEFAULTS: Preferences = {
  rankingEmail: 'weekly',
  challengeEmail: true,
  newMemberEmail: true,
}

const APP_VERSION = 'v1.3.0'

// ---------------------------------------------------------------------------
// Reusable UI pieces
// ---------------------------------------------------------------------------

function SavedIndicator({ show }: { show: boolean }) {
  return (
    <div
      className={`fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all duration-300 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Saved
    </div>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled
          ? 'bg-purple-600 shadow-lg shadow-purple-600/30'
          : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function RadioOption({
  label,
  sublabel,
  selected,
  onSelect,
}: {
  label: string
  sublabel: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
        selected
          ? 'bg-purple-600/20 border border-purple-500/40'
          : 'bg-slate-800/40 border border-transparent hover:bg-slate-800/60'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'border-purple-400' : 'border-slate-600'
        }`}
      >
        {selected && (
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${selected ? 'text-purple-300' : 'text-slate-300'}`}>
          {label}
        </p>
        <p className="text-xs text-slate-500">{sublabel}</p>
      </div>
    </button>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
        <span className="text-purple-400">{icon}</span> {title}
      </h2>
      <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// ---------------------------------------------------------------------------
// Main settings page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const ctx = useFamily()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [showSaved, setShowSaved] = useState(false)

  // PWA state
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null)
  const [cacheLoading, setCacheLoading] = useState(true)
  const [cachingAll, setCachingAll] = useState(false)
  const [cachingProgress, setCachingProgress] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [clearingCache, setClearingCache] = useState(false)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const swListenerAttached = useRef(false)

  // Fetch notification preferences on mount
  useEffect(() => {
    if (!ctx?.member?.id) {
      setLoading(false)
      return
    }
    fetch(`/api/notifications/preferences?memberId=${ctx.member.id}`)
      .then(r => r.json())
      .then(data => {
        setPrefs({
          rankingEmail: data.rankingEmail || 'weekly',
          challengeEmail: data.challengeEmail ?? true,
          newMemberEmail: data.newMemberEmail ?? true,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ctx?.member?.id])

  // Fetch cache status from SW
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      setCacheLoading(false)
      return
    }

    const handler = (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'CACHE_STATUS') {
        setCacheStatus({
          totalCached: data.totalCached,
          cachedGames: data.cachedGames || [],
          offlineGames: data.offlineGames || [],
          gameRouteCount: data.gameRouteCount || 0,
          storageEstimate: data.storageEstimate,
          cacheVersion: data.cacheVersion || 'unknown',
        })
        setCacheLoading(false)
      }
      if (data?.type === 'PRECACHE_COMPLETE') {
        setCachingProgress(prev => prev + 1)
      }
      if (data?.type === 'ALL_CACHES_CLEARED') {
        setClearingCache(false)
        setCacheStatus(null)
        // Re-fetch status
        requestCacheStatus()
      }
    }

    if (!swListenerAttached.current) {
      navigator.serviceWorker.addEventListener('message', handler)
      swListenerAttached.current = true
    }

    requestCacheStatus()

    return () => {
      navigator.serviceWorker.removeEventListener('message', handler)
      swListenerAttached.current = false
    }
  }, [])

  // Check push notification status
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [pushToggling, setPushToggling] = useState(false)

  useEffect(() => {
    const supported = isPushSupported()
    setPushSupported(supported)
    if (!supported) {
      setPushPermission('unsupported')
      return
    }
    setPushPermission(getNotificationPermission())
    // Check if there's an active subscription
    hasActivePushSubscription().then(setPushEnabled)
  }, [])

  function requestCacheStatus() {
    navigator.serviceWorker?.controller?.postMessage('GET_CACHE_STATUS')
    // Timeout fallback
    setTimeout(() => setCacheLoading(false), 3000)
  }

  // Save preference to API
  const save = useCallback(
    async (update: Partial<Preferences>) => {
      if (!ctx?.member?.id) return
      const newPrefs = { ...prefs, ...update }
      setPrefs(newPrefs)

      try {
        await fetch('/api/notifications/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: ctx.member.id, ...update }),
        })
        setShowSaved(true)
        setTimeout(() => setShowSaved(false), 1500)
      } catch {
        // Silently fail
      }
    },
    [ctx?.member?.id, prefs]
  )

  const handleTogglePush = useCallback(async () => {
    if (!isPushSupported()) return
    setPushToggling(true)

    try {
      if (pushEnabled) {
        // Unsubscribe
        await unsubscribeFromPush()
        setPushEnabled(false)
        setPushPermission(getNotificationPermission())
      } else {
        // Request permission first
        const granted = await requestNotificationPermission()
        setPushPermission(getNotificationPermission())

        if (granted) {
          const sub = await subscribeToPush(ctx?.member?.id)
          setPushEnabled(sub !== null)
        } else {
          setPushEnabled(false)
        }
      }
    } catch {
      // Failed
    } finally {
      setPushToggling(false)
    }
  }, [pushEnabled, ctx?.member?.id])

  const handleCacheAllGames = useCallback(async () => {
    if (!navigator.serviceWorker?.controller || !cacheStatus) return
    setCachingAll(true)
    setCachingProgress(0)

    const uncached = cacheStatus.offlineGames
      .map(slug => `/play/${slug}`)
      .filter(url => !cacheStatus.cachedGames.includes(url))

    for (const url of uncached) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PRECACHE_GAME',
        url,
      })
    }

    // Wait for all to complete (or timeout)
    const checkDone = setInterval(() => {
      setCachingProgress(prev => {
        if (prev >= uncached.length) {
          clearInterval(checkDone)
          setCachingAll(false)
          requestCacheStatus()
          return prev
        }
        return prev
      })
    }, 500)

    // Safety timeout
    setTimeout(() => {
      clearInterval(checkDone)
      setCachingAll(false)
      requestCacheStatus()
    }, 30000)
  }, [cacheStatus])

  const handleClearCache = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true)
      setTimeout(() => setConfirmClear(false), 3000)
      return
    }
    if (!navigator.serviceWorker?.controller) return
    setClearingCache(true)
    setConfirmClear(false)
    navigator.serviceWorker.controller.postMessage('CLEAR_ALL_CACHES')
    setTimeout(() => setClearingCache(false), 5000)
  }, [confirmClear])

  const handleCheckUpdate = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return
    setCheckingUpdate(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg) {
        await reg.update()
      }
    } catch {
      // Update check failed
    } finally {
      setTimeout(() => setCheckingUpdate(false), 2000)
    }
  }, [])

  const storageUsed = cacheStatus?.storageEstimate?.usage
  const storageQuota = cacheStatus?.storageEstimate?.quota
  const storagePercent = storageUsed && storageQuota ? Math.round((storageUsed / storageQuota) * 100) : null

  return (
    <div className="min-h-screen pb-8 page-enter">
      <SavedIndicator show={showSaved} />

      {/* Header */}
      <header className="relative px-4 pt-8 pb-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
            &larr; Home
          </Link>
          <h1
            className="text-xl font-bold neon-text mt-3"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
          >
            Settings
          </h1>
          {ctx?.member && (
            <p className="text-slate-400 text-sm mt-2">
              {ctx.member.avatar} {ctx.member.name}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 space-y-6">

        {/* ------------------------------------------------------------ */}
        {/* Storage Section */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <SectionHeader
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
            }
            title="Storage"
            subtitle="Cache and storage usage"
          />

          {cacheLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-purple-400" />
              Loading cache info...
            </div>
          ) : cacheStatus ? (
            <div className="space-y-4">
              {/* Storage bar */}
              {storageUsed != null && storageQuota != null && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-400">Storage used</span>
                    <span className="text-slate-300 font-medium">
                      {formatBytes(storageUsed)} / {formatBytes(storageQuota)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${Math.min(storagePercent ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {storagePercent != null ? `${storagePercent}%` : ''} of available storage
                  </p>
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{cacheStatus.totalCached}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Cached Items</p>
                </div>
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 text-center">
                  <p className="text-lg font-bold text-cyan-400">{cacheStatus.cachedGames.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Games Cached</p>
                </div>
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/30 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{cacheStatus.offlineGames.length}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Offline-Ready</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Service worker not active. Refresh the page to load cache info.</p>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Push Notifications Section */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <SectionHeader
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            }
            title="Notifications"
            subtitle="Push notification preferences"
          />

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-300">Push Notifications</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {pushPermission === 'unsupported'
                  ? 'Not supported on this browser'
                  : pushPermission === 'denied'
                    ? 'Blocked — update in browser settings to enable'
                    : pushEnabled
                      ? 'Enabled — you will receive game and tournament alerts'
                      : 'Receive alerts for tournaments and challenges'}
              </p>
            </div>
            {pushToggling ? (
              <div className="h-7 w-12 flex items-center justify-center">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400/30 border-t-purple-400" />
              </div>
            ) : (
              <Toggle
                enabled={pushEnabled}
                onToggle={handleTogglePush}
              />
            )}
          </div>

          {/* Permission state indicator */}
          {pushSupported && (
            <div className="flex items-center gap-2 text-xs">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  pushPermission === 'granted'
                    ? 'bg-emerald-400'
                    : pushPermission === 'denied'
                      ? 'bg-red-400'
                      : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-500">
                Permission: {pushPermission === 'granted' ? 'Granted' : pushPermission === 'denied' ? 'Blocked' : 'Not requested'}
              </span>
              {pushEnabled && (
                <span className="text-emerald-400 ml-auto">Subscribed</span>
              )}
            </div>
          )}

          {/* Email preferences (only for logged-in users) */}
          {ctx?.isLoggedIn && !loading && (
            <>
              <div className="h-px bg-slate-700/50" />

              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Ranking Digest Emails
                </h3>
                <div className="space-y-2">
                  <RadioOption
                    label="Daily"
                    sublabel="Get rankings every morning"
                    selected={prefs.rankingEmail === 'daily'}
                    onSelect={() => save({ rankingEmail: 'daily' })}
                  />
                  <RadioOption
                    label="Weekly"
                    sublabel="Get rankings every Monday"
                    selected={prefs.rankingEmail === 'weekly'}
                    onSelect={() => save({ rankingEmail: 'weekly' })}
                  />
                  <RadioOption
                    label="Off"
                    sublabel="No ranking emails"
                    selected={prefs.rankingEmail === 'off'}
                    onSelect={() => save({ rankingEmail: 'off' })}
                  />
                </div>
              </div>

              <div className="h-px bg-slate-700/50" />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-300">Challenge Notifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When someone challenges you to beat their score
                  </p>
                </div>
                <Toggle
                  enabled={prefs.challengeEmail}
                  onToggle={() => save({ challengeEmail: !prefs.challengeEmail })}
                />
              </div>

              <div className="h-px bg-slate-700/50" />

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-300">New Member Alerts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When someone new joins your family
                  </p>
                </div>
                <Toggle
                  enabled={prefs.newMemberEmail}
                  onToggle={() => save({ newMemberEmail: !prefs.newMemberEmail })}
                />
              </div>
            </>
          )}
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Offline Games Section */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <SectionHeader
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728M15.536 8.464a5 5 0 010 7.072M12 12h.01M3 3l18 18" />
              </svg>
            }
            title="Offline Games"
            subtitle="Games cached for offline play"
          />

          {cacheStatus && cacheStatus.cachedGames.length > 0 ? (
            <div>
              <div className="flex flex-wrap gap-1.5">
                {cacheStatus.cachedGames.map(url => {
                  const slug = url.replace('/play/', '')
                  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  return (
                    <span
                      key={url}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-medium text-emerald-300"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {name}
                    </span>
                  )
                })}
              </div>

              {cacheStatus.cachedGames.length < cacheStatus.offlineGames.length && (
                <p className="text-xs text-slate-500 mt-3">
                  {cacheStatus.offlineGames.length - cacheStatus.cachedGames.length} more games can be cached for offline play.
                </p>
              )}
            </div>
          ) : cacheStatus ? (
            <p className="text-xs text-slate-500">No games cached yet. Cache all games below for offline play.</p>
          ) : (
            <p className="text-xs text-slate-500">Loading...</p>
          )}

          <button
            onClick={handleCacheAllGames}
            disabled={cachingAll || !cacheStatus}
            className="w-full touch-btn rounded-xl border border-purple-500/30 bg-purple-600/20 px-4 py-3 text-sm font-semibold text-purple-300 transition-all hover:bg-purple-600/30 hover:border-purple-500/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cachingAll ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400/30 border-t-purple-400" />
                Caching games... {cachingProgress > 0 && `(${cachingProgress})`}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Cache All Games for Offline
              </span>
            )}
          </button>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* About Section */}
        {/* ------------------------------------------------------------ */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          <SectionHeader
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="About"
            subtitle="App information and maintenance"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-400">App Version</span>
              <span className="text-sm font-medium text-slate-300">{APP_VERSION}</span>
            </div>
            {cacheStatus && (
              <div className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-400">Cache Version</span>
                <span className="text-sm font-medium text-slate-300">{cacheStatus.cacheVersion}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-slate-400">Service Worker</span>
              <span className={`text-sm font-medium ${cacheStatus ? 'text-emerald-400' : 'text-amber-400'}`}>
                {cacheStatus ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="h-px bg-slate-700/50" />

          <button
            onClick={handleCheckUpdate}
            disabled={checkingUpdate}
            className="w-full touch-btn rounded-xl border border-cyan-500/20 bg-cyan-600/10 px-4 py-3 text-sm font-semibold text-cyan-400 transition-all hover:bg-cyan-600/20 hover:border-cyan-500/30 active:scale-[0.98] disabled:opacity-50"
          >
            {checkingUpdate ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
                Checking...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Check for Updates
              </span>
            )}
          </button>

          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            className={`w-full touch-btn rounded-xl border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 ${
              confirmClear
                ? 'border-red-500/50 bg-red-600/30 text-red-300'
                : 'border-red-500/20 bg-red-600/10 text-red-400 hover:bg-red-600/20 hover:border-red-500/30'
            }`}
          >
            {clearingCache ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
                Clearing...
              </span>
            ) : confirmClear ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                Tap again to confirm
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All Caches
              </span>
            )}
          </button>
          <p className="text-[10px] text-slate-600 text-center">
            This removes all cached games and data. They will be re-cached automatically.
          </p>
        </div>

        {/* Back to games */}
        <Link
          href="/"
          className="touch-btn block w-full px-6 py-3 rounded-xl font-semibold text-white text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all"
        >
          Back to Games
        </Link>
      </div>
    </div>
  )
}
