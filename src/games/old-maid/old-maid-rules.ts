// ─── Old Maid – Pure Game Logic ─────────────────────────────────────────────
// No React, no side effects. All state transitions are pure functions.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OldMaidPlayer {
  id: string
  name: string
  icon: string
  hand: Card[]
  pairs: Rank[]
  isAI: boolean
  isOut: boolean // finished (no cards left)
}

export type OldMaidPhase =
  | 'pick-card'     // current player picks a card from another player
  | 'ai-turn'       // AI is thinking
  | 'game-over'

export interface OldMaidEvent {
  type: 'pair-found' | 'card-picked' | 'player-out'
  playerId: string
  message: string
}

export interface OldMaidState {
  players: OldMaidPlayer[]
  currentPlayerIndex: number
  targetPlayerIndex: number // the player being picked from
  phase: OldMaidPhase
  events: OldMaidEvent[]
  lastEvent: OldMaidEvent | null
  gameWinner: string | null // winner = everyone except the old maid holder
  oldMaidHolder: string | null
  message: string
  turnSeq: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { name: 'Bot Alice', icon: '\u{1F916}' },
  { name: 'Bot Bob', icon: '\u{1F3B0}' },
  { name: 'Bot Carol', icon: '\u{1F3B2}' },
]

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(numAI: number = 2): OldMaidState {
  // Create deck, remove one Queen to create the "Old Maid"
  let deck = createDeck()
  deck = deck.filter(c => !(c.rank === 'Q' && c.suit === 'clubs'))
  deck = shuffleDeck(deck)

  const totalPlayers = 1 + numAI
  const players: OldMaidPlayer[] = []

  // Deal all cards evenly (some may have one more)
  const hands: Card[][] = Array.from({ length: totalPlayers }, () => [])
  deck.forEach((card, i) => {
    hands[i % totalPlayers].push({ ...card, faceUp: true })
  })

  // Human player
  players.push({
    id: 'human',
    name: 'You',
    icon: '\u{1F3AE}',
    hand: sortHand(hands[0]),
    pairs: [],
    isAI: false,
    isOut: false,
  })

  // AI players
  for (let i = 0; i < numAI; i++) {
    players.push({
      id: `ai-${i}`,
      name: AI_PLAYERS[i].name,
      icon: AI_PLAYERS[i].icon,
      hand: sortHand(hands[i + 1]),
      pairs: [],
      isAI: true,
      isOut: false,
    })
  }

  // Remove initial pairs from all hands
  const updatedPlayers = players.map(p => {
    const { pairs, remaining } = removePairs(p.hand)
    return { ...p, hand: sortHand(remaining), pairs }
  })

  // Mark players with no cards as out
  const finalPlayers = updatedPlayers.map(p => ({
    ...p,
    isOut: p.hand.length === 0,
  }))

  // Find first active player
  const firstActive = findNextActivePlayer(0, finalPlayers)

  return {
    players: finalPlayers,
    currentPlayerIndex: firstActive,
    targetPlayerIndex: findNextActivePlayer((firstActive + 1) % finalPlayers.length, finalPlayers, firstActive),
    phase: finalPlayers[firstActive].isAI ? 'ai-turn' : 'pick-card',
    events: [],
    lastEvent: null,
    gameWinner: null,
    oldMaidHolder: null,
    message: finalPlayers[firstActive].isAI
      ? `${finalPlayers[firstActive].name} is picking...`
      : 'Pick a card from the other player!',
    turnSeq: 0,
  }
}

// ─── Pair Detection ─────────────────────────────────────────────────────────

