// ─────────────────────────────────────────────────────────────────────────────
// Stripe configuration — single source of truth for Stripe setup
// ─────────────────────────────────────────────────────────────────────────────

import Stripe from 'stripe'
import { serverEnv, publicEnv } from '@/lib/env'

// ─────────────────────────────────────────────────────────────────────────────
// Stripe client singleton
// ─────────────────────────────────────────────────────────────────────────────

let _stripe: Stripe | null = null

/** Returns a configured Stripe instance (server-side only). */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(serverEnv().STRIPE_SECRET_KEY, {
      typescript: true,
    })
  }
  return _stripe
}

/** Webhook signing secret for verifying Stripe events. */
export function getWebhookSecret(): string {
  return serverEnv().STRIPE_WEBHOOK_SECRET
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan configuration
// ─────────────────────────────────────────────────────────────────────────────

export type PlanName = 'weekend' | 'weekly' | 'monthly' | 'annual'

export interface PlanConfig {
  priceId: string
  mode: 'payment' | 'subscription'
  /** For one-time passes, how many days of access the plan grants. */
  days?: number
  label: string
}

/** Returns a map of plan names to their Stripe configuration. */
export function getPlans(): Record<PlanName, PlanConfig> {
  const env = serverEnv()
  return {
    weekend: {
      priceId: env.STRIPE_PRICE_WEEKEND,
      mode: 'payment',
      days: 3,
      label: 'Weekend Pass (3 days)',
    },
    weekly: {
      priceId: env.STRIPE_PRICE_WEEKLY,
      mode: 'payment',
      days: 7,
      label: 'Weekly Pass (7 days)',
    },
    monthly: {
      priceId: env.STRIPE_PRICE_MONTHLY,
      mode: 'subscription',
      label: 'Monthly Subscription',
    },
    annual: {
      priceId: env.STRIPE_PRICE_ANNUAL,
      mode: 'subscription',
      label: 'Annual Subscription',
    },
  }
}

/** Returns the config for a single plan, or null if the plan name is invalid. */
export function getPlan(name: string): PlanConfig | null {
  const plans = getPlans()
  return plans[name as PlanName] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout helpers
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateCheckoutParams {
  customerId: string
  familyId: string
  plan: PlanName
  /** Override the default success/cancel URLs if needed. */
  successUrl?: string
  cancelUrl?: string
}

/**
 * Creates a Stripe Checkout Session for the given plan.
 * Returns the session object (caller should redirect to session.url).
 */
export async function createCheckoutSession(
  params: CreateCheckoutParams
): Promise<Stripe.Checkout.Session> {
  const { customerId, familyId, plan, successUrl, cancelUrl } = params
  const planConfig = getPlan(plan)

  if (!planConfig) {
    throw new Error(`Invalid plan name: ${plan}`)
  }

  const appUrl = publicEnv().NEXT_PUBLIC_APP_URL

  return getStripe().checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    mode: planConfig.mode,
    success_url: successUrl ?? `${appUrl}/family?payment=success`,
    cancel_url: cancelUrl ?? `${appUrl}/family?payment=canceled`,
    metadata: { familyId, plan },
  })
}

/**
 * Creates (or retrieves an existing) Stripe customer for a family.
 * Returns the customer ID.
 */
export async function ensureStripeCustomer(
  familyName: string,
  familyId: string,
  existingCustomerId?: string | null
): Promise<string> {
  if (existingCustomerId) return existingCustomerId

  const customer = await getStripe().customers.create({
    name: familyName,
    metadata: { familyId },
  })

  return customer.id
}

/**
 * Verifies and parses a Stripe webhook event from a raw request body.
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    body,
    signature,
    getWebhookSecret()
  )
}

/** Publishable key for client-side Stripe.js (safe to expose). */
export function getPublishableKey(): string {
  return publicEnv().NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
}
