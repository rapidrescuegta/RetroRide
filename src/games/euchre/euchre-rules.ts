// ─── Euchre Game Logic ──────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Suit,
  type Rank,
  SUITS,
  shuffleDeck,
  sortHand,
  removeCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlayerId = 'south' | 'west' | 'north' | 'east'

export interface Trick {
  cards: { playerId: PlayerId; card: Card }[]
  leadSuit: Suit | null
  winner: PlayerId | null
}

export type EuchrePhase =
  | 'deal'
  | 'bid-round-1'     // Decide if dealer picks up the turned card
  | 'bid-round-2'     // Name a trump suit (different from turned card)
  | 'alone-decision'
  | 'playing'
  | 'trick-over'
  | 'hand-over'
  | 'game-over'

export interface EuchreState {
  hands: Record<PlayerId, Card[]>
  deck: Card[]
  turnedCard: Card | null         // Card turned up for bidding
  trump: Suit | null
  maker: PlayerId | null          // Who called trump
  goingAlone: boolean
  alonePlayer: PlayerId | null
  currentPlayer: PlayerId
  dealer: PlayerId
  players: PlayerId[]
  phase: EuchrePhase
  currentTrick: Trick
  completedTricks: Trick[]
  trickNumber: number
  teamScores: [number, number]    // [team0 (south+north), team1 (west+east)]
  handTricks: [number, number]    // tricks won this hand
  bidder: PlayerId | null         // who is currently deciding in bid
  bidRound: 1 | 2
  message: string
  handNumber: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_PLAYERS: PlayerId[] = ['south', 'west', 'north', 'east']
const EUCHRE_RANKS: Rank[] = ['9', '10', 'J', 'Q', 'K', 'A']
const WINNING_SCORE = 10

export const PLAYER_NAMES: Record<PlayerId, string> = {
  south: 'You',
  west: 'Bot West',
  north: 'Partner',
  east: 'Bot East',
}

export const PLAYER_ICONS: Record<PlayerId, string> = {
  south: '\uD83D\uDE0A',
  west: '\uD83C\uDFB2',
  north: '\uD83E\uDD1D',
  east: '\uD83C\uDFB0',
}

export function getTeam(player: PlayerId): 0 | 1 {
  return (player === 'south' || player === 'north') ? 0 : 1
}

function getPartner(player: PlayerId): PlayerId {
  const partners: Record<PlayerId, PlayerId> = {
    south: 'north', north: 'south', west: 'east', east: 'west'
  }
  return partners[player]
}

const SAME_COLOR_SUIT: Record<Suit, Suit> = {
  hearts: 'diamonds',
  diamonds: 'hearts',
  clubs: 'spades',
  spades: 'clubs',
}

// ─── Deck Creation ──────────────────────────────────────────────────────────

function createEuchreDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of EUCHRE_RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: EUCHRE_RANKS.indexOf(rank) + 9,
        faceUp: false,
      })
    }
  }
  return deck
}

// ─── Card Strength ──────────────────────────────────────────────────────────

export function getCardStrength(card: Card, trump: Suit, leadSuit: Suit | null): number {
  const isRightBower = card.rank === 'J' && card.suit === trump
  const isLeftBower = card.rank === 'J' && card.suit === SAME_COLOR_SUIT[trump]

  if (isRightBower) return 100
  if (isLeftBower) return 99

  // Effective suit (left bower counts as trump)
  const effectiveSuit = isLeftBower ? trump : card.suit

  if (effectiveSuit === trump) {
    return 50 + card.value
  }

  if (leadSuit && effectiveSuit === leadSuit) {
    return 20 + card.value
  }

  return card.value
}

export function getEffectiveSuit(card: Card, trump: Suit): Suit {
  if (card.rank === 'J' && card.suit === SAME_COLOR_SUIT[trump]) {
    return trump
  }
  return card.suit
}

// ─── Initialize ─────────────────────────────────────────────────────────────

