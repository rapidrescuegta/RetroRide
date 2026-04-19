'use client'

import { useState, useCallback, useEffect } from 'react'
import type { Card, Suit, Rank } from '@/lib/card-engine'
import { SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player } from '@/lib/multiplayer-game'
import { useMultiplayerGame, setNetwork } from '@/lib/multiplayer-game'
import type { NetworkAdapter } from '@/lib/network-adapter'
import { getMultiplayerConfig, type MultiplayerGameEntry } from '@/lib/multiplayer-registry'
import { getGameById } from '@/lib/games'
import Hand from '@/components/cards/Hand'
import GameLayout from '@/components/cards/GameLayout'
import ScoreCompetition from '@/components/ScoreCompetition'
import TurnBasedMultiplayer from '@/components/TurnBasedMultiplayer'
import PlayingCard from '@/components/cards/PlayingCard'

// ─── Props ──────────────────────────────────────────────────────────────────

interface MultiplayerGameViewProps {
  config: MultiplayerGameConfig<any>
  adapter: NetworkAdapter
  onLeave: () => void
  /** Override: pass the registry entry directly instead of looking up from config.gameType */
  registryEntry?: MultiplayerGameEntry
}

// ─── Suit Picker (Crazy Eights) ─────────────────────────────────────────────

function SuitPicker({ onChoose }: { onChoose: (suit: Suit) => void }) {
  const suitButtons: { suit: Suit; bg: string }[] = [
    { suit: 'hearts', bg: 'rgba(239, 68, 68, 0.2)' },
    { suit: 'diamonds', bg: 'rgba(239, 68, 68, 0.2)' },
    { suit: 'clubs', bg: 'rgba(226, 232, 240, 0.15)' },
    { suit: 'spades', bg: 'rgba(226, 232, 240, 0.15)' },
  ]

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40">
      <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-6 text-center">
        <p className="text-white font-bold text-lg mb-1">CRAZY EIGHT!</p>
        <p className="text-slate-400 text-sm mb-4">Choose a suit</p>
        <div className="grid grid-cols-2 gap-3">
          {suitButtons.map(({ suit, bg }) => (
            <button
              key={suit}
              onClick={() => onChoose(suit)}
              className="w-20 h-20 rounded-xl flex flex-col items-center justify-center text-3xl font-bold transition-all hover:scale-105 active:scale-95"
              style={{
                background: bg,
                color: SUIT_COLORS[suit],
                border: `2px solid ${SUIT_COLORS[suit]}40`,
              }}
            >
              <span>{SUIT_SYMBOLS[suit]}</span>
              <span className="text-[10px] mt-1 capitalize">{suit}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Go Fish: Player Target Picker ──────────────────────────────────────────

function GoFishTargetPicker({
  players,
  myId,
  selectedRank,
  onAsk,
  onCancel,
}: {
  players: Player[]
  myId: string
  selectedRank: Rank
  onAsk: (targetId: string) => void
  onCancel: () => void
}) {
  const targets = players.filter(p => p.id !== myId && p.handSize > 0)

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      <p className="text-sm text-slate-400">
        Asking for <span className="text-cyan-400 font-bold">{selectedRank}s</span> — tap a player:
      </p>
      <div className="flex gap-3 flex-wrap justify-center">
        {targets.map(p => (
          <button
            key={p.id}
            onClick={() => onAsk(p.id)}
            className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <span className="text-2xl">{p.avatar}</span>
            <span className="text-xs text-white">{p.name}</span>
            <span className="text-[10px] text-slate-500">{p.handSize} cards</span>
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="text-xs text-slate-500 hover:text-slate-300 underline"
      >
        Cancel
      </button>
    </div>
  )
}

// ─── Card Game View (existing Crazy Eights / Go Fish / generic card) ────────

function CardGameView({
  config,
  adapter,
  onLeave,
}: {
  config: MultiplayerGameConfig<any>
  adapter: NetworkAdapter
  onLeave: () => void
}) {
  // Wire up the network before using the hook
  useEffect(() => {
    setNetwork(adapter)
    return () => setNetwork(null)
  }, [adapter])

  const {
    players,
    gamePhase,
    isHost,
    isMyTurn,
    myHand,
    currentTurnPlayerId,
    startGame,
    sendAction,
    gameState,
    scores,
    winner,
    error,
  } = useMultiplayerGame(config)

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [goFishSelectedRank, setGoFishSelectedRank] = useState<Rank | null>(null)
  const [heartsPassSelection, setHeartsPassSelection] = useState<string[]>([])
  const [spadesBidValue, setSpadesBidValue] = useState<number>(3)

  const isCrazyEights = config.gameType === 'crazy-eights'
  const isGoFish = config.gameType === 'go-fish'
  const isHearts = config.gameType === 'hearts'
  const isSpades = config.gameType === 'spades'
  const isTrickGame = isHearts || isSpades
  const gameInfo = getGameById(config.gameType)
  const gameName = gameInfo?.name?.toUpperCase() ?? config.gameType.toUpperCase()

  // ─── Crazy Eights Handlers ────────────────────────────────────────────

  const handlePlayCard = useCallback((cardId: string) => {
    if (!isMyTurn || !isCrazyEights) return
    sendAction({ type: 'play-card', data: { cardId } })
    setSelectedCardId(null)
  }, [isMyTurn, isCrazyEights, sendAction])

  const handleDrawCard = useCallback(() => {
    if (!isMyTurn || !isCrazyEights) return
    sendAction({ type: 'draw-card', data: {} })
  }, [isMyTurn, isCrazyEights, sendAction])

  const handleChooseSuit = useCallback((suit: Suit) => {
    sendAction({ type: 'choose-suit', data: { suit } })
  }, [sendAction])

  // ─── Go Fish Handlers ────────────────────────────────────────────────

  const handleGoFishCardTap = useCallback((cardId: string) => {
    if (!isMyTurn || !isGoFish) return
    const card = myHand.find(c => c.id === cardId)
    if (!card) return

    if (goFishSelectedRank === card.rank) {
      setGoFishSelectedRank(null)
    } else {
      setGoFishSelectedRank(card.rank)
    }
  }, [isMyTurn, isGoFish, myHand, goFishSelectedRank])

  const handleGoFishAsk = useCallback((targetId: string) => {
    if (!goFishSelectedRank) return
    sendAction({ type: 'ask-for-rank', data: { rank: goFishSelectedRank, targetId } })
    setGoFishSelectedRank(null)
  }, [goFishSelectedRank, sendAction])

  // ─── Hearts Handlers ──────────────────────────────────────────────────

  const handleHeartsPassToggle = useCallback((cardId: string) => {
    if (!isHearts || gameState?.phase !== 'passing') return
    setHeartsPassSelection(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId)
      }
      if (prev.length >= 3) return prev
      return [...prev, cardId]
    })
  }, [isHearts, gameState?.phase])

  const handleHeartsConfirmPass = useCallback(() => {
    if (heartsPassSelection.length !== 3) return
    sendAction({ type: 'select-pass', data: { cardIds: heartsPassSelection } })
    setHeartsPassSelection([])
  }, [heartsPassSelection, sendAction])

  const handleHeartsPlayCard = useCallback((cardId: string) => {
    if (!isMyTurn || !isHearts) return
    sendAction({ type: 'play-card', data: { cardId } })
  }, [isMyTurn, isHearts, sendAction])

  // ─── Spades Handlers ──────────────────────────────────────────────────

  const handleSpadesBid = useCallback((bid: number) => {
    if (!isMyTurn || !isSpades) return
    sendAction({ type: 'place-bid', data: { bid } })
  }, [isMyTurn, isSpades, sendAction])

  const handleSpadesPlayCard = useCallback((cardId: string) => {
    if (!isMyTurn || !isSpades) return
    sendAction({ type: 'play-card', data: { cardId } })
  }, [isMyTurn, isSpades, sendAction])

  // ─── Generic Card Action Handler ──────────────────────────────────────

  const handleGenericCardTap = useCallback((cardId: string) => {
    if (!isMyTurn) return
    sendAction({ type: 'play-card', data: { cardId } })
  }, [isMyTurn, sendAction])

  // ─── Lobby Phase ──────────────────────────────────────────────────────

  if (gamePhase === 'lobby') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <span className="text-3xl mb-2 block">{gameInfo?.icon ?? '🃏'}</span>
            <h2
              className="text-lg font-bold text-white mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              {gameName}
            </h2>
            <p className="text-xs text-slate-500">Waiting for players...</p>
          </div>

          {/* Player list */}
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Players ({players.length})
              {config.minPlayers > players.length && (
                <span className="text-amber-400 ml-2">
                  Need {config.minPlayers - players.length} more
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50"
                >
                  <span className="text-lg">{p.avatar}</span>
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Start button (host only) */}
          {isHost && (
            <button
              onClick={startGame}
              disabled={players.length < config.minPlayers}
              className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-500 hover:to-cyan-500 transition-all"
              style={{
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '12px',
              }}
            >
              START GAME
            </button>
          )}

          {!isHost && (
            <p className="text-center text-sm text-slate-400">
              Waiting for host to start...
            </p>
          )}

          {error && (
            <p className="text-center text-xs text-red-400">{error}</p>
          )}

          <button
            onClick={onLeave}
            className="w-full py-2 text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    )
  }

  // ─── Game Over Phase ──────────────────────────────────────────────────

  if (gamePhase === 'game-over') {
    // Hearts: lowest score wins. Others: highest score wins.
    const sortedPlayers = [...players].sort((a, b) => {
      const sa = scores[a.id] ?? 0
      const sb = scores[b.id] ?? 0
      return isHearts ? sa - sb : sb - sa
    })

    const scoreLabel = isGoFish ? 'books' : 'pts'

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs w-full">
          <p className="text-3xl mb-2">{gameInfo?.icon ?? '\u{1F3C6}'}</p>
          <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
          <p className="text-purple-400 text-sm mb-4">{gameState?.message ?? ''}</p>
          {isHearts && (
            <p className="text-slate-500 text-[10px] mb-2">Lowest score wins in Hearts</p>
          )}
          {isSpades && gameState?.teams && (
            <div className="flex gap-4 justify-center mb-3">
              {(gameState.teams as string[][]).map((team: string[], t: number) => (
                <div
                  key={t}
                  className={`px-3 py-1.5 rounded-lg text-xs ${
                    gameState.winner === t
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      : 'bg-slate-800/50 text-slate-400'
                  }`}
                >
                  <div className="font-bold mb-0.5">Team {t + 1}</div>
                  <div>{gameState.cumulativeScores?.[t] ?? 0} pts</div>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 mb-4">
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  p.id === winner ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
                }`}
              >
                <span className="text-sm text-slate-300">
                  {p.id === winner ? '\u{1F451} ' : ''}{p.avatar} {p.name}
                </span>
                <span className="text-amber-400 font-bold text-sm">
                  {scores[p.id] ?? 0} {scoreLabel}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={onLeave}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  // ─── Playing Phase ────────────────────────────────────────────────────

  const myId = adapter.myPeerId
  const currentTurnPlayer = players.find(p => p.id === currentTurnPlayerId)

  // Crazy Eights specific state
  const topCard = gameState?.topCard as Card | undefined
  const currentSuit = gameState?.currentSuit as Suit | undefined
  const deckSize = (gameState?.deckSize ?? 0) as number
  const cePhase = gameState?.phase as string | undefined
  const choosingSuitPlayerId = gameState?.choosingSuitPlayerId as string | undefined

  // Go Fish specific state
  const books = (gameState?.books ?? {}) as Record<string, Rank[]>

  // Hearts/Spades trick-taking state
  const trickCards = (gameState?.currentTrick?.cards ?? []) as { playerId: string; card: Card }[]
  const trickLeadSuit = gameState?.currentTrick?.leadSuit as Suit | undefined
  const gsPhase = (gameState?.phase ?? 'playing') as string
  const cumulativeScores = gameState?.cumulativeScores
  const roundScores = gameState?.roundScores
  const heartsBroken = gameState?.heartsBroken as boolean | undefined
  const spadesBroken = gameState?.spadesBroken as boolean | undefined
  const passDirection = gameState?.passDirection as string | undefined
  const passComplete = gameState?.passComplete as Record<string, boolean> | undefined
  const bids = gameState?.bids as Record<string, number | null> | undefined
  const tricksWon = gameState?.tricksWon as Record<string, number> | undefined
  const teams = gameState?.teams as [string[], string[]] | undefined
  const roundResults = gameState?.roundResults
  const shotTheMoon = gameState?.shotTheMoon as string | undefined

  // Build the appropriate selected IDs for the Hand component
  const selectedIds = isCrazyEights
    ? (selectedCardId ? [selectedCardId] : [])
    : isGoFish
      ? myHand.filter(c => c.rank === goFishSelectedRank).map(c => c.id)
      : isHearts && gsPhase === 'passing'
        ? heartsPassSelection
        : (selectedCardId ? [selectedCardId] : [])

  return (
    <div className="relative">
      <GameLayout
        players={players}
        currentPlayerId={myId}
        currentTurnId={currentTurnPlayerId ?? ''}
        topContent={
          <div className="flex items-center justify-between">
            <button
              onClick={onLeave}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Leave
            </button>
            <span
              className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              {gameInfo?.name ?? config.gameType}
            </span>
            <div className="w-10" />
          </div>
        }
        centerContent={
          isTrickGame ? (
            /* Hearts / Spades trick area */
            <div className="flex flex-col items-center gap-2">
              {/* Scoreboard */}
              {isHearts && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {players.map(p => (
                    <div
                      key={p.id}
                      className={`text-center rounded-md px-2 py-1 text-[10px] border transition-all ${
                        p.id === currentTurnPlayerId && gsPhase === 'playing'
                          ? 'border-cyan-500/40 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-900/50'
                      }`}
                    >
                      <div className="text-slate-400 truncate">{p.avatar} {p.name}</div>
                      <div className="text-white font-bold">{(cumulativeScores as any)?.[p.id] ?? 0}</div>
                      {(roundScores as any)?.[p.id] > 0 && gsPhase === 'playing' && (
                        <div className="text-red-400 text-[9px]">+{(roundScores as any)?.[p.id]}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isSpades && (
                <div className="flex flex-col items-center gap-1">
                  {/* Team scores */}
                  {teams && (
                    <div className="flex gap-4">
                      {teams.map((team, t) => {
                        const teamPlayers = players.filter(p => team.includes(p.id))
                        const teamBid = team.reduce((s, pid) => {
                          const b = bids?.[pid]
                          return s + (b !== null && b !== undefined && b !== -1 ? b : 0)
                        }, 0)
                        const teamTricks = team.reduce((s, pid) => s + (tricksWon?.[pid] ?? 0), 0)
                        return (
                          <div
                            key={t}
                            className="text-center rounded-md px-2 py-1 text-[10px] border border-slate-700 bg-slate-900/50"
                          >
                            <div className="text-slate-400">
                              {teamPlayers.map(p => p.avatar).join(' ')} Team {t + 1}
                            </div>
                            <div className="text-white font-bold">
                              {(cumulativeScores as any)?.[t] ?? 0} pts
                            </div>
                            {gsPhase === 'playing' && (
                              <div className="text-cyan-400 text-[9px]">
                                {teamTricks}/{teamBid} tricks
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Individual bids */}
                  {gsPhase === 'playing' && bids && (
                    <div className="flex gap-2 flex-wrap justify-center">
                      {players.map(p => (
                        <div key={p.id} className="text-[9px] text-slate-500">
                          {p.avatar} bid:{' '}
                          <span className="text-slate-300">
                            {bids[p.id] === -1 ? 'Nil' : bids[p.id] ?? '?'}
                          </span>
                          {' '}won:{' '}
                          <span className="text-slate-300">
                            {tricksWon?.[p.id] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Status indicators */}
              <div className="flex items-center gap-3 text-[10px]">
                {isHearts && (
                  <>
                    <span className={`transition-all ${heartsBroken ? 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]' : 'text-slate-600'}`}>
                      {'\u2665'} {heartsBroken ? 'Broken' : 'Locked'}
                    </span>
                    <span className="text-slate-500">R{(gameState?.roundNumber ?? 0) + 1}</span>
                  </>
                )}
                {isSpades && (
                  <>
                    <span className={`transition-all ${spadesBroken ? 'text-slate-300 drop-shadow-[0_0_6px_rgba(148,163,184,0.6)]' : 'text-slate-600'}`}>
                      {'\u2660'} {spadesBroken ? 'Broken' : 'Locked'}
                    </span>
                    <span className="text-slate-500">R{(gameState?.roundNumber ?? 0) + 1}</span>
                  </>
                )}
              </div>

              {/* Current trick cards */}
              {gsPhase === 'playing' && (
                <div className="relative w-[140px] h-[100px]">
                  {trickCards.map(({ playerId: pid, card }, i) => {
                    // Position cards around the center based on player order index
                    const playerOrder = gameState?.playerOrder ?? []
                    const myIdx = playerOrder.indexOf(myId)
                    const pidIdx = playerOrder.indexOf(pid)
                    const relPos = (pidIdx - myIdx + 4) % 4  // 0=me, 1=left, 2=top, 3=right
                    const posStyles = [
                      { bottom: 0, left: '50%', transform: 'translateX(-50%)' },          // me (bottom)
                      { top: '50%', left: 0, transform: 'translateY(-50%)' },              // left
                      { top: 0, left: '50%', transform: 'translateX(-50%)' },              // top
                      { top: '50%', right: 0, transform: 'translateY(-50%)' },             // right
                    ]
                    const style = posStyles[relPos] ?? posStyles[0]
                    return (
                      <div
                        key={card.id}
                        className="absolute transition-all duration-300"
                        style={style as any}
                      >
                        <PlayingCard card={card} faceUp size="sm" />
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Passing direction indicator */}
              {isHearts && gsPhase === 'passing' && (
                <div className="text-center">
                  <div className="text-cyan-400 text-sm font-bold capitalize">
                    {passDirection === 'left' ? '\u2190 Pass Left' :
                     passDirection === 'right' ? '\u2192 Pass Right' :
                     passDirection === 'across' ? '\u2195 Pass Across' :
                     'No Pass'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Select 3 cards to pass</div>
                </div>
              )}

              {/* Bidding UI for Spades */}
              {isSpades && gsPhase === 'bidding' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-sm text-slate-400">
                    {isMyTurn ? 'Place your bid' : `Waiting for ${currentTurnPlayer?.name ?? 'opponent'} to bid...`}
                  </div>
                  {/* Show existing bids */}
                  <div className="flex gap-2 flex-wrap justify-center">
                    {players.map(p => (
                      <div key={p.id} className="text-[10px] text-slate-500">
                        {p.avatar}{' '}
                        {bids?.[p.id] === null
                          ? '...'
                          : bids?.[p.id] === -1
                            ? 'Nil'
                            : bids?.[p.id]}
                      </div>
                    ))}
                  </div>
                  {isMyTurn && (
                    <div className="flex flex-col items-center gap-2 mt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSpadesBidValue(v => Math.max(0, v - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700"
                        >
                          -
                        </button>
                        <span className="text-white font-bold text-lg w-12 text-center">
                          {spadesBidValue === 0 ? 'Nil' : spadesBidValue}
                        </span>
                        <button
                          onClick={() => setSpadesBidValue(v => Math.min(13, v + 1))}
                          className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:bg-slate-700"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleSpadesBid(spadesBidValue)}
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white text-sm font-bold hover:from-purple-500 hover:to-cyan-500 transition-all"
                      >
                        Bid {spadesBidValue === 0 ? 'Nil' : spadesBidValue}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isCrazyEights ? (
            /* Crazy Eights table */
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-6">
                {/* Deck */}
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={isMyTurn && deckSize > 0 ? handleDrawCard : undefined}
                    disabled={!isMyTurn || deckSize === 0}
                    className={`rounded-lg flex items-center justify-center transition-all ${
                      isMyTurn && deckSize > 0 ? 'cursor-pointer hover:scale-105 active:scale-95 ring-1 ring-cyan-400/30' : 'opacity-40'
                    }`}
                    style={{
                      width: 64,
                      height: 90,
                      background: deckSize > 0
                        ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                        : 'rgba(30, 27, 75, 0.3)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    {deckSize > 0 ? (
                      <span className="text-purple-400/50 text-2xl">&#x1F0A0;</span>
                    ) : (
                      <span className="text-slate-600 text-xs">Empty</span>
                    )}
                  </button>
                  <span className="text-[10px] text-slate-500">{deckSize}</span>
                  {isMyTurn && deckSize > 0 && (
                    <span className="text-[10px] text-cyan-400 animate-pulse">Draw</span>
                  )}
                </div>

                {/* Discard pile */}
                {topCard && (
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="rounded-lg flex flex-col items-center justify-center"
                      style={{
                        width: 72,
                        height: 100,
                        color: SUIT_COLORS[topCard.suit],
                        background: topCard.rank === '8'
                          ? 'linear-gradient(135deg, #1e1b4b 0%, #4c1d95 50%, #1e1b4b 100%)'
                          : '#1e293b',
                        border: topCard.rank === '8'
                          ? '1px solid rgba(167, 139, 250, 0.6)'
                          : '1px solid rgba(100, 116, 139, 0.4)',
                        boxShadow: topCard.rank === '8' ? '0 0 8px rgba(139, 92, 246, 0.3)' : undefined,
                      }}
                    >
                      <span className="text-sm font-bold leading-none">{topCard.rank}</span>
                      <span className="text-xl leading-none">{SUIT_SYMBOLS[topCard.suit]}</span>
                    </div>
                    {/* Current suit indicator */}
                    {currentSuit && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-bold"
                        style={{
                          color: SUIT_COLORS[currentSuit],
                          background: `${SUIT_COLORS[currentSuit]}15`,
                          border: `1px solid ${SUIT_COLORS[currentSuit]}30`,
                        }}
                      >
                        <span>{SUIT_SYMBOLS[currentSuit]}</span>
                        <span className="text-[10px] capitalize">{currentSuit}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Scores */}
              <div className="flex gap-2 flex-wrap justify-center">
                {players.map(p => (
                  <div key={p.id} className="text-[10px] text-slate-500">
                    {p.avatar} {gameState?.scores?.[p.id] ?? 0}pts
                  </div>
                ))}
              </div>
            </div>
          ) : isGoFish ? (
            /* Go Fish table */
            <div className="flex flex-col items-center gap-3">
              {/* Books display */}
              {Object.entries(books).some(([, b]) => b.length > 0) && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {players.map(p =>
                    (books[p.id] ?? []).map(rank => (
                      <div key={`${p.id}-${rank}`} className="flex flex-col items-center">
                        <div className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                          {rank}x4
                        </div>
                        <span className="text-[8px] text-slate-500">{p.avatar}</span>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Deck */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 90,
                    background: deckSize > 0
                      ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                      : 'rgba(30, 27, 75, 0.3)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                  }}
                >
                  {deckSize > 0 ? (
                    <span className="text-purple-400/50 text-2xl">&#x1F0A0;</span>
                  ) : (
                    <span className="text-slate-600 text-xs">Empty</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{deckSize} cards</span>
              </div>

              {/* Book counts */}
              <div className="flex gap-3 flex-wrap justify-center">
                {players.map(p => (
                  <div key={p.id} className="text-[10px] text-slate-500">
                    {p.avatar} {(books[p.id] ?? []).length} books
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Generic card game table */
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="rounded-lg flex items-center justify-center"
                  style={{
                    width: 64,
                    height: 90,
                    background: deckSize > 0
                      ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)'
                      : 'rgba(30, 27, 75, 0.3)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                  }}
                >
                  {deckSize > 0 ? (
                    <span className="text-purple-400/50 text-2xl">&#x1F0A0;</span>
                  ) : (
                    <span className="text-slate-600 text-xs">Empty</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500">{deckSize} cards</span>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {players.map(p => (
                  <div key={p.id} className="text-[10px] text-slate-500">
                    {p.avatar} {scores[p.id] ?? 0}pts
                  </div>
                ))}
              </div>
            </div>
          )
        }
        bottomContent={
          <div className="flex flex-col">
            {/* Status message */}
            <div className="text-center py-1">
              <p className="text-sm text-slate-400">
                {gameState?.message ?? (isMyTurn ? 'Your turn!' : `${currentTurnPlayer?.name ?? 'Opponent'}'s turn...`)}
              </p>
              {gameState?.lastAction && (
                <p className="text-[10px] text-slate-600">{gameState.lastAction}</p>
              )}
            </div>

            {/* Go Fish: target picker when a rank is selected */}
            {isGoFish && isMyTurn && goFishSelectedRank && (
              <GoFishTargetPicker
                players={players}
                myId={myId}
                selectedRank={goFishSelectedRank}
                onAsk={handleGoFishAsk}
                onCancel={() => setGoFishSelectedRank(null)}
              />
            )}

            {/* Hearts: pass selection count */}
            {isHearts && gsPhase === 'passing' && (
              <div className="text-center text-[10px] text-slate-400 mb-1">
                Select 3 cards to pass ({heartsPassSelection.length}/3)
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-center text-xs text-red-400 py-1">{error}</p>
            )}

            {/* Hand */}
            <Hand
              cards={myHand}
              selectedIds={selectedIds}
              onCardSelect={
                isCrazyEights
                  ? (cardId) => {
                      if (!isMyTurn) return
                      if (selectedCardId === cardId) {
                        handlePlayCard(cardId)
                      } else {
                        setSelectedCardId(cardId)
                      }
                    }
                  : isGoFish
                    ? (cardId) => handleGoFishCardTap(cardId)
                    : isHearts && gsPhase === 'passing'
                      ? (cardId) => handleHeartsPassToggle(cardId)
                      : isHearts
                        ? (cardId) => handleHeartsPlayCard(cardId)
                        : isSpades && gsPhase === 'playing'
                          ? (cardId) => handleSpadesPlayCard(cardId)
                          : (cardId) => handleGenericCardTap(cardId)
              }
              size="md"
            />

            {/* Crazy Eights: play selected card button */}
            {isCrazyEights && isMyTurn && selectedCardId && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={() => handlePlayCard(selectedCardId)}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:from-purple-500 hover:to-pink-500 transition-all"
                >
                  Play Card
                </button>
              </div>
            )}

            {/* Hearts: pass button */}
            {isHearts && gsPhase === 'passing' && heartsPassSelection.length === 3 && (
              <div className="flex justify-center pb-2">
                <button
                  onClick={handleHeartsConfirmPass}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-sm font-bold hover:from-cyan-500 hover:to-purple-500 transition-all active:scale-95"
                >
                  Pass Cards {passDirection === 'left' ? '\u2190' : passDirection === 'right' ? '\u2192' : '\u2195'}
                </button>
              </div>
            )}

            {/* Go Fish: hint when no rank selected */}
            {isGoFish && isMyTurn && !goFishSelectedRank && (
              <p className="text-center text-[10px] text-cyan-400/60 pb-1">
                Tap a card to ask for that rank
              </p>
            )}
          </div>
        }
      />

      {/* Crazy Eights: suit picker overlay */}
      {isCrazyEights && cePhase === 'choosing-suit' && choosingSuitPlayerId === myId && (
        <SuitPicker onChoose={handleChooseSuit} />
      )}

      {/* Hearts: round-over overlay */}
      {isHearts && gsPhase === 'round-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            {shotTheMoon && (
              <div className="text-2xl mb-2 animate-bounce">
                {'\uD83C\uDF19'} {players.find(p => p.id === shotTheMoon)?.name} shot the moon!
              </div>
            )}
            <h3 className="text-white font-bold text-lg mb-3">
              Round {(gameState?.roundNumber ?? 0) + 1} Complete
            </h3>
            <div className="space-y-2 mb-4">
              {players.map(p => (
                <div key={p.id} className="flex justify-between text-sm">
                  <span className="text-slate-400">{p.avatar} {p.name}</span>
                  <span className="text-white">
                    <span className="text-red-400">+{(roundScores as any)?.[p.id] ?? 0}</span>
                    {' = '}
                    <span className="font-bold">{(cumulativeScores as any)?.[p.id] ?? 0}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">Waiting for host to start next round...</p>
          </div>
        </div>
      )}

      {/* Spades: round-over overlay */}
      {isSpades && gsPhase === 'round-over' && roundResults && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-sm w-full text-center">
            <h3 className="text-white font-bold text-lg mb-3">
              Round {(gameState?.roundNumber ?? 0) + 1} Complete
            </h3>
            {teams && (
              <div className="space-y-3 mb-4">
                {teams.map((team, t) => {
                  const teamPlayers = players.filter(p => team.includes(p.id))
                  return (
                    <div key={t} className="rounded-lg bg-slate-800/50 p-3">
                      <div className="text-sm text-slate-300 mb-1">
                        {teamPlayers.map(p => `${p.avatar} ${p.name}`).join(' & ')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Bid: {roundResults.teamBids[t]} | Won: {roundResults.teamTricks[t]} |{' '}
                        <span className={roundResults.teamRoundScore[t] >= 0 ? 'text-green-400' : 'text-red-400'}>
                          {roundResults.teamRoundScore[t] >= 0 ? '+' : ''}{roundResults.teamRoundScore[t]}
                        </span>
                      </div>
                      <div className="text-white font-bold text-sm mt-1">
                        Total: {(cumulativeScores as any)?.[t] ?? 0}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {roundResults.nilResults?.length > 0 && (
              <div className="mb-3">
                {roundResults.nilResults.map((nr: any) => (
                  <div key={nr.playerId} className={`text-xs ${nr.success ? 'text-green-400' : 'text-red-400'}`}>
                    {players.find(p => p.id === nr.playerId)?.name}: Nil {nr.success ? 'succeeded!' : 'failed!'}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500">Waiting for host to start next round...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component (Router) ────────────────────────────────────────────────

export default function MultiplayerGameView({
  config,
  adapter,
  onLeave,
  registryEntry,
}: MultiplayerGameViewProps) {
  // Look up the registry entry to determine game type
  const entry = registryEntry ?? getMultiplayerConfig(config.gameType)

  // ── Real-time arcade score competition ──────────────────────────────
  if (entry?.type === 'real-time') {
    return (
      <ScoreCompetition
        gameId={entry.gameId}
        adapter={adapter}
        timerSeconds={entry.timerSeconds ?? 120}
        onLeave={onLeave}
      />
    )
  }

  // ── Turn-based strategy games ───────────────────────────────────────
  if (entry?.type === 'turn-based') {
    return (
      <TurnBasedMultiplayer
        gameId={entry.gameId}
        adapter={adapter}
        onLeave={onLeave}
      />
    )
  }

  // ── Card games (default — existing behavior) ────────────────────────
  return (
    <CardGameView
      config={config}
      adapter={adapter}
      onLeave={onLeave}
    />
  )
}
