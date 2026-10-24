'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TIER_LABELS, TIER_ORDER, type Entitlements, type Tier } from '@/lib/tiers'

/**
 * Shows the family's current plan and, right after a Stripe Checkout return,
 * confirms that the payment actually landed.
 *
 * Why this exists: `success_url` sends the customer back to
 * `/family?payment=success`, but nothing in the app used to read that
 * parameter — a paying customer landed on the family dashboard with no
 * confirmation at all, and the plan only became active later, asynchronously,
 * when the Stripe webhook landed. If the webhook was slow (or failed), the
 * customer had no way to tell whether they had been charged.
 *
 * The webhook is the source of truth for "is the plan active", so this polls
 * `/api/subscription` until it confirms.
 */

interface SubscriptionState {
  hasAccess: boolean
  plan: string | null
  expiresAt: string | null
  entitlements?: Entitlements
}

type PaymentOutcome = 'success' | 'canceled' | null

/** Turns a plan key like `family_monthly` into "Family (monthly)". */
function planLabel(plan: string | null): string | null {
  if (!plan) return null
  const [tier, cadence] = plan.split('_')
  const label = (TIER_LABELS as Record<string, string>)[tier]
  if (!label) return plan
  return cadence === 'annual' ? `${label} (annual)` : `${label} (monthly)`
}

// ── What each tier unlocks ──────────────────────────────────────────────────
// Mirrors src/lib/entitlements.ts. Listed here so the card can tell the
// player exactly what the next plan adds.

const FEATURE_LIST: { key: keyof Entitlements; label: string; tier: Tier }[] = [
  { key: 'internetMultiplayer', label: 'Internet multiplayer', tier: 'pro' },
  { key: 'hotspotMultiplayer', label: 'Hotspot multiplayer', tier: 'family' },
  { key: 'familyLeaderboard', label: 'Family leaderboard', tier: 'family' },
  { key: 'chat', label: 'Family chat', tier: 'family' },
  { key: 'customAvatars', label: 'Photo avatars', tier: 'family' },
  { key: 'tournaments', label: 'Tournaments', tier: 'squad' },
  { key: 'pushChallenges', label: 'Challenges', tier: 'squad' },
]

/** The next tier up from `tier`, or null if it is already the top one. */
function nextTier(tier: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(tier)
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null
  return TIER_ORDER[idx + 1]
}

const POLL_INTERVAL_MS = 2500
const POLL_ATTEMPTS = 20 // ~50s

