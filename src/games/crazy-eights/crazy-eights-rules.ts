// ─── Crazy Eights – Pure Game Logic ─────────────────────────────────────────
// No React, no side effects. All state transitions are pure functions.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Suit,
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCards,
  SUITS,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrazyEightsPlayer {
  id: string
  name: string
  icon: string
  hand: Card[]
  score: number
  isAI: boolean
}

export interface CrazyEightsState {
  players: CrazyEightsPlayer[]
  deck: Card[]
  discardPile: Card[]
  currentPlayerIndex: number
  currentSuit: Suit // the required suit (may differ from top card if an 8 was played)
  phase: 'playing' | 'choosing-suit' | 'round-over' | 'game-over'
  roundWinner: string | null
  gameWinner: string | null
  targetScore: number
  message: string
  lastPlayedEight: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { name: 'Bot Alice', icon: '\u{1F916}' },
  { name: 'Bot Bob', icon: '\u{1F3B0}' },
  { name: 'Bot Carol', icon: '\u{1F3B2}' },
  { name: 'Bot Dave', icon: '\u{1F3AF}' },
  { name: 'Bot Eve', icon: '\u{1F3EA}' },
]

export { SUITS, SUIT_SYMBOLS }

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(numAI: number = 1): CrazyEightsState {
  const totalPlayers = 1 + numAI
  const cardsPerPlayer = totalPlayers === 2 ? 7 : 5

  let deck = shuffleDeck(createDeck())

  // Deal to human player
  const players: CrazyEightsPlayer[] = []
  const { dealt: humanHand, remaining: afterHuman } = dealCards(deck, cardsPerPlayer)
  deck = afterHuman
  players.push({
    id: 'human',
    name: 'You',
    icon: '\u{1F3AE}',
    hand: sortHand(humanHand),
    score: 0,
    isAI: false,
  })

  // Deal to AI players
  for (let i = 0; i < numAI; i++) {
    const { dealt, remaining } = dealCards(deck, cardsPerPlayer)
    deck = remaining
    players.push({
      id: `ai-${i}`,
      name: AI_PLAYERS[i].name,
      icon: AI_PLAYERS[i].icon,
      hand: sortHand(dealt),
      score: 0,
      isAI: true,
    })
  }

  // Flip the top card to start the discard pile
  // If it's an 8, keep drawing until we get a non-8
  let startCard = deck[0]
  deck = deck.slice(1)
  while (startCard.rank === '8') {
    deck.push(startCard)
    deck = shuffleDeck(deck)
    startCard = deck[0]
    deck = deck.slice(1)
  }
  startCard = { ...startCard, faceUp: true }

  return {
    players,
    deck,
    discardPile: [startCard],
    currentPlayerIndex: 0,
    currentSuit: startCard.suit,
    phase: 'playing',
    roundWinner: null,
    gameWinner: null,
    targetScore: 200,
    message: 'Your turn! Play a matching card or draw.',
    lastPlayedEight: false,
  }
}

// ─── Card Scoring ───────────────────────────────────────────────────────────

export function cardPoints(card: Card): number {
  if (card.rank === '8') return 50
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  if (card.rank === 'A') return 1
  return card.value
}

export function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0)
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function canPlayCard(card: Card, topCard: Card, requiredSuit: Suit): boolean {
  // 8s are always playable
  if (card.rank === '8') return true
  // Match suit or rank
  if (card.suit === requiredSuit) return true
  if (card.rank === topCard.rank) return true
  return false
}

export function getPlayableCards(hand: Card[], topCard: Card, requiredSuit: Suit): Card[] {
  return hand.filter(c => canPlayCard(c, topCard, requiredSuit))
}

