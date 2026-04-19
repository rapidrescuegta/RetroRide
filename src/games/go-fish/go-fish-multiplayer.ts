// ─── Go Fish – Multiplayer Game Config ──────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface GoFishMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  books: Record<string, Rank[]>   // playerId -> completed book ranks
  phase: 'asking' | 'game-over'
  message: string
  lastAction: string | null
  lastEvent: GoFishEvent | null
  goAgain: boolean
}

export interface GoFishEvent {
  type: 'got-cards' | 'go-fish' | 'book' | 'lucky-draw'
  playerId: string
  targetId?: string
  rank?: Rank
  count?: number
  message: string
}

export const RANK_DISPLAY: Record<Rank, string> = {
  '2': '2s', '3': '3s', '4': '4s', '5': '5s', '6': '6s',
  '7': '7s', '8': '8s', '9': '9s', '10': '10s',
  'J': 'Jacks', 'Q': 'Queens', 'K': 'Kings', 'A': 'Aces',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function findBooks(hand: Card[]): { bookRanks: Rank[]; remaining: Card[] } {
  const rankCounts: Record<string, Card[]> = {}
  hand.forEach(c => {
    if (!rankCounts[c.rank]) rankCounts[c.rank] = []
    rankCounts[c.rank].push(c)
  })

  const bookRanks: Rank[] = []
  let remaining = [...hand]

  for (const [rank, cards] of Object.entries(rankCounts)) {
    if (cards.length === 4) {
      bookRanks.push(rank as Rank)
      remaining = removeCards(remaining, cards.map(c => c.id))
    }
  }

  return { bookRanks, remaining }
}

function totalBooksCount(books: Record<string, Rank[]>): number {
  return Object.values(books).reduce((sum, b) => sum + b.length, 0)
}

function checkAndApplyBooks(
  hands: Record<string, Card[]>,
  books: Record<string, Rank[]>,
  playerId: string,
): { hands: Record<string, Card[]>; books: Record<string, Rank[]>; newBookRanks: Rank[] } {
  const playerHand = hands[playerId] ?? []
  const { bookRanks, remaining } = findBooks(playerHand)

  const newHands = { ...hands, [playerId]: sortHand(remaining) }
  const newBooks = { ...books, [playerId]: [...(books[playerId] ?? []), ...bookRanks] }

  return { hands: newHands, books: newBooks, newBookRanks: bookRanks }
}

function advanceTurn(
  state: GoFishMultiplayerState,
  hands: Record<string, Card[]>,
): { nextIndex: number; nextPlayerId: string } {
  let nextIndex = (state.currentTurnIndex + 1) % state.playerOrder.length
  let attempts = 0

  // Skip players with no cards and no deck
  while (attempts < state.playerOrder.length) {
    const nextId = state.playerOrder[nextIndex]
    const nextHand = hands[nextId] ?? []
    if (nextHand.length > 0) break
    if (state.deck.length > 0) break // can draw
    nextIndex = (nextIndex + 1) % state.playerOrder.length
    attempts++
  }

  return { nextIndex, nextPlayerId: state.playerOrder[nextIndex] }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const goFishMultiplayer: MultiplayerGameConfig<GoFishMultiplayerState> = {
  gameType: 'go-fish',
  minPlayers: 2,
  maxPlayers: 6,

  initializeGame(players: Player[]) {
    const totalPlayers = players.length
    const cardsPerPlayer = totalPlayers <= 3 ? 7 : 5

    let deck = shuffleDeck(createDeck())
    const hands: Record<string, Card[]> = {}
    const books: Record<string, Rank[]> = {}

    for (const player of players) {
      const { dealt, remaining } = dealCards(deck, cardsPerPlayer)
      deck = remaining
      hands[player.id] = sortHand(dealt)
      books[player.id] = []
    }

    // Check for initial books
    const playerOrder = players.map(p => p.id)
    let allBooks = { ...books }
    let allHands = { ...hands }
    for (const pid of playerOrder) {
      const result = checkAndApplyBooks(allHands, allBooks, pid)
      allHands = result.hands
      allBooks = result.books
    }

    const state: GoFishMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck,
      books: allBooks,
      phase: 'asking',
      message: `${players[0].name}'s turn`,
      lastAction: null,
      lastEvent: null,
      goAgain: false,
    }

    return { state, hands: allHands }
  },

  processAction(
    state: GoFishMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId, data } = action

    if (type !== 'ask-for-rank') {
      return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }

    if (playerId !== state.currentTurnPlayerId) {
      return { state, hands, broadcast: null, error: 'Not your turn' }
    }

    const rank = data.rank as Rank
    const targetId = data.targetId as string

    // Validate
    const playerHand = hands[playerId] ?? []
    if (!playerHand.some(c => c.rank === rank)) {
      return { state, hands, broadcast: null, error: 'You do not have that rank in your hand' }
    }
    if (targetId === playerId) {
      return { state, hands, broadcast: null, error: 'Cannot ask yourself' }
    }
    const targetHand = hands[targetId] ?? []

    const matchingCards = targetHand.filter(c => c.rank === rank)
    let newHands = { ...hands }

    if (matchingCards.length > 0) {
      // Transfer cards
      const newTargetHand = removeCards(targetHand, matchingCards.map(c => c.id))
      const newPlayerHand = sortHand([...playerHand, ...matchingCards.map(c => ({ ...c, faceUp: true }))])
      newHands[playerId] = newPlayerHand
      newHands[targetId] = sortHand(newTargetHand)

      // Check for books
      const bookResult = checkAndApplyBooks(newHands, state.books, playerId)
      newHands = bookResult.hands
      const newBooks = bookResult.books
      const madeBook = bookResult.newBookRanks.length > 0

      const event: GoFishEvent = {
        type: 'got-cards',
        playerId,
        targetId,
        rank,
        count: matchingCards.length,
        message: `Got ${matchingCards.length} ${RANK_DISPLAY[rank]}!`,
      }

      // Check game over (all 13 books collected)
      if (totalBooksCount(newBooks) >= 13) {
        const newState: GoFishMultiplayerState = {
          ...state,
          books: newBooks,
          phase: 'game-over',
          lastEvent: event,
          lastAction: `got ${matchingCards.length} ${RANK_DISPLAY[rank]}`,
          message: 'All books collected!',
          goAgain: false,
        }
        return { state: newState, hands: newHands, broadcast: { ...event, madeBook } }
      }

      // Player goes again if they have cards
      const updatedPlayerHand = newHands[playerId] ?? []
      if (updatedPlayerHand.length === 0 && state.deck.length > 0) {
        // Draw a card since hand is empty
        const drawnCard = { ...state.deck[0], faceUp: true }
        const newDeck = state.deck.slice(1)
        newHands[playerId] = [drawnCard]
        const br = checkAndApplyBooks(newHands, newBooks, playerId)
        newHands = br.hands

        const newState: GoFishMultiplayerState = {
          ...state,
          deck: newDeck,
          books: br.books,
          lastEvent: event,
          lastAction: `got ${matchingCards.length} ${RANK_DISPLAY[rank]}`,
          message: madeBook ? 'Completed a book! Go again!' : `Got ${RANK_DISPLAY[rank]}! Go again!`,
          goAgain: true,
        }
        return { state: newState, hands: newHands, broadcast: { ...event, madeBook } }
      }

      if (updatedPlayerHand.length === 0) {
        // No cards and no deck, advance turn
        const { nextIndex, nextPlayerId } = advanceTurn(state, newHands)
        const newState: GoFishMultiplayerState = {
          ...state,
          currentTurnIndex: nextIndex,
          currentTurnPlayerId: nextPlayerId,
          books: newBooks,
          lastEvent: event,
          lastAction: `got ${matchingCards.length} ${RANK_DISPLAY[rank]}`,
          message: 'Turn passed.',
          goAgain: false,
        }
        return { state: newState, hands: newHands, broadcast: { ...event, madeBook } }
      }

      // Go again!
      const newState: GoFishMultiplayerState = {
        ...state,
        books: newBooks,
        lastEvent: event,
        lastAction: `got ${matchingCards.length} ${RANK_DISPLAY[rank]}`,
        message: madeBook ? 'Completed a book! Go again!' : `Got ${RANK_DISPLAY[rank]}! Go again!`,
        goAgain: true,
      }
      return { state: newState, hands: newHands, broadcast: { ...event, madeBook } }
    }

    // GO FISH! — draw from deck
    const goFishEvent: GoFishEvent = {
      type: 'go-fish',
      playerId,
      targetId,
      rank,
      message: 'Go Fish!',
    }

    if (state.deck.length === 0) {
      // No deck, turn passes
      const { nextIndex, nextPlayerId } = advanceTurn(state, newHands)
      const newState: GoFishMultiplayerState = {
        ...state,
        currentTurnIndex: nextIndex,
        currentTurnPlayerId: nextPlayerId,
        lastEvent: goFishEvent,
        lastAction: 'Go Fish! (no cards to draw)',
        message: 'Go Fish! No cards to draw.',
        goAgain: false,
      }
      return { state: newState, hands: newHands, broadcast: goFishEvent }
    }

    // Draw a card
    const drawnCard = { ...state.deck[0], faceUp: true }
    const newDeck = state.deck.slice(1)
    newHands[playerId] = sortHand([...playerHand, drawnCard])

    // Check for books after drawing
    const bookResult = checkAndApplyBooks(newHands, state.books, playerId)
    newHands = bookResult.hands
    const newBooks = bookResult.books

    // Check game over
    if (totalBooksCount(newBooks) >= 13) {
      const newState: GoFishMultiplayerState = {
        ...state,
        deck: newDeck,
        books: newBooks,
        phase: 'game-over',
        lastEvent: goFishEvent,
        lastAction: 'Go Fish!',
        message: 'All books collected!',
        goAgain: false,
      }
      return { state: newState, hands: newHands, broadcast: goFishEvent }
    }

    const luckyDraw = drawnCard.rank === rank
    if (luckyDraw) {
      // Go again!
      const luckyEvent: GoFishEvent = {
        type: 'lucky-draw',
        playerId,
        rank,
        message: `Lucky draw! Got the ${RANK_DISPLAY[rank]}!`,
      }
      const newState: GoFishMultiplayerState = {
        ...state,
        deck: newDeck,
        books: newBooks,
        lastEvent: luckyEvent,
        lastAction: `Lucky draw!`,
        message: `Lucky draw! Go again!`,
        goAgain: true,
      }
      return { state: newState, hands: newHands, broadcast: luckyEvent }
    }

    // Turn passes
    const { nextIndex, nextPlayerId } = advanceTurn(
      { ...state, deck: newDeck },
      newHands,
    )
    const newState: GoFishMultiplayerState = {
      ...state,
      deck: newDeck,
      currentTurnIndex: nextIndex,
      currentTurnPlayerId: nextPlayerId,
      books: newBooks,
      lastEvent: goFishEvent,
      lastAction: 'Go Fish!',
      message: 'Go Fish!',
      goAgain: false,
    }
    return { state: newState, hands: newHands, broadcast: goFishEvent }
  },

  checkGameOver(state: GoFishMultiplayerState) {
    if (totalBooksCount(state.books) >= 13 || state.phase === 'game-over') {
      // Find winner (most books)
      let maxBooks = 0
      let winnerId = state.playerOrder[0]
      const scores: Record<string, number> = {}

      for (const [pid, playerBooks] of Object.entries(state.books)) {
        scores[pid] = playerBooks.length
        if (playerBooks.length > maxBooks) {
          maxBooks = playerBooks.length
          winnerId = pid
        }
      }

      return { isOver: true, scores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state: GoFishMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      deckSize: state.deck.length,
      books: state.books,
      phase: state.phase,
      message: state.message,
      lastAction: state.lastAction,
      lastEvent: state.lastEvent,
      goAgain: state.goAgain,
    }
  },
}
