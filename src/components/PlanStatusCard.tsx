'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

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
}

type PaymentOutcome = 'success' | 'canceled' | null

const TIER_LABELS: Record<string, string> = {
  pro: 'Pro',
  family: 'Family',
  squad: 'Squad',
  classroom: 'Classroom',
  carecenter: 'Care Center',
}

/** Turns a plan key like `family_monthly` into "Family (monthly)". */
function planLabel(plan: string | null): string | null {
  if (!plan) return null
  const [tier, cadence] = plan.split('_')
  const label = TIER_LABELS[tier]
  if (!label) return plan
  return cadence === 'annual' ? `${label} (annual)` : `${label} (monthly)`
}

const POLL_INTERVAL_MS = 2500
const POLL_ATTEMPTS = 20 // ~50s

export default function PlanStatusCard({ familyId }: { familyId: string }) {
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
