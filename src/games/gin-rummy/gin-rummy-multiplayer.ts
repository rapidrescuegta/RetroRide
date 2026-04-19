// ─── Gin Rummy – Multiplayer Game Config ─────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// 2-player game: draw, discard, form melds, knock/gin to win rounds.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface Meld {
  cards: Card[]
  type: 'set' | 'run'
}

export interface GinRummyMultiplayerState {
  playerOrder: [string, string]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  discardPile: Card[]
  phase: 'draw' | 'discard' | 'knock-decision' | 'round-over' | 'game-over'
  scores: Record<string, number>
  targetScore: number
  roundNumber: number
  message: string
  lastAction: string | null
  /** Who knocked (if any) in the current round result. */
  knocker: string | null
  roundResult: {
    knockerId: string
    knockerDeadwood: number
    defenderDeadwood: number
    points: number
    winnerId: string
    isGin: boolean
    isUndercut: boolean
    knockerMelds: Meld[]
    defenderMelds: Meld[]
  } | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RANK_VALUES: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
}

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cardDeadwoodValue(card: Card): number {
  return RANK_VALUES[card.rank]
}

function deadwoodTotal(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardDeadwoodValue(c), 0)
}

function findAllSets(hand: Card[]): Meld[] {
  const byRank: Record<string, Card[]> = {}
  for (const c of hand) {
    if (!byRank[c.rank]) byRank[c.rank] = []
    byRank[c.rank].push(c)
  }

  const sets: Meld[] = []
  for (const rank in byRank) {
    const cards = byRank[rank]
    if (cards.length >= 3) {
      if (cards.length === 3) {
        sets.push({ cards: [...cards], type: 'set' })
      } else {
        sets.push({ cards: [...cards], type: 'set' })
        for (let i = 0; i < cards.length; i++) {
          const subset = cards.filter((_, j) => j !== i)
          sets.push({ cards: subset, type: 'set' })
        }
      }
    }
  }
  return sets
}

function findAllRuns(hand: Card[]): Meld[] {
  const bySuit: Record<Suit, Card[]> = {
    hearts: [], diamonds: [], clubs: [], spades: [],
  }
  for (const c of hand) {
    bySuit[c.suit].push(c)
  }

  const runs: Meld[] = []
  for (const suit of Object.keys(bySuit) as Suit[]) {
    const cards = bySuit[suit].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank])
    if (cards.length < 3) continue

    for (let start = 0; start < cards.length - 2; start++) {
      const run: Card[] = [cards[start]]
      for (let j = start + 1; j < cards.length; j++) {
        if (RANK_ORDER[cards[j].rank] === RANK_ORDER[run[run.length - 1].rank] + 1) {
          run.push(cards[j])
          if (run.length >= 3) {
            runs.push({ cards: [...run], type: 'run' })
          }
        } else {
          break
        }
      }
    }
  }
  return runs
}

