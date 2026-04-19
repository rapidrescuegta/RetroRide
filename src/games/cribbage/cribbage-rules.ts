// ─── Cribbage Game Logic ────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  type Suit,
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export type CribPhase =
  | 'discard'        // Players choose 2 cards for the crib
  | 'cut'            // Cut the deck for starter card
  | 'pegging'        // Alternate playing cards
  | 'counting'       // Score hands
  | 'round-over'     // Show round results
  | 'game-over'

export interface PegPlay {
  playerId: 'player' | 'ai'
  card: Card
}

export interface CribbageState {
  deck: Card[]
  playerHand: Card[]        // Full hand (6 cards initially, then 4)
  aiHand: Card[]
  crib: Card[]               // 4 cards in the crib
  starter: Card | null        // Cut card
  currentPlayer: 'player' | 'ai'
  dealer: 'player' | 'ai'
  phase: CribPhase
  playerScore: number
  aiScore: number
  pegCount: number            // Running count during pegging (0-31)
  pegPlays: PegPlay[]         // Cards played during pegging
  playerPegHand: Card[]       // Remaining cards for pegging
  aiPegHand: Card[]
  playerPlayedPeg: Card[]     // Cards already played in pegging
  aiPlayedPeg: Card[]
  consecutivePasses: number
  message: string
  roundNumber: number
  selectedForCrib: string[]   // Card IDs player selected to discard
  lastPegPoints: { player: 'player' | 'ai'; points: number; reason: string } | null
  handScoreDetails: {
    player: { total: number; fifteens: number; pairs: number; runs: number; flush: number; nobs: number }
    ai: { total: number; fifteens: number; pairs: number; runs: number; flush: number; nobs: number }
    crib: { total: number; fifteens: number; pairs: number; runs: number; flush: number; nobs: number }
  } | null
  targetScore: number
  hisHeels: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TARGET_SCORE = 121

const RANK_PEG_VALUE: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
}

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function pegValue(card: Card): number {
  return RANK_PEG_VALUE[card.rank]
}

export function cardOrder(card: Card): number {
  return RANK_ORDER[card.rank]
}

// ─── Initialize ─────────────────────────────────────────────────────────────

export function initGame(): CribbageState {
  return dealNewRound({
    deck: [],
    playerHand: [],
    aiHand: [],
    crib: [],
    starter: null,
    currentPlayer: 'player',
    dealer: 'ai',  // Will flip on first deal
    phase: 'discard',
    playerScore: 0,
    aiScore: 0,
    pegCount: 0,
    pegPlays: [],
    playerPegHand: [],
    aiPegHand: [],
    playerPlayedPeg: [],
    aiPlayedPeg: [],
    consecutivePasses: 0,
    message: '',
    roundNumber: 0,
    selectedForCrib: [],
    lastPegPoints: null,
    handScoreDetails: null,
    targetScore: TARGET_SCORE,
    hisHeels: false,
  })
}

export function dealNewRound(state: CribbageState): CribbageState {
  const deck = shuffleDeck(createDeck())
  const newDealer: 'player' | 'ai' = state.dealer === 'player' ? 'ai' : 'player'

  const playerHand = sortHand(deck.slice(0, 6).map(c => ({ ...c, faceUp: true })))
  const aiHand = sortHand(deck.slice(6, 12).map(c => ({ ...c, faceUp: true })))
  const remaining = deck.slice(12)

  const nonDealer: 'player' | 'ai' = newDealer === 'player' ? 'ai' : 'player'

  return {
    ...state,
    deck: remaining,
    playerHand,
    aiHand,
    crib: [],
    starter: null,
    dealer: newDealer,
    currentPlayer: nonDealer,
    phase: 'discard',
    pegCount: 0,
    pegPlays: [],
    playerPegHand: [],
    aiPegHand: [],
    playerPlayedPeg: [],
    aiPlayedPeg: [],
    consecutivePasses: 0,
    roundNumber: state.roundNumber + 1,
    selectedForCrib: [],
    lastPegPoints: null,
    handScoreDetails: null,
    message: `Round ${state.roundNumber + 1}. ${newDealer === 'player' ? 'You deal' : 'AI deals'}. Select 2 cards for the crib.`,
    hisHeels: false,
  }
}