export function initGame(): EuchreState {
  return dealNewHand({
    hands: { south: [], west: [], north: [], east: [] },
    deck: [],
    turnedCard: null,
    trump: null,
    maker: null,
    goingAlone: false,
    alonePlayer: null,
    currentPlayer: 'south',
    dealer: 'south',
    players: ALL_PLAYERS,
    phase: 'deal',
    currentTrick: { cards: [], leadSuit: null, winner: null },
    completedTricks: [],
    trickNumber: 0,
    teamScores: [0, 0],
    handTricks: [0, 0],
    bidder: null,
    bidRound: 1,
    message: '',
    handNumber: 0,
  })
}

export function dealNewHand(state: EuchreState): EuchreState {
  const deck = shuffleDeck(createEuchreDeck())
  const hands: Record<PlayerId, Card[]> = { south: [], west: [], north: [], east: [] }

  // Deal 5 cards to each player (Euchre style: 3-2 or 2-3)
  let idx = 0
  const dealerIdx = ALL_PLAYERS.indexOf(state.dealer)
  const dealOrder = Array.from({ length: 4 }, (_, i) => ALL_PLAYERS[(dealerIdx + 1 + i) % 4])

  for (const pid of dealOrder) {
    hands[pid] = sortHand(deck.slice(idx, idx + 5).map(c => ({ ...c, faceUp: true })))
    idx += 5
  }

  const turnedCard = { ...deck[20], faceUp: true }
  const remaining = deck.slice(21)

  const firstBidder = ALL_PLAYERS[(dealerIdx + 1) % 4]

  return {
    ...state,
    hands,
    deck: remaining,
    turnedCard,
    trump: null,
    maker: null,
    goingAlone: false,
    alonePlayer: null,
    currentPlayer: firstBidder,
    phase: 'bid-round-1',
    currentTrick: { cards: [], leadSuit: null, winner: null },
    completedTricks: [],
    trickNumber: 0,
    handTricks: [0, 0],
    bidder: firstBidder,
    bidRound: 1,
    handNumber: state.handNumber + 1,
    message: `${PLAYER_NAMES[firstBidder]}: pick up the ${turnedCard.rank}${SUIT_SYMBOLS[turnedCard.suit]}?`,
  }
}

// ─── Bidding ────────────────────────────────────────────────────────────────

export function orderUp(state: EuchreState): EuchreState {
  if (state.phase !== 'bid-round-1' || !state.turnedCard) return state

  const bidder = state.currentPlayer
  const dealer = state.dealer
  const trump = state.turnedCard.suit

  // Dealer picks up the turned card and discards one
  const dealerHand = [...state.hands[dealer], state.turnedCard]

  // For AI dealer: auto-discard worst card; for human: will need UI
  // For simplicity, auto-discard the worst non-trump card
  let discardIdx = 0
  let worstValue = Infinity
  for (let i = 0; i < dealerHand.length; i++) {
    const strength = getCardStrength(dealerHand[i], trump, null)
    if (strength < worstValue) {
      worstValue = strength
      discardIdx = i
    }
  }
  const newDealerHand = sortHand(dealerHand.filter((_, i) => i !== discardIdx))

  const hands = { ...state.hands, [dealer]: newDealerHand }
  const firstPlayer = ALL_PLAYERS[(ALL_PLAYERS.indexOf(dealer) + 1) % 4]

  return {
    ...state,
    hands,
    trump,
    maker: bidder,
    phase: 'playing',
    currentPlayer: firstPlayer,
    turnedCard: null,
    message: `${PLAYER_NAMES[bidder]} ordered up ${SUIT_SYMBOLS[trump]}! ${PLAYER_NAMES[firstPlayer]} leads.`,
  }
}

