#!/usr/bin/env node
/**
 * Creates the GameBuddi Stripe catalogue (1 product + 10 recurring prices) in
 * whatever Stripe account the supplied key belongs to, then prints the exact
 * environment block to paste into Railway.
 *
 * WHY THIS EXISTS
 * ---------------
 * GameBuddi currently runs on Stripe account `acct_1T7od1LYsvBC5oGd`, whose
 * business name is **"Clientaro CRM"** — the Clientaro product's account. On
 * the live Checkout page the customer sees "Clientaro CRM" as the merchant,
 * and live revenue would land in another product's account. The house rule is
 * one Stripe account per product.
 *
 * So GameBuddi needs its own account. Creating that account (and completing
 * its activation) is the only step that needs a human. Everything after it —
 * products, prices, price IDs, webhook endpoint — is mechanical, and this
 * script does all of it, idempotently, in about ten seconds.
 *
 * USAGE
 *   node scripts/stripe-bootstrap.mjs --key=sk_live_...            # live
 *   node scripts/stripe-bootstrap.mjs --key=sk_test_...            # test
 *   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-bootstrap.mjs
 *
 * Safe to re-run: existing products/prices are reused, never duplicated.
 * It never deletes anything.
 */

import Stripe from 'stripe'

// ── Plan catalogue ─────────────────────────────────────────────────────────
// Amounts are the authoritative source of truth for what a customer pays.
// They must match `displayPrice` in src/lib/stripe-config.ts.
const PRODUCT = {
  name: 'GameBuddi',
  description:
    'Family-friendly multiplayer arcade — offline-first PWA, 30+ classic games, group challenges & tournaments.',
  metadata: { product: 'gamebuddi' },
}

const PLANS = [
  { key: 'pro_monthly',        nickname: 'Pro (monthly)',        amount: 499,  interval: 'month' },
  { key: 'pro_annual',         nickname: 'Pro (annual)',         amount: 3900, interval: 'year'  },
  { key: 'family_monthly',     nickname: 'Family (monthly)',     amount: 999,  interval: 'month' },
  { key: 'family_annual',      nickname: 'Family (annual)',      amount: 7900, interval: 'year'  },
  { key: 'squad_monthly',      nickname: 'Squad (monthly)',      amount: 1900, interval: 'month' },
  { key: 'squad_annual',       nickname: 'Squad (annual)',       amount: 15900, interval: 'year'  },
  { key: 'classroom_monthly',  nickname: 'Classroom (monthly)',  amount: 2900, interval: 'month' },
  { key: 'classroom_annual',   nickname: 'Classroom (annual)',   amount: 24900, interval: 'year'  },
  { key: 'carecenter_monthly', nickname: 'Care Center (monthly)', amount: 4900, interval: 'month' },
  { key: 'carecenter_annual',  nickname: 'Care Center (annual)', amount: 41900, interval: 'year'  },
]

const ENV_KEYS = {
  pro_monthly: 'STRIPE_PRICE_PRO_MONTHLY',
  pro_annual: 'STRIPE_PRICE_PRO_ANNUAL',
  family_monthly: 'STRIPE_PRICE_FAMILY_MONTHLY',
  family_annual: 'STRIPE_PRICE_FAMILY_ANNUAL',
  squad_monthly: 'STRIPE_PRICE_SQUAD_MONTHLY',
  squad_annual: 'STRIPE_PRICE_SQUAD_ANNUAL',
  classroom_monthly: 'STRIPE_PRICE_CLASSROOM_MONTHLY',
  classroom_annual: 'STRIPE_PRICE_CLASSROOM_ANNUAL',
  carecenter_monthly: 'STRIPE_PRICE_CARECENTER_MONTHLY',
  carecenter_annual: 'STRIPE_PRICE_CARECENTER_ANNUAL',
}

// ── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const keyArg = argv.find((a) => a.startsWith('--key='))?.slice('--key='.length)
const secretKey = keyArg || process.env.STRIPE_SECRET_KEY

if (!secretKey) {
  console.error(
    'No Stripe key. Pass --key=sk_live_... or set STRIPE_SECRET_KEY.\n' +
      'Create the key in the NEW GameBuddi Stripe account (Dashboard → Developers → API keys).'
  )
  process.exit(1)
}

if (!/^sk_(live|test)_/.test(secretKey)) {
  console.error('That does not look like a Stripe secret key (expected sk_live_… or sk_test_…).')
  process.exit(1)
}

const stripe = new Stripe(secretKey)

async function findProduct() {
  // Stripe search matches on name; fall back to a full list scan because
  // search is eventually consistent for very recent objects.
  const res = await stripe.products.list({ limit: 100, active: true })
  return res.data.find((p) => p.name === PRODUCT.name) || null
}