// ─── Discard to Crib ────────────────────────────────────────────────────────

export function toggleCribSelection(state: CribbageState, cardId: string): CribbageState {
  if (state.phase !== 'discard') return state

  const current = state.selectedForCrib
  let newSelected: string[]

  if (current.includes(cardId)) {
    newSelected = current.filter(id => id !== cardId)
  } else if (current.length < 2) {
    newSelected = [...current, cardId]
  } else {
    return state
  }

  return { ...state, selectedForCrib: newSelected }
}

export function confirmCribDiscard(state: CribbageState): CribbageState {
  if (state.phase !== 'discard') return state
  if (state.selectedForCrib.length !== 2) return state

  const playerCribCards = state.playerHand.filter(c => state.selectedForCrib.includes(c.id))
  const newPlayerHand = sortHand(removeCards(state.playerHand, state.selectedForCrib))

  // AI discards 2 cards
  const aiDiscards = aiSelectCribCards(state.aiHand, state.dealer === 'ai')
  const aiCribCards = state.aiHand.filter(c => aiDiscards.includes(c.id))
  const newAiHand = sortHand(removeCards(state.aiHand, aiDiscards))

  const crib = [...playerCribCards, ...aiCribCards]

  return {
    ...state,
    playerHand: newPlayerHand,
    aiHand: newAiHand,
    crib,
    phase: 'cut',
    selectedForCrib: [],
    message: 'Tap to cut the deck for the starter card!',
  }
}

function aiSelectCribCards(hand: Card[], isMyCrib: boolean): string[] {
  // Simple strategy: discard cards that contribute least to hand score
  let bestScore = -1
  let bestDiscard: string[] = [hand[0].id, hand[1].id]

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const remaining = hand.filter((_, idx) => idx !== i && idx !== j)
      const score = scoreHand(remaining, null, false)
      if (score > bestScore) {
        bestScore = score
        bestDiscard = [hand[i].id, hand[j].id]
      }
    }
  }

  return bestDiscard
}

// ─── Cut / Starter ──────────────────────────────────────────────────────────

export function cutDeck(state: CribbageState): CribbageState {
  if (state.phase !== 'cut') return state

  const starterIdx = Math.floor(Math.random() * state.deck.length)
  const starter = { ...state.deck[starterIdx], faceUp: true }
  const remaining = state.deck.filter((_, i) => i !== starterIdx)

  // His Heels: if starter is a Jack, dealer gets 2 points
  let newPlayerScore = state.playerScore
  let newAiScore = state.aiScore
  let hisHeels = false
  let msg = `Starter: ${starter.rank}${SUIT_SYMBOLS[starter.suit]}.`

  if (starter.rank === 'J') {
    hisHeels = true
    if (state.dealer === 'player') {
      newPlayerScore += 2
      msg += ' His Heels! You get 2 points!'
    } else {
      newAiScore += 2
      msg += ' His Heels! AI gets 2 points!'
    }
  }

  // Check for game over
  if (newPlayerScore >= TARGET_SCORE || newAiScore >= TARGET_SCORE) {
    return {
      ...state,
      deck: remaining,
      starter,
      playerScore: newPlayerScore,
      aiScore: newAiScore,
      phase: 'game-over',
      hisHeels,
      message: newPlayerScore >= TARGET_SCORE ? 'You win!' : 'AI wins!',
    }
  }

  const nonDealer: 'player' | 'ai' = state.dealer === 'player' ? 'ai' : 'player'

  return {
    ...state,
    deck: remaining,
    starter,
    playerScore: newPlayerScore,
    aiScore: newAiScore,
    phase: 'pegging',
    currentPlayer: nonDealer,
    playerPegHand: [...state.playerHand],
    aiPegHand: [...state.aiHand],
    playerPlayedPeg: [],
    aiPlayedPeg: [],
    hisHeels,
    message: msg + ` ${nonDealer === 'player' ? 'Your' : "AI's"} turn to peg.`,
  }
}

// ─── Pegging ────────────────────────────────────────────────────────────────

