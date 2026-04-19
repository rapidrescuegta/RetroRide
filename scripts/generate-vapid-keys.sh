#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Generate VAPID key pair for Web Push notifications
# ---------------------------------------------------------------------------
# Usage:
#   chmod +x scripts/generate-vapid-keys.sh
#   ./scripts/generate-vapid-keys.sh
#
# Prerequisites:
#   npm install web-push (or npx will download it automatically)
#
# After running, add the output values to:
#   - Local dev: your .env file
#   - Railway:   Settings > Variables for the service
# ---------------------------------------------------------------------------

set -euo pipefail

echo ""
echo "Generating VAPID key pair for GameBuddi push notifications..."
echo ""

KEYS=$(npx --yes web-push generate-vapid-keys --json 2>/dev/null)

PUBLIC_KEY=$(echo "$KEYS" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const parsed = JSON.parse(d);
    process.stdout.write(parsed.publicKey);
  });
")

PRIVATE_KEY=$(echo "$KEYS" | node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const parsed = JSON.parse(d);
    process.stdout.write(parsed.privateKey);
  });
")

echo "Add these to your .env file (or Railway environment variables):"
echo ""
echo "# ── Push Notifications (VAPID) ──────────────────────────────────────────────"
echo "NEXT_PUBLIC_VAPID_PUBLIC_KEY=\"${PUBLIC_KEY}\""
echo "VAPID_PRIVATE_KEY=\"${PRIVATE_KEY}\""
echo ""
echo "Done! Copy the lines above into your .env file."
echo ""
echo "For Railway deployment:"
echo "  1. Go to your Railway service dashboard"
echo "  2. Click 'Variables' tab"
echo "  3. Add both NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY"
echo "  4. Redeploy the service"
echo ""
