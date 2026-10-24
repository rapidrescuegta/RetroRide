// ─────────────────────────────────────────────────────────────────────────────
// Tier vocabulary — safe for both server and browser.
//
// The tier names, the entitlement shape and the feature labels are needed by
// the server (which resolves a family's entitlements) and by the browser (which
// renders upgrade prompts). They live here, with no Prisma import, so a client
// component can use them without dragging the database into the bundle.
//
// The ladder itself — which tier unlocks what — lives in src/lib/entitlements.ts
// and is mirrored on /pricing (src/app/pricing/pricing-data.ts).
// ─────────────────────────────────────────────────────────────────────────────

export type Tier = 'free' | 'pro' | 'family' | 'squad' | 'classroom' | 'carecenter'

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  family: 'Family',
  squad: 'Squad',
  classroom: 'Classroom',
  carecenter: 'Care Center',
}

/** Lowest tier → highest tier. */
export const TIER_ORDER: Tier[] = ['free', 'pro', 'family', 'squad', 'classroom', 'carecenter']

export interface Entitlements {
  tier: Tier
  label: string
  /** How many members may belong to the family. */
  maxMembers: number
  /** Play with someone on another network (WebRTC + signaling relay). */
  internetMultiplayer: boolean
  /** Play over a WiFi hotspot / LAN, with no internet at all. */
  hotspotMultiplayer: boolean
  /** The family's shared scoreboard. */
  familyLeaderboard: boolean
  /** The family's chat room. */
  chat: boolean
  /** Camera / photo avatars (not just emoji). */
  customAvatars: boolean
  /** Score-based competitions and elimination brackets. */
  tournaments: boolean
  /** Challenges between family members (and the push notifications they fire). */
  pushChallenges: boolean
  /** Senior-friendly display: larger type and higher contrast. */
  seniorMode: boolean
}

/** The entitlements a locked feature is reported under. */
export const FEATURE_LABELS = {
  internetMultiplayer: 'Internet multiplayer',
  hotspotMultiplayer: 'Hotspot multiplayer',
  familyLeaderboard: 'The family leaderboard',
  chat: 'Family chat',
  customAvatars: 'Custom avatars',
  tournaments: 'Tournaments',
  pushChallenges: 'Challenges',
  maxMembers: 'More family members',
  seniorMode: 'Senior-friendly display',
} as const

export type EntitlementFeature = keyof typeof FEATURE_LABELS

/** Human-readable name for a locked feature. */
export function featureLabel(feature: EntitlementFeature): string {
  return FEATURE_LABELS[feature] ?? feature
}

/** Which entitlement a connection mode needs: internet → Pro, LAN → Family. */
export function featureForMode(mode: 'lan' | 'internet'): EntitlementFeature {
  return mode === 'lan' ? 'hotspotMultiplayer' : 'internetMultiplayer'
}
