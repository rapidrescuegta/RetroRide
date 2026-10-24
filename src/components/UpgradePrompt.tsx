'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { TIER_LABELS, type EntitlementFeature, type Tier } from '@/lib/tiers'
import { useEntitlements } from '@/lib/use-entitlements'

// ─── Upgrade prompt ─────────────────────────────────────────────────────────
// Shown in place of a feature the family's tier doesn't include.
//
// The tier is resolved by the server; this component only mirrors it so the
// player gets a clear "why" instead of a dead button. Every API route
// re-checks the tier itself, so this is presentation, not enforcement.

interface UpgradePromptProps {
  feature: EntitlementFeature
  /** The tier that unlocks it. Defaults to the ladder's first tier with the flag. */
  requiredTier?: Tier
  /** Optional extra line — e.g. how many members the current tier seats. */
  detail?: string
  /** Hide the "current plan" line when it would be noise. */
  compact?: boolean
}

export default function UpgradePrompt({
  feature,
  requiredTier,
  detail,
  compact = false,
}: UpgradePromptProps) {
  const { entitlements } = useEntitlements()

  const label = FEATURE_TEXT[feature]
  const required = requiredTier ?? DEFAULT_REQUIRED[feature]
  const requiredLabel = TIER_LABELS[required]

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/60 to-slate-900/60 p-6 text-center">
      <div className="text-4xl mb-3">🔒</div>
      <h3 className="text-lg font-bold text-white mb-1">{label}</h3>
      <p className="text-sm text-slate-300 mb-1">
        <span className="font-semibold text-purple-300">{label}</span> is included with the{' '}
        <span className="font-semibold text-white">{requiredLabel}</span> plan.
      </p>
      {detail && <p className="text-sm text-slate-400 mb-1">{detail}</p>}
      {!compact && (
        <p className="text-xs text-slate-500 mb-4">
          You are on the {entitlements.label} tier.
        </p>
      )}
      <Link
        href="/pricing"
        className="inline-block px-6 py-3 rounded-xl font-bold text-white text-sm transition-all hover:brightness-110"
        style={{
          background: 'linear-gradient(135deg, #7c3aed, #ec4899)',
          boxShadow: '0 0 24px rgba(124, 58, 237, 0.35)',
        }}
      >
        ⭐ Upgrade to {requiredLabel}
      </Link>
    </div>
  )
}

// ─── Text per feature ───────────────────────────────────────────────────────

const FEATURE_TEXT: Record<EntitlementFeature, string> = {
  internetMultiplayer: 'Internet multiplayer',
  hotspotMultiplayer: 'Hotspot multiplayer',
  familyLeaderboard: 'The family leaderboard',
  chat: 'Family chat',
  customAvatars: 'Custom avatars',
  tournaments: 'Tournaments',
  pushChallenges: 'Challenges',
  maxMembers: 'More family members',
  seniorMode: 'Senior-friendly display',
}

const DEFAULT_REQUIRED: Record<EntitlementFeature, Tier> = {
  internetMultiplayer: 'pro',
  hotspotMultiplayer: 'family',
  familyLeaderboard: 'family',
  chat: 'family',
  customAvatars: 'family',
  tournaments: 'squad',
  pushChallenges: 'squad',
  maxMembers: 'family',
  seniorMode: 'classroom',
}

// ─── Gate wrapper ───────────────────────────────────────────────────────────
// Renders `children` when the family is entitled, otherwise the prompt.

interface EntitlementGateProps {
  feature: EntitlementFeature
  requiredTier?: Tier
  detail?: string
  children: ReactNode
  /** Rendered instead of the prompt while the tier is still being fetched. */
  fallback?: ReactNode
}

export function EntitlementGate({
  feature,
  requiredTier,
  detail,
  children,
  fallback = null,
}: EntitlementGateProps) {
  const { entitlements, loading } = useEntitlements()

  if (loading) return <>{fallback}</>
  if (entitlements[feature]) return <>{children}</>

  return (
    <UpgradePrompt feature={feature} requiredTier={requiredTier} detail={detail} />
  )
}
