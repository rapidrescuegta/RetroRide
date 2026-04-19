# GameBuddi — Production Deployment Guide

## Prerequisites

- Node.js 18+
- PostgreSQL 15+ (local) **or** a Railway account
- Stripe account (test keys for dev, live keys for prod)
- Resend account (for transactional email)

---

## 1. Clone & Install

```bash
git clone <repo-url> gamebuddi
cd gamebuddi
npm install
cp .env.example .env
```

Fill in all values in `.env` — see the file for descriptions of each variable.

---

## 2. Railway Setup (Production)

### PostgreSQL

1. Create a new project at [railway.app](https://railway.app).
2. Add a **PostgreSQL** plugin. Railway provisions the database and injects `DATABASE_URL` automatically — no manual config needed.
3. Connect your GitHub repo. Railway runs the build on every push.

### Environment Variables

Set these in the Railway dashboard under **Variables**:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Auto-set | Injected by the PostgreSQL plugin |
| `STRIPE_SECRET_KEY` | Yes | Starts with `sk_live_` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Starts with `pk_live_` |
| `STRIPE_PRICE_WEEKEND` | Yes | Starts with `price_` |
| `STRIPE_PRICE_WEEKLY` | Yes | Starts with `price_` |
| `STRIPE_PRICE_MONTHLY` | Yes | Starts with `price_` |
| `STRIPE_PRICE_ANNUAL` | Yes | Starts with `price_` |
| `STRIPE_WEBHOOK_SECRET` | Yes | Starts with `whsec_` |
| `NEXT_PUBLIC_APP_URL` | Yes | Your production URL, e.g. `https://gamebuddi.com` |
| `RESEND_API_KEY` | Recommended | Starts with `re_` |
| `EMAIL_FROM` | Optional | Default: `GameBuddi <noreply@gamebuddi.com>` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | For push notifications |
| `VAPID_PRIVATE_KEY` | Optional | For push notifications |
| `TURN_SERVER_URL` | Optional | For better multiplayer connectivity |
| `TURN_SERVER_USERNAME` | Optional | TURN auth |
| `TURN_SERVER_CREDENTIAL` | Optional | TURN auth |
| `CRON_SECRET` | Recommended | Protects cron endpoints |

### Deploy Command

The `railway.toml` is pre-configured. On deploy, Railway runs:

```
npx prisma generate && npx prisma migrate deploy && npm start
```

This generates the Prisma client, applies any pending migrations, then starts the app.

---

## 3. Stripe Setup

1. Go to [dashboard.stripe.com](https://dashboard.stripe.com).
2. **Create four Products** with corresponding Prices:
   - **Weekend Pass** — one-time payment, 3-day access
   - **Weekly Pass** — one-time payment, 7-day access
   - **Monthly Subscription** — recurring monthly
   - **Annual Subscription** — recurring yearly
3. Copy each **Price ID** (starts with `price_`) into the matching `STRIPE_PRICE_*` env var.
4. Copy your **Secret Key** (`sk_live_`) and **Publishable Key** (`pk_live_`) into env vars.
5. **Create a Webhook** endpoint:
   - URL: `https://your-domain.com/api/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
6. Copy the **Webhook Signing Secret** (`whsec_`) into `STRIPE_WEBHOOK_SECRET`.

### Testing Locally

Use the Stripe CLI to forward webhook events to your local dev server:

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

---

## 4. Resend Setup (Email)

1. Sign up at [resend.com](https://resend.com).
2. **Verify your sending domain** (e.g. `gamebuddi.com`) — Resend will give you DNS records to add.
3. Create an **API key** and set `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to a verified sender address (e.g. `GameBuddi <noreply@gamebuddi.com>`).

If `RESEND_API_KEY` is not set, emails are logged to the console instead of being sent. This is useful for local development.

---

## 5. TURN Server Setup (Optional)

A TURN server improves WebRTC multiplayer connectivity for players behind strict NATs or corporate firewalls. Without it, the app falls back to free public STUN/TURN servers.

### Option A: Metered.ca (Recommended)

1. Sign up at [metered.ca/stun-turn](https://www.metered.ca/stun-turn).
2. Create a TURN credential.
3. Set the env vars:

```env
TURN_SERVER_URL="turn:global.relay.metered.ca:443?transport=tcp"
TURN_SERVER_USERNAME="your-username"
TURN_SERVER_CREDENTIAL="your-credential"
```

### Option B: Twilio

1. Go to [twilio.com/stun-turn](https://www.twilio.com/stun-turn).
2. Use the Network Traversal API to generate temporary credentials.

### Option C: Self-hosted (coturn)

```bash
# Install coturn on a VPS
sudo apt install coturn
# Configure /etc/turnserver.conf with your domain and certs
```

---

## 6. VAPID Keys (Push Notifications)

Generate a VAPID key pair for Web Push notifications:

```bash
npx web-push generate-vapid-keys
```

This outputs a public key and a private key. Set them in your env:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BPxxxxxxx..."
VAPID_PRIVATE_KEY="xxxxxxx..."
```

Or use the included helper script:

```bash
chmod +x scripts/generate-vapid-keys.sh
./scripts/generate-vapid-keys.sh
```

---

## 7. Database Migrations

### Local Development

```bash
npx prisma migrate dev
```

### Production

Migrations run automatically on deploy via the Railway start command. To run manually:

```bash
railway run npx prisma migrate deploy
```

### Seeding (Optional)

```bash
npx prisma db seed
```

---

## 8. Running Locally

```bash
npm run dev
```

The app starts at [http://localhost:3000](http://localhost:3000).

---

## 9. Pre-Deploy Validation

Run the deploy check script to verify everything is configured:

```bash
chmod +x scripts/deploy-check.sh
./scripts/deploy-check.sh
```

This validates env vars, Prisma schema, Stripe price IDs, database connectivity, and build success.

---

## 10. Production Checklist

- [ ] Switch Stripe keys from `sk_test_` / `pk_test_` to live keys
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain (with `https://`)
- [ ] Confirm Stripe webhook endpoint points to production URL
- [ ] Run `npx prisma migrate deploy` against production database
- [ ] Verify sending domain in Resend
- [ ] Set a strong, random `CRON_SECRET`
- [ ] Generate and set VAPID keys for push notifications
- [ ] SSL is automatic on Railway — verify it's active
- [ ] Run `./scripts/deploy-check.sh` and fix any errors
