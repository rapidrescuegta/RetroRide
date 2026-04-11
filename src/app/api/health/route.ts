import { NextRequest, NextResponse } from 'next/server'
import {
  checkDatabaseHealth,
  checkDatabaseHealthDetailed,
} from '@/lib/db-health'

/**
 * GET /api/health
 *
 * Returns database connectivity and service configuration status.
 * Use ?detail=true for table-level checks.
 * Intended for Railway health checks, monitoring dashboards, and uptime probes.
 *
 * Response shape:
 *   { status, timestamp, uptime, service, database, services }
 *
 * Returns 200 if healthy, 503 if unhealthy.
 */
export async function GET(request: NextRequest) {
  const detail = request.nextUrl.searchParams.get('detail') === 'true'

  const health = detail
    ? await checkDatabaseHealthDetailed()
    : await checkDatabaseHealth()

  // Report which external services are configured
  const services = {
    stripe: {
      configured: !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      hasPublicKey: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      hasPrices: !!(
        process.env.STRIPE_PRICE_WEEKEND &&
        process.env.STRIPE_PRICE_WEEKLY &&
        process.env.STRIPE_PRICE_MONTHLY &&
        process.env.STRIPE_PRICE_ANNUAL
      ),
    },
    email: {
      configured: !!process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'GameBuddi <noreply@gamebuddi.com>',
    },
    pushNotifications: {
      configured: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    },
    turnServer: {
      configured: !!process.env.TURN_SERVER_URL,
    },
  }

  return NextResponse.json(
    {
      status: health.ok ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'gamebuddi',
      database: health,
      services,
    },
    {
      status: health.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
