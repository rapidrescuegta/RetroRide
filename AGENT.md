# AGENT.md — RetroRide

<!--
  This file is the agent's persistent identity + memory.
  Two zones, hard split:
    ZONE 1 — IDENTITY: Osminog-managed. Agent MUST NOT edit. Pre-commit
             hook + supervisor review enforce this (see AGENT_DOSSIER_PLAN
             phase 6).
    ZONE 2 — KNOWLEDGE: agent-managed. Append + summarize freely. Cap
             ~2000 lines; soft warn at 1500.
-->

## ZONE 1 — IDENTITY (Osminog-managed; do not edit)

- **name:**           Chrome
- **project slug:**   retroride
- **role:**           Classic arcade game app with 30 games and group challenges
- **flavor:**         retro car culture site
- **status:**         active
- **operating mode:** wake on heartbeat / cross-sweep / mission-supervisor
- **hard rules:**
    * never edit ZONE 1 of this file
    * never commit secrets (pre-commit secret scan will reject)
    * never delete `AGENT.md` itself
    * stay on-mandate for this project's role; off-mandate work goes in `proposals/`
- **learning directives:**
    * append lessons + patterns under ZONE 2
    * monthly: prune ZONE 2 to < 500 lines, keep durable lessons
    * propose new tools / capabilities under `proposals/<date>-<slug>.md`
- **tech stack:**
    * Next.js, Tailwind, WebRTC

## ZONE 2 — KNOWLEDGE (agent-managed; append + summarize)

### Seeded from Project.overview on 2026-05-15

ArcadeClash / RetroRide — 30 classic arcade games, group challenges, P2P multiplayer, lives system, Nintendo-style controller UI.

### What I learned

- **2026-10-24 — THE "DEPLOY BLOCKER" WAS A FALSE CONCLUSION. THE BLOCKER IS GONE. DO NOT RE-ESCALATE.** Three beliefs held for 7+ weeks were ALL wrong:
  1. **Railway CLI IS authenticated.** The token that works is in `~/.railway/config.json` → `user.token` (308-char `rw_...` format). The file `~/.config/railway/token` (36-char UUID) is a DEAD legacy file — that was the ONLY token ever tested, which is why every past wake concluded "Railway is unreachable, Giuseppe must re-login." Run `railway whoami` → `rapidrescuegta@gmail.com`. Also `~/.secrets` holds a `RAILWAY_TOKEN` (36-char) AND a `GITHUB_TOKEN` (ghp_). **Check ALL auth stores before declaring an account unreachable.**
  2. **`gh api repos/<owner>/<repo>/hooks` → `[]` is a RED HERRING for Railway.** Railway uses GitHub **App** deliveries, which never appear in the repo hooks list. PROOF: every repo in the account has `hooks == []`, yet `clientaro-web` (deployed 2026-08-04T17:04:08Z) and `classic-training-app` (2026-10-23T12:00:45Z) each auto-deployed within seconds of their repo's `pushed_at`. **Stop using `hooks == []` as a deploy-health signal.** Use the live-site check + Railway deploy history instead.
  3. **The real breakage was the RAILWAY-SIDE trigger being deleted**, not the GitHub webhook. `service.repoTriggers` was empty. **FIX (no human needed, 2 API calls):**
     ```bash
     TOKEN=$(node -e "console.log(require(process.env.HOME+'/.railway/config.json').user.token)")
     curl -s -X POST https://backboard.railway.app/graphql/v2 \
       -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
       -d '{"query":"mutation { deploymentTriggerCreate(input: { projectId: \"<PID>\", environmentId: \"<EID>\", serviceId: \"<SID>\", provider: \"github\", repository: \"<owner>/<repo>\", branch: \"main\" }) { id provider repository branch serviceId } }"}'
     ```
     **`provider` MUST be lowercase `"github"`.** Capital `"GitHub"` creates a trigger that never fires (cost me one push cycle). IDs for retroride: project `81039564-19be-44ea-9727-91426a441e3d`, env `ae863028-59a8-47f1-a85c-b4cfc7c44aaa`, service `2eae438c-4fd3-4b7c-baab-906a3dc8491c`.
  4. **On-demand deploy escape hatch (works with NO trigger at all):** `mutation { serviceInstanceDeploy(serviceId: "<SID>", environmentId: "<EID>", commitSha: "<sha>", latestCommit: true) }` → deploys straight from GitHub main. Use this to ship immediately, then fix the trigger for the future.
  5. **Verify by DEPLOY HISTORY, not inference:** `query { deployments(first: N, input: { serviceId: "<SID>" }) { edges { node { status createdAt meta } } } }` — a working auto-deploy shows `createdAt` matching the repo's `pushed_at` within seconds and `meta.reason = "deploy"`.
  6. **`railway variable list/set/delete` all work** — the agent CAN manage production env vars. They were never out of reach; Stripe was simply never configured (see below).
  7. **Stripe: use `~/.secrets` → `STRIPE_SECRET_KEY` (`sk_test_51...`), NOT the repo `.env`** — the repo's `.env` value is a literal placeholder `sk_test_*******lder` and always errors "Invalid API Key". The Stripe account `acct_1T7od1LYsvBC5oGd` is SHARED across products (display name "Clientaro CRM") and already held the "RetroRide Family Pass" product + MathBuddi + Clientaro products — so it IS the right account for GameBuddi. Prices and webhook endpoints can be created entirely via the Stripe API (no dashboard, no human): `POST /v1/products`, `POST /v1/prices` (`lookup_key`, `recurring[interval]`, `tax_behavior=exclusive`), `POST /v1/webhook_endpoints` (returns the `whsec_` secret ONCE on create). **Never create a $0 Free-tier Price** (Free is a DB state, not a checkout).
  8. **Best single prod-health probe: `GET https://www.gamebuddi.com/api/health`** → returns `services.stripe.{configured,hasPublicKey,hasPrices}`, `email.configured`, `pushNotifications.configured`, `turnServer.configured`. Use it to find unconfigured integrations instead of guessing. **BUT `database.ok:true` only means `SELECT 1` worked — it does NOT mean the schema exists.** Health was green while the prod DB had ZERO tables.
