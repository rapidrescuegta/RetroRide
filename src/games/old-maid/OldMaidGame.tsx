'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  type Card,
  type Rank,
  type Suit,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  RANKS,
  SUITS,
  shuffleDeck,
} from '@/lib/card-engine'

interface Props {
  onGameOver: (score: number) => void
  level: 'easy' | 'medium' | 'hard'
}

// ─── Sound Effects ──────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null
function getAudioCtx(): AudioContext | null {
  if (!audioCtx) {
    try { audioCtx = new AudioContext() } catch { return null }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playDrawSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'triangle'
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(500, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.05)
  gain.gain.setValueAtTime(0.1, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.1)
}

function playPairSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  ;[659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)
    gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.15)
    osc.start(ctx.currentTime + i * 0.1)
    osc.stop(ctx.currentTime + i * 0.1 + 0.15)
  })
}

function playWinSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  ;[523, 659, 784, 1047].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.1)
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.2)
    osc.start(ctx.currentTime + i * 0.1)
    osc.stop(ctx.currentTime + i * 0.1 + 0.2)
  })
}

function playLoseSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.frequency.setValueAtTime(300, ctx.currentTime)
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.5)
  gain.gain.setValueAtTime(0.08, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
  osc.start(ctx.currentTime)
  osc.stop(ctx.currentTime + 0.5)
}

function playOldMaidSound() {
  const ctx = getAudioCtx()
  if (!ctx) return
  // Comedic "wah wah" sound
  ;[400, 350, 300, 200].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.2)
    gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.2)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.18)
    osc.start(ctx.currentTime + i * 0.2)
    osc.stop(ctx.currentTime + i * 0.2 + 0.18)
  })
}

// ─── Card Component ─────────────────────────────────────────────────────────

