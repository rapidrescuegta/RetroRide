'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TOURNAMENT_PRESETS, FORMAT_LABELS, type TournamentPreset } from '@/lib/tournament-presets'
import { GAMES } from '@/lib/games'

// ─── Use-case callout cards ─────────────────────────────────────────

const USE_CASE_CALLOUTS = [
  {
    icon: '🏖️',
    title: 'Weekend Showdown',
    description:
      'Get the family together for a weekend of competition. Pick games, set the bracket, crown a champion by Sunday!',
    gradient: 'from-orange-500 to-amber-400',
    border: 'border-orange-500/40',
    glow: 'shadow-orange-500/20',
    presetId: 'weekend-warrior',
  },
  {
    icon: '✈️',
    title: 'Plane Ride Mode',
    description:
      'Long flight? Pass the phone around and compete in quick offline games. No wifi needed!',
    gradient: 'from-sky-500 to-indigo-500',
    border: 'border-sky-500/40',
    glow: 'shadow-sky-500/20',
    presetId: 'plane-ride-challenge',
  },
  {
    icon: '🚗',
    title: 'Road Trip',
    description:
      'Back seat fun — card games and puzzles that work without internet!',
    gradient: 'from-emerald-500 to-green-400',
    border: 'border-emerald-500/40',
    glow: 'shadow-emerald-500/20',
    presetId: 'road-trip',
  },
]

// ─── Preset Card ────────────────────────────────────────────────────

function PresetCard({ preset, index, visible }: { preset: TournamentPreset; index: number; visible: boolean }) {
  const formatInfo = FORMAT_LABELS[preset.format]
  const gameNames = preset.gameIds
    .map((id) => GAMES.find((g) => g.id === id)?.name)
    .filter(Boolean)
    .slice(0, 4)

  return (
    <Link
      href={`/tournaments/create?preset=${preset.id}`}
      className={`group relative flex flex-col rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md bg-white/5 transition-all duration-500 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${index * 60}ms` }}
    >
      {/* Gradient top bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${preset.theme}`} />

      <div className="p-4 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl group-hover:scale-110 transition-transform duration-300">
              {preset.icon}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{preset.name}</h3>
              <span
                className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider bg-gradient-to-r ${preset.theme} text-white/90`}
              >
                {formatInfo.icon} {formatInfo.label}
                {preset.bestOf && preset.bestOf > 1 && ` (${preset.bestOf})`}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">{preset.description}</p>

        {/* Game chips */}
        <div className="flex flex-wrap gap-1 mb-3">
          {gameNames.map((name) => (
            <span
              key={name}
              className="px-2 py-0.5 rounded-full bg-slate-800/60 text-[9px] text-slate-300 border border-slate-700/30"
            >
              {name}
            </span>
          ))}
          {preset.gameIds.length > 4 && (
            <span className="px-2 py-0.5 rounded-full bg-slate-800/60 text-[9px] text-slate-500 border border-slate-700/30">
              +{preset.gameIds.length - 4} more
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-auto mb-3">
          <span>&#9202; {preset.estimatedTime}</span>
          <span>&#128101; Up to {preset.maxPlayers}</span>
          {preset.timedRounds && (
            <span className="text-cyan-400">&#9201; {preset.defaultRoundDuration}s rounds</span>
          )}
        </div>

        {/* CTA */}
        <button
          className={`w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${preset.theme} opacity-90 group-hover:opacity-100 transition-all shadow-lg group-hover:shadow-xl`}
        >
          Start Tournament
        </button>
      </div>
    </Link>
  )
}

// ─── Use-case Callout Card ──────────────────────────────────────────

function CalloutCard({
  callout,
  index,
  visible,
}: {
  callout: (typeof USE_CASE_CALLOUTS)[number]
  index: number
  visible: boolean
}) {
  return (
    <Link
      href={`/tournaments/create?preset=${callout.presetId}`}
      className={`group relative flex items-center gap-4 rounded-2xl p-5 border-2 ${callout.border} overflow-hidden backdrop-blur-md transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] shadow-lg ${callout.glow} ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
      }`}
      style={{ transitionDelay: `${index * 100 + 200}ms` }}
    >
      {/* BG gradient */}
      <div className={`absolute inset-0 bg-gradient-to-r ${callout.gradient} opacity-10`} />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a]/80 to-transparent" />

      <span className="relative text-5xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
        {callout.icon}
      </span>
      <div className="relative min-w-0 flex-1">
        <h3 className="text-sm font-bold text-white">{callout.title}</h3>
        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{callout.description}</p>
        <span
          className={`inline-block mt-3 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r ${callout.gradient} shadow-lg transition-all group-hover:scale-105 group-hover:shadow-xl`}
        >
          Let&apos;s Go
        </span>
      </div>
    </Link>
  )
}

