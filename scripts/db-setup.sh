#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# GameBuddi — Database Setup Script
#
# Handles both local development and production (Railway) environments.
#
# Usage:
#   Local dev:    ./scripts/db-setup.sh
#   Production:   ./scripts/db-setup.sh --production
#   CI / Railway: ./scripts/db-setup.sh --migrate-only
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Parse flags ────────────────────────────────────────────────────────
MODE="development"
for arg in "$@"; do
  case "$arg" in
    --production)   MODE="production" ;;
    --migrate-only) MODE="migrate-only" ;;
    --help|-h)
      echo "Usage: ./scripts/db-setup.sh [--production|--migrate-only]"
      echo ""
      echo "  (no flag)       Local dev: create DB + user, generate client, push schema"
      echo "  --production    Production: generate client, run migrate deploy"
      echo "  --migrate-only  CI/Railway: generate client, run migrate deploy (no DB creation)"
      exit 0
      ;;
  esac
done

DB_NAME="gamebuddi"
DB_USER="gamebuddi_user"
DB_PASS="gamebuddi_pass_2026"

echo "=== GameBuddi Database Setup ($MODE) ==="
echo ""

# ── Prerequisites ──────────────────────────────────────────────────────

if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Install Node.js first."
  exit 1
fi

# ── 1. Create local database (dev only) ────────────────────────────────

if [ "$MODE" = "development" ]; then
  if ! command -v psql &> /dev/null; then
    echo "Error: psql not found. Install PostgreSQL first:"
    echo "  Ubuntu/Debian: sudo apt install postgresql"
    echo "  macOS:         brew install postgresql"
    exit 1
  fi

  echo "Creating database user '$DB_USER'..."
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 \
    && echo "  User '$DB_USER' already exists — skipping." \
    || sudo -u postgres psql -c "CREATE ROLE $DB_USER WITH LOGIN PASSWORD '$DB_PASS';"

  echo "Creating database '$DB_NAME'..."
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 \
    && echo "  Database '$DB_NAME' already exists — skipping." \
    || sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

  echo "Granting privileges..."
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
  echo ""
fi

# ── 2. Generate Prisma client ──────────────────────────────────────────

echo "Generating Prisma client..."
npx prisma generate
echo ""

# ── 3. Apply schema / migrations ──────────────────────────────────────

if [ "$MODE" = "development" ]; then
  echo "Pushing schema to database (dev mode)..."
  npx prisma db push
elif [ "$MODE" = "production" ] || [ "$MODE" = "migrate-only" ]; then
  echo "Running migrations (production mode)..."
  npx prisma migrate deploy
fi

# ── 4. Validate schema ────────────────────────────────────────────────

echo ""
echo "Validating Prisma schema..."
npx prisma validate
echo ""

# ── Done ───────────────────────────────────────────────────────────────

echo "=== Setup complete! ==="
echo ""

if [ "$MODE" = "development" ]; then
  echo "Connection string:"
  echo "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME\""
  echo ""
  echo "Next steps:"
  echo "  1. Copy the DATABASE_URL above into your .env file"
  echo "  2. Run: npm run dev"
fi
