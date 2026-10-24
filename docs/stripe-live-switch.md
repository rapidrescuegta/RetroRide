# Stripe live-mode switch — GameBuddi

**Status: needs one human step.** Everything else in this document is automated
by `scripts/stripe-bootstrap.mjs`.

---

## Why

GameBuddi currently runs on Stripe account `acct_1T7od1LYsvBC5oGd`, whose
business name is **"Clientaro CRM"** — that is the *Clientaro product's*
account. Two consequences, both customer-visible or money-visible:

1. **The Checkout page says "Clientaro CRM".** A verified run of the purchase
   funnel (2026-10-24) landed on `checkout.stripe.com` with
   `<title>Clientaro CRM</title>` and the header *"Back Clientaro CRM
   Sandbox"*. The line item itself is correct ("Subscribe to GameBuddi —
   $9.99 per month") because that comes from the Product, but the merchant
   identity around it comes from the account.
2. **Live revenue would land in another product's account.** The house rule
   is one Stripe account per product, and the workspace already has two
   (`51T7od1LY…` = Clientaro, `51TNd3uBFU…` = AutoClub).

Also: there is **no `sk_live_…` key anywhere in the workspace.** Only the
test-mode key for the Clientaro account exists.

---

## The switch

### Step 1 — create the GameBuddi Stripe account (human, ~10 min)

Dashboard → <https://dashboard.stripe.com/account> → *Create account*.

- Business type: **Company**
- Business name: **GameBuddi**
- Country: Canada (same as the other accounts)
- Complete activation: business address, business phone, bank account,
  representative details. Stripe will ask for a representative's personal
  details (name, DOB, address) — that has to be a human.

Until activation completes, the account stays in a restricted state: it can
create products and prices and serve test-mode checkouts, but it cannot take
live payments.

### Step 2 — run the bootstrap script (automated)

```bash
node scripts/stripe-bootstrap.mjs --key=sk_live_<new account secret key>
```

It will:

- create the **GameBuddi** product (name, description, metadata) — or reuse it
  if the script is re-run;
- create the **10 recurring prices** with the exact catalogue below, each
  tagged `metadata.plan_key` (the webhook uses that to map a Stripe price
  back to a plan key);
- create the webhook endpoint at `https://www.gamebuddi.com/api/webhook`
  with the seven required events;
- print the **complete Railway env block** to paste in.

The script is idempotent and never deletes anything.

### Price catalogue (must match `src/lib/stripe-config.ts`)

| Plan key                | Amount   | Interval | Display        |
| ----------------------- | -------- | -------- | -------------- |
| `pro_monthly`           | $4.99    | month    | Pro (monthly)  |
| `pro_annual`            | $39.00   | year     | Pro (annual)   |
| `family_monthly`        | $9.99    | month    | Family (monthly) |
| `family_annual`         | $79.00   | year     | Family (annual) |
| `squad_monthly`         | $19.00   | month    | Squad (monthly) |
| `squad_annual`          | $159.00  | year     | Squad (annual)  |
| `classroom_monthly`     | $29.00   | month    | Classroom (monthly) |
| `classroom_annual`      | $249.00  | year     | Classroom (annual) |
| `carecenter_monthly`    | $49.00   | month    | Care Center (monthly) |
| `carecenter_annual`     | $419.00  | year     | Care Center (annual) |

`tax_behavior` is `exclusive` (tax added on top), matching the existing prices.

### Step 3 — swap the environment variables (one atomic deploy)

In the Railway **retroride** service, set **all** of these together and
redeploy. Do not set them piecemeal — a window where the secret key and the
price IDs come from different accounts produces checkout sessions that fail at
the last step.

```
STRIPE_SECRET_KEY=sk_live_…
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…          # from the new endpoint
STRIPE_PRICE_PRO_MONTHLY=price_…
STRIPE_PRICE_PRO_ANNUAL=price_…
STRIPE_PRICE_FAMILY_MONTHLY=price_…
STRIPE_PRICE_FAMILY_ANNUAL=price_…
STRIPE_PRICE_SQUAD_MONTHLY=price_…
STRIPE_PRICE_SQUAD_ANNUAL=price_…
STRIPE_PRICE_CLASSROOM_MONTHLY=price_…
STRIPE_PRICE_CLASSROOM_ANNUAL=price_…
STRIPE_PRICE_CARECENTER_MONTHLY=price_…
STRIPE_PRICE_CARECENTER_ANNUAL=price_…
```

`NEXT_PUBLIC_*` variables are inlined at **build** time, so the redeploy must
be a real rebuild — a restart without a rebuild will keep serving the old
publishable key.

### Step 4 — verify (10 minutes, all automatable)

1. `node scripts/stripe-verify.mjs` — checks the key mode, the account name,
   the price IDs, and signs a test webhook against the live endpoint.
2. Open `https://www.gamebuddi.com/pricing` in a browser → **Get Family** →
   `/family?plan=family_monthly` → create a family → **Continue to checkout**
   → Stripe Checkout.
   - The page title must read **GameBuddi**, not "Clientaro CRM".
   - The line item must read "Subscribe to GameBuddi — $9.99 per month".
3. Pay with Stripe's test card `4242 4242 4242 4242` (any future expiry, any
   CVC) **only while the account is still in test mode**. In live mode use
   `4000 0025 0000 3155` with a future expiry, then refund yourself
   immediately from the Dashboard.
4. Confirm `/family` shows the new `PlanStatusCard` in its "Payment received"
   state and that the family flips to the paid plan.

---

## Things that are already done

- The Checkout page title/description come from the Product — already
  "GameBuddi".
- The webhook endpoint exists and works: a signed `ping` event posted to
  `https://www.gamebuddi.com/api/webhook` returns `200 {"received":true}`
  with the current `STRIPE_WEBHOOK_SECRET`.
- The webhook handler covers `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted` and
  `invoice.payment_failed`, and flips `Family.subscriptionStatus` /
  `planType` and the `Subscription` row.
- `/family?payment=success` is now handled: `src/components/PlanStatusCard.tsx`
  shows a "Payment received" state and polls `/api/subscription` until the
  webhook confirms the plan is active.

## Things that are NOT done

- No `sk_live_…` key exists in the workspace.
- The account in use is the Clientaro account; it is not renamed and should
  not be renamed (that would break Clientaro's own Checkout branding).
