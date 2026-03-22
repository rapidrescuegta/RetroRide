// ─── Rummy 500 Game Logic ────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Card,
  Rank,
  createDeck,
  shuffleDeck,
  dealCards,
  removeCards,
  isValidMeld,
  isSet,
  isRun,
  getCardValue,
  sortHand,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RummyMeld {
  id: string
  cards: Card[]
  type: 'set' | 'run'
  owner: string // who created it
}

export interface RummyState {
  deck: Card[]
  discardPile: Card[]
  hands: Record<string, Card[]> // playerId -> their cards
  melds: RummyMeld[]            // all melds on the table
  currentTurn: string           // playerId
  turnPhase: 'draw' | 'meld' | 'discard' // what the current player must do
  players: string[]             // player order
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  roundNumber: number
  gameOver: boolean
  winner: string | null
  mustMeldCard: Card | null     // when picking from discard, must meld this card
  roundOver: boolean
}

// ─── Rank ordering for runs ─────────────────────────────────────────────────

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

let meldCounter = 0

function generateMeldId(): string {
  return `meld-${Date.now()}-${++meldCounter}`
}

function cardScore(card: Card): number {
  return getCardValue(card, 'rummy')
}

function handScore(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardScore(c), 0)
}

// ─── Initialize Round ──────────────────────────────────────────────────────

export function initRound(
  playerIds: string[],
  cumulativeScores?: Record<string, number>,
  roundNumber?: number
): RummyState {
  const deck = shuffleDeck(createDeck())
  const cardsPerPlayer = playerIds.length === 2 ? 13 : 7
  const hands: Record<string, Card[]> = {}
  let remaining = deck

  for (const pid of playerIds) {
    const { dealt, remaining: rest } = dealCards(remaining, cardsPerPlayer)
    hands[pid] = sortHand(dealt)
    remaining = rest
  }

  // Flip first card to discard pile
  const topCard = { ...remaining[0], faceUp: true }
  const discardPile = [topCard]
  remaining = remaining.slice(1)

  const scores: Record<string, number> = {}
  for (const pid of playerIds) {
    scores[pid] = cumulativeScores?.[pid] ?? 0
  }

  return {
    deck: remaining,
    discardPile,
    hands,
    melds: [],
    currentTurn: playerIds[0],
    turnPhase: 'draw',
    players: playerIds,
    roundScores: Object.fromEntries(playerIds.map(p => [p, 0])),
    cumulativeScores: scores,
    roundNumber: roundNumber ?? 1,
    gameOver: false,
    winner: null,
    mustMeldCard: null,
    roundOver: false,
  }
}

// ─── Draw from Deck ─────────────────────────────────────────────────────────

export function drawFromDeck(state: RummyState, playerId: string): RummyState {
  if (state.currentTurn !== playerId || state.turnPhase !== 'draw') return state
  if (state.deck.length === 0) {
    // Reshuffle discard pile into deck, keeping top card
    if (state.discardPile.length <= 1) return state // stuck
    const top = state.discardPile[state.discardPile.length - 1]
    const rest = shuffleDeck(
      state.discardPile.slice(0, -1).map(c => ({ ...c, faceUp: false }))
    )
    return drawFromDeck(
      { ...state, deck: rest, discardPile: [top] },
      playerId
    )
  }

  const drawn = { ...state.deck[0], faceUp: true }
  const newHand = sortHand([...state.hands[playerId], drawn])
  return {
    ...state,
    deck: state.deck.slice(1),
    hands: { ...state.hands, [playerId]: newHand },
    turnPhase: 'meld',
  }
}

// ─── Draw from Discard Pile ─────────────────────────────────────────────────

