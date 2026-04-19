'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TOURNAMENT_PRESETS, FORMAT_LABELS } from '@/lib/tournament-presets'
import { GAMES } from '@/lib/games'

// ─── Featured Challenge Banners ──────────────────────────────────────

const FEATURED_CHALLENGES = [
  {
    presetId: 'weekend-warrior',
    title: 'Weekend Showdown',
    subtitle: 'Gather family & friends for a 5-game showdown — crown the weekend champion!',
    icon: '🏆',
    badgeText: 'FAMILY FAVORITE',
    theme: 'from-orange-500/25 via-pink-600/20 to-transparent',
    border: 'border-orange-500/40',
    accent: 'text-orange-400',
    buttonGradient: 'from-orange-500 to-pink-600',
    glowColor: 'shadow-orange-500/20',
  },
  {
    presetId: 'plane-ride-challenge',
    title: 'Plane Ride Challenge',
    subtitle: 'Offline games perfect for flights and road trips — no wifi needed!',
    icon: '✈️',
    badgeText: 'OFFLINE',
    theme: 'from-sky-500/25 via-indigo-600/20 to-transparent',
    border: 'border-sky-500/40',
    accent: 'text-sky-400',
    buttonGradient: 'from-sky-500 to-indigo-600',
    glowColor: 'shadow-sky-500/20',
  },
  {
    presetId: 'friends-night-in',
    title: 'Friends Night In',
    subtitle: 'Poker, arcade, and strategy — battle your friends for bragging rights!',
    icon: '🍕',
    badgeText: 'FRIENDS',
    theme: 'from-fuchsia-500/25 via-violet-600/20 to-transparent',
    border: 'border-fuchsia-500/40',
    accent: 'text-fuchsia-400',
    buttonGradient: 'from-fuchsia-500 to-violet-600',
    glowColor: 'shadow-fuchsia-500/20',
  },
]

const HERO_BANNERS = [
  {
    presetId: 'friday-night-throwdown',
    title: 'Friday Night Throwdown',
    subtitle: 'Competitive arcade + cards for the grown-ups!',
    icon: '🔥',
    theme: 'from-red-600/20 via-orange-500/15 to-transparent',
    border: 'border-red-500/30',
    accent: 'text-red-400',
    buttonGradient: 'from-red-600 to-orange-500',
  },
  {
    presetId: 'kids-vs-parents',
    title: 'Kids vs Parents',
    subtitle: 'Fun games where kids can actually win!',
    icon: '👨‍👧‍👦',
    theme: 'from-pink-500/20 via-yellow-400/15 to-transparent',
    border: 'border-pink-500/30',
    accent: 'text-pink-400',
    buttonGradient: 'from-pink-500 to-yellow-400',
  },
  {
    presetId: 'family-game-night',
    title: 'Family Game Night',
    subtitle: 'Easy games everyone can play together!',
    icon: '👨‍👩‍👧‍👦',
    theme: 'from-purple-500/20 via-pink-500/15 to-transparent',
    border: 'border-purple-500/30',
    accent: 'text-purple-400',
    buttonGradient: 'from-purple-500 to-pink-500',
  },
  {
    presetId: 'brain-games',
    title: 'Brain Games',
    subtitle: 'Puzzle tournament for the strategists!',
    icon: '🧠',
    theme: 'from-indigo-500/20 via-purple-600/15 to-transparent',
    border: 'border-indigo-500/30',
    accent: 'text-indigo-400',
    buttonGradient: 'from-indigo-500 to-purple-600',
  },
  {
    presetId: 'speed-run',
    title: 'Speed Run',
    subtitle: '60-second rounds — fastest fingers win!',
    icon: '⏱️',
    theme: 'from-cyan-500/20 via-blue-600/15 to-transparent',
    border: 'border-cyan-500/30',
    accent: 'text-cyan-400',
    buttonGradient: 'from-cyan-500 to-blue-600',
  },
  {
    presetId: 'sunday-brunch',
    title: 'Sunday Brunch Games',
    subtitle: 'Relaxed card & word games at your own pace!',
    icon: '☕',
    theme: 'from-yellow-400/20 via-orange-500/15 to-transparent',
    border: 'border-yellow-500/30',
    accent: 'text-yellow-400',
    buttonGradient: 'from-yellow-400 to-orange-500',
  },
]

