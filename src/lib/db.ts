/**
 * Production-ready Prisma database client for GameBuddi.
 *
 * Features:
 *   - Singleton pattern (one PrismaClient per process)
 *   - Connection pooling via @prisma/adapter-pg
 *   - Query logging in development
 *   - Graceful shutdown hooks
 *   - Explicit connect/disconnect helpers
 */

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogLevel = 'query' | 'info' | 'warn' | 'error'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const isDev = process.env.NODE_ENV !== 'production'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your .env file.\n' +
      'See .env.example for the expected format.'
  )
}

// Log levels: verbose in dev, warnings + errors only in production
const logLevels: LogLevel[] = isDev
  ? ['query', 'info', 'warn', 'error']
  : ['warn', 'error']

// ---------------------------------------------------------------------------
// Connection pool tuning
// ---------------------------------------------------------------------------

/** Max connections in the pool. Override with DATABASE_POOL_SIZE env var. */
const connectionLimit = parseInt(
  process.env.DATABASE_POOL_SIZE || (isDev ? '5' : '10'),
  10
)

/** Seconds to wait for a connection from the pool. Override with DATABASE_POOL_TIMEOUT. */
const poolTimeout = parseInt(
  process.env.DATABASE_POOL_TIMEOUT || '10',
  10
)

/**
 * Appends connection pool query parameters to the DATABASE_URL if they are
 * not already present. This ensures production deployments get sensible pool
 * defaults without requiring manual URL editing.
 */
function buildConnectionUrl(baseUrl: string): string {
  const url = new URL(baseUrl)

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(connectionLimit))
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', String(poolTimeout))
  }

  return url.toString()
}

const pooledDatabaseUrl = buildConnectionUrl(DATABASE_URL)

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: pooledDatabaseUrl })

  const client = new PrismaClient({
    adapter,
    log: logLevels,
  })

  return client
}

/**
 * The shared Prisma client instance.
 *
 * In development the instance is cached on `globalThis` so that hot-reloads
 * (Next.js fast-refresh) do not create dozens of connections.
 */
export const prisma: PrismaClient =
  globalForPrisma.__prisma ?? createPrismaClient()

if (isDev) {
  globalForPrisma.__prisma = prisma
}

// ---------------------------------------------------------------------------
// Lifecycle helpers
// ---------------------------------------------------------------------------

/**
 * Explicitly connect to the database.
 * Prisma lazy-connects on the first query, but you can call this during
 * server startup to fail fast if the database is unreachable.
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect()
}

/**
 * Disconnect from the database. Call this in graceful shutdown handlers.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}

// ---------------------------------------------------------------------------
// Graceful shutdown (works in standalone Node / Next.js custom server)
// ---------------------------------------------------------------------------

function handleShutdown(signal: string) {
  console.log(`[db] Received ${signal} — disconnecting Prisma...`)
  prisma
    .$disconnect()
    .then(() => {
      console.log('[db] Prisma disconnected.')
      process.exit(0)
    })
    .catch((err) => {
      console.error('[db] Error during disconnect:', err)
      process.exit(1)
    })
}

// Only attach once (guard against hot-reload re-registration)
if (typeof process !== 'undefined' && !globalForPrisma.__prisma) {
  process.on('SIGINT', () => handleShutdown('SIGINT'))
  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
}
