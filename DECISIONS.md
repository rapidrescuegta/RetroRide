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
