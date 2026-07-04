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

export type PlanName =
  | 'pro_monthly'
  | 'pro_annual'
  | 'family_monthly'
  | 'family_annual'
  | 'squad_monthly'
  | 'squad_annual'
  | 'classroom_monthly'
  | 'classroom_annual'
  | 'carecenter_monthly'
  | 'carecenter_annual'

/** Tier a plan belongs to (cadence-agnostic). */
export type PlanTier = 'pro' | 'family' | 'squad' | 'classroom' | 'carecenter'

/** Billing cadence. */
export type PlanCadence = 'monthly' | 'annual'

export interface PlanConfig {
  priceId: string
  mode: 'subscription'   // All paid plans are recurring; one-time passes retired.
  tier: PlanTier
  cadence: PlanCadence
  label: string
  /** Display price, in USD, for UI surfaces. Authoritative price still lives in Stripe. */
  displayPrice: string
}

/** True when Stripe is configured (secret key present). Checkout must guard on this. */
export function isStripeConfigured(): boolean {
  return serverEnv().STRIPE_SECRET_KEY !== ''
}

/** Returns a map of plan names to their Stripe configuration. */
export function getPlans(): Record<PlanName, PlanConfig> {
  const env = serverEnv()
  return {
    pro_monthly:        { priceId: env.STRIPE_PRICE_PRO_MONTHLY,        mode: 'subscription', tier: 'pro',        cadence: 'monthly', label: 'Pro (monthly)',         displayPrice: '$4.99/mo' },
    pro_annual:         { priceId: env.STRIPE_PRICE_PRO_ANNUAL,         mode: 'subscription', tier: 'pro',        cadence: 'annual',  label: 'Pro (annual)',          displayPrice: '$39/yr'   },
    family_monthly:     { priceId: env.STRIPE_PRICE_FAMILY_MONTHLY,     mode: 'subscription', tier: 'family',     cadence: 'monthly', label: 'Family (monthly)',      displayPrice: '$9.99/mo' },
    family_annual:      { priceId: env.STRIPE_PRICE_FAMILY_ANNUAL,      mode: 'subscription', tier: 'family',     cadence: 'annual',  label: 'Family (annual)',       displayPrice: '$79/yr'   },
    squad_monthly:      { priceId: env.STRIPE_PRICE_SQUAD_MONTHLY,      mode: 'subscription', tier: 'squad',      cadence: 'monthly', label: 'Squad (monthly)',       displayPrice: '$19/mo'   },
    squad_annual:       { priceId: env.STRIPE_PRICE_SQUAD_ANNUAL,       mode: 'subscription', tier: 'squad',      cadence: 'annual',  label: 'Squad (annual)',        displayPrice: '$159/yr'  },
    classroom_monthly:  { priceId: env.STRIPE_PRICE_CLASSROOM_MONTHLY,  mode: 'subscription', tier: 'classroom',  cadence: 'monthly', label: 'Classroom (monthly)',   displayPrice: '$29/mo'   },
    classroom_annual:   { priceId: env.STRIPE_PRICE_CLASSROOM_ANNUAL,   mode: 'subscription', tier: 'classroom',  cadence: 'annual',  label: 'Classroom (annual)',    displayPrice: '$249/yr'  },
    carecenter_monthly: { priceId: env.STRIPE_PRICE_CARECENTER_MONTHLY, mode: 'subscription', tier: 'carecenter', cadence: 'monthly', label: 'Care Center (monthly)', displayPrice: '$49/mo'   },
    carecenter_annual:  { priceId: env.STRIPE_PRICE_CARECENTER_ANNUAL,  mode: 'subscription', tier: 'carecenter', cadence: 'annual',  label: 'Care Center (annual)',  displayPrice: '$419/yr'  },
  }
}

/** Reverse-map a Stripe Price ID to its plan key. Used by webhook handler. */
export function getPlanKey(priceId: string): PlanName | null {
  if (!priceId) return null
  const plans = getPlans()
  for (const [key, cfg] of Object.entries(plans)) {
    if (cfg.priceId && cfg.priceId === priceId) return key as PlanName
  }
  return null
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
