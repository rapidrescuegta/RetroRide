import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const PRICES: Record<string, { priceId: string; mode: 'payment' | 'subscription'; days?: number }> = {
  weekend: { priceId: process.env.STRIPE_PRICE_WEEKEND!, mode: 'payment', days: 3 },
  weekly: { priceId: process.env.STRIPE_PRICE_WEEKLY!, mode: 'payment', days: 7 },
  monthly: { priceId: process.env.STRIPE_PRICE_MONTHLY!, mode: 'subscription' },
  annual: { priceId: process.env.STRIPE_PRICE_ANNUAL!, mode: 'subscription' },
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, plan } = await req.json()

    if (!familyId || !plan) {
      return NextResponse.json({ error: 'familyId and plan are required' }, { status: 400 })
    }

    const priceConfig = PRICES[plan]
    if (!priceConfig) {
      return NextResponse.json({ error: `Invalid plan: ${plan}` }, { status: 400 })
    }

    const family = await prisma.family.findUnique({ where: { id: familyId } })
    if (!family) {
      return NextResponse.json({ error: 'Family not found' }, { status: 404 })
    }

    // Create or retrieve Stripe customer
    let customerId = family.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: family.name,
        metadata: { familyId: family.id },
      })
      customerId = customer.id
      await prisma.family.update({
        where: { id: familyId },
        data: { stripeCustomerId: customerId },
      })
    }

    const origin = req.headers.get('origin') || process.env.NEXTAUTH_URL || 'http://localhost:3000'

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceConfig.priceId, quantity: 1 }],
      mode: priceConfig.mode,
      success_url: `${origin}/family?payment=success`,
      cancel_url: `${origin}/family?payment=canceled`,
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
