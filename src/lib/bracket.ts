/**
 * Elimination bracket engine.
 *
 * Generates NHL-playoff-style single-elimination brackets with:
 *   - Proper seeding (1 vs 16, 2 vs 15, etc.)
 *   - Automatic byes when player count isn't a power of 2
 *   - Winner advancement to the next round
 *   - Round naming (First Round → Quarterfinals → Semifinals → Final)
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface BracketSlot {
  round: number
  position: number
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  loserId: string | null
  status: 'pending' | 'ready' | 'in-progress' | 'completed' | 'bye'
}

export interface Participant {
  memberId: string
  seed: number
}

// ─── Utilities ──────────────────────────────────────────────────────────

/** Returns the smallest power of 2 that is >= n. */
export function nextPowerOf2(n: number): number {
  if (n <= 1) return 1
  let p = 1
  while (p < n) p *= 2
  return p
}

/** Total number of rounds for a bracket of this size. */
export function totalRounds(bracketSize: number): number {
  return Math.log2(bracketSize)
}

/**
 * Returns the human-readable name for a round.
 * Uses hockey playoff terminology.
 */
export function getRoundName(round: number, numRounds: number): string {
  const fromFinal = numRounds - round
  if (fromFinal === 0) return 'Final'
  if (fromFinal === 1) return 'Semifinals'
  if (fromFinal === 2) return 'Quarterfinals'
  if (fromFinal === 3) return 'First Round'
  return `Round ${round}`
}

// ─── Seeding ────────────────────────────────────────────────────────────

/**
 * Creates the standard tournament seeding order for a bracket.
 * Seed 1 plays the lowest seed, seed 2 plays the second lowest, etc.
 * This ensures top seeds don't meet until later rounds.
 *
 * For an 8-player bracket: [1,8], [4,5], [2,7], [3,6]
 */
function generateSeedPairings(bracketSize: number): [number, number][] {
  // Build recursively like a real tournament bracket
  function buildOrder(size: number): number[] {
    if (size === 1) return [1]
    const half = buildOrder(size / 2)
    const result: number[] = []
    for (const seed of half) {
      result.push(seed, size + 1 - seed)
    }
    return result
  }

  const order = buildOrder(bracketSize)
  const pairings: [number, number][] = []
  for (let i = 0; i < order.length; i += 2) {
    pairings.push([order[i], order[i + 1]])
  }
  return pairings
}

// ─── Bracket Generation ────────────────────────────────────────────────

/**
 * Generates a complete elimination bracket.
 *
 * @param participants - Players with their seed numbers (1 = top seed)
 * @param bracketSize - Must be a power of 2 (>= participant count)
 * @returns Array of BracketSlot for all rounds
 */
export function generateBracket(
  participants: Participant[],
  bracketSize: number
): BracketSlot[] {
  const numRounds = totalRounds(bracketSize)
  const matchesInRound1 = bracketSize / 2
  const slots: BracketSlot[] = []

  // Map seed numbers to member IDs
  const seedToPlayer = new Map<number, string>()
  for (const p of participants) {
    seedToPlayer.set(p.seed, p.memberId)
  }

  // Generate first-round matchups using standard seeding
  const pairings = generateSeedPairings(bracketSize)

  for (let pos = 0; pos < matchesInRound1; pos++) {
    const [seed1, seed2] = pairings[pos]
    const p1 = seedToPlayer.get(seed1) ?? null
    const p2 = seedToPlayer.get(seed2) ?? null

    const isBye = !p1 || !p2

    slots.push({
      round: 1,
      position: pos,
      player1Id: p1,
      player2Id: p2,
      winnerId: isBye ? (p1 || p2) : null,
      loserId: null,
      status: isBye ? 'bye' : 'ready',
    })
  }

  // Generate placeholder slots for subsequent rounds
  for (let round = 2; round <= numRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round)
    for (let pos = 0; pos < matchesInRound; pos++) {
      slots.push({
        round,
        position: pos,
        player1Id: null,
        player2Id: null,
        winnerId: null,
        loserId: null,
        status: 'pending',
      })
    }
  }

  // Auto-advance bye winners into round 2
  const round1Byes = slots.filter(s => s.round === 1 && s.status === 'bye')
  for (const bye of round1Byes) {
    if (bye.winnerId) {
      advanceWinnerInSlots(slots, bye.round, bye.position, bye.winnerId)
    }
  }

  return slots
}

// ─── Advancement ───────────────────────────────────────────────────────

/**
 * Given a completed match, returns the next round/position the winner goes to.
 */
export function getNextMatchPosition(
  round: number,
  position: number
): { round: number; position: number; slot: 'player1' | 'player2' } {
  const nextRound = round + 1
  const nextPosition = Math.floor(position / 2)
  // Even positions feed into player1, odd positions feed into player2
  const slot = position % 2 === 0 ? 'player1' : 'player2'
  return { round: nextRound, position: nextPosition, slot }
}

/**
 * Places a winner into the correct slot of the next round's match.
 * Mutates the slots array in place.
 * Returns the next match slot (or null if this was the final).
 */
function advanceWinnerInSlots(
  slots: BracketSlot[],
  completedRound: number,
  completedPosition: number,
  winnerId: string
): BracketSlot | null {
  const next = getNextMatchPosition(completedRound, completedPosition)
  const nextMatch = slots.find(
    s => s.round === next.round && s.position === next.position
  )

  if (!nextMatch) return null // Was the final

  if (next.slot === 'player1') {
    nextMatch.player1Id = winnerId
  } else {
    nextMatch.player2Id = winnerId
  }

  // If both players are now set, mark the match as ready
  if (nextMatch.player1Id && nextMatch.player2Id) {
    nextMatch.status = 'ready'
  }

  return nextMatch
}

/**
 * Advances a winner through the bracket after a match completes.
 * Call this after recording a match result.
 *
 * @returns The updated next match, or null if the tournament is over.
 */
export function advanceWinner(
  slots: BracketSlot[],
  completedRound: number,
  completedPosition: number,
  winnerId: string
): BracketSlot | null {
  return advanceWinnerInSlots(slots, completedRound, completedPosition, winnerId)
}

// ─── Queries ───────────────────────────────────────────────────────────

/** Find a player's current/next match in the bracket. */
export function findPlayerMatch(
  slots: BracketSlot[],
  playerId: string
): BracketSlot | null {
  // Find the latest non-completed match for this player
  return slots.find(
    s =>
      (s.player1Id === playerId || s.player2Id === playerId) &&
      (s.status === 'ready' || s.status === 'in-progress')
  ) ?? null
}

/** Check if the tournament is complete (final match decided). */
export function isBracketComplete(slots: BracketSlot[]): boolean {
  const maxRound = Math.max(...slots.map(s => s.round))
  const finalMatch = slots.find(s => s.round === maxRound)
  return finalMatch?.status === 'completed'
}

/** Get the champion (winner of the final match). */
export function getChampion(slots: BracketSlot[]): string | null {
  const maxRound = Math.max(...slots.map(s => s.round))
  const finalMatch = slots.find(s => s.round === maxRound)
  return finalMatch?.winnerId ?? null
}

/** Filter for 2-player-compatible games from the registry. */
export function isEliminationCompatible(minPlayers: number): boolean {
  return minPlayers <= 2
}
