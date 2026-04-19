// ─── Tournament Utilities ────────────────────────────────────────────
// Points system: 1st place = 3pts, 2nd = 2pts, 3rd = 1pt per game

export interface TournamentEntryData {
  id: string
  tournamentId: string
  memberId: string
  gameId: string
  score: number
  placement: number
  points: number
  member?: {
    id: string
    name: string
    avatar: string
  }
}

export interface TournamentData {
  id: string
  name: string
  familyId: string
  gameIds: string[]
  status: string
  createdBy: string
  createdAt: string
  completedAt: string | null
  entries: TournamentEntryData[]
  creator?: {
    id: string
    name: string
    avatar: string
  }
}

export interface StandingEntry {
  memberId: string
  memberName: string
  memberAvatar: string
  totalPoints: number
  gamesPlayed: number
  placements: Record<string, number> // gameId -> placement
  scores: Record<string, number> // gameId -> score
}

// ─── Timed Round Support ──────────────────────────────────────────────

export interface TimedRound {
  gameId: string
  durationSeconds: number
  startedAt?: number
  endedAt?: number
}

export interface TimedTournamentConfig {
  rounds: TimedRound[]
  currentRoundIndex: number
}

/**
 * Create a timed tournament config from game IDs and duration
 */
export function createTimedConfig(
  gameIds: string[],
  durationSeconds: number
): TimedTournamentConfig {
  return {
    rounds: gameIds.map((gameId) => ({
      gameId,
      durationSeconds,
    })),
    currentRoundIndex: 0,
  }
}

/**
 * Start a timed round — sets startedAt to current timestamp
 */
export function startTimedRound(round: TimedRound): TimedRound {
  return { ...round, startedAt: Date.now() }
}

/**
 * Get remaining seconds for a timed round. Returns 0 if expired.
 */
export function getRemainingSeconds(round: TimedRound): number {
  if (!round.startedAt) return round.durationSeconds
  const elapsed = Math.floor((Date.now() - round.startedAt) / 1000)
  return Math.max(0, round.durationSeconds - elapsed)
}

/**
 * Check whether a timed round has expired
 */
export function isRoundExpired(round: TimedRound): boolean {
  return getRemainingSeconds(round) <= 0
}

/**
 * Format seconds as MM:SS display string
 */
export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const PLACEMENT_POINTS: Record<number, number> = {
  1: 3,
  2: 2,
  3: 1,
}

/**
 * Calculate points for a given placement (1st=3, 2nd=2, 3rd=1, rest=0)
 */
export function getPointsForPlacement(placement: number): number {
  return PLACEMENT_POINTS[placement] || 0
}

/**
 * Given all entries for a tournament, calculate overall standings
 * sorted by total points descending.
 */
export function calculateStandings(entries: TournamentEntryData[]): StandingEntry[] {
  const memberMap = new Map<string, StandingEntry>()

  for (const entry of entries) {
    if (!memberMap.has(entry.memberId)) {
      memberMap.set(entry.memberId, {
        memberId: entry.memberId,
        memberName: entry.member?.name || 'Unknown',
        memberAvatar: entry.member?.avatar || '😀',
        totalPoints: 0,
        gamesPlayed: 0,
        placements: {},
        scores: {},
      })
    }

    const standing = memberMap.get(entry.memberId)!
    standing.totalPoints += entry.points
    standing.gamesPlayed += 1
    standing.placements[entry.gameId] = entry.placement
    standing.scores[entry.gameId] = entry.score
  }

  return Array.from(memberMap.values()).sort((a, b) => {
    // Sort by total points descending, then by number of 1st places, then games played
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    const aFirsts = Object.values(a.placements).filter(p => p === 1).length
    const bFirsts = Object.values(b.placements).filter(p => p === 1).length
    if (bFirsts !== aFirsts) return bFirsts - aFirsts
    return b.gamesPlayed - a.gamesPlayed
  })
}

/**
 * Get how many games each player has completed out of total games in tournament
 */
export function getTournamentProgress(
  tournament: TournamentData
): Record<string, { completed: number; total: number }> {
  const totalGames = tournament.gameIds.length
  const progress: Record<string, { completed: number; total: number }> = {}

  for (const entry of tournament.entries) {
    if (!progress[entry.memberId]) {
      progress[entry.memberId] = { completed: 0, total: totalGames }
    }
    progress[entry.memberId].completed += 1
  }

  return progress
}

/**
 * Check if all expected players have played all games.
 * We consider it complete if every unique member has an entry for every gameId.
 */
export function isTournamentComplete(tournament: TournamentData): boolean {
  const memberIds = new Set(tournament.entries.map(e => e.memberId))
  if (memberIds.size === 0) return false

  for (const memberId of memberIds) {
    const memberGameIds = new Set(
      tournament.entries.filter(e => e.memberId === memberId).map(e => e.gameId)
    )
    for (const gameId of tournament.gameIds) {
      if (!memberGameIds.has(gameId)) return false
    }
  }

  return true
}

/**
 * Given raw scores for a single game (memberId -> score), calculate placements.
 * Higher score = better placement.
 */
export function calculatePlacements(
  scores: { memberId: string; score: number }[]
): { memberId: string; score: number; placement: number; points: number }[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score)
  return sorted.map((entry, index) => ({
    ...entry,
    placement: index + 1,
    points: getPointsForPlacement(index + 1),
  }))
}
