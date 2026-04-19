'use client'

import { useState, useEffect } from 'react'
import { GAMES, type Difficulty, type GameInfo } from '@/lib/games'
import { getHighScore, getTotalGamesPlayed } from '@/lib/scores'
import { useFamily } from '@/lib/family-context'
import FamilyHub from '@/components/FamilyHub'
import OfflineIndicator from '@/components/OfflineIndicator'
import { PendingVerificationBanner } from '@/components/EmailCapturePrompt'
import Link from 'next/link'

const FILTERS: { label: string; value: Difficulty | 'all' }[] = [
  { label: '🎮 All Games', value: 'all' },
  { label: '🧒 Kids', value: 'kids' },
  { label: '🃏 Card Games', value: 'everyone' },
  { label: '🎯 Challenge', value: 'adults' },
]

function GameCard({ game }: { game: GameInfo }) {
  const [highScore, setHighScore] = useState(0)

  useEffect(() => {
    setHighScore(getHighScore(game.id))
  }, [game.id])

  return (
    <Link href={`/play/${game.id}`} className="block">
      <div
        className="game-card relative rounded-2xl p-4 cursor-pointer overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${game.color}15, ${game.color}08)`,
          border: `1px solid ${game.color}30`,
        }}
      >
        {/* Difficulty badge */}
        <div className="absolute top-2 right-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: game.difficulty === 'kids' ? '#10b98120' : '#8b5cf620',
              color: game.difficulty === 'kids' ? '#10b981' : '#8b5cf6',
            }}
          >
            {game.difficulty === 'kids' ? 'Easy' : 'Hard'}
          </span>
        </div>

        {/* Icon */}
        <div className="text-4xl mb-2">{game.icon}</div>

        {/* Name */}
        <h3
          className="font-bold text-sm mb-1"
          style={{ color: game.color }}
        >
          {game.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-400 mb-2 leading-relaxed">
          {game.description}
        </p>

        {/* High score */}
        {highScore > 0 && (
          <div className="text-[10px] text-slate-500">
            Best: <span className="text-amber-400 font-semibold">{highScore.toLocaleString()}</span>
          </div>
        )}
      </div>
    </Link>
  )
}

function FamilyBar() {
  const ctx = useFamily()
  if (!ctx) return null

  if (!ctx.isLoggedIn) {
    return (
      <div className="mx-4 mb-4 p-3 rounded-xl bg-purple-900/20 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-purple-300">Unlock Family Mode</p>
            <p className="text-xs text-slate-400">Multiplayer, chat, leaderboards & more</p>
          </div>
          <Link
            href="/family"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-all"
          >
            Upgrade
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-4 mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{ctx.member?.avatar}</span>
          <div>
            <p className="text-sm font-semibold text-white">{ctx.member?.name}</p>
            <p className="text-xs text-slate-400">{ctx.family?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tournament"
            className="px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 text-xs font-semibold rounded-lg transition-all border border-orange-600/30"
          >
            ⚔️ Tournament
          </Link>
          <Link
            href="/leaderboard"
            className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-semibold rounded-lg transition-all border border-amber-600/30"
          >
            👑 Leaderboard
          </Link>
          <Link
            href="/family"
            className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs rounded-lg transition-all"
          >
            Family
          </Link>
          <Link
            href="/settings"
            className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 text-xs rounded-lg transition-all"
          >
            ⚙️
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const familyCtx = useFamily()
  const [filter, setFilter] = useState<Difficulty | 'all'>('all')
  const [totalPlayed, setTotalPlayed] = useState(0)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    setTotalPlayed(getTotalGamesPlayed())
  }, [])

  const filtered = filter === 'all'
    ? GAMES
    : GAMES.filter(g => g.difficulty === filter)

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-8 pb-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <h1
            className="text-3xl font-bold neon-text mb-1"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '20px' }}
          >
            GameBuddi
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {GAMES.length} classic games — no wifi needed
          </p>
          {totalPlayed > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              🎮 {totalPlayed} games played
            </p>
          )}
        </div>
      </header>

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* Pending email verification (shows when back online after offline signup) */}
      <PendingVerificationBanner />

      {/* Family bar */}
      <FamilyBar />

      {/* Local Play (Family Mode only) */}
      {familyCtx?.isLoggedIn && (
        <div className="mx-4 mb-4">
          <Link
            href="/local"
            className="block w-full p-4 rounded-xl bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-300 group-hover:text-emerald-200 transition-colors">
                  Local Play
                </p>
                <p className="text-xs text-slate-400">
                  Play with nearby friends — no internet needed
                </p>
              </div>
              <span className="text-lg text-emerald-400">&rarr;</span>
            </div>
          </Link>
        </div>
      )}

      {/* Tournament Featured Callouts */}
      <div className="mx-4 mb-4 space-y-2">
        <Link
          href="/tournaments"
          className="block w-full p-4 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 hover:border-amber-400/50 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                🏆 Tournament Mode
              </p>
              <p className="text-xs text-slate-400">
                14 presets — weekends, plane rides, road trips & more
              </p>
            </div>
            <span className="text-lg text-amber-400">&rarr;</span>
          </div>
        </Link>

        {/* Quick-start callouts */}
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/tournaments/create?preset=weekend-warrior"
            className="block p-3 rounded-xl bg-gradient-to-br from-orange-500/10 to-pink-500/10 border border-orange-500/20 hover:border-orange-400/40 transition-all group"
          >
            <span className="text-xl block mb-1">🏖️</span>
            <p className="text-xs font-semibold text-orange-300">Weekend Showdown</p>
            <p className="text-[10px] text-slate-500 mt-0.5">5 games, up to 8 players</p>
          </Link>
          <Link
            href="/tournaments/create?preset=plane-ride-challenge"
            className="block p-3 rounded-xl bg-gradient-to-br from-sky-500/10 to-indigo-500/10 border border-sky-500/20 hover:border-sky-400/40 transition-all group"
          >
            <span className="text-xl block mb-1">✈️</span>
            <p className="text-xs font-semibold text-sky-300">Plane Ride</p>
            <p className="text-[10px] text-slate-500 mt-0.5">7 offline games, no wifi</p>
          </Link>
        </div>
      </div>

      {/* Family Hub (chat + presence) */}
      {familyCtx?.isLoggedIn && (
        <div className="px-4 mb-4">
          <button
            onClick={() => setShowChat(!showChat)}
            className="w-full px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/30 text-sm text-slate-300 hover:bg-slate-700/50 transition-all flex items-center justify-between"
          >
            <span>💬 Family Chat & Challenges</span>
            <span className="text-xs text-slate-500">{showChat ? '▲ Hide' : '▼ Show'}</span>
          </button>
          {showChat && (
            <div className="mt-2 rounded-xl overflow-hidden border border-slate-700/30" style={{ maxHeight: '400px' }}>
              <FamilyHub />
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-4 mb-6 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`touch-btn px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              filter === f.value
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Games grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 px-4">
        {filtered.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-600 mt-8 px-4">
        Free to play solo • Works offline • No ads
      </footer>
    </div>
  )
}
