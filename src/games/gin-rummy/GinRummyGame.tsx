'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  SUIT_SYMBOLS,
  SUIT_COLORS,
} from '@/lib/card-engine'
import {
  type GinRummyState,
  initGame,
  startNewRound,
  drawFromDeck,
  drawFromDiscard,
  discardCard,
  knock,
  continuePlay,
  aiTurn,
  findBestMelds,
  deadwoodTotal,
  getDeadwoodValue,
} from './gin-rummy-rules'

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
  highlight = false,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  disabled?: boolean
  highlight?: boolean
}) {
  const sizes = {
    sm: { w: 44, h: 62, rank: 'text-[10px]', suit: 'text-sm' },
    md: { w: 52, h: 73, rank: 'text-xs', suit: 'text-base' },
    lg: { w: 64, h: 90, rank: 'text-sm', suit: 'text-lg' },
  }
  const { w, h, rank: rankSize, suit: suitSize } = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        style={{ width: w, height: h }}
        className="rounded-md bg-gradient-to-br from-amber-900 to-amber-950 border border-amber-700/30 flex items-center justify-center shrink-0"
      >
        <span className="text-amber-500/40 text-lg">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled || !onClick}
      style={{ width: w, height: h }}
      className={`rounded-md border flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-400/10 -translate-y-3 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
          : playable && onClick
            ? 'border-slate-600 bg-slate-800 hover:border-slate-400 hover:bg-slate-700 cursor-pointer active:scale-95'
            : 'border-slate-700/50 bg-slate-800/60'
      } ${highlight ? 'ring-1 ring-amber-400/60' : ''} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`font-bold leading-none ${rankSize}`} style={{ color }}>
        {card.rank}
      </span>
      <span className={`leading-none ${suitSize}`} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Gin Rummy Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-amber-400">Goal:</strong> Form melds (sets/runs) and minimize deadwood (unmelded cards).</p>
          <p><strong className="text-amber-400">Melds:</strong> Sets of 3-4 same rank, or runs of 3+ consecutive same suit.</p>
          <p><strong className="text-amber-400">Draw:</strong> Take from deck or discard pile, then discard one card.</p>
          <p><strong className="text-amber-400">Knock:</strong> When deadwood &le; 10 points, you may knock to end the round.</p>
          <p><strong className="text-amber-400">Gin:</strong> Knock with 0 deadwood for a 25-point bonus!</p>
          <p><strong className="text-amber-400">Undercut:</strong> If defender has equal or less deadwood, they get 25 bonus points!</p>
          <p><strong className="text-amber-400">Card Values:</strong> A=1, 2-10=face value, J/Q/K=10.</p>
          <p><strong className="text-amber-400">Win:</strong> First to 100 points wins the game!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GinRummyGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<GinRummyState>(() => initGame())
  const [showRules, setShowRules] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const topDiscard = state.discardPile.length > 0
    ? state.discardPile[state.discardPile.length - 1]
    : null
  const isPlayerTurn = state.currentPlayer === 'player'
  const playerDW = getDeadwoodValue(state.playerHand)

  // ─── AI Turn Handler ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.currentPlayer !== 'ai' || state.phase === 'round-over' || state.phase === 'game-over') return

    const delay = 800 + Math.random() * 800

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.currentPlayer !== 'ai') return prev
        if (prev.phase === 'round-over' || prev.phase === 'game-over') return prev
        return aiTurn(prev, level)
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayer, state.phase, level])

  // ─── Game Over ────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'game-over') {
      onGameOver(state.playerScore)
    }
  }, [state.phase, state.playerScore, onGameOver])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleDrawDeck = useCallback(() => {
    if (!isPlayerTurn || state.phase !== 'draw') return
    setState(prev => drawFromDeck(prev))
  }, [isPlayerTurn, state.phase])

  const handleDrawDiscard = useCallback(() => {
    if (!isPlayerTurn || state.phase !== 'draw') return
    if (state.discardPile.length === 0) return
    setState(prev => drawFromDiscard(prev))
  }, [isPlayerTurn, state.phase, state.discardPile.length])

  const handleDiscard = useCallback((cardId: string) => {
    if (!isPlayerTurn || state.phase !== 'discard') return
    setState(prev => discardCard(prev, cardId))
  }, [isPlayerTurn, state.phase])

  const handleKnock = useCallback(() => {
    if (state.phase !== 'knock-decision') return
    setState(prev => knock(prev, 'player'))
  }, [state.phase])

  const handleContinue = useCallback(() => {
    if (state.phase !== 'knock-decision') return
    setState(prev => continuePlay(prev))
  }, [state.phase])

  const handleNextRound = useCallback(() => {
    setState(prev => startNewRound(prev))
  }, [])

  const handleNewGame = useCallback(() => {
    setState(initGame())
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────

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
      <div className="flex items-center justify-center gap-6 px-3 py-2 text-xs bg-slate-900/60">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          isPlayerTurn && state.phase !== 'round-over' && state.phase !== 'game-over'
            ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
        }`}>
          <span>&#x1F60A;</span>
          <span className="text-slate-300 font-medium">You</span>
          <span className="text-amber-400 font-bold">{state.playerScore}</span>
        </div>
        <div className="text-slate-600 text-[10px]">Round {state.roundNumber}</div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          !isPlayerTurn && state.phase !== 'round-over' && state.phase !== 'game-over'
            ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
        }`}>
          <span>&#x1F916;</span>
          <span className="text-slate-300 font-medium">AI</span>
          <span className="text-amber-400 font-bold">{state.aiScore}</span>
        </div>
      </div>

      {/* AI hand (face down) */}
      <div className="flex justify-center py-2">
        <div className="flex -space-x-6">
          {state.aiHand.slice(0, 10).map((card) => (
            <CardView key={card.id} card={card} faceUp={false} size="sm" />
          ))}
          {state.aiHand.length > 10 && (
            <div className="w-11 h-[62px] rounded-md bg-slate-800/50 border border-slate-700/30 flex items-center justify-center text-xs text-slate-500">
              +{state.aiHand.length - 10}
            </div>
          )}
        </div>
      </div>

      {/* Play area: deck + discard */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-6">
          {/* Deck */}
          <div className="flex flex-col items-center gap-1">
            <div
              onClick={isPlayerTurn && state.phase === 'draw' ? handleDrawDeck : undefined}
              className={`rounded-lg flex items-center justify-center transition-all ${
                isPlayerTurn && state.phase === 'draw' && state.deck.length > 0
                  ? 'cursor-pointer hover:scale-105 active:scale-95 ring-1 ring-cyan-400/30'
                  : 'opacity-40'
              }`}
              style={{
                width: 64,
                height: 90,
                background: state.deck.length > 0
                  ? 'linear-gradient(135deg, #78350f 0%, #92400e 100%)'
                  : 'rgba(120, 53, 15, 0.3)',
                border: '1px solid rgba(180, 83, 9, 0.3)',
              }}
            >
              {state.deck.length > 0 ? (
                <span className="text-amber-400/50 text-2xl">&#x1F0A0;</span>
              ) : (
                <span className="text-slate-600 text-xs">Empty</span>
              )}
            </div>
            <span className="text-[10px] text-slate-500">{state.deck.length}</span>
            {isPlayerTurn && state.phase === 'draw' && (
              <span className="text-[10px] text-cyan-400 animate-pulse">Draw</span>
            )}
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1">
            {topDiscard ? (
              <div
                onClick={isPlayerTurn && state.phase === 'draw' ? handleDrawDiscard : undefined}
                className={isPlayerTurn && state.phase === 'draw' ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
              >
                <CardView card={topDiscard} size="lg" faceUp />
              </div>
            ) : (
              <div
                className="rounded-lg border border-dashed border-slate-700 flex items-center justify-center"
                style={{ width: 64, height: 90 }}
              >
                <span className="text-slate-600 text-xs">Empty</span>
              </div>
            )}
            <span className="text-[10px] text-slate-500">Discard</span>
          </div>
        </div>
      </div>

      {/* Deadwood indicator */}
      <div className="text-center py-1">
        <span className="text-[10px] text-slate-500">
          Your deadwood: <span className={`font-bold ${playerDW <= 10 ? 'text-green-400' : 'text-amber-400'}`}>{playerDW}</span>
        </span>
      </div>

      {/* Message */}
      <div className="text-center px-4 py-1">
        <p className="text-sm text-slate-400">{state.message}</p>
      </div>

      {/* Knock decision buttons */}
      {state.phase === 'knock-decision' && (
        <div className="flex justify-center gap-3 py-2">
          <button
            onClick={handleKnock}
            className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            {playerDW === 0 ? 'GIN!' : 'Knock'}
          </button>
          <button
            onClick={handleContinue}
            className="px-5 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Continue
          </button>
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center flex-wrap gap-[2px]">
          {state.playerHand.map(card => {
            const canDiscard = isPlayerTurn && state.phase === 'discard'
            return (
              <CardView
                key={card.id}
                card={card}
                size="md"
                faceUp
                playable={canDiscard}
                disabled={!canDiscard}
                onClick={canDiscard ? () => handleDiscard(card.id) : undefined}
                highlight={state.drawnCard?.id === card.id}
              />
            )
          })}
        </div>
      </div>

      {/* Round Over overlay */}
      {state.phase === 'round-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-sm w-full mx-4">
            <p className="text-2xl mb-2">
              {state.roundResult
                ? state.roundResult.isGin ? '&#x1F525;' : state.roundResult.isUndercut ? '&#x1F62E;' : '&#x1F3C6;'
                : '&#x1F91D;'}
            </p>
            <h3 className="text-white font-bold text-lg mb-3">
              {state.roundResult ? 'Round Over!' : 'Draw!'}
            </h3>

            {state.roundResult && (
              <div className="space-y-2 mb-4 text-sm">
                {state.roundResult.isGin && (
                  <p className="text-amber-400 font-bold">GIN! +25 bonus</p>
                )}
                {state.roundResult.isUndercut && (
                  <p className="text-red-400 font-bold">UNDERCUT! +25 bonus</p>
                )}
                <p className="text-slate-300">
                  {state.roundResult.knocker === 'player' ? 'You' : 'AI'} knocked
                  (deadwood: {state.roundResult.knockerDeadwood})
                </p>
                <p className="text-slate-300">
                  Defender deadwood: {state.roundResult.defenderDeadwood}
                </p>
                <p className="text-amber-400 font-bold">
                  {state.roundResult.winner === 'player' ? 'You' : 'AI'} +{state.roundResult.points} points
                </p>
              </div>
            )}

            {/* Show melds */}
            {state.roundResult && (
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Your melds:</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {state.playerMelds.map((meld, i) => (
                      <div key={i} className="flex gap-0.5 bg-green-500/10 rounded px-1 py-0.5">
                        {meld.cards.map(c => (
                          <span key={c.id} className="text-[10px] font-bold" style={{ color: SUIT_COLORS[c.suit] }}>
                            {c.rank}{SUIT_SYMBOLS[c.suit]}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                  {state.playerDeadwood.length > 0 && (
                    <div className="flex gap-0.5 justify-center mt-1">
                      {state.playerDeadwood.map(c => (
                        <span key={c.id} className="text-[10px] text-red-400">
                          {c.rank}{SUIT_SYMBOLS[c.suit]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">AI melds:</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    {state.aiMelds.map((meld, i) => (
                      <div key={i} className="flex gap-0.5 bg-green-500/10 rounded px-1 py-0.5">
                        {meld.cards.map(c => (
                          <span key={c.id} className="text-[10px] font-bold" style={{ color: SUIT_COLORS[c.suit] }}>
                            {c.rank}{SUIT_SYMBOLS[c.suit]}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                  {state.aiDeadwood.length > 0 && (
                    <div className="flex gap-0.5 justify-center mt-1">
                      {state.aiDeadwood.map(c => (
                        <span key={c.id} className="text-[10px] text-red-400">
                          {c.rank}{SUIT_SYMBOLS[c.suit]}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-sm mb-4 px-4">
              <span className="text-slate-300">You: <span className="text-amber-400 font-bold">{state.playerScore}</span></span>
              <span className="text-slate-500">to {state.targetScore}</span>
              <span className="text-slate-300">AI: <span className="text-amber-400 font-bold">{state.aiScore}</span></span>
            </div>

            <button
              onClick={handleNextRound}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs mx-4">
            <p className="text-3xl mb-2">
              {state.playerScore >= state.targetScore ? '\u{1F389}' : '\u{1F4A8}'}
            </p>
            <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
            <p className="text-amber-400 text-sm mb-4">{state.message}</p>
            <div className="space-y-2 mb-4">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                state.playerScore >= state.targetScore ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
              }`}>
                <span className="text-sm text-slate-300">&#x1F60A; You</span>
                <span className="text-amber-400 font-bold text-sm">{state.playerScore} pts</span>
              </div>
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                state.aiScore >= state.targetScore ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
              }`}>
                <span className="text-sm text-slate-300">&#x1F916; AI</span>
                <span className="text-amber-400 font-bold text-sm">{state.aiScore} pts</span>
              </div>
            </div>
            <button
              onClick={handleNewGame}
              className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold transition-colors"
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
