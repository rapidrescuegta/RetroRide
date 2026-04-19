// ─── Texas Hold'em Poker – Multiplayer Game Config ──────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// Full Texas Hold'em: pre-flop, flop, turn, river with betting rounds.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  sortHand,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export type PokerPhase = 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'round-over' | 'game-over'

export interface PokerMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  communityCards: Card[]
  /** Chips. */
  chips: Record<string, number>
  /** Current round bets per player. */
  currentBets: Record<string, number>
  /** Total pot. */
  pot: number
  /** Current minimum bet to call. */
  currentCallAmount: number
  /** Big blind amount. */
  bigBlind: number
  /** Dealer button position. */
  dealerIndex: number
  /** Players who have folded. */
  folded: Record<string, boolean>
  /** Players who are all-in. */
  allIn: Record<string, boolean>
  /** Players who have acted this betting round. */
  hasActed: Record<string, boolean>
  phase: PokerPhase
  scores: Record<string, number>
  message: string
  lastAction: string | null
  /** Best hand description for each player at showdown. */
  handDescriptions: Record<string, string>
  roundNumber: number
}

// ─── Hand Evaluation ────────────────────────────────────────────────────────

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

/** Hand ranking categories (higher = better). */
enum HandRank {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
  RoyalFlush = 9,
}

interface EvaluatedHand {
  rank: HandRank
  /** Tiebreaker values, highest first. */
  kickers: number[]
  description: string
}

function evaluateBest5(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
  const allCards = [...holeCards, ...communityCards]
  if (allCards.length < 5) {
    return { rank: HandRank.HighCard, kickers: [0], description: 'High Card' }
  }

  // Generate all 5-card combinations
  const combos = combinations(allCards, 5)
  let best: EvaluatedHand = { rank: HandRank.HighCard, kickers: [0], description: 'High Card' }

  for (const combo of combos) {
    const evaluated = evaluate5Cards(combo)
    if (compareHands(evaluated, best) > 0) {
      best = evaluated
    }
  }

  return best
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

function evaluate5Cards(cards: Card[]): EvaluatedHand {
  const values = cards.map(c => RANK_VALUES[c.rank]).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)

  const isFlush = suits.every(s => s === suits[0])

  // Check straight
  let isStraight = false
  let straightHigh = 0
  const unique = [...new Set(values)].sort((a, b) => b - a)

  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      isStraight = true
      straightHigh = unique[0]
    }
    // Ace-low straight: A-2-3-4-5
    if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      isStraight = true
      straightHigh = 5
    }
  }

  // Count ranks
  const rankCounts: Record<number, number> = {}
  for (const v of values) {
    rankCounts[v] = (rankCounts[v] ?? 0) + 1
  }
  const counts = Object.entries(rankCounts)
    .map(([v, c]) => ({ value: parseInt(v), count: c }))
    .sort((a, b) => b.count - a.count || b.value - a.value)

  // Royal flush
  if (isFlush && isStraight && straightHigh === 14) {
    return { rank: HandRank.RoyalFlush, kickers: [14], description: 'Royal Flush' }
  }

  // Straight flush
  if (isFlush && isStraight) {
    return { rank: HandRank.StraightFlush, kickers: [straightHigh], description: `Straight Flush (${straightHigh} high)` }
  }

  // Four of a kind
  if (counts[0].count === 4) {
    return {
      rank: HandRank.FourOfAKind,
      kickers: [counts[0].value, counts[1].value],
      description: `Four of a Kind (${rankName(counts[0].value)}s)`,
    }
  }

  // Full house
  if (counts[0].count === 3 && counts[1].count === 2) {
    return {
      rank: HandRank.FullHouse,
      kickers: [counts[0].value, counts[1].value],
      description: `Full House (${rankName(counts[0].value)}s over ${rankName(counts[1].value)}s)`,
    }
  }

  // Flush
  if (isFlush) {
    return { rank: HandRank.Flush, kickers: values, description: `Flush (${rankName(values[0])} high)` }
  }

  // Straight
  if (isStraight) {
    return { rank: HandRank.Straight, kickers: [straightHigh], description: `Straight (${rankName(straightHigh)} high)` }
  }

  // Three of a kind
  if (counts[0].count === 3) {
    const kickers = counts.filter(c => c.count === 1).map(c => c.value)
    return {
      rank: HandRank.ThreeOfAKind,
      kickers: [counts[0].value, ...kickers],
      description: `Three of a Kind (${rankName(counts[0].value)}s)`,
    }
  }

  // Two pair
  if (counts[0].count === 2 && counts[1].count === 2) {
    const pairValues = [counts[0].value, counts[1].value].sort((a, b) => b - a)
    const kicker = counts[2].value
    return {
      rank: HandRank.TwoPair,
      kickers: [...pairValues, kicker],
      description: `Two Pair (${rankName(pairValues[0])}s and ${rankName(pairValues[1])}s)`,
    }
  }

  // One pair
  if (counts[0].count === 2) {
    const kickers = counts.filter(c => c.count === 1).map(c => c.value).sort((a, b) => b - a)
    return {
      rank: HandRank.OnePair,
      kickers: [counts[0].value, ...kickers],
      description: `Pair of ${rankName(counts[0].value)}s`,
    }
  }

  // High card
  return { rank: HandRank.HighCard, kickers: values, description: `High Card (${rankName(values[0])})` }
}

