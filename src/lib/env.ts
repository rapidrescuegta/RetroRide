// ─────────────────────────────────────────────────────────────────────────────
// Environment variable validation and typed access
// ─────────────────────────────────────────────────────────────────────────────

/** Reads an env var, returning undefined if empty or missing. */
function read(key: string): string | undefined {
  const value = process.env[key]
  if (!value || value.trim() === '') return undefined
  return value.trim()
}

/** Reads a required env var, throwing a descriptive error if missing. */
function required(key: string, description: string): string {
  const value = read(key)
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}\n` +
      `  Description: ${description}\n` +
      `  Hint: Copy .env.example to .env and fill in the value.`
    )
  }
  return value
}

// ─────────────────────────────────────────────────────────────────────────────
// Server-only variables (never exposed to the browser)
// ─────────────────────────────────────────────────────────────────────────────

function loadServerEnv() {
  const isProd = process.env.NODE_ENV === 'production'

  return {
    // Required in production. In development it's optional: the signaling
    // relay falls back to an in-memory store (see src/lib/signal-store.ts)
    // so a family can run the app on a laptop with just a hotspot — no
    // Postgres needed. Features that genuinely need a DB (family accounts,
    // leaderboards, tournament history) will still return graceful errors.
    DATABASE_URL: isProd
      ? required(
          'DATABASE_URL',
          'PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/db)'
        )
      : read('DATABASE_URL') ?? '',

    // Stripe — optional until payments launch. Empty string means "not
    // configured"; checkout/subscription code must guard on these before use
    // so the app boots and serves games even when Stripe is unset.
    STRIPE_SECRET_KEY: read('STRIPE_SECRET_KEY') ?? '',
    STRIPE_WEBHOOK_SECRET: read('STRIPE_WEBHOOK_SECRET') ?? '',
    STRIPE_PRICE_WEEKEND: read('STRIPE_PRICE_WEEKEND') ?? '',
    STRIPE_PRICE_WEEKLY: read('STRIPE_PRICE_WEEKLY') ?? '',
    STRIPE_PRICE_MONTHLY: read('STRIPE_PRICE_MONTHLY') ?? '',
    STRIPE_PRICE_ANNUAL: read('STRIPE_PRICE_ANNUAL') ?? '',

    // Email
    RESEND_API_KEY: read('RESEND_API_KEY') ?? '',
    EMAIL_FROM: read('EMAIL_FROM') ?? 'GameBuddi <noreply@gamebuddi.com>',

    // Push notifications (VAPID)
    VAPID_PRIVATE_KEY: read('VAPID_PRIVATE_KEY') ?? '',

    // WebRTC TURN server
    TURN_SERVER_URL: read('TURN_SERVER_URL') ?? '',
    TURN_SERVER_USERNAME: read('TURN_SERVER_USERNAME') ?? '',
    TURN_SERVER_CREDENTIAL: read('TURN_SERVER_CREDENTIAL') ?? '',

    // Cron
    CRON_SECRET: read('CRON_SECRET') ?? '',
  } as const
}

// ─────────────────────────────────────────────────────────────────────────────
// Public variables (exposed to the browser via NEXT_PUBLIC_ prefix)
// ─────────────────────────────────────────────────────────────────────────────

function loadPublicEnv() {
  return {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: read('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') ?? '',
    NEXT_PUBLIC_APP_URL: read('NEXT_PUBLIC_APP_URL') ?? 'http://localhost:3000',
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: read('NEXT_PUBLIC_VAPID_PUBLIC_KEY') ?? '',
  } as const
}

// ─────────────────────────────────────────────────────────────────────────────
// Cached singletons — env is parsed once, then reused
// ─────────────────────────────────────────────────────────────────────────────

let _serverEnv: ReturnType<typeof loadServerEnv> | null = null
let _publicEnv: ReturnType<typeof loadPublicEnv> | null = null

/**
 * Server-only environment variables.
 * Throws on first access if any required variable is missing.
 * Safe to import in server components, API routes, and server actions.
 */
export function serverEnv() {
  if (!_serverEnv) _serverEnv = loadServerEnv()
  return _serverEnv
}

/**
 * Public environment variables (NEXT_PUBLIC_*).
 * Safe to use anywhere — server or client.
 */
export function publicEnv() {
  if (!_publicEnv) _publicEnv = loadPublicEnv()
  return _publicEnv
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates ALL environment variables at once and reports every missing var
 * in a single error. Call this in your app startup (e.g. instrumentation.ts)
 * so deploys fail fast with a clear message.
 */
export function validateEnv(): void {
  const errors: string[] = []
  const isProd = process.env.NODE_ENV === 'production'

  // Only required in production. In dev the app can run DB-less.
  const requiredServerVars: [string, string][] = []

  if (isProd) {
    // DATABASE_URL is the only hard requirement to boot in production.
    // Stripe (payments) is an optional, not-yet-launched feature: if its
    // vars are absent the app must still boot and serve games, multiplayer,
    // and SEO assets — checkout simply stays disabled until keys are added.
    // Hard-requiring Stripe here previously crashed every deploy at startup.
    requiredServerVars.push(
      ['DATABASE_URL', 'PostgreSQL connection string'],
    )
  }

  const requiredPublicVars: [string, string][] = []

  for (const [key, desc] of [...requiredServerVars, ...requiredPublicVars]) {
    if (!read(key)) {
      errors.push(`  - ${key}: ${desc}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `\n\nMissing required environment variables:\n${errors.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in all values.\n`
    )
  }

  // Warn about optional vars that are not set
  const optionalVars: [string, string][] = [
    ...(isProd ? [] : [['DATABASE_URL', 'No Postgres — signaling will use in-memory store; family/leaderboard features disabled'] as [string, string]]),
    ['STRIPE_SECRET_KEY', 'Payments disabled — checkout/subscriptions unavailable until Stripe keys are added'],
    ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook verification disabled'],
    ['STRIPE_PRICE_WEEKEND', 'Weekend pass not purchasable'],
    ['STRIPE_PRICE_WEEKLY', 'Weekly pass not purchasable'],
    ['STRIPE_PRICE_MONTHLY', 'Monthly subscription not purchasable'],
    ['STRIPE_PRICE_ANNUAL', 'Annual subscription not purchasable'],
    ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Stripe.js disabled on the client'],
    ['NEXT_PUBLIC_APP_URL', 'Using default origin — set to https://gamebuddi.com in production'],
    ['RESEND_API_KEY', 'Email sending disabled — verification codes will be logged to console'],
    ['CRON_SECRET', 'Cron endpoints will be unprotected'],
    ['EMAIL_FROM', 'Using default: GameBuddi <noreply@gamebuddi.com>'],
    ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'Push notifications will be unavailable'],
    ['VAPID_PRIVATE_KEY', 'Push notifications will be unavailable'],
    ['TURN_SERVER_URL', 'WebRTC will use public STUN/TURN fallback servers'],
  ]

  for (const [key, warning] of optionalVars) {
    if (!read(key)) {
      console.warn(`[env] ${key} not set — ${warning}`)
    }
  }

  console.log('[env] Environment validation passed.')
}

// ─────────────────────────────────────────────────────────────────────────────
// Type exports for convenience
// ─────────────────────────────────────────────────────────────────────────────

export type ServerEnv = ReturnType<typeof serverEnv>
export type PublicEnv = ReturnType<typeof publicEnv>