function findBestMelds(hand: Card[]): { melds: Meld[]; deadwood: Card[] } {
  let bestMelds: Meld[] = []
  let bestDeadwood = [...hand]
  let bestDeadwoodValue = deadwoodTotal(hand)

  const allPossible = [...findAllSets(hand), ...findAllRuns(hand)]

  function tryMelds(melds: Meld[], usedIds: Set<string>, index: number) {
    const remaining = hand.filter(c => !usedIds.has(c.id))
    const dw = deadwoodTotal(remaining)
    if (dw < bestDeadwoodValue) {
      bestDeadwoodValue = dw
      bestMelds = [...melds]
      bestDeadwood = remaining
    }

    for (let i = index; i < allPossible.length; i++) {
      const meld = allPossible[i]
      if (meld.cards.some(c => usedIds.has(c.id))) continue

      const newUsed = new Set(usedIds)
      meld.cards.forEach(c => newUsed.add(c.id))
      tryMelds([...melds, meld], newUsed, i + 1)
    }
  }

  tryMelds([], new Set(), 0)
  return { melds: bestMelds, deadwood: bestDeadwood }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const ginRummyMultiplayer: MultiplayerGameConfig<GinRummyMultiplayerState> = {
  gameType: 'gin-rummy',
  minPlayers: 2,
  maxPlayers: 2,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const playerOrder: [string, string] = [players[0].id, players[1].id]
    const hands: Record<string, Card[]> = {}
    const scores: Record<string, number> = {}

    // Deal 10 cards to each player
    hands[playerOrder[0]] = sortHand(deck.slice(0, 10).map(c => ({ ...c, faceUp: true })))
    hands[playerOrder[1]] = sortHand(deck.slice(10, 20).map(c => ({ ...c, faceUp: true })))
    scores[playerOrder[0]] = 0
    scores[playerOrder[1]] = 0

    const firstDiscard = { ...deck[20], faceUp: true }
    const remaining = deck.slice(21)

    const state: GinRummyMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck: remaining,
      discardPile: [firstDiscard],
      phase: 'draw',
      scores,
      targetScore: 100,
      roundNumber: 1,
      message: `${players[0].name}'s turn — draw from deck or discard pile`,
      lastAction: null,
      knocker: null,
      roundResult: null,
    }

    return { state, hands }
  },

  processAction(
    state: GinRummyMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>,
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      case 'draw-deck': {
        if (state.phase !== 'draw') {
          return { state, hands, broadcast: null, error: 'Not in draw phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }
        if (state.deck.length === 0) {
          return { state, hands, broadcast: null, error: 'Deck is empty' }
        }

        const card = { ...state.deck[0], faceUp: true }
        const newDeck = state.deck.slice(1)
        newHands[playerId] = sortHand([...(hands[playerId] ?? []), card])

        const newState: GinRummyMultiplayerState = {
          ...state,
          deck: newDeck,
          phase: 'discard',
          message: 'Select a card to discard.',
          lastAction: 'drew from deck',
        }

        return { state: newState, hands: newHands, broadcast: { action: 'draw-deck' } }
      }

      case 'draw-discard': {
        if (state.phase !== 'draw') {
          return { state, hands, broadcast: null, error: 'Not in draw phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }
        if (state.discardPile.length === 0) {
          return { state, hands, broadcast: null, error: 'Discard pile is empty' }
        }

        const card = { ...state.discardPile[state.discardPile.length - 1], faceUp: true }
        const newDiscardPile = state.discardPile.slice(0, -1)
        newHands[playerId] = sortHand([...(hands[playerId] ?? []), card])

        const newState: GinRummyMultiplayerState = {
          ...state,
          discardPile: newDiscardPile,
          phase: 'discard',
          message: 'Select a card to discard.',
          lastAction: 'drew from discard',
        }

        return { state: newState, hands: newHands, broadcast: { action: 'draw-discard' } }
      }

      case 'discard': {
        if (state.phase !== 'discard') {
          return { state, hands, broadcast: null, error: 'Not in discard phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }

        const cardId = data.cardId as string
        const playerHand = hands[playerId] ?? []
        const card = playerHand.find(c => c.id === cardId)
        if (!card) {
          return { state, hands, broadcast: null, error: 'Card not in your hand' }
        }

        const newPlayerHand = sortHand(removeCards(playerHand, [cardId]))
        newHands[playerId] = newPlayerHand
        const newDiscardPile = [...state.discardPile, { ...card, faceUp: true }]

        // Check if deck is nearly empty (draw)
        if (state.deck.length <= 2) {
          const newState: GinRummyMultiplayerState = {
            ...state,
            discardPile: newDiscardPile,
            phase: 'round-over',
            message: 'Deck exhausted — round is a draw!',
            lastAction: 'discarded',
            roundResult: null,
          }
          return { state: newState, hands: newHands, broadcast: { action: 'draw-round' } }
        }

        // Check if player can knock (deadwood <= 10)
        const { deadwood } = findBestMelds(newPlayerHand)
        const dw = deadwoodTotal(deadwood)

        if (dw <= 10) {
          const newState: GinRummyMultiplayerState = {
            ...state,
            discardPile: newDiscardPile,
            phase: 'knock-decision',
            message: dw === 0
              ? 'GIN! Knock for bonus points, or continue.'
              : `Deadwood: ${dw}. Knock or continue?`,
            lastAction: 'discarded',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'discard', canKnock: true } }
        }

        // Switch turns
        const otherPlayer = state.playerOrder[0] === playerId
          ? state.playerOrder[1]
          : state.playerOrder[0]
        const otherIndex = state.playerOrder.indexOf(otherPlayer)

        const newState: GinRummyMultiplayerState = {
          ...state,
          currentTurnIndex: otherIndex,
          currentTurnPlayerId: otherPlayer,
          discardPile: newDiscardPile,
          phase: 'draw',
          message: `Waiting for next player to draw...`,
          lastAction: 'discarded',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'discard' } }
      }

      case 'knock': {
        if (state.phase !== 'knock-decision') {
          return { state, hands, broadcast: null, error: 'Not in knock-decision phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }

        const knockerHand = newHands[playerId] ?? []
        const defenderId = state.playerOrder[0] === playerId
          ? state.playerOrder[1]
          : state.playerOrder[0]
        const defenderHand = newHands[defenderId] ?? []

        const knockerResult = findBestMelds(knockerHand)
        const defenderResult = findBestMelds(defenderHand)

        const knockerDW = deadwoodTotal(knockerResult.deadwood)
        const defenderDW = deadwoodTotal(defenderResult.deadwood)

        const isGin = knockerDW === 0
        const isUndercut = !isGin && defenderDW <= knockerDW

        let points: number
        let winnerId: string

        if (isGin) {
          points = defenderDW + 25
          winnerId = playerId
        } else if (isUndercut) {
          points = knockerDW - defenderDW + 25
          winnerId = defenderId
        } else {
          points = defenderDW - knockerDW
          winnerId = playerId
        }

        const newScores = { ...state.scores }
        newScores[winnerId] = (newScores[winnerId] ?? 0) + points

        const isGameOver = newScores[winnerId] >= state.targetScore

        const roundResult = {
          knockerId: playerId,
          knockerDeadwood: knockerDW,
          defenderDeadwood: defenderDW,
          points,
          winnerId,
          isGin,
          isUndercut,
          knockerMelds: knockerResult.melds,
          defenderMelds: defenderResult.melds,
        }

        const newState: GinRummyMultiplayerState = {
          ...state,
          scores: newScores,
          phase: isGameOver ? 'game-over' : 'round-over',
          knocker: playerId,
          roundResult,
          message: isGin
            ? `GIN! +${points} points!`
            : isUndercut
              ? `UNDERCUT! +${points} points!`
              : `Knocked! +${points} points.`,
          lastAction: isGin ? 'gin' : 'knocked',
        }

        return { state: newState, hands: newHands, broadcast: { action: 'knock', roundResult } }
      }

      case 'continue': {
        if (state.phase !== 'knock-decision') {
          return { state, hands, broadcast: null, error: 'Not in knock-decision phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn' }
        }

        // Continue playing — switch turns
        const otherPlayer = state.playerOrder[0] === playerId
          ? state.playerOrder[1]
          : state.playerOrder[0]
        const otherIndex = state.playerOrder.indexOf(otherPlayer)

        const newState: GinRummyMultiplayerState = {
          ...state,
          currentTurnIndex: otherIndex,
          currentTurnPlayerId: otherPlayer,
          phase: 'draw',
          message: `Waiting for next player to draw...`,
          lastAction: 'continued',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'continue' } }
      }

      case 'new-round': {
        if (state.phase !== 'round-over') {
          return { state, hands, broadcast: null, error: 'Not in round-over phase' }
        }

        // Deal a new round
        const deck = shuffleDeck(createDeck())
        newHands[state.playerOrder[0]] = sortHand(
          deck.slice(0, 10).map(c => ({ ...c, faceUp: true }))
        )
        newHands[state.playerOrder[1]] = sortHand(
          deck.slice(10, 20).map(c => ({ ...c, faceUp: true }))
        )

        const firstDiscard = { ...deck[20], faceUp: true }
        const remaining = deck.slice(21)

        // Alternate who goes first
        const firstIndex = state.roundNumber % 2
        const firstPlayer = state.playerOrder[firstIndex]

        const newState: GinRummyMultiplayerState = {
          ...state,
          currentTurnIndex: firstIndex,
          currentTurnPlayerId: firstPlayer,
          deck: remaining,
          discardPile: [firstDiscard],
          phase: 'draw',
          roundNumber: state.roundNumber + 1,
          knocker: null,
          roundResult: null,
          message: `Round ${state.roundNumber + 1}. Draw from deck or discard pile.`,
          lastAction: null,
        }

        return { state: newState, hands: newHands, broadcast: { action: 'new-round' } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: GinRummyMultiplayerState) {
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

  getPublicState(state: GinRummyMultiplayerState) {
    return {
      playerOrder: state.playerOrder,
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      topDiscard: state.discardPile.length > 0
        ? state.discardPile[state.discardPile.length - 1]
        : null,
      discardPileSize: state.discardPile.length,
      deckSize: state.deck.length,
      phase: state.phase,
      scores: state.scores,
      targetScore: state.targetScore,
      roundNumber: state.roundNumber,
      message: state.message,
      lastAction: state.lastAction,
      knocker: state.knocker,
      roundResult: state.roundResult,
    }
  },
}
