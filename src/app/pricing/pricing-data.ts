// ─────────────────────────────────────────────────────────────────────────────
// Pricing page data — single source of truth for tier display.
//
// Authoritative prices live in Stripe; keep in sync with src/lib/stripe-config.ts
// (DEC-GAMEBUDDI-PRICING-01: 5 paid tiers × monthly/annual).
//
// Every bullet below is enforced by the app. The ladder that decides who gets
// what lives in src/lib/entitlements.ts (server-side, the real gate) and the
// feature flags themselves live in src/lib/tiers.ts. If you change a bullet
// here, change the entitlement that backs it — otherwise the pricing page
// starts selling something the app doesn't do.
// ─────────────────────────────────────────────────────────────────────────────

export interface TierDisplay {
  id: string
  name: string
  audience: 'b2c' | 'b2b' | 'both'
  monthlyPrice: number | null // null = free or custom
  annualPrice: number | null
  monthlyKey: string | null // plan key sent to /api/checkout
  annualKey: string | null
  tagline: string
  features: string[]
  cta: string
  featured?: boolean
  badge?: string
}

export const TIERS: TierDisplay[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'b2c',
    monthlyPrice: 0,
    annualPrice: 0,
    monthlyKey: null,
    annualKey: null,
    tagline: 'Play solo, forever free',
    features: [
      'Every game unlocked for solo play',
      'Offline play (PWA) — airplane mode ready',
      'AI opponents with difficulty levels',
      'No account needed',
      'Up to 2 family members',
    ],
    cta: 'Start playing free',
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'b2c',
    monthlyPrice: 4.99,
    annualPrice: 39,
    monthlyKey: 'pro_monthly',
    annualKey: 'pro_annual',
    tagline: 'For the solo player',
    features: [
      'Everything in Free',
      'Internet multiplayer — room code or share link',
      'Play with friends anywhere in the world',
      'Peer-to-peer connection — no game data on our servers',
    ],
    cta: 'Get Pro',
  },
  {
    id: 'family',
    name: 'Family',
    audience: 'b2c',
    monthlyPrice: 9.99,
    annualPrice: 79,
    monthlyKey: 'family_monthly',
    annualKey: 'family_annual',
    tagline: 'Game night, anywhere',
    features: [
      'Everything in Pro',
      'Up to 6 family members',
      'Local hotspot play — no WiFi needed',
      'Family leaderboard + chat',
      'Photo avatars',
    ],
    cta: 'Get Family',
    featured: true,
    badge: 'MOST POPULAR',
  },
  {
    id: 'squad',
    name: 'Squad',
    audience: 'both',
    monthlyPrice: 19,
    annualPrice: 159,
    monthlyKey: 'squad_monthly',
    annualKey: 'squad_annual',
    tagline: 'Dorms, teams & friend groups',
    features: [
      'Everything in Family',
      'Up to 20 members',
      'Tournament mode (brackets + round-robin)',
      'Challenges between members, with push notifications',
    ],
    cta: 'Get Squad',
  },
  {
    id: 'classroom',
    name: 'Classroom',
    audience: 'b2b',
    monthlyPrice: 29,
    annualPrice: 249,
    monthlyKey: 'classroom_monthly',
    annualKey: 'classroom_annual',
    tagline: 'Built for educators',
    features: [
      'Everything in Squad',
      'Up to 30 students',
      'Create and manage tournaments for the whole class',
      'Senior-friendly display mode (large text, high contrast)',
    ],
    cta: 'Get Classroom',
  },
  {
    id: 'carecenter',
    name: 'Care Center',
    audience: 'b2b',
    monthlyPrice: 49,
    annualPrice: 419,
    monthlyKey: 'carecenter_monthly',
    annualKey: 'carecenter_annual',
    tagline: 'Senior care & day programs',
    features: [
      'Everything in Classroom',
      'Up to 50 residents/clients',
      'Group tournament dashboard for activity leaders',
      'Senior-friendly display mode (large text, high contrast)',
    ],
    cta: 'Get Care Center',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'b2b',
    monthlyPrice: null,
    annualPrice: null,
    monthlyKey: null,
    annualKey: null,
    tagline: '50+ seats, custom terms',
    features: [
      'Everything in Care Center, scaled',
      '50+ seats',
      'Dedicated support',
      'Annual invoice billing',
    ],
    cta: 'Talk to us',
  },
]

export const PRICING_FAQS: { q: string; a: string }[] = [
  {
    q: 'Can I change plans later?',
    a: 'Yes — upgrade or downgrade at any time from your family settings. Stripe pro-rates the difference automatically. No fees, no contracts.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your settings in two clicks — you keep access until the end of your current billing period, and you are never charged again.',
  },
  {
    q: 'Can I share my Family plan with grandparents in another city?',
    a: 'Yes — the Family plan covers up to 6 members anywhere in the world. Internet multiplayer connects them in seconds.',
  },
  {
    q: 'Do I need internet to play?',
    a: 'No. GameBuddi is an offline-first PWA — cache games on your device and play anywhere: airplane, road trip, cabin. Family plans also unlock local hotspot multiplayer with no WiFi at all. Sync resumes when you are back online.',
  },
  {
    q: "What's the difference between Squad and Classroom?",
    a: 'Squad is for casual groups (dorms, friend circles, sports teams) — flat-rate and member-managed. Classroom is built for educators — it raises the seat count to 30 students and adds the senior-friendly display mode for shared tablets.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards via Stripe. Apple Pay and Google Pay are supported on mobile. Annual plans for Classroom, Care Center, and Enterprise can also be invoiced.',
  },
]
