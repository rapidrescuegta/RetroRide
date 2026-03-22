'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFamily } from '@/lib/family-context'
import { GAMES } from '@/lib/games'
import Link from 'next/link'

interface OverviewEntry {
  memberId: string
  memberName: string
  memberAvatar: string
  crowns: number
  totalPoints: number
  gamesPlayed: number
}

interface GameEntry {
  rank: number
  memberId: string
  memberName: string
  memberAvatar: string
  score: number
  date: string
}

const RANK_STYLES = [
  { badge: '', color: '', bg: '' },
  { badge: '', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30' },
  { badge: '', color: 'text-slate-300', bg: 'bg-slate-400/10 border-slate-400/30' },
  { badge: '', color: 'text-amber-600', bg: 'bg-amber-700/10 border-amber-700/30' },
]

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="text-2xl animate-bounce" style={{ animationDuration: '2s' }}>
        👑
      </span>
    )
  }
  if (rank === 2) {
    return <span className="text-xl opacity-80">🥈</span>
  }
  if (rank === 3) {
    return <span className="text-xl opacity-70">🥉</span>
  }
  return (
    <span className="text-sm font-bold text-slate-500 w-8 text-center">
      #{rank}
    </span>
  )
}

function GameMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>
  if (rank === 2) return <span className="text-xl">🥈</span>
  if (rank === 3) return <span className="text-xl">🥉</span>
  return <span className="text-sm font-bold text-slate-500 w-6 text-center">#{rank}</span>
}

function NotLoggedIn() {
  return (
    <div className="min-h-screen pb-8 page-enter">
      <header className="relative px-4 pt-8 pb-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
            &larr; Home
          </Link>
          <h1
            className="text-xl font-bold neon-text mt-3"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
          >
            Leaderboard
          </h1>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4 text-center space-y-6 pt-12">
        <div className="text-6xl">🏆</div>
        <p className="text-slate-400">
          Leaderboards are a Family Mode feature. Upgrade to compete with your family!
        </p>
        <Link
          href="/family"
          className="touch-btn inline-flex px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
        >
          Upgrade to Family Mode
        </Link>
      </div>
    </div>
  )
}

function OverviewTab({ data, currentMemberId }: { data: OverviewEntry[]; currentMemberId: string | undefined }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="text-5xl">🎮</div>
        <p className="text-slate-400 text-sm">No scores yet! Play some games to see the leaderboard.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((entry, i) => {
        const rank = i + 1
        const isMe = entry.memberId === currentMemberId
        const style = RANK_STYLES[rank] || { badge: '', color: '', bg: '' }

        return (
          <div
            key={entry.memberId}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 border transition-all ${
              rank <= 3
                ? style.bg
                : 'bg-slate-800/30 border-slate-700/30'
            } ${isMe ? 'ring-1 ring-purple-500/40' : ''}`}
          >
            <RankBadge rank={rank} />
            <span className="text-2xl">{entry.memberAvatar}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold truncate ${rank <= 3 ? style.color : 'text-slate-200'}`}>
                  {entry.memberName}
                </span>
                {isMe && (
                  <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded-full">
                    YOU
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-slate-500">
                  {entry.totalPoints.toLocaleString()} pts
                </span>
                <span className="text-xs text-slate-600">
                  {entry.gamesPlayed} {entry.gamesPlayed === 1 ? 'game' : 'games'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1">
                <span className="text-lg">👑</span>
                <span className="text-lg font-bold text-yellow-400">{entry.crowns}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function GameTab({ familyId, currentMemberId }: { familyId: string; currentMemberId: string | undefined }) {
  const [selectedGame, setSelectedGame] = useState(GAMES[0]?.id || '')
  const [entries, setEntries] = useState<GameEntry[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGameLeaderboard = useCallback(async (gameId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/leaderboard?familyId=${familyId}&gameId=${gameId}`)
      const data = await res.json()
      setEntries(data.leaderboard || [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [familyId])

  useEffect(() => {
    if (selectedGame) fetchGameLeaderboard(selectedGame)
  }, [selectedGame, fetchGameLeaderboard])

  const currentGame = GAMES.find(g => g.id === selectedGame)

  return (
    <div className="space-y-4">
      {/* Game picker - horizontal scroll */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
        {GAMES.map(game => (
          <button
            key={game.id}
            onClick={() => setSelectedGame(game.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
              selectedGame === game.id
                ? 'text-white shadow-lg'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
            style={selectedGame === game.id ? {
              background: `linear-gradient(135deg, ${game.color}40, ${game.color}20)`,
              border: `1px solid ${game.color}60`,
              boxShadow: `0 0 15px ${game.color}20`,
            } : {}}
          >
            <span>{game.icon}</span>
            <span>{game.name}</span>
          </button>
        ))}
      </div>

      {/* Game header */}
      {currentGame && (
        <div className="text-center py-2">
          <span className="text-3xl">{currentGame.icon}</span>
          <h3 className="text-sm font-bold mt-1" style={{ color: currentGame.color }}>
            {currentGame.name}
          </h3>
        </div>
      )}

      {/* Leaderboard */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-3xl animate-spin">🎮</div>
          <p className="text-slate-500 text-sm mt-2">Loading...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-4xl opacity-50">{currentGame?.icon || '🎮'}</div>
          <p className="text-slate-500 text-sm">
            No scores for this game yet. Be the first!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const isMe = entry.memberId === currentMemberId
            return (
              <div
                key={entry.memberId}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                  entry.rank <= 3
                    ? (RANK_STYLES[entry.rank]?.bg || 'bg-slate-800/30 border-slate-700/30')
                    : 'bg-slate-800/30 border-slate-700/30'
                } ${isMe ? 'ring-1 ring-purple-500/40' : ''}`}
              >
                <GameMedal rank={entry.rank} />
                <span className="text-2xl">{entry.memberAvatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold truncate ${
                      entry.rank <= 3
                        ? (RANK_STYLES[entry.rank]?.color || 'text-slate-200')
                        : 'text-slate-200'
                    }`}>
                      {entry.memberName}
                    </span>
                    {isMe && (
                      <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/15 px-1.5 py-0.5 rounded-full">
                        YOU
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(entry.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-cyan-400">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function LeaderboardPage() {
  const ctx = useFamily()
  const [tab, setTab] = useState<'overview' | 'games'>('overview')
  const [overview, setOverview] = useState<OverviewEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ctx?.family) {
      setLoading(false)
      return
    }
    fetch(`/api/leaderboard?familyId=${ctx.family.id}`)
      .then(r => r.json())
      .then(data => {
        setOverview(data.overview || [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ctx?.family])

  if (!ctx?.isLoggedIn) return <NotLoggedIn />

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-8 pb-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
            &larr; Home
          </Link>
          <h1
            className="text-xl font-bold neon-text mt-3"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
          >
            🏆 Leaderboard
          </h1>
          <p className="text-slate-500 text-xs mt-2">{ctx.family?.name}</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 space-y-5">
        {/* Tab toggle */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab('overview')}
            className={`flex-1 touch-btn py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'overview'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            👑 Overview
          </button>
          <button
            onClick={() => setTab('games')}
            className={`flex-1 touch-btn py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === 'games'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            🎮 By Game
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center py-16">
            <div className="text-4xl animate-spin">🏆</div>
            <p className="text-slate-500 text-sm mt-3">Loading leaderboard...</p>
          </div>
        ) : tab === 'overview' ? (
          <OverviewTab data={overview} currentMemberId={ctx.member?.id} />
        ) : (
          <GameTab familyId={ctx.family!.id} currentMemberId={ctx.member?.id} />
        )}
      </div>
    </div>
  )
}
