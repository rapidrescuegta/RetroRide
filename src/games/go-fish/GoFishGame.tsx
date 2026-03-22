'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  type Rank,
  SUIT_SYMBOLS,
  SUIT_COLORS,
} from '@/lib/card-engine'
import {
  type GoFishState,
  type GoFishEvent,
  initGame,
  selectRank,
  cancelRankSelection,
  askPlayer,
  getAIDecision,
  getRanksInHand,
  RANK_DISPLAY,
} from './go-fish-rules'

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
  highlighted = false,
  disabled = false,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  highlighted?: boolean
  disabled?: boolean
}) {
  const sizes = {
    sm: { w: 40, h: 56, rank: 'text-[9px]', suit: 'text-xs' },
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
        <span className="text-purple-500/40 text-lg">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`rounded-lg flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        onClick && !disabled ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${selected ? '-translate-y-3 ring-2 ring-cyan-400 shadow-lg shadow-cyan-400/20' : ''} ${
        highlighted ? 'ring-1 ring-green-400/60' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      style={{
        width: w,
        height: h,
        color,
        background: '#1e293b',
        border: selected
          ? '1px solid rgba(34, 211, 238, 0.6)'
          : '1px solid rgba(100, 116, 139, 0.4)',
      }}
    >
      <span className={`${rankSize} font-bold leading-none`}>{card.rank}</span>
      <span className={`${suitSize} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Book Display ───────────────────────────────────────────────────────────

function BookDisplay({ rank, small = false }: { rank: Rank; small?: boolean }) {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const
  const size = small ? 'w-7 h-10' : 'w-9 h-13'
  const fontSize = small ? 'text-[8px]' : 'text-[10px]'

  return (
    <div className="flex -space-x-3">
      {suits.map((suit, i) => (
        <div
          key={suit}
          className={`${size} rounded flex flex-col items-center justify-center bg-slate-800 border border-slate-600/40`}
          style={{
            color: SUIT_COLORS[suit],
            transform: `rotate(${(i - 1.5) * 5}deg)`,
            zIndex: i,
          }}
        >
          <span className={`${fontSize} font-bold leading-none`}>{rank}</span>
          <span className="text-[8px] leading-none">{SUIT_SYMBOLS[suit]}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Go Fish Animation ──────────────────────────────────────────────────────

function GoFishFlash() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div
        className="text-4xl font-black"
        style={{
          color: '#06b6d4',
          textShadow: '0 0 20px rgba(6, 182, 212, 0.6), 0 0 40px rgba(6, 182, 212, 0.3)',
          animation: 'goFishFlash 1.5s ease-out forwards',
        }}
      >
        GO FISH!
      </div>
      <style>{`
        @keyframes goFishFlash {
          0% { opacity: 0; transform: scale(0.5) translateY(20px); }
          25% { opacity: 1; transform: scale(1.3) translateY(-10px); }
          60% { opacity: 1; transform: scale(1.1) translateY(0px); }
          100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
        }
      `}</style>
    </div>
  )
}

function GotCardsFlash({ count, rank }: { count: number; rank: Rank }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div
        className="text-2xl font-black text-green-400"
        style={{
          textShadow: '0 0 20px rgba(74, 222, 128, 0.6)',
          animation: 'gotCardsFlash 1.2s ease-out forwards',
        }}
      >
        +{count} {RANK_DISPLAY[rank]}!
      </div>
      <style>{`
        @keyframes gotCardsFlash {
          0% { opacity: 0; transform: scale(0.5); }
          30% { opacity: 1; transform: scale(1.2); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8) translateY(-30px); }
        }
      `}</style>
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Go Fish Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-cyan-400">Goal:</strong> Collect the most books (sets of 4 matching cards).</p>
          <p><strong className="text-cyan-400">Ask:</strong> On your turn, tap a card in your hand to select a rank, then tap another player to ask them for it.</p>
          <p><strong className="text-cyan-400">Got it:</strong> If they have any cards of that rank, they give ALL of them to you. You go again!</p>
          <p><strong className="text-cyan-400">Go Fish:</strong> If they do not have it, draw from the deck. If you draw what you asked for, you go again!</p>
          <p><strong className="text-cyan-400">Books:</strong> When you collect all 4 cards of a rank, they are laid down as a book.</p>
          <p><strong className="text-cyan-400">Win:</strong> When all 13 books are collected, the player with the most books wins!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function GoFishGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<GoFishState>(() => initGame(level === 'easy' ? 1 : level === 'medium' ? 2 : 3))
  const [showRules, setShowRules] = useState(false)
  const [showGoFish, setShowGoFish] = useState(false)
  const [showGotCards, setShowGotCards] = useState<{ count: number; rank: Rank } | null>(null)
  const [selectedCardRank, setSelectedCardRank] = useState<Rank | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const humanPlayer = state.players[0]
  const isHumanTurn = state.currentPlayerIndex === 0
  const ranksInHand = getRanksInHand(humanPlayer.hand)

  // ─── AI Turn Handler ────────────────────────────────────────────────────
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAI || state.phase !== 'ai-turn') return

    const delay = 900 + Math.random() * 600

    aiTimerRef.current = setTimeout(() => {
      const decision = getAIDecision(state, level)
      if (!decision) {
        // AI can't do anything, advance turn
        setState(prev => {
          const nextIndex = (prev.currentPlayerIndex + 1) % prev.players.length
          const nextPlayer = prev.players[nextIndex]
          return {
            ...prev,
            currentPlayerIndex: nextIndex,
            phase: nextPlayer.isAI ? 'ai-turn' : 'select-rank',
            message: nextPlayer.isAI ? `${nextPlayer.name} is thinking...` : 'Your turn! Tap a card to ask for that rank.',
          }
        })
        return
      }

      // First select rank, then ask
      setState(prev => {
        const withRank = selectRank(prev, decision.rank)
        const result = askPlayer(withRank, decision.targetId)

        // Show animation based on result
        if (result.lastEvent?.type === 'go-fish') {
          setShowGoFish(true)
          setTimeout(() => setShowGoFish(false), 1500)
        } else if (result.lastEvent?.type === 'got-cards') {
          setShowGotCards({ count: result.lastEvent.count ?? 0, rank: decision.rank })
          setTimeout(() => setShowGotCards(null), 1200)
        }

        return result
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayerIndex, state.phase, level])

  // Game over callback
  useEffect(() => {
    if (state.phase === 'game-over') {
      // Score: human books * 10
      const humanBooks = state.players[0].books.length
      onGameOver(humanBooks * 10)
    }
  }, [state.phase, state.players, onGameOver])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleCardTap = useCallback((card: Card) => {
    if (!isHumanTurn || state.phase !== 'select-rank') return

    // If tapping same rank, deselect
    if (selectedCardRank === card.rank) {
      setSelectedCardRank(null)
      setState(prev => cancelRankSelection(prev))
      return
    }

    setSelectedCardRank(card.rank)
    setState(prev => selectRank(prev, card.rank))
  }, [isHumanTurn, state.phase, selectedCardRank])

  const handleAskPlayer = useCallback((targetId: string) => {
    if (!isHumanTurn || state.phase !== 'select-player') return

    setState(prev => {
      const result = askPlayer(prev, targetId)

      if (result.lastEvent?.type === 'go-fish') {
        setShowGoFish(true)
        setTimeout(() => setShowGoFish(false), 1500)
      } else if (result.lastEvent?.type === 'got-cards') {
        setShowGotCards({
          count: result.lastEvent.count ?? 0,
          rank: state.selectedRank!,
        })
        setTimeout(() => setShowGotCards(null), 1200)
      }

      setSelectedCardRank(null)
      return result
    })
  }, [isHumanTurn, state.phase, state.selectedRank])

  const handleNewGame = useCallback(() => {
    setSelectedCardRank(null)
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
      <div className="flex items-center justify-center gap-3 px-3 py-2 text-xs bg-slate-900/60 flex-wrap">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
              i === state.currentPlayerIndex && state.phase !== 'game-over'
                ? 'bg-cyan-500/20 ring-1 ring-cyan-400/50'
                : 'bg-slate-800/50'
            }`}
          >
            <span>{p.icon}</span>
            <span className="text-slate-300 font-medium">{p.name}</span>
            <span className="text-cyan-400 font-bold">{p.books.length}</span>
            <span className="text-slate-500">({p.hand.length})</span>
          </div>
        ))}
        <div className="text-slate-500">
          Deck: {state.deck.length}
        </div>
      </div>

      {/* AI players area */}
      <div className="flex justify-center gap-4 px-4 py-2 flex-wrap">
        {state.players.slice(1).map(p => {
          const isTarget = state.phase === 'select-player' && isHumanTurn && p.hand.length > 0
          return (
            <div
              key={p.id}
              onClick={isTarget ? () => handleAskPlayer(p.id) : undefined}
              className={`flex flex-col items-center transition-all ${
                isTarget ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all ${
                  isTarget
                    ? 'bg-cyan-500/20 ring-2 ring-cyan-400 animate-pulse'
                    : 'bg-slate-800/50 border border-slate-700/30'
                }`}
              >
                {p.icon}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">{p.name}</span>
              <div className="flex -space-x-5 mt-1">
                {p.hand.slice(0, 8).map(card => (
                  <CardView key={card.id} card={card} faceUp={false} size="sm" />
                ))}
                {p.hand.length > 8 && (
                  <div className="w-10 h-14 rounded-lg bg-slate-800/50 border border-slate-700/30 flex items-center justify-center text-[10px] text-slate-500">
                    +{p.hand.length - 8}
                  </div>
                )}
              </div>
              {/* AI books */}
              {p.books.length > 0 && (
                <div className="flex gap-1 mt-1 flex-wrap justify-center">
                  {p.books.map(rank => (
                    <div key={rank} className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                      {rank}x4
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Center area: books + deck */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* All books */}
          {state.players.some(p => p.books.length > 0) && (
            <div className="flex flex-wrap gap-3 justify-center px-4">
              {state.players.map(p =>
                p.books.map(rank => (
                  <div key={`${p.id}-${rank}`} className="flex flex-col items-center">
                    <BookDisplay rank={rank} small />
                    <span className="text-[8px] text-slate-500 mt-0.5">{p.icon}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <div
              className="rounded-lg flex items-center justify-center"
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
            <span className="text-[10px] text-slate-500">{state.deck.length} cards</span>
          </div>
        </div>
      </div>

      {/* Message bar */}
      <div className="text-center px-4 py-1">
        <p className="text-sm text-slate-400">{state.message}</p>
        {state.phase === 'select-player' && isHumanTurn && (
          <button
            onClick={() => {
              setSelectedCardRank(null)
              setState(prev => cancelRankSelection(prev))
            }}
            className="text-xs text-slate-500 hover:text-slate-300 mt-1 underline"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Event log (last 3) */}
      {state.events.length > 0 && (
        <div className="px-4 py-1 space-y-0.5">
          {state.events.slice(-3).map((ev, i) => (
            <p
              key={i}
              className={`text-[10px] text-center ${
                ev.type === 'go-fish' ? 'text-cyan-400/60' :
                ev.type === 'got-cards' ? 'text-green-400/60' :
                ev.type === 'lucky-draw' ? 'text-amber-400/60' :
                'text-slate-500/60'
              }`}
            >
              {ev.message}
            </p>
          ))}
        </div>
      )}

      {/* Human books */}
      {humanPlayer.books.length > 0 && (
        <div className="flex gap-2 justify-center px-4 py-1">
          {humanPlayer.books.map(rank => (
            <div key={rank} className="flex flex-col items-center">
              <BookDisplay rank={rank} small />
            </div>
          ))}
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center flex-wrap gap-1">
          {humanPlayer.hand.map(card => {
            const isSelectable = isHumanTurn && state.phase === 'select-rank'
            const isSelected = selectedCardRank === card.rank
            return (
              <CardView
                key={card.id}
                card={card}
                size="md"
                faceUp
                selected={isSelected}
                highlighted={state.phase === 'select-rank' && isHumanTurn && !selectedCardRank}
                disabled={!isSelectable}
                onClick={() => handleCardTap(card)}
              />
            )
          })}
        </div>
      </div>

      {/* Go Fish animation */}
      {showGoFish && <GoFishFlash />}

      {/* Got Cards animation */}
      {showGotCards && <GotCardsFlash count={showGotCards.count} rank={showGotCards.rank} />}

      {/* Game over overlay */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-3xl mb-2">&#x1F41F;</p>
            <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
            <p className="text-cyan-400 text-sm mb-4">{state.message}</p>
            <div className="space-y-2 mb-4">
              {[...state.players].sort((a, b) => b.books.length - a.books.length).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                    i === 0 ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
                  }`}
                >
                  <span className="text-sm text-slate-300">
                    {i === 0 ? '\u{1F451}' : ''} {p.icon} {p.name}
                  </span>
                  <span className="text-amber-400 font-bold text-sm">{p.books.length} books</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleNewGame}
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold transition-colors"
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