export function hasPlayableCard(hand: Card[], topCard: Card, requiredSuit: Suit): boolean {
  return hand.some(c => canPlayCard(c, topCard, requiredSuit))
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function playCard(state: CrazyEightsState, cardId: string): CrazyEightsState {
  const player = state.players[state.currentPlayerIndex]
  const card = player.hand.find(c => c.id === cardId)
  if (!card) return state

  const topCard = state.discardPile[state.discardPile.length - 1]
  if (!canPlayCard(card, topCard, state.currentSuit)) return state

  const newHand = removeCards(player.hand, [cardId])
  const playedCard = { ...card, faceUp: true }

  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: sortHand(newHand) } : p
  )

  // Check if player played an 8 => must choose suit
  if (card.rank === '8') {
    return {
      ...state,
      players: newPlayers,
      discardPile: [...state.discardPile, playedCard],
      phase: 'choosing-suit',
      lastPlayedEight: true,
      message: player.isAI
        ? `${player.name} played an 8!`
        : 'Choose a suit!',
    }
  }

  // Check if player went out
  if (newHand.length === 0) {
    return resolveRoundEnd(state, newPlayers, playedCard)
  }

  // Advance turn
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
  const nextPlayer = newPlayers[nextIndex]

  return {
    ...state,
    players: newPlayers,
    discardPile: [...state.discardPile, playedCard],
    currentPlayerIndex: nextIndex,
    currentSuit: playedCard.suit,
    lastPlayedEight: false,
    message: nextPlayer.isAI
      ? `${nextPlayer.name} is thinking...`
      : 'Your turn! Play a matching card or draw.',
  }
}

export function chooseSuit(state: CrazyEightsState, suit: Suit): CrazyEightsState {
  const player = state.players[state.currentPlayerIndex]

  // Check if player went out
  if (player.hand.length === 0) {
    return resolveRoundEnd(state, state.players, state.discardPile[state.discardPile.length - 1])
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
  const nextPlayer = state.players[nextIndex]

  return {
    ...state,
    currentSuit: suit,
    currentPlayerIndex: nextIndex,
    phase: 'playing',
    lastPlayedEight: false,
    message: nextPlayer.isAI
      ? `${player.name} chose ${SUIT_SYMBOLS[suit]}. ${nextPlayer.name} is thinking...`
      : `${player.name} chose ${SUIT_SYMBOLS[suit]}. Your turn!`,
  }
}

export function drawCard(state: CrazyEightsState): CrazyEightsState {
  if (state.deck.length === 0) {
    // Reshuffle discard pile (keep top card)
    if (state.discardPile.length <= 1) {
      // No cards to reshuffle, player must pass
      return pass(state)
    }
    const topCard = state.discardPile[state.discardPile.length - 1]
    const reshuffled = shuffleDeck(
      state.discardPile.slice(0, -1).map(c => ({ ...c, faceUp: false }))
    )
    return {
      ...state,
      deck: reshuffled,
      discardPile: [topCard],
      message: 'Deck reshuffled from discard pile!',
    }
  }

  const drawnCard = { ...state.deck[0], faceUp: true }
  const newDeck = state.deck.slice(1)
  const player = state.players[state.currentPlayerIndex]
  const newHand = sortHand([...player.hand, drawnCard])

  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
  )

  const topCard = state.discardPile[state.discardPile.length - 1]

  // If the drawn card is playable, the player can now play it (but doesn't have to)
  // For AI, we auto-check. For human, just update the hand.
  if (!hasPlayableCard(newHand, topCard, state.currentSuit) && newDeck.length === 0) {
    // Drew but still can't play and deck empty => pass
    const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
    const nextPlayer = newPlayers[nextIndex]
    return {
      ...state,
      players: newPlayers,
      deck: newDeck,
      currentPlayerIndex: nextIndex,
      message: nextPlayer.isAI
        ? `${player.name} drew and passed. ${nextPlayer.name} is thinking...`
        : `${player.name} drew and passed. Your turn!`,
    }
  }

  return {
    ...state,
    players: newPlayers,
    deck: newDeck,
    message: player.isAI
      ? `${player.name} drew a card.`
      : `Drew ${drawnCard.rank}${SUIT_SYMBOLS[drawnCard.suit]}. Play a card or draw again.`,
  }
}

export function pass(state: CrazyEightsState): CrazyEightsState {
  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length
  const nextPlayer = state.players[nextIndex]
  const player = state.players[state.currentPlayerIndex]

  return {
    ...state,
    currentPlayerIndex: nextIndex,
    message: nextPlayer.isAI
      ? `${player.name} passed. ${nextPlayer.name} is thinking...`
      : `${player.name} passed. Your turn!`,
  }
}

// ─── Round Resolution ───────────────────────────────────────────────────────

