// ─── Rummy 500 – Multiplayer Game Config ────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// 2-4 players: draw, meld sets/runs, lay off cards, race to 500 points.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  removeCards,
  sortHand,
  isValidMeld,
  isSet,
  isRun,
  getCardValue,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface RummyMeld {
  id: string
  cards: Card[]
  type: 'set' | 'run'
  owner: string
}

export interface Rummy500MultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  discardPile: Card[]
  melds: RummyMeld[]
  phase: 'draw' | 'meld' | 'round-over' | 'game-over'
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  roundNumber: number
  message: string
  lastAction: string | null
  mustMeldCardId: string | null
  goOutPlayer: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

let meldCounter = 0
function generateMeldId(): string {
  return `meld-${Date.now()}-${++meldCounter}`
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cardScore(card: Card): number {
  return getCardValue(card, 'rummy')
}

function handPenalty(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardScore(c), 0)
}

function sortRunCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank])
}

function nextPlayer(players: string[], current: string): string {
  const idx = players.indexOf(current)
  return players[(idx + 1) % players.length]
}

function calculateRoundScores(
  state: Rummy500MultiplayerState,
  hands: Record<string, Card[]>,
): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const pid of state.playerOrder) {
    const meldPoints = state.roundScores[pid] || 0
    const penalty = handPenalty(hands[pid] ?? [])
    scores[pid] = meldPoints - penalty
  }
  return scores
}