export function getPlayablePegCards(state: CribbageState, player: 'player' | 'ai'): string[] {
  if (state.phase !== 'pegging') return []
  if (state.currentPlayer !== player) return []

  const hand = player === 'player' ? state.playerPegHand : state.aiPegHand
  return hand
    .filter(c => pegValue(c) + state.pegCount <= 31)
    .map(c => c.id)
}

export function pegCard(state: CribbageState, player: 'player' | 'ai', cardId: string): CribbageState {
  if (state.phase !== 'pegging' || state.currentPlayer !== player) return state

  const playable = getPlayablePegCards(state, player)
  if (!playable.includes(cardId)) return state

  const hand = player === 'player' ? state.playerPegHand : state.aiPegHand
  const card = hand.find(c => c.id === cardId)
  if (!card) return state

  const newCount = state.pegCount + pegValue(card)
  const newPlays = [...state.pegPlays, { playerId: player, card }]
  const newHand = removeCards(hand, [cardId])
  const newPlayed = [...(player === 'player' ? state.playerPlayedPeg : state.aiPlayedPeg), card]

  // Score the peg play
  let points = 0
  let reason = ''

  // 15
  if (newCount === 15) {
    points += 2
    reason = '15 for 2'
  }

  // 31
  if (newCount === 31) {
    points += 2
    reason = reason ? reason + ', 31 for 2' : '31 for 2'
  }

  // Pairs
  const pairPoints = scorePegPairs(newPlays)
  if (pairPoints > 0) {
    points += pairPoints
    const pairLabel = pairPoints === 2 ? 'pair' : pairPoints === 6 ? 'three of a kind' : 'four of a kind'
    reason = reason ? reason + `, ${pairLabel}` : pairLabel
  }

  // Runs
  const runPoints = scorePegRun(newPlays)
  if (runPoints > 0) {
    points += runPoints
    reason = reason ? reason + `, run of ${runPoints}` : `run of ${runPoints}`
  }

  let newPlayerScore = state.playerScore + (player === 'player' ? points : 0)
  let newAiScore = state.aiScore + (player === 'ai' ? points : 0)

  // Check game over
  if (newPlayerScore >= TARGET_SCORE || newAiScore >= TARGET_SCORE) {
    return {
      ...state,
      playerPegHand: player === 'player' ? newHand : state.playerPegHand,
      aiPegHand: player === 'ai' ? newHand : state.aiPegHand,
      playerPlayedPeg: player === 'player' ? newPlayed : state.playerPlayedPeg,
      aiPlayedPeg: player === 'ai' ? newPlayed : state.aiPlayedPeg,
      pegCount: newCount,
      pegPlays: newPlays,
      playerScore: newPlayerScore,
      aiScore: newAiScore,
      phase: 'game-over',
      lastPegPoints: points > 0 ? { player, points, reason } : null,
      message: newPlayerScore >= TARGET_SCORE ? 'You win!' : 'AI wins!',
    }
  }

  // Determine next player
  const opponent: 'player' | 'ai' = player === 'player' ? 'ai' : 'player'
  const opponentHand = opponent === 'player' ? state.playerPegHand : newHand === state.aiPegHand ? state.aiPegHand : (player === 'ai' ? newHand : state.aiPegHand)
  // Fix: get correct opponent hand
  const actualOpponentHand = opponent === 'player'
    ? (player === 'player' ? state.playerPegHand : state.playerPegHand)
    : (player === 'ai' ? newHand : state.aiPegHand)
  const myRemainingHand = newHand
  const oppHand = opponent === 'player' ? state.playerPegHand : state.aiPegHand

  // If count is 31, reset
  let nextCount = newCount
  let nextPlays = newPlays
  if (newCount === 31) {
    nextCount = 0
    nextPlays = []
  }

  // Check if both players are out of cards
  const playerCardsLeft = player === 'player' ? newHand.length : state.playerPegHand.length
  const aiCardsLeft = player === 'ai' ? newHand.length : state.aiPegHand.length

  if (playerCardsLeft === 0 && aiCardsLeft === 0) {
    // Last card bonus (1 point if not 31)
    if (newCount !== 31 && newCount > 0) {
      if (player === 'player') newPlayerScore += 1
      else newAiScore += 1
      points += 1
      reason = reason ? reason + ', last card' : 'last card'
    }

    // Move to counting phase
    return {
      ...state,
      playerPegHand: player === 'player' ? newHand : state.playerPegHand,
      aiPegHand: player === 'ai' ? newHand : state.aiPegHand,
      playerPlayedPeg: player === 'player' ? newPlayed : state.playerPlayedPeg,
      aiPlayedPeg: player === 'ai' ? newPlayed : state.aiPlayedPeg,
      pegCount: 0,
      pegPlays: [],
      playerScore: newPlayerScore,
      aiScore: newAiScore,
      phase: 'counting',
      consecutivePasses: 0,
      lastPegPoints: points > 0 ? { player, points, reason } : null,
      message: 'Pegging complete! Counting hands...',
    }
  }

  // Check if opponent can play
  const canOpponentPlay = oppHand.some(c => pegValue(c) + nextCount <= 31)

  let nextPlayer: 'player' | 'ai'
  if (canOpponentPlay) {
    nextPlayer = opponent
  } else if (myRemainingHand.some(c => pegValue(c) + nextCount <= 31)) {
    nextPlayer = player
    // Opponent says "Go"
  } else {
    // Neither can play - give last card point, reset count
    if (nextCount > 0 && nextCount !== 31) {
      if (player === 'player') newPlayerScore += 1
      else newAiScore += 1
    }
    nextCount = 0
    nextPlays = []
    // Next player is whoever has cards
    nextPlayer = oppHand.length > 0 ? opponent : player
  }

  return {
    ...state,
    playerPegHand: player === 'player' ? newHand : state.playerPegHand,
    aiPegHand: player === 'ai' ? newHand : state.aiPegHand,
    playerPlayedPeg: player === 'player' ? newPlayed : state.playerPlayedPeg,
    aiPlayedPeg: player === 'ai' ? newPlayed : state.aiPlayedPeg,
    pegCount: nextCount,
    pegPlays: nextPlays,
    currentPlayer: nextPlayer,
    playerScore: newPlayerScore,
    aiScore: newAiScore,
    consecutivePasses: 0,
    lastPegPoints: points > 0 ? { player, points, reason } : null,
    message: points > 0
      ? `${player === 'player' ? 'You' : 'AI'}: ${reason} (+${points})`
      : `Count: ${nextCount}. ${nextPlayer === 'player' ? 'Your' : "AI's"} turn.`,
  }
}

