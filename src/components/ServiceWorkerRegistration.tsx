'use client'

import { useEffect } from 'react'
import { subscribeToPush } from '@/lib/push-notifications'

/**
 * Handles service worker registration, lifecycle management, push subscription,
 * and background sync registration. Does NOT render any UI — update prompts
 * are handled by UpdateToast, offline status by OfflineIndicator, and install
 * prompts by InstallPrompt.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    let registration: ServiceWorkerRegistration | null = null
    let updateInterval: ReturnType<typeof setInterval> | null = null

    async function register() {
      try {
        registration = await navigator.serviceWorker.register('/sw.js')
        console.log('[SW] Registered successfully, scope:', registration.scope)

        // Check for updates every hour
        updateInterval = setInterval(() => {
          registration?.update().catch(() => {
            // Silent — network may be offline
          })
        }, 60 * 60 * 1000)

        // Register for background sync if supported
        await registerBackgroundSync(registration)

        // Subscribe to push if permission already granted
        if ('Notification' in window && Notification.permission === 'granted') {
          await registerPushSubscription()
        }
      } catch (err) {
        console.warn('[SW] Registration failed:', err)
      }
    }

    register()

    // Reload page when a new SW takes control (triggered by SKIP_WAITING)
    let refreshing = false
    const controllerChangeHandler = () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', controllerChangeHandler)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandler)
      if (updateInterval) clearInterval(updateInterval)
    }
  }, [])

  // This component renders nothing — all UI is in sibling components
  return null
}

// ---------------------------------------------------------------------------
// Background Sync
// ---------------------------------------------------------------------------

async function registerBackgroundSync(registration: ServiceWorkerRegistration) {
  // One-time background sync for offline queue replay
  if ('sync' in registration) {
    try {
      await (registration as any).sync.register('gamebuddi-sync')
      console.log('[SW] Background sync registered')
    } catch {
      // Background sync not supported or permission denied
      console.log('[SW] Background sync not available')
    }
  }

  // Periodic background sync for tournament status checks
  if ('periodicSync' in registration) {
    try {
      const status = await navigator.permissions.query({
        name: 'periodic-background-sync' as any,
      })
      if (status.state === 'granted') {
        await (registration as any).periodicSync.register('check-tournaments', {
          minInterval: 15 * 60 * 1000, // 15 minutes
        })
        console.log('[SW] Periodic sync registered for tournament checks')
      }
    } catch {
      // Periodic sync not granted — not a problem
    }
  }
}

// ---------------------------------------------------------------------------
// Push Notifications
// ---------------------------------------------------------------------------

async function registerPushSubscription() {
  try {
    let memberId: string | undefined
    try {
      const raw = localStorage.getItem('retroride-family')
      if (raw) {
        const parsed = JSON.parse(raw)
        memberId = parsed?.member?.id
      }
    } catch {
      // Ignore parse errors
    }

    const subscription = await subscribeToPush(memberId)
    if (subscription) {
      console.log('[SW] Push subscription active')
    } else {
      console.log('[SW] Push not configured (VAPID key may be missing)')
    }
  } catch (err) {
    console.warn('[SW] Push subscription failed:', err)
  }
}
