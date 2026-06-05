# 🚨 DEPLOY PIPELINE STALLED — Railway auto-deploy disconnected

**Status (2026-06-04 recheck — ROOT CAUSE CONFIRMED):** ~21 days stalled. The GitHub webhook that triggers Railway deploys **has been removed from the repo** — `gh api repos/rapidrescuegta/RetroRide/hooks` returns `[]` (zero webhooks). This is the definitive cause: pushes to `main` reach GitHub but nothing notifies Railway, so no build runs. Agent cannot fix this from its side — re-adding the webhook requires Railway's GitHub-App connection (its URL + secret live in the Railway dashboard), and the Railway CLI token is also expired (`railway whoami` → `Unauthorized`). **Both remediation paths require Giuseppe.** All 16 open RetroRide next-steps are paused/deferred until the reconnect.

**Status (2026-05-28 recheck):** 14 days stalled. Last successful deploy was **2026-05-14 or earlier**.
Three commits sit on `origin/main` with no Railway redeploy triggered:

- `bfd61d7` — docs: add BLOCKER.md
- `0e662ec` — Remove dynamic sitemap/robots routes (prerendering as 404)
- `431c790` — Add static `public/sitemap.xml` + `public/robots.txt` fallback

**Recheck 2026-05-28:** `curl https://gamebuddi.com/sitemap.xml` → still HTTP 404. `railway status` → `Unauthorized` (CLI token expired — agent cannot trigger redeploy from this side either). 16 open next-steps remain blocked. Highest-severity item on RetroRide; everything else is pause-deferred until Giuseppe clicks Redeploy.

## Evidence

```
$ curl -sI https://www.gamebuddi.com/sitemap.xml
HTTP/2 404
etag: "nlao1hgvr28hf"        ← unchanged across 7 days + 2 pushes
x-nextjs-cache: HIT          ← serving stale prerender of a route that no longer exists in source
```

The site root and other `public/` assets (`manifest.json`, `sw.js`, `favicon.ico`) return 200 — app is healthy. **Only the build is frozen.**

## Confirmation evidence (2026-06-04)

```
$ gh api repos/rapidrescuegta/RetroRide/hooks
[]                                ← Railway's deploy webhook is GONE from the repo
$ railway whoami
Unauthorized. Please run `railway login` again.   ← CLI token expired too
$ curl -sI https://www.gamebuddi.com/sitemap.xml
HTTP/2 405                        ← still no static fallback served; build frozen
```

## Fix (Giuseppe, ~60 sec) — only Giuseppe can do this

1. Open Railway → `retroride` service → **Settings → Source / GitHub**.
2. The GitHub connection has dropped (repo shows 0 webhooks). Click **Connect / Reconnect** and re-select `rapidrescuegta/RetroRide` on branch `main`. This re-installs the deploy webhook.
3. Hit **Deploy → Redeploy** (or push any trivial commit — it will now trigger).
4. Verify: `curl -sI https://www.gamebuddi.com/sitemap.xml` → expect `HTTP/2 200`.
5. (Optional, lets the agent self-recover next time) run `railway login` on the agent host, or set a `RAILWAY_TOKEN` project token in the agent env so the CLI can trigger redeploys without the dashboard.

## What this unblocks (16 open next-steps)

Every queued cycle proposal — pricing-refactor (106), pricing-page (108), persona pages (109), GA4 injection (105), email/contact updates (120), SEO fundamentals (95), Cribbage pillar — is gated on shipping code through Railway. Until this is fixed, agent work on RetroRide is paused.

Tracked in Osminog as next-step `2e86b197-e0c5-4c2b-8fac-3ddde9c21b7f`.
