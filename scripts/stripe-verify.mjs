#!/usr/bin/env node
/**
 * Verifies a GameBuddi Stripe configuration end to end — the same checks a
 * human would do by clicking around the Dashboard, but in one command.
 *
 * USAGE
 *   node scripts/stripe-verify.mjs --key=sk_live_... \
 *     --price-family-monthly=price_... --price-family-annual=price_... ...
 *
 *   Or, with the environment already loaded (e.g. via `railway run`):
 *   node scripts/stripe-verify.mjs
 *
 * Checks
 *   1. the key's mode (live vs test) and the account's business name;
 *   2. every STRIPE_PRICE_* id resolves to a GameBuddi price with the right
 *      amount, interval and plan_key metadata;
 *   3. the webhook endpoint exists at the app URL with the required events;
 *   4. a signed test event is accepted by the deployed /api/webhook.
 *
 * Exit code 0 = every check passed.
 */

import Stripe from 'stripe'
import crypto from 'node:crypto'

const argv = process.argv.slice(2)

function argValue(name) {
  const hit = argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
}

const secretKey = argValue('key') || process.env.STRIPE_SECRET_KEY
const webhookSecret = argValue('webhook-secret') || process.env.STRIPE_WEBHOOK_SECRET
const appUrl = (argValue('app-url') || process.env.NEXT_PUBLIC_APP_URL || 'https://www.gamebuddi.com').replace(/\/$/, '')
const webhookUrl = `${appUrl}/api/webhook`

const EXPECTED = [
  { key: 'pro_monthly',        env: 'STRIPE_PRICE_PRO_MONTHLY',        amount: 499,   interval: 'month' },
  { key: 'pro_annual',         env: 'STRIPE_PRICE_PRO_ANNUAL',         amount: 3900,  interval: 'year'  },
  { key: 'family_monthly',     env: 'STRIPE_PRICE_FAMILY_MONTHLY',     amount: 999,   interval: 'month' },
  { key: 'family_annual',      env: 'STRIPE_PRICE_FAMILY_ANNUAL',      amount: 7900,  interval: 'year'  },
  { key: 'squad_monthly',      env: 'STRIPE_PRICE_SQUAD_MONTHLY',      amount: 1900,  interval: 'month' },
  { key: 'squad_annual',       env: 'STRIPE_PRICE_SQUAD_ANNUAL',       amount: 15900, interval: 'year'  },
  { key: 'classroom_monthly',  env: 'STRIPE_PRICE_CLASSROOM_MONTHLY',  amount: 2900,  interval: 'month' },
  { key: 'classroom_annual',   env: 'STRIPE_PRICE_CLASSROOM_ANNUAL',   amount: 24900, interval: 'year'  },
  { key: 'carecenter_monthly', env: 'STRIPE_PRICE_CARECENTER_MONTHLY', amount: 4900,  interval: 'month' },
  { key: 'carecenter_annual',  env: 'STRIPE_PRICE_CARECENTER_ANNUAL',  amount: 41900, interval: 'year'  },
]

const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
]

let failures = 0
const ok = (msg) => console.log(`  ✓ ${msg}`)
const bad = (msg) => { failures++; console.log(`  ✗ ${msg}`) }

if (!secretKey) {
  console.error('No Stripe key. Pass --key=… or set STRIPE_SECRET_KEY.')
  process.exit(1)
}

const stripe = new Stripe(secretKey)

async function main() {
  console.log(`\nGameBuddi Stripe verification — ${appUrl}\n`)

  // 1 ─ account ───────────────────────────────────────────────────────────
  console.log('1) Account')
  const account = await stripe.accounts.retrieve()
  const accountName =
    account.settings?.dashboard?.display_name || account.business_profile?.name || '(unnamed)'
  const isLive = secretKey.startsWith('sk_live_')
  console.log(`  id   ${account.id}`)
  console.log(`  name "${accountName}"`)
  console.log(`  mode ${isLive ? 'LIVE' : 'TEST'}`)
  if (accountName === 'GameBuddi') ok('business name is "GameBuddi"')
  else bad(`business name is "${accountName}" — customers see this on the Checkout page`)

  // 2 ─ prices ────────────────────────────────────────────────────────────
  console.log('\n2) Prices')
  for (const plan of EXPECTED) {
    const priceId = argValue(`price-${plan.key.replace(/_/g, '-')}`) || process.env[plan.env]
    if (!priceId) { bad(`${plan.env} is not set`); continue }
    try {
      const price = await stripe.prices.retrieve(priceId)
      const product = await stripe.products.retrieve(String(price.product))
      const amountOk = price.unit_amount === plan.amount
      const intervalOk = price.recurring?.interval === plan.interval
      const planOk = price.metadata?.plan_key === plan.key
      const productOk = product.name === 'GameBuddi'
      if (amountOk && intervalOk && planOk && productOk) {
        ok(`${plan.key.padEnd(18)} ${priceId}  ${(plan.amount / 100).toFixed(2)} USD / ${plan.interval}  on "${product.name}"`)
      } else {
        bad(
          `${plan.key.padEnd(18)} ${priceId}  ` +
          `amount=${price.unit_amount} (want ${plan.amount}) ` +
          `interval=${price.recurring?.interval} (want ${plan.interval}) ` +
          `plan_key=${price.metadata?.plan_key || '(none)'} ` +
          `product="${product.name}"`
        )
      }
    } catch (err) {
      bad(`${plan.key}: cannot read ${priceId} — ${err.message}`)
    }
  }

  // 3 ─ webhook endpoint ──────────────────────────────────────────────────
  console.log('\n3) Webhook endpoint')
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 })
  const match = endpoints.data.find((e) => e.url === webhookUrl)
  if (!match) {
    bad(`no endpoint at ${webhookUrl}`)
  } else {
    ok(`${match.id} → ${match.url} (livemode=${match.livemode}, ${match.status})`)
    const missing = REQUIRED_EVENTS.filter((ev) => !match.enabled_events.includes(ev))
    if (missing.length) bad(`endpoint is missing events: ${missing.join(', ')}`)
    else ok('all required events enabled')
    if (match.livemode !== isLive) bad(`endpoint livemode=${match.livemode} but the key is ${isLive ? 'live' : 'test'}`)
    else ok('endpoint mode matches the key')
  }

  // 4 ─ signed test event against the deployed handler ────────────────────
  console.log('\n4) Deployed webhook handler')
  if (!webhookSecret) {
    bad('no webhook secret to sign with (pass --webhook-secret=… or set STRIPE_WEBHOOK_SECRET)')
  } else {
    const payload = JSON.stringify({
      id: 'evt_stripe_verify',
      object: 'event',
      type: 'ping',
      data: { object: {} },
      api_version: '2024-06-20',
      created: Math.floor(Date.now() / 1000),
    })
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret })
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'stripe-signature': header, 'content-type': 'application/json' },
        body: payload,
      })
      const body = await res.text()
      if (res.ok) ok(`POST ${webhookUrl} → ${res.status} ${body}`)
      else bad(`POST ${webhookUrl} → ${res.status} ${body} — the secret does not match the endpoint`)
    } catch (err) {
      bad(`could not reach ${webhookUrl} — ${err.message}`)
    }
  }

  console.log(
    failures === 0
      ? '\nAll checks passed.\n'
      : `\n${failures} check(s) failed.\n`
  )
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('\nERROR:', err.message || err)
  process.exit(1)
})