export function drawFromDiscard(
  state: RummyState,
  playerId: string,
  cardIndex: number
): RummyState {
  if (state.currentTurn !== playerId || state.turnPhase !== 'draw') return state
  if (cardIndex < 0 || cardIndex >= state.discardPile.length) return state

  // Pick up the target card and everything above it
  const pickedCards = state.discardPile.slice(cardIndex).map(c => ({ ...c, faceUp: true }))
  const remainingDiscard = state.discardPile.slice(0, cardIndex)
  const targetCard = pickedCards[0] // the card they specifically wanted

  const newHand = sortHand([...state.hands[playerId], ...pickedCards])
  return {
    ...state,
    discardPile: remainingDiscard,
    hands: { ...state.hands, [playerId]: newHand },
    turnPhase: 'meld',
    mustMeldCard: targetCard, // must use this in a meld
  }
}

// ─── Play a Meld ────────────────────────────────────────────────────────────

export function playMeld(
  state: RummyState,
  playerId: string,
  cardIds: string[]
): { state: RummyState; error?: string } {
  if (state.currentTurn !== playerId || state.turnPhase !== 'draw') {
    if (state.turnPhase !== 'meld' && state.turnPhase !== 'discard') {
      return { state, error: 'Not your turn or wrong phase' }
    }
  }
  if (state.turnPhase === 'draw') {
    return { state, error: 'Draw a card first' }
  }

  const hand = state.hands[playerId]
  const meldCards = cardIds
    .map(id => hand.find(c => c.id === id))
    .filter((c): c is Card => c !== undefined)

  if (meldCards.length !== cardIds.length) {
    return { state, error: 'Some cards not found in hand' }
  }

  if (!isValidMeld(meldCards)) {
    return { state, error: 'Not a valid meld (need 3+ cards forming a set or run)' }
  }

  const meldType: 'set' | 'run' = isSet(meldCards) ? 'set' : 'run'
  const newMeld: RummyMeld = {
    id: generateMeldId(),
    cards: meldType === 'run' ? sortRunCards(meldCards) : meldCards,
    type: meldType,
    owner: playerId,
  }

  const newHand = removeCards(hand, cardIds)
  const meldScore = meldCards.reduce((sum, c) => sum + cardScore(c), 0)

  // Check if mustMeldCard requirement is satisfied
  let newMustMeld = state.mustMeldCard
  if (newMustMeld && cardIds.includes(newMustMeld.id)) {
    newMustMeld = null
  }

  const newState: RummyState = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    melds: [...state.melds, newMeld],
    roundScores: {
      ...state.roundScores,
      [playerId]: (state.roundScores[playerId] || 0) + meldScore,
    },
    mustMeldCard: newMustMeld,
    turnPhase: 'meld', // can continue melding or move to discard
  }

  // Check if player went out
  if (newHand.length === 0) {
    return { state: endRound(newState, playerId) }
  }

  return { state: newState }
}

// ─── Lay Off ────────────────────────────────────────────────────────────────

export function layOff(
  state: RummyState,
  playerId: string,
  cardId: string,
  meldId: string
): { state: RummyState; error?: string } {
  if (state.currentTurn !== playerId) {
    return { state, error: 'Not your turn' }
  }
  if (state.turnPhase === 'draw') {
    return { state, error: 'Draw a card first' }
  }

  const hand = state.hands[playerId]
  const card = hand.find(c => c.id === cardId)
  if (!card) return { state, error: 'Card not in hand' }

  const meldIdx = state.melds.findIndex(m => m.id === meldId)
  if (meldIdx === -1) return { state, error: 'Meld not found' }

  const meld = state.melds[meldIdx]
  const testCards = [...meld.cards, card]

  // Validate the extended meld
  if (meld.type === 'set') {
    if (!isSet(testCards)) {
      return { state, error: 'Card does not fit this set' }
    }
  } else {
    if (!isRun(testCards)) {
      return { state, error: 'Card does not extend this run' }
    }
  }

  const updatedMeld: RummyMeld = {
    ...meld,
    cards: meld.type === 'run' ? sortRunCards(testCards) : testCards,
  }

  const newMelds = [...state.melds]
  newMelds[meldIdx] = updatedMeld

  const newHand = removeCards(hand, [cardId])
  const points = cardScore(card)

  // Check mustMeldCard
  let newMustMeld = state.mustMeldCard
  if (newMustMeld && cardId === newMustMeld.id) {
    newMustMeld = null
  }

  const newState: RummyState = {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    melds: newMelds,
    roundScores: {
      ...state.roundScores,
      [playerId]: (state.roundScores[playerId] || 0) + points,
    },
    mustMeldCard: newMustMeld,
  }

  if (newHand.length === 0) {
    return { state: endRound(newState, playerId) }
  }

  return { state: newState }
}

