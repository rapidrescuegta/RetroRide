import { validateEnv } from '@/lib/env'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate all environment variables on server startup.
    // This makes deploys fail fast with clear error messages
    // instead of crashing later on the first request.
    validateEnv()

    // Log database connection pool settings for observability
    const isProd = process.env.NODE_ENV === 'production'
    const connectionLimit = parseInt(process.env.DATABASE_POOL_SIZE || (isProd ? '10' : '5'), 10)
    const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT || '10', 10)
    console.log(
      `[instrumentation] Server starting — env=${process.env.NODE_ENV}, ` +
      `dbPoolSize=${connectionLimit}, dbPoolTimeout=${poolTimeout}s`
    )

    // Eagerly test database connectivity so deploys fail fast
    // instead of surfacing a DB error on the first user request.
    // Skipped in dev when DATABASE_URL is empty — the app is allowed to
    // run DB-less so families can host LAN games from a laptop without
    // needing Postgres installed.
    const dbUrl = (process.env.DATABASE_URL || '').trim()
    if (!dbUrl && !isProd) {
      console.log('[instrumentation] DATABASE_URL not set — running DB-less (signaling uses in-memory store).')
    } else {
      try {
        const { connectDatabase } = await import('@/lib/db')
        await connectDatabase()
        console.log('[instrumentation] Database connection verified.')
      } catch (err) {
        console.error('[instrumentation] Database connection FAILED:', err)
        if (isProd) {
          // In production, crash the process so Railway marks the deploy as failed
          process.exit(1)
        }
      }
    }
  }
}
