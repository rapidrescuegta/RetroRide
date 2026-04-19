#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# GameBuddi — Stripe Product & Price Setup
#
# Creates the 4 subscription/pass products in your Stripe account
# and outputs the env vars you need.
#
# Prerequisites:
#   - Stripe CLI installed: https://stripe.com/docs/stripe-cli
#   - Logged in: stripe login
#
# Usage:
#   chmod +x scripts/setup-stripe.sh
#   ./scripts/setup-stripe.sh              # Uses test mode (default)
#   ./scripts/setup-stripe.sh --live       # Uses live mode
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

MODE="test"
for arg in "$@"; do
  case "$arg" in
    --live) MODE="live" ;;
    --help|-h)
      echo "Usage: ./scripts/setup-stripe.sh [--live]"
      echo "  (default)  Creates products in Stripe test mode"
      echo "  --live     Creates products in Stripe live mode"
      exit 0
      ;;
  esac
done

if ! command -v stripe &> /dev/null; then
  echo "Error: Stripe CLI not found."
  echo "Install it: https://stripe.com/docs/stripe-cli#install"
  exit 1
fi

LIVE_FLAG=""
if [ "$MODE" = "live" ]; then
  LIVE_FLAG="--live"
  echo "=== Creating Stripe products (LIVE MODE) ==="
  echo ""
  read -p "Are you sure you want to create products in LIVE mode? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
else
  echo "=== Creating Stripe products (TEST MODE) ==="
fi
echo ""

# ── Weekend Pass (one-time, $2.99) ──────────────────────────────────

echo "Creating Weekend Pass product..."
WEEKEND_PRODUCT=$(stripe products create \
  --name="GameBuddi Weekend Pass" \
  --description="3 days of full access to all games and multiplayer" \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

WEEKEND_PRICE=$(stripe prices create \
  --product="$WEEKEND_PRODUCT" \
  --unit-amount=299 \
  --currency=usd \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

echo "  Product: $WEEKEND_PRODUCT"
echo "  Price:   $WEEKEND_PRICE"
echo ""

# ── Weekly Pass (one-time, $4.99) ───────────────────────────────────

echo "Creating Weekly Pass product..."
WEEKLY_PRODUCT=$(stripe products create \
  --name="GameBuddi Weekly Pass" \
  --description="7 days of full access to all games and multiplayer" \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

WEEKLY_PRICE=$(stripe prices create \
  --product="$WEEKLY_PRODUCT" \
  --unit-amount=499 \
  --currency=usd \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

echo "  Product: $WEEKLY_PRODUCT"
echo "  Price:   $WEEKLY_PRICE"
echo ""

# ── Monthly Subscription ($7.99/mo) ─────────────────────────────────

echo "Creating Monthly Subscription product..."
MONTHLY_PRODUCT=$(stripe products create \
  --name="GameBuddi Monthly" \
  --description="Monthly subscription — unlimited games and multiplayer" \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

MONTHLY_PRICE=$(stripe prices create \
  --product="$MONTHLY_PRODUCT" \
  --unit-amount=799 \
  --currency=usd \
  --recurring-interval=month \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

echo "  Product: $MONTHLY_PRODUCT"
echo "  Price:   $MONTHLY_PRICE"
echo ""

# ── Annual Subscription ($59.99/yr) ─────────────────────────────────

echo "Creating Annual Subscription product..."
ANNUAL_PRODUCT=$(stripe products create \
  --name="GameBuddi Annual" \
  --description="Annual subscription — unlimited games and multiplayer (save 37%)" \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

ANNUAL_PRICE=$(stripe prices create \
  --product="$ANNUAL_PRODUCT" \
  --unit-amount=5999 \
  --currency=usd \
  --recurring-interval=year \
  $LIVE_FLAG \
  --format=json 2>/dev/null | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>process.stdout.write(JSON.parse(d).id))")

echo "  Product: $ANNUAL_PRODUCT"
echo "  Price:   $ANNUAL_PRICE"
echo ""

# ── Create Webhook ──────────────────────────────────────────────────

echo "─────────────────────────────────────────────"
echo ""
echo "Add these to your .env file (or Railway Variables):"
echo ""
echo "STRIPE_PRICE_WEEKEND=\"$WEEKEND_PRICE\""
echo "STRIPE_PRICE_WEEKLY=\"$WEEKLY_PRICE\""
echo "STRIPE_PRICE_MONTHLY=\"$MONTHLY_PRICE\""
echo "STRIPE_PRICE_ANNUAL=\"$ANNUAL_PRICE\""
echo ""
echo "─────────────────────────────────────────────"
echo ""
echo "Next steps:"
echo "  1. Copy the price IDs above into your .env or Railway Variables"
echo "  2. Create a webhook in Stripe Dashboard:"
echo "     URL: https://YOUR_DOMAIN/api/webhook"
echo "     Events: checkout.session.completed, customer.subscription.updated,"
echo "             customer.subscription.deleted, invoice.payment_failed"
echo "  3. Copy the webhook signing secret (whsec_...) to STRIPE_WEBHOOK_SECRET"
echo ""
