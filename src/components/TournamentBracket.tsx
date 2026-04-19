'use client'

import { type TournamentEntryData } from '@/lib/tournament-store'
import { getGameById } from '@/lib/games'

interface TournamentBracketProps {
  entries: TournamentEntryData[]
  gameIds: string[]
  currentUserId?: string
}

const PLACEMENT_MEDALS: Record<number, { icon: string; bg: string; border: string; text: string }> = {
  1: { icon: '\u{1F947}', bg: 'bg-amber-500/15', border: 'border-amber-500/40', text: 'text-amber-400' },
  2: { icon: '\u{1F948}', bg: 'bg-slate-400/10', border: 'border-slate-400/30', text: 'text-slate-300' },
  3: { icon: '\u{1F949}', bg: 'bg-amber-700/15', border: 'border-amber-700/30', text: 'text-amber-600' },
}

/**
 * Displays a visual overview of game results per player in a bracket/card layout.
 * Each game is shown as a "round" column with players ranked by score.
 * Connecting lines link consistent top performers across rounds.
 */
export default function TournamentBracket({ entries, gameIds, currentUserId }: TournamentBracketProps) {
  // Group entries by game
  const gameResults: Record<string, TournamentEntryData[]> = {}
  for (const gameId of gameIds) {
    gameResults[gameId] = entries
      .filter(e => e.gameId === gameId)
      .sort((a, b) => a.placement - b.placement)
  }

  const totalGames = gameIds.length
  const completedGames = gameIds.filter(gid => (gameResults[gid]?.length ?? 0) > 0).length

  return (
    <div className="w-full space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Game Progress
        </p>
        <p className="text-xs text-slate-500">
          {completedGames}/{totalGames} completed
        </p>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-700"
          style={{ width: `${totalGames > 0 ? (completedGames / totalGames) * 100 : 0}%` }}
        />
      </div>

      {/* Bracket rounds - horizontal scroll */}
      <div className="overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
        <div className="flex gap-3 min-w-max px-1">
          {gameIds.map((gameId, roundIdx) => {
            const game = getGameById(gameId)
            const results = gameResults[gameId] || []
            const isCompleted = results.length > 0
            const isCurrent = !isCompleted && roundIdx === completedGames
            const isFuture = roundIdx > completedGames && !isCompleted

            return (
              <div
                key={gameId}
                className={`flex flex-col rounded-2xl border overflow-hidden transition-all ${
                  isCurrent
                    ? 'border-cyan-500/40 bg-cyan-500/5 shadow-lg shadow-cyan-500/10'
                    : isCompleted
                      ? 'border-slate-700/40 bg-slate-800/30'
                      : 'border-slate-700/20 bg-slate-800/10 opacity-60'
                }`}
                style={{ minWidth: 180, maxWidth: 220 }}
              >
                {/* Round header */}
                <div
                  className={`px-4 py-3 border-b ${
                    isCurrent
                      ? 'border-cyan-500/20 bg-cyan-500/10'
                      : isCompleted
                        ? 'border-slate-700/30'
                        : 'border-slate-700/10'
                  }`}
                  style={isCompleted && game ? {
                    background: `linear-gradient(135deg, ${game.color}08, transparent)`,
                  } : undefined}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Round {roundIdx + 1}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-400 bg-cyan-500/15 px-1.5 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        NOW
                      </span>
                    )}
                    {isCompleted && (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
                        DONE
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{game?.icon || '?'}</span>
                    <p className="text-sm font-bold text-slate-200">{game?.name || 'Game'}</p>
                  </div>
                </div>

                {/* Results / empty state */}
                <div className="px-3 py-2 space-y-1.5 flex-1">
                  {isCompleted ? (
                    results.map((entry) => {
                      const medal = PLACEMENT_MEDALS[entry.placement]
                      const isMe = entry.memberId === currentUserId

                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
                            isMe
                              ? 'bg-purple-500/15 border border-purple-500/30'
                              : medal
                                ? `${medal.bg} border ${medal.border}`
                                : 'bg-slate-800/40 border border-slate-700/20'
                          }`}
                        >
                          {/* Placement */}
                          <span className="text-sm w-6 text-center flex-shrink-0">
                            {medal ? medal.icon : (
                              <span className="text-xs font-bold text-slate-500">#{entry.placement}</span>
                            )}
                          </span>

                          {/* Player info */}
                          <span className="text-base flex-shrink-0">{entry.member?.avatar || '\u{1F600}'}</span>
                          <div className="flex-1 min-w-0">
                            <span className={`text-xs font-medium block truncate ${
                              isMe ? 'text-purple-300' : 'text-slate-300'
                            }`}>
                              {entry.member?.name || 'Unknown'}
                              {isMe && (
                                <span className="text-purple-400 text-[10px] ml-1">(you)</span>
                              )}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="text-right flex-shrink-0">
                            <span className={`text-xs font-bold tabular-nums ${
                              entry.placement === 1 ? 'text-amber-400' : 'text-cyan-400'
                            }`}>
                              {entry.score.toLocaleString()}
                            </span>
                            <span className="text-[9px] text-slate-500 ml-1">
                              +{entry.points}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  ) : isCurrent ? (
                    <div className="px-3 py-6 text-center">
                      <span className="text-2xl block mb-2 animate-pulse">{game?.icon || '\u{1F3AE}'}</span>
                      <p className="text-xs text-cyan-400 font-medium">Waiting for scores...</p>
                      <p className="text-[10px] text-slate-500 mt-1">Play this game and submit your score!</p>
                    </div>
                  ) : (
                    <div className="px-3 py-6 text-center">
                      <span className="text-xl block mb-1 opacity-40">{game?.icon || '?'}</span>
                      <p className="text-[10px] text-slate-600">Upcoming</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Current
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-600" /> Upcoming
        </span>
      </div>
    </div>
  )
}
