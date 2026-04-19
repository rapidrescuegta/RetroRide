'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Card, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'
import { playPickup, playExplosion, playWin, playGameOver, playSelect } from '@/lib/sounds'
import {
  type WarState,
  initGame,
  flipCards,
  collectCards,
} from './rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Card Component ─────────────────────────────────────────────────────────

function WarCard({
  card,
  faceUp,
  animating,
  delay = 0,
  size = 'lg',
}: {
  card: Card
  faceUp: boolean
  animating?: boolean
  delay?: number
  size?: 'sm' | 'md' | 'lg'
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
        className={`rounded-lg flex items-center justify-center shrink-0 ${
          animating ? 'animate-[cardDeal_0.3s_ease-out]' : ''
        }`}
        style={{
          width: s.w,
          height: s.h,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          animationDelay: `${delay}ms`,
        }}
      >
        <span className="text-purple-500/40 text-xl">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-lg flex flex-col items-center justify-center shrink-0 ${
        animating ? 'animate-[cardFlip_0.4s_ease-out]' : ''
      }`}
      style={{
        width: s.w,
        height: s.h,
        color,
        background: '#1e293b',
        border: `1px solid ${color}40`,
        boxShadow: `0 0 12px ${color}20`,
        animationDelay: `${delay}ms`,
      }}
    >
      <span className={`${s.rank} font-bold leading-none`}>{card.rank}</span>
      <span className={`${s.center} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function WarGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<WarState>(() => initGame())
  const [showFlash, setShowFlash] = useState(false)
  const [flashText, setFlashText] = useState('')
  const gameOverCalled = useRef(false)

  // Auto-speed based on level
  const autoDelay = level === 'easy' ? 0 : level === 'medium' ? 0 : 0

  // Game over handler
  useEffect(() => {
    if (state.phase === 'game-over' && !gameOverCalled.current) {
      gameOverCalled.current = true
      if (state.playerScore > state.aiScore) {
        playWin()
      } else {
        playGameOver()
      }
      // Score = player's cards (0-52)
      setTimeout(() => onGameOver(state.playerScore), 1500)
    }
  }, [state.phase, state.playerScore, state.aiScore, onGameOver])

  const handleTap = useCallback(() => {
    if (state.phase === 'game-over') return

    if (state.phase === 'resolving') {
      // Collect cards
      setState(prev => collectCards(prev))
      return
    }

    if (state.phase === 'ready' || state.phase === 'war-stakes') {
      const newState = flipCards(state)
      setState(newState)

      // Sound effects
      if (newState.roundWinner === 'war') {
        playExplosion()
        setFlashText('WAR!')
        setShowFlash(true)
        setTimeout(() => setShowFlash(false), 1200)
      } else if (newState.roundWinner === 'player') {
        playPickup()
      } else if (newState.roundWinner === 'ai') {
        playSelect()
      }
    }
  }, [state])

  const handleNewGame = useCallback(() => {
    gameOverCalled.current = false
    setState(initGame())
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col relative select-none overflow-hidden">
      {/* Animation keyframes */}
      <style>{`
        @keyframes cardFlip {
          0% { transform: scaleX(0) rotateY(90deg); opacity: 0.5; }
          50% { transform: scaleX(0.5) rotateY(45deg); opacity: 0.8; }
          100% { transform: scaleX(1) rotateY(0); opacity: 1; }
        }
        @keyframes cardDeal {
          0% { transform: translateY(-20px) scale(0.8); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes warFlash {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1.3); }
          70% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0; transform: scale(0.8); }
        }
        @keyframes cardWin {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); box-shadow: 0 0 20px rgba(16, 185, 129, 0.5); }
          100% { transform: scale(1); }
        }
        @keyframes cardLose {
          0% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>

      {/* Score bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">&#x1F3AE;</span>
          <span className="text-slate-300 text-sm font-medium">You</span>
          <span className="text-emerald-400 font-bold text-lg">{state.playerScore}</span>
        </div>
        <div className="text-xs text-slate-500">
          Round {state.totalRounds}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400 font-bold text-lg">{state.aiScore}</span>
          <span className="text-slate-300 text-sm font-medium">AI</span>
          <span className="text-lg">&#x1F916;</span>
        </div>
      </div>

      {/* Card count bars */}
      <div className="px-4 py-1">
        <div className="flex h-2 rounded-full overflow-hidden bg-slate-800">
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${(state.playerScore / 52) * 100}%` }}
          />
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${(state.aiScore / 52) * 100}%` }}
          />
        </div>
      </div>

      {/* AI deck area */}
      <div className="flex flex-col items-center py-3">
        <span className="text-sm text-slate-500 mb-1">&#x1F916; AI Deck ({state.aiDeck.length})</span>
        <div className="relative w-[72px] h-[100px]">
          {state.aiDeck.length > 0 && (
            <>
              {state.aiDeck.length > 2 && (
                <div className="absolute top-0 left-1" style={{ zIndex: 0 }}>
                  <WarCard card={state.aiDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              {state.aiDeck.length > 1 && (
                <div className="absolute top-0 left-0.5" style={{ zIndex: 1 }}>
                  <WarCard card={state.aiDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              <div className="absolute top-0 left-0" style={{ zIndex: 2 }}>
                <WarCard card={state.aiDeck[0]} faceUp={false} size="lg" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Battle area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* AI's card */}
          <div className="flex items-center gap-2">
            {/* War face-down stakes */}
            {state.warAiCards.length > 0 && (
              <div className="flex -space-x-4">
                {state.warAiCards.map((c, i) => (
                  <WarCard key={c.id} card={c} faceUp={false} size="sm" animating delay={i * 100} />
                ))}
              </div>
            )}
            {state.aiCard && (
              <div
                className="transition-all duration-300"
                style={{
                  animation: state.roundWinner === 'ai'
                    ? 'cardWin 0.5s ease-out'
                    : state.roundWinner === 'player'
                    ? 'cardLose 0.3s ease-out forwards'
                    : undefined,
                }}
              >
                <WarCard card={state.aiCard} faceUp animating size="lg" />
              </div>
            )}
            {!state.aiCard && (
              <div className="w-[72px] h-[100px] rounded-lg border border-dashed border-slate-700/50 flex items-center justify-center">
                <span className="text-slate-600 text-xs">AI</span>
              </div>
            )}
          </div>

          {/* VS / Message */}
          <div className="text-center min-h-[48px] flex flex-col items-center justify-center">
            {state.phase === 'resolving' || state.phase === 'war-stakes' ? (
              <p className={`text-sm font-bold ${
                state.roundWinner === 'player'
                  ? 'text-emerald-400'
                  : state.roundWinner === 'ai'
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}>
                {state.message}
              </p>
            ) : state.phase === 'game-over' ? (
              <p className={`text-lg font-bold ${
                state.playerScore > state.aiScore ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {state.message}
              </p>
            ) : (
              <p className="text-slate-400 text-sm">{state.message}</p>
            )}
            {state.warCount > 0 && state.phase !== 'game-over' && (
              <p className="text-amber-400 text-xs mt-1">
                {state.pot.length} cards at stake!
              </p>
            )}
          </div>

          {/* Player's card */}
          <div className="flex items-center gap-2">
            {state.playerCard && (
              <div
                className="transition-all duration-300"
                style={{
                  animation: state.roundWinner === 'player'
                    ? 'cardWin 0.5s ease-out'
                    : state.roundWinner === 'ai'
                    ? 'cardLose 0.3s ease-out forwards'
                    : undefined,
                }}
              >
                <WarCard card={state.playerCard} faceUp animating size="lg" />
              </div>
            )}
            {!state.playerCard && (
              <div className="w-[72px] h-[100px] rounded-lg border border-dashed border-slate-700/50 flex items-center justify-center">
                <span className="text-slate-600 text-xs">You</span>
              </div>
            )}
            {/* War face-down stakes */}
            {state.warPlayerCards.length > 0 && (
              <div className="flex -space-x-4">
                {state.warPlayerCards.map((c, i) => (
                  <WarCard key={c.id} card={c} faceUp={false} size="sm" animating delay={i * 100} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player deck area */}
      <div className="flex flex-col items-center py-3">
        <div className="relative w-[72px] h-[100px]">
          {state.playerDeck.length > 0 && (
            <>
              {state.playerDeck.length > 2 && (
                <div className="absolute top-0 left-1" style={{ zIndex: 0 }}>
                  <WarCard card={state.playerDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              {state.playerDeck.length > 1 && (
                <div className="absolute top-0 left-0.5" style={{ zIndex: 1 }}>
                  <WarCard card={state.playerDeck[0]} faceUp={false} size="lg" />
                </div>
              )}
              <div className="absolute top-0 left-0" style={{ zIndex: 2 }}>
                <WarCard card={state.playerDeck[0]} faceUp={false} size="lg" />
              </div>
            </>
          )}
        </div>
        <span className="text-sm text-slate-500 mt-1">&#x1F3AE; Your Deck ({state.playerDeck.length})</span>
      </div>

      {/* Action button */}
      <div className="px-4 pb-4 pt-1">
        {state.phase === 'game-over' ? (
          <button
            onClick={handleNewGame}
            className="w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-[0.97] bg-purple-600 hover:bg-purple-500"
          >
            Play Again
          </button>
        ) : (
          <button
            onClick={handleTap}
            className={`w-full py-4 rounded-xl font-bold text-white text-lg transition-all active:scale-[0.97] ${
              state.phase === 'resolving'
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : state.phase === 'war-stakes'
                ? 'bg-amber-600 hover:bg-amber-500 animate-pulse'
                : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
          >
            {state.phase === 'resolving'
              ? 'Collect Cards'
              : state.phase === 'war-stakes'
              ? 'Go to WAR!'
              : 'Flip Cards!'}
          </button>
        )}
      </div>

      {/* War flash overlay */}
      {showFlash && (
        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div
            className="text-5xl font-black text-transparent bg-clip-text"
            style={{
              backgroundImage: 'linear-gradient(135deg, #ef4444, #f59e0b, #ef4444)',
              animation: 'warFlash 1.2s ease-out forwards',
            }}
          >
            {flashText}
          </div>
        </div>
      )}
    </div>
  )
}
