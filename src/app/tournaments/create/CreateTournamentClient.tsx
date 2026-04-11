'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { GAMES } from '@/lib/games'
import { TOURNAMENT_PRESETS, getPresetById, FORMAT_LABELS, type TournamentPreset } from '@/lib/tournament-presets'
import { useFamily } from '@/lib/family-context'
import { isMultiplayerSupported, getPlayerCount } from '@/lib/multiplayer-registry'

// ─── Constants ───────────────────────────────────────────────────────

const MIN_GAMES = 1
const MAX_GAMES = 7
const STEPS = ['Preset', 'Games', 'Details', 'Share'] as const
type Step = typeof STEPS[number]

// ─── Step Indicator ──────────────────────────────────────────────────

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: readonly string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {steps.map((step, idx) => (
        <div key={step} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                idx < currentStep
                  ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg shadow-purple-500/20'
                  : idx === currentStep
                    ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-500/30 ring-2 ring-purple-400/30 scale-110'
                    : 'bg-slate-800/60 text-slate-500 border border-slate-700/50'
              }`}
            >
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className={`text-[9px] mt-1 font-medium ${
              idx <= currentStep ? 'text-slate-300' : 'text-slate-600'
            }`}>
              {step}
            </span>
          </div>
          {idx < steps.length - 1 && (
            <div className={`w-8 h-0.5 mx-1 rounded-full transition-all duration-500 mb-4 ${
              idx < currentStep
                ? 'bg-gradient-to-r from-purple-500 to-cyan-500'
                : 'bg-slate-700/50'
            }`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Preset Card ────────────────────────────────────────────────────

function PresetCard({
  preset,
  isSelected,
  onSelect,
}: {
  preset: TournamentPreset
  isSelected: boolean
  onSelect: () => void
}) {
  const formatInfo = FORMAT_LABELS[preset.format]

  return (
    <button
      onClick={onSelect}
      className={`relative w-full text-left rounded-2xl p-4 border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
        isSelected
          ? 'border-cyan-400/60 ring-2 ring-cyan-400/20 shadow-lg shadow-cyan-500/20'
          : 'border-slate-700/30 hover:border-slate-600/50'
      }`}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${preset.theme} opacity-[0.08] ${
          isSelected ? 'opacity-[0.15]' : ''
        }`}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{preset.icon}</span>
            <div>
              <h3 className="text-sm font-bold text-white">{preset.name}</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
            </div>
          </div>
          {isSelected && (
            <span className="text-cyan-400 text-xs font-semibold bg-cyan-500/15 px-2 py-0.5 rounded-full">
              Selected
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/60 px-2 py-1 rounded-full">
            {formatInfo.icon} {formatInfo.label}
            {preset.bestOf ? ` (${preset.bestOf})` : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/60 px-2 py-1 rounded-full">
            👥 {preset.maxPlayers} players
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/60 px-2 py-1 rounded-full">
            ⏱️ {preset.estimatedTime}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 bg-slate-800/60 px-2 py-1 rounded-full">
            🎮 {preset.gameIds.length === 0 ? '1 random' : `${preset.gameIds.length} games`}
          </span>
          {preset.timedRounds && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-cyan-300 bg-cyan-500/15 px-2 py-1 rounded-full">
              ⏱️ {preset.defaultRoundDuration}s per round
            </span>
          )}
        </div>

        {preset.gameIds.length > 0 && (
          <div className="flex gap-1.5 mt-3">
            {preset.gameIds.map((gameId) => {
              const game = GAMES.find((g) => g.id === gameId)
              return (
                <span key={gameId} className="text-lg" title={game?.name}>
                  {game?.icon || '🎮'}
                </span>
              )
            })}
          </div>
        )}
      </div>
    </button>
  )
}

// ─── Game Picker (Step 2) ────────────────────────────────────────────

