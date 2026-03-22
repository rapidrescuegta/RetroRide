// ─── Go Fish – Pure Game Logic ──────────────────────────────────────────────
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
  RANKS,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface GoFishPlayer {
  id: string
  name: string
  icon: string
  hand: Card[]
  books: Rank[]
  isAI: boolean
}

export type GoFishPhase =
  | 'select-rank'      // human picking a card/rank from hand
  | 'select-player'    // human picking which player to ask
  | 'resolving'        // animation / result display
  | 'ai-turn'          // AI is thinking
  | 'game-over'

export interface GoFishEvent {
  type: 'ask' | 'got-cards' | 'go-fish' | 'book' | 'lucky-draw' | 'turn-change'
  playerId: string
  targetId?: string
  rank?: Rank
  count?: number
  message: string
}

export interface GoFishState {
  players: GoFishPlayer[]
  deck: Card[]
  currentPlayerIndex: number
  phase: GoFishPhase
  selectedRank: Rank | null
  lastEvent: GoFishEvent | null
  events: GoFishEvent[]
  gameWinner: string | null
  message: string
  goAgain: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { name: 'Bot Alice', icon: '\u{1F916}' },
  { name: 'Bot Bob', icon: '\u{1F3B0}' },
  { name: 'Bot Carol', icon: '\u{1F3B2}' },
  { name: 'Bot Dave', icon: '\u{1F3AF}' },
  { name: 'Bot Eve', icon: '\u{1F3EA}' },
]

