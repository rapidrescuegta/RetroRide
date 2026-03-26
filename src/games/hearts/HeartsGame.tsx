'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { playSound } from '@/lib/audio';
import {
  type Card,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  sortHand,
} from '@/lib/card-engine'
import {
  type HeartsState,
  initHeartsGame,
  startNewRound,
  selectCardForPass,
  executePass,
  getPlayableCards,
  playCard,
  aiSelectPassCards,
  aiPlayCard,
  getPassDirectionLabel,
  getPassDirectionArrow,
} from './hearts-rules'

// ─── Props ───────────────────────────────────────────────────────────────────

interface HeartsGameProps {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAYER_ID = 'south'
const AI_PLAYERS = ['west', 'north', 'east']
const PLAYER_NAMES: Record<string, string> = {
  south: 'You',
  west: 'Bot West',
  north: 'Bot North',
  east: 'Bot East',
}
const PLAYER_ICONS: Record<string, string> = {
  south: '\uD83D\uDE0A',
  west: '\uD83C\uDFB2',
  north: '\uD83E\uDD16',
  east: '\uD83C\uDFB0',
}
const ALL_PLAYERS = [PLAYER_ID, ...AI_PLAYERS]

// ─── Card View ───────────────────────────────────────────────────────────────

function CardView({
  card,
  selected,
  onClick,
  faceUp = true,
  size = 'md',
  playable = true,
  highlight = false,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
  highlight?: boolean
}) {
  const sizes = { sm: { w: 40, h: 56 }, md: { w: 52, h: 73 }, lg: { w: 64, h: 90 } }
  const fontSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  const { w, h } = sizes[size]
  const color = SUIT_COLORS[card.suit]
  const isQSpades = card.id === 'Q-spades'

  if (!faceUp) {
    return (
      <div
        style={{ width: w, height: h }}
        className="rounded-md bg-gradient-to-br from-purple-700 to-purple-900 border border-purple-500/30 flex items-center justify-center shrink-0"
      >
        <span className="text-purple-300/50 text-lg">{'\u2660'}</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      disabled={!playable || !onClick}
      style={{ width: w, height: h }}
      className={`rounded-md border flex flex-col items-center justify-center shrink-0 transition-all duration-200 relative ${
        selected
          ? 'border-cyan-400 bg-cyan-400/10 -translate-y-3 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
          : playable && onClick
            ? 'border-slate-600 bg-slate-800 hover:border-slate-400 hover:bg-slate-700 cursor-pointer active:scale-95'
            : 'border-slate-700/50 bg-slate-800/60 opacity-50'
      } ${highlight ? 'shadow-[0_0_16px_rgba(239,68,68,0.6)] border-red-400' : ''} ${
        isQSpades && playable ? 'shadow-[0_0_8px_rgba(168,85,247,0.4)]' : ''
      }`}
    >
      <span className={`font-bold leading-none ${fontSizes[size]}`} style={{ color }}>
        {card.rank}
      </span>
      <span className={`leading-none ${size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg'}`} style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </button>
  )
}

// ─── Mini Card (for trick display) ───────────────────────────────────────────

function MiniCard({ card }: { card: Card }) {
  const color = SUIT_COLORS[card.suit]
  const isQSpades = card.id === 'Q-spades'

  return (
    <div
      className={`w-[42px] h-[60px] rounded-md border flex flex-col items-center justify-center bg-slate-800 transition-all duration-300 ${
        isQSpades
          ? 'border-purple-400 shadow-[0_0_16px_rgba(168,85,247,0.7)]'
          : card.suit === 'hearts'
            ? 'border-red-400/60 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
            : 'border-slate-600'
      }`}
    >
      <span className="font-bold text-[10px] leading-none" style={{ color }}>
        {card.rank}
      </span>
      <span className="text-sm leading-none" style={{ color }}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  )
}

// ─── Face-Down Cards (for AI hands) ─────────────────────────────────────────

function FaceDownCards({ count, orientation }: { count: number; orientation: 'horizontal' | 'vertical' }) {
  const shown = Math.min(count, 6)
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center" style={{ gap: -8 }}>
        {Array.from({ length: shown }).map((_, i) => (
          <div
            key={i}
            className="w-[28px] h-[18px] rounded-[3px] bg-gradient-to-br from-purple-700 to-purple-900 border border-purple-500/30"
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
          className="w-[18px] h-[28px] rounded-[3px] bg-gradient-to-br from-purple-700 to-purple-900 border border-purple-500/30"
          style={{ marginLeft: i > 0 ? -10 : 0 }}
        />
      ))}
      <span className="text-[10px] text-slate-500 ml-1">{count}</span>
    </div>
  )
}

// ─── Rules Modal ─────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">{'\u2665'} Hearts Rules</h3>
        <div className="text-slate-300 text-xs space-y-2">
          <p><strong>Goal:</strong> Have the LOWEST score when someone reaches 100 points.</p>
          <p><strong>Passing:</strong> Before each round, pass 3 cards (left, right, across, no pass - rotates).</p>
          <p><strong>Play:</strong> Player with 2{'\u2663'} leads first. Must follow suit if able.</p>
          <p><strong>Hearts:</strong> Can{"'"}t lead hearts until they{"'"}re {'"'}broken{'"'} (played on another trick).</p>
          <p><strong>Scoring:</strong> Each {'\u2665'} = 1 point. Q{'\u2660'} = 13 points.</p>
          <p><strong>Shoot the Moon:</strong> Take ALL hearts + Q{'\u2660'} = you get 0, everyone else gets 26!</p>
          <p><strong>Game Over:</strong> When someone hits 100 points. Lowest score wins.</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-purple-600 rounded-lg text-white text-sm font-semibold hover:bg-purple-500 transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function HeartsGame({ onGameOver, level }: HeartsGameProps) {
  const [state, setState] = useState<HeartsState>(() => initHeartsGame(ALL_PLAYERS))
  const [showRules, setShowRules] = useState(false)
  const [trickWinner, setTrickWinner] = useState<string | null>(null)
  const [lastCompletedTrick, setLastCompletedTrick] = useState<typeof state.currentTrick | null>(null)
  const [moonAnimation, setMoonAnimation] = useState(false)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isProcessingRef = useRef(false)

  // ─── AI turn logic ──────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'playing') return
    if (state.currentPlayer === PLAYER_ID) return
    if (isProcessingRef.current) return

    isProcessingRef.current = true
    const delay = 600 + Math.random() * 600

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        const cardId = aiPlayCard(prev, prev.currentPlayer, level)
        const newState = playCard(prev, prev.currentPlayer, cardId)

        // Check if a trick just completed
        if (newState.completedTricks.length > prev.completedTricks.length) {
          const lastTrick = newState.completedTricks[newState.completedTricks.length - 1]
          setLastCompletedTrick(lastTrick)
          setTrickWinner(lastTrick.winner)
          // Clear after animation
          setTimeout(() => {
            setLastCompletedTrick(null)
            setTrickWinner(null)
          }, 1500)
        }

        return newState
      })
      isProcessingRef.current = false
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
      isProcessingRef.current = false
    }
  }, [state.currentPlayer, state.phase, state.trickNumber, level])

  // ─── AI pass selection ──────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'passing') return

    // Auto-select for AI players
    let newState = state
    let changed = false
    for (const aiId of AI_PLAYERS) {
      if ((newState.selectedPass[aiId] || []).length !== 3) {
        const passCards = aiSelectPassCards(newState, aiId, level)
        for (const cardId of passCards) {
          newState = selectCardForPass(newState, aiId, cardId)
        }
        changed = true
      }
    }
    if (changed) setState(newState)
  }, [state.phase, level])

  // ─── Moon animation ─────────────────────────────────────────────────────

  useEffect(() => {
    if (state.shotTheMoon) {
      setMoonAnimation(true)
      setTimeout(() => setMoonAnimation(false), 3000)
    }
  }, [state.shotTheMoon])

  // ─── Game over ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === 'gameOver') {
      const playerScore = state.cumulativeScores[PLAYER_ID] || 0
      // In hearts, lower is better. Convert to a positive score for leaderboard.
      // Max possible = 100, so score = 100 - playerScore
      playSound('hearts_game_over');
      setTimeout(() => {
        onGameOver(Math.max(0, 100 - playerScore))
      }, 2000)
    }
  }, [state.phase, state.cumulativeScores, onGameOver])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleCardClick = useCallback((cardId: string) => {
    if (state.phase === 'passing') {
      setState(prev => selectCardForPass(prev, PLAYER_ID, cardId))
    } else if (state.phase === 'playing' && state.currentPlayer === PLAYER_ID) {
      setState(prev => {
        const newState = playCard(prev, PLAYER_ID, cardId)
        playSound('hearts_play');
        // Check if trick completed by player's play
        if (newState.completedTricks.length > prev.completedTricks.length) {
          const lastTrick = newState.completedTricks[newState.completedTricks.length - 1]
          setLastCompletedTrick(lastTrick)
          setTrickWinner(lastTrick.winner)
          setTimeout(() => {
            setLastCompletedTrick(null)
            setTrickWinner(null)
          }, 1500)
        }
        return newState
      })
    }
  }, [state.phase, state.currentPlayer])

  const handlePass = useCallback(() => {
    const selected = state.selectedPass[PLAYER_ID] || []
    if (selected.length !== 3) return
    setState(prev => executePass(prev))
  }, [state.selectedPass])

  const handleNextRound = useCallback(() => {
    setState(prev =>
      startNewRound(prev.players, prev.cumulativeScores, prev.roundNumber + 1)
    )
  }, [])

  // ─── Computed ───────────────────────────────────────────────────────────

  const playerHand = state.hands[PLAYER_ID] || []
  const playableIds = state.phase === 'playing' ? getPlayableCards(state, PLAYER_ID) : []
  const selectedPassIds = state.selectedPass[PLAYER_ID] || []
  const isPlayerTurn = state.currentPlayer === PLAYER_ID && state.phase === 'playing'

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col items-center max-w-lg mx-auto px-2 select-none relative">
      {/* Header */}
      <div className="w-full flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm transition-all duration-300 ${state.heartsBroken ? 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'text-slate-600'}`}>
            {'\u2665'}
          </span>
          <span className="text-[10px] text-slate-500">
            {state.heartsBroken ? 'Hearts broken' : 'Hearts locked'}
          </span>
        </div>
        <span className="text-[10px] text-slate-500">Round {state.roundNumber + 1}</span>
        <button
          onClick={() => setShowRules(true)}
          className="text-[10px] text-slate-500 hover:text-slate-300 px-2 py-1 rounded border border-slate-700 hover:border-slate-500 transition-colors"
        >
          Rules
        </button>
      </div>

      {/* Scoreboard */}
      <div className="w-full grid grid-cols-4 gap-1 px-1 py-1">
        {ALL_PLAYERS.map(pid => (
          <div
            key={pid}
            className={`text-center rounded-md px-1 py-1 text-[10px] border transition-all ${
              pid === state.currentPlayer && state.phase === 'playing'
                ? 'border-cyan-500/40 bg-cyan-500/10'
                : 'border-slate-800 bg-slate-900/50'
            }`}
          >
            <div className="text-slate-400 truncate">{PLAYER_ICONS[pid]} {PLAYER_NAMES[pid]}</div>
            <div className="text-white font-bold">{state.cumulativeScores[pid] || 0}</div>
            {state.roundScores[pid] > 0 && state.phase === 'playing' && (
              <div className="text-red-400 text-[9px]">+{state.roundScores[pid]}</div>
            )}
          </div>
        ))}
      </div>

      {/* Game Table */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-0">
        {/* North (Bot) */}
        <div className="flex flex-col items-center mb-2">
          <FaceDownCards count={(state.hands['north'] || []).length} orientation="horizontal" />
        </div>

        {/* Middle row: West - Trick Area - East */}
        <div className="w-full flex items-center justify-between px-2">
          {/* West */}
          <div className="flex flex-col items-center">
            <FaceDownCards count={(state.hands['west'] || []).length} orientation="vertical" />
          </div>

          {/* Center: Trick Area */}
          <div className="flex-1 flex items-center justify-center min-h-[140px] relative">
            {/* Pass direction indicator */}
            {state.phase === 'passing' && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center">
                <div className="text-cyan-400 text-sm font-bold">
                  {getPassDirectionArrow(state.passDirection)}
                </div>
                <div className="text-cyan-300 text-[10px]">
                  {getPassDirectionLabel(state.passDirection)}
                </div>
              </div>
            )}

            {/* Current trick cards */}
            {state.phase === 'playing' && (
              <div className="relative w-[120px] h-[120px]">
                {/* North card */}
                {state.currentTrick.cards.find(c => c.playerId === 'north') && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-[slideDown_0.3s_ease]">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'north')!.card} />
                  </div>
                )}
                {/* South card */}
                {state.currentTrick.cards.find(c => c.playerId === 'south') && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-[slideUp_0.3s_ease]">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'south')!.card} />
                  </div>
                )}
                {/* West card */}
                {state.currentTrick.cards.find(c => c.playerId === 'west') && (
                  <div className="absolute top-1/2 left-0 -translate-y-1/2 animate-[slideRight_0.3s_ease]">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'west')!.card} />
                  </div>
                )}
                {/* East card */}
                {state.currentTrick.cards.find(c => c.playerId === 'east') && (
                  <div className="absolute top-1/2 right-0 -translate-y-1/2 animate-[slideLeft_0.3s_ease]">
                    <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'east')!.card} />
                  </div>
                )}
              </div>
            )}

            {/* Last completed trick (showing briefly) */}
            {lastCompletedTrick && trickWinner && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="flex gap-1 mb-1">
                  {lastCompletedTrick.cards.map(({ card }) => (
                    <MiniCard key={card.id} card={card} />
                  ))}
                </div>
                <div className="text-[10px] text-cyan-300 font-semibold">
                  {PLAYER_NAMES[trickWinner]} takes it
                </div>
              </div>
            )}

            {/* Turn indicator */}
            {state.phase === 'playing' && !lastCompletedTrick && state.currentTrick.cards.length < 4 && (
              <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2">
                <span className="text-[9px] text-slate-500">
                  {isPlayerTurn ? 'Your turn' : `${PLAYER_NAMES[state.currentPlayer]}'s turn`}
                </span>
              </div>
            )}
          </div>

          {/* East */}
          <div className="flex flex-col items-center">
            <FaceDownCards count={(state.hands['east'] || []).length} orientation="vertical" />
          </div>
        </div>

        {/* South (Player) hand */}
        <div className="mt-3 w-full flex flex-col items-center">
          {state.phase === 'passing' && (
            <div className="text-[10px] text-slate-400 mb-1">
              Select 3 cards to pass ({selectedPassIds.length}/3)
            </div>
          )}
          <div className="flex justify-center flex-wrap gap-[2px] max-w-full px-1">
            {playerHand.map(card => {
              const isPlayable = state.phase === 'passing' || playableIds.includes(card.id)
              const isSelected = selectedPassIds.includes(card.id)
              return (
                <CardView
                  key={card.id}
                  card={card}
                  selected={isSelected}
                  onClick={() => handleCardClick(card.id)}
                  playable={isPlayable}
                  size="md"
                  highlight={card.id === 'Q-spades'}
                />
              )
            })}
          </div>

          {/* Pass button */}
          {state.phase === 'passing' && selectedPassIds.length === 3 && (
            <button
              onClick={handlePass}
              className="mt-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
            >
              Pass Cards {getPassDirectionArrow(state.passDirection)}
            </button>
          )}
        </div>
      </div>

      {/* Round Over overlay */}
      {state.phase === 'roundOver' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            {state.shotTheMoon && (
              <div className="text-2xl mb-2 animate-bounce">
                {'\uD83C\uDF19'} {PLAYER_NAMES[state.shotTheMoon]} shot the moon!
              </div>
            )}
            <h3 className="text-white font-bold text-lg mb-3">Round {state.roundNumber + 1} Complete</h3>
            <div className="space-y-2 mb-4">
              {ALL_PLAYERS.map(pid => (
                <div key={pid} className="flex justify-between text-sm">
                  <span className="text-slate-400">{PLAYER_ICONS[pid]} {PLAYER_NAMES[pid]}</span>
                  <span className="text-white">
                    <span className="text-red-400">+{state.roundResults?.[pid] || 0}</span>
                    {' = '}
                    <span className="font-bold">{state.cumulativeScores[pid]}</span>
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={handleNextRound}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Next Round
            </button>
          </div>
        </div>
      )}

      {/* Game Over overlay */}
      {state.phase === 'gameOver' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            <div className="text-3xl mb-2">
              {state.winner === PLAYER_ID ? '\uD83C\uDFC6' : '\uD83D\uDCA8'}
            </div>
            <h3 className="text-white font-bold text-lg mb-1">
              {state.winner === PLAYER_ID ? 'You Win!' : `${PLAYER_NAMES[state.winner || '']} Wins!`}
            </h3>
            <p className="text-slate-400 text-xs mb-4">Lowest score wins in Hearts</p>
            <div className="space-y-2 mb-4">
              {ALL_PLAYERS
                .sort((a, b) => (state.cumulativeScores[a] || 0) - (state.cumulativeScores[b] || 0))
                .map((pid, i) => (
                  <div
                    key={pid}
                    className={`flex justify-between text-sm py-1 px-2 rounded ${
                      pid === state.winner ? 'bg-amber-500/10 border border-amber-500/30' : ''
                    }`}
                  >
                    <span className="text-slate-400">
                      {i === 0 ? '\uD83E\uDD47' : i === 1 ? '\uD83E\uDD48' : i === 2 ? '\uD83E\uDD49' : '4.'} {PLAYER_NAMES[pid]}
                    </span>
                    <span className="text-white font-bold">{state.cumulativeScores[pid]}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Shoot the moon animation */}
      {moonAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-6xl animate-bounce">{'\uD83C\uDF19'}</div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {/* CSS animations */}
      <style jsx>{`
        @keyframes slideDown {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideRight {
          from { transform: translate(-20px, -50%); opacity: 0; }
          to { transform: translate(0, -50%); opacity: 1; }
        }
        @keyframes slideLeft {
          from { transform: translate(20px, -50%); opacity: 0; }
          to { transform: translate(0, -50%); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