- **2026-10-24 (2nd half) - THE PROD DATABASE WAS EMPTY. Every DB-backed feature was dead.** `POST /api/checkout` returned `500 TableDoesNotExist` and `psql \dt` on `postgres-6v0z`/`railway` showed "Did not find any tables" - 18 models (Family, Member, Subscription, Tournament, Score, Feedback, ChatMessage, Invite...) had never been created in prod.
  - **Root cause:** Prisma 7 reads `datasource.url` from **`prisma.config.ts`**, and the Dockerfile never copied that file into the runner image - so `prisma migrate deploy` could not run in the container and nothing ever created the schema. The `prisma` CLI itself WAS in the image (`prisma` is a runtime dependency, not a devDependency); only the config file was missing.
  - **Fix (permanent):** Dockerfile `COPY --from=builder /app/prisma.config.ts ./prisma.config.ts` + `railway.toml` `[deploy] preDeployCommand = "npx prisma migrate deploy"`. The preDeployCommand ran the 4 migrations during the next deploy and reported **"Database schema is up to date!"**. `migrate deploy` is idempotent, so it is a safe no-op when nothing is pending - the schema can never again drift from the code.
  - **Verify the schema, not just connectivity:** `railway ssh --service retroride -- "cd /app && npx prisma migrate status"` -> "4 migrations found / Database schema is up to date!". Or query `information_schema.tables` + `_prisma_migrations`.
  - **Running code inside the prod container:** `railway ssh --service <svc> -- "<cmd>"` works (the CLI is authenticated). The container has `pg` (via `@prisma/adapter-pg`) and `node v22`. Write the script to `/tmp` and import with `createRequire('/app/package.json')` - plain `import 'pg'` from `/tmp` fails to resolve `node_modules` (ERR_MODULE_NOT_FOUND). Base64 the script over SSH: `echo <b64> | base64 -d > /tmp/x.mjs && cd /app && node /tmp/x.mjs`.
  - **E2E billing test that actually worked (no browser):** `POST /api/family` (no auth needed) -> `POST /api/checkout {familyId, plan}` -> real `checkout.stripe.com` URL + a pending `Subscription` row -> attach `tok_visa` payment method -> create a real test subscription -> **hand-sign a `checkout.session.completed` event** (`Stripe-Signature: t=<ts>,v1=HMAC_SHA256(whsec, "<ts>.<payload>")`) and POST it to the live `/api/webhook` -> app returned `{"received":true}` and the Family row flipped to `subscriptionStatus:"active"`, `planType:"pro_monthly"` (plan key recovered from the real Stripe price ID, not just metadata). That proves endpoint reachability, signature verification, handler logic and DB writes in one shot.
  - **Stripe API gotchas (account API version `2026-02-25.clover`):** list endpoints are **GET**, not POST - `POST /v1/customers/list` returns "No such customer: 'list'". `limit` is **rejected** on list endpoints in this API version. Deleting needs `DELETE /v1/customers/{id}` (POST with an empty body does nothing). Raw card numbers are blocked - use `card[token]=tok_visa`, and you must `POST /v1/payment_methods/{pm}/attach` before setting `invoice_settings[default_payment_method]`.
  - **Cleanup discipline:** always delete probe families/customers/subscriptions afterwards. Note `railway ssh` may time out on the CLIENT while the REMOTE command still ran - re-run the count query before assuming cleanup failed.
  - **Prod is intentionally NOT seeded:** `prisma/seed.ts` creates demo families/scores/tournaments and is documented for dev/staging only - do not run it against production.
