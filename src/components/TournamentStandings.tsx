'use client'

import { useState } from 'react'
import { type StandingEntry } from '@/lib/tournament-store'

type SortField = 'rank' | 'totalPoints' | 'gamesPlayed'

interface TournamentStandingsProps {
  standings: StandingEntry[]
  totalGames?: number
  currentUserId?: string
}

const MEDALS: Record<number, { icon: string; label: string; glow: string; bg: string; border: string }> = {
  1: {
    icon: '\u{1F947}',
    label: '1st Place',
    glow: 'shadow-amber-500/20',
    bg: 'bg-gradient-to-r from-amber-500/15 to-yellow-500/10',
    border: 'border-amber-500/30',
  },
  2: {
    icon: '\u{1F948}',
    label: '2nd Place',
    glow: 'shadow-slate-400/10',
    bg: 'bg-gradient-to-r from-slate-400/10 to-slate-300/5',
    border: 'border-slate-400/20',
  },
  3: {
    icon: '\u{1F949}',
    label: '3rd Place',
    glow: 'shadow-amber-700/10',
    bg: 'bg-gradient-to-r from-amber-700/10 to-orange-600/5',
    border: 'border-amber-700/20',
  },
}

export default function TournamentStandings({
  standings,
  totalGames = 0,
  currentUserId,
}: TournamentStandingsProps) {
  const [sortBy, setSortBy] = useState<SortField>('totalPoints')

  const sorted = [...standings].sort((a, b) => {
    switch (sortBy) {
      case 'gamesPlayed':
        return b.gamesPlayed - a.gamesPlayed || b.totalPoints - a.totalPoints
      case 'totalPoints':
      default:
        return b.totalPoints - a.totalPoints || b.gamesPlayed - a.gamesPlayed
    }
  })

  // Find max points for relative bar sizing
  const maxPoints = sorted.length > 0 ? sorted[0].totalPoints : 1

  if (standings.length === 0) {
    return (
      <div className="text-center py-10">
        <span className="text-4xl block mb-3">{'\u{1F3C6}'}</span>
        <p className="text-slate-400 text-sm font-medium">No standings yet</p>
        <p className="text-slate-500 text-xs mt-1">Submit scores to see the leaderboard!</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-3">
      {/* Podium for top 3 (when 3+ players) */}
      {sorted.length >= 3 && (
        <div className="flex items-end justify-center gap-3 pt-4 pb-2 px-2">
          {/* 2nd place */}
          <PodiumCard entry={sorted[1]} rank={2} isCurrentUser={sorted[1].memberId === currentUserId} />
          {/* 1st place (taller) */}
          <PodiumCard entry={sorted[0]} rank={1} isCurrentUser={sorted[0].memberId === currentUserId} />
          {/* 3rd place */}
          <PodiumCard entry={sorted[2]} rank={3} isCurrentUser={sorted[2].memberId === currentUserId} />
        </div>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Sort by:</span>
        {([
          { field: 'totalPoints' as SortField, label: 'Points' },
          { field: 'gamesPlayed' as SortField, label: 'Games' },
        ]).map(opt => (
          <button
            key={opt.field}
            onClick={() => setSortBy(opt.field)}
            className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
              sortBy === opt.field
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Full standings list */}
      <div className="space-y-2">
        {sorted.map((entry, idx) => {
          const rank = idx + 1
          const medal = MEDALS[rank]
          const isCurrentUser = entry.memberId === currentUserId
          const progressPercent = totalGames > 0
            ? Math.round((entry.gamesPlayed / totalGames) * 100)
            : 0
          const pointsPercent = maxPoints > 0 ? (entry.totalPoints / maxPoints) * 100 : 0
          const firstPlaces = Object.values(entry.placements).filter(p => p === 1).length

          return (
            <div
              key={entry.memberId}
              className={`relative rounded-xl border overflow-hidden transition-all ${
                isCurrentUser
                  ? 'border-purple-500/40 bg-purple-500/5 shadow-lg shadow-purple-500/10'
                  : medal
                    ? `${medal.border} ${medal.bg} ${medal.glow}`
                    : 'border-slate-700/30 bg-slate-800/20'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Rank / Medal */}
                <div className="w-8 text-center flex-shrink-0">
                  {medal ? (
                    <span className="text-xl">{medal.icon}</span>
                  ) : (
                    <span className="text-sm font-bold text-slate-500">#{rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <span className="text-2xl flex-shrink-0">{entry.memberAvatar}</span>

                {/* Player info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold truncate ${
                      isCurrentUser ? 'text-purple-300' : 'text-white'
                    }`}>
                      {entry.memberName}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[9px] font-bold text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        YOU
                      </span>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] text-slate-500">
                      {entry.gamesPlayed} game{entry.gamesPlayed !== 1 ? 's' : ''}
                    </span>
                    {firstPlaces > 0 && (
                      <span className="text-[10px] text-amber-400">
                        {'\u{1F451}'} {firstPlaces} win{firstPlaces !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Points progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        rank === 1
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                          : rank === 2
                            ? 'bg-gradient-to-r from-slate-400 to-slate-300'
                            : rank === 3
                              ? 'bg-gradient-to-r from-amber-700 to-orange-500'
                              : 'bg-gradient-to-r from-purple-500 to-cyan-400'
                      }`}
                      style={{ width: `${pointsPercent}%` }}
                    />
                  </div>
                </div>

                {/* Points */}
                <div className="text-right flex-shrink-0">
                  <span className={`text-lg font-bold tabular-nums ${
                    rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : rank === 3 ? 'text-amber-600' : 'text-white'
                  }`}>
                    {entry.totalPoints}
                  </span>
                  <span className="text-[10px] text-slate-500 block">pts</span>
                </div>
              </div>

              {/* Completion progress (if totalGames provided) */}
              {totalGames > 0 && (
                <div className="px-4 pb-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-slate-500">Completion</span>
                    <span className={progressPercent === 100 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                      {progressPercent}%
                    </span>
                  </div>
                  <div className="h-1 bg-slate-800/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        progressPercent === 100
                          ? 'bg-emerald-500'
                          : 'bg-slate-500'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Podium Card (mini display for top 3) ─────────────────────────────

function PodiumCard({
  entry,
  rank,
  isCurrentUser,
}: {
  entry: StandingEntry
  rank: number
  isCurrentUser: boolean
}) {
  const heights: Record<number, string> = { 1: 'h-28', 2: 'h-20', 3: 'h-16' }
  const medal = MEDALS[rank]!

  return (
    <div className="flex flex-col items-center" style={{ width: rank === 1 ? 100 : 80 }}>
      {/* Avatar */}
      <span className={`${rank === 1 ? 'text-3xl' : 'text-2xl'} mb-1`}>
        {entry.memberAvatar}
      </span>

      {/* Name */}
      <p className={`text-[10px] font-bold truncate w-full text-center mb-1 ${
        isCurrentUser ? 'text-purple-300' : 'text-slate-300'
      }`}>
        {entry.memberName}
      </p>

      {/* Points */}
      <p className={`text-xs font-bold mb-1 ${
        rank === 1 ? 'text-amber-400' : rank === 2 ? 'text-slate-300' : 'text-amber-600'
      }`}>
        {entry.totalPoints} pts
      </p>

      {/* Podium block */}
      <div
        className={`${heights[rank]} w-full rounded-t-xl border-t border-x flex items-start justify-center pt-2 ${medal.border} ${medal.bg}`}
      >
        <span className="text-2xl">{medal.icon}</span>
      </div>
    </div>
  )
}
