# Next Steps — RetroRide / GameBuddi

_Last updated: 2026-04-16_

## Roadmap

1. **More card games** — expand the card library beyond the existing 14.
   - Adding **Snap** (fast-paced, family-friendly, 2-player slap-the-match).
2. **Tournament mode enhancements** — new presets that showcase the new games and better tie-breaking.
   - New "Snap & Slap" and "Kids' Champion" presets.
   - Tie-break rule: head-to-head score wins when tied on points.
3. **PWA improvements** — stay installable, offline-ready, and snappy.
   - Bump Service Worker cache version (v18) to include new game routes.
   - Add Snap to manifest shortcuts + SW precache + offline-games list.
4. **Full software test pass** — after steps 1–3 are done, run through the app end-to-end:
   - `npm run build` (type-check + production bundle).
   - `npx next lint` (code quality).
   - Smoke-test key routes: `/`, `/play/snap`, `/tournaments`, `/family`.
   - Verify service worker precaches the new game.
   - **Report back with a summary of what works and anything that still needs attention.**
5. **Live test (Giuseppe)** — after the report, Giuseppe tests live on device.

## Out of scope for this pass
- Double-elimination bracket (already have single-elim playoff bracket).
- Swiss-system pairing.
- New AI difficulty tiers on existing games.
