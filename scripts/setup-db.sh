#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# GameBuddi — Database Setup Script
# Creates the gamebuddi database, generates Prisma client, and pushes
# the schema to the database.
#
# Usage:
#   ./scripts/setup-db.sh
# ─────────────────────────────────────────────────────────────────────

set -euo pipefail

DB_NAME="gamebuddi"
DB_USER="gamebuddi_user"
DB_PASS="gamebuddi_pass_2026"

echo "=== GameBuddi Database Setup ==="
echo ""

# ── 1. Check prerequisites ──────────────────────────────────────────

if ! command -v psql &> /dev/null; then
  echo "Error: psql not found. Install PostgreSQL first:"
  echo "  Ubuntu/Debian: sudo apt install postgresql"
  echo "  macOS:         brew install postgresql"
  exit 1
fi

if ! command -v npx &> /dev/null; then
  echo "Error: npx not found. Install Node.js first."
  exit 1
fi

# ── 2. Create database user and database ─────────────────────────────

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

# ── 3. Generate Prisma client ────────────────────────────────────────

echo ""
echo "Generating Prisma client..."
npx prisma generate

# ── 4. Push schema to database ───────────────────────────────────────

echo ""
echo "Pushing schema to database..."
npx prisma db push

# ── Done ─────────────────────────────────────────────────────────────

echo ""
echo "Setup complete!"
echo ""
echo "Connection string:"
echo "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME\""
echo ""
echo "Next steps:"
echo "  npm run dev    — Start the development server"
