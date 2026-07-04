import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { constructWebhookEvent, getPlanKey, getStripe } from '@/lib/stripe-config'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { familyId, plan: metadataPlan } = session.metadata || {}
        if (!familyId) break

        const subscription = await prisma.subscription.findUnique({
          where: { stripeSessionId: session.id },
        })

        const stripeSubId = session.subscription as string

        // Defense in depth — if Stripe gives us a subscription, recover the plan
        // key from its line items rather than trusting metadata alone.
        let plan = metadataPlan
        if (stripeSubId) {
          try {
            const stripeSub = await getStripe().subscriptions.retrieve(stripeSubId)
            const priceId = stripeSub.items.data[0]?.price?.id
            if (priceId) {
              const recovered = getPlanKey(priceId)
              if (recovered) plan = recovered
            }
          } catch (err) {
            console.warn('[webhook] Failed to recover plan key from Stripe sub:', err)
          }
        }

        if (!plan) {
          console.error('[webhook] checkout.session.completed without resolvable plan key', { sessionId: session.id })
          break
        }

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'active', stripeSubId, planType: plan },
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