// ─── How It Works Step ──────────────────────────────────────────────

function StepCard({
  step,
  icon,
  title,
  description,
}: {
  step: number
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center text-center bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white mb-3">
        {step}
      </div>
      <span className="text-2xl mb-2">{icon}</span>
      <h4 className="text-xs font-bold text-white mb-1">{title}</h4>
      <p className="text-[10px] text-slate-400 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Main Tournament Hub ────────────────────────────────────────────

export default function TournamentHub() {
  const [animateIn, setAnimateIn] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a1a] pb-12">
      {/* ─── Hero Section ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pt-10 pb-10 text-center">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-cyan-900/40"
            style={{
              animation: 'tournamentGradient 8s ease-in-out infinite alternate',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a1a] via-[#0a0a1a]/60 to-transparent" />
          {/* Subtle radial glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-slate-400 text-xs hover:text-slate-300 transition-colors mb-4"
          >
            &larr; Home
          </Link>

          <div
            className={`transition-all duration-700 ${
              animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <span className="inline-block text-6xl mb-3 animate-bounce" style={{ animationDuration: '2.5s' }}>
              🏆
            </span>
            <h1
              className="text-2xl font-bold bg-gradient-to-r from-amber-300 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '18px' }}
            >
              Tournament Mode
            </h1>
            <p className="text-sm text-slate-400 mt-3 max-w-xs mx-auto leading-relaxed">
              Challenge your family and friends — anywhere, anytime!
            </p>
          </div>
        </div>
      </section>

      <div className="max-w-lg mx-auto px-4 space-y-10">
        {/* ─── Use-case Callouts ───────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎯</span>
            <h2
              className="text-xs font-bold bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent uppercase tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              Perfect For
            </h2>
          </div>

          <div className="space-y-3">
            {USE_CASE_CALLOUTS.map((callout, idx) => (
              <CalloutCard key={callout.title} callout={callout} index={idx} visible={animateIn} />
            ))}
          </div>
        </section>

        {/* ─── Featured Presets Grid ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg animate-pulse">⚡</span>
            <h2
              className="text-xs font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent uppercase tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              Tournament Templates
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TOURNAMENT_PRESETS.map((preset, idx) => (
              <PresetCard key={preset.id} preset={preset} index={idx} visible={animateIn} />
            ))}
          </div>
        </section>

        {/* ─── Active Tournaments ──────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🎮</span>
            <h2
              className="text-xs font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent uppercase tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              Active Tournaments
            </h2>
          </div>

          <div className="rounded-2xl p-8 border border-dashed border-slate-700/40 bg-white/5 backdrop-blur-md text-center">
            <span className="text-4xl block mb-3">🏁</span>
            <p className="text-sm text-slate-400 mb-1 font-medium">No active tournaments yet</p>
            <p className="text-[11px] text-slate-500 mb-4">
              Pick a preset above to start your first tournament!
            </p>
            <Link
              href="/tournaments/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              Create Tournament
            </Link>
          </div>
        </section>

        {/* ─── How It Works ────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📋</span>
            <h2
              className="text-xs font-bold bg-gradient-to-r from-pink-400 to-amber-400 bg-clip-text text-transparent uppercase tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px' }}
            >
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StepCard
              step={1}
              icon="🎲"
              title="Pick a Template"
              description="Choose a preset or build your own custom tournament"
            />
            <StepCard
              step={2}
              icon="👥"
              title="Invite Players"
              description="Share with family and friends — local or online"
            />
            <StepCard
              step={3}
              icon="🏆"
              title="Play & Compete"
              description="Play games, track scores, crown the champion!"
            />
          </div>
        </section>

        {/* ─── Create Custom CTA ───────────────────────────────────── */}
        <Link
          href="/tournaments/create"
          className="touch-btn w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
        >
          <span className="text-lg">+</span>
          Create Custom Tournament
        </Link>

        {/* ─── View Existing Link ──────────────────────────────────── */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center">
          <p className="text-xs text-slate-400 mb-3">Already have a family tournament running?</p>
          <Link
            href="/tournament"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-purple-300 bg-purple-500/15 border border-purple-500/20 hover:bg-purple-500/25 transition-colors"
          >
            View My Tournaments &rarr;
          </Link>
        </div>
      </div>

      {/* ─── Keyframes for animated gradient ──────────────────────── */}
      <style jsx>{`
        @keyframes tournamentGradient {
          0% {
            background-position: 0% 50%;
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
          100% {
            background-position: 100% 50%;
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}
