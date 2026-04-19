// ─── Blackjack – Multiplayer Game Config ────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host runs dealer logic. 2-6 players vs the dealer (automated).
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export type BlackjackPhase = 'betting' | 'dealing' | 'player-turn' | 'dealer-turn' | 'payout' | 'round-over' | 'game-over'

export interface BlackjackMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  dealerHand: Card[]
  dealerTotal: number
  /** Player bets for current round. */
  bets: Record<string, number>
  /** Player chip counts. */
  chips: Record<string, number>
  /** Player hand totals. */
  totals: Record<string, number>
  /** Players who have busted. */
  busted: Record<string, boolean>
  /** Players who have stood. */
  stood: Record<string, boolean>
  /** Players who doubled down. */
  doubled: Record<string, boolean>
  /** Players who have placed bets this round. */
  hasBet: Record<string, boolean>
  phase: BlackjackPhase
  scores: Record<string, number>
  message: string
  lastAction: string | null
  roundResults: Record<string, 'win' | 'lose' | 'push' | 'blackjack'> | null
  roundNumber: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function handTotal(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    if (card.rank === 'A') {
      aces++
      total += 11
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      total += 10
    } else {
      total += parseInt(card.rank, 10)
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21
}

function ensureDeck(state: BlackjackMultiplayerState): Card[] {
  if (state.deck.length < 10) {
    // Reshuffle with fresh decks (use 2 decks for multiplayer)
    const fresh = shuffleDeck([...createDeck(), ...createDeck()])
    return [...state.deck, ...fresh]
  }
  return [...state.deck]
}

function drawCard(deck: Card[]): { card: Card; deck: Card[] } {
  const card = { ...deck[0], faceUp: true }
  return { card, deck: deck.slice(1) }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const blackjackMultiplayer: MultiplayerGameConfig<BlackjackMultiplayerState> = {
  gameType: 'blackjack',
  minPlayers: 2,
  maxPlayers: 6,

  initializeGame(players: Player[]) {
    // Use 2 shuffled decks combined for multiplayer
    const deck = shuffleDeck([
      ...createDeck().map(c => ({ ...c, id: `1-${c.id}` })),
      ...createDeck().map(c => ({ ...c, id: `2-${c.id}` })),
    ])

    const playerOrder = players.map(p => p.id)
    const chips: Record<string, number> = {}
    const scores: Record<string, number> = {}
    const bets: Record<string, number> = {}
    const hasBet: Record<string, boolean> = {}
    const busted: Record<string, boolean> = {}
    const stood: Record<string, boolean> = {}
    const doubled: Record<string, boolean> = {}
    const totals: Record<string, number> = {}

    for (const p of players) {
      chips[p.id] = 1000  // Starting chips
      scores[p.id] = 1000
      bets[p.id] = 0
      hasBet[p.id] = false
      busted[p.id] = false
      stood[p.id] = false
      doubled[p.id] = false
      totals[p.id] = 0
    }

    const hands: Record<string, Card[]> = {}
    for (const p of players) {
      hands[p.id] = []
    }

    const state: BlackjackMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck,
      dealerHand: [],
      dealerTotal: 0,
      bets,
      chips,
      totals,
      busted,
      stood,
      doubled,
      hasBet,
      phase: 'betting',
      scores,
      message: 'Place your bets!',
      lastAction: null,
      roundResults: null,
      roundNumber: 1,
    }

    return { state, hands }
  },

  processAction(
    state: BlackjackMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      case 'place-bet': {
        if (state.phase !== 'betting') {
          return { state, hands, broadcast: null, error: 'Not in betting phase' }
        }
        const amount = data.amount as number
        if (amount < 10 || amount > state.chips[playerId]) {
          return { state, hands, broadcast: null, error: 'Invalid bet amount (min 10)' }
        }

        const newBets = { ...state.bets, [playerId]: amount }
        const newHasBet = { ...state.hasBet, [playerId]: true }

        // Check if all players have bet
        const allBet = state.playerOrder.every(pid => newHasBet[pid])

        if (!allBet) {
          const newState: BlackjackMultiplayerState = {
            ...state,
            bets: newBets,
            hasBet: newHasBet,
            message: 'Waiting for all bets...',
            lastAction: `bet ${amount}`,
          }
          return { state: newState, hands: newHands, broadcast: { action: 'bet', playerId, amount } }
        }

        // All bets placed — deal cards
        return dealRound(state, newBets, newHasBet, newHands)
      }

      case 'hit': {
        if (state.phase !== 'player-turn') {
          return { state, hands, broadcast: null, error: 'Not your turn phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }
        if (state.busted[playerId] || state.stood[playerId]) {
          return { state, hands, broadcast: null, error: 'Already done' }
        }

        let deck = ensureDeck(state)
        const { card, deck: newDeck } = drawCard(deck)
        const playerHand = [...(hands[playerId] ?? []), card]
        newHands[playerId] = playerHand
        const total = handTotal(playerHand)
        const newTotals = { ...state.totals, [playerId]: total }

        if (total > 21) {
          // Busted
          const newBusted = { ...state.busted, [playerId]: true }
          const result = advanceToNextPlayer(state, newDeck, newHands, newTotals, newBusted, state.stood)
          return result
        }

        if (total === 21) {
          // Auto-stand at 21
          const newStood = { ...state.stood, [playerId]: true }
          const result = advanceToNextPlayer(state, newDeck, newHands, newTotals, state.busted, newStood)
          return result
        }

        const newState: BlackjackMultiplayerState = {
          ...state,
          deck: newDeck,
          totals: newTotals,
          message: `Hit! Total: ${total}`,
          lastAction: 'hit',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'hit', playerId } }
      }

      case 'stand': {
        if (state.phase !== 'player-turn') {
          return { state, hands, broadcast: null, error: 'Not your turn phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }

        const newStood = { ...state.stood, [playerId]: true }
        return advanceToNextPlayer(state, [...state.deck], newHands, state.totals, state.busted, newStood)
      }

      case 'double-down': {
        if (state.phase !== 'player-turn') {
          return { state, hands, broadcast: null, error: 'Not your turn phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }
        const playerHand = hands[playerId] ?? []
        if (playerHand.length !== 2) {
          return { state, hands, broadcast: null, error: 'Can only double on first two cards' }
        }
        if (state.chips[playerId] < state.bets[playerId]) {
          return { state, hands, broadcast: null, error: 'Not enough chips to double' }
        }

        // Double bet
        const newBets = { ...state.bets, [playerId]: state.bets[playerId] * 2 }
        const newDoubled = { ...state.doubled, [playerId]: true }

        // Draw exactly one card
        let deck = ensureDeck(state)
        const { card, deck: newDeck } = drawCard(deck)
        const newPlayerHand = [...playerHand, card]
        newHands[playerId] = newPlayerHand
        const total = handTotal(newPlayerHand)
        const newTotals = { ...state.totals, [playerId]: total }

        const newBusted = total > 21
          ? { ...state.busted, [playerId]: true }
          : state.busted
        const newStood = { ...state.stood, [playerId]: true }

        const stateWithBets: BlackjackMultiplayerState = {
          ...state,
          bets: newBets,
          doubled: newDoubled,
        }

        return advanceToNextPlayer(stateWithBets, newDeck, newHands, newTotals, newBusted, newStood)
      }

      case 'next-round': {
        if (state.phase !== 'round-over') {
          return { state, hands, broadcast: null, error: 'Not in round-over phase' }
        }

        // Check if any player is out of chips
        const activePlayers = state.playerOrder.filter(pid => state.chips[pid] > 0)
        if (activePlayers.length === 0) {
          const newState: BlackjackMultiplayerState = {
            ...state,
            phase: 'game-over',
            message: 'Game over — all players out of chips!',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'game-over' } }
        }

        // Reset for new round
        const bets: Record<string, number> = {}
        const hasBet: Record<string, boolean> = {}
        const busted: Record<string, boolean> = {}
        const stood: Record<string, boolean> = {}
        const doubled: Record<string, boolean> = {}
        const totals: Record<string, number> = {}

        for (const pid of state.playerOrder) {
          bets[pid] = 0
          hasBet[pid] = state.chips[pid] <= 0 // auto-skip broke players
          busted[pid] = false
          stood[pid] = false
          doubled[pid] = false
          totals[pid] = 0
          newHands[pid] = []
        }

        const newState: BlackjackMultiplayerState = {
          ...state,
          currentTurnIndex: 0,
          currentTurnPlayerId: state.playerOrder[0],
          dealerHand: [],
          dealerTotal: 0,
          bets,
          hasBet,
          busted,
          stood,
          doubled,
          totals,
          phase: 'betting',
          message: 'Place your bets!',
          lastAction: null,
          roundResults: null,
          roundNumber: state.roundNumber + 1,
        }

        return { state: newState, hands: newHands, broadcast: { action: 'next-round' } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: BlackjackMultiplayerState) {
    if (state.phase === 'game-over') {
      // Winner is player with most chips
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

    // Check if only one player has chips (after 3+ rounds)
    if (state.roundNumber >= 3) {
      const playersWithChips = state.playerOrder.filter(pid => state.chips[pid] > 0)
      if (playersWithChips.length <= 1 && state.phase === 'round-over') {
        return {
          isOver: true,
          scores: state.scores,
          winner: playersWithChips[0] ?? state.playerOrder[0],
        }
      }
    }

    return { isOver: false }
  },

  getPublicState(state: BlackjackMultiplayerState) {
    // Hide dealer's hole card during player turns
    const visibleDealerHand = state.phase === 'player-turn' || state.phase === 'betting'
      ? state.dealerHand.map((c, i) => i === 0 ? c : { ...c, faceUp: false })
      : state.dealerHand

    return {
      playerOrder: state.playerOrder,
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      dealerHand: visibleDealerHand,
      dealerTotal: state.phase === 'player-turn' || state.phase === 'betting'
        ? handTotal(state.dealerHand.slice(0, 1))
        : state.dealerTotal,
      bets: state.bets,
      chips: state.chips,
      totals: state.totals,
      busted: state.busted,
      stood: state.stood,
      doubled: state.doubled,
      hasBet: state.hasBet,
      phase: state.phase,
      scores: state.scores,
      message: state.message,
      lastAction: state.lastAction,
      roundResults: state.roundResults,
      roundNumber: state.roundNumber,
    }
  },
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

function dealRound(
  state: BlackjackMultiplayerState,
  bets: Record<string, number>,
  hasBet: Record<string, boolean>,
  hands: Record<string, Card[]>
) {
  let deck = ensureDeck(state)
  const newHands = { ...hands }

  // Deal 2 cards to each active player
  for (const pid of state.playerOrder) {
    if (bets[pid] > 0) {
      const { card: c1, deck: d1 } = drawCard(deck)
      deck = d1
      const { card: c2, deck: d2 } = drawCard(deck)
      deck = d2
      newHands[pid] = [c1, c2]
    } else {
      newHands[pid] = []
    }
  }

  // Deal 2 cards to dealer (first face-up, second face-down)
  const { card: dc1, deck: d3 } = drawCard(deck)
  deck = d3
  const { card: dc2, deck: d4 } = drawCard(deck)
  deck = d4
  const dealerHand = [dc1, { ...dc2, faceUp: false }]

  // Calculate totals
  const totals: Record<string, number> = {}
  const busted: Record<string, boolean> = {}
  const stood: Record<string, boolean> = {}
  for (const pid of state.playerOrder) {
    totals[pid] = handTotal(newHands[pid] ?? [])
    busted[pid] = false
    stood[pid] = bets[pid] <= 0 // skip players who didn't bet
  }

  // Find first active player
  const firstActive = state.playerOrder.findIndex(pid => bets[pid] > 0)
  const firstPlayerId = firstActive >= 0 ? state.playerOrder[firstActive] : state.playerOrder[0]

  const newState: BlackjackMultiplayerState = {
    ...state,
    deck,
    dealerHand,
    dealerTotal: handTotal(dealerHand),
    bets,
    hasBet,
    totals,
    busted,
    stood,
    doubled: { ...state.doubled },
    phase: 'player-turn',
    currentTurnIndex: firstActive >= 0 ? firstActive : 0,
    currentTurnPlayerId: firstPlayerId,
    message: `Cards dealt! ${firstPlayerId}'s turn.`,
    lastAction: 'dealt',
  }

  return { state: newState, hands: newHands, broadcast: { action: 'deal' } }
}

function advanceToNextPlayer(
  state: BlackjackMultiplayerState,
  deck: Card[],
  hands: Record<string, Card[]>,
  totals: Record<string, number>,
  busted: Record<string, boolean>,
  stood: Record<string, boolean>
) {
  // Find next player who hasn't busted or stood
  let nextIndex = state.currentTurnIndex + 1
  while (nextIndex < state.playerOrder.length) {
    const pid = state.playerOrder[nextIndex]
    if (!busted[pid] && !stood[pid] && state.bets[pid] > 0) {
      break
    }
    nextIndex++
  }

  if (nextIndex < state.playerOrder.length) {
    // More players to go
    const newState: BlackjackMultiplayerState = {
      ...state,
      deck,
      totals,
      busted,
      stood,
      currentTurnIndex: nextIndex,
      currentTurnPlayerId: state.playerOrder[nextIndex],
      message: `Next player's turn`,
      lastAction: busted[state.currentTurnPlayerId] ? 'busted' : 'stood',
    }
    return { state: newState, hands, broadcast: { action: 'advance' } }
  }

  // All players done — dealer plays
  return dealerPlay(state, deck, hands, totals, busted, stood)
}

function dealerPlay(
  state: BlackjackMultiplayerState,
  deck: Card[],
  hands: Record<string, Card[]>,
  totals: Record<string, number>,
  busted: Record<string, boolean>,
  stood: Record<string, boolean>
) {
  let dealerHand = state.dealerHand.map(c => ({ ...c, faceUp: true }))
  let currentDeck = deck

  // Dealer hits on 16 or less, stands on 17+
  while (handTotal(dealerHand) < 17) {
    if (currentDeck.length === 0) break
    const { card, deck: newDeck } = drawCard(currentDeck)
    dealerHand.push(card)
    currentDeck = newDeck
  }

  const dealerTotal = handTotal(dealerHand)
  const dealerBusted = dealerTotal > 21
  const dealerBJ = isBlackjack(dealerHand)

  // Calculate results and payouts
  const roundResults: Record<string, 'win' | 'lose' | 'push' | 'blackjack'> = {}
  const newChips = { ...state.chips }

  for (const pid of state.playerOrder) {
    if (state.bets[pid] <= 0) continue

    const playerTotal = totals[pid]
    const playerBJ = isBlackjack(hands[pid] ?? [])
    const bet = state.bets[pid]

    if (busted[pid]) {
      roundResults[pid] = 'lose'
      newChips[pid] -= bet
    } else if (playerBJ && !dealerBJ) {
      roundResults[pid] = 'blackjack'
      newChips[pid] += Math.floor(bet * 1.5)
    } else if (playerBJ && dealerBJ) {
      roundResults[pid] = 'push'
    } else if (dealerBusted) {
      roundResults[pid] = 'win'
      newChips[pid] += bet
    } else if (playerTotal > dealerTotal) {
      roundResults[pid] = 'win'
      newChips[pid] += bet
    } else if (playerTotal < dealerTotal) {
      roundResults[pid] = 'lose'
      newChips[pid] -= bet
    } else {
      roundResults[pid] = 'push'
    }

    // Ensure chips don't go negative
    if (newChips[pid] < 0) newChips[pid] = 0
  }

  const newScores = { ...newChips }

  const newState: BlackjackMultiplayerState = {
    ...state,
    deck: currentDeck,
    dealerHand,
    dealerTotal,
    totals,
    busted,
    stood,
    chips: newChips,
    scores: newScores,
    phase: 'round-over',
    roundResults,
    message: dealerBusted
      ? `Dealer busts with ${dealerTotal}!`
      : `Dealer stands at ${dealerTotal}`,
    lastAction: 'dealer-done',
  }

  return { state: newState, hands, broadcast: { action: 'dealer-done', dealerTotal, dealerBusted } }
}