export default function PlanStatusCard({
  familyId,
  memberCount = 0,
}: {
  familyId: string
  /** How many members the family currently has — shown against the tier limit. */
  memberCount?: number
}) {
  const [state, setState] = useState<SubscriptionState | null>(null)
  const [outcome, setOutcome] = useState<PaymentOutcome>(null)
  const [confirming, setConfirming] = useState(false)
  const [gaveUp, setGaveUp] = useState(false)
  const attempts = useRef(0)

  const load = useCallback(async (): Promise<SubscriptionState | null> => {
    try {
      const res = await fetch(`/api/subscription?familyId=${encodeURIComponent(familyId)}`)
      if (!res.ok) return null
      const data = (await res.json()) as SubscriptionState
      setState(data)
      return data
    } catch {
      return null
    }
  }, [familyId])

  // Read the checkout outcome out of the URL, then clean it so a refresh
  // doesn't replay a stale "payment received" banner.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment === 'success' || payment === 'canceled') {
      setOutcome(payment)
      params.delete('payment')
      params.delete('session_id')
      const qs = params.toString()
      window.history.replaceState(
        {},
        '',
        window.location.pathname + (qs ? `?${qs}` : '')
      )
    }
  }, [])

  // Initial load (and the "check again" button).
  useEffect(() => {
    load()
  }, [load])

  // After a successful checkout, wait for the webhook to flip the family to
  // active. The webhook is the only thing that knows the truth.
  useEffect(() => {
    if (outcome !== 'success' || confirming || gaveUp) return
    let cancelled = false

    const poll = async () => {
      attempts.current += 1
      const data = await load()
      if (cancelled) return
      if (data?.hasAccess) {
        setConfirming(false)
        setGaveUp(false)
        return
      }
      if (attempts.current >= POLL_ATTEMPTS) {
        setGaveUp(true)
        return
      }
      setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
    }
  }, [outcome, confirming, gaveUp, load])

  const active = state?.hasAccess === true
  const label = planLabel(state?.plan ?? null)

  // ── Payment returned successfully ────────────────────────────────────────
  if (outcome === 'success') {
    return (
      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
        {active ? (
          <>
            <p className="text-sm font-bold text-emerald-300">
              🎉 Payment received{label ? ` — ${label} is active` : ''}!
            </p>
            <p className="mt-1 text-xs text-emerald-200/70">
              A receipt is on its way to your email. Everything in your plan is unlocked.
            </p>
          </>
        ) : gaveUp ? (
          <>
            <p className="text-sm font-bold text-amber-300">
              ⏳ We&apos;ve got your payment, but it hasn&apos;t finished activating.
            </p>
            <p className="mt-1 text-xs text-amber-200/70">
              This usually takes a few seconds. If it doesn&apos;t clear in a minute, contact
              support and we&apos;ll sort it out.
            </p>
            <button
              type="button"
              onClick={() => {
                attempts.current = 0
                setGaveUp(false)
                load()
              }}
              className="mt-3 rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/30 transition-colors"
            >
              Check again
            </button>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-emerald-300">🎉 Payment received!</p>
            <p className="mt-1 text-xs text-emerald-200/70">
              Activating your plan…
            </p>
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-emerald-500/20">
              <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-400" />
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Checkout canceled ────────────────────────────────────────────────────
  if (outcome === 'canceled') {
    return (
      <div className="rounded-2xl border border-slate-600/40 bg-slate-800/40 p-5">
        <p className="text-sm font-bold text-slate-200">Checkout canceled</p>
        <p className="mt-1 text-xs text-slate-400">
          You weren&apos;t charged. Your plan is unchanged.
        </p>
        <Link
          href="/pricing"
          className="mt-3 inline-block rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors px-4 py-2 text-xs font-semibold text-white"
        >
          Back to pricing
        </Link>
      </div>
    )
  }

  // ── Normal state: current plan ──────────────────────────────────────────
  const entitlements = state?.entitlements ?? null
  const tier: Tier = active && entitlements ? entitlements.tier : 'free'
  const maxMembers = entitlements?.maxMembers ?? 2
  const upgradeTier = nextTier(tier)
  const lockedFeatures = FEATURE_LIST.filter(f => !entitlements?.[f.key])
  const nextUnlocks = upgradeTier
    ? lockedFeatures.filter(
        f => TIER_ORDER.indexOf(f.tier) <= TIER_ORDER.indexOf(upgradeTier)
      )
    : []

  return (
    <div className="rounded-2xl border border-purple-500/25 bg-slate-800/40 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Current plan
          </p>
          <p className="mt-1 text-lg font-bold text-white">
            {active && label ? label : 'Free'}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            active
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-slate-700/60 text-slate-300 border border-slate-600/40'
          }`}
        >
          {active ? 'Active' : 'Free tier'}
        </span>
      </div>

      {/* Member seats */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>Family members</span>
          <span className={memberCount >= maxMembers ? 'text-amber-300' : 'text-slate-300'}>
            {memberCount} / {maxMembers}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
          <div
            className={`h-full rounded-full transition-all ${
              memberCount >= maxMembers ? 'bg-amber-500' : 'bg-purple-500'
            }`}
            style={{ width: `${Math.min(100, (memberCount / Math.max(1, maxMembers)) * 100)}%` }}
          />
        </div>
      </div>

      {/* What the next plan adds */}
      {nextUnlocks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            {TIER_LABELS[upgradeTier!]} adds
          </p>
          <ul className="space-y-1">
            {nextUnlocks.map(f => (
              <li key={f.key} className="flex items-center gap-2 text-xs text-slate-300">
                <span className="text-purple-400">🔒</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!active && (
        <Link
          href="/pricing"
          className="mt-4 block w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all px-4 py-3 text-center font-semibold text-white shadow-lg shadow-purple-600/30"
        >
          ⭐ Upgrade your plan
        </Link>
      )}
    </div>
  )
}
