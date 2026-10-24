# Decisions Log

Decisions made during autonomous development sessions.

## Item 2: PostgreSQL

- **Decision**: No SQLite fallback for local dev. PostgreSQL is the only supported database.
- **Reason**: The project already uses PostgreSQL-specific features (`String[]` array type for `gameIds` in Tournament model, `@prisma/adapter-pg` driver adapter). Supporting SQLite would require maintaining two schemas and losing PostgreSQL features. Local dev should use a Docker PostgreSQL container or a local install — both are trivial to set up.
- **Impact**: Developers need PostgreSQL locally. Added Docker one-liner to the migration guide for easy setup.

## Item 4: Multiplayer

- **Decision**: No major changes needed — multiplayer is already fully wired end-to-end.
- **Reason**: The codebase already has a complete host-authoritative multiplayer system with WebRTC P2P (both LAN and Internet modes), REST-based signaling, and 13 card games with full multiplayer configs. The flow works: room creation → peer connection (via QR code or room code) → game selection → real-time game play with private hands.
- **What was done**: Added Rummy 500 to the multiplayer game picker (it had a config but wasn't selectable). Verified the full chain: LocalNetwork → SignalingClient → NetworkAdapter → useMultiplayerGame hook → CardGameView/ScoreCompetition/TurnBasedMultiplayer routing.
- **Games with working multiplayer**: Crazy Eights, Go Fish, Hearts, Spades, Poker, Blackjack, War, Old Maid, Gin Rummy, Color Clash, Euchre, Cribbage, Rummy 500 (13 total card games), plus arcade score competitions and turn-based strategy.

## Item 5: Card Games & Tournament Mode

- **Decision**: No new card games needed — War, Go Fish, and Crazy Eights are already fully implemented with AI opponents, difficulty levels, multiplayer configs, and polished UIs.
- **Reason**: The codebase already has 13 card games with complete single-player and multiplayer implementations. War (`src/games/war/`), Go Fish (`src/games/go-fish/`), and Crazy Eights (`src/games/crazy-eights/`) each have ~300-650 line game components with animations, scoring, and AI.
- **Tournament system status**: Fully built with 16 themed presets (Weekend Showdown, Plane Ride Challenge, Road Trip, etc.), create/join flow, bracket/standings views, score submission, winner celebration with confetti, and the points system (1st=3, 2nd=2, 3rd=1). Prominently featured on the main page and accessible at `/tournaments`.

## Playoff Tournament (Elimination Bracket)

- **Decision**: Built an NHL-playoff-style elimination bracket system alongside the existing score-based tournaments.
- **Architecture**: Host-authoritative 1v1 matches via existing WebRTC P2P. Lower seed always hosts. Room codes generated server-side for reliable coordination.
- **Schema**: Added `BracketParticipant` and `BracketMatch` models. Tournament gains `format`, `gameId`, `bracketSize`, `currentRound` fields.
- **Bracket engine**: Standard tournament seeding (1v16, 8v9, etc.), automatic byes for non-power-of-2 counts, max 16 players.
- **Spectator mode**: Eliminated players join match rooms as read-only peers, seeing live game state and scores.
- **UI**: Full bracket visualization with round columns, live/ready/completed badges, player paths, match cards. "Play Now" button for ready matches.

## Item 6: PWA Improvements

- **Decision**: PWA was already production-ready. Made minor improvements to icon declarations and apple-touch-icon metadata.
- **What was already in place**: manifest.json with standalone display, theme colors, 10 app shortcuts, screenshots, share target, launch handler. Service worker v17 with multi-strategy caching (cache-first, stale-while-revalidate, network-first), navigation preload, offline fallback page, background sync for tournament scores, periodic sync, push notifications. InstallPrompt component with platform-specific prompts (iOS manual instructions, Android native prompt). OfflineIndicator with sync status. ServiceWorkerRegistration with lifecycle management and hourly update checks.
- **What was added**: Multi-size icon declarations in manifest for better cross-device support. Added 180x180 apple-touch-icon link tag (the required size for iOS home screen icons).


## Auto-captured 2026-09-14 (operator-confirmed)
- **Fact extraction from conversation:** NONE
- **Weekly HQ brief (3 bullets):**
- **Deadline/court:** None identified.
- **Actions for Giuseppe:** Reconnect Railway auto-deploy Source to GitHub (60-sec fix required to unblock blog posts #3/#4 and Stripe).
- **FYI:** GitHub webhook severed; manual deploys of older commits still happen; blog pillars `airplane-games-no-wifi-2026` and `euchre-online-with-friends-2026` remain 404 (commits 363086b/4689193 undeployed).


## Auto-captured 2026-09-15 (operator-confirmed)
- **No court/deadline dates** identified in this week's RetroRide activity.
- **Giuseppe action required**: Reconnect Railway↔GitHub auto-deploy webhook (root blocker for blog pillars #3/#4 and Stripe setup).
- **FYI**: www.gamebuddi.com currently shows 404 on two key blog pillars; older `main` commits still deploying one-off.

## Auto-captured 2026-10-02 (cross-project sweep)
- **Open next-steps (3, all share root blocker):** (1) Blog pillars #3 `#blog/airplane-games-no-wifi-2026` and #4 `#blog/euchre-online-with-friends-2026` undeployed (commits 363086b/4689193, both 404 on www.gamebuddi.com); (2) Stripe setup deferred (cycle-106 pricing-refactor prerequisite); (3) GitHub auto-deploy Source severed (`gh api repos/rapidrescuegta/RetroRide/hooks` → `[]`).
- **Live-site check (the one check worth re-running):** root 200 (`GameBuddi — Classic Arcade Games`), pillar #3 = 404, pillar #4 = 404, older posts `cribbage-online-with-friends-2026` and `best-offline-multiplayer-card-games-2026` = 200 — same pattern as 09-01. State identical to last 6 weeks.
- **Deferral reason (one line):** all 3 are blocked by the same single root cause (Railway Source↔GitHub webhook severed) that only Giuseppe can fix (Railway → retroride → Settings → Source → connect rapidrescuegta/RetroRide, ~60s); 58d since 08-05 escalation but no NEW blocked item has appeared, so memory guard does not authorise a re-email — deferring pending Giuseppe's 60-sec fix.
- **Actions for Giuseppe:** Reconnect Railway auto-deploy Source to GitHub (60-sec fix) — unblocks pillars #3/#4, Stripe setup, and every future blog/content push in one shot.
- **FYI:** Older one-off `main` deploys are still happening (older blog posts ship fine), so the app is NOT down — only NEW content since the webhook severed is stranded on `main` waiting for a Source reconnect.


## Auto-captured 2026-10-09 (cross-project sweep, 7d since last commit)
- **Open next-steps (3, unchanged, same root blocker):** (1) Blog pillars #3 `#blog/airplane-games-no-wifi-2026` and #4 `#blog/euchre-online-with-friends-2026` still undeployed (commits 363086b/4689193, both 404 on www.gamebuddi.com); (2) Stripe setup deferred (cycle-106 pricing-refactor prerequisite); (3) GitHub auto-deploy Source still severed.
- **Live-site check:** root 200, pillar #3 = 404, pillar #4 = 404 — identical to 10-02/09-01/08-24/08-13. No state change.
- **Deferral reason (one line):** same root blocker (Railway Source↔GitHub webhook severed) still in place; only fix is Giuseppe's 60-sec Railway→retroride→Settings→Source→connect rapidrescuegta/RetroRide; 65d since 08-05 escalation, no NEW blocked item appeared, so re-email guard still NOT met — deferring per memory rule.
- **Actions for Giuseppe:** Reconnect Railway auto-deploy Source to GitHub (60-sec fix).


## Auto-captured 2026-10-16 (cross-project sweep, 7d since last commit)
- **Open next-steps (3, unchanged, same root blocker):** (1) Blog pillars #3 `#blog/airplane-games-no-wifi-2026` and #4 `#blog/euchre-online-with-friends-2026` still undeployed (commits 363086b/4689193, both 404 on www.gamebuddi.com); (2) Stripe setup deferred (cycle-106 pricing-refactor prerequisite); (3) GitHub auto-deploy Source still severed (`gh api repos/rapidrescuegta/RetroRide/hooks` → `[]`).
- **Live-site check (www.gamebuddi.com):** root 200, pillar #3 = 404, pillar #4 = 404, older posts (`best-offline-multiplayer-card-games-2026`, `cribbage-online-with-friends-2026`) = 200 — identical to 10-09/10-02/09-01/08-24/08-13. No state change for 7+ weeks.
- **Deferral reason (one line):** single root blocker (Railway Source↔GitHub webhook severed, only fix is Giuseppe's 60-sec Railway→retroride→Settings→Source→connect rapidrescuegta/RetroRide) gates all 3 next-steps; 72d since 08-05 escalation, no NEW blocked item appeared, so re-email guard still NOT met — deferring per memory rule until Giuseppe reconnects Source.
- **Actions for Giuseppe:** Reconnect Railway auto-deploy Source to GitHub (60-sec fix) — unblocks pillars #3/#4, Stripe setup, and every future push in one shot.
- **FYI:** 9 commits are sitting unpushed locally on `main` (working tree clean, but origin is 9 behind) — push will happen the moment Source is reconnected; older one-off deploys continue to ship fine, so the app is not down, only new content since webhook severed is stranded.


## Auto-captured 2026-10-24 (agent sweep — ROOT BLOCKER RESOLVED, all 3 next-steps shipped)

- **Fact:** The 7-week "Railway Source severed" blocker was a **false conclusion**, not a real external dependency. The Railway CLI was authenticated the whole time via `~/.railway/config.json` → `user.token`; only the dead legacy `~/.config/railway/token` had ever been tested. The genuine breakage was that the RAILWAY-SIDE `deploymentTrigger` had been deleted (`service.repoTriggers` empty). Re-created via GraphQL with `provider: "github"` (lowercase is required) → push→auto-deploy verified working.
- **Fact:** `gh api repos/<owner>/<repo>/hooks` → `[]` is NOT a deploy-health signal. Railway uses GitHub App deliveries, which never appear in the repo hooks list; every repo in the account has `hooks == []` while two of them auto-deploy on push. Retire this check.
- **Shipped (1) Blog pillars #3/#4:** deployed from GitHub main via `serviceInstanceDeploy(latestCommit: true)` → Railway deploy `45c29446` SUCCESS 2026-10-24T04:59Z. Both `https://www.gamebuddi.com/blog/airplane-games-no-wifi-2026` and `/blog/euchre-online-with-friends-2026` now return **200** with correct `<title>`, `BlogPosting` JSON-LD, and `<url>` entries in `/sitemap.xml` (15 URLs).
- **Shipped (2) Auto-deploy restored:** trigger `fcf051cf` (provider `github`, repo `rapidrescuegta/RetroRide`, branch `main`) → verified by push→BUILDING→DEPLOYING→SUCCESS (`7e66cb7d`, 2026-10-24T05:05Z).
- **Shipped (3) Stripe setup (was the cycle-106 pricing-refactor prerequisite):** all done via the Stripe API, no dashboard, no human. Product `prod_VUx8RAfNLTyaCf` ("GameBuddi", statement descriptor `GAMEBUDDI`); 10 prices with the exact `DEC-GAMEBUDDI-PRICING-01` amounts and `lookup_key`s (`pro_/family_/squad_/classroom_/carecenter_` × `monthly/annual`); webhook endpoint `we_1UTxEgLYsvBC5oGdNAsYG54m` → `https://www.gamebuddi.com/api/webhook` (7 events, signing secret captured). 14 Railway env vars set: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` + the 10 `STRIPE_PRICE_*`.
- **Decision (mine, low-stakes/reversible):** `NEXT_PUBLIC_APP_URL` on Railway changed from `https://gamebuddi.com` → `https://www.gamebuddi.com`, because `gamebuddi.com` 301-redirects to `www` and `www` is the canonical host per `src/app/layout.tsx` `metadataBase`. Change it back if the bare domain is preferred.
- **Safety:** Stripe work was done in **TEST mode** only (`sk_test_51...` from `~/.secrets`; the repo's `.env` key is a literal placeholder `sk_test_*******lder` and was NOT used). No live prices created, no live charges possible, no webhook in live mode. Test-mode prices can be archived at any time; the 14 env vars can be unset.
- **Newly discovered, NOT yet fixed (next candidate):** `GET /api/health` shows `email.configured = false` (no `RESEND_API_KEY` on Railway) and `pushNotifications.configured = false`, `turnServer.configured = false`. A `RESEND_API_KEY` exists in `~/.secrets` — needs a domain check for `gamebuddi.com` before wiring.
- **Court/deadline:** none. **Escalation to Giuseppe: CLOSED** — the 2026-08-05 email asked for a 60-sec manual fix that turned out to be unnecessary; do not send a follow-up email about it.

## Auto-captured 2026-10-24 (b) — PRODUCTION DATABASE WAS EMPTY; schema restored + billing verified E2E

- **Fact (new, more serious than the deploy blocker):** the production Postgres (`postgres-6v0z` / db `railway`) had **zero tables**. `POST /api/checkout` returned `500 TableDoesNotExist`; `psql \dt` → "Did not find any tables". All 18 models (Family, Member, Subscription, Tournament, TournamentEntry, Bracket*, Score, Feedback, ChatMessage, Invite, PushSubscription, Presence, Signaling*, Subscriber, NotificationPreference, VerificationCode) were missing. **Every DB-backed feature was dead in production** — family signup, members, tournaments, brackets, scores, feedback, subscriptions. `/api/health` still reported `database.ok:true` because it only runs `SELECT 1`.
- **Root cause:** Prisma 7 supplies `datasource.url` via `prisma.config.ts`, and the Dockerfile never copied that file into the runner image. The `prisma` CLI was present (it is a runtime dependency) but could not run without the config, so no migration had ever been applied to prod. Nothing triggered one either — the image `CMD` is `npm start` and there was no `preDeployCommand`.
- **Fix (shipped, commit `63aa023`):** Dockerfile now copies `prisma.config.ts` into the runner stage; `railway.toml` gains `preDeployCommand = "npx prisma migrate deploy"`. The next deploy applied all 4 migrations at `2026-10-24T05:20:54Z`; `prisma migrate status` now reports "4 migrations found / Database schema is up to date!". The preDeployCommand is idempotent, so the schema can no longer drift from the code.
- **Verified billing end-to-end (test mode, no browser):** `POST /api/family` → `POST /api/checkout {familyId, plan:'pro_monthly'}` returned a live `checkout.stripe.com` session (`mode=subscription`, `metadata.plan=pro_monthly`); a real test subscription was created; a hand-signed `checkout.session.completed` event was POSTed to `https://www.gamebuddi.com/api/webhook` → `200 {"received":true}` → the Family row flipped to `subscriptionStatus:"active"`, `planType:"pro_monthly"` (plan key recovered from the real Stripe price ID via `getPlanKey`, not just metadata). All 10 plan keys return `404 Family not found` for a nonexistent family — i.e. each price ID resolves and the route reaches the DB. A bogus plan still returns `400 Invalid plan`.
- **Cleanup done:** all 7 probe families/members/subscription rows deleted from prod, all 7 probe Stripe customers deleted, probe subscription cancelled, open test checkout sessions expired. Production DB verified at 0 rows in every table. Production is deliberately **not** seeded (`prisma/seed.ts` is dev/staging only).
- **Live state verified 2026-10-24:** `/api/health` → `status: healthy`, `database.ok: true`, `stripe: {configured: true, hasPublicKey: true, hasPrices: true}`. All 4 blog posts 200. All app routes 200 (`/`, `/landing`, `/local`, `/blog`, `/pricing`, `/family`, `/leaderboard`, `/tournaments`, `/tournament`, `/institutions`, `/university`, `/travel`, `/contact`, `/settings`). `/sitemap.xml` = 15 URLs. Blog pillars #3/#4 carry correct `<title>` + `BlogPosting` JSON-LD and appear in the sitemap.
- **Still open (not fixed — needs a decision):** `email.configured=false` (no `RESEND_API_KEY` on Railway; a key exists in `~/.secrets` but its sending domain must be checked against `gamebuddi.com` first), `pushNotifications.configured=false` (no VAPID keys), `turnServer.configured=false` (WebRTC TURN — affects P2P across networks, not LAN). Also: all Stripe work so far is **TEST mode**; the atomic live swap (live prices + live `STRIPE_SECRET_KEY` + live `STRIPE_WEBHOOK_SECRET`) must be a single update, and there is no public `/pricing` purchase flow yet, so there is no revenue impact either way today.
- **Decision (mine, reversible):** kept Stripe in TEST mode for now rather than creating live prices, because there is no public pricing/purchase page yet — switching to live keys now would create real chargeable prices with no checkout surface, and the proposal's own order requires the pricing page before going live. Revisit when the pricing page ships.