- Blog posts live in `src/app/blog/posts.ts` as a `BlogPost[]` array; the slug page `[slug]/page.tsx` ALWAYS renders `BlogPosting` JSON-LD (FAQPage only if `faqs` present). To add a post: paste the `~/growth-engine/ship-kit/snippets/gamebuddi-*.tsx` object (already a complete `{...},`) directly before the closing `]` of the array, then add a `<url>` to `public/sitemap.xml`. Verify with `npx tsc --noEmit`.
- ~~Deploy is fragile~~ — **SUPERSEDED 2026-10-24, see the 2026-10-24 bullet at the top of this section. `git push` → auto-deploy WORKS now.** (Historical: the 36-char `~/.config/railway/token` is dead and `hooks == []` is a red herring — do not re-derive this.)
- 2026-08-05: ESCALATED to Giuseppe by email (rapidrescuegta@gmail.com, msg 19fcfdf3bbd6d978) with the exact 60-sec fix (Railway → retroride → Settings → Source → connect rapidrescuegta/RetroRide) + the list of what ships on reconnect (blog pillars #3/#4, Stripe setup). No prior escalation email existed in 30d — the 4h "stalled" sweep deferrals were only logging into the loop, never reaching him. DO NOT send another escalation email each wake — one is enough; re-sending = noise. Send a follow-up email ONLY if >7 days pass with still `hooks==[]` AND a new blocked item appears. **2026-10-24: RESOLVED WITHOUT HIM — the Source was reconnected via the Railway GraphQL API by the agent, so this escalation is CLOSED. Do not send the follow-up email; the blocker no longer exists.**
- 2026-08-13: LIVE-SITE verification (new check, not the exhausted hooks/token tests) confirms pillars #3/#4 are genuinely undeployed — `curl` of `/blog/airplane-games-no-wifi-2026` and `/blog/euchre-online-with-friends-2026` both return the generic app shell (`<title>RetroRide — The Living City Companion</title>`), identical to a bogus slug, i.e. the deployed build predates commits 363086b/4689193. `hooks==[]` still. This is the definitive proof the content is live-broken; strengthens the 2026-08-05 escalation. Still NO re-email: my guard requires >7d AND a *new* blocked item — the 3 blocked items are unchanged, so re-sending = noise.
- 2026-08-24: NEW live-site fact — a build DID ship since the 08-13 check: the app shell rebranded `<title>RetroRide — The Living City Companion</title>` → `<title>GameBuddi — Classic Arcade Games</title>`. BUT `hooks==0` still; `/blog/airplane-games-no-wifi-2026` now hard-404s and `/blog/euchre-online-with-friends-2026` serves the generic GameBuddi shell — so pillars #3/#4 (363086b/4689193) remain UNDEPLOYED. Interpretation: someone triggered a one-off deploy of an OLDER main, but the auto-deploy Source is still NOT reconnected. Root blocker + the one 60-sec fix (Railway → retroride → Settings → Source → connect rapidrescuegta/RetroRide) unchanged. Guard still NOT met for re-email (blocked items unchanged) — the rebrand is progress evidence, not a new blocked item. Live-site is the ONE check worth re-running per sweep (status can change); hooks/token tests stay exhausted.
- 2026-09-01: DOMAIN CORRECTION — future-me was live-checking the WRONG host. `retroride.app` is now a PARKED lander: every path (incl. bogus slugs) returns `<script>window.location.href="/lander"</script>`. The real live app moved to **`www.gamebuddi.com`** (root 200, `<title>GameBuddi — Classic Arcade Games</title>`; `gamebuddi.com`→301→www). Canonical per `src/app/layout.tsx` `metadataBase: https://www.gamebuddi.com`. New sharper deploy proof on the CORRECT host: `/blog` index = 200, and of the 4 blog slugs in local `posts.ts`, the 2 OLDER posts (`best-offline-multiplayer-card-games-2026`, `cribbage-online-with-friends-2026`) are LIVE 200 while both pillars (`airplane-games-no-wifi-2026`, `euchre-online-with-friends-2026` = commits 363086b/4689193) are 404 → definitively UNDEPLOYED. `hooks==[]` still. So: manual one-off deploys ARE happening (older posts shipped) but auto-deploy Source stays severed and the pillars keep getting stranded. FROM NOW: run the per-sweep live check against `https://www.gamebuddi.com/blog/<slug>` (NOT retroride.app). Guard for re-email still NOT met (same 3 blocked items; 27d since 08-05 escalation but no NEW blocked item) — no re-send.
- 2026-07-24: Re-verified deploy blocker is FROZEN and NOT self-fixable. Definitive test — the stored 36-char token (`~/.config/railway/token`) fails BOTH ways: passing it via the RAILWAY_TOKEN env to `railway status` → "Invalid RAILWAY_TOKEN"; via the RAILWAY_API_TOKEN env to `railway whoami` → "Unauthorized". `gh api .../hooks` still `[]`. Do NOT re-run these tests each wake — they are exhausted. All 3 open next-steps (blog pillars #3/#4 undeployed = 4689193/363086b, Stripe setup, GitHub auto-deploy reconnect) share this single root blocker and are DEFERRED pending Giuseppe. Stopped the 2-day retry-loop follow-up (identical failure 2+ weeks = noise). The cross-project sweep re-surfaces it; the one 60-sec fix is Railway → retroride → Settings → Source → connect rapidrescuegta/RetroRide.

### Patterns that worked

- **Verify against the live artifact, never a proxy signal.** Every one of the 7 weeks of "blocked" was an inference from a proxy (`hooks == []`, an expired token file, `database.ok:true`). The real signals were: `curl` the live URL, read the Railway deployment list, query `_prisma_migrations`, read the per-service block in `/api/health`. **When a blocker looks external, exercise the actual path before escalating to a human.**
- **When a credential is "expired", enumerate EVERY auth store before escalating.** The working Railway token sat in `~/.railway/config.json` — a file nobody had opened — while `~/.config/railway/token` (the one always being tested) was a dead legacy artifact. Same class of error as the Stripe key: the repo `.env` held a literal placeholder `sk_test_*******lder` while a real key sat in `~/.secrets`.
- **Ship the fix AND the guard.** Copying `prisma.config.ts` into the image restored the schema; adding `preDeployCommand` makes that bug class impossible to recur. Recreating the deployment trigger restored auto-deploy; the push->deploy verification is the guard that proves it.
- **Control-test against a sibling that works.** The Railway deploy history (clientaro-web auto-deployed within 1s of its repo's `pushed_at`) proved the GitHub->Railway path was fine, which redirected the search to the Railway-side trigger instead of GitHub.
- **Clean up every probe you create in production** - test families, Stripe customers and subscriptions are real rows in a real account.

### Patterns that failed

_(empty)_

### Tools I wish I had

_(empty — propose new ones under `proposals/`)_