export const RANK_DISPLAY: Record<Rank, string> = {
  '2': '2s', '3': '3s', '4': '4s', '5': '5s', '6': '6s',
  '7': '7s', '8': '8s', '9': '9s', '10': '10s',
  'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings', 'A': 'Aces',
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(numAI: number = 1): GoFishState {
  const totalPlayers = 1 + numAI
  const cardsPerPlayer = totalPlayers <= 3 ? 7 : 5

  let deck = shuffleDeck(createDeck())
  const players: GoFishPlayer[] = []

  // Deal to human
  const { dealt: humanHand, remaining: afterHuman } = dealCards(deck, cardsPerPlayer)
  deck = afterHuman
  players.push({
    id: 'human',
    name: 'You',
    icon: '\u{1F3AE}',
    hand: sortHand(humanHand),
    books: [],
    isAI: false,
  })

  // Deal to AI
  for (let i = 0; i < numAI; i++) {
    const { dealt, remaining } = dealCards(deck, cardsPerPlayer)
    deck = remaining
    players.push({
      id: `ai-${i}`,
      name: AI_PLAYERS[i].name,
      icon: AI_PLAYERS[i].icon,
      hand: sortHand(dealt),
      books: [],
      isAI: true,
    })
  }

  // Check for initial books
  const { updatedPlayers, updatedDeck } = checkAllBooks(players, deck)

  return {
    players: updatedPlayers,
    deck: updatedDeck,
    currentPlayerIndex: 0,
    phase: 'select-rank',
    selectedRank: null,
    lastEvent: null,
    events: [],
    gameWinner: null,
    message: 'Your turn! Tap a card to ask for that rank.',
    goAgain: false,
  }
}

// ─── Book Detection ─────────────────────────────────────────────────────────

function findBooks(hand: Card[]): { books: Rank[]; remaining: Card[] } {
  const rankCounts: Record<string, Card[]> = {}
  hand.forEach(c => {
    if (!rankCounts[c.rank]) rankCounts[c.rank] = []
    rankCounts[c.rank].push(c)
  })

  const books: Rank[] = []
  let remaining = [...hand]

  for (const [rank, cards] of Object.entries(rankCounts)) {
    if (cards.length === 4) {
      books.push(rank as Rank)
      remaining = removeCards(remaining, cards.map(c => c.id))
    }
  }

  return { books, remaining }
}

function checkAllBooks(
  players: GoFishPlayer[],
  deck: Card[]
): { updatedPlayers: GoFishPlayer[]; updatedDeck: Card[] } {
  const updatedPlayers = players.map(p => {
    const { books, remaining } = findBooks(p.hand)
    return { ...p, hand: sortHand(remaining), books: [...p.books, ...books] }
  })
  return { updatedPlayers, updatedDeck: deck }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getRanksInHand(hand: Card[]): Rank[] {
  const ranks = new Set(hand.map(c => c.rank))
  return Array.from(ranks) as Rank[]
}

export function getCardCountByRank(hand: Card[], rank: Rank): number {
  return hand.filter(c => c.rank === rank).length
}

export function totalBooks(state: GoFishState): number {
  return state.players.reduce((sum, p) => sum + p.books.length, 0)
}

function isGameOver(state: GoFishState): boolean {
  return totalBooks(state) >= 13
}

function canPlayerAsk(player: GoFishPlayer): boolean {
  return player.hand.length > 0
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function selectRank(state: GoFishState, rank: Rank): GoFishState {
  if (state.phase !== 'select-rank') return state
  const player = state.players[state.currentPlayerIndex]
  if (!player.hand.some(c => c.rank === rank)) return state

  return {
    ...state,
    selectedRank: rank,
    phase: 'select-player',
    message: `Asking for ${RANK_DISPLAY[rank]}. Tap a player to ask.`,
  }
}

export function cancelRankSelection(state: GoFishState): GoFishState {
  return {
    ...state,
    selectedRank: null,
    phase: 'select-rank',
    message: 'Your turn! Tap a card to ask for that rank.',
  }
}

export function askPlayer(state: GoFishState, targetPlayerId: string): GoFishState {
  if (state.phase !== 'select-player' || !state.selectedRank) return state

  const currentPlayer = state.players[state.currentPlayerIndex]
  const targetIndex = state.players.findIndex(p => p.id === targetPlayerId)
  if (targetIndex === -1 || targetIndex === state.currentPlayerIndex) return state

  const target = state.players[targetIndex]
  const rank = state.selectedRank

  // Find matching cards in target's hand
  const matchingCards = target.hand.filter(c => c.rank === rank)

  if (matchingCards.length > 0) {
    // Target has cards! Transfer them
    const newTargetHand = removeCards(target.hand, matchingCards.map(c => c.id))
    const newCurrentHand = sortHand([...currentPlayer.hand, ...matchingCards.map(c => ({ ...c, faceUp: true }))])

    let newPlayers = state.players.map((p, i) => {
      if (i === state.currentPlayerIndex) return { ...p, hand: newCurrentHand }
      if (i === targetIndex) return { ...p, hand: sortHand(newTargetHand) }
      return p
    })

    // Check for new books
    const { updatedPlayers } = checkAllBooks(newPlayers, state.deck)
    const newBooks = updatedPlayers[state.currentPlayerIndex].books.length - currentPlayer.books.length

    const event: GoFishEvent = {
      type: 'got-cards',
      playerId: currentPlayer.id,
      targetId: target.id,
      rank,
      count: matchingCards.length,
      message: `${currentPlayer.name} got ${matchingCards.length} ${RANK_DISPLAY[rank]} from ${target.name}!`,
    }

    const events = [...state.events, event]

    // Check game over
    const nextState: GoFishState = {
      ...state,
      players: updatedPlayers,
      selectedRank: null,
      lastEvent: event,
      events,
      goAgain: true,
    }

    if (isGameOver(nextState)) {
      return resolveGameOver(nextState)
    }

    // Go again!
    if (!canPlayerAsk(updatedPlayers[state.currentPlayerIndex])) {
      // Player has no cards, try to draw
      if (state.deck.length > 0) {
        return drawIfEmpty(nextState)
      }
      return advanceTurn(nextState)
    }

    return {
      ...nextState,
      phase: currentPlayer.isAI ? 'ai-turn' : 'select-rank',
      message: newBooks > 0
        ? `${currentPlayer.name} completed a book! Go again!`
        : `Got ${matchingCards.length} ${RANK_DISPLAY[rank]}! Go again!`,
    }
  }

  // "Go Fish!" - draw from deck
  const event: GoFishEvent = {
    type: 'go-fish',
    playerId: currentPlayer.id,
    targetId: target.id,
    rank,
    message: `${target.name}: "Go Fish!"`,
  }

  if (state.deck.length === 0) {
    // No deck to draw from, turn passes
    const events = [...state.events, event]
    const nextState: GoFishState = {
      ...state,
      selectedRank: null,
      lastEvent: event,
      events,
      goAgain: false,
    }
    return advanceTurn(nextState)
  }

  // Draw a card
  const drawnCard = { ...state.deck[0], faceUp: true }
  const newDeck = state.deck.slice(1)
  const newHand = sortHand([...currentPlayer.hand, drawnCard])

  let newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
  )

  // Check for books after drawing
  const { updatedPlayers } = checkAllBooks(newPlayers, newDeck)

  const luckyDraw = drawnCard.rank === rank
  const events = [...state.events, event]

  if (luckyDraw) {
    const luckyEvent: GoFishEvent = {
      type: 'lucky-draw',
      playerId: currentPlayer.id,
      rank,
      message: `${currentPlayer.name} drew the ${RANK_DISPLAY[rank]} they asked for! Go again!`,
    }
    events.push(luckyEvent)
  }

  const nextState: GoFishState = {
    ...state,
    players: updatedPlayers,
    deck: newDeck,
    selectedRank: null,
    lastEvent: luckyDraw ? events[events.length - 1] : event,
    events,
    goAgain: luckyDraw,
  }

  if (isGameOver(nextState)) {
    return resolveGameOver(nextState)
  }

  if (luckyDraw) {
    if (!canPlayerAsk(updatedPlayers[state.currentPlayerIndex])) {
      return advanceTurn(nextState)
    }
    return {
      ...nextState,
      phase: currentPlayer.isAI ? 'ai-turn' : 'select-rank',
      message: `Lucky draw! Got the ${RANK_DISPLAY[rank]}! Go again!`,
    }
  }

  return advanceTurn(nextState)
}

function drawIfEmpty(state: GoFishState): GoFishState {
  const player = state.players[state.currentPlayerIndex]
  if (player.hand.length > 0 || state.deck.length === 0) return state

  const drawnCard = { ...state.deck[0], faceUp: true }
  const newDeck = state.deck.slice(1)
  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: [drawnCard] } : p
  )
  const { updatedPlayers } = checkAllBooks(newPlayers, newDeck)

  return { ...state, players: updatedPlayers, deck: newDeck }
}

