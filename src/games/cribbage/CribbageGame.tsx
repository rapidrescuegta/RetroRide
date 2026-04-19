'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  SUIT_SYMBOLS,
  SUIT_COLORS,
} from '@/lib/card-engine'
import {
  type CribbageState,
  initGame,
  toggleCribSelection,
  confirmCribDiscard,
  cutDeck,
  getPlayablePegCards,
  pegCard,
  pegPass,
  countHands,
  nextRound,
  aiPegPlay,
  pegValue,
} from './cribbage-rules'

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
    sm: { w: 40, h: 56, rank: 'text-[9px]', suit: 'text-xs' },
    md: { w: 52, h: 73, rank: 'text-xs', suit: 'text-base' },
    lg: { w: 64, h: 90, rank: 'text-sm', suit: 'text-lg' },
  }
  const { w, h, rank: rankSize, suit: suitSize } = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        style={{ width: w, height: h }}
        className="rounded-md bg-gradient-to-br from-blue-900 to-blue-950 border border-blue-600/30 flex items-center justify-center shrink-0"
      >
        <span className="text-blue-400/40 text-lg">&#x1F0A0;</span>
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
      } ${disabled ? 'opacity-50' : ''}`}
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

// ─── Cribbage Board ─────────────────────────────────────────────────────────

function CribbageBoard({ playerScore, aiScore, target }: { playerScore: number; aiScore: number; target: number }) {
  const totalHoles = 30 // Simplified visual track
  const scale = target / totalHoles

  const playerPos = Math.min(totalHoles, Math.round(playerScore / scale))
  const aiPos = Math.min(totalHoles, Math.round(aiScore / scale))

  return (
    <div className="w-full px-4 py-1">
      <div className="bg-amber-950/50 rounded-lg border border-amber-900/30 p-2">
        {/* Player track */}
        <div className="flex items-center gap-0.5 mb-1">
          <span className="text-[8px] text-slate-400 w-6">You</span>
          <div className="flex-1 flex gap-[1px]">
            {Array.from({ length: totalHoles }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < playerPos
                    ? 'bg-cyan-400'
                    : i === playerPos
                      ? 'bg-cyan-300 shadow-[0_0_4px_rgba(34,211,238,0.8)]'
                      : 'bg-amber-900/40'
                }`}
              />
            ))}
          </div>
          <span className="text-[9px] text-cyan-400 font-bold w-8 text-right">{playerScore}</span>
        </div>
        {/* AI track */}
        <div className="flex items-center gap-0.5">
          <span className="text-[8px] text-slate-400 w-6">AI</span>
          <div className="flex-1 flex gap-[1px]">
            {Array.from({ length: totalHoles }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all ${
                  i < aiPos
                    ? 'bg-red-400'
                    : i === aiPos
                      ? 'bg-red-300 shadow-[0_0_4px_rgba(239,68,68,0.8)]'
                      : 'bg-amber-900/40'
                }`}
              />
            ))}
          </div>
          <span className="text-[9px] text-red-400 font-bold w-8 text-right">{aiScore}</span>
        </div>
        <div className="text-center text-[8px] text-slate-600 mt-0.5">Target: {target}</div>
      </div>
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Cribbage Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-blue-400">Deal:</strong> 6 cards each. Discard 2 to the crib (belongs to dealer).</p>
          <p><strong className="text-blue-400">Starter:</strong> Cut deck for a starter card. Jack = 2 points to dealer (His Heels).</p>
          <p><strong className="text-blue-400">Pegging:</strong> Alternate playing cards. Count up to 31.</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>15 = 2 points</li>
            <li>31 = 2 points</li>
            <li>Pair = 2, Three of a kind = 6, Four = 12</li>
            <li>Run of 3+ = length in points</li>
            <li>Last card = 1 point (Go)</li>
          </ul>
          <p><strong className="text-blue-400">Hand Scoring:</strong> 15s (2pts), pairs (2pts), runs, flushes, nobs (J of starter suit = 1pt).</p>
          <p><strong className="text-blue-400">Win:</strong> First to 121 points!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function CribbageGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<CribbageState>(() => initGame())
  const [showRules, setShowRules] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isPlayerTurn = state.currentPlayer === 'player'
  const playablePegIds = state.phase === 'pegging' ? getPlayablePegCards(state, 'player') : []

  // ─── AI Pegging ───────────────────────────────────────────────────────

  useEffect(() => {
    if (state.currentPlayer !== 'ai' || state.phase !== 'pegging') return

    const delay = 700 + Math.random() * 700

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        if (prev.currentPlayer !== 'ai' || prev.phase !== 'pegging') return prev

        const cardId = aiPegPlay(prev, level)
        if (cardId) {
          return pegCard(prev, 'ai', cardId)
        }
        // AI can't play, pass
        return pegPass(prev, 'ai')
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayer, state.phase, state.pegCount, level, state.aiPegHand.length])

  // Auto-count hands
  useEffect(() => {
    if (state.phase !== 'counting') return
    const timer = setTimeout(() => {
      setState(prev => countHands(prev))
    }, 1000)
    return () => clearTimeout(timer)
  }, [state.phase])

  // Game over
  useEffect(() => {
    if (state.phase === 'game-over') {
      onGameOver(state.playerScore)
    }
  }, [state.phase, state.playerScore, onGameOver])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleToggleCrib = useCallback((cardId: string) => {
    if (state.phase !== 'discard') return
    setState(prev => toggleCribSelection(prev, cardId))
  }, [state.phase])

  const handleConfirmCrib = useCallback(() => {
    if (state.selectedForCrib.length !== 2) return
    setState(prev => confirmCribDiscard(prev))
  }, [state.selectedForCrib.length])

  const handleCut = useCallback(() => {
    if (state.phase !== 'cut') return
    setState(prev => cutDeck(prev))
  }, [state.phase])

  const handlePegCard = useCallback((cardId: string) => {
    if (!isPlayerTurn || state.phase !== 'pegging') return
    setState(prev => pegCard(prev, 'player', cardId))
  }, [isPlayerTurn, state.phase])

  const handlePegPass = useCallback(() => {
    if (!isPlayerTurn || state.phase !== 'pegging') return
    setState(prev => pegPass(prev, 'player'))
  }, [isPlayerTurn, state.phase])

  const handleNextRound = useCallback(() => {
    setState(prev => nextRound(prev))
  }, [])

  const handleNewGame = useCallback(() => {
    setState(initGame())
  }, [])

  // Check if player must pass
  const mustPass = isPlayerTurn && state.phase === 'pegging' && playablePegIds.length === 0 && state.playerPegHand.length > 0

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

      {/* Cribbage Board */}
      <CribbageBoard playerScore={state.playerScore} aiScore={state.aiScore} target={state.targetScore} />

      {/* Info bar */}
      <div className="flex items-center justify-center gap-4 px-3 py-1 text-xs">
        <span className="text-slate-500">Round {state.roundNumber}</span>
        <span className="text-slate-500">Dealer: {state.dealer === 'player' ? 'You' : 'AI'}</span>
        {state.phase === 'pegging' && (
          <span className="text-amber-400 font-bold">Count: {state.pegCount}</span>
        )}
      </div>

      {/* AI hand */}
      <div className="flex justify-center py-1">
        <div className="flex -space-x-6">
          {(state.phase === 'pegging' ? state.aiPegHand : state.aiHand).slice(0, 6).map(card => (
            <CardView key={card.id} card={card} faceUp={false} size="sm" />
          ))}
        </div>
        <span className="text-[10px] text-slate-500 ml-2 self-center">
          &#x1F916; AI ({(state.phase === 'pegging' ? state.aiPegHand : state.aiHand).length})
        </span>
      </div>

      {/* Center area */}
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* Starter card */}
          {state.starter && (
            <div className="flex flex-col items-center">
              <CardView card={state.starter} size="lg" faceUp />
              <span className="text-[10px] text-slate-400 mt-1">Starter</span>
            </div>
          )}

          {/* Cut button */}
          {state.phase === 'cut' && (
            <button
              onClick={handleCut}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors animate-pulse"
            >
              Cut the Deck
            </button>
          )}

          {/* Pegging area */}
          {state.phase === 'pegging' && state.pegPlays.length > 0 && (
            <div className="flex flex-wrap gap-1 justify-center max-w-[280px]">
              {state.pegPlays.map(({ playerId, card }, i) => (
                <div key={i} className="flex flex-col items-center">
                  <CardView card={card} size="sm" faceUp />
                  <span className="text-[8px] text-slate-500">
                    {playerId === 'player' ? 'You' : 'AI'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Crib (face down during play, shown at counting) */}
          {state.crib.length > 0 && state.phase !== 'discard' && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500">Crib:</span>
              <div className="flex -space-x-4">
                {state.crib.map(card => (
                  <CardView
                    key={card.id}
                    card={card}
                    faceUp={state.phase === 'round-over' || state.phase === 'game-over'}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Last peg points */}
          {state.lastPegPoints && (
            <div className={`text-sm font-bold animate-pulse ${
              state.lastPegPoints.player === 'player' ? 'text-cyan-400' : 'text-red-400'
            }`}>
              +{state.lastPegPoints.points}: {state.lastPegPoints.reason}
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      <div className="text-center px-4 py-1">
        <p className="text-sm text-slate-400">{state.message}</p>
      </div>

      {/* Pass button for pegging */}
      {mustPass && (
        <div className="text-center pb-2">
          <button
            onClick={handlePegPass}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Go (Can&apos;t Play)
          </button>
        </div>
      )}

      {/* Confirm crib button */}
      {state.phase === 'discard' && state.selectedForCrib.length === 2 && (
        <div className="text-center pb-2">
          <button
            onClick={handleConfirmCrib}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Send to Crib
          </button>
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center flex-wrap gap-[2px]">
          {(state.phase === 'pegging' ? state.playerPegHand :
            state.phase === 'discard' ? state.playerHand : state.playerHand
          ).map(card => {
            const isSelected = state.selectedForCrib.includes(card.id)
            const isPlayable = state.phase === 'discard' || playablePegIds.includes(card.id)

            return (
              <CardView
                key={card.id}
                card={card}
                size="md"
                faceUp
                selected={isSelected}
                playable={isPlayable}
                disabled={state.phase === 'pegging' ? !playablePegIds.includes(card.id) : false}
                onClick={
                  state.phase === 'discard'
                    ? () => handleToggleCrib(card.id)
                    : state.phase === 'pegging' && playablePegIds.includes(card.id)
                      ? () => handlePegCard(card.id)
                      : undefined
                }
              />
            )
          })}
        </div>
      </div>

      {/* Round Over overlay */}
      {state.phase === 'round-over' && state.handScoreDetails && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 text-center max-w-sm w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-white font-bold text-lg mb-3">Round {state.roundNumber} Complete</h3>

            {/* Score breakdown */}
            {['player', 'ai'].map(who => {
              const details = who === 'player' ? state.handScoreDetails!.player : state.handScoreDetails!.ai
              return (
                <div key={who} className="mb-3">
                  <p className="text-slate-400 text-xs font-semibold mb-1">
                    {who === 'player' ? 'Your Hand' : 'AI Hand'}
                    {state.dealer === who ? ' (+ Crib)' : ''}
                  </p>
                  <div className="grid grid-cols-5 gap-1 text-[10px]">
                    {details.fifteens > 0 && <span className="text-amber-400">15s: {details.fifteens}</span>}
                    {details.pairs > 0 && <span className="text-amber-400">Pairs: {details.pairs}</span>}
                    {details.runs > 0 && <span className="text-amber-400">Runs: {details.runs}</span>}
                    {details.flush > 0 && <span className="text-amber-400">Flush: {details.flush}</span>}
                    {details.nobs > 0 && <span className="text-amber-400">Nobs: {details.nobs}</span>}
                  </div>
                  <p className={`text-sm font-bold ${who === 'player' ? 'text-cyan-400' : 'text-red-400'}`}>
                    +{details.total} points
                  </p>
                </div>
              )
            })}

            {state.dealer && (
              <div className="mb-3">
                <p className="text-slate-400 text-[10px]">Crib ({state.dealer === 'player' ? 'Yours' : "AI's"}): +{state.handScoreDetails!.crib.total}</p>
              </div>
            )}

            <div className="flex items-center justify-between text-sm mb-4 px-4">
              <span className="text-slate-300">You: <span className="text-cyan-400 font-bold">{state.playerScore}</span></span>
              <span className="text-slate-500">/ {state.targetScore}</span>
              <span className="text-slate-300">AI: <span className="text-red-400 font-bold">{state.aiScore}</span></span>
            </div>

            <button
              onClick={handleNextRound}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
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
              {state.playerScore >= state.targetScore ? '\u{1F3C6}' : '\u{1F4A8}'}
            </p>
            <h3 className="text-white font-bold text-xl mb-1">
              {state.playerScore >= state.targetScore ? 'You Win!' : 'AI Wins!'}
            </h3>
            <div className="space-y-2 mb-4 mt-3">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                state.playerScore >= state.targetScore ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
              }`}>
                <span className="text-sm text-slate-300">&#x1F60A; You</span>
                <span className="text-cyan-400 font-bold text-sm">{state.playerScore}</span>
              </div>
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                state.aiScore >= state.targetScore ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
              }`}>
                <span className="text-sm text-slate-300">&#x1F916; AI</span>
                <span className="text-red-400 font-bold text-sm">{state.aiScore}</span>
              </div>
            </div>
            <button
              onClick={handleNewGame}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-colors"
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