// ─── Discard ────────────────────────────────────────────────────────────────

export function discard(
  state: RummyState,
  playerId: string,
  cardId: string
): RummyState {
  if (state.currentTurn !== playerId) return state
  if (state.turnPhase === 'draw') return state

  // Must meld the picked discard card before discarding
  if (state.mustMeldCard) return state

  const hand = state.hands[playerId]
  const card = hand.find(c => c.id === cardId)
  if (!card) return state

  const newHand = removeCards(hand, [cardId])
  const newDiscard = [...state.discardPile, { ...card, faceUp: true }]

  // Check if going out (hand now empty after discard)
  if (newHand.length === 0) {
    const newState: RummyState = {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      discardPile: newDiscard,
    }
    return endRound(newState, playerId)
  }

  // Advance to next player
  const nextPlayer = getNextPlayer(state.players, playerId)

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    discardPile: newDiscard,
    currentTurn: nextPlayer,
    turnPhase: 'draw',
    mustMeldCard: null,
  }
}

// ─── End Round ──────────────────────────────────────────────────────────────

function endRound(state: RummyState, goOutPlayer: string): RummyState {
  const roundScores = calculateRoundScores(state)

  const newCumulative: Record<string, number> = {}
  for (const pid of state.players) {
    newCumulative[pid] = (state.cumulativeScores[pid] || 0) + roundScores[pid]
  }

  const { gameOver, winner } = checkGameOverFromScores(newCumulative)

  return {
    ...state,
    roundScores,
    cumulativeScores: newCumulative,
    gameOver,
    winner,
    roundOver: true,
  }
}

// ─── Score Calculations ─────────────────────────────────────────────────────

export function calculateRoundScores(state: RummyState): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const pid of state.players) {
    const meldPoints = state.roundScores[pid] || 0
    const handPenalty = handScore(state.hands[pid])
    scores[pid] = meldPoints - handPenalty
  }
  return scores
}

export function checkGameOver(state: RummyState): { gameOver: boolean; winner: string | null } {
  return checkGameOverFromScores(state.cumulativeScores)
}

function checkGameOverFromScores(scores: Record<string, number>): { gameOver: boolean; winner: string | null } {
  let highScore = -Infinity
  let winner: string | null = null

  for (const [pid, score] of Object.entries(scores)) {
    if (score >= 500 && score > highScore) {
      highScore = score
      winner = pid
    }
  }

  return { gameOver: winner !== null, winner }
}

// ─── Can Go Out ─────────────────────────────────────────────────────────────

export function canGoOut(state: RummyState, playerId: string): boolean {
  return state.hands[playerId].length === 0
}

// ─── Meld Validation ────────────────────────────────────────────────────────

export function validateMeld(cards: Card[]): { valid: boolean; type: 'set' | 'run' | null; error?: string } {
  if (cards.length < 3) {
    return { valid: false, type: null, error: 'Need at least 3 cards' }
  }
  if (isSet(cards)) return { valid: true, type: 'set' }
  if (isRun(cards)) return { valid: true, type: 'run' }
  return { valid: false, type: null, error: 'Cards must form a set (same rank) or run (consecutive same suit)' }
}

// ─── Get Valid Layoffs ──────────────────────────────────────────────────────

