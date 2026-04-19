#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# GameBuddi — Pre-Deployment Checklist
# Run this before deploying to production to verify everything is set.
#
# Usage:
#   chmod +x scripts/deploy-check.sh
#   ./scripts/deploy-check.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

pass() { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "  ${YELLOW}!${NC} $1"; WARNINGS=$((WARNINGS + 1)); }
info() { echo -e "  ${CYAN}i${NC} $1"; }

echo ""
echo "=== GameBuddi Pre-Deployment Checklist ==="
echo ""

# ── 1. Required Environment Variables ─────────────────────────────────

echo "1. Checking required environment variables..."

REQUIRED_VARS=(
  "DATABASE_URL"
  "STRIPE_SECRET_KEY"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_PRICE_WEEKEND"
  "STRIPE_PRICE_WEEKLY"
  "STRIPE_PRICE_MONTHLY"
  "STRIPE_PRICE_ANNUAL"
  "STRIPE_WEBHOOK_SECRET"
  "NEXT_PUBLIC_APP_URL"
)

OPTIONAL_VARS=(
  "RESEND_API_KEY"
  "EMAIL_FROM"
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY"
  "VAPID_PRIVATE_KEY"
  "TURN_SERVER_URL"
  "TURN_SERVER_USERNAME"
  "TURN_SERVER_CREDENTIAL"
  "CRON_SECRET"
)

for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    fail "$var is not set"
  else
    pass "$var is set"
  fi
done

echo ""
echo "   Optional variables:"
for var in "${OPTIONAL_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    warn "$var is not set (optional)"
  else
    pass "$var is set"
  fi
done

# ── 2. Database ───────────────────────────────────────────────────────

echo ""
echo "2. Checking database..."

if [ -z "${DATABASE_URL:-}" ]; then
  fail "DATABASE_URL not set — cannot check database"
else
  pass "DATABASE_URL is set"
  if [[ "${DATABASE_URL}" == postgresql://* ]] || [[ "${DATABASE_URL}" == postgres://* ]]; then
    pass "DATABASE_URL looks like a valid PostgreSQL connection string"
  else
    fail "DATABASE_URL does not start with postgresql:// or postgres://"
  fi

  if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    pass "Database is reachable"
  else
    warn "Cannot connect to database (may be expected if running outside deploy environment)"
  fi
fi

# ── 3. Prisma Schema Validation ──────────────────────────────────────

echo ""
echo "3. Validating Prisma schema..."

if npx prisma validate > /dev/null 2>&1; then
  pass "Prisma schema is valid"
else
  fail "Prisma schema validation failed — run 'npx prisma validate' for details"
fi

if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  MIGRATION_COUNT=$(ls -d prisma/migrations/*/  2>/dev/null | wc -l)
  pass "Found $MIGRATION_COUNT migration(s)"
else
  fail "No migrations found — run 'npx prisma migrate dev' first"
fi

if [ -d "src/generated/prisma" ]; then
  pass "Prisma client is generated"
else
  warn "Prisma client not generated — will be generated at deploy time"
fi

# ── 4. Stripe Price ID Validation ────────────────────────────────────

echo ""
echo "4. Validating Stripe configuration..."

STRIPE_PRICE_VARS=(
  "STRIPE_PRICE_WEEKEND"
  "STRIPE_PRICE_WEEKLY"
  "STRIPE_PRICE_MONTHLY"
  "STRIPE_PRICE_ANNUAL"
)

for var in "${STRIPE_PRICE_VARS[@]}"; do
  value="${!var:-}"
  if [ -n "$value" ]; then
    if [[ "$value" == price_* ]]; then
      pass "$var starts with price_ ($value)"
    else
      fail "$var does not start with 'price_' — got: $value"
    fi
  fi
done

if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  if [[ "${STRIPE_SECRET_KEY}" == sk_test_* ]]; then
    warn "Using Stripe TEST key — switch to live key for production"
  elif [[ "${STRIPE_SECRET_KEY}" == sk_live_* ]]; then
    pass "Using Stripe LIVE key"
  else
    fail "STRIPE_SECRET_KEY doesn't start with sk_test_ or sk_live_"
  fi
fi

if [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  if [[ "${STRIPE_WEBHOOK_SECRET}" == whsec_* ]]; then
    pass "STRIPE_WEBHOOK_SECRET starts with whsec_"
  else
    fail "STRIPE_WEBHOOK_SECRET doesn't start with whsec_"
  fi
fi

if [ -f "src/app/api/webhook/route.ts" ]; then
  pass "Stripe webhook route exists"
else
  warn "Stripe webhook route not found at src/app/api/webhook/route.ts"
fi

# ── 5. Build Check ───────────────────────────────────────────────────

echo ""
echo "5. Checking build readiness..."

if [ -f "package.json" ]; then
  pass "package.json exists"
else
  fail "package.json is missing"
fi

if [ -f "railway.toml" ]; then
  pass "railway.toml exists"
  if grep -q "migrate deploy" railway.toml; then
    pass "railway.toml uses 'prisma migrate deploy' (safe for production)"
  elif grep -q "db push" railway.toml; then
    fail "railway.toml uses 'db push' — switch to 'prisma migrate deploy' for production"
  fi
else
  warn "railway.toml is missing (needed for Railway deployments)"
fi

if [ -f "Dockerfile" ]; then
  pass "Dockerfile exists"
else
  warn "Dockerfile is missing (Railway can still build with Nixpacks)"
fi

# Run a type check if tsc is available
echo ""
echo "   Running build check (next build --no-lint)..."
if npm run build > /dev/null 2>&1; then
  pass "Build succeeds"
else
  fail "Build failed — run 'npm run build' for details"
fi

# ── 6. App URL Validation ────────────────────────────────────────────

echo ""
echo "6. Checking app URL..."

if [ -n "${NEXT_PUBLIC_APP_URL:-}" ]; then
  if [[ "${NEXT_PUBLIC_APP_URL}" == http://localhost* ]]; then
    warn "NEXT_PUBLIC_APP_URL is set to localhost — update for production"
  elif [[ "${NEXT_PUBLIC_APP_URL}" == https://* ]]; then
    pass "NEXT_PUBLIC_APP_URL uses HTTPS: ${NEXT_PUBLIC_APP_URL}"
  else
    warn "NEXT_PUBLIC_APP_URL does not use HTTPS: ${NEXT_PUBLIC_APP_URL}"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────

echo ""
echo "─────────────────────────────────────────"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC} ($WARNINGS warning(s))"
  echo "Ready to deploy."
else
  echo -e "${RED}$ERRORS error(s)${NC}, $WARNINGS warning(s)"
  echo "Fix the errors above before deploying."
fi
echo ""

exit $ERRORS
