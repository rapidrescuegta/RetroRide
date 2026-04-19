# GameBuddi — Production Deployment Guide

## Quick Start (Railway)

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init
```

### 2. Add PostgreSQL

- In Railway dashboard, click **+ New** → **Database** → **PostgreSQL**
- `DATABASE_URL` is automatically injected — no manual config needed

### 3. Set Environment Variables

In Railway dashboard → your service → **Variables**, add:

```
# App
NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app
NODE_ENV=production

# Stripe (run scripts/setup-stripe.sh to get price IDs)
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_WEEKEND=price_...
STRIPE_PRICE_WEEKLY=price_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=GameBuddi <noreply@yourdomain.com>

# Push Notifications (run scripts/generate-vapid-keys.sh)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Cron
CRON_SECRET=<generate a random string>
```

### 4. Setup Stripe Products

```bash
# Creates products + prices in your Stripe account
./scripts/setup-stripe.sh          # test mode
./scripts/setup-stripe.sh --live   # live mode
```

Then create a webhook in Stripe Dashboard:
- **URL**: `https://your-app.up.railway.app/api/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### 5. Setup Email (Resend)

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain
3. Create an API key
4. Add `RESEND_API_KEY` and `EMAIL_FROM` to Railway variables

### 6. Generate VAPID Keys

```bash
./scripts/generate-vapid-keys.sh
```

Add both keys to Railway variables.

### 7. Deploy

```bash
railway up
```

Railway will:
1. Build the Docker image (multi-stage, optimized)
2. Run `prisma generate` + `prisma migrate deploy`
3. Start the app on port 8080
4. Health check at `/api/health`

### 8. Verify

```bash
# Check deployment health
curl https://your-app.up.railway.app/api/health

# Detailed health check
curl https://your-app.up.railway.app/api/health?detail=true

# Run pre-deploy checklist locally
./scripts/deploy-check.sh
```

## Custom Domain

1. In Railway dashboard → service → **Settings** → **Domains**
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_APP_URL` to your custom domain

## Cron Jobs

Set up a cron job to send weekly rankings:

```bash
# Railway cron or external service (e.g., cron-job.org)
curl -X POST https://your-app.up.railway.app/api/cron/send-rankings \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Database Management

```bash
# View database in browser
npx prisma studio

# Create a new migration
npx prisma migrate dev --name describe_change

# Apply migrations to production
npx prisma migrate deploy

# Seed demo data
npx prisma db seed
```
