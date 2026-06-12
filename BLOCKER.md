# ✅ RESOLVED (2026-06-12) — Deploy freeze fixed

**Production is deploying again.** `/sitemap.xml`, `/robots.txt`, and
`/api/health` all return HTTP 200; `database.ok: true`. First successful
deploy since 2026-04-23.

## Actual root cause (the webhook theory was a red herring)

Deploys were not merely *un-triggered* — every deploy since 2026-04-23 was
**FAILING** the Railway healthcheck (`service unavailable`). Two compounding
problems, both server-side config, neither visible from `git`:

1. **`src/lib/env.ts` → `validateEnv()` hard-required all Stripe vars in
   production.** The Next.js instrumentation hook (`src/instrumentation.ts`)
   calls it on boot, so the server **threw at startup** whenever the Stripe
   keys were unset — which they always were, because payments never launched.
   Result: container never bound its port → healthcheck failed → deploy
   rejected → the old (pre-2026-04-23) container kept serving, masking it.

2. **The retroride Railway service had lost its `DATABASE_URL`** reference to
   the in-project Postgres service (`Postgres-6v0z`, alive and healthy). A
   fresh container also crashed on the eager DB connect in instrumentation.

## Fixes applied

- **Code** (commit `5d0d184`): `validateEnv()` now hard-requires only
  `DATABASE_URL` in production. Stripe vars + `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  + `NEXT_PUBLIC_APP_URL` are non-fatal warnings; the lazy `serverEnv()`/
  `publicEnv()` loaders return `''` instead of throwing. App boots and serves
  games/multiplayer/SEO with payments cleanly disabled until keys are added.
- **Railway env**: restored `DATABASE_URL=${{Postgres-6v0z.DATABASE_URL}}`
  and set `NEXT_PUBLIC_APP_URL=https://gamebuddi.com` on the retroride service.
- **Deploy**: triggered manually via `railway up` (CLI re-authenticated).

## ⚠️ Still needs Giuseppe (does NOT block deploys, but should be done)

1. **Re-add the GitHub deploy webhook** so pushes to `main` auto-deploy again.
   `gh api repos/rapidrescuegta/RetroRide/hooks` still returns `[]`. Until
   fixed, ship with `railway up` from `~/retroride`. Reconnect in Railway →
   retroride service → Settings → Source → connect `rapidrescuegta/RetroRide`
   branch `main`.
2. **Restore missing secrets** on the Railway service (they were wiped along
   with `DATABASE_URL`): `NEXTAUTH_SECRET` (auth is broken without it),
   `RESEND_API_KEY` (email/verification codes only logged to console), and —
   when payments launch — the Stripe keys/price IDs (see the pricing-* growth
   proposals). These are secrets the agent cannot generate.