// ─── Active tournaments fetched from API ─────────────────────────────

interface ActiveTournament {
  id: string
  name: string
  playerCount: number
  currentGame: string
  gamesCompleted: number
  totalGames: number
  leader: string
  leaderAvatar: string
}

function useActiveTournaments(): ActiveTournament[] {
  const [tournaments, setTournaments] = useState<ActiveTournament[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/tournament?status=active')
        if (!res.ok) return
        const data = await res.json()
        if (cancelled || !Array.isArray(data)) return

        const mapped: ActiveTournament[] = data.map((t: Record<string, unknown>) => {
          const entries = (t.entries || []) as Array<{
            memberId: string
            gameId: string
            points: number
            member?: { name: string; avatar: string }
          }>
          const gameIds = (t.gameIds || []) as string[]
          const completedGameIds = new Set(entries.map(e => e.gameId))
          const playerMap = new Map<string, { name: string; avatar: string; points: number }>()
          for (const e of entries) {
            const existing = playerMap.get(e.memberId)
            playerMap.set(e.memberId, {
              name: e.member?.name || 'Unknown',
              avatar: e.member?.avatar || '\u{1F600}',
              points: (existing?.points || 0) + e.points,
            })
          }
          const players = Array.from(playerMap.values())
          const leader = players.sort((a, b) => b.points - a.points)[0]

          return {
            id: t.id as string,
            name: t.name as string,
            playerCount: playerMap.size,
            currentGame: gameIds.find(g => !completedGameIds.has(g)) || gameIds[0] || '',
            gamesCompleted: completedGameIds.size,
            totalGames: gameIds.length,
            leader: leader?.name || '—',
            leaderAvatar: leader?.avatar || '\u{1F600}',
          }
        })

        setTournaments(mapped)
      } catch {
        // Offline or error — keep empty
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return tournaments
}

// ─── Animated Trophy ─────────────────────────────────────────────────

function AnimatedTrophy({ size = 'text-5xl' }: { size?: string }) {
  return (
    <span className={`inline-block ${size} animate-bounce`} style={{ animationDuration: '2s' }}>
      👑
    </span>
  )
}

// ─── Quick Preset Pill ──────────────────────────────────────────────

function PresetPill({ presetId }: { presetId: string }) {
  const preset = TOURNAMENT_PRESETS.find((p) => p.id === presetId)
  if (!preset) return null

  const formatInfo = FORMAT_LABELS[preset.format]

  return (
    <Link
      href={`/tournaments/create?preset=${preset.id}`}
      className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-700/30 bg-slate-800/40 hover:bg-slate-700/40 hover:border-slate-600/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
    >
      <span className="text-2xl">{preset.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-white">{preset.name}</p>
          {preset.tag && (
            <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wide bg-slate-700/60 text-slate-300">
              {preset.tag}
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400">
          {formatInfo.icon} {formatInfo.label} &bull; {preset.estimatedTime} &bull; {preset.maxPlayers} players
          {preset.timedRounds && (
            <span className="ml-1 text-cyan-400">
              &bull; {preset.defaultRoundDuration}s rounds
            </span>
          )}
        </p>
      </div>
    </Link>
  )
}

// ─── Main Tournaments Hub Page ──────────────────────────────────────

export default function TournamentsPage() {
  const activeTournaments = useActiveTournaments()
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    setAnimateIn(true)
  }, [])

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
            Tournaments
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            Challenge your family and friends to epic multi-game battles
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 space-y-6">
        {/* ─── Featured Challenges Section ────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AnimatedTrophy size="text-lg" />
            <h2
              className="text-sm font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
            >
              Featured Challenges
            </h2>
          </div>

          <div className="space-y-3">
            {FEATURED_CHALLENGES.map((challenge, idx) => (
              <Link
                key={challenge.presetId}
                href={`/tournaments/create?preset=${challenge.presetId}`}
                className={`group block relative rounded-2xl p-5 border-2 ${challenge.border} overflow-hidden transition-all duration-500 hover:scale-[1.02] active:scale-[0.99] shadow-lg ${challenge.glowColor} ${
                  animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                {/* Animated background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r ${challenge.theme}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />

                {/* Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider ${challenge.accent} bg-slate-900/80 border ${challenge.border}`}>
                    {challenge.badgeText}
                  </span>
                </div>

                <div className="relative flex items-center gap-4">
                  <span className="text-5xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">{challenge.icon}</span>
                  <div className="min-w-0 flex-1">
                    <h2
                      className={`text-sm font-bold ${challenge.accent}`}
                      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
                    >
                      {challenge.title}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {challenge.subtitle}
                    </p>
                    <span
                      className={`inline-block mt-3 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${challenge.buttonGradient} shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl`}
                    >
                      Start Challenge
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── Active Tournaments Section ─────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🎮</span>
            <h2
              className="text-sm font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
            >
              Active Tournaments
            </h2>
          </div>

          {activeTournaments.length > 0 ? (
            <div className="space-y-2">
              {activeTournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/tournaments/${t.id}`}
                  className="block rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-white">{t.name}</h3>
                    <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                      LIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    <span>👥 {t.playerCount} players</span>
                    <span>🎮 {t.gamesCompleted}/{t.totalGames} games</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
                      style={{ width: `${(t.gamesCompleted / t.totalGames) * 100}%` }}
                    />
                  </div>
                  {/* Leader */}
                  <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                    <span className="text-amber-400">👑</span>
                    <span className="text-sm">{t.leaderAvatar}</span>
                    <span className="text-amber-300 font-medium">{t.leader}</span>
                    <span className="text-slate-500">is in the lead</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl p-6 border border-dashed border-slate-700/40 bg-slate-800/20 text-center">
              <span className="text-3xl block mb-2">🎯</span>
              <p className="text-xs text-slate-500 mb-3">No active tournaments right now</p>
              <Link
                href="/tournaments/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors"
              >
                Start one now
              </Link>
            </div>
          )}
        </div>

        {/* ─── More Challenges ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎲</span>
              <h2 className="text-sm font-bold text-white">More Challenges</h2>
            </div>
            <Link
              href="/tournaments/create"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
            >
              Custom +
            </Link>
          </div>

          <div className="space-y-3">
            {HERO_BANNERS.map((banner) => (
              <Link
                key={banner.presetId}
                href={`/tournaments/create?preset=${banner.presetId}`}
                className={`block relative rounded-2xl p-4 border ${banner.border} overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.99]`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r ${banner.theme}`} />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-3xl flex-shrink-0">{banner.icon}</span>
                    <div className="min-w-0">
                      <h3 className={`text-xs font-bold ${banner.accent}`}>
                        {banner.title}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {banner.subtitle}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex-shrink-0 ml-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${banner.buttonGradient} shadow-lg transition-all hover:scale-105`}
                  >
                    Play
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ─── All Presets ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚡</span>
            <h2 className="text-sm font-bold text-white">All Presets</h2>
          </div>

          <div className="space-y-2">
            {TOURNAMENT_PRESETS.map((preset) => (
              <PresetPill key={preset.id} presetId={preset.id} />
            ))}
          </div>
        </div>

        {/* ─── Create Custom Button ─────────────────────────────── */}
        <Link
          href="/tournaments/create"
          className="touch-btn w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
        >
          <span className="text-lg">+</span>
          Create Custom Tournament
        </Link>

        {/* ─── Existing Tournaments Link ─────────────────────────── */}
        <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-700/20 text-center">
          <p className="text-xs text-slate-400 mb-3">
            Already have a family tournament running?
          </p>
          <Link
            href="/tournament"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-purple-500/15 border border-purple-500/20 hover:bg-purple-500/25 transition-colors"
          >
            View My Tournaments &rarr;
          </Link>
        </div>

        {/* ─── Info Section ──────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 text-center py-2">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <div className="text-2xl mb-1">🎮</div>
            <p className="text-[10px] text-slate-400">Pick Games</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <div className="text-2xl mb-1">👨‍👩‍👧‍👦</div>
            <p className="text-[10px] text-slate-400">Invite Players</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <AnimatedTrophy size="text-2xl" />
            <p className="text-[10px] text-slate-400">Crown a Winner</p>
          </div>
        </div>
      </div>
    </div>
  )
}
