'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Card, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'
import { playPickup, playSelect, playWin, playGameOver, playMove, playExplosion } from '@/lib/sounds'
import {
  type BlackjackState,
  type Hand,
  initGame,
  placeBet,
  deal,
  hit,
  stand,
  doubleDown,
  split,
  dealerPlay,
  newRound,
  handTotal,
  isSoftHand,
  canSplit,
  canDoubleDown,
} from './rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Card Component ─────────────────────────────────────────────────────────

function BJCard({
  card,
  faceUp,
}: {
  card: Card
  faceUp: boolean
}) {
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        className="w-[56px] h-[78px] rounded-lg flex items-center justify-center shrink-0 animate-[bjDeal_0.3s_ease-out]"
        style={{
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
      className="w-[56px] h-[78px] rounded-lg flex flex-col items-center justify-center shrink-0 animate-[bjDeal_0.3s_ease-out]"
      style={{
        color,
        background: '#1e293b',
        border: `1px solid ${color}40`,
      }}
    >
      <span className="text-sm font-bold leading-none">{card.rank}</span>
      <span className="text-xl leading-none">{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Hand Display ───────────────────────────────────────────────────────────

function HandDisplay({
  cards,
  isActive,
  showTotal,
  label,
  dealerHidden,
}: {
  cards: Card[]
  isActive?: boolean
  showTotal?: boolean
  label?: string
  dealerHidden?: boolean
}) {
  const visibleCards = dealerHidden ? cards.filter(c => c.faceUp) : cards
  const total = handTotal(visibleCards)
  const fullTotal = handTotal(cards)
  const soft = isSoftHand(cards)

  return (
    <div className={`flex flex-col items-center gap-1 ${isActive ? '' : 'opacity-80'}`}>
      {label && <span className="text-xs text-slate-500">{label}</span>}
      <div className="flex -space-x-3">
        {cards.map((card, i) => (
          <div key={card.id} style={{ zIndex: i }}>
            <BJCard card={card} faceUp={card.faceUp} />
          </div>
        ))}
      </div>
      {showTotal && cards.length > 0 && (
        <span className={`text-sm font-bold ${
          fullTotal > 21 && !dealerHidden ? 'text-red-400' :
          fullTotal === 21 && !dealerHidden ? 'text-emerald-400' :
          'text-slate-300'
        }`}>
          {dealerHidden ? `${total}+?` : `${fullTotal}${soft ? ' (soft)' : ''}`}
          {!dealerHidden && fullTotal > 21 && ' BUST'}
        </span>
      )}
    </div>
  )
}

// ─── Chip Button ────────────────────────────────────────────────────────────

function ChipButton({
  amount,
  onClick,
  selected,
  disabled,
}: {
  amount: number
  onClick: () => void
  selected?: boolean
  disabled?: boolean
}) {
  const colors: Record<number, string> = {
    5: '#ef4444',
    10: '#3b82f6',
    25: '#22c55e',
    50: '#a855f7',
    100: '#f59e0b',
    500: '#ec4899',
  }
  const bg = colors[amount] || '#64748b'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-14 h-14 rounded-full font-bold text-sm flex items-center justify-center transition-all ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:scale-110 active:scale-95 cursor-pointer'
      } ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : ''}`}
      style={{
        background: `radial-gradient(circle at 35% 35%, ${bg}cc, ${bg})`,
        border: `3px solid ${bg}`,
        boxShadow: selected ? `0 0 16px ${bg}60` : `inset 0 2px 4px rgba(255,255,255,0.2)`,
        color: 'white',
        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      ${amount}
    </button>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function BlackjackGame({ onGameOver, level }: Props) {
  const startBalance = level === 'easy' ? 2000 : level === 'medium' ? 1000 : 500
  const [state, setState] = useState<BlackjackState>(() => initGame(startBalance))
  const [selectedBet, setSelectedBet] = useState(10)
  const gameOverCalled = useRef(false)
  const dealerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chipValues = level === 'easy' ? [5, 10, 25, 50] : level === 'medium' ? [10, 25, 50, 100] : [25, 50, 100, 500]

  // Auto dealer play
  useEffect(() => {
    if (state.phase !== 'dealer-turn') return

    dealerTimerRef.current = setTimeout(() => {
      setState(prev => {
        const result = dealerPlay(prev)
        if (result.phase === 'round-over' || result.phase === 'game-over') {
          const wins = result.playerHands.filter(h => h.result === 'win' || h.result === 'blackjack').length
          if (wins > 0) playWin()
          else if (result.playerHands.some(h => h.result === 'push')) playSelect()
          else playGameOver()
        }
        return result
      })
    }, 800)

    return () => {
      if (dealerTimerRef.current) clearTimeout(dealerTimerRef.current)
    }
  }, [state.phase])

  // Game over
  useEffect(() => {
    if (state.phase === 'game-over' && !gameOverCalled.current) {
      gameOverCalled.current = true
      playGameOver()
      setTimeout(() => onGameOver(state.balance), 1500)
    }
  }, [state.phase, state.balance, onGameOver])

  // Round-over BJ sound
  useEffect(() => {
    if (state.phase === 'round-over') {
      const bjHand = state.playerHands.find(h => h.result === 'blackjack')
      if (bjHand) playWin()
    }
  }, [state.phase, state.playerHands])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleBet = useCallback((amount: number) => {
    if (state.phase !== 'betting') return
    setSelectedBet(amount)
    playSelect()
    setState(prev => placeBet(prev, amount))
  }, [state.phase])

  const handleDeal = useCallback(() => {
    if (state.phase !== 'betting' || state.currentBet <= 0) return
    playMove()
    setState(prev => deal(prev))
  }, [state.phase, state.currentBet])

  const handleHit = useCallback(() => {
    if (state.phase !== 'player-turn') return
    playMove()
    setState(prev => {
      const result = hit(prev)
      const hand = result.playerHands[result.activeHandIndex] || result.playerHands[result.playerHands.length - 1]
      if (hand?.busted) playExplosion()
      return result
    })
  }, [state.phase])

  const handleStand = useCallback(() => {
    if (state.phase !== 'player-turn') return
    playSelect()
    setState(prev => stand(prev))
  }, [state.phase])

  const handleDouble = useCallback(() => {
    if (state.phase !== 'player-turn') return
    const hand = state.playerHands[state.activeHandIndex]
    if (!canDoubleDown(hand)) return
    playMove()
    setState(prev => doubleDown(prev))
  }, [state.phase, state.playerHands, state.activeHandIndex])

  const handleSplit = useCallback(() => {
    if (state.phase !== 'player-turn') return
    const hand = state.playerHands[state.activeHandIndex]
    if (!canSplit(hand)) return
    playPickup()
    setState(prev => split(prev))
  }, [state.phase, state.playerHands, state.activeHandIndex])

  const handleNewRound = useCallback(() => {
    setState(prev => newRound(prev))
  }, [])

  const handleCashOut = useCallback(() => {
    onGameOver(state.balance)
  }, [state.balance, onGameOver])

  const handleNewGame = useCallback(() => {
    gameOverCalled.current = false
    setState(initGame(startBalance))
    setSelectedBet(chipValues[1] || 10)
  }, [startBalance, chipValues])

  const activeHand = state.playerHands[state.activeHandIndex]
  const canHitNow = state.phase === 'player-turn' && activeHand && !activeHand.stood && !activeHand.busted
  const canStandNow = canHitNow
  const canDbl = canHitNow && canDoubleDown(activeHand) && state.balance >= activeHand.bet
  const canSpl = canHitNow && canSplit(activeHand) && state.balance >= activeHand.bet

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col relative select-none overflow-hidden">
      <style>{`
        @keyframes bjDeal {
          0% { transform: translateY(-30px) scale(0.8) rotate(-5deg); opacity: 0; }
          100% { transform: translateY(0) scale(1) rotate(0); opacity: 1; }
        }
      `}</style>

      {/* Balance bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-sm">&#x1F4B0;</span>
          <span className="text-amber-400 font-bold text-lg">${state.balance.toLocaleString()}</span>
        </div>
        <div className="text-xs text-slate-500">Round {state.roundNumber}</div>
        {state.currentBet > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-xs">Bet:</span>
            <span className="text-emerald-400 font-bold text-sm">${state.currentBet}</span>
          </div>
        )}
      </div>

      {/* Dealer area */}
      <div className="flex flex-col items-center py-4">
        <span className="text-xs text-slate-500 mb-2">&#x1F3B0; Dealer</span>
        {state.dealerCards.length > 0 ? (
          <HandDisplay
            cards={state.dealerCards}
            showTotal
            isActive={state.phase === 'dealer-turn'}
            dealerHidden={!state.dealerRevealed}
          />
        ) : (
          <div className="h-[78px] flex items-center justify-center">
            <span className="text-slate-700 text-sm">Waiting to deal...</span>
          </div>
        )}
      </div>

      {/* Center message */}
      <div className="text-center px-4 py-2 min-h-[40px] flex items-center justify-center">
        <p className={`text-sm font-medium ${
          state.message.includes('win') || state.message.includes('Win') || state.message.includes('BLACKJACK')
            ? 'text-emerald-400'
            : state.message.includes('Bust') || state.message.includes('Game over')
            ? 'text-red-400'
            : state.message.includes('Push')
            ? 'text-amber-400'
            : 'text-slate-400'
        }`}>
          {state.message}
        </p>
      </div>

      {/* Player hand(s) */}
      <div className="flex-1 flex items-start justify-center gap-4 px-4 pt-2">
        {state.playerHands.length > 0 ? (
          state.playerHands.map((hand, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1">
              <HandDisplay
                cards={hand.cards}
                showTotal
                isActive={idx === state.activeHandIndex && state.phase === 'player-turn'}
                label={state.playerHands.length > 1 ? `Hand ${idx + 1}` : undefined}
              />
              {hand.result && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  hand.result === 'win' || hand.result === 'blackjack'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : hand.result === 'push'
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {hand.result === 'blackjack' ? 'BJ!' : hand.result.toUpperCase()}
                  {hand.result === 'win' && ` +$${hand.bet}`}
                  {hand.result === 'blackjack' && ` +$${Math.floor(hand.bet * 1.5)}`}
                </span>
              )}
              {hand.doubled && (
                <span className="text-[10px] text-purple-400">DOUBLED</span>
              )}
            </div>
          ))
        ) : (
          <div className="h-[78px] flex items-center justify-center">
            <span className="text-slate-700 text-sm">&#x1F3AE; Your hand</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-4 pt-1">
        {state.phase === 'betting' && (
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2 justify-center">
              {chipValues.map(val => (
                <ChipButton
                  key={val}
                  amount={val}
                  onClick={() => handleBet(val)}
                  selected={selectedBet === val && state.currentBet === val}
                  disabled={val > state.balance}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {[selectedBet, selectedBet * 2, selectedBet * 5].filter(v => v <= state.balance && v > 0).map((val, i) => (
                <button
                  key={`${val}-${i}`}
                  onClick={() => handleBet(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    state.currentBet === val
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ${val}
                </button>
              ))}
            </div>
            <button
              onClick={handleDeal}
              disabled={state.currentBet <= 0}
              className="w-full max-w-xs py-3 rounded-xl font-bold text-white text-lg transition-all active:scale-[0.97] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Deal!
            </button>
          </div>
        )}

        {state.phase === 'player-turn' && (
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={handleHit}
              disabled={!canHitNow}
              className="px-6 py-3 rounded-xl font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 transition-all active:scale-[0.97] min-w-[80px]"
            >
              Hit
            </button>
            <button
              onClick={handleStand}
              disabled={!canStandNow}
              className="px-6 py-3 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-30 transition-all active:scale-[0.97] min-w-[80px]"
            >
              Stand
            </button>
            {canDbl && (
              <button
                onClick={handleDouble}
                className="px-5 py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all active:scale-[0.97] min-w-[80px]"
              >
                Double
              </button>
            )}
            {canSpl && (
              <button
                onClick={handleSplit}
                className="px-5 py-3 rounded-xl font-bold text-white bg-pink-600 hover:bg-pink-500 transition-all active:scale-[0.97] min-w-[80px]"
              >
                Split
              </button>
            )}
          </div>
        )}

        {state.phase === 'dealer-turn' && (
          <div className="text-center py-3">
            <span className="text-slate-400 text-sm animate-pulse">Dealer is playing...</span>
          </div>
        )}

        {state.phase === 'round-over' && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={handleNewRound}
              className="px-8 py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all active:scale-[0.97]"
            >
              Next Hand
            </button>
            <button
              onClick={handleCashOut}
              className="px-6 py-3 rounded-xl font-bold text-slate-300 bg-slate-700 hover:bg-slate-600 transition-all active:scale-[0.97]"
            >
              Cash Out
            </button>
          </div>
        )}

        {state.phase === 'game-over' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-red-400 font-bold text-lg">Out of chips!</p>
            <button
              onClick={handleNewGame}
              className="px-8 py-3 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all active:scale-[0.97]"
            >
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
