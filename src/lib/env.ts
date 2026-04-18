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

    // Stripe — required in production, optional in development
    STRIPE_SECRET_KEY: isProd
      ? required('STRIPE_SECRET_KEY', 'Stripe secret API key (starts with sk_)')
      : read('STRIPE_SECRET_KEY') ?? '',
    STRIPE_WEBHOOK_SECRET: isProd
      ? required('STRIPE_WEBHOOK_SECRET', 'Stripe webhook signing secret (starts with whsec_)')
      : read('STRIPE_WEBHOOK_SECRET') ?? '',
    STRIPE_PRICE_WEEKEND: isProd
      ? required('STRIPE_PRICE_WEEKEND', 'Stripe Price ID for the weekend pass (starts with price_)')
      : read('STRIPE_PRICE_WEEKEND') ?? '',
    STRIPE_PRICE_WEEKLY: isProd
      ? required('STRIPE_PRICE_WEEKLY', 'Stripe Price ID for the weekly pass (starts with price_)')
      : read('STRIPE_PRICE_WEEKLY') ?? '',
    STRIPE_PRICE_MONTHLY: isProd
      ? required('STRIPE_PRICE_MONTHLY', 'Stripe Price ID for the monthly subscription (starts with price_)')
      : read('STRIPE_PRICE_MONTHLY') ?? '',
    STRIPE_PRICE_ANNUAL: isProd
      ? required('STRIPE_PRICE_ANNUAL', 'Stripe Price ID for the annual subscription (starts with price_)')
      : read('STRIPE_PRICE_ANNUAL') ?? '',

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
  const isProd = process.env.NODE_ENV === 'production'

  return {
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: isProd
      ? required('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Stripe publishable API key (starts with pk_)')
      : read('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') ?? '',
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
    requiredServerVars.push(
      ['DATABASE_URL', 'PostgreSQL connection string'],
      ['STRIPE_SECRET_KEY', 'Stripe secret API key'],
      ['STRIPE_WEBHOOK_SECRET', 'Stripe webhook signing secret'],
      ['STRIPE_PRICE_WEEKEND', 'Stripe Price ID for weekend pass'],
      ['STRIPE_PRICE_WEEKLY', 'Stripe Price ID for weekly pass'],
      ['STRIPE_PRICE_MONTHLY', 'Stripe Price ID for monthly subscription'],
      ['STRIPE_PRICE_ANNUAL', 'Stripe Price ID for annual subscription'],
    )
  }

  const requiredPublicVars: [string, string][] = isProd
    ? [
        ['NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'Stripe publishable API key'],
        ['NEXT_PUBLIC_APP_URL', 'Public-facing app URL (e.g. https://gamebuddi.com)'],
      ]
    : []

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