export function pegPass(state: CribbageState, player: 'player' | 'ai'): CribbageState {
  if (state.phase !== 'pegging' || state.currentPlayer !== player) return state

  const newPasses = state.consecutivePasses + 1
  const opponent: 'player' | 'ai' = player === 'player' ? 'ai' : 'player'

  if (newPasses >= 2) {
    // Both passed - give "Go" point to last player who played, reset count
    let newPlayerScore = state.playerScore
    let newAiScore = state.aiScore
    const lastPlayer = state.pegPlays.length > 0 ? state.pegPlays[state.pegPlays.length - 1].playerId : player

    if (state.pegCount > 0) {
      if (lastPlayer === 'player') newPlayerScore += 1
      else newAiScore += 1
    }

    // Check if both out of cards
    if (state.playerPegHand.length === 0 && state.aiPegHand.length === 0) {
      return {
        ...state,
        pegCount: 0,
        pegPlays: [],
        consecutivePasses: 0,
        playerScore: newPlayerScore,
        aiScore: newAiScore,
        phase: 'counting',
        message: 'Pegging complete! Counting hands...',
      }
    }

    // Reset count, continue with whoever has cards
    const nextPlayer = state.playerPegHand.length > 0 ? 'player' :
      state.aiPegHand.length > 0 ? 'ai' : 'player'

    return {
      ...state,
      pegCount: 0,
      pegPlays: [],
      consecutivePasses: 0,
      currentPlayer: nextPlayer,
      playerScore: newPlayerScore,
      aiScore: newAiScore,
      message: `Go! ${lastPlayer === 'player' ? 'You' : 'AI'} +1. Count reset.`,
    }
  }

  return {
    ...state,
    currentPlayer: opponent,
    consecutivePasses: newPasses,
    message: `${player === 'player' ? 'You' : 'AI'} say "Go". ${opponent === 'player' ? 'Your' : "AI's"} turn.`,
  }
}

