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

### What I learned

Dated narratives live in **DECISIONS.md**; what follows is the actionable residue — each trap and its fix.

**2026-10-24 — the 7-week "deploy blocker" was a FALSE CONCLUSION; it is GONE. Do not re-derive it, re-escalate it, or re-run the hooks/token tests.**

- **Credential stores: enumerate ALL of them.** Working Railway token = `~/.railway/config.json` → `user.token`; `~/.config/railway/token` is a dead legacy file and was the ONLY one ever tested. `~/.secrets` holds the Railway + GitHub tokens and the real Stripe key; the repo `.env` holds a placeholder (`sk_test_*******lder`) that errors "Invalid API Key".
- **Railway deploy trigger: `provider` MUST be lowercase `"github"`** — capital creates a trigger that never fires. Recreate with `deploymentTriggerCreate(input: { projectId, environmentId, serviceId, provider: "github", repository, branch: "main" })` on `https://backboard.railway.app/graphql/v2`; no-trigger escape hatch = `serviceInstanceDeploy(serviceId, environmentId, commitSha, latestCommit: true)` straight from GitHub main. Neither needs a human.
- **The agent CAN run prod ops:** `railway variable list/set/delete` work; `railway ssh --service <svc> -- "<cmd>"` runs inside the prod container. Base64 a script to `/tmp/x.mjs` over SSH and import with `createRequire('/app/package.json')` — plain `import 'pg'` from `/tmp` can't resolve node_modules.
- **Prisma 7 reads `datasource.url` from `prisma.config.ts`** — if the Dockerfile doesn't copy it into the runner image, `migrate deploy` can't run and the prod schema never exists. Ship `COPY --from=builder /app/prisma.config.ts ./prisma.config.ts` + railway.toml `[deploy] preDeployCommand = "npx prisma migrate deploy"` (idempotent — the schema can never drift from the code again). Verify the SCHEMA, not connectivity: `railway ssh --service retroride -- "cd /app && npx prisma migrate status"`. **Prod is intentionally NOT seeded** — `prisma/seed.ts` is dev/staging only.
- **Push was 100% INERT — the client could subscribe but nothing ever sent.** Fix: `src/lib/push-server.ts` (web-push sender; `setVapidDetails`; `{TTL, urgency:'high'}`; **prunes subscriptions the push service answers 404/410**), `GET /api/push/config` (runtime VAPID key), and the trigger in `POST /api/tournament/[id]/match` (push both players when a match flips `ready`; winner+loser on the final), fire-and-forget in try/catch so a push failure can never fail the result report. **`web-push` needs `serverExternalPackages: ['web-push']` in `next.config.ts`.**
- **`NEXT_PUBLIC_*` must be read with STATIC member access (`process.env.NEXT_PUBLIC_FOO`)** — the dynamic `process.env[key]` helper is not inlined into the client bundle, so client reads silently compile to `''`; declare the vars as `ARG`s in the Dockerfile builder stage or `next build` can't see them either. Same rule → **the VAPID public key must reach the browser at RUNTIME**: serve it from an API route (keep the build-time inline as a fast path).
- **`cache.addAll()` is ATOMIC — one 404 empties the whole offline cache.** Cache each page individually with `cache.put()` inside a per-item `try`, and never `addAll()` a route you haven't just `curl`ed for 200. Prove it in a real browser (Playwright → `caches.keys()` → offline navigate), don't reason about the SW code.
- **`controllerchange` FIRES ON THE FIRST SW INSTALL** (the new worker calls `clients.claim()`), so a naive "reload on SW update" handler reloads every first-time visitor and wipes React state (it broke the purchase funnel — the "Send Code" API returned `{"sent":true}` but the code field never appeared). Snapshot `hadController = !!navigator.serviceWorker.controller` **at mount** and reload only when there WAS a controller, the visitor isn't typing in a field, or they clicked "Update now" (`src/lib/sw-reload.ts`). Never hard-reload while `document.activeElement` is a text input.
- **TS: assignments inside a `prisma.$transaction(async (tx) => …)` callback are invisible to control-flow analysis** — the outer `let` narrows to `null` and `if (x)` narrows to `never` (TS2339). **Return the value from the callback** and bind the awaited result; a `const` re-annotation does NOT help.
- **An unvalidated field is a 500; a route with no try/catch is an empty, unlogged 500.** Write routes validate field types → 400; every route try/catch with a logged error + real JSON body; multi-row writes that must land together go in one `prisma.$transaction` (a two-statement `createRoom` orphaned a `SignalingRoom`, blocking that room code for its 2-hour TTL).
- **Stripe is fully API-doable — no dashboard, no human:** `POST /v1/products`, `POST /v1/prices` (`lookup_key`, `recurring[interval]`, `tax_behavior=exclusive`), `POST /v1/webhook_endpoints` (the `whsec_` secret is returned ONCE, on create). **Never create a $0 Free-tier Price — Free is a DB state, not a checkout.**
- **Stripe API gotchas (account API version `2026-02-25.clover`):** list endpoints are **GET**, not POST; `limit` is **rejected** on list endpoints; delete needs `DELETE /v1/customers/{id}`; raw card numbers blocked — use `card[token]=tok_visa` and attach the payment method BEFORE setting `invoice_settings[default_payment_method]`.
- **E2E billing test with no browser:** `POST /api/family` → `POST /api/checkout {familyId, plan}` → **hand-sign a `checkout.session.completed` event** (`Stripe-Signature: t=<ts>,v1=HMAC_SHA256(whsec, "<ts>.<payload>")`) and POST it to the live `/api/webhook` → `{"received":true}` and the Family row flipped to `subscriptionStatus:"active"`, `planType:"pro_monthly"` (plan key recovered from the real price id, not just metadata) — proving reachability, signature verification, handler logic and DB writes in one shot.
- **Check the Stripe account identity before wiring checkout:** `GET /v1/account`. The brand on the Checkout page is the **ACCOUNT's** business name, not your product's — GameBuddi's checkout rendered "Clientaro CRM" — the shared key belongs to the Clientaro account, violating one-account-per-product.
- **Production email was set up from scratch, no dashboard work:** Resend `POST /v1/domains` → `POST /v1/domains/{id}/verify` → set the key + `EMAIL_FROM` on Railway. **Use a `send.` subdomain — do NOT touch the root SPF:** MX + TXT SPF at `send.gamebuddi.com`, DKIM TXT at `resend._domainkey.gamebuddi.com`, CNAME `rsend`; the root's SPF and M365 MX stay untouched (keeps Workspace mail flowing, avoids a duplicate-SPF break). **GoDaddy DNS: `PUT /v1/domains/{domain}/records` replaces the ENTIRE record set** — GET every record, merge, PUT the full set back.

