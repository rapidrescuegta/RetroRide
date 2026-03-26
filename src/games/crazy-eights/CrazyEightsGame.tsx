'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { playSound } from '@/lib/audio';
import {
  type Suit,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  SUITS,
} from '@/lib/card-engine'
import {
  type CrazyEightsState,
  initGame,
  playCard,
  chooseSuit,
  drawCard,
  pass,
  startNewRound,
  getAIMove,
  getAISuitChoice,
  getPlayableCards,
  hasPlayableCard,
  isStalemate,
  handPoints,
} from './crazy-eights-rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Card Component ─────────────────────────────────────────────────────────

function CardView({
  card,
  selected,
  onClick,
  faceUp = true,
  size = 'md',
  playable = false,
  disabled = false,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  disabled?: boolean
}) {
  const sizes = {
    sm: { w: 44, h: 62, rank: 'text-[10px]', suit: 'text-sm' },
    md: { w: 56, h: 78, rank: 'text-xs', suit: 'text-lg' },
    lg: { w: 72, h: 100, rank: 'text-sm', suit: 'text-xl' },
  }
  const { w, h, rank: rankSize, suit: suitSize } = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        className="rounded-lg flex items-center justify-center shrink-0"
        style={{
          width: w,
          height: h,
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
      onClick={disabled ? undefined : onClick}
      className={`rounded-lg flex flex-col items-center justify-center shrink-0transition-all duration-200 ${
        onClick && !disabled ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${selected ? '-translate-y-3 ring-2 ring-cyan-400' : ''} ${
        playable && !selected ? 'ring-1 ring-cyan-400/40' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      style={{
        width: w,
        height: h,
        color,
        background: card.rank === '8'
          ? 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)'
          : '#1e293b',
        border: card.rank === '8'
          ? '1px solid rgba(167, 139, 250, 0.6)'
          : '1px solid rgba(100, 116, 139, 0.4)',
        boxShadow: card.rank === '8' ? '0 0 8px rgba(139, 92, 246, 0.3)' : undefined,
      }}
    >
      <span className={`${rankSize} font-bold leading-none`}>{card.rank}</span>
      <span className={`${suitSize} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Suit Picker ────────────────────────────────────────────────────────────

function SuitPicker({ onChoose }: { onChoose: (suit: Suit) => void }) {
  const suitButtons: { suit: Suit; bg: string }[] = [
    { suit: 'hearts', bg: 'rgba(239, 68, 68, 0.2)' },
    { suit: 'diamonds', bg: 'rgba(239, 68, 68, 0.2)' },
    { suit: 'clubs', bg: 'rgba(226, 232, 240, 0.15)' },
    { suit: 'spades', bg: 'rgba(226, 232, 240, 0.15)' },
  ]

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 text-center">
        <p className="text-white font-bold text-lg mb-1">CRAZY EIGHT!</p>
        <p className="text-slate-400 text-sm mb-4">Choose a suit</p>
        <div className="grid grid-cols-2 gap-3">
          {suitButtons.map(({ suit, bg }) => (
            <button
              key={suit}
              onClick={() => onChoose(suit)}
              className="w-20 h-20 rounded-xl flex flex-col items-center justify-center text-3xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: bg,
                color: SUIT_COLORS[suit],
                border: `2px solid ${SUIT_COLORS[suit]}40`,
              }}
            >
              <span>{SUIT_SYMBOLS[suit]}</span>
              <span className="text-[10px] mt-1 capitalize">{suit}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Crazy Eights Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-purple-400">Goal:</strong> Get rid of all your cards first!</p>
          <p><strong className="text-purple-400">Play:</strong> Match the top card by suit or rank.</p>
          <p><strong className="text-purple-400">8s are wild!</strong> Play any 8 anytime and pick the new suit.</p>
          <p><strong className="text-purple-400">Draw:</strong> If you can not play, draw from the deck.</p>
          <p><strong className="text-purple-400">Scoring:</strong> Winner scores points from other players hands:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>8s = 50 pts</li>
            <li>Face cards (J/Q/K) = 10 pts</li>
            <li>Aces = 1 pt</li>
            <li>Number cards = face value</li>
          </ul>
          <p><strong className="text-purple-400">Win:</strong> First to 200 points wins!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Crazy Eight Animation ──────────────────────────────────────────────────

function CrazyEightFlash() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div
        className="text-4xl font-black text-transparent bg-clip-text animate-pulse"
        style={{
          backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899, #06b6d4)',
          animation: 'crazyEightFlash 1.5s ease-out forwards',
        }}
      >
        CRAZY EIGHT!
      </div>
      <style>{`
        @keyframes crazyEightFlash {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          30% { opacity: 1; transform: scale(1.3) rotate(5deg); }
          70% { opacity: 1; transform: scale(1.1) rotate(-2deg); }
          100% { opacity: 0; transform: scale(0.8) rotate(0deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function CrazyEightsGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<CrazyEightsState>(() => initGame(level === 'easy' ? 1 : level === 'medium' ? 2 : 3))
  const [showRules, setShowRules] = useState(false)
  const [showCrazyEight, setShowCrazyEight] = useState(false)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const topCard = state.discardPile[state.discardPile.length - 1]
  const humanPlayer = state.players[0]
  const isHumanTurn = state.currentPlayerIndex === 0 && state.phase === 'playing'
  const playableCards = isHumanTurn ? getPlayableCards(humanPlayer.hand, topCard, state.currentSuit) : []
  const canDraw = isHumanTurn && (state.deck.length > 0 || state.discardPile.length > 1)
  const mustPass = isHumanTurn && playableCards.length === 0 && state.deck.length === 0 && state.discardPile.length <= 1

  // ─── AI Turn Handler ────────────────────────────────────────────────────
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]

    // Check stalemate
    if (state.phase === 'playing' && isStalemate(state)) {
      // Find player with fewest points in hand
      let minPoints = Infinity
      let winnerId = state.players[0].id
      state.players.forEach(p => {
        const pts = handPoints(p.hand)
        if (pts < minPoints) {
          minPoints = pts
          winnerId = p.id
        }
      })
      setState(prev => ({
        ...prev,
        phase: 'round-over',
        roundWinner: winnerId,
        message: 'Stalemate! Round over.',
      }))
      return
    }

    if (!currentPlayer.isAI || state.phase !== 'playing') return

    const delay = 800 + Math.random() * 700

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        const move = getAIMove(prev, level)
        if (move.action === 'play') {
          const playedCard = currentPlayer.hand.find(c => c.id === move.cardId)
          const result = playCard(prev, move.cardId)
          if (playedCard?.rank === '8') {
            setShowCrazyEight(true)
            setTimeout(() => setShowCrazyEight(false), 1500)
          }
          return result
        } else if (move.action === 'draw') {
          return drawCard(prev)
        } else {
          return pass(prev)
        }
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayerIndex, state.phase, state.players, level, state.deck.length])

  // AI choosing suit after playing 8
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAI || state.phase !== 'choosing-suit') return

    const timer = setTimeout(() => {
      const suit = getAISuitChoice(state, level)
      setState(prev => chooseSuit(prev, suit))
    }, 600)

    return () => clearTimeout(timer)
  }, [state.phase, state.currentPlayerIndex, state.players, level])

  // Game over callback
  useEffect(() => {
    if (state.phase === 'game-over') {
      const humanScore = state.players[0].score
      playSound('ce_game_over');
      onGameOver(humanScore)
    }
  }, [state.phase, state.players, onGameOver])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handlePlayCard = useCallback((cardId: string) => {
    if (!isHumanTurn) return
    const card = humanPlayer.hand.find(c => c.id === cardId)
    if (!card) return
    if (!playableCards.some(c => c.id === cardId)) return

    if (card.rank === '8') {
      setShowCrazyEight(true)
      setTimeout(() => setShowCrazyEight(false), 1500)
    }

    setAnimatingCard(cardId)
    setTimeout(() => {
      setAnimatingCard(null)
      setState(prev => playCard(prev, cardId))
      playSound('ce_play');
    }, 200)
  }, [isHumanTurn, humanPlayer, playableCards])

  const handleDraw = useCallback(() => {
    if (!canDraw) return
    setState(prev => drawCard(prev))
    playSound('ce_draw');
  }, [canDraw])

  const handlePass = useCallback(() => {
    if (!mustPass) return
    setState(prev => pass(prev))
  }, [mustPass])

  const handleChooseSuit = useCallback((suit: Suit) => {
    if (state.currentPlayerIndex !== 0 || state.phase !== 'choosing-suit') return
    setState(prev => chooseSuit(prev, suit))
  }, [state.currentPlayerIndex, state.phase])

  const handleNewRound = useCallback(() => {
    setState(prev => startNewRound(prev))
  }, [])

  const handleNewGame = useCallback(() => {
    setState(initGame(level === 'easy' ? 1 : level === 'medium' ? 2 : 3))
  }, [level])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col relative select-none" style={{ minHeight: '100dvh' }}>
      {/* Rules button */}
      <button
        onClick={() => setShowRules(true)}
        className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold border border-slate-700/50"
      >
        ?
      </button>

      {/* Score bar */}
      <div className="flex items-center justify-center gap-4 px-3 py-2 text-xs bg-slate-900/60">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
              i === state.currentPlayerIndex && state.phase === 'playing'
                ? 'bg-purple-500/20 ring-1 ring-purple-400/50'
                : 'bg-slate-800/50'
            }`}
          >
            <span>{p.icon}</span>
            <span className="text-slate-300 font-medium">{p.name}</span>
            <span className="text-amber-400 font-bold">{p.score}</span>
            <span className="text-slate-500">({p.hand.length})</span>
          </div>
        ))}
      </div>

      {/* AI hands (top area) */}
      <div className="flex justify-center gap-6 px-4 py-2">
        {state.players.slice(1).map((p, idx) => (
          <div key={p.id} className="flex flex-col items-center">
            <span className="text-lg">{p.icon}</span>
            <div className="flex -space-x-6 mt-1">
              {p.hand.slice(0, 10).map((card, i) => (
                <CardView key={card.id} card={card} faceUp={false} size="sm" />
              ))}
              {p.hand.length > 10 && (
                <div className="w-11 h-[62px] rounded-lg bg-slate-800/50 border border-slate-700/30 flex items-center justify-center text-xs text-slate-500">
                  +{p.hand.length - 10}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Play area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-6">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <div
              onClick={canDraw ? handleDraw : undefined}
              className={`rounded-lg flex items-center justify-center transition-all ${
                canDraw ? 'cursor-pointer hover:scale-105 active:scale-95 ring-1 ring-cyan-400/30' : 'opacity-40'
              }`}
              style={{
                width: 64,
                height: 90,
                background: state.deck.length > 0
                  ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                  : 'rgba(30, 27, 75, 0.3)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              {state.deck.length > 0 ? (
                <span className="text-purple-400/50 text-2xl">&#x1F0A0;</span>
              ) : (
                <span className="text-slate-600 text-xs">Empty</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500">{state.deck.length}</span>
            {canDraw && (
              <span className="text-[10px] text-cyan-400 animate-pulse">Draw</span>
            )}
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1 relative">
            <CardView card={topCard} size="lg" faceUp />
            {/* Current suit indicator */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold"
              style={{
                color: SUIT_COLORS[state.currentSuit],
                background: `${SUIT_COLORS[state.currentSuit]}15`,
                border: `1px solid ${SUIT_COLORS[state.currentSuit]}30`,
                boxShadow: `0 0 12px ${SUIT_COLORS[state.currentSuit]}20`,
              }}
            >
              <span>{SUIT_SYMBOLS[state.currentSuit]}</span>
              <span className="text-[10px] capitalize">{state.currentSuit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message bar */}
      <div className="text-center px-4 py-1">
        <p className="text-sm text-slate-400">{state.message}</p>
      </div>

      {/* Pass button */}
      {mustPass && (
        <div className="text-center pb-2">
          <button
            onClick={handlePass}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Pass Turn
          </button>
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center flex-wrap gap-1">
          {humanPlayer.hand.map(card => {
            const isPlayable = playableCards.some(c => c.id === card.id)
            return (
              <div
                key={card.id}
                className={`transition-all duration-200 ${
                  animatingCard === card.id ? 'opacity-0 -translate-y-8 scale-75' : ''
                }`}
              >
                <CardView
                  card={card}
                  size="md"
                  faceUp
                  playable={isPlayable}
                  disabled={!isHumanTurn || !isPlayable}
                  onClick={() => isPlayable ? handlePlayCard(card.id) : undefined}
                />
              </div>
            )
          })}
        </div>
      </div>

      {/* Suit picker overlay */}
      {state.phase === 'choosing-suit' && state.currentPlayerIndex === 0 && (
        <SuitPicker onChoose={handleChooseSuit} />
      )}

      {/* Crazy Eight animation */}
      {showCrazyEight && <CrazyEightFlash />}

      {/* Round over overlay */}
      {state.phase === 'round-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-2xl mb-2">&#x1F3C6;</p>
            <h3 className="text-white font-bold text-lg mb-3">Round Over!</h3>
            <div className="space-y-2 mb-4">
              {state.players.map(p => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    p.id === state.roundWinner ? 'bg-purple-500/20 ring-1 ring-purple-400/50' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="text-sm text-slate-300">
                    {p.icon} {p.name}
                    {p.id === state.roundWinner && ' (Winner!)'}
                  </span>
                  <span className="text-amber-400 font-bold text-sm">{p.score} pts</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mb-4">First to {state.targetScore} wins!</p>
            <button
              onClick={handleNewRound}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-3xl mb-2">&#x1F389;</p>
            <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
            <p className="text-purple-400 text-sm mb-4">{state.message}</p>
            <div className="space-y-2 mb-4">
              {[...state.players].sort((a, b) => b.score - a.score).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    i === 0 ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="text-sm text-slate-300">
                    {i === 0 ? '\u{1F451}' : ''} {p.icon} {p.name}
                  </span>
                  <span className="text-amber-400 font-bold text-sm">{p.score} pts</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleNewGame}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
