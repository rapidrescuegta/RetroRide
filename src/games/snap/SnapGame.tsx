'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Card, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'
import { playPickup, playExplosion, playWin, playGameOver, playSelect } from '@/lib/sounds'
import {
  type SnapState,
  initGame,
  flipCard,
  slap,
  expireSnapWindow,
  continueAfterPile,
  aiReactionTime,
  aiFlipDelay,
  aiWrongSlapChance,
} from './rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Card Component ─────────────────────────────────────────────────────────

function SnapCard({
  card,
  faceUp,
  size = 'lg',
  animating = false,
  highlight = false,
}: {
  card: Card
  faceUp: boolean
  size?: 'sm' | 'md' | 'lg'
  animating?: boolean
  highlight?: boolean
}) {
  const sizes = {
    sm: { w: 40, h: 56, rank: 'text-[9px]', suit: 'text-xs', center: 'text-base' },
    md: { w: 56, h: 78, rank: 'text-xs', suit: 'text-lg', center: 'text-xl' },
    lg: { w: 72, h: 100, rank: 'text-sm', suit: 'text-xl', center: 'text-2xl' },
  }
  const s = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        className="rounded-lg flex items-center justify-center shrink-0"
        style={{
          width: s.w,
          height: s.h,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <span className="text-purple-500/40 text-xl">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg flex flex-col items-center justify-center shrink-0 ${
        animating ? 'animate-[snapFlip_0.25s_ease-out]' : ''
      }`}
      style={{
        width: s.w,
        height: s.h,
        color,
        background: '#1e293b',
        border: highlight ? `2px solid #f59e0b` : `1px solid ${color}40`,
        boxShadow: highlight ? '0 0 24px rgba(245, 158, 11, 0.6)' : `0 0 12px ${color}20`,
      }}
    >
      <span className={`${s.rank} font-bold leading-none`}>{card.rank}</span>
      <span className={`${s.center} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function SnapGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<SnapState>(() => initGame())
  const [showSnapFlash, setShowSnapFlash] = useState(false)
  const [wrongFlash, setWrongFlash] = useState<'player' | 'ai' | null>(null)
  const gameOverCalled = useRef(false)
  const snapWindowTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiReactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aiFlipTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      snapWindowTimer.current && clearTimeout(snapWindowTimer.current)
      aiReactionTimer.current && clearTimeout(aiReactionTimer.current)
      aiFlipTimer.current && clearTimeout(aiFlipTimer.current)
      resolveTimer.current && clearTimeout(resolveTimer.current)
    }
  }, [])

  // Game over handler — score = player's card count
  useEffect(() => {
    if (state.phase === 'game-over' && !gameOverCalled.current) {
      gameOverCalled.current = true
      const playerCards = state.playerDeck.length + (state.lastFlipper === 'player' ? 0 : 0)
      if (playerCards > state.aiDeck.length) {
        playWin()
      } else {
        playGameOver()
      }
      // Score scaled: 52 = total win, 0 = total loss
      const score = state.playerDeck.length + (state.playerPiles * 2)
      setTimeout(() => onGameOver(score), 1500)
    }
  }, [state.phase, state.playerDeck.length, state.aiDeck.length, state.lastFlipper, state.playerPiles, onGameOver])

  // Snap window expiry + AI reaction
  useEffect(() => {
    if (state.phase !== 'snap-window') return

    // Schedule AI attempt to slap
    const reactMs = aiReactionTime(level)
    aiReactionTimer.current = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'snap-window') return prev
        playExplosion()
        setShowSnapFlash(true)
        setTimeout(() => setShowSnapFlash(false), 600)
        return slap(prev, 'ai')
      })
    }, reactMs)

    // Window expiry (~2.2s after flip)
    snapWindowTimer.current = setTimeout(() => {
      setState(prev => expireSnapWindow(prev))
    }, 2200)

    return () => {
      aiReactionTimer.current && clearTimeout(aiReactionTimer.current)
      snapWindowTimer.current && clearTimeout(snapWindowTimer.current)
    }
  }, [state.phase, state.animationKey, level])

  // AI auto-flip when it's AI's turn
  useEffect(() => {
    if (state.phase !== 'idle') return
    if (state.nextFlipper !== 'ai') return

    const delay = aiFlipDelay(level)
    aiFlipTimer.current = setTimeout(() => {
      setState(prev => {
        if (prev.phase !== 'idle' || prev.nextFlipper !== 'ai') return prev
        playSelect()
        return flipCard(prev)
      })

      // Occasionally the AI will wrong-slap during idle (fake-out)
      if (Math.random() < aiWrongSlapChance(level)) {
        setTimeout(() => {
          setState(prev => {
            const top = prev.pile[prev.pile.length - 1]
            const prevCard = prev.pile[prev.pile.length - 2]
            const isMatch = top && prevCard && top.rank === prevCard.rank
            if (isMatch) return prev // genuine match — normal slap path will handle
            setWrongFlash('ai')
            setTimeout(() => setWrongFlash(null), 700)
            return slap(prev, 'ai')
          })
        }, 120)
      }
    }, delay)

    return () => {
      aiFlipTimer.current && clearTimeout(aiFlipTimer.current)
    }
  }, [state.phase, state.nextFlipper, state.animationKey, level])

  // Auto-advance after pile resolution
  useEffect(() => {
    if (state.phase !== 'resolving') return
    resolveTimer.current = setTimeout(() => {
      setState(prev => continueAfterPile(prev))
    }, 1200)
    return () => {
      resolveTimer.current && clearTimeout(resolveTimer.current)
    }
  }, [state.phase, state.animationKey])

  const handleFlip = useCallback(() => {
    if (state.phase !== 'idle') return
    if (state.nextFlipper !== 'player') return
    playSelect()
    setState(prev => flipCard(prev))
  }, [state.phase, state.nextFlipper])

  const handleSlap = useCallback(() => {
    if (state.phase === 'game-over' || state.phase === 'resolving') return
    const top = state.pile[state.pile.length - 1]
    const prevCard = state.pile[state.pile.length - 2]
    const isMatch = top && prevCard && top.rank === prevCard.rank
    if (isMatch && state.phase === 'snap-window') {
      playExplosion()
      setShowSnapFlash(true)
      setTimeout(() => setShowSnapFlash(false), 600)
    } else {
      setWrongFlash('player')
      setTimeout(() => setWrongFlash(null), 700)
    }
    setState(prev => slap(prev, 'player'))
  }, [state.phase, state.pile])

  const handleNewGame = useCallback(() => {
    gameOverCalled.current = false
    setState(initGame())
  }, [])

  const top = state.pile[state.pile.length - 1]
  const prev = state.pile[state.pile.length - 2]
  const isMatch = Boolean(top && prev && top.rank === prev.rank)

  const totalCards = state.playerDeck.length + state.aiDeck.length + state.pile.length
  const playerPct = totalCards > 0 ? (state.playerDeck.length / totalCards) * 100 : 50
  const aiPct = totalCards > 0 ? (state.aiDeck.length / totalCards) * 100 : 50

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col relative select-none overflow-hidden">
      {/* Animation keyframes */}
      <style>{`
        @keyframes snapFlip {
          0% { transform: scale(0.6) rotateY(90deg); opacity: 0.4; }
          60% { transform: scale(1.08) rotateY(0); opacity: 1; }
          100% { transform: scale(1) rotateY(0); opacity: 1; }
        }
        @keyframes snapPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 24px rgba(245, 158, 11, 0.4); }
          50% { transform: scale(1.04); box-shadow: 0 0 36px rgba(245, 158, 11, 0.8); }
        }
        @keyframes snapFlash {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1.3); }
          70% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes wrongShake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>

      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">{'\u{1F3AE}'}</span>
          <span className="text-slate-300 text-sm font-medium">You</span>
          <span className="text-emerald-400 font-bold text-lg">{state.playerDeck.length}</span>
        </div>
        <div className="text-xs text-slate-500">
          Round {state.totalRounds}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold text-lg">{state.aiDeck.length}</span>
          <span className="text-slate-300 text-sm font-medium">AI</span>
          <span className="text-lg">{'\u{1F916}'}</span>
        </div>
      </div>

      {/* Card count bars */}
      <div className="px-4 py-1">
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${playerPct}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${aiPct}%` }}
          />
        </div>
      </div>

      {/* AI deck */}
      <div className="flex flex-col items-center py-3">
        <span className="text-sm text-slate-500 mb-1">{'\u{1F916}'} AI Deck ({state.aiDeck.length})</span>
        <div className="relative w-[72px] h-[100px]">
          {state.aiDeck.length > 0 && (
            <>
              {state.aiDeck.length > 2 && (
                <div className="absolute top-0 left-1" style={{ zIndex: 0 }}>
                  <SnapCard card={state.aiDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              {state.aiDeck.length > 1 && (
                <div className="absolute top-0 left-0.5" style={{ zIndex: 1 }}>
                  <SnapCard card={state.aiDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              <div className="absolute top-0 left-0" style={{ zIndex: 2 }}>
                <SnapCard card={state.aiDeck[0]} faceUp={false} size="lg" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pile area */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        {/* Pile stack: shows last two cards for rank comparison */}
        <div className="flex items-center gap-3">
          {prev && (
            <div className="opacity-60">
              <SnapCard card={prev} faceUp size="md" />
            </div>
          )}
          {top ? (
            <div
              className={isMatch && state.phase === 'snap-window' ? 'animate-[snapPulse_0.6s_ease-in-out_infinite]' : ''}
            >
              <SnapCard
                card={top}
                faceUp
                size="lg"
                animating
                highlight={isMatch && state.phase === 'snap-window'}
              />
            </div>
          ) : (
            <div className="w-[72px] h-[100px] rounded-lg border border-dashed border-slate-700/50 flex items-center justify-center">
              <span className="text-slate-600 text-xs">Pile</span>
            </div>
          )}
        </div>

        <p className="text-xs text-slate-500">Pile: {state.pile.length} card{state.pile.length === 1 ? '' : 's'}</p>

        {/* Message */}
        <div className="text-center min-h-[28px]">
          <p className={`text-sm font-bold ${
            state.phase === 'snap-window' ? 'text-amber-400 animate-pulse' :
            state.phase === 'game-over'
              ? (state.playerDeck.length > state.aiDeck.length ? 'text-emerald-400' : 'text-red-400')
              : 'text-slate-400'
          }`}>
            {state.message}
          </p>
        </div>
      </div>

      {/* Player deck */}
      <div className="flex flex-col items-center py-3">
        <div className="relative w-[72px] h-[100px]">
          {state.playerDeck.length > 0 && (
            <>
              {state.playerDeck.length > 2 && (
                <div className="absolute top-0 left-1" style={{ zIndex: 0 }}>
                  <SnapCard card={state.playerDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              {state.playerDeck.length > 1 && (
                <div className="absolute top-0 left-0.5" style={{ zIndex: 1 }}>
                  <SnapCard card={state.playerDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              <div className="absolute top-0 left-0" style={{ zIndex: 2 }}>
                <SnapCard card={state.playerDeck[0]} faceUp={false} size="lg" />
              </div>
            </>
          )}
        </div>
        <span className="text-sm text-slate-500 mt-1">{'\u{1F3AE}'} Your Deck ({state.playerDeck.length})</span>
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-1 flex gap-2">
        {state.phase === 'game-over' ? (
          <button
            onClick={handleNewGame}
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-[0.97] bg-purple-600 hover:bg-purple-500"
          >
            Play Again
          </button>
        ) : (
          <>
            <button
              onClick={handleFlip}
              disabled={state.phase !== 'idle' || state.nextFlipper !== 'player'}
              className={`flex-1 py-4 rounded-xl font-bold text-white text-base transition-all active:scale-[0.97] ${
                state.phase === 'idle' && state.nextFlipper === 'player'
                  ? 'bg-cyan-600 hover:bg-cyan-500'
                  : 'bg-slate-800 text-slate-600'
              }`}
            >
              Flip
            </button>
            <button
              onClick={handleSlap}
              className={`flex-1 py-4 rounded-xl font-bold text-white text-base transition-all active:scale-[0.97] ${
                state.phase === 'snap-window'
                  ? 'bg-amber-500 hover:bg-amber-400 animate-pulse'
                  : 'bg-rose-700 hover:bg-rose-600'
              } ${wrongFlash === 'player' ? 'animate-[wrongShake_0.4s]' : ''}`}
            >
              SLAP!
            </button>
          </>
        )}
      </div>

      {/* SNAP flash overlay */}
      {showSnapFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div
            className="text-5xl font-black text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(135deg, #f59e0b, #ef4444, #f59e0b)',
              animation: 'snapFlash 0.9s ease-out forwards',
            }}
          >
            SNAP!
          </div>
        </div>
      )}

      {wrongFlash === 'ai' && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 pointer-events-none bg-slate-900/90 border border-rose-500/50 rounded-lg px-3 py-1.5">
          <span className="text-rose-400 text-xs font-bold">AI wrong-slapped!</span>
        </div>
      )}
    </div>
  )
}