export function passBid(state: EuchreState): EuchreState {
  const currentIdx = ALL_PLAYERS.indexOf(state.currentPlayer)

  if (state.phase === 'bid-round-1') {
    // Check if all 4 have passed
    const dealerIdx = ALL_PLAYERS.indexOf(state.dealer)
    if (state.currentPlayer === state.dealer) {
      // Dealer passed, go to round 2
      const firstBidder = ALL_PLAYERS[(dealerIdx + 1) % 4]
      return {
        ...state,
        phase: 'bid-round-2',
        bidRound: 2,
        currentPlayer: firstBidder,
        bidder: firstBidder,
        message: `${PLAYER_NAMES[firstBidder]}: name trump?`,
      }
    }
    const nextPlayer = ALL_PLAYERS[(currentIdx + 1) % 4]
    return {
      ...state,
      currentPlayer: nextPlayer,
      bidder: nextPlayer,
      message: `${PLAYER_NAMES[nextPlayer]}: pick up the ${state.turnedCard?.rank}${SUIT_SYMBOLS[state.turnedCard?.suit || 'spades']}?`,
    }
  }

  if (state.phase === 'bid-round-2') {
    if (state.currentPlayer === state.dealer) {
      // Dealer must call in round 2 (stick the dealer)
      // Auto-pick best suit
      const suits = SUITS.filter(s => s !== state.turnedCard?.suit)
      const bestSuit = suits[Math.floor(Math.random() * suits.length)]
      return callTrump(state, bestSuit)
    }
    const nextPlayer = ALL_PLAYERS[(currentIdx + 1) % 4]
    return {
      ...state,
      currentPlayer: nextPlayer,
      bidder: nextPlayer,
      message: `${PLAYER_NAMES[nextPlayer]}: name trump?`,
    }
  }

  return state
}

export function callTrump(state: EuchreState, suit: Suit): EuchreState {
  if (state.phase !== 'bid-round-2') return state
  if (state.turnedCard && suit === state.turnedCard.suit) return state

  const caller = state.currentPlayer
  const dealerIdx = ALL_PLAYERS.indexOf(state.dealer)
  const firstPlayer = ALL_PLAYERS[(dealerIdx + 1) % 4]

  return {
    ...state,
    trump: suit,
    maker: caller,
    phase: 'playing',
    currentPlayer: firstPlayer,
    message: `${PLAYER_NAMES[caller]} calls ${SUIT_SYMBOLS[suit]}! ${PLAYER_NAMES[firstPlayer]} leads.`,
  }
}

// ─── Playing ────────────────────────────────────────────────────────────────

export function getPlayableCards(state: EuchreState, player: PlayerId): string[] {
  if (state.currentPlayer !== player || state.phase !== 'playing') return []
  if (!state.trump) return []

  const hand = state.hands[player]
  const trick = state.currentTrick

  if (trick.cards.length === 0) {
    return hand.map(c => c.id)
  }

  // Must follow effective lead suit
  const leadCard = trick.cards[0].card
  if (!state.trump) return hand.map(c => c.id)
  const effectiveLeadSuit = getEffectiveSuit(leadCard, state.trump)
  const followCards = hand.filter(c => getEffectiveSuit(c, state.trump!) === effectiveLeadSuit)

  if (followCards.length > 0) {
    return followCards.map(c => c.id)
  }

  return hand.map(c => c.id)
}

export function playCard(state: EuchreState, player: PlayerId, cardId: string): EuchreState {
  if (state.currentPlayer !== player || state.phase !== 'playing') return state
  if (!state.trump) return state

  const playable = getPlayableCards(state, player)
  if (!playable.includes(cardId)) return state

  const card = state.hands[player].find(c => c.id === cardId)
  if (!card) return state

  const newHand = removeCards(state.hands[player], [cardId])
  const newTrick: Trick = {
    cards: [...state.currentTrick.cards, { playerId: player, card }],
    leadSuit: state.currentTrick.leadSuit || getEffectiveSuit(card, state.trump),
    winner: null,
  }

  // Check if trick is complete (4 cards, or 3 if going alone and partner sitting out)
  const playersInHand = state.goingAlone
    ? ALL_PLAYERS.filter(p => p !== getPartner(state.alonePlayer!))
    : ALL_PLAYERS
  const trickComplete = newTrick.cards.length === playersInHand.length

  if (trickComplete) {
    const winner = determineTrickWinner(newTrick, state.trump)
    newTrick.winner = winner

    const newHandTricks: [number, number] = [...state.handTricks]
    newHandTricks[getTeam(winner)]++

    const completedTricks = [...state.completedTricks, newTrick]

    if (completedTricks.length === 5) {
      return finishHand({
        ...state,
        hands: { ...state.hands, [player]: newHand },
        currentTrick: { cards: [], leadSuit: null, winner: null },
        completedTricks,
        handTricks: newHandTricks,
        trickNumber: state.trickNumber + 1,
      })
    }

    return {
      ...state,
      hands: { ...state.hands, [player]: newHand },
      currentTrick: { cards: [], leadSuit: null, winner: null },
      completedTricks,
      currentPlayer: winner,
      handTricks: newHandTricks,
      trickNumber: state.trickNumber + 1,
      phase: 'trick-over',
      message: `${PLAYER_NAMES[winner]} takes the trick!`,
    }
  }

  // Advance to next player (skip partner if going alone)
  let nextIdx = (ALL_PLAYERS.indexOf(player) + 1) % 4
  let nextPlayer = ALL_PLAYERS[nextIdx]
  if (state.goingAlone && nextPlayer === getPartner(state.alonePlayer!)) {
    nextIdx = (nextIdx + 1) % 4
    nextPlayer = ALL_PLAYERS[nextIdx]
  }

  return {
    ...state,
    hands: { ...state.hands, [player]: newHand },
    currentTrick: newTrick,
    currentPlayer: nextPlayer,
    message: `${PLAYER_NAMES[nextPlayer]}'s turn`,
  }
}

