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
