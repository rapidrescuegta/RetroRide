// ─────────────────────────────────────────────────────────────────────────────
// Entitlements — what each paid tier actually unlocks.
//
// This is the single source of truth for feature gating. It mirrors the tier
// ladder published on /pricing (src/app/pricing/pricing-data.ts) — if you
// change one, change the other.
//
// A family's tier comes from its `planType` (e.g. "family_monthly") and is
// only honoured while the subscription is actually active. A family with no
// subscription, a lapsed one, or a failed payment sits on the free tier.
//
// Everything here is server-side: the browser never gets to decide its own
// tier. The client receives the resolved set through /api/subscription and
// uses it to show upgrade prompts; the API routes re-check it themselves.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { TIER_LABELS, featureLabel, type Entitlements, type EntitlementFeature, type Tier } from '@/lib/tiers'

export { TIER_LABELS, featureLabel } from '@/lib/tiers'
export type { Entitlements, EntitlementFeature, Tier } from '@/lib/tiers'

/**
 * The ladder. `free` is the baseline every tier is measured against; each
 * paid tier unlocks the features the pricing page advertises for it.
 */
export const TIER_ENTITLEMENTS: Record<Tier, Entitlements> = {
  free: {
    tier: 'free',
    label: TIER_LABELS.free,
    maxMembers: 2,
    internetMultiplayer: false,
    hotspotMultiplayer: false,
    familyLeaderboard: false,
    chat: false,
    customAvatars: false,
    tournaments: false,
    pushChallenges: false,
    seniorMode: false,
  },
  pro: {
    tier: 'pro',
    label: TIER_LABELS.pro,
    maxMembers: 2,
    internetMultiplayer: true,
    hotspotMultiplayer: false,
    familyLeaderboard: false,
    chat: false,
    customAvatars: false,
    tournaments: false,
    pushChallenges: false,
    seniorMode: false,
  },
  family: {
    tier: 'family',
    label: TIER_LABELS.family,
    maxMembers: 6,
    internetMultiplayer: true,
    hotspotMultiplayer: true,
    familyLeaderboard: true,
    chat: true,
    customAvatars: true,
    tournaments: false,
    pushChallenges: false,
    seniorMode: false,
  },
  squad: {
    tier: 'squad',
    label: TIER_LABELS.squad,
    maxMembers: 20,
    internetMultiplayer: true,
    hotspotMultiplayer: true,
    familyLeaderboard: true,
    chat: true,
    customAvatars: true,
    tournaments: true,
    pushChallenges: true,
    seniorMode: false,
  },
  classroom: {
    tier: 'classroom',
    label: TIER_LABELS.classroom,
    maxMembers: 30,
    internetMultiplayer: true,
    hotspotMultiplayer: true,
    familyLeaderboard: true,
    chat: true,
    customAvatars: true,
    tournaments: true,
    pushChallenges: true,
    seniorMode: true,
  },
  carecenter: {
    tier: 'carecenter',
    label: TIER_LABELS.carecenter,
    maxMembers: 50,
    internetMultiplayer: true,
    hotspotMultiplayer: true,
    familyLeaderboard: true,
    chat: true,
    customAvatars: true,
    tournaments: true,
    pushChallenges: true,
    seniorMode: true,
  },
}

/** The tier a plan key (`family_monthly`) belongs to. */
export function tierForPlan(planType: string | null | undefined): Tier {
  if (!planType) return 'free'
  const tier = planType.split('_')[0] as Tier
  return tier in TIER_ENTITLEMENTS ? tier : 'free'
}

/** The entitlements a plan key grants, ignoring whether it is actually paid. */
export function entitlementsForPlan(planType: string | null | undefined): Entitlements {
  return TIER_ENTITLEMENTS[tierForPlan(planType)]
}

/**
 * The entitlements a family actually has right now.
 *
 * A tier is only granted when the subscription is `active`. Everything else —
 * no subscription, `pending`, `payment_failed`, `expired` — falls back to the
 * free tier.
 */
export async function getFamilyEntitlements(familyId: string): Promise<Entitlements> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { subscriptionStatus: true, planType: true, planExpiresAt: true },
  })

  if (!family) return TIER_ENTITLEMENTS.free
  if (family.subscriptionStatus !== 'active') return TIER_ENTITLEMENTS.free
  if (family.planExpiresAt && family.planExpiresAt < new Date()) return TIER_ENTITLEMENTS.free

  return entitlementsForPlan(family.planType)
}

/** The tier a family needs to use a given feature — for error messages. */
export function requiredTierFor(feature: EntitlementFeature): Tier {
  for (const tier of Object.keys(TIER_ENTITLEMENTS) as Tier[]) {
    if (TIER_ENTITLEMENTS[tier][feature] === true) return tier
  }
  return 'free'
}

/** A ready-to-send 403 body for a locked feature. */
export function lockedResponse(
  feature: EntitlementFeature,
  entitlements: Entitlements
): { error: string; requiredTier: string; currentTier: string } {
  const required = requiredTierFor(feature)
  return {
    error: `${featureLabel(feature)} is a ${TIER_LABELS[required]} feature. Upgrade to unlock it.`,
    requiredTier: required,
    currentTier: entitlements.tier,
  }
}
