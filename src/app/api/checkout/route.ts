import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getPlan, getStripe, isStripeConfigured } from '@/lib/stripe-config'

export async function POST(req: NextRequest) {
  try {
    const { familyId, plan } = await req.json()

    if (!familyId || !plan) {
      return NextResponse.json({ error: 'familyId and plan are required' }, { status: 400 })
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Payments are not yet enabled. Please check back soon.' },
        { status: 503 }
      )
    }

    const priceConfig = getPlan(plan)
    if (!priceConfig || !priceConfig.priceId) {
      return NextResponse.json({ error: `Invalid plan: ${plan}` }, { status: 400 })
    }

    const family = await prisma.family.findUnique({ where: { id: familyId } })
    if (!family) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    // Create or retrieve Stripe customer
    let customerId = family.stripeCustomerId
    if (!customerId) {
      const customer = await getStripe().customers.create({
        name: family.name,
        metadata: { familyId: family.id },
      })
      customerId = customer.id
      await prisma.family.update({
        where: { id: familyId },
        data: { stripeCustomerId: customerId },
      })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create Stripe Checkout Session
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceConfig.priceId, quantity: 1 }],
      mode: priceConfig.mode,
      success_url: `${appUrl}/family?payment=success`,
      cancel_url: `${appUrl}/family?payment=canceled`,
      metadata: { familyId, plan },
    })

    // Save pending Subscription record
    await prisma.subscription.create({
      data: {
        familyId,
        stripeSessionId: session.id,
        planType: plan,
        status: 'pending',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[checkout] Error:', error)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