async function findPrice(nickname, productId) {
  const res = await stripe.prices.list({ limit: 100, active: true, product: productId })
  return res.data.find((p) => p.nickname === nickname) || null
}

/**
 * The publishable key cannot be read back through the Stripe API (there is no
 * GET /v1/publishable_keys), and creating one blind would litter the account
 * with stray keys. So the operator copies it once from the Dashboard:
 *   Dashboard → Developers → API keys → Publishable key
 */
function publishableKeyPlaceholder() {
  return '<paste the pk_live_… publishable key from this account>'
}

/** Finds (or creates) the webhook endpoint and returns it with its secret. */
async function ensureWebhook() {
  const url = process.env.GAMEBUDDI_WEBHOOK_URL || 'https://www.gamebuddi.com/api/webhook'
  const events = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'customer.subscription.trial_will_end',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ]

  const existing = await stripe.webhookEndpoints.list({ limit: 100 })
  const match = existing.data.find((e) => e.url === url)

  if (match) {
    const updated = await stripe.webhookEndpoints.update(match.id, {
      enabled_events: events,
      description: 'GameBuddi',
    })
    console.log(`\nReusing webhook endpoint ${updated.id} (${url})`)
    // The secret is only returned on create — reuse the stored one.
    return { id: updated.id, secret: process.env.STRIPE_WEBHOOK_SECRET || '<copy the whsec_… secret from the endpoint>' }
  }

  const created = await stripe.webhookEndpoints.create({
    url,
    enabled_events: events,
    description: 'GameBuddi',
  })
  console.log(`\nCreated webhook endpoint ${created.id} (${url})`)
  return { id: created.id, secret: created.secret }
}

async function main() {
  const account = await stripe.accounts.retrieve()
  const accountName =
    account.settings?.dashboard?.display_name ||
    account.business_profile?.name ||
    '(unnamed)'
  console.log(`Account: ${account.id} — "${accountName}"`)
  console.log(`Mode:    ${secretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)

  if (accountName !== PRODUCT.name) {
    console.log(
      `\n⚠️  This account is named "${accountName}", not "GameBuddi".\n` +
        '   The name is what a customer sees on the Checkout page. Set it in\n' +
        '   Dashboard → Settings → Business → Business name, or point this\n' +
        '   script at a dedicated GameBuddi account.\n'
    )
  }

  let product = await findProduct()
  if (product) {
    console.log(`\nReusing product ${product.id} ("${product.name}")`)
    await stripe.products.update(product.id, {
      description: PRODUCT.description,
      metadata: PRODUCT.metadata,
    })
  } else {
    product = await stripe.products.create({
      name: PRODUCT.name,
      description: PRODUCT.description,
      metadata: PRODUCT.metadata,
    })
    console.log(`\nCreated product ${product.id} ("${product.name}")`)
  }

  console.log('\nPrices:')
  const envLines = []
  for (const plan of PLANS) {
    let price = await findPrice(plan.nickname, product.id)
    let action = 'reused'
    if (!price) {
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amount,
        currency: 'usd',
        recurring: { interval: plan.interval },
        nickname: plan.nickname,
        tax_behavior: 'exclusive',
        metadata: { plan_key: plan.key },
      })
      action = 'created'
    } else if (price.unit_amount !== plan.amount || price.recurring?.interval !== plan.interval) {
      price = await stripe.prices.update(price.id, {
        unit_amount: plan.amount,
        recurring: { interval: plan.interval },
        metadata: { plan_key: plan.key },
      })
      action = 'updated'
    }
    console.log(
      `  ${action.padEnd(8)} ${plan.key.padEnd(18)} ${(plan.amount / 100).toFixed(2).padStart(7)} USD / ${plan.interval.padEnd(5)}  ${price.id}`
    )
    envLines.push(`${ENV_KEYS[plan.key]}=${price.id}`)
  }

  const publishableKey = publishableKeyPlaceholder()
  const webhook = await ensureWebhook()

  console.log('\n── Paste into Railway (retroride service) ──────────────────────────')
  console.log(`STRIPE_SECRET_KEY=${secretKey}`)
  console.log(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${publishableKey}`)
  console.log(envLines.join('\n'))
  console.log(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`)
  console.log('─────────────────────────────────────────────────────────────────────')
  console.log('\nSet all of the above at once (one deploy, no mixed-mode window),')
  console.log('then confirm the live checkout page shows "GameBuddi" as the merchant.')
}

main().catch((err) => {
  console.error('\nERROR:', err.message || err)
  process.exit(1)
})
