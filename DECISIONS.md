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