function CardView({
  card,
  faceUp = true,
  size = 'md',
  onClick,
  highlighted = false,
  disabled = false,
  isOldMaid = false,
  animated = false,
}: {
  card: Card
  faceUp?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  highlighted?: boolean
  disabled?: boolean
  isOldMaid?: boolean
  animated?: boolean
}) {
  const sizes = {
    sm: { w: 40, h: 56, rank: 'text-[9px]', suit: 'text-xs' },
    md: { w: 52, h: 72, rank: 'text-[10px]', suit: 'text-base' },
    lg: { w: 64, h: 90, rank: 'text-xs', suit: 'text-lg' },
  }
  const { w, h, rank: rankSize, suit: suitSize } = sizes[size]
  const color = SUIT_COLORS[card.suit]

  if (!faceUp) {
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
          onClick && !disabled ? 'cursor-pointer hover:scale-105 hover:-translate-y-1 active:scale-95' : ''
        } ${highlighted ? 'ring-2 ring-pink-400 animate-pulse' : ''} ${disabled ? 'opacity-50' : ''} ${
          animated ? 'animate-[cardBounceIn_0.3s_ease-out]' : ''
        }`}
        style={{
          width: w,
          height: h,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          border: highlighted ? '2px solid rgba(236, 72, 153, 0.6)' : '1px solid rgba(139, 92, 246, 0.3)',
        }}
      >
        <span className="text-purple-500/40 text-lg">&#x1F0A0;</span>
      </div>
    )
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`rounded-lg flex flex-col items-center justify-center shrink-0 transition-all duration-200 ${
        onClick && !disabled ? 'cursor-pointer hover:scale-105 hover:-translate-y-1 active:scale-95' : ''
      } ${highlighted ? 'ring-2 ring-pink-400' : ''} ${disabled ? 'opacity-50' : ''} ${
        animated ? 'animate-[cardBounceIn_0.3s_ease-out]' : ''
      }`}
      style={{
        width: w,
        height: h,
        color: isOldMaid ? '#ec4899' : color,
        background: isOldMaid
          ? 'linear-gradient(135deg, #4a1942 0%, #831843 50%, #4a1942 100%)'
          : '#1e293b',
        border: isOldMaid
          ? '2px solid rgba(236, 72, 153, 0.6)'
          : '1px solid rgba(100, 116, 139, 0.4)',
        boxShadow: isOldMaid ? '0 0 12px rgba(236, 72, 153, 0.3)' : undefined,
      }}
    >
      <span className={`${rankSize} font-bold leading-none`}>{card.rank}</span>
      <span className={`${suitSize} leading-none`}>{SUIT_SYMBOLS[card.suit]}</span>
      {isOldMaid && <span className="text-[8px] text-pink-400">Old Maid</span>}
    </div>
  )
}

// ─── Rules Modal ────────────────────────────────────────────────────────────

function RulesModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full max-h-[80vh] overflow-y-auto">
        <h3 className="text-white font-bold text-lg mb-3">Old Maid Rules</h3>
        <div className="text-slate-300 text-sm space-y-2">
          <p><strong className="text-pink-400">Setup:</strong> One Queen is removed from the deck. Cards are dealt to all players. Discard any pairs from your hand.</p>
          <p><strong className="text-pink-400">Play:</strong> On your turn, draw a card from the player before you (face down). If it makes a pair, discard it!</p>
          <p><strong className="text-pink-400">Goal:</strong> Get rid of all your cards by making pairs.</p>
          <p><strong className="text-pink-400">Old Maid:</strong> The last Queen has no match. Whoever is stuck with it at the end loses!</p>
          <p><strong className="text-pink-400">AI Players:</strong> AI opponents will try to trick you by positioning the Old Maid!</p>
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-semibold transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

// ─── Flash Animation ────────────────────────────────────────────────────────

function PairFlash({ rank }: { rank: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
      <div
        className="text-2xl font-black text-emerald-400"
        style={{
          textShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
          animation: 'pairFlash 1s ease-out forwards',
        }}
      >
        PAIR! {rank}
      </div>
      <style>{`
        @keyframes pairFlash {
          0% { opacity: 0; transform: scale(0.5); }
          25% { opacity: 1; transform: scale(1.2); }
          70% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.8) translateY(-20px); }
        }
      `}</style>
    </div>
  )
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface OldMaidPlayer {
  id: string
  name: string
  icon: string
  hand: Card[]
  pairs: Rank[]
  isAI: boolean
  isOut: boolean
}

type Phase = 'discarding-pairs' | 'player-draw' | 'ai-turn' | 'game-over'

interface OldMaidState {
  players: OldMaidPlayer[]
  currentPlayerIndex: number
  phase: Phase
  message: string
  oldMaidCard: Card
  turnSeq: number
}

// Identify the "Old Maid" queen
const OLD_MAID_SUIT: Suit = 'spades'

// ─── Game Logic ─────────────────────────────────────────────────────────────

function createOldMaidDeck(): { deck: Card[]; oldMaidCard: Card } {
  const allCards: Card[] = []
  // Remove one Queen (hearts) to leave Q-spades as old maid
  const removedQueen: Suit = 'hearts'

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      if (rank === 'Q' && suit === removedQueen) continue
      allCards.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: 0,
        faceUp: false,
      })
    }
  }

  const oldMaidCard = allCards.find(c => c.rank === 'Q' && c.suit === OLD_MAID_SUIT)!

  return { deck: shuffleDeck(allCards), oldMaidCard }
}

function removePairsFromHand(hand: Card[]): { newHand: Card[]; pairs: Rank[] } {
  const rankCounts: Record<string, Card[]> = {}
  for (const card of hand) {
    if (!rankCounts[card.rank]) rankCounts[card.rank] = []
    rankCounts[card.rank].push(card)
  }

  const newHand: Card[] = []
  const pairs: Rank[] = []

  for (const rank in rankCounts) {
    const cards = rankCounts[rank]
    const pairCount = Math.floor(cards.length / 2)
    const remaining = cards.length % 2

    for (let i = 0; i < pairCount; i++) {
      pairs.push(rank as Rank)
    }

    // Keep the remaining cards
    if (remaining > 0) {
      newHand.push(cards[cards.length - 1])
    }
  }

  return { newHand, pairs }
}

function initGame(numAI: number): OldMaidState {
  const { deck, oldMaidCard } = createOldMaidDeck()
  const totalPlayers = numAI + 1

  const players: OldMaidPlayer[] = []
  const aiNames = ['Grandma', 'Auntie', 'Uncle']
  const aiIcons = ['\u{1F475}', '\u{1F469}', '\u{1F474}']

  // Create player slots
  players.push({
    id: 'human',
    name: 'You',
    icon: '\u{1F60A}',
    hand: [],
    pairs: [],
    isAI: false,
    isOut: false,
  })

  for (let i = 0; i < numAI; i++) {
    players.push({
      id: `ai-${i}`,
      name: aiNames[i] || `AI ${i + 1}`,
      icon: aiIcons[i] || '\u{1F916}',
      hand: [],
      pairs: [],
      isAI: true,
      isOut: false,
    })
  }

  // Deal cards round-robin
  for (let i = 0; i < deck.length; i++) {
    players[i % totalPlayers].hand.push(deck[i])
  }

  // Remove initial pairs from all hands
  for (const player of players) {
    const { newHand, pairs } = removePairsFromHand(player.hand)
    player.hand = shuffleDeck(newHand)
    player.pairs = pairs
  }

  // Check if anyone is already out
  for (const player of players) {
    if (player.hand.length === 0) player.isOut = true
  }

  return {
    players,
    currentPlayerIndex: 0,
    phase: 'player-draw',
    message: 'Draw a card from the next player!',
    oldMaidCard,
    turnSeq: 0,
  }
}

function getNextActivePlayer(players: OldMaidPlayer[], currentIndex: number): number {
  let next = (currentIndex + 1) % players.length
  let safety = 0
  while (players[next].isOut && safety < players.length) {
    next = (next + 1) % players.length
    safety++
  }
  return next
}

function getPrevActivePlayer(players: OldMaidPlayer[], currentIndex: number): number {
  let prev = (currentIndex - 1 + players.length) % players.length
  let safety = 0
  while (players[prev].isOut && safety < players.length) {
    prev = (prev - 1 + players.length) % players.length
    safety++
  }
  return prev
}

function getDrawTargetIndex(players: OldMaidPlayer[], currentIndex: number): number {
  // Draw from the next active player
  return getNextActivePlayer(players, currentIndex)
}

function countActivePlayers(players: OldMaidPlayer[]): number {
  return players.filter(p => !p.isOut).length
}

function checkGameOver(players: OldMaidPlayer[]): boolean {
  // Game over when only 1 player remains with cards (the old maid holder)
  const active = players.filter(p => !p.isOut)
  return active.length <= 1
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function OldMaidGame({ onGameOver, level }: Props) {
  const numAI = level === 'easy' ? 2 : level === 'medium' ? 3 : 3
  const [state, setState] = useState<OldMaidState>(() => initGame(numAI))
  const [showRules, setShowRules] = useState(false)
  const [pairFlash, setPairFlash] = useState<string | null>(null)
  const [lastDrawn, setLastDrawn] = useState<string | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const humanPlayer = state.players[0]
  const isHumanTurn = state.currentPlayerIndex === 0 && state.phase === 'player-draw'
  const drawTargetIndex = getDrawTargetIndex(state.players, state.currentPlayerIndex)
  const drawTarget = state.players[drawTargetIndex]

  // Clean up
  useEffect(() => {
    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [])

  // Game over callback
  useEffect(() => {
    if (state.phase === 'game-over') {
      const humanHasOldMaid = humanPlayer.hand.some(c => c.id === state.oldMaidCard.id)
      const pairsCount = humanPlayer.pairs.length
      const score = humanHasOldMaid ? pairsCount * 5 : pairsCount * 10 + 50
      onGameOver(score)
    }
  }, [state.phase, humanPlayer, state.oldMaidCard, onGameOver])

  // AI turns
  useEffect(() => {
    const currentPlayer = state.players[state.currentPlayerIndex]
    if (!currentPlayer.isAI || state.phase !== 'ai-turn') return
    if (currentPlayer.isOut) {
      // Skip to next player
      setState(prev => {
        const nextIdx = getNextActivePlayer(prev.players, prev.currentPlayerIndex)
        const nextPlayer = prev.players[nextIdx]
        return {
          ...prev,
          currentPlayerIndex: nextIdx,
          phase: nextPlayer.isAI ? 'ai-turn' : 'player-draw',
          message: nextPlayer.isAI ? `${nextPlayer.name} is drawing...` : 'Your turn! Draw a card.',
          turnSeq: prev.turnSeq + 1,
        }
      })
      return
    }

    const delay = 1000 + Math.random() * 800

    aiTimerRef.current = setTimeout(() => {
      setState(prev => {
        const cp = prev.players[prev.currentPlayerIndex]
        if (!cp.isAI || cp.isOut) return prev

        const targetIdx = getDrawTargetIndex(prev.players, prev.currentPlayerIndex)
        const target = prev.players[targetIdx]

        if (target.hand.length === 0) {
          // Skip
          const nextIdx = getNextActivePlayer(prev.players, prev.currentPlayerIndex)
          const nextPlayer = prev.players[nextIdx]
          return {
            ...prev,
            currentPlayerIndex: nextIdx,
            phase: nextPlayer.isAI ? 'ai-turn' : 'player-draw',
            message: nextPlayer.isAI ? `${nextPlayer.name} is drawing...` : 'Your turn! Draw a card.',
            turnSeq: prev.turnSeq + 1,
          }
        }

        // AI picks a random card from target
        let pickIndex: number
        if (level === 'hard') {
          // Hard AI avoids the old maid if it can "sense" it (30% accuracy)
          const oldMaidIdx = target.hand.findIndex(c => c.id === prev.oldMaidCard.id)
          if (oldMaidIdx >= 0 && Math.random() > 0.3) {
            // Avoid old maid
            const otherIndices = target.hand.map((_, i) => i).filter(i => i !== oldMaidIdx)
            pickIndex = otherIndices.length > 0
              ? otherIndices[Math.floor(Math.random() * otherIndices.length)]
              : oldMaidIdx
          } else {
            pickIndex = Math.floor(Math.random() * target.hand.length)
          }
        } else {
          pickIndex = Math.floor(Math.random() * target.hand.length)
        }

        const drawnCard = target.hand[pickIndex]
        const newTargetHand = [...target.hand]
        newTargetHand.splice(pickIndex, 1)

        const newCpHand = [...cp.hand, drawnCard]

        // Check for pair
        const { newHand: finalHand, pairs: newPairs } = removePairsFromHand(newCpHand)

        if (newPairs.length > 0) {
          playPairSound()
          setPairFlash(newPairs[0])
          setTimeout(() => setPairFlash(null), 1000)
        } else {
          playDrawSound()
        }

        const updatedPlayers = prev.players.map((p, i) => {
          if (i === prev.currentPlayerIndex) {
            const isNowOut = finalHand.length === 0
            return {
              ...p,
              hand: shuffleDeck(finalHand),
              pairs: [...p.pairs, ...newPairs],
              isOut: isNowOut,
            }
          }
          if (i === targetIdx) {
            const isNowOut = newTargetHand.length === 0
            return { ...p, hand: newTargetHand, isOut: isNowOut }
          }
          return p
        })

        // Check game over
        if (checkGameOver(updatedPlayers)) {
          const loser = updatedPlayers.find(p => !p.isOut)
          return {
            ...prev,
            players: updatedPlayers,
            phase: 'game-over' as Phase,
            message: loser
              ? `${loser.name} is the Old Maid!`
              : 'Game Over!',
            turnSeq: prev.turnSeq + 1,
          }
        }

        const nextIdx = getNextActivePlayer(updatedPlayers, prev.currentPlayerIndex)
        const nextPlayer = updatedPlayers[nextIdx]

        return {
          ...prev,
          players: updatedPlayers,
          currentPlayerIndex: nextIdx,
          phase: nextPlayer.isAI ? 'ai-turn' : 'player-draw',
          message: newPairs.length > 0
            ? `${cp.name} made a pair of ${newPairs[0]}s! ${nextPlayer.isAI ? `${nextPlayer.name} draws...` : 'Your turn!'}`
            : `${cp.name} drew a card. ${nextPlayer.isAI ? `${nextPlayer.name} draws...` : 'Your turn!'}`,
          turnSeq: prev.turnSeq + 1,
        }
      })
    }, delay)

    return () => {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current)
    }
  }, [state.currentPlayerIndex, state.phase, state.turnSeq, level])

  // Handle player drawing a card from opponent
  const handleDrawCard = useCallback((cardIndex: number) => {
    if (!isHumanTurn) return
    if (drawTarget.hand.length === 0) return

    playDrawSound()
    const drawnCard = drawTarget.hand[cardIndex]
    setLastDrawn(drawnCard.id)
    setTimeout(() => setLastDrawn(null), 1500)

    setState(prev => {
      const target = prev.players[drawTargetIndex]
      const cp = prev.players[0]

      const newTargetHand = [...target.hand]
      newTargetHand.splice(cardIndex, 1)

      const newCpHand = [...cp.hand, drawnCard]
      const { newHand: finalHand, pairs: newPairs } = removePairsFromHand(newCpHand)

      if (newPairs.length > 0) {
        playPairSound()
        setPairFlash(newPairs[0])
        setTimeout(() => setPairFlash(null), 1000)
      }

      const updatedPlayers = prev.players.map((p, i) => {
        if (i === 0) {
          const isNowOut = finalHand.length === 0
          return {
            ...p,
            hand: finalHand,
            pairs: [...p.pairs, ...newPairs],
            isOut: isNowOut,
          }
        }
        if (i === drawTargetIndex) {
          const isNowOut = newTargetHand.length === 0
          return { ...p, hand: newTargetHand, isOut: isNowOut }
        }
        return p
      })

      if (checkGameOver(updatedPlayers)) {
        const loser = updatedPlayers.find(p => !p.isOut)
        const isHumanLoser = loser?.id === 'human'
        if (isHumanLoser) playOldMaidSound()
        else playWinSound()
        return {
          ...prev,
          players: updatedPlayers,
          phase: 'game-over' as Phase,
          message: loser
            ? `${loser.name} ${loser.id === 'human' ? 'are' : 'is'} the Old Maid!`
            : 'Game Over!',
          turnSeq: prev.turnSeq + 1,
        }
      }

      const nextIdx = getNextActivePlayer(updatedPlayers, 0)
      const nextPlayer = updatedPlayers[nextIdx]

      return {
        ...prev,
        players: updatedPlayers,
        currentPlayerIndex: nextIdx,
        phase: nextPlayer.isAI ? 'ai-turn' : 'player-draw',
        message: newPairs.length > 0
          ? `You made a pair of ${newPairs[0]}s! ${nextPlayer.isAI ? `${nextPlayer.name} draws...` : 'Draw again!'}`
          : `You drew ${drawnCard.rank}${SUIT_SYMBOLS[drawnCard.suit]}. ${nextPlayer.isAI ? `${nextPlayer.name} draws...` : 'Draw again!'}`,
        turnSeq: prev.turnSeq + 1,
      }
    })
  }, [isHumanTurn, drawTarget, drawTargetIndex])

  const handleNewGame = useCallback(() => {
    setLastDrawn(null)
    setState(initGame(numAI))
  }, [numAI])

  const humanHasOldMaid = humanPlayer.hand.some(c => c.id === state.oldMaidCard.id)
  const totalPairs = state.players.reduce((sum, p) => sum + p.pairs.length, 0)

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
      <div className="flex items-center justify-center gap-3 px-3 py-2 text-xs bg-slate-900/60 flex-wrap">
        {state.players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all ${
              p.isOut
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : i === state.currentPlayerIndex && state.phase !== 'game-over'
                  ? 'bg-pink-500/20 ring-1 ring-pink-400/50'
                  : 'bg-slate-800/50'
            }`}
          >
            <span>{p.icon}</span>
            <span className={`font-medium ${p.isOut ? 'text-emerald-400' : 'text-slate-300'}`}>{p.name}</span>
            <span className="text-pink-400 font-bold">{p.pairs.length}</span>
            <span className="text-slate-500">({p.hand.length})</span>
            {p.isOut && <span className="text-emerald-400 text-[10px]">Done!</span>}
          </div>
        ))}
      </div>

      {/* AI players area */}
      <div className="flex justify-center gap-4 px-2 py-2 flex-wrap">
        {state.players.slice(1).map((p, idx) => {
          const isDrawTarget = isHumanTurn && drawTargetIndex === idx + 1 && !p.isOut
          return (
            <div key={p.id} className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                  p.isOut
                    ? 'bg-emerald-500/10 border-2 border-emerald-500/30'
                    : isDrawTarget
                      ? 'bg-pink-500/20 ring-2 ring-pink-400 animate-pulse'
                      : 'bg-slate-800/50 border border-slate-700/30'
                }`}
              >
                {p.icon}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5">{p.name}</span>
              {p.isOut ? (
                <span className="text-[10px] text-emerald-400 mt-0.5">Safe!</span>
              ) : (
                <div className="flex -space-x-4 mt-1">
                  {p.hand.map((card, cardIdx) => (
                    <CardView
                      key={card.id}
                      card={card}
                      faceUp={false}
                      size="sm"
                      highlighted={isDrawTarget}
                      onClick={isDrawTarget ? () => handleDrawCard(cardIdx) : undefined}
                      disabled={!isDrawTarget}
                    />
                  ))}
                </div>
              )}
              {p.pairs.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                  {p.pairs.slice(-4).map((rank, i) => (
                    <span key={`${rank}-${i}`} className="text-[9px] text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded">
                      {rank}
                    </span>
                  ))}
                  {p.pairs.length > 4 && (
                    <span className="text-[9px] text-slate-500">+{p.pairs.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Center message */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2">
        <p className="text-sm text-slate-400 text-center px-4">{state.message}</p>

        {isHumanTurn && drawTarget && !drawTarget.isOut && (
          <p className="text-xs text-pink-400 animate-pulse">
            Tap a card from {drawTarget.name}&apos;s hand!
          </p>
        )}

        {/* Pairs collected display */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <span className="text-[10px] text-slate-500">Pairs Collected: {totalPairs}/25</span>
          <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500 rounded-full"
              style={{ width: `${(totalPairs / 25) * 100}%` }}
            />
          </div>
        </div>

        {/* Last drawn card display */}
        {lastDrawn && (
          <div className="mt-2">
            {(() => {
              const card = [...state.players.flatMap(p => p.hand)].find(c => c.id === lastDrawn) ||
                state.players[0].hand.find(c => c.id === lastDrawn)
              if (!card) return null
              return (
                <div className="flex flex-col items-center animate-[cardBounceIn_0.3s_ease-out]">
                  <span className="text-[10px] text-slate-500 mb-1">You drew:</span>
                  <CardView card={card} faceUp size="md" isOldMaid={card.id === state.oldMaidCard.id} />
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Human pairs */}
      {humanPlayer.pairs.length > 0 && (
        <div className="flex gap-1 justify-center px-4 py-1 flex-wrap">
          {humanPlayer.pairs.map((rank, i) => (
            <span key={`${rank}-${i}`} className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
              {rank} pair
            </span>
          ))}
        </div>
      )}

      {/* Player hand */}
      <div className="px-2 pb-4 pt-1">
        <div className="flex justify-center flex-wrap gap-1">
          {humanPlayer.hand.map(card => {
            const isOldMaid = card.id === state.oldMaidCard.id
            return (
              <CardView
                key={card.id}
                card={card}
                faceUp
                size="md"
                isOldMaid={isOldMaid}
              />
            )
          })}
          {humanPlayer.hand.length === 0 && humanPlayer.isOut && (
            <div className="text-center py-4">
              <p className="text-emerald-400 font-bold">You&apos;re safe!</p>
              <p className="text-slate-500 text-xs">No more cards</p>
            </div>
          )}
        </div>
      </div>

      {/* Pair flash */}
      {pairFlash && <PairFlash rank={pairFlash} />}

      {/* Game over overlay */}
      {state.phase === 'game-over' && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-xs">
            {(() => {
              const loser = state.players.find(p => !p.isOut)
              const humanLost = loser?.id === 'human'
              return (
                <>
                  <p className="text-4xl mb-2">{humanLost ? '\u{1F475}' : '\u{1F389}'}</p>
                  <h3 className="text-white font-bold text-xl mb-1">
                    {humanLost ? 'You\'re the Old Maid!' : 'You Win!'}
                  </h3>
                  <p className="text-slate-400 text-sm mb-4">{state.message}</p>
                  <div className="space-y-2 mb-4">
                    {[...state.players]
                      .sort((a, b) => {
                        if (a.isOut && !b.isOut) return -1
                        if (!a.isOut && b.isOut) return 1
                        return b.pairs.length - a.pairs.length
                      })
                      .map((p, i) => (
                        <div
                          key={p.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                            !p.isOut
                              ? 'bg-pink-500/20 ring-1 ring-pink-400/50'
                              : i === 0
                                ? 'bg-emerald-500/20 ring-1 ring-emerald-400/50'
                                : 'bg-slate-800/50'
                          }`}
                        >
                          <span className="text-sm text-slate-300">
                            {!p.isOut ? '\u{1F475}' : i === 0 ? '\u{1F451}' : '\u{2705}'} {p.icon} {p.name}
                          </span>
                          <span className="text-amber-400 font-bold text-sm">{p.pairs.length} pairs</span>
                        </div>
                      ))}
                  </div>
                  <button
                    onClick={handleNewGame}
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-lg font-semibold transition-colors"
                  >
                    Play Again
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* Rules modal */}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      <style>{`
        @keyframes cardBounceIn {
          0% { opacity: 0; transform: scale(0.5) translateY(-10px); }
          60% { transform: scale(1.05) translateY(2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