function resolveRoundEnd(
  state: CrazyEightsState,
  newPlayers: CrazyEightsPlayer[],
  lastPlayedCard: Card
): CrazyEightsState {
  const winnerIndex = state.currentPlayerIndex
  const winner = newPlayers[winnerIndex]

  // Winner scores the points left in all other hands
  let roundScore = 0
  for (let i = 0; i < newPlayers.length; i++) {
    if (i !== winnerIndex) {
      roundScore += handPoints(newPlayers[i].hand)
    }
  }

  const updatedPlayers = newPlayers.map((p, i) =>
    i === winnerIndex ? { ...p, score: p.score + roundScore } : p
  )

  const gameWinner = updatedPlayers.find(p => p.score >= state.targetScore)

  return {
    ...state,
    players: updatedPlayers,
    discardPile: [...state.discardPile, lastPlayedCard],
    currentSuit: lastPlayedCard.suit,
    phase: gameWinner ? 'game-over' : 'round-over',
    roundWinner: winner.id,
    gameWinner: gameWinner?.id ?? null,
    lastPlayedEight: false,
    message: gameWinner
      ? `${gameWinner.name} wins the game with ${gameWinner.score} points!`
      : `${winner.name} wins the round! (+${roundScore} points)`,
  }
}

// ─── New Round ──────────────────────────────────────────────────────────────

export function startNewRound(state: CrazyEightsState): CrazyEightsState {
  const scores = state.players.map(p => p.score)
  const fresh = initGame(state.players.length - 1)
  return {
    ...fresh,
    players: fresh.players.map((p, i) => ({ ...p, score: scores[i] })),
  }
}

// ─── AI Logic ───────────────────────────────────────────────────────────────

export function getAIMove(
  state: CrazyEightsState,
  difficulty: 'easy' | 'medium' | 'hard'
): { action: 'play'; cardId: string } | { action: 'draw' } | { action: 'pass' } {
  const player = state.players[state.currentPlayerIndex]
  const topCard = state.discardPile[state.discardPile.length - 1]
  const playable = getPlayableCards(player.hand, topCard, state.currentSuit)

  if (playable.length === 0) {
    if (state.deck.length === 0 && state.discardPile.length <= 1) {
      return { action: 'pass' }
    }
    return { action: 'draw' }
  }

  if (difficulty === 'easy') {
    // Random valid play
    const card = playable[Math.floor(Math.random() * playable.length)]
    return { action: 'play', cardId: card.id }
  }

  // Medium and hard: strategic play
  // Save 8s for when stuck (hard saves more aggressively)
  const nonEights = playable.filter(c => c.rank !== '8')

  if (difficulty === 'hard' && nonEights.length > 0) {
    // Hard: always save 8s if possible, prefer cards that match the suit we have most of
    const suitCounts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 }
    player.hand.forEach(c => { if (c.rank !== '8') suitCounts[c.suit]++ })

    // Prefer playing cards from our strongest suit
    const sorted = [...nonEights].sort((a, b) => suitCounts[b.suit] - suitCounts[a.suit])
    return { action: 'play', cardId: sorted[0].id }
  }

  if (difficulty === 'medium' && nonEights.length > 0) {
    // Medium: sometimes save 8s (70% chance)
    if (Math.random() < 0.7) {
      const card = nonEights[Math.floor(Math.random() * nonEights.length)]
      return { action: 'play', cardId: card.id }
    }
  }

  const card = playable[Math.floor(Math.random() * playable.length)]
  return { action: 'play', cardId: card.id }
}

export function getAISuitChoice(
  state: CrazyEightsState,
  difficulty: 'easy' | 'medium' | 'hard'
): Suit {
  const player = state.players[state.currentPlayerIndex]

  if (difficulty === 'easy') {
    return SUITS[Math.floor(Math.random() * SUITS.length)]
  }

  // Pick the suit we have the most of
  const suitCounts: Record<Suit, number> = { hearts: 0, diamonds: 0, clubs: 0, spades: 0 }
  player.hand.forEach(c => { if (c.rank !== '8') suitCounts[c.suit]++ })

  let bestSuit: Suit = 'hearts'
  let bestCount = -1
  for (const s of SUITS) {
    if (suitCounts[s] > bestCount) {
      bestCount = suitCounts[s]
      bestSuit = s
    }
  }
  return bestSuit
}

// ─── Stalemate Detection ────────────────────────────────────────────────────

export function isStalemate(state: CrazyEightsState): boolean {
  if (state.deck.length > 0) return false
  if (state.discardPile.length > 1) return false // can reshuffle

  const topCard = state.discardPile[state.discardPile.length - 1]
  return state.players.every(p => !hasPlayableCard(p.hand, topCard, state.currentSuit))
}