export function getValidLayoffs(state: RummyState, card: Card): string[] {
  const validMeldIds: string[] = []

  for (const meld of state.melds) {
    const testCards = [...meld.cards, card]
    if (meld.type === 'set' && isSet(testCards)) {
      validMeldIds.push(meld.id)
    } else if (meld.type === 'run' && isRun(testCards)) {
      validMeldIds.push(meld.id)
    }
  }

  return validMeldIds
}

// ─── AI Player ──────────────────────────────────────────────────────────────

export function playAITurn(state: RummyState): RummyState {
  const playerId = state.currentTurn
  let s = state

  // 1. Draw phase — draw from deck (simple AI doesn't pick from discard)
  s = drawFromDeck(s, playerId)

  // 2. Meld phase — check for valid melds in hand
  s = aiAttemptMelds(s, playerId)

  // 3. Attempt layoffs
  s = aiAttemptLayoffs(s, playerId)

  // 4. If round ended during melding, return
  if (s.roundOver || s.gameOver) return s

  // 5. Discard highest value card
  const hand = s.hands[playerId]
  if (hand.length === 0) return s

  const sorted = [...hand].sort((a, b) => cardScore(b) - cardScore(a))
  s = discard(s, playerId, sorted[0].id)

  return s
}

function aiAttemptMelds(state: RummyState, playerId: string): RummyState {
  let s = state
  let foundMeld = true

  while (foundMeld) {
    foundMeld = false
    const hand = s.hands[playerId]
    if (hand.length < 3) break

    // Try to find sets
    const rankGroups = groupByRank(hand)
    for (const cards of Object.values(rankGroups)) {
      if (cards.length >= 3) {
        const meldCards = cards.slice(0, Math.min(4, cards.length))
        const result = playMeld(s, playerId, meldCards.map(c => c.id))
        if (!result.error) {
          s = result.state
          foundMeld = true
          if (s.roundOver || s.gameOver) return s
          break
        }
      }
    }
    if (foundMeld) continue

    // Try to find runs
    const suitGroups = groupBySuit(hand)
    for (const cards of Object.values(suitGroups)) {
      if (cards.length < 3) continue
      const sorted = [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank])
      // Find consecutive sequences
      for (let i = 0; i <= sorted.length - 3; i++) {
        for (let len = sorted.length; len >= 3; len--) {
          if (i + len > sorted.length) continue
          const run = sorted.slice(i, i + len)
          const result = playMeld(s, playerId, run.map(c => c.id))
          if (!result.error) {
            s = result.state
            foundMeld = true
            if (s.roundOver || s.gameOver) return s
            break
          }
        }
        if (foundMeld) break
      }
      if (foundMeld) break
    }
  }

  return s
}

function aiAttemptLayoffs(state: RummyState, playerId: string): RummyState {
  let s = state
  let foundLayoff = true

  while (foundLayoff) {
    foundLayoff = false
    const hand = s.hands[playerId]
    if (hand.length === 0) break

    for (const card of hand) {
      const validMelds = getValidLayoffs(s, card)
      if (validMelds.length > 0) {
        const result = layOff(s, playerId, card.id, validMelds[0])
        if (!result.error) {
          s = result.state
          foundLayoff = true
          if (s.roundOver || s.gameOver) return s
          break
        }
      }
    }
  }

  return s
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function getNextPlayer(players: string[], currentPlayer: string): string {
  const idx = players.indexOf(currentPlayer)
  return players[(idx + 1) % players.length]
}

function groupByRank(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {}
  for (const c of cards) {
    if (!groups[c.rank]) groups[c.rank] = []
    groups[c.rank].push(c)
  }
  return groups
}

function groupBySuit(cards: Card[]): Record<string, Card[]> {
  const groups: Record<string, Card[]> = {}
  for (const c of cards) {
    if (!groups[c.suit]) groups[c.suit] = []
    groups[c.suit].push(c)
  }
  return groups
}

function sortRunCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    // Handle ace-low: if we have A-2-3, ace should come first
    const aVal = RANK_ORDER[a.rank]
    const bVal = RANK_ORDER[b.rank]
    return aVal - bVal
  })
}