function advanceTurn(state: GoFishState): GoFishState {
  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length
  let attempts = 0

  // Skip players with no cards and no deck to draw from
  while (attempts < state.players.length) {
    const nextPlayer = state.players[nextIndex]
    if (canPlayerAsk(nextPlayer)) break
    if (state.deck.length > 0) {
      // Draw a card for the player
      const drawnCard = { ...state.deck[0], faceUp: true }
      const newDeck = state.deck.slice(1)
      const newPlayers = state.players.map((p, i) =>
        i === nextIndex ? { ...p, hand: [drawnCard] } : p
      )
      const { updatedPlayers } = checkAllBooks(newPlayers, newDeck)
      return {
        ...state,
        players: updatedPlayers,
        deck: newDeck,
        currentPlayerIndex: nextIndex,
        phase: nextPlayer.isAI ? 'ai-turn' : 'select-rank',
        selectedRank: null,
        goAgain: false,
        message: nextPlayer.isAI ? `${nextPlayer.name} is thinking...` : 'Your turn! Tap a card to ask for that rank.',
      }
    }
    nextIndex = (nextIndex + 1) % state.players.length
    attempts++
  }

  if (attempts >= state.players.length) {
    return resolveGameOver(state)
  }

  const nextPlayer = state.players[nextIndex]
  return {
    ...state,
    currentPlayerIndex: nextIndex,
    phase: nextPlayer.isAI ? 'ai-turn' : 'select-rank',
    selectedRank: null,
    goAgain: false,
    message: nextPlayer.isAI ? `${nextPlayer.name} is thinking...` : 'Your turn! Tap a card to ask for that rank.',
  }
}

function resolveGameOver(state: GoFishState): GoFishState {
  let maxBooks = 0
  let winnerId = state.players[0].id
  state.players.forEach(p => {
    if (p.books.length > maxBooks) {
      maxBooks = p.books.length
      winnerId = p.id
    }
  })

  const winner = state.players.find(p => p.id === winnerId)!
  return {
    ...state,
    phase: 'game-over',
    gameWinner: winnerId,
    message: `${winner.name} wins with ${maxBooks} books!`,
  }
}

// ─── AI Logic ───────────────────────────────────────────────────────────────

export interface AIDecision {
  rank: Rank
  targetId: string
}

export function getAIDecision(
  state: GoFishState,
  difficulty: 'easy' | 'medium' | 'hard'
): AIDecision | null {
  const player = state.players[state.currentPlayerIndex]
  if (player.hand.length === 0) return null

  const ranksInHand = getRanksInHand(player.hand)
  if (ranksInHand.length === 0) return null

  const otherPlayers = state.players.filter((p, i) => i !== state.currentPlayerIndex && p.hand.length > 0)
  if (otherPlayers.length === 0) return null

  let rank: Rank
  let targetId: string

  if (difficulty === 'easy') {
    // Random rank and random target
    rank = ranksInHand[Math.floor(Math.random() * ranksInHand.length)]
    const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)]
    targetId = target.id
  } else if (difficulty === 'medium') {
    // Prefer ranks with more cards
    const rankCounts = ranksInHand.map(r => ({ rank: r, count: getCardCountByRank(player.hand, r) }))
    rankCounts.sort((a, b) => b.count - a.count)
    rank = rankCounts[0].rank
    // Target player with most cards
    const target = [...otherPlayers].sort((a, b) => b.hand.length - a.hand.length)[0]
    targetId = target.id
  } else {
    // Hard: prefer ranks with 3 cards (almost a book), target player with most cards
    const rankCounts = ranksInHand.map(r => ({ rank: r, count: getCardCountByRank(player.hand, r) }))
    rankCounts.sort((a, b) => b.count - a.count)
    rank = rankCounts[0].rank
    // Target player with most cards (most likely to have what we need)
    const target = [...otherPlayers].sort((a, b) => b.hand.length - a.hand.length)[0]
    targetId = target.id
  }

  return { rank, targetId }
}
