'use client'

import { useMemo } from 'react'
import { getRoundName, totalRounds as calcTotalRounds } from '@/lib/bracket'
import type { BracketMatchData, BracketParticipantData } from '@/lib/tournament-store'

// ─── Types ──────────────────────────────────────────────────────────────

interface EliminationBracketProps {
  matches: BracketMatchData[]
  participants: BracketParticipantData[]
  bracketSize: number
  currentUserId?: string
  onMatchClick?: (match: BracketMatchData) => void
}

// ─── Helpers ────────────────────────────────────────────────────────────

function getPlayerName(
  playerId: string | null,
  participants: BracketParticipantData[]
): { name: string; avatar: string; seed: number } | null {
  if (!playerId) return null
  const p = participants.find(pp => pp.memberId === playerId)
  if (!p) return null
  return {
    name: p.member?.name || 'Unknown',
    avatar: p.member?.avatar || '😀',
    seed: p.seed,
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'in-progress':
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          LIVE
        </span>
      )
    case 'ready':
      return (
        <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider">
          VS
        </span>
      )
    case 'completed':
      return (
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
          DONE
        </span>
      )
    case 'bye':
      return (
        <span className="text-[9px] font-bold text-amber-500/60 uppercase tracking-wider">
          BYE
        </span>
      )
    default:
      return (
        <span className="text-[9px] text-slate-600 uppercase tracking-wider">
          TBD
        </span>
      )
  }
}

// ─── Match Card ─────────────────────────────────────────────────────────

function MatchCard({
  match,
  participants,
  currentUserId,
  onClick,
}: {
  match: BracketMatchData
  participants: BracketParticipantData[]
  currentUserId?: string
  onClick?: () => void
}) {
  const p1 = getPlayerName(match.player1Id, participants)
  const p2 = getPlayerName(match.player2Id, participants)
  const isLive = match.status === 'in-progress'
  const isReady = match.status === 'ready'
  const isMyMatch =
    match.player1Id === currentUserId || match.player2Id === currentUserId
  const canClick = onClick && (isLive || isReady) && isMyMatch

  const borderColor = isLive
    ? 'border-emerald-500/50'
    : isReady && isMyMatch
      ? 'border-cyan-500/50'
      : 'border-slate-700/40'

  const bgColor = isLive
    ? 'bg-emerald-500/5'
    : isReady && isMyMatch
      ? 'bg-cyan-500/5'
      : 'bg-slate-800/30'

  return (
    <div
      className={`rounded-lg border ${borderColor} ${bgColor} overflow-hidden transition-all ${
        canClick ? 'cursor-pointer hover:scale-[1.02] hover:border-cyan-400/60' : ''
      }`}
      style={{ width: 180 }}
      onClick={canClick ? onClick : undefined}
    >
      {/* Player 1 */}
      <PlayerRow
        player={p1}
        score={match.player1Score}
        isWinner={match.winnerId === match.player1Id}
        isLoser={match.loserId === match.player1Id}
        isCurrent={match.player1Id === currentUserId}
        matchStatus={match.status}
      />

      {/* Divider with status */}
      <div className="flex items-center justify-center py-0.5 bg-slate-900/50 border-y border-slate-700/20">
        {statusBadge(match.status)}
      </div>

      {/* Player 2 */}
      <PlayerRow
        player={p2}
        score={match.player2Score}
        isWinner={match.winnerId === match.player2Id}
        isLoser={match.loserId === match.player2Id}
        isCurrent={match.player2Id === currentUserId}
        matchStatus={match.status}
      />
    </div>
  )
}

function PlayerRow({
  player,
  score,
  isWinner,
  isLoser,
  isCurrent,
  matchStatus,
}: {
  player: { name: string; avatar: string; seed: number } | null
  score: number | null
  isWinner: boolean
  isLoser: boolean
  isCurrent: boolean
  matchStatus: string
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-2 px-2.5 py-2 min-h-[36px]">
        <span className="text-xs text-slate-600 italic">TBD</span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-2 min-h-[36px] ${
        isWinner
          ? 'bg-emerald-500/10'
          : isLoser
            ? 'opacity-40'
            : isCurrent
              ? 'bg-purple-500/5'
              : ''
      }`}
    >
      <span className="text-[10px] text-slate-500 w-3 text-right font-mono">
        {player.seed}
      </span>
      <span className="text-sm">{player.avatar}</span>
      <span
        className={`text-xs font-medium truncate flex-1 ${
          isWinner
            ? 'text-emerald-300'
            : isLoser
              ? 'text-slate-500 line-through'
              : isCurrent
                ? 'text-purple-300'
                : 'text-slate-300'
        }`}
      >
        {player.name}
      </span>
      {isWinner && <span className="text-xs">🏒</span>}
      {score !== null && matchStatus === 'completed' && (
        <span className="text-[10px] text-amber-400 font-bold tabular-nums">
          {score}
        </span>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function EliminationBracket({
  matches,
  participants,
  bracketSize,
  currentUserId,
  onMatchClick,
}: EliminationBracketProps) {
  const numRounds = calcTotalRounds(bracketSize)

  // Group matches by round
  const rounds = useMemo(() => {
    const grouped: Record<number, BracketMatchData[]> = {}
    for (let r = 1; r <= numRounds; r++) {
      grouped[r] = matches
        .filter(m => m.round === r)
        .sort((a, b) => a.position - b.position)
    }
    return grouped
  }, [matches, numRounds])

  return (
    <div className="space-y-4">
      {/* Round headers + bracket */}
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        style={{ scrollbarWidth: 'thin' }}
      >
        {Array.from({ length: numRounds }, (_, i) => i + 1).map(round => {
          const roundMatches = rounds[round] || []
          const roundName = getRoundName(round, numRounds)
          const isCurrent = roundMatches.some(
            m => m.status === 'ready' || m.status === 'in-progress'
          )

          return (
            <div key={round} className="flex-shrink-0 flex flex-col items-center">
              {/* Round header */}
              <div className="mb-3 text-center">
                <p
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isCurrent ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                >
                  {roundName}
                </p>
                {isCurrent && (
                  <div className="w-8 h-0.5 mx-auto mt-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full" />
                )}
              </div>

              {/* Match cards with spacing to align with bracket lines */}
              <div
                className="flex flex-col items-center"
                style={{
                  gap: `${Math.pow(2, round - 1) * 16}px`,
                  paddingTop: `${(Math.pow(2, round - 1) - 1) * 28}px`,
                }}
              >
                {roundMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    currentUserId={currentUserId}
                    onClick={
                      onMatchClick ? () => onMatchClick(match) : undefined
                    }
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Ready
        </span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" /> Pending
        </span>
        <span>🏒 = winner advances</span>
      </div>
    </div>
  )
}