function GamePicker({
  selectedGames,
  onToggle,
}: {
  selectedGames: Set<string>
  onToggle: (gameId: string) => void
}) {
  const [filter, setFilter] = useState<'all' | 'kids' | 'everyone' | 'adults'>('all')

  const filteredGames = filter === 'all'
    ? GAMES
    : GAMES.filter((g) => g.difficulty === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-300">
          Pick Your Games ({selectedGames.size}/{MAX_GAMES})
        </label>
        <span className={`text-xs ${selectedGames.size >= MIN_GAMES ? 'text-emerald-400' : 'text-amber-400'}`}>
          {selectedGames.size < MIN_GAMES
            ? `Need ${MIN_GAMES - selectedGames.size} more`
            : 'Ready'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(selectedGames.size / MAX_GAMES) * 100}%`,
            background: selectedGames.size >= MIN_GAMES
              ? 'linear-gradient(90deg, #10b981, #06b6d4)'
              : 'linear-gradient(90deg, #f59e0b, #ef4444)',
          }}
        />
      </div>

      {/* Difficulty filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All', icon: '🎮' },
          { key: 'kids', label: 'Kids', icon: '👶' },
          { key: 'everyone', label: 'Everyone', icon: '👨‍👩‍👧‍👦' },
          { key: 'adults', label: 'Adults', icon: '🎯' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`flex-1 py-2 rounded-xl text-[10px] font-medium border transition-all ${
              filter === f.key
                ? 'border-purple-500/50 bg-purple-500/15 text-purple-300'
                : 'border-slate-700/30 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
        {filteredGames.map((game) => {
          const isSelected = selectedGames.has(game.id)
          const isDisabled = !isSelected && selectedGames.size >= MAX_GAMES

          return (
            <button
              key={game.id}
              onClick={() => !isDisabled && onToggle(game.id)}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all border ${
                isSelected
                  ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-500/10'
                  : isDisabled
                    ? 'border-slate-700/20 bg-slate-900/30 opacity-40 cursor-not-allowed'
                    : 'border-slate-700/30 bg-slate-800/30 hover:bg-slate-700/40 hover:border-slate-600/50'
              }`}
            >
              <span className="text-xl flex-shrink-0">{game.icon}</span>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                  {game.name}
                </p>
                <p className="text-[9px] text-slate-500 truncate">{game.description}</p>
              </div>
              {isSelected && (
                <span className="text-cyan-400 text-xs flex-shrink-0">✓</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Share / Room Code Panel (Step 4) ────────────────────────────────

function SharePanel({ tournamentName }: { tournamentName: string }) {
  const [copied, setCopied] = useState(false)
  const roomCode = useState(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  })[0]

  const shareLink = typeof window !== 'undefined'
    ? `${window.location.origin}/tournaments/join?code=${roomCode}`
    : `https://gamebuddi.com/tournaments/join?code=${roomCode}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my ${tournamentName} tournament on GameBuddi!`,
          text: `Use code ${roomCode} to join the tournament!`,
          url: shareLink,
        })
      } catch {
        // user cancelled
      }
    }
  }

  return (
    <div className="space-y-5">
      {/* Room code */}
      <div className="text-center">
        <p className="text-xs text-slate-400 mb-3">Share this code with your players</p>
        <div className="inline-flex items-center gap-1 px-6 py-4 rounded-2xl bg-slate-800/60 border-2 border-dashed border-cyan-500/30">
          {roomCode.split('').map((char, i) => (
            <span
              key={i}
              className="text-2xl font-bold text-cyan-400 tracking-widest"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {char}
            </span>
          ))}
        </div>
      </div>

      {/* Copy link */}
      <button
        onClick={handleCopy}
        className={`w-full py-3 rounded-xl text-sm font-medium border transition-all ${
          copied
            ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
            : 'border-slate-700/30 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50'
        }`}
      >
        {copied ? '✓ Link Copied!' : '📋 Copy Invite Link'}
      </button>

      {/* Native share */}
      {typeof navigator !== 'undefined' && 'share' in navigator && (
        <button
          onClick={handleShare}
          className="w-full py-3 rounded-xl text-sm font-medium border border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 transition-all"
        >
          📤 Share via...
        </button>
      )}

      {/* Link preview */}
      <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Invite Link</p>
        <p className="text-xs text-slate-400 break-all font-mono">{shareLink}</p>
      </div>
    </div>
  )
}

// ─── Main Create Wizard ──────────────────────────────────────────────

export default function CreateTournamentClient() {
  const searchParams = useSearchParams()
  const presetParam = searchParams.get('preset')
  const familyCtx = useFamily()

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [selectedGames, setSelectedGames] = useState<Set<string>>(new Set())
  const [format, setFormat] = useState<'elimination' | 'round-robin' | 'best-of'>('round-robin')
  const [tournamentType, setTournamentType] = useState<'score-based' | 'elimination'>('score-based')
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set())
  const [eliminationGameId, setEliminationGameId] = useState<string>('')
  const [bestOf, setBestOf] = useState(3)
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [timedRounds, setTimedRounds] = useState(false)
  const [roundDuration, setRoundDuration] = useState(60)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Auto-select preset from URL param
  useEffect(() => {
    if (presetParam) {
      const preset = getPresetById(presetParam)
      if (preset) {
        applyPreset(preset)
        setStep(2) // Jump to details step since preset fills step 1+2
      }
    }
  }, [presetParam])

  const applyPreset = useCallback((preset: TournamentPreset) => {
    setSelectedPresetId(preset.id)
    setName(preset.name)
    setFormat(preset.format)
    setMaxPlayers(preset.maxPlayers)
    if (preset.bestOf) setBestOf(preset.bestOf)
    if (preset.timedRounds) {
      setTimedRounds(true)
      setRoundDuration(preset.defaultRoundDuration || 60)
    } else {
      setTimedRounds(false)
    }

    if (preset.gameIds.length > 0) {
      setSelectedGames(new Set(preset.gameIds))
    } else {
      const randomGame = GAMES[Math.floor(Math.random() * GAMES.length)]
      setSelectedGames(new Set([randomGame.id]))
    }
  }, [])

  const handlePresetSelect = (preset: TournamentPreset) => {
    if (selectedPresetId === preset.id) {
      setSelectedPresetId(null)
      setName('')
      setSelectedGames(new Set())
      setFormat('round-robin')
      setMaxPlayers(4)
      setBestOf(3)
      setTimedRounds(false)
    } else {
      applyPreset(preset)
    }
  }

  const toggleGame = (gameId: string) => {
    setSelectedPresetId(null)
    setSelectedGames((prev) => {
      const next = new Set(prev)
      if (next.has(gameId)) {
        next.delete(gameId)
      } else if (next.size < MAX_GAMES) {
        next.add(gameId)
      }
      return next
    })
  }

  const canProceedFromStep = (s: number): boolean => {
    switch (s) {
      case 0: return true // Preset step is optional
      case 1: return selectedGames.size >= MIN_GAMES
      case 2: return name.trim().length > 0 && selectedGames.size >= MIN_GAMES
      case 3: return true
      default: return false
    }
  }

  const nextStep = () => {
    if (step < STEPS.length - 1 && canProceedFromStep(step)) {
      setStep(step + 1)
      setError('')
    }
  }

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1)
      setError('')
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give your tournament a name!')
      return
    }
    if (selectedGames.size < MIN_GAMES) {
      setError(`Pick at least ${MIN_GAMES} game`)
      return
    }

    setCreating(true)
    setError('')

    try {
      const familyId = familyCtx?.family?.id
      const createdBy = familyCtx?.member?.id

      const bodyData: Record<string, unknown> = {
        name: name.trim(),
        familyId,
        createdBy,
      }

      if (tournamentType === 'elimination') {
        bodyData.format = 'elimination'
        bodyData.gameId = eliminationGameId
        bodyData.participantIds = Array.from(selectedParticipants)
      } else {
        bodyData.gameIds = Array.from(selectedGames)
        bodyData.format = format
        bodyData.bestOf = format === 'best-of' ? bestOf : undefined
        bodyData.maxPlayers = maxPlayers
        bodyData.presetId = selectedPresetId || undefined
        bodyData.timedRounds = timedRounds
        bodyData.roundDuration = timedRounds ? roundDuration : undefined
      }

      const res = await fetch('/api/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData),
      })

      const data = await res.json()
      if (data.error) {
        setError(data.error)
        return
      }

      setSuccess(true)
      setStep(3) // Move to share step
    } catch {
      setError('Failed to create tournament. Try again!')
    } finally {
      setCreating(false)
    }
  }

  // ─── Success / Share State ──────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen pb-8 page-enter">
        <header className="relative px-4 pt-8 pb-6 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/20 to-transparent" />
          <div className="relative">
            <span className="text-6xl block mb-3 animate-bounce" style={{ animationDuration: '2s' }}>🎉</span>
            <h1
              className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              Tournament Created!
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Share the code below to invite players
            </p>
          </div>
        </header>

        <div className="max-w-md mx-auto px-4 space-y-6">
          <SharePanel tournamentName={name} />

          {/* Selected games preview */}
          <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Tournament Lineup
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(selectedGames).map((gameId) => {
                const game = GAMES.find((g) => g.id === gameId)
                if (!game) return null
                return (
                  <span
                    key={gameId}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-800/60 border border-slate-700/30 text-slate-300"
                  >
                    {game.icon} {game.name}
                  </span>
                )
              })}
            </div>
            {timedRounds && (
              <p className="text-[10px] text-cyan-400 mt-2">
                ⏱️ Timed rounds: {roundDuration} seconds per game
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href="/tournament"
              className="touch-btn inline-flex justify-center px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
            >
              View Tournaments
            </Link>
            <Link
              href="/tournaments"
              className="text-sm text-slate-400 hover:text-slate-300 transition-colors text-center"
            >
              &larr; Back to Hub
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ─── Wizard Render ──────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-8 pb-4 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/tournaments" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
            &larr; Back
          </Link>
          <h1
            className="text-xl font-bold neon-text mt-3"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
          >
            Create Tournament
          </h1>
          <p className="text-xs text-slate-500 mt-2">
            {step === 0 && 'Pick a preset or start custom'}
            {step === 1 && 'Choose the games for your tournament'}
            {step === 2 && 'Name it, pick the format, and go'}
            {step === 3 && 'Share with your players'}
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4">
        {/* Step indicator */}
        <StepIndicator currentStep={step} steps={STEPS} />

        {/* ─── Step 0: Format + Preset Selection ────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            {/* Tournament Type Chooser */}
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">
                Tournament Format
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setTournamentType('score-based')}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    tournamentType === 'score-based'
                      ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/20'
                      : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl block mb-2">📊</span>
                  <span className="text-xs font-bold text-white block">Score-Based</span>
                  <span className="text-[10px] text-slate-400">Everyone plays, top scores win</span>
                </button>
                <button
                  onClick={() => setTournamentType('elimination')}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    tournamentType === 'elimination'
                      ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/20'
                      : 'border-slate-700/40 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl block mb-2">🏒</span>
                  <span className="text-xs font-bold text-white block">Playoff Bracket</span>
                  <span className="text-[10px] text-slate-400">1v1 elimination, like the NHL</span>
                </button>
              </div>
            </div>

            {/* Elimination setup (shown when elimination is selected) */}
            {tournamentType === 'elimination' && (
              <div className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <div>
                  <p className="text-xs text-amber-400 font-bold mb-2">Pick the game</p>
                  <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {GAMES.filter(g => {
                      const config = getPlayerCount(g.id)
                      return config ? config.min <= 2 : true
                    }).map(game => (
                      <button
                        key={game.id}
                        onClick={() => setEliminationGameId(game.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${
                          eliminationGameId === game.id
                            ? 'bg-amber-500/20 border border-amber-500/40'
                            : 'bg-slate-800/40 border border-slate-700/30 hover:border-slate-600'
                        }`}
                      >
                        <span className="text-xl">{game.icon}</span>
                        <span className="text-[10px] text-slate-300 truncate w-full">{game.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-amber-400 font-bold mb-2">
                    Select players ({selectedParticipants.size} selected, need 2-16)
                  </p>
                  {familyCtx?.members && familyCtx.members.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {familyCtx.members.map((m) => {
                        const isSelected = selectedParticipants.has(m.id)
                        return (
                          <button
                            key={m.id}
                            onClick={() => {
                              setSelectedParticipants(prev => {
                                const next = new Set(prev)
                                if (next.has(m.id)) next.delete(m.id)
                                else if (next.size < 16) next.add(m.id)
                                return next
                              })
                            }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                              isSelected
                                ? 'bg-amber-500/20 border border-amber-500/40'
                                : 'bg-slate-800/40 border border-slate-700/30 hover:border-slate-600'
                            }`}
                          >
                            <span className="text-lg">{m.avatar || '😀'}</span>
                            <span className="text-xs text-white">{m.name}</span>
                            {isSelected && <span className="text-amber-400 text-xs">✓</span>}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Load family members to select participants</p>
                  )}
                </div>

                {/* Tournament name */}
                <div>
                  <p className="text-xs text-amber-400 font-bold mb-2">Tournament name</p>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder={`${GAMES.find(g => g.id === eliminationGameId)?.name || 'Game'} Playoff`}
                    className="w-full bg-slate-800/60 text-white rounded-xl px-4 py-3 border border-slate-600/50 focus:border-amber-500/50 focus:outline-none text-sm placeholder:text-slate-500"
                  />
                </div>
              </div>
            )}

            {/* Score-based presets (shown when score-based is selected) */}
            {tournamentType === 'score-based' && (
            <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚡</span>
              <h2 className="text-sm font-bold text-white">Quick Start</h2>
              <span className="text-[10px] text-slate-500">Pick a preset or skip to custom</span>
            </div>

            <div className="space-y-3">
              {TOURNAMENT_PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isSelected={selectedPresetId === preset.id}
                  onSelect={() => handlePresetSelect(preset)}
                />
              ))}
            </div>
            </div>
            )}
          </div>
        )}

        {/* ─── Step 1: Game Selection ────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <GamePicker selectedGames={selectedGames} onToggle={toggleGame} />

            {/* Selected games preview */}
            {selectedGames.size > 0 && (
              <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                  Your Tournament Lineup
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedGames).map((gameId) => {
                    const game = GAMES.find((g) => g.id === gameId)
                    if (!game) return null
                    return (
                      <span
                        key={gameId}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium"
                        style={{
                          background: `${game.color}15`,
                          border: `1px solid ${game.color}30`,
                          color: game.color,
                        }}
                      >
                        {game.icon} {game.name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Tournament Details ────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Tournament name */}
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">
                Tournament Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekend Showdown"
                maxLength={40}
                className="w-full bg-slate-800/60 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 border border-slate-700/50 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-colors text-sm"
              />
            </div>

            {/* Format selector */}
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">
                Tournament Format
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['round-robin', 'elimination', 'best-of'] as const).map((f) => {
                  const info = FORMAT_LABELS[f]
                  return (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition-all ${
                        format === f
                          ? 'border-purple-500/50 bg-purple-500/15 text-purple-300 shadow-lg shadow-purple-500/10'
                          : 'border-slate-700/30 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40'
                      }`}
                    >
                      {info.icon} {info.label}
                    </button>
                  )
                })}
              </div>

              {format === 'best-of' && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-xs text-slate-400">Best of:</label>
                  <div className="flex gap-2">
                    {[1, 3, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setBestOf(n)}
                        className={`w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                          bestOf === n
                            ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                            : 'border-slate-700/30 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Max players */}
            <div>
              <label className="text-sm font-semibold text-slate-300 block mb-1.5">
                Max Players
              </label>
              <div className="flex gap-2">
                {[2, 4, 6, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setMaxPlayers(n)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                      maxPlayers === n
                        ? 'border-purple-500/50 bg-purple-500/15 text-purple-300 shadow-lg shadow-purple-500/10'
                        : 'border-slate-700/30 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40'
                    }`}
                  >
                    👥 {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Timed rounds toggle */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-300">
                  Timed Rounds
                </label>
                <button
                  onClick={() => setTimedRounds(!timedRounds)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                    timedRounds
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-500'
                      : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
                      timedRounds ? 'left-6' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Each game round has a countdown timer
              </p>

              {timedRounds && (
                <div className="mt-3">
                  <label className="text-xs text-slate-400 block mb-2">Seconds per round</label>
                  <div className="flex gap-2">
                    {[30, 60, 90, 120, 180].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRoundDuration(s)}
                        className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-all ${
                          roundDuration === s
                            ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300'
                            : 'border-slate-700/30 bg-slate-800/30 text-slate-400 hover:bg-slate-700/40'
                        }`}
                      >
                        {s < 60 ? `${s}s` : `${s / 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Summary preview */}
            <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/20">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
                Tournament Summary
              </p>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between">
                  <span>Name</span>
                  <span className="text-white font-medium">{name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="text-white font-medium">
                    {FORMAT_LABELS[format].icon} {FORMAT_LABELS[format].label}
                    {format === 'best-of' ? ` (${bestOf})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Players</span>
                  <span className="text-white font-medium">👥 {maxPlayers}</span>
                </div>
                <div className="flex justify-between">
                  <span>Games</span>
                  <span className="text-white font-medium">🎮 {selectedGames.size}</span>
                </div>
                {timedRounds && (
                  <div className="flex justify-between">
                    <span>Timer</span>
                    <span className="text-cyan-400 font-medium">⏱️ {roundDuration}s per round</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Share ─────────────────────────────────────── */}
        {step === 3 && (
          <SharePanel tournamentName={name} />
        )}

        {/* ─── Error ─────────────────────────────────────────────── */}
        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
            {error}
          </div>
        )}

        {/* ─── Navigation Buttons ────────────────────────────────── */}
        <div className="flex gap-3 mt-6">
          {step > 0 ? (
            <button
              onClick={prevStep}
              className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-400 bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/50 transition-colors"
            >
              &larr; Back
            </button>
          ) : (
            <Link
              href="/tournaments"
              className="flex-1 py-3 rounded-xl text-sm font-medium text-slate-400 bg-slate-800/50 border border-slate-700/30 hover:bg-slate-700/50 transition-colors text-center"
            >
              Cancel
            </Link>
          )}

          {/* Elimination: create directly from step 0 */}
          {tournamentType === 'elimination' && step === 0 ? (
            <button
              onClick={() => {
                if (!name.trim()) setName(`${GAMES.find(g => g.id === eliminationGameId)?.name || 'Game'} Playoff`)
                handleCreate()
              }}
              disabled={creating || !eliminationGameId || selectedParticipants.size < 2}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                '🏒 Create Playoff Bracket →'
              )}
            </button>
          ) : step < 2 ? (
            <button
              onClick={nextStep}
              disabled={!canProceedFromStep(step)}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {selectedPresetId && step === 0 ? 'Use Preset →' : 'Next →'}
            </button>
          ) : step === 2 ? (
            <button
              onClick={handleCreate}
              disabled={creating || !canProceedFromStep(step)}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {creating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create & Share →'
              )}
            </button>
          ) : (
            <Link
              href="/tournament"
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98] text-center"
            >
              View Tournaments →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
