// ─── Spades Game Logic ───────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Card,
  Suit,
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Trick {
  cards: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  winner: string | null
}

export interface TeamScore {
  score: number
  bags: number
  bid: number
  tricksWon: number
}

export interface SpadesState {
  hands: Record<string, Card[]>
  currentTrick: Trick
  completedTricks: Trick[]
  currentPlayer: string
  players: string[]           // [south, west, north, east]
  teams: [string[], string[]] // [[south, north], [west, east]]
  teamNames: [string, string]
  bids: Record<string, number | null>  // null = not yet bid, -1 = nil
  tricksWon: Record<string, number>
  teamScores: [TeamScore, TeamScore]
  cumulativeScores: [number, number]
  cumulativeBags: [number, number]
  roundNumber: number
  dealer: string
  phase: 'bidding' | 'playing' | 'roundOver' | 'gameOver'
  spadesBroken: boolean
  trickNumber: number
  roundResults: {
    teamBids: [number, number]
    teamTricks: [number, number]
    teamRoundScore: [number, number]
    nilResults: { playerId: string; success: boolean }[]
  } | null
  winner: number | null // team index
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WINNING_SCORE = 500

// ─── Initialize ──────────────────────────────────────────────────────────────

export function initSpadesGame(playerIds: string[]): SpadesState {
  // Teams: [0]=[south,north], [1]=[west,east] (partners sit across)
  const teams: [string[], string[]] = [
    [playerIds[0], playerIds[2]], // south + north
    [playerIds[1], playerIds[3]], // west + east
  ]

  return startNewRound(playerIds, teams, [0, 0], [0, 0], 0, playerIds[3])
}

export function startNewRound(
  playerIds: string[],
  teams: [string[], string[]],
  cumulativeScores: [number, number],
  cumulativeBags: [number, number],
  roundNumber: number,
  prevDealer: string
): SpadesState {
  const deck = shuffleDeck(createDeck())
  const hands: Record<string, Card[]> = {}

  for (let i = 0; i < 4; i++) {
    hands[playerIds[i]] = sortHand(
      deck.slice(i * 13, (i + 1) * 13).map(c => ({ ...c, faceUp: true }))
    )
  }

  // Dealer rotates; first bidder is left of dealer
  const dealerIdx = playerIds.indexOf(prevDealer)
  const newDealer = playerIds[(dealerIdx + 1) % 4]
  const firstBidder = playerIds[(playerIds.indexOf(newDealer) + 1) % 4]

  return {
    hands,
    currentTrick: { cards: [], leadSuit: null, winner: null },
    completedTricks: [],
    currentPlayer: firstBidder,
    players: playerIds,
    teams,
    teamNames: ['Team Purple', 'Team Cyan'],
    bids: Object.fromEntries(playerIds.map(p => [p, null])),
    tricksWon: Object.fromEntries(playerIds.map(p => [p, 0])),
    teamScores: [
      { score: 0, bags: 0, bid: 0, tricksWon: 0 },
      { score: 0, bags: 0, bid: 0, tricksWon: 0 },
    ],
    cumulativeScores,
    cumulativeBags,
    roundNumber,
    dealer: newDealer,
    phase: 'bidding',
    spadesBroken: false,
    trickNumber: 0,
    roundResults: null,
    winner: null,
  }
}

// ─── Bidding ─────────────────────────────────────────────────────────────────

export function placeBid(
  state: SpadesState,
  playerId: string,
  bid: number // 0 = nil, 1-13 = tricks
): SpadesState {
  if (state.phase !== 'bidding') return state
  if (state.currentPlayer !== playerId) return state
  if (bid < 0 || bid > 13) return state

  const newBids = { ...state.bids, [playerId]: bid === 0 ? -1 : bid }

  // Check if all players have bid
  const nextIdx = (state.players.indexOf(playerId) + 1) % 4
  const allBid = state.players.every(p => p === playerId || newBids[p] !== null)

  if (allBid) {
    // Move to playing - left of dealer leads first trick
    const dealerIdx = state.players.indexOf(state.dealer)
    const firstLead = state.players[(dealerIdx + 1) % 4]

    return {
      ...state,
      bids: newBids,
      currentPlayer: firstLead,
      phase: 'playing',
    }
  }

  return {
    ...state,
    bids: newBids,
    currentPlayer: state.players[nextIdx],
  }
}

export function getTeamBid(state: SpadesState, teamIdx: number): number {
  const team = state.teams[teamIdx]
  let total = 0
  for (const pid of team) {
    const bid = state.bids[pid]
    if (bid === null) continue
    if (bid === -1) continue // nil doesn't count toward team total
    total += bid
  }
  return total
}

export function isNilBid(state: SpadesState, playerId: string): boolean {
  return state.bids[playerId] === -1
}

// ─── Playing ─────────────────────────────────────────────────────────────────

export function getPlayableCards(state: SpadesState, playerId: string): string[] {
  if (state.currentPlayer !== playerId || state.phase !== 'playing') return []

  const hand = state.hands[playerId]
  const trick = state.currentTrick

  // Must follow suit if possible
  if (trick.cards.length > 0 && trick.leadSuit) {
    const suitCards = hand.filter(c => c.suit === trick.leadSuit)
    if (suitCards.length > 0) {
      return suitCards.map(c => c.id)
    }
    // Can't follow suit - can play anything (including spades)
    return hand.map(c => c.id)
  }

  // Leading a trick
  if (trick.cards.length === 0) {
    // Can't lead spades until broken (unless only spades left)
    if (!state.spadesBroken) {
      const nonSpades = hand.filter(c => c.suit !== 'spades')
      if (nonSpades.length > 0) return nonSpades.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  return hand.map(c => c.id)
}

export function playCard(
  state: SpadesState,
  playerId: string,
  cardId: string
): SpadesState {
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

  const spadesBroken = state.spadesBroken || card.suit === 'spades'

  // If trick is complete
  if (newTrick.cards.length === 4) {
    const winner = determineTrickWinner(newTrick)
    newTrick.winner = winner

    const newTricksWon = { ...state.tricksWon }
    newTricksWon[winner] = (newTricksWon[winner] || 0) + 1

    const completedTricks = [...state.completedTricks, newTrick]

    // Check if round is over
    if (completedTricks.length === 13) {
      return finishRound({
        ...state,
        hands: { ...state.hands, [playerId]: newHand },
        currentTrick: { cards: [], leadSuit: null, winner: null },
        completedTricks,
        tricksWon: newTricksWon,
        spadesBroken,
        trickNumber: state.trickNumber + 1,
      })
    }

    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      currentTrick: { cards: [], leadSuit: null, winner: null },
      completedTricks,
      currentPlayer: winner,
      tricksWon: newTricksWon,
      spadesBroken,
      trickNumber: state.trickNumber + 1,
    }
  }

  const nextPlayer = getNextPlayer(state.players, playerId)

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    currentTrick: newTrick,
    currentPlayer: nextPlayer,
    spadesBroken,
  }
}

// ─── Trick Resolution ────────────────────────────────────────────────────────

function determineTrickWinner(trick: Trick): string {
  const leadSuit = trick.leadSuit!
  let highestTrump = -1
  let trumpWinner: string | null = null
  let highestLead = -1
  let leadWinner = trick.cards[0].playerId

  for (const { playerId, card } of trick.cards) {
    if (card.suit === 'spades') {
      if (card.value > highestTrump) {
        highestTrump = card.value
        trumpWinner = playerId
      }
    }
    if (card.suit === leadSuit && card.value > highestLead) {
      highestLead = card.value
      leadWinner = playerId
    }
  }

  return trumpWinner || leadWinner
}

// ─── Round End ───────────────────────────────────────────────────────────────

function finishRound(state: SpadesState): SpadesState {
  const nilResults: { playerId: string; success: boolean }[] = []
  const teamTricks: [number, number] = [0, 0]
  const teamBids: [number, number] = [0, 0]
  const teamRoundScore: [number, number] = [0, 0]

  // Calculate team tricks and handle nil bids
  for (let t = 0; t < 2; t++) {
    for (const pid of state.teams[t]) {
      const tricks = state.tricksWon[pid] || 0

      if (state.bids[pid] === -1) {
        // Nil bid
        const success = tricks === 0
        nilResults.push({ playerId: pid, success })
        teamRoundScore[t] += success ? 100 : -100
        // Nil player's tricks still count toward partner's bag calculation
        teamTricks[t] += tricks
      } else {
        teamTricks[t] += tricks
        teamBids[t] += state.bids[pid] || 0
      }
    }
  }

  // Calculate team scores (non-nil portion)
  for (let t = 0; t < 2; t++) {
    const bid = teamBids[t]
    if (bid === 0) continue // both nil, already handled

    if (teamTricks[t] >= bid) {
      // Made bid
      teamRoundScore[t] += bid * 10
      const overtricks = teamTricks[t] - bid
      teamRoundScore[t] += overtricks // bags
    } else {
      // Failed bid
      teamRoundScore[t] += bid * -10
    }
  }

  // Update cumulative
  const newScores: [number, number] = [
    state.cumulativeScores[0] + teamRoundScore[0],
    state.cumulativeScores[1] + teamRoundScore[1],
  ]

  // Track bags
  const newBags: [number, number] = [...state.cumulativeBags]
  for (let t = 0; t < 2; t++) {
    const bid = teamBids[t]
    const overtricks = Math.max(0, teamTricks[t] - bid)
    newBags[t] += overtricks

    // Bag penalty: every 10 bags = -100
    if (newBags[t] >= 10) {
      const penalties = Math.floor(newBags[t] / 10)
      newScores[t] -= penalties * 100
      newBags[t] = newBags[t] % 10
    }
  }

  // Check game over
  let gameOver = false
  let winner: number | null = null

  if (newScores[0] >= WINNING_SCORE || newScores[1] >= WINNING_SCORE) {
    gameOver = true
    if (newScores[0] >= WINNING_SCORE && newScores[1] >= WINNING_SCORE) {
      winner = newScores[0] >= newScores[1] ? 0 : 1
    } else {
      winner = newScores[0] >= WINNING_SCORE ? 0 : 1
    }
  }

  return {
    ...state,
    cumulativeScores: newScores,
    cumulativeBags: newBags,
    phase: gameOver ? 'gameOver' : 'roundOver',
    roundResults: { teamBids, teamTricks, teamRoundScore, nilResults },
    winner,
  }
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export function aiBid(
  state: SpadesState,
  playerId: string,
  difficulty: 'easy' | 'medium' | 'hard'
): number {
  const hand = state.hands[playerId]

  if (difficulty === 'easy') {
    return Math.max(1, Math.floor(Math.random() * 5) + 1)
  }

  // Count high cards and spades for bid estimation
  let expectedTricks = 0

  // Count spades (trump)
  const spades = hand.filter(c => c.suit === 'spades')
  for (const s of spades) {
    if (s.value >= 12) expectedTricks += 1       // Q, K, A of spades = likely trick
    else if (s.value >= 10) expectedTricks += 0.7 // 10, J of spades
    else if (spades.length >= 4) expectedTricks += 0.3 // long trump
  }

  // Count non-spade aces and kings
  const nonSpades = hand.filter(c => c.suit !== 'spades')
  for (const c of nonSpades) {
    if (c.value === 14) expectedTricks += 0.9  // Ace
    if (c.value === 13) expectedTricks += 0.5  // King
  }

  let bid = Math.round(expectedTricks)
  if (bid < 1) bid = 1

  if (difficulty === 'hard') {
    // Slightly more conservative
    bid = Math.max(1, bid)
  } else {
    // Medium: slightly optimistic
    bid = Math.max(1, bid)
  }

  // Check partner's bid - don't overbid as a team
  const teamIdx = getTeamIndex(state, playerId)
  const partner = state.teams[teamIdx].find(p => p !== playerId)!
  const partnerBid = state.bids[partner]
  if (partnerBid !== null && partnerBid !== -1) {
    const combined = partnerBid + bid
    if (combined > 10) {
      bid = Math.max(1, 10 - partnerBid)
    }
  }

  return Math.min(13, Math.max(1, bid))
}

export function aiPlayCard(
  state: SpadesState,
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
  const isNil = state.bids[playerId] === -1
  const teamIdx = getTeamIndex(state, playerId)
  const myTeamTricks = getTeamTricks(state, teamIdx)
  const myTeamBid = getTeamBid(state, teamIdx)

  if (isNil) {
    return aiPlayNil(cards, trick, state)
  }

  if (isLeading) {
    return aiLeadSpades(cards, state, playerId, difficulty)
  }

  const leadSuit = trick.leadSuit!
  const following = cards.filter(c => c.suit === leadSuit)

  if (following.length > 0) {
    return aiFollowSuitSpades(following, trick, myTeamTricks, myTeamBid, difficulty)
  }

  // Can't follow suit
  return aiCantFollowSpades(cards, trick, myTeamTricks, myTeamBid, difficulty)
}

function aiPlayNil(cards: Card[], trick: Trick, state: SpadesState): string {
  // Nil bidder: play lowest possible, avoid winning
  if (trick.cards.length === 0) {
    // Must lead - play lowest card
    const sorted = [...cards].sort((a, b) => a.value - b.value)
    return sorted[0].id
  }

  const leadSuit = trick.leadSuit!
  const following = cards.filter(c => c.suit === leadSuit)

  if (following.length > 0) {
    // Play highest card that's still under the current winner
    let highestPlayed = 0
    for (const { card } of trick.cards) {
      if (card.suit === leadSuit && card.value > highestPlayed) highestPlayed = card.value
    }
    // Any spades played?
    const trumpPlayed = trick.cards.some(c => c.card.suit === 'spades')
    if (trumpPlayed && leadSuit !== 'spades') {
      // Someone trumped, play highest following card (won't win)
      return [...following].sort((a, b) => b.value - a.value)[0].id
    }
    const duckers = following.filter(c => c.value < highestPlayed)
    if (duckers.length > 0) return duckers.sort((a, b) => b.value - a.value)[0].id
    return [...following].sort((a, b) => a.value - b.value)[0].id
  }

  // Can't follow - avoid playing spades if possible (they might win)
  const nonSpades = cards.filter(c => c.suit !== 'spades')
  if (nonSpades.length > 0) {
    return [...nonSpades].sort((a, b) => b.value - a.value)[0].id
  }
  return [...cards].sort((a, b) => a.value - b.value)[0].id
}

function aiLeadSpades(
  cards: Card[],
  state: SpadesState,
  playerId: string,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  const teamIdx = getTeamIndex(state, playerId)
  const myTeamTricks = getTeamTricks(state, teamIdx)
  const myTeamBid = getTeamBid(state, teamIdx)
  const needMore = myTeamTricks < myTeamBid

  if (needMore) {
    // Lead with high cards to win tricks
    const aces = cards.filter(c => c.value === 14 && c.suit !== 'spades')
    if (aces.length > 0) return aces[0].id
    const kings = cards.filter(c => c.value === 13 && c.suit !== 'spades')
    if (kings.length > 0) return kings[0].id
    // Lead spades if we have high ones
    const highSpades = cards.filter(c => c.suit === 'spades' && c.value >= 12)
    if (highSpades.length > 0 && state.spadesBroken) {
      return highSpades.sort((a, b) => b.value - a.value)[0].id
    }
  }

  // Lead low to avoid bags
  const nonSpades = cards.filter(c => c.suit !== 'spades')
  if (nonSpades.length > 0) {
    return [...nonSpades].sort((a, b) => a.value - b.value)[0].id
  }
  return [...cards].sort((a, b) => a.value - b.value)[0].id
}

function aiFollowSuitSpades(
  suitCards: Card[],
  trick: Trick,
  teamTricks: number,
  teamBid: number,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  const leadSuit = trick.leadSuit!
  let highestPlayed = 0
  const trumpPlayed = trick.cards.some(c => c.card.suit === 'spades' && leadSuit !== 'spades')

  for (const { card } of trick.cards) {
    if (card.suit === leadSuit && card.value > highestPlayed) {
      highestPlayed = card.value
    }
  }

  const sorted = [...suitCards].sort((a, b) => a.value - b.value)
  const needTricks = teamTricks < teamBid

  if (trumpPlayed) {
    // Someone already trumped - dump highest (we can't win with suit cards)
    return sorted[sorted.length - 1].id
  }

  if (needTricks) {
    // Try to win
    const winners = sorted.filter(c => c.value > highestPlayed)
    if (winners.length > 0) {
      // Play lowest winner
      return winners[0].id
    }
    // Can't win - dump lowest
    return sorted[0].id
  }

  // Don't need tricks - duck to avoid bags
  const duckers = sorted.filter(c => c.value < highestPlayed)
  if (duckers.length > 0) return duckers[duckers.length - 1].id
  return sorted[0].id
}

function aiCantFollowSpades(
  cards: Card[],
  trick: Trick,
  teamTricks: number,
  teamBid: number,
  difficulty: 'easy' | 'medium' | 'hard'
): string {
  const needTricks = teamTricks < teamBid
  const spades = cards.filter(c => c.suit === 'spades')
  const nonSpades = cards.filter(c => c.suit !== 'spades')

  // Check if someone already trumped with a higher spade
  let highestTrump = 0
  for (const { card } of trick.cards) {
    if (card.suit === 'spades' && card.value > highestTrump) {
      highestTrump = card.value
    }
  }

  if (needTricks && spades.length > 0) {
    // Trump to win
    const winners = spades.filter(c => c.value > highestTrump)
    if (winners.length > 0) {
      return winners.sort((a, b) => a.value - b.value)[0].id
    }
    // Can't overtrump - dump non-spades
    if (nonSpades.length > 0) {
      return [...nonSpades].sort((a, b) => a.value - b.value)[0].id
    }
    return spades.sort((a, b) => a.value - b.value)[0].id
  }

  // Don't need tricks - dump low non-spades
  if (nonSpades.length > 0) {
    return [...nonSpades].sort((a, b) => a.value - b.value)[0].id
  }
  return [...cards].sort((a, b) => a.value - b.value)[0].id
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function getNextPlayer(players: string[], current: string): string {
  const idx = players.indexOf(current)
  return players[(idx + 1) % 4]
}

export function getTeamIndex(state: SpadesState, playerId: string): number {
  return state.teams[0].includes(playerId) ? 0 : 1
}

export function getTeamTricks(state: SpadesState, teamIdx: number): number {
  return state.teams[teamIdx].reduce((sum, pid) => sum + (state.tricksWon[pid] || 0), 0)
}

export function getPlayerBidDisplay(bid: number | null): string {
  if (bid === null) return '...'
  if (bid === -1) return 'Nil'
  return String(bid)
}
