# RetroRide — Full Setup & Usage Guide

This guide covers **every** way to run RetroRide: for developers, for a family LAN party, for plane trips, and for hosted production.

> **If you just want to play tonight on a live URL, use `docs/QUICK_START.md` — this guide is for deeper setups.**

---

## Table of Contents

1. [What is RetroRide?](#1-what-is-retroride)
2. [System Requirements](#2-system-requirements)
3. [Installation Paths](#3-installation-paths)
4. [Environment Variables Reference](#4-environment-variables-reference)
5. [Running Locally (Dev Mode)](#5-running-locally-dev-mode)
6. [Production Deploy (Railway)](#6-production-deploy-railway)
7. [Running on a Laptop for Hotspot / Plane Play](#7-running-on-a-laptop-for-hotspot--plane-play)
8. [Connecting Phones — All Three Modes](#8-connecting-phones--all-three-modes)
9. [Installing the PWA on iPhone / Android](#9-installing-the-pwa-on-iphone--android)
10. [Tournament Mode](#10-tournament-mode)
11. [Known Mobile Issues](#11-known-mobile-issues)
12. [Troubleshooting](#12-troubleshooting)
13. [TURN Server (optional)](#13-turn-server-optional)
14. [Updating the App](#14-updating-the-app)

---

## 1. What is RetroRide?

RetroRide (formerly GameBuddi) is a web-based retro arcade with **30 classic games** and **group multiplayer**. It runs in any modern browser on phone, tablet, or laptop. It installs as a Progressive Web App (PWA) so it launches like a native app.

**Multiplayer types:**
- **Card games** (14): Go Fish, Hearts, Spades, Poker, Blackjack, etc. — turn-based over WebRTC.
- **Turn-based board games** (4): Tic-Tac-Toe, Connect Four, Checkers, Chess.
- **Real-time score competitions** (12): Snake, Tetris, Pac-Man, etc. — everyone plays at once, highest score in the time limit wins.

**Connection modes:**
- **Online P2P (default):** 6-letter room codes, join from anywhere with internet.
- **Local (QR-based):** phones scan each other's QR codes; works without internet if all phones are on the same Wi-Fi/hotspot.
- **LAN (server-hosted):** one laptop runs the server, all phones connect to the laptop's IP on the same Wi-Fi.

---

## 2. System Requirements

**End-user devices:**
- iPhone iOS 14+ (Safari) or Android 9+ (Chrome).
- Any laptop/desktop with Chrome, Firefox, Edge, or Safari ≥ 14.
- Wi-Fi, hotspot, or cellular data.

**Host / developer machine:**
- Node.js **18+** (20 LTS recommended).
- npm **9+**.
- PostgreSQL **15+** (only required for the signaling relay; see the "laptop mode" section for an alternative).
- ~500 MB free disk for `node_modules`.
- Git.

---

## 3. Installation Paths

Pick the one that matches your goal:

| Goal | Path | Time |
|---|---|---|
| Everyone plays over internet today | Deploy to Railway (§6) | 10 min |
| Family plays over home Wi-Fi, no deploy | Laptop mode (§7) | 15 min |
| Plane trip / pure offline | Laptop + local-only mode (§7 + §8c) | 20 min |
| I want to develop / modify code | Dev mode (§5) | 15 min |

---

## 4. Environment Variables Reference

Copy `.env.example` to `.env` and fill these in. Full list:

### Required (for full production)
| Variable | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string. Used by signaling relay, leaderboards, tournaments, user records. |
| `STRIPE_SECRET_KEY` | Server-side Stripe API access. Leave `sk_test_…` for dev. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Safe-to-expose Stripe publishable key. |
| `STRIPE_PRICE_WEEKEND` / `_WEEKLY` / `_MONTHLY` / `_ANNUAL` | Price IDs from Stripe Dashboard. |
| `STRIPE_WEBHOOK_SECRET` | For verifying Stripe webhooks. |
| `NEXT_PUBLIC_APP_URL` | Public URL, no trailing slash. |

### Recommended
| Variable | What it does |
|---|---|
| `RESEND_API_KEY` | Sends transactional emails. Without it, emails are logged to console (fine for family use). |
| `EMAIL_FROM` | `RetroRide <noreply@yourdomain.com>` |
| `CRON_SECRET` | Protects `/api/cron/*` endpoints |

### Optional
| Variable | What it does |
|---|---|
| `TURN_SERVER_URL` / `_USERNAME` / `_CREDENTIAL` | Improves WebRTC reliability on strict corporate networks |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push notifications |

**For family/plane use, the only truly essential var is `DATABASE_URL`** (the signaling relay needs it). Everything else can stay blank or stubbed.

---

## 5. Running Locally (Dev Mode)

```bash
git clone <your-repo-url> retroride
cd retroride
cp .env.example .env

# Install Postgres locally, or use Docker:
docker run -d --name retroride-pg \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=retroride \
  -p 5432:5432 postgres:16

# Edit .env:
#   DATABASE_URL="postgresql://postgres:dev@localhost:5432/retroride"
#   (Stripe keys can stay as sk_test_... placeholders — payments won't work but app boots.)

npm install
npx prisma migrate dev
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

To test multiplayer locally: open two browser tabs (or one normal + one incognito), create a room in one, join from the other.

---

## 6. Production Deploy (Railway)

Full step-by-step in `docs/SETUP.md`. Summary:

1. Push repo to GitHub.
2. [railway.app](https://railway.app) → New Project → Deploy from GitHub → select your repo.
3. Add the **PostgreSQL** plugin (auto-populates `DATABASE_URL`).
4. In **Variables**, at minimum set `NEXT_PUBLIC_APP_URL` to the Railway-generated URL.
5. Wait for the first deploy (~2 min).
6. Custom domain: in Railway **Settings → Domains**, add `retroride.yourdomain.com` and update your DNS with the CNAME shown.

Stripe, Resend, VAPID are optional — see `docs/SETUP.md` for full walkthrough if you want payments or push notifications.

---

## 7. Running on a Laptop for Hotspot / Plane Play

**This is the mode for family road trips and flights.**

### One-time setup on the laptop

Same as Dev Mode (§5). Once it works locally, proceed.

### On the road

1. Turn on the laptop's Wi-Fi hotspot, **or** tether the laptop to a phone hotspot.
2. Find the laptop's IP on the shared network:
   - macOS: `ipconfig getifaddr en0`
   - Linux: `hostname -I`
   - Windows: `ipconfig` → look for IPv4 address
3. Start the server: `npm start` (or `npm run dev`).
4. All phones connect to the hotspot, then open `http://<laptop-ip>:3000` in their browser.

**On a plane:** this is the most reliable setup. A laptop with a full charge, hotspot tethering from a phone, and the family connects to the phone's hotspot. The signaling relay runs on the laptop over the LAN — no airline Wi-Fi needed.

### Known limitations of this setup
- Every phone must be able to reach the laptop's IP on the hotspot network. Some phone hotspots isolate clients (client-to-client disabled) — if so, **toggle "Max Compatibility" mode** in hotspot settings.
- Safari on iPhone sometimes refuses to load `http://` (non-HTTPS) URLs for PWAs. Workaround: use it as a browser tab (don't install as PWA) or run the laptop over HTTPS with a self-signed cert + trusted device profile.

---

## 8. Connecting Phones — All Three Modes

### 8a. Online P2P (default, easiest)
- Host: **Multiplayer → Create Room** → share the 6-letter code.
- Joiners: **Multiplayer → Join Room** → enter the code.
- Needs internet for the *initial handshake only*; actual gameplay is direct P2P.

### 8b. LAN mode (laptop/hotspot server)
- Same flow as 8a but everyone's browser is pointed at `http://<laptop-ip>:3000` instead of the public URL.
- Handshake stays inside the hotspot — works even with zero internet, as long as the laptop's Postgres is running.

### 8c. Local QR mode (no server at all)
- Host: **Multiplayer → Play on Same Network → Host (QR)** — a QR code appears.
- Joiner: **Multiplayer → Play on Same Network → Join (Scan)** — points their camera at the QR.
- The joiner then shows a QR back that the host must scan.
- Works fully offline with no laptop/server. All devices must be on the same Wi-Fi or hotspot network.
- **Downside on a plane:** you have to physically pass the phone around or be close enough to scan QRs. Not ideal if the family is scattered across aisles.

---

## 9. Installing the PWA on iPhone / Android

### iPhone (Safari)
1. Open the RetroRide URL in **Safari** (not Chrome — only Safari can install iOS PWAs).
2. Tap the **Share** icon (square with up arrow).
3. Scroll and tap **Add to Home Screen**.
4. Name it "RetroRide" and tap **Add**.

### Android (Chrome)
1. Open the URL in Chrome.
2. Tap **⋮** (menu) → **Install app** or **Add to Home Screen**.
3. Confirm.

Once installed, it launches like a native app (full-screen, no browser bar). Scores and settings are saved locally.

---

## 10. Tournament Mode

RetroRide supports two tournament formats:

### Score Competition (`/tournaments`)
- Everyone plays the same real-time game (e.g., Tetris, Pac-Man) for a fixed time limit.
- Scores auto-submit at the end.
- Highest score wins; tie-break is head-to-head.

### Single-Elimination Bracket
- Up to 16 players.
- Bracket is auto-generated from the lobby.
- Winners advance; losers watch as spectators.

Both formats use the same room/lobby flow from §8. The host sets up the tournament at `/tournaments`, picks a preset (e.g., "Family Night", "Kids' Champion"), and invites the family.

---

## 11. Known Mobile Issues

| Game | Issue | Workaround |
|---|---|---|
| **Wordle** | Keyboard-only; no on-screen letter buttons | Play on laptop, or use a different word game |
| **Hangman** | Same — physical keyboard required | Play on laptop |
| **Doodle Jump** | D-pad overlay missing on mobile | Play on laptop |
| **Any game on iOS Safari < 14** | WebRTC unreliable | Update iOS |

The other **27 games work on phone**. A developer can add virtual keyboards to Wordle/Hangman and enable the D-pad for Doodle Jump; see the audit in `NEXT_STEPS.md`.

---

## 12. Troubleshooting

### "Room not found or has expired"
- Rooms expire after 2 hours. Create a new one.
- Host and joiner must be on the same deployed version — if you just redeployed, everyone should refresh their browser / relaunch the PWA.

### Lobby spins forever at "Waiting for players…"
- The signaling server (`/api/signal`) is unreachable. Check:
  - Does the URL load at all on the joiner's phone?
  - Is DATABASE_URL set correctly on the server?
  - In dev, is `npx prisma migrate dev` run?

### "Connection timed out - the host may be behind a strict firewall"
- WebRTC can't punch through. Try the same Wi-Fi for both devices, or configure a TURN server (§13).

### PWA won't install
- iPhone: must use Safari, not Chrome.
- Chrome: check `chrome://flags` — "PWA install" shouldn't be disabled.
- The site must be HTTPS (or localhost). HTTP on a LAN IP won't install.

### Scores don't save
- Local scores are in `localStorage`; clearing browser data wipes them.
- Family leaderboards need Postgres; check the server logs.

### Audio/music issues
- iOS requires a user gesture before playing audio; tap once on the screen first.
- Silent mode on iPhone mutes web audio.

---

## 13. TURN Server (optional)

Only needed if ~10% of your players can't connect (strict corporate/university networks, symmetric NATs).

**Free option (built-in fallback):** `openrelay.metered.ca` is used automatically if no TURN is configured. Rate-limited but fine for casual play.

**Paid option:** Sign up at [metered.ca/stun-turn](https://www.metered.ca/stun-turn), get credentials, set in `.env`:
```env
TURN_SERVER_URL="turn:global.relay.metered.ca:443?transport=tcp"
TURN_SERVER_USERNAME="your-user"
TURN_SERVER_CREDENTIAL="your-secret"
```

Restart the server.

---

## 14. Updating the App

### Production (Railway)
Push to GitHub. Railway auto-deploys. Users get the update next time they relaunch the PWA (service worker fetches the new version).

### Local dev
```bash
git pull
npm install
npx prisma migrate dev
npm run dev
```

### Forcing a PWA update on a phone
- Android: settings → apps → RetroRide → clear cache.
- iPhone: delete from home screen and re-add.

---

**End of guide.** Questions / issues → see `docs/SETUP.md` for deployment specifics or `NEXT_STEPS.md` for the current roadmap.
