// ---------------------------------------------------------------------------
// Tournament data types matching the Prisma schema + API helpers
// ---------------------------------------------------------------------------

export interface TournamentMember {
  id: string
  name: string
  avatar: string
}

export interface TournamentEntryData {
  id: string
  tournamentId: string
  memberId: string
  gameId: string
  score: number
  placement: number
  points: number
  createdAt: string
  member?: TournamentMember
}

export interface Tournament {
  id: string
  name: string
  familyId: string
  gameIds: string[]
  status: string
  createdBy: string
  createdAt: string
  completedAt: string | null
  entries: TournamentEntryData[]
  creator?: TournamentMember
}

export interface StandingEntry {
  memberId: string
  memberName: string
  memberAvatar: string
  totalPoints: number
  gamesPlayed: number
  placements: Record<string, number>
  scores: Record<string, number>
}

// ---------------------------------------------------------------------------
// API helpers for fetching tournament data
// ---------------------------------------------------------------------------

export async function fetchTournaments(familyId: string, status?: string): Promise<Tournament[]> {
  const params = new URLSearchParams({ familyId })
  if (status) params.set('status', status)
  const res = await fetch(`/api/tournament?${params}`)
  const data = await res.json()
  return data.tournaments || []
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const res = await fetch(`/api/tournament/${id}`)
  const data = await res.json()
  return data.tournament || null
}

export async function createTournamentAPI(
  name: string,
  familyId: string,
  gameIds: string[],
  createdBy: string
): Promise<Tournament | null> {
  const res = await fetch('/api/tournament', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, familyId, gameIds, createdBy }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.tournament || null
}

export async function submitScore(
  tournamentId: string,
  memberId: string,
  gameId: string,
  score: number
): Promise<Tournament | null> {
  const res = await fetch('/api/tournament', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tournamentId, memberId, gameId, score }),
  })
  const data = await res.json()
  return data.tournament || null
}

export async function completeTournament(
  tournamentId: string,
  memberId: string
): Promise<Tournament | null> {
  const res = await fetch('/api/tournament', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', tournamentId, memberId }),
  })
  const data = await res.json()
  return data.tournament || null
}

export async function deleteTournamentAPI(
  tournamentId: string,
  memberId: string
): Promise<boolean> {
  const res = await fetch(`/api/tournament/${tournamentId}?memberId=${memberId}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  return data.success === true
}

// ---------------------------------------------------------------------------
// Elimination bracket types
// ---------------------------------------------------------------------------

export interface BracketParticipantData {
  id: string
  tournamentId: string
  memberId: string
  seed: number
  eliminated: boolean
  eliminatedAt: string | null
  eliminatedIn: number | null
  member?: TournamentMember
}

export interface BracketMatchData {
  id: string
  tournamentId: string
  round: number
  position: number
  player1Id: string | null
  player2Id: string | null
  winnerId: string | null
  loserId: string | null
  player1Score: number | null
  player2Score: number | null
  status: string
  roomCode: string | null
  startedAt: string | null
  completedAt: string | null
}

// ---------------------------------------------------------------------------
// Elimination bracket API helpers
// ---------------------------------------------------------------------------

export async function createEliminationTournament(
  name: string,
  familyId: string,
  gameId: string,
  createdBy: string,
  participantIds: string[]
): Promise<Tournament | null> {
  const res = await fetch('/api/tournament', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      familyId,
      gameId,
      createdBy,
      participantIds,
      format: 'elimination',
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.tournament || null
}

export async function startMatch(
  tournamentId: string,
  matchId: string,
  memberId: string
): Promise<{ match: BracketMatchData; roomCode: string }> {
  const res = await fetch(`/api/tournament/${tournamentId}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start-match', matchId, memberId }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function reportMatchResult(
  tournamentId: string,
  matchId: string,
  memberId: string,
  winnerId: string,
  player1Score?: number,
  player2Score?: number
): Promise<{
  match: BracketMatchData
  matches: BracketMatchData[]
  participants: BracketParticipantData[]
  tournamentComplete: boolean
}> {
  const res = await fetch(`/api/tournament/${tournamentId}/match`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'report-result',
      matchId,
      memberId,
      winnerId,
      player1Score,
      player2Score,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

export async function fetchBracketMatches(
  tournamentId: string
): Promise<BracketMatchData[]> {
  const res = await fetch(`/api/tournament/${tournamentId}/match?matchId=`)
  const data = await res.json()
  return data.matches || []
}

// ---------------------------------------------------------------------------
// Standings calculation (client-side)
// ---------------------------------------------------------------------------

export function calculateStandings(entries: TournamentEntryData[]): StandingEntry[] {
  const memberMap = new Map<string, StandingEntry>()

  for (const entry of entries) {
    if (!memberMap.has(entry.memberId)) {
      memberMap.set(entry.memberId, {
        memberId: entry.memberId,
        memberName: entry.member?.name || 'Unknown',
        memberAvatar: entry.member?.avatar || '',
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
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    const aFirsts = Object.values(a.placements).filter(p => p === 1).length
    const bFirsts = Object.values(b.placements).filter(p => p === 1).length
    if (bFirsts !== aFirsts) return bFirsts - aFirsts
    return b.gamesPlayed - a.gamesPlayed
  })
}
