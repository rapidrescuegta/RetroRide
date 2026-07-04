// ─────────────────────────────────────────────────────────────────────────────
// Pricing page data — single source of truth for tier display.
// Authoritative prices live in Stripe; keep in sync with src/lib/stripe-config.ts
// (DEC-GAMEBUDDI-PRICING-01: 5 paid tiers × monthly/annual).
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
      'Classic games unlocked solo',
      'Offline play (PWA)',
      'AI opponents with difficulty levels',
      'No account needed',
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
      'All 30+ games',
      'Internet multiplayer',
      'Personal stats + score history',
      'Ad-free',
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
      'Custom avatars',
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
      'Custom squad name',
      'Push notifications for challenges',
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
      'Teacher-managed tournaments',
      'Curriculum-friendly content controls',
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
      'Activity-leader dashboard',
      'Senior-friendly UI (large fonts, high contrast)',
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
    a: 'Squad is for casual groups (dorms, friend circles, sports teams) — flat-rate and member-managed. Classroom is built for educators — it adds teacher-managed tournaments, content controls, and supports up to 30 students.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'All major credit and debit cards via Stripe. Apple Pay and Google Pay are supported on mobile. Annual plans for Classroom, Care Center, and Enterprise can also be invoiced.',
  },
]
