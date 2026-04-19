'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  type Suit,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  SUITS,
} from '@/lib/card-engine'
import {
  type EuchreState,
  type PlayerId,
  initGame,
  orderUp,
  passBid,
  callTrump,
  getPlayableCards,
  playCard,
  continuePlaying,
  startNextHand,
  aiBidRound1,
  aiBidRound2,
  aiPlayCard,
  getTeam,
  getEffectiveSuit,
  PLAYER_NAMES,
  PLAYER_ICONS,
} from './euchre-rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

const AI_PLAYERS: PlayerId[] = ['west', 'north', 'east']

// ─── Card Component ─────────────────────────────────────────────────────────

function CardView({
  card,
  onClick,
  faceUp = true,
  size = 'md',
  playable = true,
  selected = false,
  trumpSuit,
}: {
  card: Card
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  selected?: boolean
  trumpSuit?: Suit | null
}) {
  const sizes = { sm: { w: 40, h: 56 }, md: { w: 52, h: 73 }, lg: { w: 64, h: 90 } }
  const fontSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  const suitSizes = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }
  const { w, h } = sizes[size]
  const color = SUIT_COLORS[card.suit]
  const isTrump = trumpSuit && (card.suit === trumpSuit ||
    (card.rank === 'J' && (card.suit === ({
      hearts: 'diamonds', diamonds: 'hearts', clubs: 'spades', spades: 'clubs'
    } as Record<Suit, Suit>)[trumpSuit])))

  if (!faceUp) {
    return (
      <div
        style={{ width: w, height: h }}
        className="rounded-md bg-gradient-to-br from-emerald-800 to-emerald-950 border border-emerald-600/30 flex items-center justify-center shrink-0"
      >
        <span className="text-emerald-400/40 text-lg">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={!playable || !onClick}
      style={{ width: w, height: h }}
      className={`rounded-md border flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-400/10 -translate-y-3 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
          : playable && onClick
            ? 'border-slate-600 bg-slate-800 hover:border-slate-400 hover:bg-slate-700 cursor-pointer active:scale-95'
            : 'border-slate-700/50 bg-slate-800/60 opacity-50'
      } ${isTrump ? 'ring-1 ring-amber-400/40' : ''}`}
    >
      <span className={`font-bold leading-none ${fontSizes[size]}`} style={{ color }}>
        {card.rank}
      </span>
      <span className={`leading-none ${suitSizes[size]}`} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  )
}

// ─── Mini Card (trick display) ──────────────────────────────────────────────