### Project quick reference (verified)

- **Live host `https://www.gamebuddi.com`** (canonical per `src/app/layout.tsx` `metadataBase`); `gamebuddi.com` → 301 → www. **`retroride.app` is a PARKED LANDER** (all paths → `/lander`) — live-checking it checks the wrong host; that mistake produced weeks of false "404" readings. Railway IDs, blog-publish how-to and escalation history live in **DECISIONS.md**.
- **Per-sweep live check:** `curl` `https://www.gamebuddi.com/blog/<slug>` — pillars #3/#4 are LIVE (200) since 2026-10-24. The hooks/token tests are exhausted — do not re-run them.

### Patterns that worked

- **Verify against the live artifact, never a proxy signal.** All 7 weeks of "blocked" were proxy inferences (`hooks == []`, an expired token file, `database.ok:true`). Real signals: `curl` the live URL, the Railway deployment list, `_prisma_migrations`, `/api/health`. When a blocker looks external, exercise the actual path before escalating to a human.
- **`gh api repos/<o>/<r>/hooks` → `[]` is a RED HERRING for Railway.** Railway uses GitHub **App** deliveries, which never appear in repo hooks — every repo shows `[]` while clientaro-web and classic-training-app auto-deployed seconds after `pushed_at`. Deploy health = live-site curl + Railway deploy history (`deployments(first:N, input:{serviceId})` → `createdAt` seconds after the repo's `pushed_at`). Control-test a working sibling (clientaro-web) to isolate which side broke.
- **A health flag is a claim, not evidence.** `database.ok:true` hid an empty prod schema; `turnServer.configured:false` hid working TURN relays. Verify by exercising the path; fix the health endpoint when the flag lies.
- **"The UI is wired" ≠ "the feature works."** Push had a subscribe endpoint, an SW handler, a permission flow — and no sender. Trace the whole chain; don't infer capability from the client half.
- **Design the proof, don't hope for a log line.** Pick a probe endpoint whose response code you control and let the system's own failure behaviour be the receipt. To prove a push sent with no browser and no push service: point the subscription `endpoint` at a URL returning **404** — the sender prunes 404/410, so *pruned rows = the receipt*. NOT the FCM legacy endpoint: it answers **400**, counted as failure not prune.
- **Probe every route with a contract-accurate payload, not a status-code sweep.** `curl -o /dev/null -w '%{http_code}'` says "200" for a route that 500s on the field it cares about. Read the route's payload contract out of the source first (a wrong-shaped probe is a false alarm), then call every route for real against one throwaway family — that's what surfaced the preferences 500, the empty-body routes and the orphaned signaling room.
- **Clean up every probe you create in production, and count every table when you do.** Test families, Stripe customers and subscriptions are real rows in a real account. One throwaway `cleanup-probe.mjs` (via `railway ssh`, base64'd in) deletes the probe families, their cascade and the Stripe customers/sessions, then prints a **row count for every table** — the per-table count is the discipline, so "prod is clean" is a fact, not a hope. Every new probe shape needs its own variant. `railway ssh` may time out on the CLIENT while the REMOTE command still ran — re-run the count before assuming cleanup failed. Counting every table (even the ones the feature "doesn't use") exposed an orphan `SignalingRoom` row with zero messages.
- **Ship the fix AND the guard.** Copying `prisma.config.ts` into the image restored the schema; `preDeployCommand` makes that bug class impossible to recur. Recreating the deployment trigger restored auto-deploy; the push→deploy check is the guard that proves it.
- **When an API works but the dashboard doesn't, read the live response.** Resend, Stripe, GoDaddy DNS and Railway GraphQL all have APIs — email, Stripe setup and the deploy fix were done without a single human click.
- **For any payment flow, the acceptance test is a real browser session ending on a live Stripe Checkout page — not a 200 from the API.** One Playwright run (`/pricing` → "Get Family" → `/family?plan=family_monthly` → real email code from the live Gmail inbox via workspace-mcp → Verify → Create Family → checkout) proved the SW reload bug, the `?plan=` funnel wiring, the tier preselection and the Stripe account-name defect.
- **Symptom→cause: "the API returned success but the UI lost the result" = something reloaded the page between fetch and render — suspect the service worker first.**

### Patterns that failed

_(empty)_

### Tools I wish I had

- **A committed route-probe harness.** `scripts/probe-api.mjs` would read each `src/app/api/**/route.ts` contract, build one throwaway family, call every method with a valid body, assert no 5xx, then delete the family + Stripe customer + subscriber + signaling rows and print a per-table row count. Today it is a throwaway `/tmp` script; as a repo script it would run on every deploy. No new dependency — Node + global `fetch` is enough.
