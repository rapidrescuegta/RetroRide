// ─── Server-side Web Push (VAPID) ─────────────────────────────────────────
// Sends real push notifications to a member's subscribed devices.
//
// The client half of this feature already existed (src/lib/push-notifications.ts
// subscribes, public/sw.js has the `push` handler, the PushSubscription model
// stores the endpoint) — but nothing ever SENT anything, so subscriptions were
// collected and never used. This module is the missing sender.
//
// The VAPID private key stays server-side: it is never exposed to the browser.
// The public key is handed to the browser through NEXT_PUBLIC_VAPID_PUBLIC_KEY
// (inlined at build time) with /api/push/config as a runtime fallback.

import webpush from 'web-push'
import { prisma } from '@/lib/prisma'

export interface PushPayload {
  title: string
  body?: string
  /** Replaces any existing notification with the same tag. */
  tag?: string
  /** Where tapping the notification navigates. */
  url?: string
  data?: Record<string, unknown>
  actions?: { action: string; title: string }[]
}

export interface PushResult {
  /** Notifications accepted by the push service. */
  sent: number
  /** Notifications that failed for a non-fatal reason. */
  failed: number
  /** Dead subscriptions removed (404/410 from the push service). */
  pruned: number
  /** True when push isn't configured at all, so nothing was attempted. */
  skipped: boolean
}

let _configured = false

/** The VAPID public key (safe to hand to the browser). */
export function getVapidPublicKey(): string {
  return (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    ''
  ).trim()
}

/** True when both VAPID keys are present, i.e. push can actually be sent. */
export function isPushConfigured(): boolean {
  return !!(getVapidPublicKey() && (process.env.VAPID_PRIVATE_KEY || '').trim())
}

function ensureConfigured(): boolean {
  if (_configured) return true

  const publicKey = getVapidPublicKey()
  const privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim()
  if (!publicKey || !privateKey) return false

  // VAPID requires a contact subject (mailto: or https:) — the push service
  // uses it to reach us if a key is ever abused.
  const subject = (process.env.VAPID_SUBJECT || 'mailto:support@gamebuddi.com').trim()

  webpush.setVapidDetails(subject, publicKey, privateKey)
  _configured = true
  return true
}

/**
 * Send a push notification to every device a member has subscribed.
 * Never throws — a failed notification must not break the caller's request.
 */
export async function sendPushToMember(
  memberId: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!ensureConfigured()) {
    return { sent: 0, failed: 0, pruned: 0, skipped: true }
  }

  const subs = await prisma.pushSubscription.findMany({ where: { memberId } })
  if (subs.length === 0) {
    return { sent: 0, failed: 0, pruned: 0, skipped: false }
  }

  const body = JSON.stringify(payload)
  let sent = 0
  let failed = 0
  let pruned = 0

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
          { TTL: 60 * 60, urgency: 'high' }
        )
        sent++
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        if (statusCode === 404 || statusCode === 410) {
          // The browser unsubscribed or the subscription expired — drop it so
          // we stop retrying a dead endpoint on every notification.
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } })
          pruned++
        } else {
          failed++
          console.error(
            '[push] send failed:',
            statusCode ?? 'no-status',
            (err as Error).message
          )
        }
      }
    })
  )

  return { sent, failed, pruned, skipped: false }
}

/**
 * Send the same notification to several members at once.
 * Used when a bracket match becomes ready for both players.
 */
export async function sendPushToMembers(
  memberIds: string[],
  payloadFor: (memberId: string) => PushPayload
): Promise<PushResult> {
  const totals: PushResult = { sent: 0, failed: 0, pruned: 0, skipped: false }

  for (const memberId of memberIds) {
    if (!memberId) continue
    const result = await sendPushToMember(memberId, payloadFor(memberId))
    totals.sent += result.sent
    totals.failed += result.failed
    totals.pruned += result.pruned
    totals.skipped = totals.skipped && result.skipped
  }

  return totals
}
