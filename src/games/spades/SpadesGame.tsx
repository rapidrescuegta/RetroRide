'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  SUIT_SYMBOLS,
  SUIT_COLORS,
} from '@/lib/card-engine'
import {
  type SpadesState,
  initSpadesGame,
  startNewRound,
  placeBid,
  getPlayableCards,
  playCard,
  aiBid,
  aiPlayCard,
  getTeamIndex,
  getTeamTricks,
  getTeamBid,
  getPlayerBidDisplay,
  isNilBid,
} from './spades-rules'

// ─── Props ───────────────────────────────────────────────────────────────────

interface SpadesGameProps {
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
const TEAM_COLORS = ['#a855f7', '#22d3ee'] // purple, cyan

// ─── Card View ───────────────────────────────────────────────────────────────

function CardView({
  card,
  selected,
  onClick,
  faceUp = true,
  size = 'md',
  playable = true,
}: {
  card: Card
  selected?: boolean
  onClick?: () => void
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  playable?: boolean
}) {
  const sizes = { sm: { w: 40, h: 56 }, md: { w: 52, h: 73 }, lg: { w: 64, h: 90 } }
  const fontSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  const { w, h } = sizes[size]
  const color = SUIT_COLORS[card.suit]
  const isSpade = card.suit === 'spades'

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
      className={`rounded-md border flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        selected
          ? 'border-cyan-400 bg-cyan-400/10 -translate-y-3 shadow-[0_0_12px_rgba(34,211,238,0.4)]'
          : playable && onClick
            ? 'border-slate-600 bg-slate-800 hover:border-slate-400 hover:bg-slate-700 cursor-pointer active:scale-95'
            : 'border-slate-700/50 bg-slate-800/60 opacity-50'
      } ${isSpade && playable ? 'shadow-[0_0_4px_rgba(226,232,240,0.2)]' : ''}`}
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

// ─── Mini Card ───────────────────────────────────────────────────────────────

function MiniCard({ card }: { card: Card }) {
  const color = SUIT_COLORS[card.suit]
  const isSpade = card.suit === 'spades'

  return (
    <div
      className={`w-[42px] h-[60px] rounded-md border flex flex-col items-center justify-center bg-slate-800 transition-all duration-300 ${
        isSpade
          ? 'border-slate-400 shadow-[0_0_10px_rgba(226,232,240,0.3)]'
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

// ─── Face-Down Cards ─────────────────────────────────────────────────────────

function FaceDownCards({ count, orientation }: { count: number; orientation: 'horizontal' | 'vertical' }) {
  const shown = Math.min(count, 6)
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col items-center">
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
        <h3 className="text-white font-bold text-lg mb-3">{'\u2660'} Spades Rules</h3>
        <div className="text-slate-300 text-xs space-y-2">
          <p><strong>Teams:</strong> You + Bot North vs Bot West + Bot East. Partners sit across.</p>
          <p><strong>Bidding:</strong> Each player bids how many tricks they{"'"}ll win. Team total is the target.</p>
          <p><strong>Nil bid:</strong> Bid 0 tricks. +100 if successful, -100 if you take even 1 trick.</p>
          <p><strong>Play:</strong> Must follow suit. Spades are TRUMP (beat any other suit).</p>
          <p><strong>Spades:</strong> Can{"'"}t lead spades until they{"'"}re {'"'}broken{'"'} (played on another trick).</p>
          <p><strong>Scoring:</strong> Making bid = bid x 10 points. Each overtrick ({'"'}bag{'"'}) = 1 point.</p>
          <p><strong>Bags penalty:</strong> Every 10 bags = -100 points!</p>
          <p><strong>Failing bid:</strong> bid x -10 points.</p>
          <p><strong>Win:</strong> First team to 500 points wins.</p>
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

// ─── Bid Selector ────────────────────────────────────────────────────────────

function BidSelector({ onBid }: { onBid: (bid: number) => void }) {
  const [selectedBid, setSelectedBid] = useState(3)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-white text-sm font-semibold">Your Bid</div>
      {/* Nil button */}
      <button
        onClick={() => onBid(0)}
        className="px-4 py-2 rounded-lg border-2 border-amber-500/50 bg-amber-500/10 text-amber-400 text-sm font-bold hover:bg-amber-500/20 transition-colors active:scale-95"
      >
        {'\u26A1'} Nil (0 tricks)
      </button>
      {/* Number grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 13 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => setSelectedBid(n)}
            className={`w-9 h-9 rounded-md text-sm font-bold transition-all ${
              selectedBid === n
                ? 'bg-purple-600 text-white border border-purple-400'
                : 'bg-slate-800 text-slate-300 border border-slate-700 hover:border-slate-500'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        onClick={() => onBid(selectedBid)}
        className="px-8 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold rounded-lg transition-colors active:scale-95"
      >
        Bid {selectedBid}
      </button>
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SpadesGame({ onGameOver, level }: SpadesGameProps) {
  const [state, setState] = useState<SpadesState>(() => initSpadesGame(ALL_PLAYERS))
  const [showRules, setShowRules] = useState(false)
  const [trickWinner, setTrickWinner] = useState<string | null>(null)
  const [lastCompletedTrick, setLastCompletedTrick] = useState<typeof state.currentTrick | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const isProcessingRef = useRef(false)

  // ─── AI bidding ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'bidding') return
    if (state.currentPlayer === PLAYER_ID) return
    if (isProcessingRef.current) return

    isProcessingRef.current = true
    const delay = 500 + Math.random() * 500

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        const bid = aiBid(prev, prev.currentPlayer, level)
        return placeBid(prev, prev.currentPlayer, bid)
      })
      isProcessingRef.current = false
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
      isProcessingRef.current = false
    }
  }, [state.currentPlayer, state.phase, level])

  // ─── AI play ────────────────────────────────────────────────────────────

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
      isProcessingRef.current = false
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
      isProcessingRef.current = false
    }
  }, [state.currentPlayer, state.phase, state.trickNumber, level])

  // ─── Game over ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (state.phase === 'gameOver') {
      const playerTeam = getTeamIndex(state, PLAYER_ID)
      const playerWon = state.winner === playerTeam
      const teamScore = state.cumulativeScores[playerTeam]
      setTimeout(() => {
        onGameOver(playerWon ? Math.max(0, teamScore) : 0)
      }, 2000)
    }
  }, [state.phase, state.winner, state.cumulativeScores, onGameOver])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleCardClick = useCallback((cardId: string) => {
    if (state.phase !== 'playing' || state.currentPlayer !== PLAYER_ID) return

    setState(prev => {
      const newState = playCard(prev, PLAYER_ID, cardId)
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
  }, [state.phase, state.currentPlayer])

  const handleBid = useCallback((bid: number) => {
    setState(prev => placeBid(prev, PLAYER_ID, bid))
  }, [])

  const handleNextRound = useCallback(() => {
    setState(prev =>
      startNewRound(
        prev.players,
        prev.teams,
        prev.cumulativeScores,
        prev.cumulativeBags,
        prev.roundNumber + 1,
        prev.dealer
      )
    )
  }, [])

  // ─── Computed ───────────────────────────────────────────────────────────

  const playerHand = state.hands[PLAYER_ID] || []
  const playableIds = state.phase === 'playing' ? getPlayableCards(state, PLAYER_ID) : []
  const isPlayerTurn = state.currentPlayer === PLAYER_ID
  const playerTeamIdx = getTeamIndex(state, PLAYER_ID)

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col items-center max-w-lg mx-auto px-2 select-none relative">
      {/* Header */}
      <div className="w-full flex items-center justify-between py-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm transition-all duration-300 ${state.spadesBroken ? 'text-slate-200 drop-shadow-[0_0_6px_rgba(226,232,240,0.6)]' : 'text-slate-600'}`}>
            {'\u2660'}
          </span>
          <span className="text-[10px] text-slate-500">
            {state.spadesBroken ? 'Spades broken' : 'Spades locked'}
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

      {/* Team Scoreboard */}
      <div className="w-full grid grid-cols-2 gap-2 px-1 py-1">
        {[0, 1].map(t => {
          const isPlayerTeam = t === playerTeamIdx
          const teamColor = TEAM_COLORS[t]
          const members = state.teams[t].map(p => PLAYER_NAMES[p]).join(' & ')
          return (
            <div
              key={t}
              className="rounded-md px-2 py-1 border text-center"
              style={{
                borderColor: `${teamColor}40`,
                background: `${teamColor}08`,
              }}
            >
              <div className="text-[10px] truncate" style={{ color: teamColor }}>
                {members}
                {isPlayerTeam && <span className="ml-1 text-[9px] opacity-60">(your team)</span>}
              </div>
              <div className="text-white font-bold text-sm">{state.cumulativeScores[t]}</div>
              <div className="flex justify-center gap-2 text-[9px] text-slate-500">
                <span>Bags: {state.cumulativeBags[t]}</span>
                {state.phase === 'playing' && (
                  <span>Bid: {getTeamBid(state, t)} | Won: {getTeamTricks(state, t)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bid Display (during play) */}
      {state.phase === 'playing' && (
        <div className="w-full grid grid-cols-4 gap-1 px-1 py-1">
          {ALL_PLAYERS.map(pid => {
            const teamIdx = getTeamIndex(state, pid)
            const teamColor = TEAM_COLORS[teamIdx]
            const bid = state.bids[pid]
            const tricks = state.tricksWon[pid] || 0
            const isNil = bid === -1
            return (
              <div
                key={pid}
                className={`text-center rounded-md px-1 py-1 text-[9px] border transition-all ${
                  pid === state.currentPlayer
                    ? 'border-cyan-500/40 bg-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/50'
                }`}
              >
                <div className="truncate" style={{ color: teamColor }}>
                  {PLAYER_ICONS[pid]} {PLAYER_NAMES[pid]}
                </div>
                <div className="text-white">
                  {isNil ? (
                    <span className={`font-bold ${tricks > 0 ? 'text-red-400' : 'text-amber-400'}`}>
                      NIL
                    </span>
                  ) : (
                    <span>{tricks}/{getPlayerBidDisplay(bid)}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Game Table */}
      <div className="flex-1 w-full flex flex-col items-center justify-center relative min-h-0">
        {/* Bidding phase */}
        {state.phase === 'bidding' && (
          <div className="flex flex-col items-center gap-3">
            {/* Show who's bidding / what bids are in */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {ALL_PLAYERS.map(pid => (
                <div key={pid} className="text-center">
                  <div className="text-[10px] text-slate-400">{PLAYER_ICONS[pid]}</div>
                  <div className={`text-sm font-bold ${
                    state.bids[pid] !== null ? 'text-white' :
                    state.currentPlayer === pid ? 'text-cyan-400 animate-pulse' : 'text-slate-600'
                  }`}>
                    {state.bids[pid] === -1 ? 'Nil' : state.bids[pid] !== null ? state.bids[pid] : '?'}
                  </div>
                </div>
              ))}
            </div>

            {isPlayerTurn && state.phase === 'bidding' && (
              <BidSelector onBid={handleBid} />
            )}

            {!isPlayerTurn && state.phase === 'bidding' && (
              <div className="text-slate-400 text-sm animate-pulse">
                {PLAYER_NAMES[state.currentPlayer]} is bidding...
              </div>
            )}
          </div>
        )}

        {/* Playing phase */}
        {state.phase === 'playing' && (
          <>
            {/* North (Bot) */}
            <div className="flex flex-col items-center mb-2">
              <FaceDownCards count={(state.hands['north'] || []).length} orientation="horizontal" />
            </div>

            {/* Middle row */}
            <div className="w-full flex items-center justify-between px-2">
              <div className="flex flex-col items-center">
                <FaceDownCards count={(state.hands['west'] || []).length} orientation="vertical" />
              </div>

              {/* Center: Trick Area */}
              <div className="flex-1 flex items-center justify-center min-h-[140px] relative">
                <div className="relative w-[120px] h-[120px]">
                  {state.currentTrick.cards.find(c => c.playerId === 'north') && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-[slideDown_0.3s_ease]">
                      <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'north')!.card} />
                    </div>
                  )}
                  {state.currentTrick.cards.find(c => c.playerId === 'south') && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-[slideUp_0.3s_ease]">
                      <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'south')!.card} />
                    </div>
                  )}
                  {state.currentTrick.cards.find(c => c.playerId === 'west') && (
                    <div className="absolute top-1/2 left-0 -translate-y-1/2 animate-[slideRight_0.3s_ease]">
                      <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'west')!.card} />
                    </div>
                  )}
                  {state.currentTrick.cards.find(c => c.playerId === 'east') && (
                    <div className="absolute top-1/2 right-0 -translate-y-1/2 animate-[slideLeft_0.3s_ease]">
                      <MiniCard card={state.currentTrick.cards.find(c => c.playerId === 'east')!.card} />
                    </div>
                  )}
                </div>

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

                {!lastCompletedTrick && state.currentTrick.cards.length < 4 && (
                  <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2">
                    <span className="text-[9px] text-slate-500">
                      {isPlayerTurn ? 'Your turn' : `${PLAYER_NAMES[state.currentPlayer]}'s turn`}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center">
                <FaceDownCards count={(state.hands['east'] || []).length} orientation="vertical" />
              </div>
            </div>
          </>
        )}

        {/* Player hand (show during bidding too) */}
        <div className="mt-3 w-full flex flex-col items-center">
          <div className="flex justify-center flex-wrap gap-[2px] max-w-full px-1">
            {playerHand.map(card => {
              const isPlayable = state.phase === 'playing' && playableIds.includes(card.id)
              return (
                <CardView
                  key={card.id}
                  card={card}
                  onClick={state.phase === 'playing' ? () => handleCardClick(card.id) : undefined}
                  playable={isPlayable}
                  size="md"
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Bag Warning */}
      {state.phase === 'playing' && state.cumulativeBags[playerTeamIdx] >= 7 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/40 rounded-lg px-3 py-1 text-[10px] text-amber-400 animate-pulse z-30">
          {'\u26A0'} {state.cumulativeBags[playerTeamIdx]} bags! Watch out for overtricks!
        </div>
      )}

      {/* Round Over overlay */}
      {state.phase === 'roundOver' && state.roundResults && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            <h3 className="text-white font-bold text-lg mb-3">Round {state.roundNumber + 1} Results</h3>

            {/* Nil results */}
            {state.roundResults.nilResults.map(nr => (
              <div
                key={nr.playerId}
                className={`text-sm mb-2 font-semibold ${nr.success ? 'text-emerald-400' : 'text-red-400'}`}
              >
                {PLAYER_NAMES[nr.playerId]} {nr.success ? 'made Nil! +100' : 'failed Nil! -100'}
              </div>
            ))}

            <div className="space-y-3 mb-4">
              {[0, 1].map(t => {
                const members = state.teams[t].map(p => PLAYER_NAMES[p]).join(' & ')
                const teamColor = TEAM_COLORS[t]
                return (
                  <div key={t} className="rounded-md p-2 border" style={{ borderColor: `${teamColor}30` }}>
                    <div className="text-xs mb-1" style={{ color: teamColor }}>{members}</div>
                    <div className="text-[10px] text-slate-400">
                      Bid: {state.roundResults!.teamBids[t]} | Won: {state.roundResults!.teamTricks[t]}
                    </div>
                    <div className={`text-sm font-bold ${state.roundResults!.teamRoundScore[t] >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {state.roundResults!.teamRoundScore[t] >= 0 ? '+' : ''}{state.roundResults!.teamRoundScore[t]}
                    </div>
                    <div className="text-white font-bold text-base">
                      Total: {state.cumulativeScores[t]}
                    </div>
                    <div className="text-[9px] text-slate-500">Bags: {state.cumulativeBags[t]}</div>
                  </div>
                )
              })}
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
              {state.winner === playerTeamIdx ? '\uD83C\uDFC6' : '\uD83D\uDCA8'}
            </div>
            <h3 className="text-white font-bold text-lg mb-3">
              {state.winner === playerTeamIdx ? 'Your Team Wins!' : 'Opponents Win!'}
            </h3>
            <div className="space-y-3 mb-4">
              {[0, 1].map(t => {
                const members = state.teams[t].map(p => PLAYER_NAMES[p]).join(' & ')
                const teamColor = TEAM_COLORS[t]
                const isWinner = state.winner === t
                return (
                  <div
                    key={t}
                    className={`rounded-md p-3 border ${isWinner ? 'bg-amber-500/10 border-amber-500/30' : 'border-slate-700'}`}
                  >
                    <div className="text-xs" style={{ color: teamColor }}>
                      {isWinner && '\uD83E\uDD47 '}{members}
                    </div>
                    <div className="text-white font-bold text-xl">{state.cumulativeScores[t]}</div>
                  </div>
                )
              })}
            </div>
          </div>
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