function MiniCard({ card, trumpSuit }: { card: Card; trumpSuit: Suit | null }) {
  const color = SUIT_COLORS[card.suit]
  return (
    <div className="w-[42px] h-[60px] rounded-md border border-slate-600 flex flex-col items-center justify-center bg-slate-800 transition-all duration-300">
      <span className="font-bold text-[10px] leading-none" style={{ color }}>{card.rank}</span>
      <span className="text-sm leading-none" style={{ color }}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Face Down Cards ────────────────────────────────────────────────────────

function FaceDownCards({ count, orientation }: { count: number; orientation: 'horizontal' | 'vertical' }) {
  const shown = Math.min(count, 5)
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center" style={{ gap: -8 }}>
        {Array.from({ length: shown }).map((_, i) => (
          <div
            key={i}
            className="w-[28px] h-[18px] rounded-[3px] bg-gradient-to-br from-emerald-800 to-emerald-950 border border-emerald-600/30"
            style={{ marginTop: i > 0 ? -10 : 0 }}
          />
        ))}
        <span className="text-[10px] text-slate-500 mt-1">{count}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center">
      {Array.from({ length: shown }).map((_, i) => (
        <div
          key={i}
          className="w-[18px] h-[28px] rounded-[3px] bg-gradient-to-br from-emerald-800 to-emerald-950 border border-emerald-600/30"
          style={{ marginLeft: i > 0 ? -10 : 0 }}
        />
      ))}
      <span className="text-[10px] text-slate-500 ml-1">{count}</span>
    </div>
  )
}

// ─── Trump Picker ───────────────────────────────────────────────────────────

function TrumpPicker({ onChoose, excludeSuit }: { onChoose: (suit: Suit) => void; excludeSuit: Suit | null }) {
  const available = SUITS.filter(s => s !== excludeSuit)
  return (
    <div className="flex gap-2 justify-center py-2">
      {available.map(suit => (
        <button
          key={suit}
          onClick={() => onChoose(suit)}
          className="w-14 h-14 rounded-xl flex flex-col items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95"
          style={{
            background: `${SUIT_COLORS[suit]}15`,
            border: `2px solid ${SUIT_COLORS[suit]}40`,
            color: SUIT_COLORS[suit],
          }}
        >
          <span>{SUIT_SYMBOLS[suit]}</span>
          <span className="text-[8px] capitalize">{suit}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Euchre Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-emerald-400">Teams:</strong> You + Partner vs two opponents.</p>
          <p><strong className="text-emerald-400">Deck:</strong> 24 cards (9 through Ace).</p>
          <p><strong className="text-emerald-400">Trump:</strong> A card is turned up. Players decide if its suit is trump. If all pass, players name a different suit.</p>
          <p><strong className="text-emerald-400">Bowers:</strong> Jack of trump (right bower) is highest. Jack of same color (left bower) is second highest.</p>
          <p><strong className="text-emerald-400">Play:</strong> 5 tricks per hand. Must follow lead suit if able.</p>
          <p><strong className="text-emerald-400">Scoring:</strong> Makers get 1 point for 3-4 tricks, 2 for all 5 (march). Defenders get 2 if makers fail (euchre).</p>
          <p><strong className="text-emerald-400">Win:</strong> First team to 10 points wins!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function EuchreGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<EuchreState>(() => initGame())
  const [showRules, setShowRules] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPlayerTurn = state.currentPlayer === 'south'
  const playableIds = state.phase === 'playing' ? getPlayableCards(state, 'south') : []

  // ─── AI Turn Logic ────────────────────────────────────────────────────

  useEffect(() => {
    if (state.currentPlayer === 'south') return
    if (state.phase === 'hand-over' || state.phase === 'game-over' || state.phase === 'trick-over') return

    const delay = 600 + Math.random() * 600

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.currentPlayer === 'south') return prev

        if (prev.phase === 'bid-round-1') {
          const decision = aiBidRound1(prev, level)
          return decision === 'order-up' ? orderUp(prev) : passBid(prev)
        }

        if (prev.phase === 'bid-round-2') {
          const suit = aiBidRound2(prev, level)
          if (suit) return callTrump(prev, suit)
          return passBid(prev)
        }

        if (prev.phase === 'playing') {
          const cardId = aiPlayCard(prev, level)
          return playCard(prev, prev.currentPlayer, cardId)
        }

        return prev
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayer, state.phase, state.trickNumber, level])

  // Auto-continue after trick-over
  useEffect(() => {
    if (state.phase !== 'trick-over') return
    const timer = setTimeout(() => {
      setState(prev => continuePlaying(prev))
    }, 1200)
    return () => clearTimeout(timer)
  }, [state.phase, state.trickNumber])

  // Game over
  useEffect(() => {
    if (state.phase === 'game-over') {
      // Score based on team 0 (player's team) score
      const playerTeamScore = state.teamScores[0]
      onGameOver(playerTeamScore * 10)
    }
  }, [state.phase, state.teamScores, onGameOver])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleOrderUp = useCallback(() => {
    if (!isPlayerTurn || state.phase !== 'bid-round-1') return
    setState(prev => orderUp(prev))
  }, [isPlayerTurn, state.phase])

  const handlePass = useCallback(() => {
    if (!isPlayerTurn) return
    if (state.phase !== 'bid-round-1' && state.phase !== 'bid-round-2') return
    setState(prev => passBid(prev))
  }, [isPlayerTurn, state.phase])

  const handleCallTrump = useCallback((suit: Suit) => {
    if (!isPlayerTurn || state.phase !== 'bid-round-2') return
    setState(prev => callTrump(prev, suit))
  }, [isPlayerTurn, state.phase])

  const handlePlayCard = useCallback((cardId: string) => {
    if (!isPlayerTurn || state.phase !== 'playing') return
    setState(prev => playCard(prev, 'south', cardId))
  }, [isPlayerTurn, state.phase])

  const handleNextHand = useCallback(() => {
    setState(prev => startNextHand(prev))
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col items-center max-w-lg mx-auto px-2 select-none relative">
      {/* Header */}
      <div className="w-full flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2">
          {state.trump && (
            <>
              <span className="text-sm" style={{ color: SUIT_COLORS[state.trump] }}>
                {SUIT_SYMBOLS[state.trump]}
              </span>
              <span className="text-[10px] text-slate-500">Trump</span>
            </>
          )}
        </div>
        <span className="text-[10px] text-slate-500">Hand #{state.handNumber}</span>
        <button
          onClick={() => setShowRules(true)}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors"
        >
          Rules
        </button>
      </div>

      {/* Team scores */}
      <div className="w-full grid grid-cols-2 gap-2 px-2 py-1">
        <div className={`text-center rounded-md px-2 py-1.5 border ${
          getTeam(state.currentPlayer) === 0 && state.phase === 'playing'
            ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/50'
        }`}>
          <div className="text-[10px] text-slate-400">Your Team</div>
          <div className="text-white font-bold text-lg">{state.teamScores[0]}</div>
          <div className="text-[9px] text-slate-500">Tricks: {state.handTricks[0]}</div>
        </div>
        <div className={`text-center rounded-md px-2 py-1.5 border ${
          getTeam(state.currentPlayer) === 1 && state.phase === 'playing'
            ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-900/50'
        }`}>
          <div className="text-[10px] text-slate-400">Opponents</div>
          <div className="text-white font-bold text-lg">{state.teamScores[1]}</div>
          <div className="text-[9px] text-slate-500">Tricks: {state.handTricks[1]}</div>
        </div>
      </div>

      {/* Game Table */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-0">
        {/* North (Partner) */}
        <div className="flex flex-col items-center mb-2">
          <span className="text-[10px] text-slate-400 mb-1">{PLAYER_ICONS.north} {PLAYER_NAMES.north}</span>
          <FaceDownCards count={(state.hands.north || []).length} orientation="horizontal" />
        </div>

        {/* Middle row */}
        <div className="w-full flex items-center justify-between px-2">
          {/* West */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 mb-1">{PLAYER_ICONS.west}</span>
            <FaceDownCards count={(state.hands.west || []).length} orientation="vertical" />
          </div>

          {/* Center: trick area + bidding */}
          <div className="flex-1 flex items-center justify-center min-h-[140px] relative">
            {/* Turned card for bidding */}
            {state.turnedCard && (state.phase === 'bid-round-1' || state.phase === 'bid-round-2') && (
              <div className="flex flex-col items-center">
                <CardView card={state.turnedCard} size="lg" trumpSuit={null} />
                <span className="text-[10px] text-slate-400 mt-1">Turned up</span>
              </div>
            )}

            {/* Current trick cards */}
            {state.phase === 'playing' || state.phase === 'trick-over' ? (
              <div className="relative w-[120px] h-[120px]">
                {state.currentTrick.cards.find(c => c.playerId === 'north') && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'north')!.card} trumpSuit={state.trump} />
                  </div>
                )}
                {state.currentTrick.cards.find(c => c.playerId === 'south') && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'south')!.card} trumpSuit={state.trump} />
                  </div>
                )}
                {state.currentTrick.cards.find(c => c.playerId === 'west') && (
                  <div className="absolute top-1/2 left-0 -translate-y-1/2">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'west')!.card} trumpSuit={state.trump} />
                  </div>
                )}
                {state.currentTrick.cards.find(c => c.playerId === 'east') && (
                  <div className="absolute top-1/2 right-0 -translate-y-1/2">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'east')!.card} trumpSuit={state.trump} />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* East */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-slate-400 mb-1">{PLAYER_ICONS.east}</span>
            <FaceDownCards count={(state.hands.east || []).length} orientation="vertical" />
          </div>
        </div>

        {/* Bidding controls for player */}
        {isPlayerTurn && state.phase === 'bid-round-1' && (
          <div className="flex gap-3 mt-2">
            <button
              onClick={handleOrderUp}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Order Up
            </button>
            <button
              onClick={handlePass}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Pass
            </button>
          </div>
        )}

        {isPlayerTurn && state.phase === 'bid-round-2' && (
          <div className="mt-2">
            <p className="text-[10px] text-slate-400 text-center mb-1">Name trump suit:</p>
            <TrumpPicker onChoose={handleCallTrump} excludeSuit={state.turnedCard?.suit || null} />
            <button
              onClick={handlePass}
              className="mt-2 px-4 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-colors mx-auto block"
            >
              Pass
            </button>
          </div>
        )}

        {/* Player hand */}
        <div className="mt-3 w-full flex flex-col items-center">
          <div className="flex justify-center flex-wrap gap-[2px] max-w-full px-1">
            {(state.hands.south || []).map(card => {
              const isPlayable = playableIds.includes(card.id)
              return (
                <CardView
                  key={card.id}
                  card={card}
                  onClick={isPlayable ? () => handlePlayCard(card.id) : undefined}
                  playable={isPlayable}
                  size="md"
                  trumpSuit={state.trump}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="text-center px-4 py-2">
        <p className="text-sm text-slate-400">{state.message}</p>
      </div>

      {/* Hand Over overlay */}
      {state.phase === 'hand-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            <h3 className="text-white font-bold text-lg mb-3">Hand Over!</h3>
            <p className="text-emerald-400 text-sm mb-4">{state.message}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-slate-400 text-xs">Your Team</div>
                <div className="text-white font-bold text-xl">{state.teamScores[0]}</div>
              </div>
              <div className="text-center">
                <div className="text-slate-400 text-xs">Opponents</div>
                <div className="text-white font-bold text-xl">{state.teamScores[1]}</div>
              </div>
            </div>
            <button
              onClick={handleNextHand}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Next Hand
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            <div className="text-3xl mb-2">
              {state.teamScores[0] >= 10 ? '\u{1F3C6}' : '\u{1F4A8}'}
            </div>
            <h3 className="text-white font-bold text-lg mb-1">
              {state.teamScores[0] >= 10 ? 'Your Team Wins!' : 'Opponents Win!'}
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-4 mt-3">
              <div className={`text-center py-2 rounded-lg ${state.teamScores[0] >= 10 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                <div className="text-slate-400 text-xs">Your Team</div>
                <div className="text-white font-bold text-xl">{state.teamScores[0]}</div>
              </div>
              <div className={`text-center py-2 rounded-lg ${state.teamScores[1] >= 10 ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-slate-800/50'}`}>
                <div className="text-slate-400 text-xs">Opponents</div>
                <div className="text-white font-bold text-xl">{state.teamScores[1]}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
