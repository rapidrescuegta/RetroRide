'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type CCCard,
  type CCColor,
  type ColorClashState,
  initGame,
  playCard,
  chooseColor,
  drawCards,
  passTurn,
  startNewRound,
  getAIMove,
  getAIColorChoice,
  getPlayableCards,
  hasPlayableCard,
  isStalemate,
  handPoints,
  COLOR_DISPLAY,
  VALUE_DISPLAY,
} from './color-clash-rules'

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
  card: CCCard
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  disabled?: boolean
}) {
  const sizes = {
    sm: { w: 44, h: 62, value: 'text-[10px]', icon: 'text-sm' },
    md: { w: 56, h: 78, value: 'text-xs', icon: 'text-lg' },
    lg: { w: 72, h: 100, value: 'text-sm', icon: 'text-xl' },
  }
  const { w, h, value: valueSize, icon: iconSize } = sizes[size]
  const colorInfo = COLOR_DISPLAY[card.color]

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

  const isWild = card.color === 'wild'
  const isAction = ['skip', 'reverse', 'draw2', 'wild', 'wild-draw4'].includes(card.value)

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`rounded-lg flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        onClick && !disabled ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${selected ? '-translate-y-3 ring-2 ring-cyan-400' : ''} ${
        playable && !selected ? 'ring-1 ring-cyan-400/40' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      style={{
        width: w,
        height: h,
        color: isWild ? '#e2e8f0' : colorInfo.hex,
        background: isWild
          ? 'linear-gradient(135deg, #ef4444 0%, #3b82f6 33%, #22c55e 66%, #eab308 100%)'
          : `linear-gradient(135deg, ${colorInfo.bg} 0%, #1e293b 100%)`,
        border: isAction
          ? `2px solid ${colorInfo.hex}80`
          : `1px solid ${colorInfo.hex}40`,
        boxShadow: isWild ? '0 0 8px rgba(167, 139, 250, 0.3)' : undefined,
      }}
    >
      <span className={`${valueSize} font-bold leading-none`}>
        {VALUE_DISPLAY[card.value] || card.value}
      </span>
      {!isWild && (
        <span className={`${iconSize} leading-none mt-0.5`} style={{ color: colorInfo.hex }}>
          &#x25CF;
        </span>
      )}
    </div>
  )
}

// ─── Color Picker ───────────────────────────────────────────────────────────

function ColorPicker({ onChoose }: { onChoose: (color: CCColor) => void }) {
  const colors: CCColor[] = ['red', 'blue', 'green', 'yellow']

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 text-center">
        <p className="text-white font-bold text-lg mb-1">WILD CARD!</p>
        <p className="text-slate-400 text-sm mb-4">Choose a color</p>
        <div className="grid grid-cols-2 gap-3">
          {colors.map(color => {
            const info = COLOR_DISPLAY[color]
            return (
              <button
                key={color}
                onClick={() => onChoose(color)}
                className="w-20 h-20 rounded-xl flex flex-col items-center justify-center text-3xl font-bold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: info.bg,
                  color: info.hex,
                  border: `2px solid ${info.hex}40`,
                }}
              >
                <span>&#x25CF;</span>
                <span className="text-[10px] mt-1 capitalize">{color}</span>
              </button>
            )
          })}
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
        <h3 className="text-white font-bold text-lg mb-3">Color Clash Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-purple-400">Goal:</strong> Get rid of all your cards first!</p>
          <p><strong className="text-purple-400">Play:</strong> Match the top card by color or value.</p>
          <p><strong className="text-purple-400">Wild cards</strong> can be played anytime — pick the new color.</p>
          <p><strong className="text-purple-400">+2:</strong> Next player draws 2 and loses their turn.</p>
          <p><strong className="text-purple-400">+4:</strong> Wild + next player draws 4!</p>
          <p><strong className="text-purple-400">Skip:</strong> Next player loses their turn.</p>
          <p><strong className="text-purple-400">Reverse:</strong> Changes play direction.</p>
          <p><strong className="text-purple-400">Draw:</strong> If you cannot play, draw from the deck.</p>
          <p><strong className="text-purple-400">Scoring:</strong> Winner scores points from others hands:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Wild/+4 = 50 pts</li>
            <li>Skip/Reverse/+2 = 20 pts</li>
            <li>Number cards = face value</li>
          </ul>
          <p><strong className="text-purple-400">Win:</strong> First to 300 points wins!</p>
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

// ─── Flash Animation ────────────────────────────────────────────────────────

