// ─── Cribbage – Multiplayer Game Config ───────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// 2-player game: discard to crib, peg cards to 31, score hands. First to 121 wins.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── Constants ───────────────────────────────────────────────────────────────

const RANK_PEG_VALUE: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
}

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

const TARGET_SCORE = 121

// ─── Types ───────────────────────────────────────────────────────────────────

interface PegPlay { playerId: string; card: Card }

interface ScoreBreakdown {
  total: number
  fifteens: number
  pairs: number
  runs: number
  flush: number
  nobs: number
}

type Phase = 'discard' | 'cut' | 'pegging' | 'counting' | 'round-over' | 'game-over'

export interface CribbageMultiplayerState {
  playerOrder: [string, string]
  dealer: number                  // 0 or 1 index into playerOrder
  currentPlayer: number
  phase: Phase
  deck: Card[]
  crib: Card[]
  starter: Card | null
  scores: Record<string, number>
  pegCount: number
  pegPlays: PegPlay[]
  pegHands: Record<string, Card[]>     // Cards remaining to peg
  playedPeg: Record<string, Card[]>    // Cards already pegged
  consecutivePasses: number
  discardSelections: Record<string, string[]>  // Player -> selected card IDs
  discardsDone: Record<string, boolean>
  roundNumber: number
  message: string
  lastAction: string | null
  lastPegPoints: { playerId: string; points: number; reason: string } | null
  handScores: {
    nonDealer: ScoreBreakdown
    dealer: ScoreBreakdown
    crib: ScoreBreakdown
  } | null
  hisHeels: boolean
}

// ─── Scoring Helpers ─────────────────────────────────────────────────────────

function pegValue(card: Card): number {
  return RANK_PEG_VALUE[card.rank]
}

function scoreFifteens(cards: Card[]): number {
  const n = cards.length
  let count = 0
  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) sum += pegValue(cards[i])
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
  // Check descending sizes
  for (let size = n; size >= 3; size--) {
    let totalRuns = 0
    const combos = getCombinations(cards, size)
    for (const combo of combos) {
      const sorted = combo.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b)
      let isRun = true
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) { isRun = false; break }
      }
      if (isRun) totalRuns++
    }
    if (totalRuns > 0) return totalRuns * size
  }
  return 0
}

function getCombinations(arr: Card[], size: number): Card[][] {
  if (size === 0) return [[]]
  if (arr.length < size) return []
  const result: Card[][] = []
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = getCombinations(arr.slice(i + 1), size - 1)
    for (const combo of rest) result.push([arr[i], ...combo])
  }
  return result
}

function scoreFlush(hand: Card[], starter: Card, isCrib: boolean): number {
  const suits = hand.map(c => c.suit)
  const allSame = suits.every(s => s === suits[0])
  if (!allSame) return 0
  if (starter.suit === suits[0]) return 5
  return isCrib ? 0 : 4 // Crib only scores 5-card flush
}

function scoreNobs(hand: Card[], starter: Card): number {
  return hand.some(c => c.rank === 'J' && c.suit === starter.suit) ? 1 : 0
}

function scoreHand(hand: Card[], starter: Card, isCrib: boolean): ScoreBreakdown {
  const all = [...hand, starter]
  return {
    fifteens: scoreFifteens(all),
    pairs: scorePairs(all),
    runs: scoreRuns(all),
    flush: scoreFlush(hand, starter, isCrib),
    nobs: scoreNobs(hand, starter),
    total: scoreFifteens(all) + scorePairs(all) + scoreRuns(all) +
           scoreFlush(hand, starter, isCrib) + scoreNobs(hand, starter),
  }
}

// Peg scoring (pairs and runs from recent plays)
function scorePegPairs(plays: PegPlay[]): { points: number; reason: string } {
  if (plays.length < 2) return { points: 0, reason: '' }
  const lastRank = plays[plays.length - 1].card.rank
  let count = 0
  for (let i = plays.length - 2; i >= 0; i--) {
    if (plays[i].card.rank === lastRank) count++
    else break
  }
  if (count === 0) return { points: 0, reason: '' }
  if (count === 1) return { points: 2, reason: 'Pair' }
  if (count === 2) return { points: 6, reason: 'Three of a kind' }
  return { points: 12, reason: 'Four of a kind' }
}

function scorePegRun(plays: PegPlay[]): { points: number; reason: string } {
  if (plays.length < 3) return { points: 0, reason: '' }
  for (let len = Math.min(plays.length, 7); len >= 3; len--) {
    const recent = plays.slice(-len).map(p => RANK_ORDER[p.card.rank])
    const sorted = [...recent].sort((a, b) => a - b)
    let isRun = true
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) { isRun = false; break }
    }
    if (isRun) return { points: len, reason: `Run of ${len}` }
  }
  return { points: 0, reason: '' }
}

