// ─── Hearts Game Logic ───────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Card,
  Suit,
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PassDirection = 'left' | 'right' | 'across' | 'none'

export interface Trick {
  cards: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  winner: string | null
}

export interface HeartsState {
  hands: Record<string, Card[]>
  currentTrick: Trick
  completedTricks: Trick[]
  currentPlayer: string
  players: string[]           // [south, west, north, east]
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  roundNumber: number
  passDirection: PassDirection
  phase: 'passing' | 'playing' | 'roundOver' | 'gameOver'
  selectedPass: Record<string, string[]>  // playerId -> card ids to pass
  heartsBroken: boolean
  trickNumber: number
  roundResults: Record<string, number> | null
  winner: string | null
  shotTheMoon: string | null  // playerId who shot the moon, if any
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PASS_ROTATION: PassDirection[] = ['left', 'right', 'across', 'none']
const GAME_OVER_SCORE = 100

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initHeartsGame(playerIds: string[]): HeartsState {
  const scores: Record<string, number> = {}
  for (const pid of playerIds) scores[pid] = 0
  return startNewRound(playerIds, scores, 0)
}

export function startNewRound(
  playerIds: string[],
  cumulativeScores: Record<string, number>,
  roundNumber: number
): HeartsState {
  const deck = shuffleDeck(createDeck())
  const hands: Record<string, Card[]> = {}

  for (let i = 0; i < 4; i++) {
    hands[playerIds[i]] = sortHand(
      deck.slice(i * 13, (i + 1) * 13).map(c => ({ ...c, faceUp: true }))
    )
  }

  const passDir = PASS_ROTATION[roundNumber % 4]

  // Find who has 2 of clubs
  let firstPlayer = playerIds[0]
  for (const pid of playerIds) {
    if (hands[pid].some(c => c.id === '2-clubs')) {
      firstPlayer = pid
      break
    }
  }

  return {
    hands,
    currentTrick: { cards: [], leadSuit: null, winner: null },
    completedTricks: [],
    currentPlayer: firstPlayer,
    players: playerIds,
    roundScores: Object.fromEntries(playerIds.map(p => [p, 0])),
    cumulativeScores: { ...cumulativeScores },
    roundNumber,
    passDirection: passDir,
    phase: passDir === 'none' ? 'playing' : 'passing',
    selectedPass: Object.fromEntries(playerIds.map(p => [p, []])),
    heartsBroken: false,
    trickNumber: 0,
    roundResults: null,
    winner: null,
    shotTheMoon: null,
  }
}

// ─── Card Passing ────────────────────────────────────────────────────────────

export function getPassTarget(
  players: string[],
  playerId: string,
  direction: PassDirection
): string {
  const idx = players.indexOf(playerId)
  switch (direction) {
    case 'left': return players[(idx + 1) % 4]
    case 'right': return players[(idx + 3) % 4]
    case 'across': return players[(idx + 2) % 4]
    default: return playerId
  }
}

export function selectCardForPass(
  state: HeartsState,
  playerId: string,
  cardId: string
): HeartsState {
  if (state.phase !== 'passing') return state

  const current = state.selectedPass[playerId] || []
  let newSelected: string[]

  if (current.includes(cardId)) {
    newSelected = current.filter(id => id !== cardId)
  } else if (current.length < 3) {
    newSelected = [...current, cardId]
  } else {
    return state
  }

  return {
    ...state,
    selectedPass: { ...state.selectedPass, [playerId]: newSelected },
  }
}

export function executePass(state: HeartsState): HeartsState {
  if (state.phase !== 'passing') return state
  if (state.passDirection === 'none') return { ...state, phase: 'playing' }

  // Verify all players have selected 3 cards
  for (const pid of state.players) {
    if ((state.selectedPass[pid] || []).length !== 3) return state
  }

  const newHands: Record<string, Card[]> = {}
  for (const pid of state.players) {
    newHands[pid] = [...state.hands[pid]]
  }

  // Remove passed cards and give to target
  for (const pid of state.players) {
    const passCardIds = state.selectedPass[pid]
    const passCards = newHands[pid].filter(c => passCardIds.includes(c.id))
    newHands[pid] = removeCards(newHands[pid], passCardIds)

    const target = getPassTarget(state.players, pid, state.passDirection)
    newHands[target] = [...newHands[target], ...passCards]
  }

  // Sort all hands
  for (const pid of state.players) {
    newHands[pid] = sortHand(newHands[pid])
  }

  // Find who has 2 of clubs after passing
  let firstPlayer = state.players[0]
  for (const pid of state.players) {
    if (newHands[pid].some(c => c.id === '2-clubs')) {
      firstPlayer = pid
      break
    }
  }

  return {
    ...state,
    hands: newHands,
    phase: 'playing',
    currentPlayer: firstPlayer,
    selectedPass: Object.fromEntries(state.players.map(p => [p, []])),
  }
}

// ─── Playing ─────────────────────────────────────────────────────────────────

export function getPlayableCards(state: HeartsState, playerId: string): string[] {
  if (state.currentPlayer !== playerId || state.phase !== 'playing') return []

  const hand = state.hands[playerId]
  const trick = state.currentTrick
  const isFirstTrick = state.trickNumber === 0 && state.completedTricks.length === 0

  // First card of first trick must be 2 of clubs
  if (trick.cards.length === 0 && isFirstTrick) {
    const twoClubs = hand.find(c => c.id === '2-clubs')
    if (twoClubs) return [twoClubs.id]
  }

  // Must follow suit if possible
  if (trick.cards.length > 0 && trick.leadSuit) {
    const suitCards = hand.filter(c => c.suit === trick.leadSuit)
    if (suitCards.length > 0) {
      return suitCards.map(c => c.id)
    }
    // Can't follow suit - can play anything, BUT...
    // On first trick, can't play hearts or Q of spades (unless hand is all penalty cards)
    if (isFirstTrick) {
      const nonPenalty = hand.filter(c => c.suit !== 'hearts' && c.id !== 'Q-spades')
      if (nonPenalty.length > 0) return nonPenalty.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  // Leading a trick
  if (trick.cards.length === 0) {
    // Can't lead hearts until broken (unless only hearts left)
    if (!state.heartsBroken) {
      const nonHearts = hand.filter(c => c.suit !== 'hearts')
      if (nonHearts.length > 0) return nonHearts.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  return hand.map(c => c.id)
}

export function playCard(
  state: HeartsState,
  playerId: string,
  cardId: string
): HeartsState {
  if (state.currentPlayer !== playerId || state.phase !== 'playing') return state

  const playable = getPlayableCards(state, playerId)
  if (!playable.includes(cardId)) return state

  const card = state.hands[playerId].find(c => c.id === cardId)
  if (!card) return state

  const newHand = removeCards(state.hands[playerId], [cardId])
  const newTrick: Trick = {
    cards: [...state.currentTrick.cards, { playerId, card }],
    leadSuit: state.currentTrick.leadSuit || card.suit,
    winner: null,
  }

  // Check if hearts are broken
  const heartsBroken = state.heartsBroken || card.suit === 'hearts'

  // If trick is complete (4 cards played)
  if (newTrick.cards.length === 4) {
    const winner = determineTrickWinner(newTrick)
    newTrick.winner = winner

    // Calculate points in this trick
    let trickPoints = 0
    for (const { card: c } of newTrick.cards) {
      if (c.suit === 'hearts') trickPoints += 1
      if (c.id === 'Q-spades') trickPoints += 13
    }

    const newRoundScores = { ...state.roundScores }
    newRoundScores[winner] = (newRoundScores[winner] || 0) + trickPoints

    const completedTricks = [...state.completedTricks, newTrick]

    // Check if round is over (all 13 tricks played)
    if (completedTricks.length === 13) {
      return finishRound({
        ...state,
        hands: { ...state.hands, [playerId]: newHand },
        currentTrick: { cards: [], leadSuit: null, winner: null },
        completedTricks,
        roundScores: newRoundScores,
        heartsBroken,
        trickNumber: state.trickNumber + 1,
      })
    }

    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      currentTrick: { cards: [], leadSuit: null, winner: null },
      completedTricks,
      currentPlayer: winner,
      roundScores: newRoundScores,
      heartsBroken,
      trickNumber: state.trickNumber + 1,
    }
  }

  // Advance to next player
  const nextPlayer = getNextPlayer(state.players, playerId)

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    currentTrick: newTrick,
    currentPlayer: nextPlayer,
    heartsBroken,
  }
}

// ─── Trick Resolution ────────────────────────────────────────────────────────

function determineTrickWinner(trick: Trick): string {
  const leadSuit = trick.leadSuit!
  let highest = -1
  let winner = trick.cards[0].playerId

  for (const { playerId, card } of trick.cards) {
    if (card.suit === leadSuit && card.value > highest) {
      highest = card.value
      winner = playerId
    }
  }

  return winner
}

// ─── Round End ───────────────────────────────────────────────────────────────

function finishRound(state: HeartsState): HeartsState {
  const roundScores = { ...state.roundScores }

  // Check for shooting the moon
  let moonShooter: string | null = null
  for (const pid of state.players) {
    if (roundScores[pid] === 26) {
      moonShooter = pid
      break
    }
  }

  const adjustedScores: Record<string, number> = {}
  if (moonShooter) {
    for (const pid of state.players) {
      adjustedScores[pid] = pid === moonShooter ? 0 : 26
    }
  } else {
    for (const pid of state.players) {
      adjustedScores[pid] = roundScores[pid]
    }
  }

  const newCumulative: Record<string, number> = {}
  for (const pid of state.players) {
    newCumulative[pid] = (state.cumulativeScores[pid] || 0) + adjustedScores[pid]
  }

  // Check game over
  let gameOver = false
  let winner: string | null = null
  const maxScore = Math.max(...Object.values(newCumulative))

  if (maxScore >= GAME_OVER_SCORE) {
    gameOver = true
    // Winner is the one with the LOWEST score
    let lowestScore = Infinity
    for (const pid of state.players) {
      if (newCumulative[pid] < lowestScore) {
        lowestScore = newCumulative[pid]
        winner = pid
      }
    }
  }

  return {
    ...state,
    roundScores: adjustedScores,
    cumulativeScores: newCumulative,
    phase: gameOver ? 'gameOver' : 'roundOver',
    roundResults: adjustedScores,
    winner,
    shotTheMoon: moonShooter,
  }
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export function aiSelectPassCards(
  state: HeartsState,
  playerId: string,
  difficulty: 'easy' | 'medium' | 'hard'
): string[] {
  const hand = state.hands[playerId]

  if (difficulty === 'easy') {
    // Random 3 cards
    const shuffled = [...hand].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 3).map(c => c.id)
  }

  // Medium/Hard: pass high hearts, Q/K/A of spades, high cards
  const sorted = [...hand].sort((a, b) => {
    // Priority: Q spades > high spades > high hearts > other high cards
    const aScore = passScore(a, difficulty)
    const bScore = passScore(b, difficulty)
    return bScore - aScore
  })

  return sorted.slice(0, 3).map(c => c.id)
}

function passScore(card: Card, difficulty: 'medium' | 'hard'): number {
  // Higher score = more desire to pass
  if (card.id === 'Q-spades') return 100
  if (card.id === 'K-spades') return 90
  if (card.id === 'A-spades') return 85
  if (card.suit === 'hearts' && card.value >= 10) return 70 + card.value
  if (card.suit === 'hearts') return 50 + card.value
  if (difficulty === 'hard' && card.value >= 12) return 40 + card.value
  return card.value
}

export function aiPlayCard(
  state: HeartsState,
  playerId: string,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  const playable = getPlayableCards(state, playerId)
  if (playable.length === 1) return playable[0]

  const hand = state.hands[playerId]
  const cards = playable.map(id => hand.find(c => c.id === id)!).filter(Boolean)

  if (difficulty === 'easy') {
    return cards[Math.floor(Math.random() * cards.length)].id
  }

  const trick = state.currentTrick
  const isLeading = trick.cards.length === 0

  if (isLeading) {
    return aiLeadCard(cards, state, difficulty)
  }

  const leadSuit = trick.leadSuit!
  const followingSuit = cards.filter(c => c.suit === leadSuit)

  if (followingSuit.length > 0) {
    return aiFollowSuit(followingSuit, trick, difficulty)
  }

  // Can't follow suit - dump penalty cards
  return aiDumpCard(cards, state, difficulty)
}

function aiLeadCard(
  cards: Card[],
  state: HeartsState,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  // Lead low cards from short suits to void them
  const nonHearts = cards.filter(c => c.suit !== 'hearts')
  const candidates = nonHearts.length > 0 ? nonHearts : cards

  if (difficulty === 'hard') {
    // Lead from shortest non-heart suit with lowest card
    const suitCounts: Record<string, number> = {}
    for (const c of candidates) {
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
    }
    const sorted = [...candidates].sort((a, b) => {
      const suitDiff = (suitCounts[a.suit] || 0) - (suitCounts[b.suit] || 0)
      if (suitDiff !== 0) return suitDiff
      return a.value - b.value
    })
    return sorted[0].id
  }

  // Medium: lead lowest card
  const sorted = [...candidates].sort((a, b) => a.value - b.value)
  return sorted[0].id
}

function aiFollowSuit(
  suitCards: Card[],
  trick: Trick,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  const leadSuit = trick.leadSuit!
  // Find highest card of lead suit played so far
  let highestPlayed = 0
  let hasPoints = false
  for (const { card } of trick.cards) {
    if (card.suit === leadSuit && card.value > highestPlayed) {
      highestPlayed = card.value
    }
    if (card.suit === 'hearts' || card.id === 'Q-spades') hasPoints = true
  }

  const sorted = [...suitCards].sort((a, b) => a.value - b.value)

  if (trick.cards.length === 3) {
    // Last to play - if no points, win with lowest winner; if points, duck
    if (!hasPoints) {
      // Win cheaply
      const winners = sorted.filter(c => c.value > highestPlayed)
      return winners.length > 0 ? winners[0].id : sorted[sorted.length - 1].id
    }
    // Points on the table - play under if possible
    const duckers = sorted.filter(c => c.value < highestPlayed)
    return duckers.length > 0 ? duckers[duckers.length - 1].id : sorted[0].id
  }

  if (difficulty === 'hard') {
    // Play highest card that's still under the leader, or lowest if can't duck
    const duckers = sorted.filter(c => c.value < highestPlayed)
    if (duckers.length > 0) return duckers[duckers.length - 1].id
  }

  // Play lowest card (try to avoid winning the trick)
  return sorted[0].id
}

function aiDumpCard(
  cards: Card[],
  state: HeartsState,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  // Can't follow suit - dump penalty cards!
  // Priority: Q spades > high hearts > high other cards
  const qSpades = cards.find(c => c.id === 'Q-spades')
  if (qSpades) return qSpades.id

  const hearts = cards.filter(c => c.suit === 'hearts')
  if (hearts.length > 0) {
    const sorted = [...hearts].sort((a, b) => b.value - a.value)
    return sorted[0].id
  }

  // Dump highest cards to void suits
  if (difficulty === 'hard') {
    // Dump high spades if still have them
    const highSpades = cards.filter(c => c.suit === 'spades' && c.value >= 12)
    if (highSpades.length > 0) {
      return highSpades.sort((a, b) => b.value - a.value)[0].id
    }
  }

  const sorted = [...cards].sort((a, b) => b.value - a.value)
  return sorted[0].id
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getNextPlayer(players: string[], current: string): string {
  const idx = players.indexOf(current)
  return players[(idx + 1) % 4]
}

export function getPassDirectionLabel(dir: PassDirection): string {
  switch (dir) {
    case 'left': return 'Pass Left'
    case 'right': return 'Pass Right'
    case 'across': return 'Pass Across'
    case 'none': return 'No Pass'
  }
}

export function getPassDirectionArrow(dir: PassDirection): string {
  switch (dir) {
    case 'left': return '\u2190'    // ←
    case 'right': return '\u2192'   // →
    case 'across': return '\u2191'  // ↑
    case 'none': return '\u2014'    // —
  }
}
