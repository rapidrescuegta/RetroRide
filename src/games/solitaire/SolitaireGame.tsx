'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { type Card, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'
import { playPickup, playSelect, playWin, playGameOver, playMove } from '@/lib/sounds'
import {
  type SolitaireState,
  type CardSource,
  initGame,
  drawFromStock,
  moveToTableau,
  moveToFoundation,
  getSourceCards,
  getValidMoves,
  canAutoComplete,
  autoCompleteStep,
  calculateFinalScore,
  undo,
} from './rules'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Mini Card Component ────────────────────────────────────────────────────

function MiniCard({
  card,
  faceUp,
  onClick,
  selected,
  highlighted,
  stacked,
  size = 'md',
}: {
  card: Card
  faceUp: boolean
  onClick?: () => void
  selected?: boolean
  highlighted?: boolean
  stacked?: boolean
  size?: 'sm' | 'md'
}) {
  const sizes = {
    sm: { w: 38, h: 53, rank: 'text-[8px]', suit: 'text-[10px]' },
    md: { w: 46, h: 64, rank: 'text-[9px]', suit: 'text-xs' },
  }
  const s = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        onClick={onClick}
        className={`rounded shrink-0 flex items-center justify-center ${onClick ? 'cursor-pointer' : ''}`}
        style={{
          width: s.w,
          height: stacked ? 16 : s.h,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: '1px solid rgba(139, 92, 246, 0.25)',
        }}
      >
        {!stacked && <span className="text-purple-500/30 text-xs">&#x1F0A0;</span>}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`rounded shrink-0 flex flex-col items-start pt-0.5 pl-1 transition-all duration-150 ${
        onClick ? 'cursor-pointer' : ''
      } ${selected ? 'ring-2 ring-cyan-400 -translate-y-1 z-10' : ''} ${
        highlighted && !selected ? 'ring-1 ring-cyan-400/40' : ''
      }`}
      style={{
        width: s.w,
        height: stacked ? 18 : s.h,
        color,
        background: selected ? '#1e3a5f' : '#1e293b',
        border: selected ? '1px solid rgba(34, 211, 238, 0.5)' : '1px solid rgba(100, 116, 139, 0.3)',
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center gap-px">
        <span className={`${s.rank} font-bold leading-none`}>{card.rank}</span>
        <span className={`${s.suit} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </div>
  )
}

// ─── Empty Pile Placeholder ─────────────────────────────────────────────────

function EmptyPile({
  label,
  onClick,
  highlighted,
  size = 'md',
}: {
  label?: string
  onClick?: () => void
  highlighted?: boolean
  size?: 'sm' | 'md'
}) {
  const w = size === 'sm' ? 38 : 46
  const h = size === 'sm' ? 53 : 64
  return (
    <div
      onClick={onClick}
      className={`rounded flex items-center justify-center ${onClick ? 'cursor-pointer' : ''} ${
        highlighted ? 'ring-1 ring-cyan-400/40' : ''
      }`}
      style={{
        width: w,
        height: h,
        border: '1px dashed rgba(100, 116, 139, 0.25)',
        background: 'rgba(30, 41, 59, 0.3)',
      }}
    >
      {label && <span className="text-slate-600 text-[8px]">{label}</span>}
    </div>
  )
}

// ─── Foundation Pile ────────────────────────────────────────────────────────

function FoundationPile({
  pile,
  index,
  onClick,
  highlighted,
}: {
  pile: Card[]
  index: number
  onClick?: () => void
  highlighted?: boolean
}) {
  const suitLabels = ['&#x2665;', '&#x2666;', '&#x2663;', '&#x2660;']

  if (pile.length === 0) {
    return (
      <div
        onClick={onClick}
        className={`w-[46px] h-[64px] rounded flex items-center justify-center ${
          onClick ? 'cursor-pointer' : ''
        } ${highlighted ? 'ring-1 ring-cyan-400/40' : ''}`}
        style={{
          border: '1px dashed rgba(100, 116, 139, 0.3)',
          background: 'rgba(30, 41, 59, 0.3)',
        }}
      >
        <span
          className="text-lg opacity-20"
          dangerouslySetInnerHTML={{ __html: suitLabels[index] }}
        />
      </div>
    )
  }

  const topCard = pile[pile.length - 1]
  return (
    <MiniCard
      card={topCard}
      faceUp
      onClick={onClick}
      highlighted={highlighted}
    />
  )
}

// ─── Main Game Component ────────────────────────────────────────────────────

