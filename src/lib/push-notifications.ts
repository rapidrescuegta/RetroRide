/**
 * Push notification utilities for GameBuddi.
 *
 * Usage:
 *   import { isPushSupported, requestNotificationPermission, subscribeToPush, unsubscribeFromPush } from '@/lib/push-notifications'
 *
 *   if (isPushSupported()) {
 *     const granted = await requestNotificationPermission()
 *     if (granted) {
 *       const sub = await subscribeToPush(memberId)
 *     }
 *   }
 */

/**
 * Check whether the browser supports Push API + service workers.
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/**
 * Get the current notification permission state.
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/**
 * Request notification permission from the user.
 * Returns true if permission is "granted".
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isPushSupported()) return false

  // Already granted
  if (Notification.permission === 'granted') return true

  // Already denied — can't re-ask
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Subscribe the user to push notifications via the service worker
 * and send the subscription to the backend.
 *
 * Returns the PushSubscription or null if it fails.
 */
export async function subscribeToPush(memberId?: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  try {
    const registration = await navigator.serviceWorker.ready

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidPublicKey) {
        console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — push subscription skipped')
        return null
      }

      // Convert VAPID key from base64 to Uint8Array
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey)

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      })
    }

    // Send subscription to the backend if we have a memberId
    if (memberId && subscription) {
      await sendSubscriptionToServer(memberId, subscription)
    }

    return subscription
  } catch (err) {
    console.warn('[Push] Subscription failed:', err)
    return null
  }
}

/**
 * Unsubscribe from push notifications and remove from backend.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()

    if (!subscription) return true

    // Remove from backend
    try {
      await fetch('/api/push-subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      })
    } catch {
      // Backend removal failed — still unsubscribe locally
      console.warn('[Push] Failed to remove subscription from backend')
    }

    // Unsubscribe locally
    const success = await subscription.unsubscribe()
    return success
  } catch (err) {
    console.warn('[Push] Unsubscribe failed:', err)
    return false
  }
}

/**
 * Check if the user currently has an active push subscription.
 */
export async function hasActivePushSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Send the push subscription to the backend for persistence.
 */
async function sendSubscriptionToServer(memberId: string, subscription: PushSubscription): Promise<void> {
  const subJson = subscription.toJSON()

  try {
    const response = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId,
        subscription: {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subJson.keys?.p256dh ?? '',
            auth: subJson.keys?.auth ?? '',
          },
        },
      }),
    })

    if (!response.ok) {
      console.warn('[Push] Failed to save subscription to backend:', response.status)
    }
  } catch (err) {
    console.warn('[Push] Failed to send subscription to backend:', err)
  }
}

/**
 * Convert a base64url-encoded string to a Uint8Array (for applicationServerKey).
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
