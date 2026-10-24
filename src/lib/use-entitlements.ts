'use client'

import { useEffect, useState } from 'react'
import type { Entitlements } from '@/lib/tiers'

/**
 * Client-side view of the family's entitlements.
 *
 * The tier is decided by the server (`/api/subscription` → the resolved
 * entitlement set); this hook only mirrors it so the UI can show upgrade
 * prompts. It is never used to decide whether an action is allowed — the API
 * routes re-check the tier themselves.
 */

export const FREE_ENTITLEMENTS: Entitlements = {
  tier: 'free',
  label: 'Free',
  maxMembers: 2,
  internetMultiplayer: false,
  hotspotMultiplayer: false,
  familyLeaderboard: false,
  chat: false,
  customAvatars: false,
  tournaments: false,
  pushChallenges: false,
  seniorMode: false,
}

function familyIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('retroride-family')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.family?.id ?? null
  } catch {
    return null
  }
}

export function useEntitlements(): { entitlements: Entitlements; loading: boolean } {
  const [entitlements, setEntitlements] = useState<Entitlements>(FREE_ENTITLEMENTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const familyId = familyIdFromStorage()
      if (!familyId) {
        if (!cancelled) {
          setEntitlements(FREE_ENTITLEMENTS)
          setLoading(false)
        }
        return
      }
      try {
        const res = await fetch(`/api/subscription?familyId=${encodeURIComponent(familyId)}`)
        if (!res.ok) throw new Error('subscription lookup failed')
        const data = await res.json()
        if (!cancelled && data.entitlements) {
          setEntitlements(data.entitlements as Entitlements)
        }
      } catch {
        // Network blip or signed-out session — stay on the free tier.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { entitlements, loading }
}
