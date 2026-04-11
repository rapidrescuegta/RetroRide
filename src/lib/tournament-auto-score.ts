/**
 * Auto-submit scores to active tournaments when a game finishes.
 *
 * When a player completes a game that's part of an active tournament,
 * this module automatically submits their score — no manual entry needed.
 */

import { submitScore, type Tournament } from '@/lib/tournament-store'

/** Cache of active tournaments for the current family. */
let activeTournaments: Tournament[] | null = null
let lastFetched = 0
const CACHE_TTL = 60_000 // 1 minute

/**
 * Fetches active tournaments for the given family, with caching.
 */
async function getActiveTournaments(familyId: string): Promise<Tournament[]> {
  const now = Date.now()
  if (activeTournaments && now - lastFetched < CACHE_TTL) {
    return activeTournaments
  }

  try {
    const res = await fetch(`/api/tournament?familyId=${familyId}&status=active`)
    const data = await res.json()
    activeTournaments = data.tournaments || []
    lastFetched = now
    return activeTournaments!
  } catch {
    return activeTournaments || []
  }
}

/**
 * Invalidate the cache so the next call fetches fresh data.
 */
export function invalidateTournamentCache(): void {
  activeTournaments = null
  lastFetched = 0
}

/**
 * Auto-submit a score to any active tournaments that include this game.
 *
 * Call this from the game-over handler. It runs in the background and
 * won't block the UI or throw errors.
 *
 * @returns The number of tournaments the score was submitted to.
 */
export async function autoSubmitTournamentScore(
  familyId: string,
  memberId: string,
  gameId: string,
  score: number
): Promise<number> {
  try {
    const tournaments = await getActiveTournaments(familyId)
    let submitted = 0

    for (const tournament of tournaments) {
      // Only submit if this game is part of the tournament
      if (!tournament.gameIds.includes(gameId)) continue

      // Check if the player already has a score for this game in this tournament
      const existingEntry = tournament.entries.find(
        (e) => e.memberId === memberId && e.gameId === gameId
      )

      // Only submit if this score is better than the existing one (or no entry exists)
      if (existingEntry && existingEntry.score >= score) continue

      try {
        await submitScore(tournament.id, memberId, gameId, score)
        submitted++
        // Invalidate cache since tournament data changed
        invalidateTournamentCache()
      } catch {
        // Individual submission failure is non-fatal
      }
    }

    return submitted
  } catch {
    return 0
  }
}