export function continuePlaying(state: EuchreState): EuchreState {
  if (state.phase !== 'trick-over') return state
  return {
    ...state,
    phase: 'playing',
    message: `${PLAYER_NAMES[state.currentPlayer]} leads.`,
  }
}

function determineTrickWinner(trick: Trick, trump: Suit): PlayerId {
  let highestStrength = -1
  let winner = trick.cards[0].playerId

  for (const { playerId, card } of trick.cards) {
    const strength = getCardStrength(card, trump, trick.leadSuit)
    if (strength > highestStrength) {
      highestStrength = strength
      winner = playerId
    }
  }

  return winner
}

// ─── Hand Scoring ───────────────────────────────────────────────────────────

function finishHand(state: EuchreState): EuchreState {
  const makerTeam = getTeam(state.maker!)
  const defenderTeam = makerTeam === 0 ? 1 : 0

  let points = 0
  let scoringTeam: 0 | 1
  let msg = ''

  const makerTricks = state.handTricks[makerTeam]
  const defenderTricks = state.handTricks[defenderTeam]

  if (makerTricks >= 3) {
    scoringTeam = makerTeam
    if (makerTricks === 5) {
      points = state.goingAlone ? 4 : 2  // March
      msg = state.goingAlone
        ? `${PLAYER_NAMES[state.maker!]} marches alone! +4 points!`
        : `March! +2 points!`
    } else {
      points = 1
      msg = `${makerTeam === 0 ? 'Your team' : 'Opponents'} win the hand! +1 point.`
    }
  } else {
    // Euchred!
    scoringTeam = defenderTeam
    points = 2
    msg = `Euchred! ${defenderTeam === 0 ? 'Your team' : 'Opponents'} +2 points!`
  }

  const newScores: [number, number] = [...state.teamScores]
  newScores[scoringTeam] += points

  const isGameOver = newScores[0] >= WINNING_SCORE || newScores[1] >= WINNING_SCORE

  // Rotate dealer
  const nextDealer = ALL_PLAYERS[(ALL_PLAYERS.indexOf(state.dealer) + 1) % 4]

  return {
    ...state,
    teamScores: newScores,
    phase: isGameOver ? 'game-over' : 'hand-over',
    message: msg,
    dealer: nextDealer,
  }
}