function compareHands(a: EvaluatedHand, b: EvaluatedHand): number {
  if (a.rank !== b.rank) return a.rank - b.rank
  for (let i = 0; i < Math.max(a.kickers.length, b.kickers.length); i++) {
    const ak = a.kickers[i] ?? 0
    const bk = b.kickers[i] ?? 0
    if (ak !== bk) return ak - bk
  }
  return 0
}

function rankName(value: number): string {
  const names: Record<number, string> = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
    9: '9', 10: '10', 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
  }
  return names[value] ?? String(value)
}

function drawCard(deck: Card[]): { card: Card; deck: Card[] } {
  const card = { ...deck[0], faceUp: true }
  return { card, deck: deck.slice(1) }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const pokerMultiplayer: MultiplayerGameConfig<PokerMultiplayerState> = {
  gameType: 'poker',
  minPlayers: 2,
  maxPlayers: 6,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const playerOrder = players.map(p => p.id)
    const bigBlind = 20
    const chips: Record<string, number> = {}
    const scores: Record<string, number> = {}
    const currentBets: Record<string, number> = {}
    const folded: Record<string, boolean> = {}
    const allIn: Record<string, boolean> = {}
    const hasActed: Record<string, boolean> = {}

    for (const p of players) {
      chips[p.id] = 1000
      scores[p.id] = 1000
      currentBets[p.id] = 0
      folded[p.id] = false
      allIn[p.id] = false
      hasActed[p.id] = false
    }

    const hands: Record<string, Card[]> = {}
    for (const p of players) {
      hands[p.id] = []
    }

    const state: PokerMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck,
      communityCards: [],
      chips,
      currentBets,
      pot: 0,
      currentCallAmount: bigBlind,
      bigBlind,
      dealerIndex: 0,
      folded,
      allIn,
      hasActed,
      phase: 'pre-flop',
      scores,
      message: 'Starting hand...',
      lastAction: null,
      handDescriptions: {},
      roundNumber: 1,
    }

    return dealNewHand(state, hands)
  },

  processAction(
    state: PokerMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    if (state.phase === 'showdown' || state.phase === 'round-over' || state.phase === 'game-over') {
      if (type === 'next-round') {
        return startNextRound(state, newHands)
      }
      return { state, hands, broadcast: null, error: 'Round is over' }
    }

    if (playerId !== state.currentTurnPlayerId) {
      return { state, hands, broadcast: null, error: 'Not your turn' }
    }

    if (state.folded[playerId]) {
      return { state, hands, broadcast: null, error: 'You have folded' }
    }

    switch (type) {
      case 'fold': {
        const newFolded = { ...state.folded, [playerId]: true }
        const newHasActed = { ...state.hasActed, [playerId]: true }

        // Check if only one player remains
        const remaining = state.playerOrder.filter(pid => !newFolded[pid])
        if (remaining.length === 1) {
          // Last player wins the pot
          const winnerId = remaining[0]
          const newChips = { ...state.chips }
          newChips[winnerId] += state.pot
          const newScores = { ...newChips }

          const newState: PokerMultiplayerState = {
            ...state,
            folded: newFolded,
            hasActed: newHasActed,
            chips: newChips,
            scores: newScores,
            phase: 'round-over',
            message: `Everyone folded! Pot awarded.`,
            lastAction: `${playerId} folded`,
          }
          return { state: newState, hands: newHands, broadcast: { action: 'fold-win', winnerId } }
        }

        return advanceBetting({ ...state, folded: newFolded, hasActed: newHasActed, lastAction: `folded` }, newHands)
      }

      case 'call': {
        const callAmount = state.currentCallAmount - state.currentBets[playerId]
        if (callAmount <= 0) {
          return { state, hands, broadcast: null, error: 'Nothing to call' }
        }

        const actualCall = Math.min(callAmount, state.chips[playerId])
        const newChips = { ...state.chips }
        newChips[playerId] -= actualCall
        const newBets = { ...state.currentBets }
        newBets[playerId] += actualCall
        const newPot = state.pot + actualCall
        const newAllIn = { ...state.allIn }
        if (newChips[playerId] === 0) newAllIn[playerId] = true
        const newHasActed = { ...state.hasActed, [playerId]: true }

        return advanceBetting({
          ...state,
          chips: newChips,
          currentBets: newBets,
          pot: newPot,
          allIn: newAllIn,
          hasActed: newHasActed,
          lastAction: actualCall === callAmount ? 'called' : 'called (all-in)',
        }, newHands)
      }

      case 'check': {
        if (state.currentBets[playerId] < state.currentCallAmount) {
          return { state, hands, broadcast: null, error: 'Cannot check — must call or raise' }
        }
        const newHasActed = { ...state.hasActed, [playerId]: true }

        return advanceBetting({
          ...state,
          hasActed: newHasActed,
          lastAction: 'checked',
        }, newHands)
      }

      case 'raise': {
        const raiseAmount = data.amount as number
        if (raiseAmount < state.bigBlind) {
          return { state, hands, broadcast: null, error: `Minimum raise is ${state.bigBlind}` }
        }

        const totalBet = state.currentCallAmount + raiseAmount
        const additionalCost = totalBet - state.currentBets[playerId]

        if (additionalCost > state.chips[playerId]) {
          return { state, hands, broadcast: null, error: 'Not enough chips' }
        }

        const newChips = { ...state.chips }
        newChips[playerId] -= additionalCost
        const newBets = { ...state.currentBets }
        newBets[playerId] = totalBet
        const newPot = state.pot + additionalCost
        const newAllIn = { ...state.allIn }
        if (newChips[playerId] === 0) newAllIn[playerId] = true

        // Reset hasActed for everyone else (they need to respond to the raise)
        const newHasActed: Record<string, boolean> = {}
        for (const pid of state.playerOrder) {
          newHasActed[pid] = pid === playerId ? true : (state.folded[pid] || state.allIn[pid])
        }

        return advanceBetting({
          ...state,
          chips: newChips,
          currentBets: newBets,
          pot: newPot,
          currentCallAmount: totalBet,
          allIn: newAllIn,
          hasActed: newHasActed,
          lastAction: `raised ${raiseAmount}`,
        }, newHands)
      }

      case 'all-in': {
        const amount = state.chips[playerId]
        if (amount <= 0) {
          return { state, hands, broadcast: null, error: 'No chips to go all-in' }
        }

        const newChips = { ...state.chips }
        newChips[playerId] = 0
        const newBets = { ...state.currentBets }
        newBets[playerId] += amount
        const newPot = state.pot + amount
        const newAllIn = { ...state.allIn, [playerId]: true }

        // If this raises the call amount, reset hasActed
        const newCallAmount = Math.max(state.currentCallAmount, newBets[playerId])
        const newHasActed: Record<string, boolean> = {}
        for (const pid of state.playerOrder) {
          if (pid === playerId || state.folded[pid] || state.allIn[pid]) {
            newHasActed[pid] = true
          } else {
            newHasActed[pid] = newCallAmount === state.currentCallAmount ? state.hasActed[pid] : false
          }
        }

        return advanceBetting({
          ...state,
          chips: newChips,
          currentBets: newBets,
          pot: newPot,
          currentCallAmount: newCallAmount,
          allIn: newAllIn,
          hasActed: newHasActed,
          lastAction: `went all-in (${amount})`,
        }, newHands)
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: PokerMultiplayerState) {
    if (state.phase === 'game-over') {
      let maxChips = 0
      let winner = state.playerOrder[0]
      for (const pid of state.playerOrder) {
        if (state.chips[pid] > maxChips) {
          maxChips = state.chips[pid]
          winner = pid
        }
      }
      return { isOver: true, scores: state.scores, winner }
    }

    // After a round, check if only one player has chips
    if (state.phase === 'round-over' && state.roundNumber >= 2) {
      const withChips = state.playerOrder.filter(pid => state.chips[pid] > 0)
      if (withChips.length <= 1) {
        return {
          isOver: true,
          scores: state.scores,
          winner: withChips[0] ?? state.playerOrder[0],
        }
      }
    }

    return { isOver: false }
  },

  getPublicState(state: PokerMultiplayerState) {
    return {
      playerOrder: state.playerOrder,
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      communityCards: state.communityCards,
      chips: state.chips,
      currentBets: state.currentBets,
      pot: state.pot,
      currentCallAmount: state.currentCallAmount,
      bigBlind: state.bigBlind,
      dealerIndex: state.dealerIndex,
      folded: state.folded,
      allIn: state.allIn,
      phase: state.phase,
      scores: state.scores,
      message: state.message,
      lastAction: state.lastAction,
      handDescriptions: state.phase === 'showdown' || state.phase === 'round-over'
        ? state.handDescriptions
        : {},
      roundNumber: state.roundNumber,
    }
  },
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function dealNewHand(
  state: PokerMultiplayerState,
  hands: Record<string, Card[]>
): { state: PokerMultiplayerState; hands: Record<string, Card[]> } {
  let deck = shuffleDeck(createDeck())
  const newHands = { ...hands }
  const playerOrder = state.playerOrder
  const activePlayers = playerOrder.filter(pid => state.chips[pid] > 0)

  // Deal 2 hole cards to each active player
  for (const pid of playerOrder) {
    if (state.chips[pid] > 0) {
      const { card: c1, deck: d1 } = drawCard(deck)
      deck = d1
      const { card: c2, deck: d2 } = drawCard(deck)
      deck = d2
      newHands[pid] = [c1, c2]
    } else {
      newHands[pid] = []
    }
  }

  // Post blinds
  const numActive = activePlayers.length
  const smallBlindIdx = numActive >= 3
    ? (state.dealerIndex + 1) % playerOrder.length
    : state.dealerIndex
  const bigBlindIdx = numActive >= 3
    ? (state.dealerIndex + 2) % playerOrder.length
    : (state.dealerIndex + 1) % playerOrder.length

  // Find actual active players for blind positions
  const sbPlayer = findNextActive(playerOrder, smallBlindIdx, state.chips, state.folded)
  const bbPlayer = findNextActive(playerOrder, bigBlindIdx, state.chips, state.folded)

  const newChips = { ...state.chips }
  const newBets: Record<string, number> = {}
  const newFolded: Record<string, boolean> = {}
  const newAllIn: Record<string, boolean> = {}
  const newHasActed: Record<string, boolean> = {}

  for (const pid of playerOrder) {
    newBets[pid] = 0
    newFolded[pid] = state.chips[pid] <= 0  // auto-fold broke players
    newAllIn[pid] = false
    newHasActed[pid] = state.chips[pid] <= 0
  }

  // Post small blind
  if (sbPlayer) {
    const sb = Math.min(state.bigBlind / 2, newChips[sbPlayer])
    newChips[sbPlayer] -= sb
    newBets[sbPlayer] = sb
    if (newChips[sbPlayer] === 0) newAllIn[sbPlayer] = true
  }

  // Post big blind
  let pot = 0
  if (bbPlayer) {
    const bb = Math.min(state.bigBlind, newChips[bbPlayer])
    newChips[bbPlayer] -= bb
    newBets[bbPlayer] = bb
    if (newChips[bbPlayer] === 0) newAllIn[bbPlayer] = true
  }

  for (const pid of playerOrder) {
    pot += newBets[pid]
  }

  // First to act is after big blind
  const firstActIdx = findNextActiveIndex(playerOrder, bigBlindIdx + 1, newChips, newFolded, newAllIn)
  const firstActor = firstActIdx >= 0 ? playerOrder[firstActIdx] : playerOrder[0]

  const newState: PokerMultiplayerState = {
    ...state,
    deck,
    communityCards: [],
    chips: newChips,
    currentBets: newBets,
    pot,
    currentCallAmount: state.bigBlind,
    folded: newFolded,
    allIn: newAllIn,
    hasActed: newHasActed,
    phase: 'pre-flop',
    currentTurnIndex: firstActIdx >= 0 ? firstActIdx : 0,
    currentTurnPlayerId: firstActor,
    message: 'Pre-flop betting',
    lastAction: 'dealt',
    handDescriptions: {},
  }

  return { state: newState, hands: newHands }
}

function findNextActive(
  order: string[],
  startIdx: number,
  chips: Record<string, number>,
  folded: Record<string, boolean>
): string | null {
  for (let i = 0; i < order.length; i++) {
    const idx = (startIdx + i) % order.length
    const pid = order[idx]
    if (chips[pid] > 0 && !folded[pid]) return pid
  }
  return null
}

function findNextActiveIndex(
  order: string[],
  startIdx: number,
  chips: Record<string, number>,
  folded: Record<string, boolean>,
  allIn: Record<string, boolean>
): number {
  for (let i = 0; i < order.length; i++) {
    const idx = (startIdx + i) % order.length
    const pid = order[idx]
    if (chips[pid] > 0 && !folded[pid] && !allIn[pid]) return idx
  }
  return -1
}

function advanceBetting(
  state: PokerMultiplayerState,
  hands: Record<string, Card[]>
): { state: PokerMultiplayerState; hands: Record<string, Card[]>; broadcast: any; error?: string } {
  // Check if betting round is complete
  const activePlayers = state.playerOrder.filter(
    pid => !state.folded[pid] && !state.allIn[pid]
  )

  const allActed = activePlayers.every(pid => state.hasActed[pid])
  const allMatched = activePlayers.every(pid => state.currentBets[pid] >= state.currentCallAmount)

  if (allActed && allMatched) {
    // Betting round complete — advance phase
    return advancePhase(state, hands)
  }

  // Find next player to act
  const nextIdx = findNextActiveIndex(
    state.playerOrder,
    state.currentTurnIndex + 1,
    state.chips,
    state.folded,
    state.allIn
  )

  // If no next player can act, advance phase
  if (nextIdx < 0 || (state.hasActed[state.playerOrder[nextIdx]] && state.currentBets[state.playerOrder[nextIdx]] >= state.currentCallAmount)) {
    return advancePhase(state, hands)
  }

  const newState: PokerMultiplayerState = {
    ...state,
    currentTurnIndex: nextIdx,
    currentTurnPlayerId: state.playerOrder[nextIdx],
  }

  return { state: newState, hands, broadcast: { action: state.lastAction } }
}

function advancePhase(
  state: PokerMultiplayerState,
  hands: Record<string, Card[]>
): { state: PokerMultiplayerState; hands: Record<string, Card[]>; broadcast: any } {
  let deck = [...state.deck]
  let communityCards = [...state.communityCards]
  let nextPhase: PokerPhase

  // Reset bets for new betting round
  const newBets: Record<string, number> = {}
  for (const pid of state.playerOrder) {
    newBets[pid] = 0
  }

  const resetHasActed: Record<string, boolean> = {}
  for (const pid of state.playerOrder) {
    resetHasActed[pid] = state.folded[pid] || state.allIn[pid]
  }

  switch (state.phase) {
    case 'pre-flop': {
      // Deal flop (3 cards)
      for (let i = 0; i < 3; i++) {
        const { card, deck: d } = drawCard(deck)
        communityCards.push(card)
        deck = d
      }
      nextPhase = 'flop'
      break
    }
    case 'flop': {
      // Deal turn (1 card)
      const { card, deck: d } = drawCard(deck)
      communityCards.push(card)
      deck = d
      nextPhase = 'turn'
      break
    }
    case 'turn': {
      // Deal river (1 card)
      const { card, deck: d } = drawCard(deck)
      communityCards.push(card)
      deck = d
      nextPhase = 'river'
      break
    }
    case 'river':
    default: {
      // Showdown
      return resolveShowdown({ ...state, deck, communityCards, currentBets: newBets }, hands)
    }
  }

  // Check if only one non-folded non-all-in player remains (everyone else folded or is all-in)
  const canAct = state.playerOrder.filter(
    pid => !state.folded[pid] && !state.allIn[pid] && state.chips[pid] > 0
  )

  if (canAct.length <= 1) {
    // No more betting possible — deal remaining community cards and go to showdown
    while (communityCards.length < 5) {
      const { card, deck: d } = drawCard(deck)
      communityCards.push(card)
      deck = d
    }
    return resolveShowdown({ ...state, deck, communityCards, currentBets: newBets, hasActed: resetHasActed }, hands)
  }

  // Find first active player after dealer
  const firstIdx = findNextActiveIndex(
    state.playerOrder,
    state.dealerIndex + 1,
    state.chips,
    state.folded,
    state.allIn
  )

  const newState: PokerMultiplayerState = {
    ...state,
    deck,
    communityCards,
    currentBets: newBets,
    currentCallAmount: 0,
    hasActed: resetHasActed,
    phase: nextPhase,
    currentTurnIndex: firstIdx >= 0 ? firstIdx : 0,
    currentTurnPlayerId: firstIdx >= 0 ? state.playerOrder[firstIdx] : state.playerOrder[0],
    message: `${nextPhase.charAt(0).toUpperCase() + nextPhase.slice(1)} betting`,
  }

  return { state: newState, hands, broadcast: { action: 'phase-advance', phase: nextPhase } }
}

function resolveShowdown(
  state: PokerMultiplayerState,
  hands: Record<string, Card[]>
): { state: PokerMultiplayerState; hands: Record<string, Card[]>; broadcast: any } {
  const activePlayers = state.playerOrder.filter(pid => !state.folded[pid])

  // Evaluate each player's best hand
  const evaluations: Record<string, EvaluatedHand> = {}
  const handDescriptions: Record<string, string> = {}

  for (const pid of activePlayers) {
    const playerHand = hands[pid] ?? []
    const evaluated = evaluateBest5(playerHand, state.communityCards)
    evaluations[pid] = evaluated
    handDescriptions[pid] = evaluated.description
  }

  // Find winner(s)
  let bestHand: EvaluatedHand | null = null
  let winners: string[] = []

  for (const pid of activePlayers) {
    const hand = evaluations[pid]
    if (!bestHand || compareHands(hand, bestHand) > 0) {
      bestHand = hand
      winners = [pid]
    } else if (compareHands(hand, bestHand) === 0) {
      winners.push(pid)
    }
  }

  // Split pot among winners
  const newChips = { ...state.chips }
  const share = Math.floor(state.pot / winners.length)
  const remainder = state.pot - share * winners.length
  for (let i = 0; i < winners.length; i++) {
    newChips[winners[i]] += share + (i === 0 ? remainder : 0)
  }

  const newScores = { ...newChips }

  const winnerMsg = winners.length === 1
    ? `${winners[0]} wins with ${bestHand?.description}!`
    : `Split pot! ${winners.join(', ')} tie with ${bestHand?.description}`

  const newState: PokerMultiplayerState = {
    ...state,
    chips: newChips,
    scores: newScores,
    phase: 'round-over',
    handDescriptions,
    message: winnerMsg,
    lastAction: 'showdown',
  }

  return { state: newState, hands, broadcast: { action: 'showdown', winners, handDescriptions } }
}

function startNextRound(
  state: PokerMultiplayerState,
  hands: Record<string, Card[]>
): { state: PokerMultiplayerState; hands: Record<string, Card[]>; broadcast: any; error?: string } {
  const playersWithChips = state.playerOrder.filter(pid => state.chips[pid] > 0)
  if (playersWithChips.length <= 1) {
    const winner = playersWithChips[0] ?? state.playerOrder[0]
    const newState: PokerMultiplayerState = {
      ...state,
      phase: 'game-over',
      message: `Game over! ${winner} wins!`,
    }
    return { state: newState, hands, broadcast: { action: 'game-over', winner } }
  }

  // Move dealer button
  const nextDealerIndex = (state.dealerIndex + 1) % state.playerOrder.length

  const baseState: PokerMultiplayerState = {
    ...state,
    dealerIndex: nextDealerIndex,
    roundNumber: state.roundNumber + 1,
    pot: 0,
  }

  const result = dealNewHand(baseState, hands)
  return { state: result.state, hands: result.hands, broadcast: { action: 'next-round' } }
}