function scorePegPairs(plays: PegPlay[]): number {
  if (plays.length < 2) return 0
  const last = plays[plays.length - 1].card.rank
  let count = 0
  for (let i = plays.length - 2; i >= 0; i--) {
    if (plays[i].card.rank === last) count++
    else break
  }
  if (count === 1) return 2
  if (count === 2) return 6
  if (count >= 3) return 12
  return 0
}

function scorePegRun(plays: PegPlay[]): number {
  if (plays.length < 3) return 0

  // Check runs of decreasing length
  for (let len = Math.min(plays.length, 7); len >= 3; len--) {
    const lastN = plays.slice(-len).map(p => cardOrder(p.card))
    const sorted = [...lastN].sort((a, b) => a - b)

    // Check consecutive
    let isRun = true
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isRun = false
        break
      }
    }
    if (isRun) return len
  }
  return 0
}

// ─── Hand Scoring ───────────────────────────────────────────────────────────

export function scoreHand(hand: Card[], starter: Card | null, isCrib: boolean): number {
  const cards = starter ? [...hand, starter] : [...hand]
  let total = 0

  // 15s
  total += scoreFifteens(cards)

  // Pairs
  total += scorePairs(cards)

  // Runs
  total += scoreRuns(cards)

  // Flush
  if (hand.length === 4) {
    const handSuit = hand[0].suit
    const allSameSuit = hand.every(c => c.suit === handSuit)
    if (allSameSuit) {
      if (starter && starter.suit === handSuit) {
        total += 5  // 5-card flush
      } else if (!isCrib) {
        total += 4  // 4-card flush (not in crib)
      }
    }
  }

  // Nobs (Jack of starter suit in hand)
  if (starter) {
    const hasNobs = hand.some(c => c.rank === 'J' && c.suit === starter.suit)
    if (hasNobs) total += 1
  }

  return total
}

function getHandScoreDetails(hand: Card[], starter: Card | null, isCrib: boolean) {
  const cards = starter ? [...hand, starter] : [...hand]
  const fifteens = scoreFifteens(cards)
  const pairs = scorePairs(cards)
  const runs = scoreRuns(cards)

  let flush = 0
  if (hand.length === 4) {
    const handSuit = hand[0].suit
    const allSameSuit = hand.every(c => c.suit === handSuit)
    if (allSameSuit) {
      if (starter && starter.suit === handSuit) flush = 5
      else if (!isCrib) flush = 4
    }
  }

  let nobs = 0
  if (starter) {
    const hasNobs = hand.some(c => c.rank === 'J' && c.suit === starter.suit)
    if (hasNobs) nobs = 1
  }

  return {
    total: fifteens + pairs + runs + flush + nobs,
    fifteens,
    pairs,
    runs,
    flush,
    nobs,
  }
}

function scoreFifteens(cards: Card[]): number {
  let count = 0
  const n = cards.length
  // Check all subsets
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += pegValue(cards[i])
      }
    }
    if (sum === 15) count++
  }
  return count * 2
}

function scorePairs(cards: Card[]): number {
  let count = 0
  for (let i = 0; i < cards.length; i++) {
    for (let j = i + 1; j < cards.length; j++) {
      if (cards[i].rank === cards[j].rank) count++
    }
  }
  return count * 2
}

function scoreRuns(cards: Card[]): number {
  const n = cards.length
  let bestRunLen = 0
  let bestRunCount = 0

  // Check all subsets of size 3, 4, 5
  for (let len = 5; len >= 3; len--) {
    if (len <= bestRunLen) break

    let runCount = 0
    // Generate all combinations of size `len`
    const combos = getCombinations(cards, len)
    for (const combo of combos) {
      const values = combo.map(c => cardOrder(c)).sort((a, b) => a - b)
      let isRun = true
      for (let i = 1; i < values.length; i++) {
        if (values[i] !== values[i - 1] + 1) {
          isRun = false
          break
        }
      }
      if (isRun) runCount++
    }
    if (runCount > 0) {
      bestRunLen = len
      bestRunCount = runCount
      break
    }
  }

  return bestRunLen * bestRunCount
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length === 0) return []
  const [first, ...rest] = arr
  const withFirst = getCombinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = getCombinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

// ─── Counting Phase ─────────────────────────────────────────────────────────

