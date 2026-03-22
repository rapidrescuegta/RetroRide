import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!)
}
function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!
}

const PLAN_DAYS: Record<string, number> = {
  weekend: 3,
  weekly: 7,
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret())
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { familyId, plan } = session.metadata || {}
        if (!familyId || !plan) break

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSessionId: session.id },
        })

        if (session.mode === 'payment') {
          // One-time payment (weekend/weekly)
          const days = PLAN_DAYS[plan] || 7
          const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'active', expiresAt },
            })
          }

          await prisma.family.update({
            where: { id: familyId },
            data: {
              subscriptionStatus: 'active',
              planType: plan,
              planExpiresAt: expiresAt,
            },
          })
        } else {
          // Subscription (monthly/annual)
          const stripeSubId = session.subscription as string

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'active', stripeSubId },
            })
          }

          await prisma.family.update({
            where: { id: familyId },
            data: {
              subscriptionStatus: 'active',
              planType: plan,
              planExpiresAt: null,
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status === 'active' ? 'active' : sub.status

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSubId: sub.id },
        })

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status },
          })

          await prisma.family.update({
            where: { id: subscription.familyId },
            data: { subscriptionStatus: status },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSubId: sub.id },
        })

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'expired' },
          })

          await prisma.family.update({
            where: { id: subscription.familyId },
            data: { subscriptionStatus: 'expired' },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeSubId = (invoice as unknown as { subscription: string | null }).subscription
        if (!stripeSubId) break

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSubId },
        })

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'payment_failed' },
          })

          await prisma.family.update({
            where: { id: subscription.familyId },
            data: { subscriptionStatus: 'payment_failed' },
          })
        }
        break
      }
    }
  } catch (error) {
    console.error('[webhook] Error processing event:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