function removePairs(hand: Card[]): { pairs: Rank[]; remaining: Card[] } {
  const rankGroups: Record<string, Card[]> = {}
  hand.forEach(c => {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = []
    rankGroups[c.rank].push(c)
  })

  const pairs: Rank[] = []
  let remaining = [...hand]

  for (const [rank, cards] of Object.entries(rankGroups)) {
    while (cards.length >= 2) {
      const pair = cards.splice(0, 2)
      pairs.push(rank as Rank)
      remaining = removeCards(remaining, pair.map(c => c.id))
    }
  }

  return { pairs, remaining }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findNextActivePlayer(start: number, players: OldMaidPlayer[], exclude?: number): number {
  const n = players.length
  for (let i = 0; i < n; i++) {
    const idx = (start + i) % n
    if (idx === exclude) continue
    if (!players[idx].isOut && players[idx].hand.length > 0) return idx
  }
  return start
}

function countActivePlayers(players: OldMaidPlayer[]): number {
  return players.filter(p => !p.isOut && p.hand.length > 0).length
}

function checkGameOver(state: OldMaidState): OldMaidState {
  const active = state.players.filter(p => !p.isOut && p.hand.length > 0)

  if (active.length <= 1) {
    // The last person with cards is the Old Maid holder
    const loser = active[0]
    return {
      ...state,
      phase: 'game-over',
      oldMaidHolder: loser?.id || null,
      gameWinner: 'everyone-else',
      message: loser
        ? `${loser.name} is stuck with the Old Maid!`
        : 'Game over!',
    }
  }

  return state
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function pickCard(state: OldMaidState, cardIndex: number): OldMaidState {
  const picker = state.players[state.currentPlayerIndex]
  const target = state.players[state.targetPlayerIndex]

  if (cardIndex < 0 || cardIndex >= target.hand.length) return state

  const pickedCard = { ...target.hand[cardIndex], faceUp: true }
  const newTargetHand = [...target.hand]
  newTargetHand.splice(cardIndex, 1)

  const newPickerHand = sortHand([...picker.hand, pickedCard])

  // Check for new pairs
  const { pairs: newPairs, remaining } = removePairs(newPickerHand)

  const events: OldMaidEvent[] = [...state.events]
  events.push({
    type: 'card-picked',
    playerId: picker.id,
    message: `${picker.name} picked a card from ${target.name}`,
  })

  if (newPairs.length > 0) {
    events.push({
      type: 'pair-found',
      playerId: picker.id,
      message: `${picker.name} found a pair of ${newPairs.join(', ')}!`,
    })
  }

  let newPlayers = state.players.map((p, i) => {
    if (i === state.currentPlayerIndex) {
      return { ...p, hand: sortHand(remaining), pairs: [...p.pairs, ...newPairs] }
    }
    if (i === state.targetPlayerIndex) {
      return { ...p, hand: sortHand(newTargetHand) }
    }
    return p
  })

  // Mark players with no cards as out
  newPlayers = newPlayers.map(p => ({
    ...p,
    isOut: p.isOut || p.hand.length === 0,
  }))

  // Check player out events
  if (newPlayers[state.currentPlayerIndex].hand.length === 0 && !state.players[state.currentPlayerIndex].isOut) {
    events.push({
      type: 'player-out',
      playerId: picker.id,
      message: `${picker.name} is done! No more cards.`,
    })
  }
  if (newPlayers[state.targetPlayerIndex].hand.length === 0 && !state.players[state.targetPlayerIndex].isOut) {
    events.push({
      type: 'player-out',
      playerId: target.id,
      message: `${target.name} is done! No more cards.`,
    })
  }

  let nextState: OldMaidState = {
    ...state,
    players: newPlayers,
    events,
    lastEvent: events[events.length - 1],
    turnSeq: state.turnSeq + 1,
  }

  // Check game over
  nextState = checkGameOver(nextState)
  if (nextState.phase === 'game-over') return nextState

  // Advance to next player
  const nextIdx = findNextActivePlayer(
    (state.currentPlayerIndex + 1) % newPlayers.length,
    newPlayers
  )
  const nextTarget = findNextActivePlayer(
    (nextIdx + 1) % newPlayers.length,
    newPlayers,
    nextIdx
  )

  const nextPlayer = newPlayers[nextIdx]

  return {
    ...nextState,
    currentPlayerIndex: nextIdx,
    targetPlayerIndex: nextTarget,
    phase: nextPlayer.isAI ? 'ai-turn' : 'pick-card',
    message: nextPlayer.isAI
      ? `${nextPlayer.name} is picking...`
      : `Pick a card from ${newPlayers[nextTarget].name}!`,
  }
}

// ─── AI Logic ───────────────────────────────────────────────────────────────

export function getAIPick(
  state: OldMaidState,
  _difficulty: 'easy' | 'medium' | 'hard'
): number {
  const target = state.players[state.targetPlayerIndex]
  // AI picks a random card from target's hand
  return Math.floor(Math.random() * target.hand.length)
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export function getScore(state: OldMaidState): number {
  const humanPlayer = state.players[0]
  if (state.oldMaidHolder === humanPlayer.id) return 0
  // Score based on pairs collected
  return humanPlayer.pairs.length * 10
}
