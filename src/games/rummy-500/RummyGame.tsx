'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Card, Suit } from '@/lib/card-engine'
import { SUIT_SYMBOLS, SUIT_COLORS, sortHand } from '@/lib/card-engine'
import {
  RummyState,
  RummyMeld,
  initRound,
  drawFromDeck,
  drawFromDiscard,
  playMeld,
  layOff,
  discard,
  playAITurn,
  validateMeld,
  getValidLayoffs,
  calculateRoundScores,
} from './rummy-rules'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RummyGameProps {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

interface BotInfo {
  id: string
  name: string
  avatar: string
}

const BOTS: BotInfo[] = [
  { id: 'bot-alice', name: 'Alice', avatar: '🤖' },
  { id: 'bot-bob', name: 'Bob', avatar: '👾' },
  { id: 'bot-carol', name: 'Carol', avatar: '🎭' },
]

const PLAYER_ID = 'player'

// ─── Card View ──────────────────────────────────────────────────────────────

function CardView({
  card,
  selected,
  onClick,
  faceUp = true,
  size = 'md',
  style,
  className = '',
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  style?: React.CSSProperties
  className?: string
}) {
  const sizes = {
    sm: { w: 48, h: 67, text: 'text-xs', rank: 'text-sm' },
    md: { w: 64, h: 90, text: 'text-sm', rank: 'text-base' },
    lg: { w: 80, h: 112, text: 'text-base', rank: 'text-lg' },
  }
  const s = sizes[size]
  const color = faceUp ? SUIT_COLORS[card.suit] : '#6366f1'
  const symbol = SUIT_SYMBOLS[card.suit]

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`relative rounded-lg border-2 flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${className}`}
      style={{
        width: s.w,
        height: s.h,
        background: faceUp
          ? 'linear-gradient(135deg, #1e293b, #0f172a)'
          : 'linear-gradient(135deg, #1e1b4b, #312e81)',
        borderColor: selected ? '#06b6d4' : 'rgba(100,116,139,0.3)',
        boxShadow: selected
          ? '0 0 12px rgba(6,182,212,0.5), 0 0 24px rgba(6,182,212,0.2)'
          : '0 2px 4px rgba(0,0,0,0.3)',
        transform: selected ? 'translateY(-8px)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {faceUp ? (
        <>
          <span className={`font-bold ${s.rank} leading-none`} style={{ color }}>
            {card.rank}
          </span>
          <span className={`${s.text} leading-none mt-0.5`} style={{ color }}>
            {symbol}
          </span>
        </>
      ) : (
        <div className="w-full h-full rounded-md flex items-center justify-center">
          <div
            className="w-3/4 h-3/4 rounded border border-indigo-500/30"
            style={{
              background:
                'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(99,102,241,0.1) 3px, rgba(99,102,241,0.1) 6px)',
            }}
          />
        </div>
      )}
    </button>
  )
}

// ─── Meld Display ───────────────────────────────────────────────────────────

