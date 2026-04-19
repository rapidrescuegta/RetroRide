/**
 * Database health-check utilities for GameBuddi.
 *
 * Usage in an API route:
 *
 *   import { checkDatabaseHealth } from '@/lib/db-health'
 *
 *   export async function GET() {
 *     const health = await checkDatabaseHealth()
 *     return Response.json(health, { status: health.ok ? 200 : 503 })
 *   }
 */

import { prisma } from '@/lib/db'

export interface DatabaseHealth {
  ok: boolean
  latencyMs: number
  timestamp: string
  error?: string
}

/**
 * Runs a lightweight `SELECT 1` against the database and returns a health
 * report including latency.
 *
 * Never throws — connection failures are captured in the `error` field.
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = performance.now()

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    const latencyMs = Math.round(performance.now() - start)

    return {
      ok: true,
      latencyMs,
      timestamp: new Date().toISOString(),
    }
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start)
    const message =
      err instanceof Error ? err.message : 'Unknown database error'

    return {
      ok: false,
      latencyMs,
      timestamp: new Date().toISOString(),
      error: message,
    }
  }
}

/**
 * Detailed health check that also verifies table accessibility.
 * Useful for deeper diagnostics (e.g. /api/health?detail=true).
 */
export async function checkDatabaseHealthDetailed(): Promise<
  DatabaseHealth & { tables?: Record<string, boolean> }
> {
  const base = await checkDatabaseHealth()
  if (!base.ok) return base

  const tables: Record<string, boolean> = {}
  const tableNames = ['Family', 'Member', 'Score', 'Tournament'] as const

  const delegates: Record<string, { count: () => Promise<number> }> = {
    Family: prisma.family as unknown as { count: () => Promise<number> },
    Member: prisma.member as unknown as { count: () => Promise<number> },
    Score: prisma.score as unknown as { count: () => Promise<number> },
    Tournament: prisma.tournament as unknown as { count: () => Promise<number> },
  }

  for (const table of tableNames) {
    try {
      await delegates[table].count()
      tables[table] = true
    } catch {
      tables[table] = false
    }
  }

  return { ...base, tables }
}