function ActionFlash({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div
        className="text-3xl font-black text-transparent bg-clip-text animate-pulse"
        style={{
          backgroundImage: 'linear-gradient(135deg, #ef4444, #3b82f6, #22c55e, #eab308)',
          animation: 'ccFlash 1.5s ease-out forwards',
        }}
      >
        {text}
      </div>
      <style>{`
        @keyframes ccFlash {
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

export default function ColorClashGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<ColorClashState>(() => initGame(level === 'easy' ? 1 : level === 'medium' ? 2 : 3))
  const [showRules, setShowRules] = useState(false)
  const [flashText, setFlashText] = useState<string | null>(null)
  const [animatingCard, setAnimatingCard] = useState<string | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const topCard = state.discardPile[state.discardPile.length - 1]
  const humanPlayer = state.players[0]
  const isHumanTurn = state.currentPlayerIndex === 0 && state.phase === 'playing'
  const playableCards = isHumanTurn ? getPlayableCards(humanPlayer.hand, topCard, state.currentColor) : []
  const canDraw = isHumanTurn && (state.deck.length > 0 || state.discardPile.length > 1 || state.pendingDraw > 0)
  const mustDraw = isHumanTurn && state.pendingDraw > 0

  // ─── AI Turn Handler ────────────────────────────────────────────────────
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]

    if (state.phase === 'playing' && isStalemate(state)) {
      let minPoints = Infinity
      let winnerId = state.players[0].id
      state.players.forEach(p => {
        const pts = handPoints(p.hand)
        if (pts < minPoints) { minPoints = pts; winnerId = p.id }
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
          if (playedCard && ['skip', 'reverse', 'draw2'].includes(playedCard.value)) {
            const labels: Record<string, string> = { skip: 'SKIP!', reverse: 'REVERSE!', draw2: '+2!' }
            setFlashText(labels[playedCard.value] || '')
            setTimeout(() => setFlashText(null), 1500)
          }
          return playCard(prev, move.cardId)
        } else if (move.action === 'draw') {
          return drawCards(prev)
        }
        return passTurn(prev)
      })
    }, delay)

    return () => { if (aiTimerRef.current) clearTimeout(aiTimerRef.current) }
  }, [state.currentPlayerIndex, state.phase, state.players, level, state.deck.length])

  // AI choosing color after wild
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAI || state.phase !== 'choosing-color') return

    const timer = setTimeout(() => {
      const color = getAIColorChoice(state, level)
      setState(prev => chooseColor(prev, color))
    }, 600)

    return () => clearTimeout(timer)
  }, [state.phase, state.currentPlayerIndex, state.players, level])

  // Game over callback
  useEffect(() => {
    if (state.phase === 'game-over') {
      onGameOver(state.players[0].score)
    }
  }, [state.phase, state.players, onGameOver])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handlePlayCard = useCallback((cardId: string) => {
    if (!isHumanTurn || mustDraw) return
    const card = humanPlayer.hand.find(c => c.id === cardId)
    if (!card || !playableCards.some(c => c.id === cardId)) return

    if (['skip', 'reverse', 'draw2'].includes(card.value)) {
      const labels: Record<string, string> = { skip: 'SKIP!', reverse: 'REVERSE!', draw2: '+2!' }
      setFlashText(labels[card.value] || '')
      setTimeout(() => setFlashText(null), 1500)
    }
    if (card.color === 'wild') {
      const label = card.value === 'wild-draw4' ? 'WILD +4!' : 'WILD!'
      setFlashText(label)
      setTimeout(() => setFlashText(null), 1500)
    }

    setAnimatingCard(cardId)
    setTimeout(() => {
      setAnimatingCard(null)
      setState(prev => playCard(prev, cardId))
    }, 200)
  }, [isHumanTurn, mustDraw, humanPlayer, playableCards])

  const handleDraw = useCallback(() => {
    if (!canDraw) return
    setState(prev => drawCards(prev))
  }, [canDraw])

  const handlePass = useCallback(() => {
    setState(prev => passTurn(prev))
  }, [])

  const handleChooseColor = useCallback((color: CCColor) => {
    if (state.currentPlayerIndex !== 0 || state.phase !== 'choosing-color') return
    setState(prev => chooseColor(prev, color))
  }, [state.currentPlayerIndex, state.phase])

  const handleNewRound = useCallback(() => {
    setState(prev => startNewRound(prev))
  }, [])

  const handleNewGame = useCallback(() => {
    setState(initGame(level === 'easy' ? 1 : level === 'medium' ? 2 : 3))
  }, [level])

  // ─── Render ─────────────────────────────────────────────────────────────

  const directionArrow = state.direction === 1 ? '\u{27F3}' : '\u{27F2}'

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
        <span className="text-slate-500 text-lg">{directionArrow}</span>
      </div>

      {/* AI hands */}
      <div className="flex justify-center gap-6 px-4 py-2">
        {state.players.slice(1).map(p => (
          <div key={p.id} className="flex flex-col items-center">
            <span className="text-lg">{p.icon}</span>
            <div className="flex -space-x-6 mt-1">
              {p.hand.slice(0, 10).map(card => (
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
            {mustDraw && (
              <span className="text-[10px] text-red-400 animate-pulse font-bold">
                Must draw {state.pendingDraw}!
              </span>
            )}
            {canDraw && !mustDraw && (
              <span className="text-[10px] text-cyan-400 animate-pulse">Draw</span>
            )}
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1 relative">
            <CardView card={topCard} size="lg" faceUp />
            {/* Current color indicator */}
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold"
              style={{
                color: COLOR_DISPLAY[state.currentColor].hex,
                background: COLOR_DISPLAY[state.currentColor].bg,
                border: `1px solid ${COLOR_DISPLAY[state.currentColor].hex}30`,
                boxShadow: `0 0 12px ${COLOR_DISPLAY[state.currentColor].hex}20`,
              }}
            >
              <span>&#x25CF;</span>
              <span className="text-[10px] capitalize">{state.currentColor}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Message bar */}
      <div className="text-center px-4 py-1">
        <p className="text-sm text-slate-400">{state.message}</p>
      </div>

      {/* Pass button (when drew but can't play) */}
      {isHumanTurn && !mustDraw && state.lastAction === 'drew' && (
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
            const isPlayable = !mustDraw && playableCards.some(c => c.id === card.id)
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

      {/* Color picker overlay */}
      {state.phase === 'choosing-color' && state.currentPlayerIndex === 0 && (
        <ColorPicker onChoose={handleChooseColor} />
      )}

      {/* Action flash */}
      {flashText && <ActionFlash text={flashText} />}

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