function MeldDisplay({
  meld,
  onTap,
  highlighted,
}: {
  meld: RummyMeld
  onTap?: () => void
  highlighted?: boolean
}) {
  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      className={`flex items-center gap-0.5 p-1.5 rounded-lg border transition-all ${
        highlighted
          ? 'border-cyan-400/60 bg-cyan-950/30'
          : 'border-slate-700/50 bg-slate-800/40'
      }`}
      style={{
        cursor: onTap ? 'pointer' : 'default',
        boxShadow: highlighted ? '0 0 8px rgba(6,182,212,0.3)' : 'none',
      }}
    >
      {meld.cards.map((card) => (
        <CardView key={card.id} card={card} size="sm" faceUp />
      ))}
    </button>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Rummy 500 Rules</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl">
            x
          </button>
        </div>
        <div className="text-slate-300 text-sm space-y-3">
          <p>
            <span className="text-cyan-400 font-semibold">Goal:</span> Be the first to reach 500 points by melding cards.
          </p>
          <p>
            <span className="text-cyan-400 font-semibold">Deal:</span> 7 cards each (13 with 2 players).
          </p>
          <p>
            <span className="text-cyan-400 font-semibold">Your Turn:</span>
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Draw 1 card from the deck or discard pile</li>
            <li>Optionally meld sets or runs</li>
            <li>Optionally lay off cards on existing melds</li>
            <li>Discard 1 card to end your turn</li>
          </ol>
          <p>
            <span className="text-cyan-400 font-semibold">Melds:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Set:</strong> 3 or 4 cards of the same rank</li>
            <li><strong>Run:</strong> 3+ consecutive cards of the same suit</li>
          </ul>
          <p>
            <span className="text-cyan-400 font-semibold">Discard Pile:</span> You can pick up any card, but you must take all cards above it and immediately meld the card you picked.
          </p>
          <p>
            <span className="text-cyan-400 font-semibold">Scoring:</span>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Number cards = face value</li>
            <li>Face cards (J, Q, K) = 10 points</li>
            <li>Aces = 15 points</li>
            <li>Cards left in hand are subtracted!</li>
          </ul>
          <p>
            <span className="text-cyan-400 font-semibold">Going Out:</span> When a player plays all their cards, the round ends.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Round Over Screen ──────────────────────────────────────────────────────

function RoundOverScreen({
  state,
  botInfoMap,
  onNextRound,
}: {
  state: RummyState
  botInfoMap: Record<string, BotInfo>
  onNextRound: () => void
}) {
  const scores = calculateRoundScores(state)
  const sorted = [...state.players].sort(
    (a, b) => (state.cumulativeScores[b] || 0) - (state.cumulativeScores[a] || 0)
  )

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm z-40 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-6 text-center">
        <h2 className="text-xl font-bold text-white mb-1">Round {state.roundNumber} Complete</h2>
        <p className="text-slate-400 text-sm mb-4">
          {state.gameOver
            ? `${state.winner === PLAYER_ID ? 'You' : botInfoMap[state.winner!]?.name || state.winner} won the game!`
            : 'Next round coming up...'}
        </p>

        <div className="space-y-2 mb-5">
          {sorted.map((pid) => {
            const name = pid === PLAYER_ID ? 'You' : botInfoMap[pid]?.name || pid
            const avatar = pid === PLAYER_ID ? '🎮' : botInfoMap[pid]?.avatar || '?'
            const roundPts = scores[pid] || 0
            const cumPts = state.cumulativeScores[pid] || 0
            return (
              <div
                key={pid}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  pid === PLAYER_ID ? 'border-purple-500/40 bg-purple-950/30' : 'border-slate-700/40 bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{avatar}</span>
                  <span className="text-white font-medium text-sm">{name}</span>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold">{cumPts}</div>
                  <div className={`text-xs ${roundPts >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {roundPts >= 0 ? '+' : ''}{roundPts} this round
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={onNextRound}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors"
        >
          {state.gameOver ? 'Game Over' : 'Next Round'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function RummyGame({ onGameOver, level }: RummyGameProps) {
  const botCount = level === 'easy' ? 1 : level === 'medium' ? 2 : 3
  const activeBots = BOTS.slice(0, botCount)
  const allPlayerIds = [PLAYER_ID, ...activeBots.map((b) => b.id)]

  const botInfoMap: Record<string, BotInfo> = {}
  for (const b of activeBots) botInfoMap[b.id] = b

  const [gameState, setGameState] = useState<RummyState | null>(null)
  const [selectedCards, setSelectedCards] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [showRules, setShowRules] = useState(false)
  const [showRoundOver, setShowRoundOver] = useState(false)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize game
  useEffect(() => {
    const s = initRound(allPlayerIds)
    setGameState(s)
    setMessage('Your turn! Draw a card.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // AI auto-play
  useEffect(() => {
    if (!gameState) return
    if (gameState.roundOver || gameState.gameOver) return
    if (gameState.currentTurn === PLAYER_ID) return

    aiTimeoutRef.current = setTimeout(() => {
      setGameState((prev) => {
        if (!prev || prev.currentTurn === PLAYER_ID) return prev
        const botName = botInfoMap[prev.currentTurn]?.name || 'Bot'
        setMessage(`${botName} is thinking...`)

        const newState = playAITurn(prev)

        if (newState.roundOver) {
          setTimeout(() => setShowRoundOver(true), 600)
          return newState
        }

        if (newState.currentTurn === PLAYER_ID) {
          setTimeout(() => setMessage('Your turn! Draw a card.'), 300)
        }
        return newState
      })
    }, 1000)

    return () => {
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.currentTurn, gameState?.roundOver])

  // ─── Action Handlers ────────────────────────────────────────────────────

  const handleDrawDeck = useCallback(() => {
    if (!gameState || gameState.currentTurn !== PLAYER_ID || gameState.turnPhase !== 'draw') return
    const newState = drawFromDeck(gameState, PLAYER_ID)
    setGameState(newState)
    setMessage('Meld cards or discard to end your turn.')
    setSelectedCards([])
  }, [gameState])

  const handleDrawDiscard = useCallback(
    (cardIndex: number) => {
      if (!gameState || gameState.currentTurn !== PLAYER_ID || gameState.turnPhase !== 'draw') return
      const newState = drawFromDiscard(gameState, PLAYER_ID, cardIndex)
      setGameState(newState)
      setMessage('You must meld the card you picked! Then discard.')
      setSelectedCards([])
    },
    [gameState]
  )

  const handleMeld = useCallback(() => {
    if (!gameState || gameState.currentTurn !== PLAYER_ID) return
    if (selectedCards.length < 3) {
      setMessage('Select 3 or more cards to meld.')
      return
    }
    const result = playMeld(gameState, PLAYER_ID, selectedCards)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setGameState(result.state)
    setSelectedCards([])
    if (result.state.roundOver) {
      setMessage('You went out!')
      setTimeout(() => setShowRoundOver(true), 600)
    } else {
      setMessage('Nice meld! Continue melding or discard.')
    }
  }, [gameState, selectedCards])

  const handleLayOff = useCallback(
    (meldId: string) => {
      if (!gameState || gameState.currentTurn !== PLAYER_ID) return
      if (selectedCards.length !== 1) {
        setMessage('Select exactly 1 card to lay off.')
        return
      }
      const result = layOff(gameState, PLAYER_ID, selectedCards[0], meldId)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setGameState(result.state)
      setSelectedCards([])
      if (result.state.roundOver) {
        setMessage('You went out!')
        setTimeout(() => setShowRoundOver(true), 600)
      } else {
        setMessage('Card added to meld! Continue or discard.')
      }
    },
    [gameState, selectedCards]
  )

  const handleDiscard = useCallback(() => {
    if (!gameState || gameState.currentTurn !== PLAYER_ID) return
    if (gameState.turnPhase === 'draw') {
      setMessage('Draw a card first!')
      return
    }
    if (gameState.mustMeldCard) {
      setMessage('You must meld the card you picked from the discard pile first!')
      return
    }
    if (selectedCards.length !== 1) {
      setMessage('Select exactly 1 card to discard.')
      return
    }
    const newState = discard(gameState, PLAYER_ID, selectedCards[0])
    setGameState(newState)
    setSelectedCards([])
    if (newState.roundOver) {
      setMessage('You went out!')
      setTimeout(() => setShowRoundOver(true), 600)
    } else {
      setMessage(`${botInfoMap[newState.currentTurn]?.name || 'Next player'}'s turn...`)
    }
  }, [gameState, selectedCards, botInfoMap])

  const toggleSelectCard = useCallback((cardId: string) => {
    setSelectedCards((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId]
    )
  }, [])

  const handleNextRound = useCallback(() => {
    if (!gameState) return
    setShowRoundOver(false)
    if (gameState.gameOver) {
      const score = gameState.cumulativeScores[PLAYER_ID] || 0
      onGameOver(Math.max(0, score))
      return
    }
    const newState = initRound(allPlayerIds, gameState.cumulativeScores, gameState.roundNumber + 1)
    setGameState(newState)
    setSelectedCards([])
    setMessage('New round! Draw a card.')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, onGameOver])

  // ─── Derived State ──────────────────────────────────────────────────────

  if (!gameState) return null

  const playerHand = gameState.hands[PLAYER_ID] || []
  const isMyTurn = gameState.currentTurn === PLAYER_ID
  const canDrawDeck = isMyTurn && gameState.turnPhase === 'draw'
  const canMeldNow = isMyTurn && gameState.turnPhase !== 'draw' && selectedCards.length >= 3
  const canDiscardNow =
    isMyTurn && gameState.turnPhase !== 'draw' && selectedCards.length === 1 && !gameState.mustMeldCard

  // Check meld validity for button state
  let meldValid = false
  if (canMeldNow) {
    const cards = selectedCards
      .map((id) => playerHand.find((c) => c.id === id))
      .filter((c): c is Card => !!c)
    meldValid = validateMeld(cards).valid
  }

  // Check layoff validity
  let validLayoffMelds: string[] = []
  if (isMyTurn && gameState.turnPhase !== 'draw' && selectedCards.length === 1) {
    const card = playerHand.find((c) => c.id === selectedCards[0])
    if (card) {
      validLayoffMelds = getValidLayoffs(gameState, card)
    }
  }

  const topDiscard = gameState.discardPile.length > 0
    ? gameState.discardPile[gameState.discardPile.length - 1]
    : null

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col select-none" style={{ background: '#0a0a1a' }}>
      {/* Scores Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 border-b border-slate-800/40">
        <div className="flex items-center gap-3 overflow-x-auto">
          {/* Player score */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
              isMyTurn ? 'bg-purple-900/40 border border-purple-500/40' : 'bg-slate-800/40'
            }`}
          >
            <span>🎮</span>
            <span className="text-slate-300 font-medium">You</span>
            <span className="text-white font-bold">{gameState.cumulativeScores[PLAYER_ID] || 0}</span>
          </div>
          {/* Bot scores */}
          {activeBots.map((bot) => (
            <div
              key={bot.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
                gameState.currentTurn === bot.id
                  ? 'bg-purple-900/40 border border-purple-500/40'
                  : 'bg-slate-800/40'
              }`}
            >
              <span>{bot.avatar}</span>
              <span className="text-slate-300 font-medium">{bot.name}</span>
              <span className="text-white font-bold">{gameState.cumulativeScores[bot.id] || 0}</span>
              <span className="text-slate-500">({(gameState.hands[bot.id] || []).length})</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowRules(true)}
          className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
        >
          Rules
        </button>
      </div>

      {/* Melds on Table */}
      <div className="flex-shrink-0 px-3 py-2 min-h-[80px]">
        {gameState.melds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {gameState.melds.map((meld) => {
              const ownerName =
                meld.owner === PLAYER_ID ? 'You' : botInfoMap[meld.owner]?.name || meld.owner
              const isHighlighted = validLayoffMelds.includes(meld.id)
              return (
                <div key={meld.id} className="flex flex-col items-center gap-0.5">
                  <MeldDisplay
                    meld={meld}
                    highlighted={isHighlighted}
                    onTap={isHighlighted ? () => handleLayOff(meld.id) : undefined}
                  />
                  <span className="text-[10px] text-slate-500">{ownerName}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-600 text-xs">
            Melds will appear here
          </div>
        )}
      </div>

      {/* Center: Deck + Discard */}
      <div className="flex-1 flex items-center justify-center gap-8 px-4">
        {/* Deck */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={handleDrawDeck}
            disabled={!canDrawDeck}
            className={`relative transition-all ${canDrawDeck ? 'hover:scale-105 active:scale-95' : 'opacity-60'}`}
          >
            <CardView
              card={{ id: 'deck', suit: 'spades', rank: 'A', value: 14, faceUp: false }}
              faceUp={false}
              size="lg"
            />
            <div className="absolute -top-1 -right-1 bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {gameState.deck.length}
            </div>
          </button>
          <span className="text-[10px] text-slate-500">Deck</span>
        </div>

        {/* Discard Pile */}
        <div className="flex flex-col items-center gap-1">
          {topDiscard ? (
            <div className="relative">
              {/* Show a few cards stacked */}
              {gameState.discardPile.length > 1 && (
                <div
                  className="absolute"
                  style={{ top: -2, left: -2, opacity: 0.4, zIndex: 0 }}
                >
                  <CardView
                    card={gameState.discardPile[gameState.discardPile.length - 2]}
                    size="lg"
                    faceUp
                  />
                </div>
              )}
              <button
                onClick={() =>
                  canDrawDeck
                    ? handleDrawDiscard(gameState.discardPile.length - 1)
                    : undefined
                }
                disabled={!canDrawDeck}
                className={`relative z-10 transition-all ${canDrawDeck ? 'hover:scale-105 active:scale-95' : ''}`}
              >
                <CardView card={topDiscard} size="lg" faceUp />
              </button>
              <div className="absolute -top-1 -right-1 z-20 bg-pink-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {gameState.discardPile.length}
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center"
              style={{ width: 80, height: 112 }}
            >
              <span className="text-slate-600 text-xs">Empty</span>
            </div>
          )}
          <span className="text-[10px] text-slate-500">Discard</span>
        </div>
      </div>

      {/* Message Bar */}
      <div className="px-4 py-2 text-center">
        <div
          className={`text-sm font-medium px-3 py-1.5 rounded-lg inline-block ${
            isMyTurn ? 'bg-purple-900/40 text-purple-300' : 'bg-slate-800/60 text-slate-400'
          }`}
        >
          {message}
        </div>
      </div>

      {/* Action Buttons */}
      {isMyTurn && gameState.turnPhase !== 'draw' && (
        <div className="flex items-center justify-center gap-2 px-4 pb-2">
          <button
            onClick={handleMeld}
            disabled={!meldValid}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              meldValid
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Meld ({selectedCards.length})
          </button>
          <button
            onClick={handleDiscard}
            disabled={!canDiscardNow}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              canDiscardNow
                ? 'bg-pink-600 hover:bg-pink-500 text-white'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Discard
          </button>
          {validLayoffMelds.length > 0 && (
            <span className="text-xs text-cyan-400 animate-pulse">Tap a glowing meld to lay off</span>
          )}
        </div>
      )}

      {/* Player Hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex items-end justify-center overflow-x-auto pb-1" style={{ minHeight: 100 }}>
          {playerHand.map((card, i) => {
            const isSelected = selectedCards.includes(card.id)
            const totalCards = playerHand.length
            // Fan effect: slight overlap
            const overlap = Math.min(52, Math.max(20, 320 / totalCards))
            return (
              <div
                key={card.id}
                style={{
                  marginLeft: i === 0 ? 0 : -Math.max(0, 64 - overlap),
                  zIndex: isSelected ? 50 : i,
                  transition: 'all 0.2s ease',
                }}
              >
                <CardView
                  card={card}
                  selected={isSelected}
                  onClick={isMyTurn && gameState.turnPhase !== 'draw' ? () => toggleSelectCard(card.id) : undefined}
                  size="md"
                  faceUp
                />
              </div>
            )
          })}
        </div>
        <div className="text-center text-[10px] text-slate-600 mt-1">
          {playerHand.length} cards in hand
        </div>
      </div>

      {/* Rules Modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* Round Over Screen */}
      {showRoundOver && gameState.roundOver && (
        <RoundOverScreen
          state={gameState}
          botInfoMap={botInfoMap}
          onNextRound={handleNextRound}
        />
      )}
    </div>
  )
}
