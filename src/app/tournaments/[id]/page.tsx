'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  fetchTournament,
  submitScore,
  completeTournament,
  calculateStandings,
  type Tournament,
  type StandingEntry,
} from '@/lib/tournament-store'
import { getGameById } from '@/lib/games'
import { useFamily } from '@/lib/family-context'
import TournamentStandings from '@/components/TournamentStandings'
import TournamentBracket from '@/components/TournamentBracket'
import EliminationTournamentPage from '@/components/EliminationTournamentPage'

// ---------------------------------------------------------------------------
// Score Submit Modal
// ---------------------------------------------------------------------------
function ScoreModal({
  gameId,
  onSubmit,
  onClose,
}: {
  gameId: string
  onSubmit: (score: number) => void
  onClose: () => void
}) {
  const [score, setScore] = useState('')
  const game = getGameById(gameId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/60 p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-white mb-2 text-center">Submit Score</h3>
        <p className="text-xs text-slate-400 mb-6 text-center">
          {game?.icon} {game?.name}
        </p>

        <div className="mb-6">
          <input
            type="number"
            value={score}
            onChange={e => setScore(e.target.value)}
            placeholder="Enter your high score"
            className="w-full bg-slate-800/60 text-white text-center text-xl placeholder:text-slate-500 rounded-xl px-4 py-4 border border-slate-600/50 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20 transition-colors"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-300 text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => score && onSubmit(parseInt(score, 10))}
            disabled={!score || parseInt(score, 10) <= 0}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              score && parseInt(score, 10) > 0
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-600/20'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
            }`}
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Winner Celebration
// ---------------------------------------------------------------------------
function WinnerCelebration({ winner, tournamentName }: { winner: StandingEntry; tournamentName: string }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number; size: number }>>([])

  useEffect(() => {
    const newParticles = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      color: ['#f59e0b', '#8b5cf6', '#ec4899', '#10b981', '#06b6d4', '#ef4444'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 2,
      size: 4 + Math.random() * 8,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="relative rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-8 text-center overflow-hidden mb-6">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute top-0 animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${2 + Math.random() * 2}s`,
          }}
        />
      ))}

      <div className="relative z-10">
        <div className="text-5xl mb-3">&#x1F3C6;</div>
        <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2">Tournament Champion</p>
        <div className="text-4xl mb-2">{winner.memberAvatar}</div>
        <h2 className="text-xl font-bold text-white mb-1">{winner.memberName}</h2>
        <p className="text-sm text-slate-400">Won {tournamentName} with {winner.totalPoints} points!</p>
      </div>

      <style jsx>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(300px) rotate(720deg); opacity: 0; }
        }
        .animate-confetti-fall {
          animation: confetti-fall 3s ease-in forwards;
        }
      `}</style>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function TournamentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const ctx = useFamily()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [scoreGameId, setScoreGameId] = useState<string | null>(null)
  const [tab, setTab] = useState<'standings' | 'bracket' | 'games'>('standings')
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)

  const loadTournament = useCallback(async () => {
    try {
      const t = await fetchTournament(id)
      setTournament(t)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTournament()
  }, [loadTournament])

  const standings = tournament ? calculateStandings(tournament.entries) : []
  const isCreator = tournament?.createdBy === ctx?.member?.id
  const isActive = tournament?.status === 'active'
  const isCompleted = tournament?.status === 'completed'
  const winner = isCompleted && standings.length > 0 ? standings[0] : null
  const currentMemberId = ctx?.member?.id

  const PLACEMENT_LABELS: Record<number, { emoji: string; color: string }> = {
    1: { emoji: '&#x1F947;', color: 'text-yellow-400' },
    2: { emoji: '&#x1F948;', color: 'text-slate-300' },
    3: { emoji: '&#x1F949;', color: 'text-amber-600' },
  }

  const handleScoreSubmit = async (score: number) => {
    if (!tournament || !scoreGameId || !currentMemberId) return
    const updated = await submitScore(tournament.id, currentMemberId, scoreGameId, score)
    if (updated) setTournament(updated)
    setScoreGameId(null)
  }

  const handleComplete = async () => {
    if (!tournament || !currentMemberId) return
    setCompleting(true)
    try {
      const updated = await completeTournament(tournament.id, currentMemberId)
      if (updated) setTournament(updated)
    } catch {
      // ignore
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="text-5xl">&#x1F50D;</div>
          <h2 className="text-lg font-bold text-slate-300">Tournament not found</h2>
          <p className="text-sm text-slate-500">It may have been deleted or the link is incorrect.</p>
          <Link
            href="/tournaments"
            className="inline-block px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm transition-all"
          >
            Back to Tournaments
          </Link>
        </div>
      </div>
    )
  }

  // ── Elimination bracket tournament ────────────────────────────────
  if ((tournament as any).format === 'elimination') {
    return (
      <EliminationTournamentPage
        tournament={tournament as any}
        currentUserId={currentMemberId}
        currentUserName={ctx?.member?.name || 'Player'}
        currentUserAvatar={ctx?.member?.avatar || '😀'}
        onRefresh={loadTournament}
      />
    )
  }

  const firstGame = tournament.gameIds.length > 0 ? getGameById(tournament.gameIds[0]) : null

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-8 pb-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: `linear-gradient(135deg, ${firstGame?.color || '#f59e0b'}, transparent)` }}
        />
        <div className="relative">
          <Link href="/tournaments" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2 inline-block">
            &larr; All Tournaments
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex -space-x-1">
              {tournament.gameIds.slice(0, 3).map(gid => {
                const g = getGameById(gid)
                return <span key={gid} className="text-2xl">{g?.icon || '?'}</span>
              })}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{tournament.name}</h1>
              <p className="text-xs text-slate-400">
                {tournament.gameIds.length} games &middot; Score-based
                {tournament.creator && ` &middot; by ${tournament.creator.name}`}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <StatusBadge status={tournament.status} />
            <span className="text-xs text-slate-500">
              {standings.length} player{standings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Winner celebration */}
        {winner && <WinnerCelebration winner={winner} tournamentName={tournament.name} />}

        {/* Game lineup */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {tournament.gameIds.map(gameId => {
            const game = getGameById(gameId)
            if (!game) return null
            const entriesForGame = tournament.entries.filter(e => e.gameId === gameId)
            const myEntry = currentMemberId
              ? entriesForGame.find(e => e.memberId === currentMemberId)
              : null

            return (
              <div
                key={gameId}
                className={`flex-shrink-0 px-3 py-2 rounded-xl border text-center min-w-[80px] ${
                  myEntry
                    ? 'border-emerald-500/30 bg-emerald-500/10'
                    : 'border-slate-700/30 bg-slate-800/30'
                }`}
              >
                <span className="text-2xl block">{game.icon}</span>
                <p className="text-[10px] text-slate-300 mt-1 font-medium">{game.name}</p>
                {myEntry ? (
                  <p className="text-[10px] text-emerald-400 mt-0.5">
                    {myEntry.score.toLocaleString()} pts
                  </p>
                ) : isActive ? (
                  <p className="text-[10px] text-amber-400 mt-0.5">Not played</p>
                ) : null}
              </div>
            )
          })}
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('standings')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'standings'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Standings
          </button>
          <button
            onClick={() => setTab('bracket')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'bracket'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Bracket
          </button>
          <button
            onClick={() => setTab('games')}
            className={`flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              tab === 'games'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/20'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Games
          </button>
        </div>

        {/* Standings tab */}
        {tab === 'standings' && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
            <TournamentStandings
              standings={standings}
              currentUserId={currentMemberId}
            />
          </div>
        )}

        {/* Bracket tab */}
        {tab === 'bracket' && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
            <TournamentBracket
              entries={tournament.entries}
              gameIds={tournament.gameIds}
              currentUserId={currentMemberId}
            />
          </div>
        )}

        {/* Games tab */}
        {tab === 'games' && (
          <div className="space-y-4">
            {tournament.gameIds.map(gameId => {
              const game = getGameById(gameId)
              if (!game) return null
              const entriesForGame = tournament.entries
                .filter(e => e.gameId === gameId)
                .sort((a, b) => a.placement - b.placement)
              const myEntry = currentMemberId
                ? entriesForGame.find(e => e.memberId === currentMemberId)
                : null

              return (
                <div key={gameId} className="rounded-xl border border-slate-700/30 bg-slate-800/20 overflow-hidden">
                  {/* Game header */}
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      background: `linear-gradient(135deg, ${game.color}10, transparent)`,
                      borderBottom: `1px solid ${game.color}20`,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{game.icon}</span>
                      <div>
                        <h4 className="text-sm font-bold" style={{ color: game.color }}>
                          {game.name}
                        </h4>
                        <p className="text-[10px] text-slate-500">
                          {entriesForGame.length} score{entriesForGame.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {isActive && !myEntry && (
                        <Link
                          href={`/play/${gameId}`}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-colors"
                        >
                          Play
                        </Link>
                      )}
                      {isActive && (
                        <button
                          onClick={() => setScoreGameId(gameId)}
                          className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors"
                        >
                          {myEntry ? 'Update' : '+ Score'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Entries */}
                  {entriesForGame.length > 0 ? (
                    <div className="divide-y divide-slate-700/20">
                      {entriesForGame.map(entry => {
                        const pl = PLACEMENT_LABELS[entry.placement]
                        const isMe = entry.memberId === currentMemberId

                        return (
                          <div
                            key={entry.id}
                            className={`flex items-center gap-3 px-4 py-2.5 ${
                              isMe ? 'bg-purple-500/5' : ''
                            }`}
                          >
                            <span
                              className="text-base w-6 text-center"
                              dangerouslySetInnerHTML={{ __html: pl?.emoji || `#${entry.placement}` }}
                            />
                            <span className="text-lg">{entry.member?.avatar || '😀'}</span>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-medium ${isMe ? 'text-purple-300' : 'text-slate-300'}`}>
                                {entry.member?.name || 'Unknown'}
                                {isMe && <span className="text-purple-400 ml-1">(you)</span>}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-cyan-400">
                                {entry.score.toLocaleString()}
                              </span>
                              <span className="text-[10px] text-slate-500 ml-1.5">
                                +{entry.points}pt{entry.points !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs text-slate-500">No scores yet. Be the first!</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Complete tournament button (creator only) */}
        {isActive && isCreator && (
          <div className="pt-2">
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 shadow-lg shadow-amber-600/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
            >
              {completing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Completing...
                </span>
              ) : (
                'Complete Tournament & Crown the Winner!'
              )}
            </button>
          </div>
        )}

        {/* Points legend */}
        <div className="bg-slate-800/20 rounded-xl p-3 border border-slate-700/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Points System</p>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>1st = 3pts</span>
            <span>2nd = 2pts</span>
            <span>3rd = 1pt</span>
          </div>
        </div>
      </div>

      {/* Score modal */}
      {scoreGameId && (
        <ScoreModal
          gameId={scoreGameId}
          onSubmit={handleScoreSubmit}
          onClose={() => setScoreGameId(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string }> = {
    active: { label: 'Live', class: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' },
    completed: { label: 'Completed', class: 'bg-slate-500/15 border-slate-500/30 text-slate-400' },
    pending: { label: 'Pending', class: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400' },
  }
  const c = config[status] || config.active
  return (
    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${c.class} uppercase tracking-wider inline-flex items-center gap-1`}>
      {status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      {c.label}
    </span>
  )
}
