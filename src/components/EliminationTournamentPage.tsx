'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import EliminationBracket from '@/components/EliminationBracket'
import TournamentMatchView from '@/components/TournamentMatchView'
import SpectatorView from '@/components/SpectatorView'
import {
  startMatch,
  reportMatchResult,
  type BracketMatchData,
  type BracketParticipantData,
} from '@/lib/tournament-store'
import { getGameById } from '@/lib/games'
import { getRoundName, totalRounds, getChampion } from '@/lib/bracket'

// ─── Types ──────────────────────────────────────────────────────────────

interface EliminationTournament {
  id: string
  name: string
  familyId: string
  gameIds: string[]
  gameId: string | null
  format: string
  bracketSize: number | null
  currentRound: number
  status: string
  createdBy: string
  createdAt: string
  completedAt: string | null
  participants: BracketParticipantData[]
  matches: BracketMatchData[]
}

interface EliminationTournamentPageProps {
  tournament: EliminationTournament
  currentUserId?: string
  currentUserName: string
  currentUserAvatar: string
  onRefresh: () => void
}

type View = 'bracket' | 'playing' | 'spectating'

// ─── Component ──────────────────────────────────────────────────────────

export default function EliminationTournamentPage({
  tournament,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onRefresh,
}: EliminationTournamentPageProps) {
  const [view, setView] = useState<View>('bracket')
  const [activeMatch, setActiveMatch] = useState<BracketMatchData | null>(null)
  const [error, setError] = useState('')

  const { participants, matches } = tournament
  const bracketSize = tournament.bracketSize ?? 2
  const numRounds = totalRounds(bracketSize)
  const gameId = tournament.gameId ?? tournament.gameIds[0]
  const gameInfo = getGameById(gameId)
  const isCompleted = tournament.status === 'completed'

  // Find current user's participant record
  const myParticipant = currentUserId
    ? participants.find(p => p.memberId === currentUserId)
    : null
  const isEliminated = myParticipant?.eliminated ?? false
  const isParticipant = !!myParticipant

  // Find my next match
  const myNextMatch = currentUserId
    ? matches.find(
        m =>
          (m.player1Id === currentUserId || m.player2Id === currentUserId) &&
          (m.status === 'ready' || m.status === 'in-progress')
      )
    : null

  // Find live matches for spectating
  const liveMatches = matches.filter(m => m.status === 'in-progress')

  // Champion
  const championId = isCompleted
    ? matches.find(m => m.round === numRounds)?.winnerId
    : null
  const champion = championId
    ? participants.find(p => p.memberId === championId)
    : null

  // Auto-refresh bracket while tournament is active
  useEffect(() => {
    if (isCompleted || view !== 'bracket') return
    const interval = setInterval(onRefresh, 5000)
    return () => clearInterval(interval)
  }, [isCompleted, view, onRefresh])

  // ── Handle match click from bracket ─────────────────────────────────

  const handleMatchClick = useCallback(async (match: BracketMatchData) => {
    if (!currentUserId) return

    const isMyMatch =
      match.player1Id === currentUserId || match.player2Id === currentUserId

    // If it's my match and it's ready, start it
    if (isMyMatch && match.status === 'ready') {
      try {
        const result = await startMatch(tournament.id, match.id, currentUserId)
        setActiveMatch({ ...match, ...result.match, roomCode: result.roomCode })
        setView('playing')
      } catch (err: any) {
        setError(err?.message || 'Failed to start match')
      }
      return
    }

    // If it's my match and it's in progress, rejoin
    if (isMyMatch && match.status === 'in-progress') {
      setActiveMatch(match)
      setView('playing')
      return
    }

    // If it's someone else's live match, spectate
    if (!isMyMatch && match.status === 'in-progress') {
      setActiveMatch(match)
      setView('spectating')
      return
    }
  }, [currentUserId, tournament.id])

  // ── Handle match completion ─────────────────────────────────────────

  const handleMatchComplete = useCallback((winnerId: string) => {
    setView('bracket')
    setActiveMatch(null)
    onRefresh()
  }, [onRefresh])

  // ── Playing View ────────────────────────────────────────────────────

  if (view === 'playing' && activeMatch && currentUserId) {
    return (
      <TournamentMatchView
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        match={activeMatch}
        participants={participants}
        bracketSize={bracketSize}
        gameId={gameId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onComplete={handleMatchComplete}
        onBack={() => { setView('bracket'); setActiveMatch(null) }}
      />
    )
  }

  // ── Spectating View ─────────────────────────────────────────────────

  if (view === 'spectating' && activeMatch) {
    return (
      <SpectatorView
        match={activeMatch}
        participants={participants}
        bracketSize={bracketSize}
        tournamentName={tournament.name}
        onBack={() => { setView('bracket'); setActiveMatch(null) }}
      />
    )
  }

  // ── Bracket View ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-8 pb-6 overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{ background: `linear-gradient(135deg, ${gameInfo?.color || '#f59e0b'}, transparent)` }}
        />
        <div className="relative">
          <Link
            href="/tournaments"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2 inline-block"
          >
            ← All Tournaments
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🏒</span>
            <div>
              <h1 className="text-lg font-bold text-white">{tournament.name}</h1>
              <p className="text-xs text-slate-400">
                {gameInfo?.icon} {gameInfo?.name} · {participants.length} players · Elimination
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-3 mt-3">
            {isCompleted ? (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-slate-500/15 border-slate-500/30 text-slate-400 uppercase tracking-wider">
                Completed
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/15 border-emerald-500/30 text-emerald-400 uppercase tracking-wider inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            )}
            <span className="text-xs text-slate-500">
              Round {tournament.currentRound} of {numRounds}
            </span>
          </div>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Champion celebration */}
        {isCompleted && champion && (
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-8 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2">
              Tournament Champion
            </p>
            <div className="text-4xl mb-2">{champion.member?.avatar || '😀'}</div>
            <h2 className="text-xl font-bold text-white mb-1">
              {champion.member?.name || 'Unknown'}
            </h2>
            <p className="text-sm text-slate-400">
              Won {tournament.name}!
            </p>
          </div>
        )}

        {/* Your status card */}
        {isParticipant && !isCompleted && (
          <div className={`rounded-xl border p-4 ${
            isEliminated
              ? 'border-red-500/20 bg-red-500/5'
              : myNextMatch
                ? 'border-cyan-500/30 bg-cyan-500/5'
                : 'border-slate-700/30 bg-slate-800/20'
          }`}>
            {isEliminated ? (
              <div className="text-center space-y-3">
                <p className="text-sm text-red-400 font-medium">
                  You've been eliminated in {getRoundName(myParticipant!.eliminatedIn ?? 1, numRounds)}
                </p>
                {liveMatches.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-400 mb-2">Watch live matches:</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {liveMatches.map(m => {
                        const mp1 = participants.find(p => p.memberId === m.player1Id)
                        const mp2 = participants.find(p => p.memberId === m.player2Id)
                        return (
                          <button
                            key={m.id}
                            onClick={() => { setActiveMatch(m); setView('spectating') }}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-all text-xs"
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-slate-300">
                              {mp1?.member?.avatar} {mp1?.member?.name} vs {mp2?.member?.avatar} {mp2?.member?.name}
                            </span>
                            <span className="text-emerald-400">Watch →</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : myNextMatch ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-1">
                    Your Next Match
                  </p>
                  <p className="text-sm text-white">
                    {getRoundName(myNextMatch.round, numRounds)} — Position {myNextMatch.position + 1}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    vs{' '}
                    {(() => {
                      const oppId = myNextMatch.player1Id === currentUserId
                        ? myNextMatch.player2Id
                        : myNextMatch.player1Id
                      const opp = participants.find(p => p.memberId === oppId)
                      return opp
                        ? `${opp.member?.avatar} ${opp.member?.name}`
                        : 'TBD'
                    })()}
                  </p>
                </div>
                <button
                  onClick={() => handleMatchClick(myNextMatch)}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:from-cyan-500 hover:to-emerald-500 transition-all shadow-lg shadow-cyan-600/20"
                  style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
                >
                  {myNextMatch.status === 'in-progress' ? 'REJOIN' : 'PLAY NOW'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center">
                Waiting for your next match...
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 rounded-xl bg-red-900/20 border border-red-500/30">
            <p className="text-xs text-red-400">{error}</p>
            <button onClick={() => setError('')} className="text-xs text-red-500 mt-1">
              Dismiss
            </button>
          </div>
        )}

        {/* Bracket */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4 overflow-x-auto">
          <EliminationBracket
            matches={matches}
            participants={participants}
            bracketSize={bracketSize}
            currentUserId={currentUserId}
            onMatchClick={handleMatchClick}
          />
        </div>

        {/* Participants list */}
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
            Players ({participants.length})
          </p>
          <div className="grid grid-cols-2 gap-2">
            {participants
              .sort((a, b) => a.seed - b.seed)
              .map(p => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    p.eliminated
                      ? 'bg-slate-900/30 opacity-50'
                      : p.memberId === currentUserId
                        ? 'bg-purple-500/10 border border-purple-500/20'
                        : 'bg-slate-800/40'
                  }`}
                >
                  <span className="text-[10px] text-slate-500 font-mono w-4">
                    #{p.seed}
                  </span>
                  <span className="text-sm">{p.member?.avatar || '😀'}</span>
                  <span className={`text-xs font-medium truncate ${
                    p.eliminated ? 'text-slate-500 line-through' : 'text-slate-300'
                  }`}>
                    {p.member?.name || 'Unknown'}
                  </span>
                  {p.eliminated && (
                    <span className="text-[9px] text-red-400/60 ml-auto">OUT</span>
                  )}
                  {!p.eliminated && championId === p.memberId && (
                    <span className="ml-auto">🏆</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