function endRound(
  state: Rummy500MultiplayerState,
  hands: Record<string, Card[]>,
  goOutPlayer: string,
): Rummy500MultiplayerState {
  const roundScores = calculateRoundScores(state, hands)
  const newCumulative: Record<string, number> = {}
  for (const pid of state.playerOrder) {
    newCumulative[pid] = (state.cumulativeScores[pid] || 0) + roundScores[pid]
  }

  // Check if anyone reached 500
  let winner: string | null = null
  let highScore = -Infinity
  for (const [pid, score] of Object.entries(newCumulative)) {
    if (score >= 500 && score > highScore) {
      highScore = score
      winner = pid
    }
  }

  return {
    ...state,
    roundScores,
    cumulativeScores: newCumulative,
    phase: winner ? 'game-over' : 'round-over',
    goOutPlayer,
    message: winner
      ? 'Game over!'
      : `Round ${state.roundNumber} complete!`,
    lastAction: 'round-ended',
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const rummy500Multiplayer: MultiplayerGameConfig<Rummy500MultiplayerState> = {
  gameType: 'rummy-500',
  minPlayers: 2,
  maxPlayers: 4,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const playerOrder = players.map(p => p.id)
    const cardsPerPlayer = players.length === 2 ? 13 : 7
    const hands: Record<string, Card[]> = {}
    const scores: Record<string, number> = {}

    let pos = 0
    for (const pid of playerOrder) {
      hands[pid] = sortHand(deck.slice(pos, pos + cardsPerPlayer).map(c => ({ ...c, faceUp: true })))
      scores[pid] = 0
      pos += cardsPerPlayer
    }

    const firstDiscard = { ...deck[pos], faceUp: true }
    const remaining = deck.slice(pos + 1)

    const state: Rummy500MultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck: remaining,
      discardPile: [firstDiscard],
      melds: [],
      phase: 'draw',
      roundScores: Object.fromEntries(playerOrder.map(p => [p, 0])),
      cumulativeScores: scores,
      roundNumber: 1,
      message: `${players[0].name}'s turn — draw a card`,
      lastAction: null,
      mustMeldCardId: null,
      goOutPlayer: null,
    }

    return { state, hands }
  },

  processAction(
    state: Rummy500MultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>,
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      // ── Draw from deck ────────────────────────────────────────────────
      case 'draw-deck': {
        if (state.phase !== 'draw')
          return { state, hands, broadcast: null, error: 'Not in draw phase' }
        if (playerId !== state.currentTurnPlayerId)
          return { state, hands, broadcast: null, error: 'Not your turn' }

        // If deck is empty, reshuffle discard pile (keep top)
        let deck = state.deck
        let discardPile = state.discardPile
        if (deck.length === 0) {
          if (discardPile.length <= 1)
            return { state, hands, broadcast: null, error: 'No cards to draw' }
          const top = discardPile[discardPile.length - 1]
          deck = shuffleDeck(discardPile.slice(0, -1).map(c => ({ ...c, faceUp: false })))
          discardPile = [top]
        }

        const card = { ...deck[0], faceUp: true }
        newHands[playerId] = sortHand([...(hands[playerId] ?? []), card])

        const newState: Rummy500MultiplayerState = {
          ...state,
          deck: deck.slice(1),
          discardPile,
          phase: 'meld',
          message: 'Meld cards or discard to end your turn.',
          lastAction: 'drew from deck',
          mustMeldCardId: null,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'draw-deck' } }
      }

      // ── Draw from discard pile ────────────────────────────────────────
      case 'draw-discard': {
        if (state.phase !== 'draw')
          return { state, hands, broadcast: null, error: 'Not in draw phase' }
        if (playerId !== state.currentTurnPlayerId)
          return { state, hands, broadcast: null, error: 'Not your turn' }

        const cardIndex = data.cardIndex as number
        if (cardIndex < 0 || cardIndex >= state.discardPile.length)
          return { state, hands, broadcast: null, error: 'Invalid discard index' }

        // Pick up target card and everything above it
        const pickedCards = state.discardPile.slice(cardIndex).map(c => ({ ...c, faceUp: true }))
        const remainingDiscard = state.discardPile.slice(0, cardIndex)
        const targetCard = pickedCards[0]

        newHands[playerId] = sortHand([...(hands[playerId] ?? []), ...pickedCards])

        const newState: Rummy500MultiplayerState = {
          ...state,
          discardPile: remainingDiscard,
          phase: 'meld',
          message: 'You must meld the picked card! Then discard.',
          lastAction: 'drew from discard',
          mustMeldCardId: targetCard.id,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'draw-discard', count: pickedCards.length } }
      }

      // ── Play a meld ──────────────────────────────────────────────────
      case 'meld': {
        if (state.phase !== 'meld')
          return { state, hands, broadcast: null, error: 'Not in meld phase' }
        if (playerId !== state.currentTurnPlayerId)
          return { state, hands, broadcast: null, error: 'Not your turn' }

        const cardIds = data.cardIds as string[]
        const hand = hands[playerId] ?? []
        const meldCards = cardIds
          .map(id => hand.find(c => c.id === id))
          .filter((c): c is Card => c !== undefined)

        if (meldCards.length !== cardIds.length)
          return { state, hands, broadcast: null, error: 'Some cards not in hand' }
        if (!isValidMeld(meldCards))
          return { state, hands, broadcast: null, error: 'Not a valid meld (need 3+ cards in a set or run)' }

        const meldType: 'set' | 'run' = isSet(meldCards) ? 'set' : 'run'
        const newMeld: RummyMeld = {
          id: generateMeldId(),
          cards: meldType === 'run' ? sortRunCards(meldCards) : meldCards,
          type: meldType,
          owner: playerId,
        }

        const newHand = removeCards(hand, cardIds)
        newHands[playerId] = newHand
        const meldScore = meldCards.reduce((sum, c) => sum + cardScore(c), 0)

        // Check if mustMeldCard requirement is satisfied
        let newMustMeld = state.mustMeldCardId
        if (newMustMeld && cardIds.includes(newMustMeld)) {
          newMustMeld = null
        }

        // Check if player went out (hand empty)
        if (newHand.length === 0) {
          const roundState: Rummy500MultiplayerState = {
            ...state,
            melds: [...state.melds, newMeld],
            roundScores: {
              ...state.roundScores,
              [playerId]: (state.roundScores[playerId] || 0) + meldScore,
            },
            mustMeldCardId: newMustMeld,
          }
          const finalState = endRound(roundState, newHands, playerId)
          return { state: finalState, hands: newHands, broadcast: { action: 'meld', goOut: true } }
        }

        const newState: Rummy500MultiplayerState = {
          ...state,
          melds: [...state.melds, newMeld],
          roundScores: {
            ...state.roundScores,
            [playerId]: (state.roundScores[playerId] || 0) + meldScore,
          },
          mustMeldCardId: newMustMeld,
          message: 'Nice meld! Continue melding or discard.',
          lastAction: 'melded',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'meld' } }
      }

      // ── Lay off on existing meld ─────────────────────────────────────
      case 'lay-off': {
        if (state.phase !== 'meld')
          return { state, hands, broadcast: null, error: 'Not in meld phase' }
        if (playerId !== state.currentTurnPlayerId)
          return { state, hands, broadcast: null, error: 'Not your turn' }

        const cardId = data.cardId as string
        const meldId = data.meldId as string

        const hand = hands[playerId] ?? []
        const card = hand.find(c => c.id === cardId)
        if (!card)
          return { state, hands, broadcast: null, error: 'Card not in hand' }

        const meldIdx = state.melds.findIndex(m => m.id === meldId)
        if (meldIdx === -1)
          return { state, hands, broadcast: null, error: 'Meld not found' }

        const meld = state.melds[meldIdx]
        const testCards = [...meld.cards, card]

        if (meld.type === 'set' && !isSet(testCards))
          return { state, hands, broadcast: null, error: 'Card does not fit this set' }
        if (meld.type === 'run' && !isRun(testCards))
          return { state, hands, broadcast: null, error: 'Card does not extend this run' }

        const updatedMeld: RummyMeld = {
          ...meld,
          cards: meld.type === 'run' ? sortRunCards(testCards) : testCards,
        }

        const newMelds = [...state.melds]
        newMelds[meldIdx] = updatedMeld

        const newHand = removeCards(hand, [cardId])
        newHands[playerId] = newHand
        const points = cardScore(card)

        let newMustMeld = state.mustMeldCardId
        if (newMustMeld && cardId === newMustMeld) {
          newMustMeld = null
        }

        // Check if player went out
        if (newHand.length === 0) {
          const roundState: Rummy500MultiplayerState = {
            ...state,
            melds: newMelds,
            roundScores: {
              ...state.roundScores,
              [playerId]: (state.roundScores[playerId] || 0) + points,
            },
            mustMeldCardId: newMustMeld,
          }
          const finalState = endRound(roundState, newHands, playerId)
          return { state: finalState, hands: newHands, broadcast: { action: 'lay-off', goOut: true } }
        }

        const newState: Rummy500MultiplayerState = {
          ...state,
          melds: newMelds,
          roundScores: {
            ...state.roundScores,
            [playerId]: (state.roundScores[playerId] || 0) + points,
          },
          mustMeldCardId: newMustMeld,
          message: 'Card added to meld! Continue or discard.',
          lastAction: 'laid off',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'lay-off' } }
      }

      // ── Discard ──────────────────────────────────────────────────────
      case 'discard': {
        if (state.phase !== 'meld')
          return { state, hands, broadcast: null, error: 'Not in meld phase' }
        if (playerId !== state.currentTurnPlayerId)
          return { state, hands, broadcast: null, error: 'Not your turn' }
        if (state.mustMeldCardId)
          return { state, hands, broadcast: null, error: 'You must meld the picked discard card first!' }

        const cardId = data.cardId as string
        const hand = hands[playerId] ?? []
        const card = hand.find(c => c.id === cardId)
        if (!card)
          return { state, hands, broadcast: null, error: 'Card not in hand' }

        const newHand = removeCards(hand, [cardId])
        newHands[playerId] = newHand
        const newDiscardPile = [...state.discardPile, { ...card, faceUp: true }]

        // Check if going out after discard
        if (newHand.length === 0) {
          const roundState: Rummy500MultiplayerState = {
            ...state,
            discardPile: newDiscardPile,
          }
          const finalState = endRound(roundState, newHands, playerId)
          return { state: finalState, hands: newHands, broadcast: { action: 'discard', goOut: true } }
        }

        // Advance to next player
        const next = nextPlayer(state.playerOrder, playerId)
        const nextIdx = state.playerOrder.indexOf(next)

        const newState: Rummy500MultiplayerState = {
          ...state,
          currentTurnIndex: nextIdx,
          currentTurnPlayerId: next,
          discardPile: newDiscardPile,
          phase: 'draw',
          message: 'Waiting for next player to draw...',
          lastAction: 'discarded',
          mustMeldCardId: null,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'discard' } }
      }

      // ── New round ────────────────────────────────────────────────────
      case 'new-round': {
        if (state.phase !== 'round-over')
          return { state, hands, broadcast: null, error: 'Not in round-over phase' }

        const deck = shuffleDeck(createDeck())
        const cardsPerPlayer = state.playerOrder.length === 2 ? 13 : 7
        let pos = 0
        for (const pid of state.playerOrder) {
          newHands[pid] = sortHand(deck.slice(pos, pos + cardsPerPlayer).map(c => ({ ...c, faceUp: true })))
          pos += cardsPerPlayer
        }

        const firstDiscard = { ...deck[pos], faceUp: true }
        const remaining = deck.slice(pos + 1)

        const firstIndex = state.roundNumber % state.playerOrder.length
        const firstPlayer = state.playerOrder[firstIndex]

        const newState: Rummy500MultiplayerState = {
          ...state,
          currentTurnIndex: firstIndex,
          currentTurnPlayerId: firstPlayer,
          deck: remaining,
          discardPile: [firstDiscard],
          melds: [],
          phase: 'draw',
          roundScores: Object.fromEntries(state.playerOrder.map(p => [p, 0])),
          roundNumber: state.roundNumber + 1,
          goOutPlayer: null,
          mustMeldCardId: null,
          message: `Round ${state.roundNumber + 1}. Draw a card!`,
          lastAction: null,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'new-round' } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: Rummy500MultiplayerState) {
    if (state.phase === 'game-over') {
      let winnerId = state.playerOrder[0]
      let maxScore = -Infinity
      for (const pid of state.playerOrder) {
        if ((state.cumulativeScores[pid] ?? 0) > maxScore) {
          maxScore = state.cumulativeScores[pid]
          winnerId = pid
        }
      }
      return { isOver: true, scores: state.cumulativeScores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state: Rummy500MultiplayerState) {
    return {
      playerOrder: state.playerOrder,
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      topDiscard: state.discardPile.length > 0
        ? state.discardPile[state.discardPile.length - 1]
        : null,
      discardPileSize: state.discardPile.length,
      discardPile: state.discardPile.map(c => ({ ...c, faceUp: true })),
      deckSize: state.deck.length,
      melds: state.melds,
      phase: state.phase,
      roundScores: state.roundScores,
      cumulativeScores: state.cumulativeScores,
      roundNumber: state.roundNumber,
      message: state.message,
      lastAction: state.lastAction,
      mustMeldCardId: state.mustMeldCardId,
      goOutPlayer: state.goOutPlayer,
    }
  },
}
