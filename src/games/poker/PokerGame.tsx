'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  SUIT_SYMBOLS,
  SUIT_COLORS,
} from '@/lib/card-engine'
import {
  type PokerState,
  initGame,
  performAction,
  startNewRound,
  getAIDecision,
  getAvailableActions,
  evaluateHand,
  getScore,
} from './poker-rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Card Component ─────────────────────────────────────────────────────────

function CardView({
  card,
  faceUp = true,
  size = 'md',
}: {
  card: Card
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
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
          width: w, height: h,
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
      className="rounded-lg flex flex-col items-center justify-center shrink-0"
      style={{
        width: w, height: h, color,
        background: '#1e293b',
        border: '1px solid rgba(100, 116, 139, 0.4)',
      }}
    >
      <span className={`${rankSize} font-bold leading-none`}>{card.rank}</span>
      <span className={`${suitSize} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Texas Hold&apos;em Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-green-400">Setup:</strong> Everyone starts with 1,000 chips. Blinds: 10/20.</p>
          <p><strong className="text-green-400">Deal:</strong> Each player gets 2 hole cards (face down).</p>
          <p><strong className="text-green-400">Rounds:</strong> Preflop, Flop (3 cards), Turn (1 card), River (1 card).</p>
          <p><strong className="text-green-400">Actions:</strong> Check, Call, Raise, or Fold each round.</p>
          <p><strong className="text-green-400">Showdown:</strong> Best 5-card hand from your 2 + 5 community cards wins!</p>
          <p><strong className="text-green-400">Rankings</strong> (best to worst):</p>
          <ul className="list-disc pl-5 space-y-0.5 text-xs">
            <li>Royal Flush, Straight Flush</li>
            <li>Four of a Kind, Full House</li>
            <li>Flush, Straight</li>
            <li>Three of a Kind, Two Pair, Pair, High Card</li>
          </ul>
          <p><strong className="text-green-400">Win:</strong> Last player with chips wins!</p>
        </div>
        <button onClick={onClose} className="mt-4 w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors">Got it!</button>
      </div>
    </div>
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function PokerGame({ onGameOver, level }: Props) {
  const numAI = level === 'easy' ? 2 : level === 'medium' ? 3 : 4
  const [state, setState] = useState<PokerState>(() => initGame(numAI))
  const [showRules, setShowRules] = useState(false)
  const [raiseAmount, setRaiseAmount] = useState(0)
  const [showRaiseSlider, setShowRaiseSlider] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const humanPlayer = state.players[0]
  const currentPlayer = state.players[state.currentPlayerIndex]
  const isPlayingPhase = !['round-over', 'game-over', 'showdown'].includes(state.phase)
  const isHumanTurn = state.currentPlayerIndex === 0 && isPlayingPhase && !humanPlayer.folded
  const availableActions = isHumanTurn ? getAvailableActions(state) : []
  const callAmt = state.currentBet - humanPlayer.currentBet
  const minRaise = state.currentBet + state.bigBlind

  useEffect(() => {
    if (isHumanTurn) setRaiseAmount(minRaise)
  }, [isHumanTurn, minRaise])

  // ─── AI Turn Handler
  useEffect(() => {
    if (!currentPlayer?.isAI || !isPlayingPhase || currentPlayer.folded || currentPlayer.isAllIn) return

    const delay = 700 + Math.random() * 500
    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        const cp = prev.players[prev.currentPlayerIndex]
        if (!cp.isAI || ['round-over', 'game-over', 'showdown'].includes(prev.phase)) return prev
        const decision = getAIDecision(prev, level)
        return performAction(prev, decision.action, decision.raiseAmount)
      })
    }, delay)

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  }, [state.currentPlayerIndex, state.phase, state.turnSeq, level, currentPlayer, isPlayingPhase])

  useEffect(() => {
    if (state.phase === 'game-over') onGameOver(getScore(state))
  }, [state.phase, onGameOver, state])

  const handleAction = useCallback((action: 'fold' | 'check' | 'call' | 'raise' | 'all-in', amount?: number) => {
    if (!isHumanTurn) return
    setShowRaiseSlider(false)
    setState(prev => performAction(prev, action, amount))
  }, [isHumanTurn])

  const handleNextHand = useCallback(() => setState(prev => startNewRound(prev)), [])
  const handleNewGame = useCallback(() => setState(initGame(numAI)), [numAI])

  const phaseLabel = state.phase.charAt(0).toUpperCase() + state.phase.slice(1).replace('-', ' ')

  return (
    <div className="w-full h-full flex flex-col relative select-none" style={{ minHeight: '100dvh' }}>
      <button onClick={() => setShowRules(true)} className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold border border-slate-700/50">?</button>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-2 text-xs bg-slate-900/60">
        <div className="flex items-center gap-2 flex-wrap">
          {state.players.map((p, i) => (
            <div key={p.id} className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
              p.folded ? 'opacity-30' :
              i === state.currentPlayerIndex && isPlayingPhase
                ? 'bg-green-500/20 ring-1 ring-green-400/50' : 'bg-slate-800/50'
            }`}>
              <span>{p.icon}</span>
              <span className="text-slate-300 font-medium">{p.name}</span>
              <span className="text-amber-400 font-bold">{p.chips}</span>
              {p.isAllIn && <span className="text-red-400 text-[10px] font-bold">ALL IN</span>}
              {p.folded && <span className="text-slate-600 text-[10px]">fold</span>}
            </div>
          ))}
        </div>
        <div className="text-amber-400 font-bold">Pot: {state.pot}</div>
      </div>

      {/* AI players */}
      <div className="flex justify-center gap-4 px-4 py-2 flex-wrap">
        {state.players.slice(1).map(p => (
          <div key={p.id} className={`flex flex-col items-center ${p.folded ? 'opacity-30' : ''}`}>
            <span className="text-lg">{p.icon}</span>
            <span className="text-[10px] text-slate-400">{p.name}</span>
            <div className="flex gap-1 mt-1">
              {p.hand.map(card => (
                <CardView key={card.id} card={card} faceUp={state.phase === 'showdown' && !p.folded} size="sm" />
              ))}
            </div>
            {p.currentBet > 0 && <span className="text-[10px] text-amber-400 mt-0.5">Bet: {p.currentBet}</span>}
            {p.lastAction && <span className="text-[10px] text-slate-500">{p.lastAction}</span>}
          </div>
        ))}
      </div>

      {/* Community cards */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="text-xs text-slate-500 font-medium">{phaseLabel} &middot; Hand #{state.roundNumber}</div>
          <div className="flex gap-2">
            {[0, 1, 2, 3, 4].map(i => {
              const card = state.communityCards[i]
              if (card) return <CardView key={card.id} card={card} size="lg" faceUp />
              return <div key={i} className="rounded-lg" style={{ width: 72, height: 100, background: 'rgba(30, 27, 75, 0.2)', border: '1px dashed rgba(100, 116, 139, 0.2)' }} />
            })}
          </div>
          <div className="text-amber-400 font-bold text-lg">Pot: {state.pot}</div>
          {state.communityCards.length >= 3 && !humanPlayer.folded && (
            <div className="text-xs text-green-400/60">{evaluateHand([...humanPlayer.hand, ...state.communityCards]).description}</div>
          )}
        </div>
      </div>

      <div className="text-center px-4 py-1"><p className="text-sm text-slate-400">{state.message}</p></div>

      {/* Actions */}
      {isHumanTurn && !humanPlayer.folded && availableActions.length > 0 && (
        <div className="px-4 py-2 space-y-2">
          {showRaiseSlider && (
            <div className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3">
              <input type="range" min={minRaise} max={humanPlayer.chips + humanPlayer.currentBet} step={state.bigBlind} value={raiseAmount} onChange={e => setRaiseAmount(parseInt(e.target.value))} className="flex-1 accent-green-500" />
              <span className="text-amber-400 font-bold text-sm min-w-[60px] text-right">{raiseAmount}</span>
              <button onClick={() => handleAction('raise', raiseAmount)} className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-sm">Raise</button>
              <button onClick={() => setShowRaiseSlider(false)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm">Cancel</button>
            </div>
          )}
          {!showRaiseSlider && (
            <div className="flex gap-2 justify-center">
              {availableActions.includes('fold') && (
                <button onClick={() => handleAction('fold')} className="px-5 py-2.5 bg-red-600/80 hover:bg-red-500 text-white rounded-lg font-semibold text-sm transition-colors">Fold</button>
              )}
              {availableActions.includes('check') && (
                <button onClick={() => handleAction('check')} className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg font-semibold text-sm transition-colors">Check</button>
              )}
              {availableActions.includes('call') && (
                <button onClick={() => handleAction('call')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors">Call {callAmt}</button>
              )}
              {availableActions.includes('raise') && (
                <button onClick={() => setShowRaiseSlider(true)} className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold text-sm transition-colors">Raise</button>
              )}
              {availableActions.includes('all-in') && !availableActions.includes('raise') && (
                <button onClick={() => handleAction('all-in')} className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-sm transition-colors">All In</button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center gap-2">
          {humanPlayer.hand.map(card => <CardView key={card.id} card={card} size="lg" faceUp />)}
        </div>
        <div className="text-center mt-1 text-xs text-slate-500">
          Chips: <span className="text-amber-400 font-bold">{humanPlayer.chips}</span>
          {humanPlayer.currentBet > 0 && <span className="ml-2">Bet: <span className="text-cyan-400">{humanPlayer.currentBet}</span></span>}
        </div>
      </div>

      {/* Round over / Showdown */}
      {(state.phase === 'round-over' || state.phase === 'showdown') && state.showdownResults && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-2xl mb-2">&#x1F3B0;</p>
            <h3 className="text-white font-bold text-lg mb-1">Hand #{state.roundNumber}</h3>
            <p className="text-green-400 text-sm mb-3">{state.message}</p>
            {state.showdownResults.length > 0 && state.showdownResults[0].handName !== 'Win by fold' && (
              <p className="text-amber-400 text-xs mb-3">{state.showdownResults[0].handName}</p>
            )}
            <div className="space-y-2 mb-4">
              {state.players.filter(p => p.chips > 0).map(p => (
                <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${p.id === state.winnerId ? 'bg-green-500/20 ring-1 ring-green-400/50' : 'bg-slate-800/50'}`}>
                  <span className="text-sm text-slate-300">{p.icon} {p.name}</span>
                  <span className="text-amber-400 font-bold text-sm">{p.chips}</span>
                </div>
              ))}
            </div>
            <button onClick={handleNextHand} className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors">Next Hand</button>
          </div>
        </div>
      )}

      {/* Game over */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-3xl mb-2">{state.winnerId === 'human' ? '\u{1F389}' : '\u{1F614}'}</p>
            <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
            <p className="text-green-400 text-sm mb-4">{state.message}</p>
            <div className="space-y-2 mb-4">
              {[...state.players].sort((a, b) => b.chips - a.chips).map((p, i) => (
                <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${i === 0 ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'}`}>
                  <span className="text-sm text-slate-300">{i === 0 ? '\u{1F451}' : ''} {p.icon} {p.name}</span>
                  <span className="text-amber-400 font-bold text-sm">{p.chips}</span>
                </div>
              ))}
            </div>
            <button onClick={handleNewGame} className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors">Play Again</button>
          </div>
        </div>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
