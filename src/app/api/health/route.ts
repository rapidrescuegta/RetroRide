import { NextRequest, NextResponse } from 'next/server'
import {
  checkDatabaseHealth,
  checkDatabaseHealthDetailed,
} from '@/lib/db-health'
import { isPushConfigured } from '@/lib/push-server'

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
        process.env.STRIPE_PRICE_PRO_MONTHLY &&
        process.env.STRIPE_PRICE_PRO_ANNUAL &&
        process.env.STRIPE_PRICE_FAMILY_MONTHLY &&
        process.env.STRIPE_PRICE_FAMILY_ANNUAL &&
        process.env.STRIPE_PRICE_SQUAD_MONTHLY &&
        process.env.STRIPE_PRICE_SQUAD_ANNUAL &&
        process.env.STRIPE_PRICE_CLASSROOM_MONTHLY &&
        process.env.STRIPE_PRICE_CLASSROOM_ANNUAL &&
        process.env.STRIPE_PRICE_CARECENTER_MONTHLY &&
        process.env.STRIPE_PRICE_CARECENTER_ANNUAL
      ),
    },
    email: {
      configured: !!process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM || 'GameBuddi <noreply@gamebuddi.com>',
    },
    pushNotifications: {
      configured: isPushConfigured(),
    },
    turnServer: {
      // /api/ice-config always serves 4 STUN servers and falls back to the
      // built-in public TURN relay, so TURN is available even with no
      // TURN_SERVER_URL configured. Report which source is in use instead of
      // flagging a false negative.
      configured: true,
      source: process.env.TURN_SERVER_URL ? 'configured' : 'public-relay',
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