export function startNextHand(state: EuchreState): EuchreState {
  return dealNewHand(state)
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export function aiBidRound1(state: EuchreState, difficulty: 'easy' | 'medium' | 'hard'): 'order-up' | 'pass' {
  if (!state.turnedCard) return 'pass'

  const player = state.currentPlayer
  const hand = state.hands[player]
  const trumpSuit = state.turnedCard.suit

  // Count trump cards in hand
  const trumpCount = hand.filter(c =>
    c.suit === trumpSuit || (c.rank === 'J' && c.suit === SAME_COLOR_SUIT[trumpSuit])
  ).length

  if (difficulty === 'easy') {
    return trumpCount >= 3 ? 'order-up' : 'pass'
  }

  // Medium/Hard: more nuanced
  const hasRightBower = hand.some(c => c.rank === 'J' && c.suit === trumpSuit)
  const hasLeftBower = hand.some(c => c.rank === 'J' && c.suit === SAME_COLOR_SUIT[trumpSuit])
  const hasAce = hand.some(c => c.rank === 'A' && c.suit === trumpSuit)

  let strength = trumpCount
  if (hasRightBower) strength += 2
  if (hasLeftBower) strength += 1.5
  if (hasAce) strength += 1

  // Partner is dealer? More likely to order up
  const isPartnerDealer = getPartner(player) === state.dealer
  if (isPartnerDealer) strength += 0.5

  const threshold = difficulty === 'hard' ? 3.5 : 3

  return strength >= threshold ? 'order-up' : 'pass'
}

export function aiBidRound2(state: EuchreState, difficulty: 'easy' | 'medium' | 'hard'): Suit | null {
  const player = state.currentPlayer
  const hand = state.hands[player]
  const turnedSuit = state.turnedCard?.suit

  // Find best suit (not the turned suit)
  let bestSuit: Suit | null = null
  let bestCount = 0

  for (const suit of SUITS) {
    if (suit === turnedSuit) continue
    const count = hand.filter(c =>
      c.suit === suit || (c.rank === 'J' && c.suit === SAME_COLOR_SUIT[suit])
    ).length
    if (count > bestCount) {
      bestCount = count
      bestSuit = suit
    }
  }

  if (difficulty === 'easy') {
    return bestCount >= 2 ? bestSuit : null
  }

  // Dealer must call (stick the dealer)
  if (player === state.dealer) {
    return bestSuit || SUITS.find(s => s !== turnedSuit) || 'hearts'
  }

  return bestCount >= 3 ? bestSuit : null
}

export function aiPlayCard(state: EuchreState, difficulty: 'easy' | 'medium' | 'hard'): string {
  const playable = getPlayableCards(state, state.currentPlayer)
  if (playable.length <= 1) return playable[0]

  const hand = state.hands[state.currentPlayer]
  const cards = playable.map(id => hand.find(c => c.id === id)!).filter(Boolean)

  if (difficulty === 'easy') {
    return cards[Math.floor(Math.random() * cards.length)].id
  }

  const trump = state.trump!
  const trick = state.currentTrick
  const isLeading = trick.cards.length === 0

  if (isLeading) {
    // Lead strong trump or off-suit aces
    if (difficulty === 'hard') {
      const trumpCards = cards.filter(c => getEffectiveSuit(c, trump) === trump)
        .sort((a, b) => getCardStrength(b, trump, null) - getCardStrength(a, trump, null))
      if (trumpCards.length > 0 && getCardStrength(trumpCards[0], trump, null) >= 99) {
        return trumpCards[0].id
      }
      const aces = cards.filter(c => c.rank === 'A' && getEffectiveSuit(c, trump) !== trump)
      if (aces.length > 0) return aces[0].id
    }
    // Lead lowest non-trump
    const nonTrump = cards.filter(c => getEffectiveSuit(c, trump) !== trump)
    if (nonTrump.length > 0) {
      return nonTrump.sort((a, b) => a.value - b.value)[0].id
    }
    return cards.sort((a, b) => a.value - b.value)[0].id
  }

  // Following - try to win if partner isn't winning
  const leadSuit = trick.leadSuit!
  let currentWinner = trick.cards[0].playerId
  let highestStrength = -1
  for (const { playerId, card } of trick.cards) {
    const s = getCardStrength(card, trump, leadSuit)
    if (s > highestStrength) {
      highestStrength = s
      currentWinner = playerId
    }
  }

  const partnerWinning = getTeam(currentWinner) === getTeam(state.currentPlayer)

  if (partnerWinning) {
    // Play lowest card
    return cards.sort((a, b) =>
      getCardStrength(a, trump, leadSuit) - getCardStrength(b, trump, leadSuit)
    )[0].id
  }

  // Try to win
  const winners = cards.filter(c => getCardStrength(c, trump, leadSuit) > highestStrength)
  if (winners.length > 0) {
    // Play lowest winner
    return winners.sort((a, b) =>
      getCardStrength(a, trump, leadSuit) - getCardStrength(b, trump, leadSuit)
    )[0].id
  }

  // Can't win, play lowest
  return cards.sort((a, b) =>
    getCardStrength(a, trump, leadSuit) - getCardStrength(b, trump, leadSuit)
  )[0].id
}