export default function SolitaireGame({ onGameOver, level }: Props) {
  const [state, setState] = useState<SolitaireState>(() => initGame())
  const [autoCompleting, setAutoCompleting] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const gameOverCalled = useRef(false)
  const autoCompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timer
  useEffect(() => {
    if (state.phase !== 'playing') return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - state.startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [state.phase, state.startTime])

  // Game over
  useEffect(() => {
    if (state.phase === 'won' && !gameOverCalled.current) {
      gameOverCalled.current = true
      playWin()
      const finalScore = calculateFinalScore(state)
      setTimeout(() => onGameOver(finalScore), 1500)
    }
  }, [state.phase, state, onGameOver])

  // Auto-complete animation
  useEffect(() => {
    if (!autoCompleting || state.phase !== 'playing') return

    autoCompleteTimer.current = setTimeout(() => {
      setState(prev => {
        const result = autoCompleteStep(prev)
        if (result) {
          playMove()
          return result
        }
        setAutoCompleting(false)
        return prev
      })
    }, 150)

    return () => {
      if (autoCompleteTimer.current) clearTimeout(autoCompleteTimer.current)
    }
  }, [autoCompleting, state])

  // Check for auto-complete availability
  useEffect(() => {
    if (canAutoComplete(state) && state.phase === 'playing' && !autoCompleting) {
      // Don't auto-start, let user trigger it or auto-complete automatically
      // For a smoother experience, auto-start after a short delay
      const timer = setTimeout(() => {
        setAutoCompleting(true)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [state, autoCompleting])

  // Determine valid targets for current selection
  const validTargets = state.selectedSource
    ? getValidMoves(state, state.selectedSource)
    : []

  const isTargetCol = (col: number) =>
    validTargets.some(t => t.type === 'tableau' && t.col === col)

  const isTargetFoundation = validTargets.some(t => t.type === 'foundation')

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStockClick = useCallback(() => {
    if (autoCompleting) return
    playSelect()
    setState(prev => ({ ...drawFromStock(prev), selectedSource: null }))
  }, [autoCompleting])

  const handleWasteClick = useCallback(() => {
    if (autoCompleting || state.waste.length === 0) return
    if (state.selectedSource?.type === 'waste') {
      // Double-tap: try to auto-move to foundation
      const card = state.waste[state.waste.length - 1]
      const result = moveToFoundation(state, { type: 'waste' })
      if (result !== state) {
        playPickup()
        setState(result)
        return
      }
      setState(prev => ({ ...prev, selectedSource: null }))
      return
    }
    playSelect()
    setState(prev => ({ ...prev, selectedSource: { type: 'waste' } }))
  }, [state, autoCompleting])

  const handleTableauCardClick = useCallback((col: number, cardIndex: number) => {
    if (autoCompleting) return
    const column = state.tableau[col]
    const card = column[cardIndex]
    if (!card.faceUp) return // Can't interact with face-down cards

    // If we have a selection and this column is a valid target
    if (state.selectedSource) {
      // Check if clicking the same source to deselect
      if (state.selectedSource.type === 'tableau' &&
          state.selectedSource.col === col &&
          state.selectedSource.cardIndex === cardIndex) {
        // Double-tap on the bottom card of a column: try foundation
        if (cardIndex === column.length - 1) {
          const result = moveToFoundation(state, { type: 'tableau', col, cardIndex })
          if (result !== state) {
            playPickup()
            setState(result)
            return
          }
        }
        setState(prev => ({ ...prev, selectedSource: null }))
        return
      }

      // Try to move to this column
      if (isTargetCol(col)) {
        playMove()
        setState(prev => moveToTableau(prev, prev.selectedSource!, col))
        return
      }

      // Click on a different card: change selection
      playSelect()
      setState(prev => ({ ...prev, selectedSource: { type: 'tableau', col, cardIndex } }))
      return
    }

    // No selection: select this card (and cards below it)
    playSelect()
    setState(prev => ({ ...prev, selectedSource: { type: 'tableau', col, cardIndex } }))
  }, [state, autoCompleting])

  const handleEmptyTableauClick = useCallback((col: number) => {
    if (autoCompleting || !state.selectedSource) return
    if (isTargetCol(col)) {
      playMove()
      setState(prev => moveToTableau(prev, prev.selectedSource!, col))
    }
  }, [state, autoCompleting])

  const handleFoundationClick = useCallback((pileIdx: number) => {
    if (autoCompleting) return

    if (state.selectedSource) {
      // Try to move to foundation
      if (isTargetFoundation) {
        playPickup()
        setState(prev => moveToFoundation(prev, prev.selectedSource!))
        return
      }
      // Select from foundation instead
      if (state.foundations[pileIdx].length > 0) {
        playSelect()
        setState(prev => ({ ...prev, selectedSource: { type: 'foundation', pile: pileIdx } }))
      }
      return
    }

    // Select from foundation
    if (state.foundations[pileIdx].length > 0) {
      playSelect()
      setState(prev => ({ ...prev, selectedSource: { type: 'foundation', pile: pileIdx } }))
    }
  }, [state, autoCompleting, isTargetFoundation])

  const handleUndo = useCallback(() => {
    if (autoCompleting) return
    setState(prev => undo(prev))
  }, [autoCompleting])

  const handleNewGame = useCallback(() => {
    gameOverCalled.current = false
    setAutoCompleting(false)
    setState(initGame())
    setElapsed(0)
  }, [])

  const handleDeselect = useCallback(() => {
    if (state.selectedSource) {
      setState(prev => ({ ...prev, selectedSource: null }))
    }
  }, [state.selectedSource])

  // Format time
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="w-full h-full flex flex-col relative select-none overflow-hidden"
      onClick={(e) => {
        // Deselect if clicking background
        if (e.target === e.currentTarget) handleDeselect()
      }}
    >
      {/* Top bar: score, time, moves, undo */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-slate-900/60 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Score: <span className="text-emerald-400 font-bold">{state.score}</span></span>
          <span className="text-slate-400">Moves: <span className="text-slate-300">{state.moves}</span></span>
          <span className="text-slate-400">Time: <span className="text-slate-300">{timeStr}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUndo}
            disabled={state.undoStack.length === 0 || autoCompleting}
            className="px-2 py-1 bg-slate-800 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors text-[10px]"
          >
            Undo
          </button>
          <button
            onClick={handleNewGame}
            className="px-2 py-1 bg-slate-800 rounded text-slate-400 hover:text-white transition-colors text-[10px]"
          >
            New
          </button>
        </div>
      </div>

      {/* Top row: stock, waste, foundations */}
      <div className="flex items-start justify-between px-2 py-2">
        {/* Stock + Waste */}
        <div className="flex items-start gap-2">
          {/* Stock pile */}
          <div onClick={handleStockClick} className="cursor-pointer">
            {state.stock.length > 0 ? (
              <div
                className="w-[46px] h-[64px] rounded flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                }}
              >
                <span className="text-purple-400/50 text-lg">&#x1F0A0;</span>
              </div>
            ) : (
              <div
                className="w-[46px] h-[64px] rounded flex items-center justify-center hover:scale-105 transition-transform"
                style={{
                  border: '1px dashed rgba(139, 92, 246, 0.2)',
                  background: 'rgba(30, 27, 75, 0.2)',
                }}
              >
                <span className="text-purple-500/30 text-lg">&#x21BB;</span>
              </div>
            )}
          </div>

          {/* Waste pile - show up to 3 */}
          <div className="flex -space-x-6 min-w-[70px]">
            {state.waste.length === 0 && <EmptyPile />}
            {state.waste.slice(-3).map((card, i, arr) => {
              const isTop = i === arr.length - 1
              return (
                <div key={card.id} style={{ zIndex: i }}>
                  <MiniCard
                    card={card}
                    faceUp
                    onClick={isTop ? handleWasteClick : undefined}
                    selected={isTop && state.selectedSource?.type === 'waste'}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Foundations */}
        <div className="flex gap-1">
          {state.foundations.map((pile, i) => (
            <FoundationPile
              key={i}
              pile={pile}
              index={i}
              onClick={() => handleFoundationClick(i)}
              highlighted={state.selectedSource != null && isTargetFoundation}
            />
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="flex-1 flex gap-1 px-1 pb-2 overflow-hidden" onClick={handleDeselect}>
        {state.tableau.map((column, colIdx) => (
          <div
            key={colIdx}
            className="flex-1 flex flex-col items-center min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {column.length === 0 ? (
              <div onClick={() => handleEmptyTableauClick(colIdx)}>
                <EmptyPile
                  label="K"
                  onClick={() => handleEmptyTableauClick(colIdx)}
                  highlighted={state.selectedSource != null && isTargetCol(colIdx)}
                  size="sm"
                />
              </div>
            ) : (
              column.map((card, cardIdx) => {
                const isLastCard = cardIdx === column.length - 1
                const isSelected =
                  state.selectedSource?.type === 'tableau' &&
                  state.selectedSource.col === colIdx &&
                  cardIdx >= state.selectedSource.cardIndex
                return (
                  <div
                    key={card.id}
                    style={{
                      marginTop: cardIdx === 0 ? 0 : card.faceUp ? -46 : -50,
                      zIndex: cardIdx,
                    }}
                  >
                    <MiniCard
                      card={card}
                      faceUp={card.faceUp}
                      onClick={card.faceUp ? () => handleTableauCardClick(colIdx, cardIdx) : undefined}
                      selected={isSelected}
                      highlighted={
                        isLastCard &&
                        state.selectedSource != null &&
                        isTargetCol(colIdx)
                      }
                      size="sm"
                    />
                  </div>
                )
              })
            )}
          </div>
        ))}
      </div>

      {/* Message */}
      {state.message && (
        <div className="text-center py-1 text-xs text-slate-500">{state.message}</div>
      )}

      {/* Auto-complete indicator */}
      {autoCompleting && (
        <div className="text-center py-2">
          <span className="text-emerald-400 text-sm animate-pulse">Auto-completing...</span>
        </div>
      )}

      {/* Win overlay */}
      {state.phase === 'won' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-6 text-center max-w-xs">
            <p className="text-4xl mb-2">&#x1F3C6;</p>
            <h3 className="text-white font-bold text-xl mb-1">You Win!</h3>
            <div className="space-y-1 text-sm text-slate-400 mb-4">
              <p>Moves: {state.moves}</p>
              <p>Time: {timeStr}</p>
              <p>Score: <span className="text-emerald-400 font-bold">{calculateFinalScore(state)}</span></p>
            </div>
            <button
              onClick={handleNewGame}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