export function countHands(state: CribbageState): CribbageState {
  if (state.phase !== 'counting') return state
  if (!state.starter) return state

  // Non-dealer counts first, then dealer, then crib (dealer's)
  const nonDealer: 'player' | 'ai' = state.dealer === 'player' ? 'ai' : 'player'
  const dealerIs = state.dealer

  const nonDealerHand = nonDealer === 'player' ? state.playerHand : state.aiHand
  const dealerHand = dealerIs === 'player' ? state.playerHand : state.aiHand

  const nonDealerDetails = getHandScoreDetails(nonDealerHand, state.starter, false)
  const dealerDetails = getHandScoreDetails(dealerHand, state.starter, false)
  const cribDetails = getHandScoreDetails(state.crib, state.starter, true)

  let playerTotal = state.playerScore
  let aiTotal = state.aiScore

  if (nonDealer === 'player') {
    playerTotal += nonDealerDetails.total
    aiTotal += dealerDetails.total + cribDetails.total
  } else {
    aiTotal += nonDealerDetails.total
    playerTotal += dealerDetails.total + cribDetails.total
  }

  const isGameOver = playerTotal >= TARGET_SCORE || aiTotal >= TARGET_SCORE

  const playerDetails = nonDealer === 'player'
    ? nonDealerDetails
    : { ...dealerDetails, total: dealerDetails.total + cribDetails.total, fifteens: dealerDetails.fifteens + cribDetails.fifteens, pairs: dealerDetails.pairs + cribDetails.pairs, runs: dealerDetails.runs + cribDetails.runs, flush: dealerDetails.flush + cribDetails.flush, nobs: dealerDetails.nobs + cribDetails.nobs }

  const aiDetails = nonDealer === 'ai'
    ? nonDealerDetails
    : { ...dealerDetails, total: dealerDetails.total + cribDetails.total, fifteens: dealerDetails.fifteens + cribDetails.fifteens, pairs: dealerDetails.pairs + cribDetails.pairs, runs: dealerDetails.runs + cribDetails.runs, flush: dealerDetails.flush + cribDetails.flush, nobs: dealerDetails.nobs + cribDetails.nobs }

  return {
    ...state,
    playerScore: Math.min(playerTotal, TARGET_SCORE),
    aiScore: Math.min(aiTotal, TARGET_SCORE),
    phase: isGameOver ? 'game-over' : 'round-over',
    handScoreDetails: {
      player: nonDealer === 'player' ? nonDealerDetails : dealerDetails,
      ai: nonDealer === 'ai' ? nonDealerDetails : dealerDetails,
      crib: cribDetails,
    },
    message: isGameOver
      ? (playerTotal >= TARGET_SCORE ? 'You win!' : 'AI wins!')
      : `Hand: You +${nonDealer === 'player' ? nonDealerDetails.total : dealerDetails.total + cribDetails.total}, AI +${nonDealer === 'ai' ? nonDealerDetails.total : dealerDetails.total + cribDetails.total}`,
  }
}

export function nextRound(state: CribbageState): CribbageState {
  return dealNewRound(state)
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export function aiPegPlay(state: CribbageState, difficulty: 'easy' | 'medium' | 'hard'): string | null {
  const playable = getPlayablePegCards(state, 'ai')
  if (playable.length === 0) return null

  if (difficulty === 'easy') {
    return playable[Math.floor(Math.random() * playable.length)]
  }

  // Medium/Hard: prefer plays that score points
  let bestId = playable[0]
  let bestScore = -1

  for (const id of playable) {
    const card = state.aiPegHand.find(c => c.id === id)!
    const newCount = state.pegCount + pegValue(card)
    let score = 0

    if (newCount === 15) score += 2
    if (newCount === 31) score += 2

    // Check pairs
    const tempPlays = [...state.pegPlays, { playerId: 'ai' as const, card }]
    score += scorePegPairs(tempPlays)
    score += scorePegRun(tempPlays)

    if (difficulty === 'hard') {
      // Avoid setting up 15 or 31 for opponent
      if (newCount >= 5 && newCount < 15) score -= 1  // close to 15
      if (newCount > 21 && newCount < 31) score += 0.5  // near 31 is ok
    }

    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }

  return bestId
}
