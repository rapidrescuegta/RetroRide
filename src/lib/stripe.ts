/**
 * Stripe client — convenience re-export from stripe-config.
 *
 * Usage:
 *   import { getStripe, getPlans, createCheckoutSession } from '@/lib/stripe'
 */
export {
  getStripe,
  getWebhookSecret,
  getPlans,
  getPlan,
  getPublishableKey,
  createCheckoutSession,
  ensureStripeCustomer,
  constructWebhookEvent,
} from '@/lib/stripe-config'
export type { PlanName, PlanConfig, CreateCheckoutParams } from '@/lib/stripe-config'
