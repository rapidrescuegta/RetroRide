import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// POST /api/push-subscribe — Save or update a push subscription
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { memberId, subscription } = body

    if (!memberId || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json(
        { error: 'Missing required fields: memberId, subscription (with endpoint, keys.p256dh, keys.auth)' },
        { status: 400 }
      )
    }

    // Verify the member exists
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Upsert by endpoint — a device can only have one subscription
    const pushSub = await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        memberId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
      update: {
        memberId,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    })

    return NextResponse.json({ ok: true, id: pushSub.id })
  } catch (err) {
    console.error('[push-subscribe] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/push-subscribe — Remove a push subscription
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing required field: endpoint' }, { status: 400 })
    }

    // Delete if it exists (ignore if not found)
    await prisma.pushSubscription.deleteMany({ where: { endpoint } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push-subscribe] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