function getPlayablePegCards(pegHand: Card[], pegCount: number): Card[] {
  return pegHand.filter(c => pegValue(c) + pegCount <= 31)
}

// ─── Config ──────────────────────────────────────────────────────────────────

export const cribbageMultiplayer: MultiplayerGameConfig<CribbageMultiplayerState> = {
  gameType: 'cribbage',
  minPlayers: 2,
  maxPlayers: 2,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const playerOrder: [string, string] = [players[0].id, players[1].id]
    const hands: Record<string, Card[]> = {}
    const scores: Record<string, number> = {}

    // Deal 6 cards each
    hands[playerOrder[0]] = sortHand(deck.slice(0, 6).map(c => ({ ...c, faceUp: true })))
    hands[playerOrder[1]] = sortHand(deck.slice(6, 12).map(c => ({ ...c, faceUp: true })))
    scores[playerOrder[0]] = 0
    scores[playerOrder[1]] = 0

    const state: CribbageMultiplayerState = {
      playerOrder,
      dealer: 0,
      currentPlayer: 1, // Non-dealer discards first (both simultaneously though)
      phase: 'discard',
      deck: deck.slice(12),
      crib: [],
      starter: null,
      scores,
      pegCount: 0,
      pegPlays: [],
      pegHands: {},
      playedPeg: { [playerOrder[0]]: [], [playerOrder[1]]: [] },
      consecutivePasses: 0,
      discardSelections: { [playerOrder[0]]: [], [playerOrder[1]]: [] },
      discardsDone: { [playerOrder[0]]: false, [playerOrder[1]]: false },
      roundNumber: 1,
      message: 'Select 2 cards to send to the crib.',
      lastAction: null,
      lastPegPoints: null,
      handScores: null,
      hisHeels: false,
    }

    return { state, hands }
  },

  processAction(state, action, hands) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      // ─── Select cards for crib ─────────────────────────────────────
      case 'select-crib': {
        if (state.phase !== 'discard') return { state, hands, broadcast: null, error: 'Not in discard phase' }
        const cardIds = data.cardIds as string[]
        if (cardIds.length !== 2) return { state, hands, broadcast: null, error: 'Must select exactly 2 cards' }

        const playerHand = hands[playerId] ?? []
        for (const id of cardIds) {
          if (!playerHand.find(c => c.id === id)) {
            return { state, hands, broadcast: null, error: 'Card not in your hand' }
          }
        }

        const newDiscardsDone = { ...state.discardsDone, [playerId]: true }
        const newSelections = { ...state.discardSelections, [playerId]: cardIds }

        // Both players done?
        const otherPid = state.playerOrder[0] === playerId ? state.playerOrder[1] : state.playerOrder[0]
        if (newDiscardsDone[otherPid]) {
          // Move cards to crib, reduce hands to 4
          const crib: Card[] = []
          for (const pid of state.playerOrder) {
            const selected = newSelections[pid]
            const hand = hands[pid] ?? []
            const cribCards = hand.filter(c => selected.includes(c.id))
            crib.push(...cribCards)
            newHands[pid] = sortHand(removeCards(hand, selected))
          }

          const newState: CribbageMultiplayerState = {
            ...state,
            phase: 'cut',
            crib,
            discardsDone: newDiscardsDone,
            discardSelections: newSelections,
            message: 'Cut the deck for the starter card.',
            lastAction: 'discards done',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'discards-done' } }
        }

        const newState: CribbageMultiplayerState = {
          ...state,
          discardsDone: newDiscardsDone,
          discardSelections: newSelections,
          message: 'Waiting for other player to discard...',
          lastAction: 'selected crib cards',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'waiting-discard' } }
      }

      // ─── Cut deck ──────────────────────────────────────────────────
      case 'cut': {
        if (state.phase !== 'cut') return { state, hands, broadcast: null, error: 'Not in cut phase' }

        const starterIndex = Math.floor(Math.random() * state.deck.length)
        const starter = { ...state.deck[starterIndex], faceUp: true }
        const remaining = state.deck.filter((_, i) => i !== starterIndex)

        // His Heels: if starter is a Jack, dealer gets 2 points
        const dealerPid = state.playerOrder[state.dealer]
        const newScores = { ...state.scores }
        let hisHeels = false
        if (starter.rank === 'J') {
          newScores[dealerPid] = (newScores[dealerPid] ?? 0) + 2
          hisHeels = true
        }

        if (newScores[dealerPid] >= TARGET_SCORE) {
          const newState: CribbageMultiplayerState = {
            ...state,
            phase: 'game-over',
            starter,
            deck: remaining,
            scores: newScores,
            hisHeels,
            message: `His Heels! Game over!`,
            lastAction: 'his heels - game over',
          }
          return { state: newState, hands, broadcast: { action: 'game-over' } }
        }

        // Set up pegging — non-dealer plays first
        const nonDealer = state.dealer === 0 ? 1 : 0
        const pegHands: Record<string, Card[]> = {}
        for (const pid of state.playerOrder) {
          pegHands[pid] = [...(newHands[pid] ?? [])]
        }

        const newState: CribbageMultiplayerState = {
          ...state,
          phase: 'pegging',
          starter,
          deck: remaining,
          scores: newScores,
          hisHeels,
          currentPlayer: nonDealer,
          pegCount: 0,
          pegPlays: [],
          pegHands,
          playedPeg: { [state.playerOrder[0]]: [], [state.playerOrder[1]]: [] },
          consecutivePasses: 0,
          message: hisHeels
            ? `His Heels! Dealer gets 2 points. Non-dealer plays first.`
            : `Starter: ${starter.rank}. Non-dealer plays first.`,
          lastAction: 'cut',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'cut', starter } }
      }

      // ─── Peg a card ────────────────────────────────────────────────
      case 'peg': {
        if (state.phase !== 'pegging') return { state, hands, broadcast: null, error: 'Not pegging' }
        const playerIndex = state.playerOrder.indexOf(playerId)
        if (playerIndex !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn' }

        const cardId = data.cardId as string
        const pegHand = state.pegHands[playerId] ?? []
        const card = pegHand.find(c => c.id === cardId)
        if (!card) return { state, hands, broadcast: null, error: 'Card not available' }

        const cardVal = pegValue(card)
        if (state.pegCount + cardVal > 31) {
          return { state, hands, broadcast: null, error: 'Would exceed 31' }
        }

        const newPegCount = state.pegCount + cardVal
        const newPegPlays = [...state.pegPlays, { playerId, card }]
        const newPegHands = { ...state.pegHands, [playerId]: pegHand.filter(c => c.id !== cardId) }
        const newPlayedPeg = { ...state.playedPeg, [playerId]: [...(state.playedPeg[playerId] ?? []), card] }

        const newScores = { ...state.scores }
        let points = 0
        let reason = ''

        // Score: 15
        if (newPegCount === 15) { points += 2; reason = 'Fifteen' }
        // Score: 31
        if (newPegCount === 31) { points += 2; reason = reason ? reason + ' + 31' : 'Thirty-one' }
        // Score: pairs
        const pairResult = scorePegPairs(newPegPlays)
        if (pairResult.points > 0) { points += pairResult.points; reason = reason ? reason + ' + ' + pairResult.reason : pairResult.reason }
        // Score: runs
        const runResult = scorePegRun(newPegPlays)
        if (runResult.points > 0) { points += runResult.points; reason = reason ? reason + ' + ' + runResult.reason : runResult.reason }

        if (points > 0) newScores[playerId] = (newScores[playerId] ?? 0) + points

        if (newScores[playerId] >= TARGET_SCORE) {
          const newState: CribbageMultiplayerState = {
            ...state,
            phase: 'game-over',
            pegCount: newPegCount,
            pegPlays: newPegPlays,
            pegHands: newPegHands,
            playedPeg: newPlayedPeg,
            scores: newScores,
            lastPegPoints: points > 0 ? { playerId, points, reason } : null,
            message: `${reason || 'Pegged'}! Game over!`,
            lastAction: 'game over',
          }
          return { state: newState, hands, broadcast: { action: 'game-over' } }
        }

        // Determine next player / reset count if 31
        const otherIndex = playerIndex === 0 ? 1 : 0
        const otherPid = state.playerOrder[otherIndex]
        const otherPlayable = getPlayablePegCards(newPegHands[otherPid] ?? [], newPegCount === 31 ? 0 : newPegCount)
        const myPlayable = getPlayablePegCards(newPegHands[playerId] ?? [], newPegCount === 31 ? 0 : newPegCount)

        // All cards played?
        const allPlayed = (newPegHands[state.playerOrder[0]]?.length ?? 0) === 0 &&
                          (newPegHands[state.playerOrder[1]]?.length ?? 0) === 0

        if (allPlayed) {
          // Last card point (if not 31)
          if (newPegCount !== 31) {
            newScores[playerId] = (newScores[playerId] ?? 0) + 1
            if (!reason) reason = 'Last card'
            else reason += ' + Last card'
            points += 1
          }

          const newState: CribbageMultiplayerState = {
            ...state,
            phase: newScores[playerId] >= TARGET_SCORE ? 'game-over' : 'counting',
            pegCount: newPegCount,
            pegPlays: newPegPlays,
            pegHands: newPegHands,
            playedPeg: newPlayedPeg,
            consecutivePasses: 0,
            scores: newScores,
            lastPegPoints: points > 0 ? { playerId, points, reason } : null,
            message: 'Pegging complete. Scoring hands...',
            lastAction: 'pegging done',
          }
          return { state: newState, hands, broadcast: { action: 'pegging-done' } }
        }

        // Reset on 31
        let nextPegCount = newPegCount
        let nextPegPlays = newPegPlays
        if (newPegCount === 31) {
          nextPegCount = 0
          nextPegPlays = []
        }

        // Next player
        let nextPlayer = otherPlayable.length > 0 ? otherIndex : playerIndex
        if (otherPlayable.length === 0 && myPlayable.length === 0) {
          // Both stuck — reset count, "Go" point to last player
          if (newPegCount !== 31) {
            newScores[playerId] = (newScores[playerId] ?? 0) + 1
            points += 1
            reason = reason ? reason + ' + Go' : 'Go'
          }
          nextPegCount = 0
          nextPegPlays = []
          nextPlayer = otherIndex
        }

        const newState: CribbageMultiplayerState = {
          ...state,
          phase: 'pegging',
          pegCount: nextPegCount,
          pegPlays: nextPegPlays,
          pegHands: newPegHands,
          playedPeg: newPlayedPeg,
          currentPlayer: nextPlayer,
          consecutivePasses: 0,
          scores: newScores,
          lastPegPoints: points > 0 ? { playerId, points, reason } : null,
          message: points > 0 ? `+${points}: ${reason}` : 'Next player pegs.',
          lastAction: 'pegged',
        }
        return { state: newState, hands, broadcast: { action: 'peg', points, reason } }
      }

      // ─── Pass / Go ─────────────────────────────────────────────────
      case 'go': {
        if (state.phase !== 'pegging') return { state, hands, broadcast: null, error: 'Not pegging' }
        const playerIdx = state.playerOrder.indexOf(playerId)
        if (playerIdx !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn' }

        // Verify player can't play
        const playable = getPlayablePegCards(state.pegHands[playerId] ?? [], state.pegCount)
        if (playable.length > 0) return { state, hands, broadcast: null, error: 'You have playable cards' }

        const newPasses = state.consecutivePasses + 1
        const otherIdx = playerIdx === 0 ? 1 : 0
        const otherPid = state.playerOrder[otherIdx]

        // If both passed, "Go" point + reset
        if (newPasses >= 2) {
          const newScores = { ...state.scores }
          // Go point to the last player who played
          const lastPlayer = state.pegPlays.length > 0
            ? state.pegPlays[state.pegPlays.length - 1].playerId
            : otherPid
          newScores[lastPlayer] = (newScores[lastPlayer] ?? 0) + 1

          const newState: CribbageMultiplayerState = {
            ...state,
            pegCount: 0,
            pegPlays: [],
            currentPlayer: otherIdx,
            consecutivePasses: 0,
            scores: newScores,
            lastPegPoints: { playerId: lastPlayer, points: 1, reason: 'Go' },
            message: 'Go! Count resets.',
            lastAction: 'go',
          }
          return { state: newState, hands, broadcast: { action: 'go-reset' } }
        }

        const newState: CribbageMultiplayerState = {
          ...state,
          currentPlayer: otherIdx,
          consecutivePasses: newPasses,
          message: `${playerId} says Go.`,
          lastAction: 'go',
        }
        return { state: newState, hands, broadcast: { action: 'go' } }
      }

      // ─── Count hands ───────────────────────────────────────────────
      case 'count-hands': {
        if (state.phase !== 'counting') return { state, hands, broadcast: null, error: 'Not in counting phase' }
        if (!state.starter) return { state, hands, broadcast: null, error: 'No starter card' }

        const nonDealerIdx = state.dealer === 0 ? 1 : 0
        const nonDealerPid = state.playerOrder[nonDealerIdx]
        const dealerPid = state.playerOrder[state.dealer]

        const nonDealerHand = hands[nonDealerPid] ?? []
        const dealerHand = hands[dealerPid] ?? []

        const nonDealerScore = scoreHand(nonDealerHand, state.starter, false)
        const dealerScore = scoreHand(dealerHand, state.starter, false)
        const cribScore = scoreHand(state.crib, state.starter, true)

        const newScores = { ...state.scores }
        // Non-dealer scores first (can win before dealer)
        newScores[nonDealerPid] = (newScores[nonDealerPid] ?? 0) + nonDealerScore.total

        if (newScores[nonDealerPid] >= TARGET_SCORE) {
          const newState: CribbageMultiplayerState = {
            ...state,
            phase: 'game-over',
            scores: newScores,
            handScores: { nonDealer: nonDealerScore, dealer: dealerScore, crib: cribScore },
            message: `Non-dealer wins with ${nonDealerScore.total} points!`,
            lastAction: 'game over',
          }
          return { state: newState, hands, broadcast: { action: 'game-over' } }
        }

        // Dealer hand
        newScores[dealerPid] = (newScores[dealerPid] ?? 0) + dealerScore.total
        if (newScores[dealerPid] >= TARGET_SCORE) {
          const newState: CribbageMultiplayerState = {
            ...state,
            phase: 'game-over',
            scores: newScores,
            handScores: { nonDealer: nonDealerScore, dealer: dealerScore, crib: cribScore },
            message: `Dealer wins with ${dealerScore.total} points!`,
            lastAction: 'game over',
          }
          return { state: newState, hands, broadcast: { action: 'game-over' } }
        }

        // Crib (belongs to dealer)
        newScores[dealerPid] = (newScores[dealerPid] ?? 0) + cribScore.total
        const isGameOver = newScores[dealerPid] >= TARGET_SCORE

        const newState: CribbageMultiplayerState = {
          ...state,
          phase: isGameOver ? 'game-over' : 'round-over',
          scores: newScores,
          handScores: { nonDealer: nonDealerScore, dealer: dealerScore, crib: cribScore },
          message: isGameOver
            ? 'Game over!'
            : `Hand: ${nonDealerScore.total} | Dealer: ${dealerScore.total} | Crib: ${cribScore.total}`,
          lastAction: 'counted',
        }
        return { state: newState, hands, broadcast: { action: 'counted', handScores: newState.handScores } }
      }

      // ─── New round ─────────────────────────────────────────────────
      case 'new-round': {
        if (state.phase !== 'round-over') return { state, hands, broadcast: null, error: 'Not in round-over phase' }

        const deck = shuffleDeck(createDeck())
        const newDealer = state.dealer === 0 ? 1 : 0

        newHands[state.playerOrder[0]] = sortHand(deck.slice(0, 6).map(c => ({ ...c, faceUp: true })))
        newHands[state.playerOrder[1]] = sortHand(deck.slice(6, 12).map(c => ({ ...c, faceUp: true })))

        const newState: CribbageMultiplayerState = {
          ...state,
          dealer: newDealer,
          currentPlayer: newDealer === 0 ? 1 : 0,
          phase: 'discard',
          deck: deck.slice(12),
          crib: [],
          starter: null,
          pegCount: 0,
          pegPlays: [],
          pegHands: {},
          playedPeg: { [state.playerOrder[0]]: [], [state.playerOrder[1]]: [] },
          consecutivePasses: 0,
          discardSelections: { [state.playerOrder[0]]: [], [state.playerOrder[1]]: [] },
          discardsDone: { [state.playerOrder[0]]: false, [state.playerOrder[1]]: false },
          roundNumber: state.roundNumber + 1,
          message: `Round ${state.roundNumber + 1}. Select 2 cards for the crib.`,
          lastAction: null,
          lastPegPoints: null,
          handScores: null,
          hisHeels: false,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'new-round' } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state) {
    if (state.phase === 'game-over') {
      let winnerId = state.playerOrder[0]
      let maxScore = 0
      for (const pid of state.playerOrder) {
        if ((state.scores[pid] ?? 0) > maxScore) {
          maxScore = state.scores[pid]
          winnerId = pid
        }
      }
      return { isOver: true, scores: state.scores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state) {
    return {
      playerOrder: state.playerOrder,
      dealer: state.dealer,
      currentPlayer: state.currentPlayer,
      currentPlayerId: state.playerOrder[state.currentPlayer],
      phase: state.phase,
      starter: state.starter,
      scores: state.scores,
      pegCount: state.pegCount,
      pegPlays: state.pegPlays,
      consecutivePasses: state.consecutivePasses,
      roundNumber: state.roundNumber,
      message: state.message,
      lastAction: state.lastAction,
      lastPegPoints: state.lastPegPoints,
      handScores: state.handScores,
      hisHeels: state.hisHeels,
      discardsDone: state.discardsDone,
      cribSize: state.crib.length,
    }
  },
}
