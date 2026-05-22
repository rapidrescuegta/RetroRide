# 🚨 DEPLOY PIPELINE STALLED — Railway auto-deploy disconnected

**Status (2026-05-21):** Last successful deploy was **2026-05-14 or earlier**.
Two commits sit on `origin/main` with no Railway redeploy triggered:

- `0e662ec` — Remove dynamic sitemap/robots routes (prerendering as 404)
- `431c790` — Add static `public/sitemap.xml` + `public/robots.txt` fallback

## Evidence

```
$ curl -sI https://www.gamebuddi.com/sitemap.xml
HTTP/2 404
etag: "nlao1hgvr28hf"        ← unchanged across 7 days + 2 pushes
x-nextjs-cache: HIT          ← serving stale prerender of a route that no longer exists in source
```

The site root and other `public/` assets (`manifest.json`, `sw.js`, `favicon.ico`) return 200 — app is healthy. **Only the build is frozen.**

## Fix (Giuseppe, ~60 sec)

1. Open Railway → `retroride` service → **Settings → GitHub**
2. Verify the repo connection is still active. If not, reconnect to `rapidrescuegta/RetroRide` on `main`.
3. Hit **Deploy → Redeploy latest commit** (or push any trivial commit).
4. Verify: `curl -sI https://www.gamebuddi.com/sitemap.xml` → expect `HTTP/2 200`.

## What this unblocks (16 open next-steps)

Every queued cycle proposal — pricing-refactor (106), pricing-page (108), persona pages (109), GA4 injection (105), email/contact updates (120), SEO fundamentals (95), Cribbage pillar — is gated on shipping code through Railway. Until this is fixed, agent work on RetroRide is paused.

Tracked in Osminog as next-step `2e86b197-e0c5-4c2b-8fac-3ddde9c21b7f`.
