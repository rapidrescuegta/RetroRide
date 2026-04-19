// ─── Crazy Eights – Multiplayer Game Config ─────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
  removeCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface CrazyEightsMultiplayerState {
  playerOrder: string[]         // player IDs in turn order
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: Card[]
  discardPile: Card[]
  currentSuit: Suit
  phase: 'playing' | 'choosing-suit'
  choosingSuitPlayerId: string | null
  scores: Record<string, number>
  targetScore: number
  message: string
  lastPlayedCard: Card | null
  lastAction: string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function cardPoints(card: Card): number {
  if (card.rank === '8') return 50
  if (['J', 'Q', 'K'].includes(card.rank)) return 10
  if (card.rank === 'A') return 1
  return card.value
}

function handPoints(hand: Card[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0)
}

function canPlayCard(card: Card, topCard: Card, requiredSuit: Suit): boolean {
  if (card.rank === '8') return true
  if (card.suit === requiredSuit) return true
  if (card.rank === topCard.rank) return true
  return false
}

function hasPlayableCard(hand: Card[], topCard: Card, requiredSuit: Suit): boolean {
  return hand.some(c => canPlayCard(c, topCard, requiredSuit))
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const crazyEightsMultiplayer: MultiplayerGameConfig<CrazyEightsMultiplayerState> = {
  gameType: 'crazy-eights',
  minPlayers: 2,
  maxPlayers: 6,

  initializeGame(players: Player[]) {
    const totalPlayers = players.length
    const cardsPerPlayer = totalPlayers === 2 ? 7 : 5

    let deck = shuffleDeck(createDeck())
    const hands: Record<string, Card[]> = {}

    // Deal to each player
    for (const player of players) {
      const { dealt, remaining } = dealCards(deck, cardsPerPlayer)
      deck = remaining
      hands[player.id] = sortHand(dealt)
    }

    // Flip the top card for discard pile (skip 8s)
    let startCard = deck[0]
    deck = deck.slice(1)
    while (startCard.rank === '8') {
      deck.push(startCard)
      deck = shuffleDeck(deck)
      startCard = deck[0]
      deck = deck.slice(1)
    }
    startCard = { ...startCard, faceUp: true }

    const playerOrder = players.map(p => p.id)
    const scores: Record<string, number> = {}
    players.forEach(p => { scores[p.id] = 0 })

    const state: CrazyEightsMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck,
      discardPile: [startCard],
      currentSuit: startCard.suit,
      phase: 'playing',
      choosingSuitPlayerId: null,
      scores,
      targetScore: 200,
      message: `${players[0].name}'s turn`,
      lastPlayedCard: null,
      lastAction: null,
    }

    return { state, hands }
  },

  processAction(
    state: CrazyEightsMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    // Validate it's the right player's turn (except for choose-suit which can come from the choosing player)
    if (type === 'choose-suit') {
      if (state.phase !== 'choosing-suit' || state.choosingSuitPlayerId !== playerId) {
        return { state, hands, broadcast: null, error: 'Not your turn to choose a suit' }
      }
    } else {
      if (playerId !== state.currentTurnPlayerId) {
        return { state, hands, broadcast: null, error: 'Not your turn' }
      }
    }

    switch (type) {
      case 'play-card': {
        const cardId = data.cardId as string
        const playerHand = [...(hands[playerId] ?? [])]
        const cardIndex = playerHand.findIndex(c => c.id === cardId)
        if (cardIndex === -1) {
          return { state, hands, broadcast: null, error: 'Card not in your hand' }
        }

        const card = playerHand[cardIndex]
        const topCard = state.discardPile[state.discardPile.length - 1]
        if (!canPlayCard(card, topCard, state.currentSuit)) {
          return { state, hands, broadcast: null, error: 'Cannot play that card' }
        }

        // Remove card from hand
        const newHand = removeCards(playerHand, [cardId])
        newHands[playerId] = sortHand(newHand)
        const playedCard = { ...card, faceUp: true }

        // If it's an 8, enter choosing-suit phase
        if (card.rank === '8') {
          const newState: CrazyEightsMultiplayerState = {
            ...state,
            discardPile: [...state.discardPile, playedCard],
            phase: 'choosing-suit',
            choosingSuitPlayerId: playerId,
            lastPlayedCard: playedCard,
            lastAction: `played 8`,
            message: 'Choosing a suit...',
          }

          // Check if player went out with an 8
          if (newHand.length === 0) {
            // They still need to choose suit, but mark that they're out
            // The choose-suit handler will resolve the round
          }

          return { state: newState, hands: newHands, broadcast: { action: 'play-card', card: playedCard } }
        }

        // Check if player went out
        if (newHand.length === 0) {
          return resolveRoundEnd(state, newHands, playedCard, playerId)
        }

        // Advance turn
        const nextIndex = (state.currentTurnIndex + 1) % state.playerOrder.length
        const nextPlayerId = state.playerOrder[nextIndex]

        const newState: CrazyEightsMultiplayerState = {
          ...state,
          currentTurnIndex: nextIndex,
          currentTurnPlayerId: nextPlayerId,
          discardPile: [...state.discardPile, playedCard],
          currentSuit: playedCard.suit,
          lastPlayedCard: playedCard,
          lastAction: `played ${card.rank}${SUIT_SYMBOLS[card.suit]}`,
          message: `Waiting for next player...`,
        }

        return { state: newState, hands: newHands, broadcast: { action: 'play-card', card: playedCard } }
      }

      case 'draw-card': {
        let newDeck = [...state.deck]
        let newDiscardPile = [...state.discardPile]

        if (newDeck.length === 0) {
          // Reshuffle discard pile (keep top card)
          if (newDiscardPile.length <= 1) {
            // Must pass — no cards available
            const nextIndex = (state.currentTurnIndex + 1) % state.playerOrder.length
            const nextPlayerId = state.playerOrder[nextIndex]
            const newState: CrazyEightsMultiplayerState = {
              ...state,
              currentTurnIndex: nextIndex,
              currentTurnPlayerId: nextPlayerId,
              lastAction: 'passed',
              message: 'No cards to draw, passed.',
            }
            return { state: newState, hands: newHands, broadcast: { action: 'pass' } }
          }
          const topCard = newDiscardPile[newDiscardPile.length - 1]
          newDeck = shuffleDeck(newDiscardPile.slice(0, -1).map(c => ({ ...c, faceUp: false })))
          newDiscardPile = [topCard]
        }

        const drawnCard = { ...newDeck[0], faceUp: true }
        newDeck = newDeck.slice(1)
        const playerHand = [...(hands[playerId] ?? []), drawnCard]
        newHands[playerId] = sortHand(playerHand)

        const topCard = newDiscardPile[newDiscardPile.length - 1]

        // If drawn card can't be played and deck is empty, auto-pass
        if (!hasPlayableCard(playerHand, topCard, state.currentSuit) && newDeck.length === 0 && newDiscardPile.length <= 1) {
          const nextIndex = (state.currentTurnIndex + 1) % state.playerOrder.length
          const nextPlayerId = state.playerOrder[nextIndex]
          const newState: CrazyEightsMultiplayerState = {
            ...state,
            deck: newDeck,
            discardPile: newDiscardPile,
            currentTurnIndex: nextIndex,
            currentTurnPlayerId: nextPlayerId,
            lastAction: 'drew and passed',
            message: 'Drew a card but could not play. Turn passed.',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'draw-and-pass' } }
        }

        // Player drew a card, stays their turn so they can play
        const newState: CrazyEightsMultiplayerState = {
          ...state,
          deck: newDeck,
          discardPile: newDiscardPile,
          lastAction: 'drew a card',
          message: 'Drew a card.',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'draw' } }
      }

      case 'choose-suit': {
        const suit = data.suit as Suit
        const playerHand = hands[playerId] ?? []

        // Check if player went out (played 8 as last card)
        if (playerHand.length === 0) {
          const newState: CrazyEightsMultiplayerState = {
            ...state,
            currentSuit: suit,
            phase: 'playing',
            choosingSuitPlayerId: null,
          }
          return resolveRoundEnd(newState, newHands, state.discardPile[state.discardPile.length - 1], playerId)
        }

        const nextIndex = (state.currentTurnIndex + 1) % state.playerOrder.length
        const nextPlayerId = state.playerOrder[nextIndex]

        const newState: CrazyEightsMultiplayerState = {
          ...state,
          currentSuit: suit,
          currentTurnIndex: nextIndex,
          currentTurnPlayerId: nextPlayerId,
          phase: 'playing',
          choosingSuitPlayerId: null,
          lastAction: `chose ${SUIT_SYMBOLS[suit]}`,
          message: `Suit changed to ${SUIT_SYMBOLS[suit]}`,
        }

        return { state: newState, hands: newHands, broadcast: { action: 'choose-suit', suit } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: CrazyEightsMultiplayerState) {
    // Game over is detected within processAction when a player empties their hand
    // Check if any player reached target score
    for (const [playerId, score] of Object.entries(state.scores)) {
      if (score >= state.targetScore) {
        return {
          isOver: true,
          scores: state.scores,
          winner: playerId,
        }
      }
    }
    return { isOver: false }
  },

  getPublicState(state: CrazyEightsMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      topCard: state.discardPile[state.discardPile.length - 1],
      discardPileSize: state.discardPile.length,
      deckSize: state.deck.length,
      currentSuit: state.currentSuit,
      phase: state.phase,
      choosingSuitPlayerId: state.choosingSuitPlayerId,
      scores: state.scores,
      targetScore: state.targetScore,
      message: state.message,
      lastPlayedCard: state.lastPlayedCard,
      lastAction: state.lastAction,
    }
  },
}

// ─── Helper: Round End ──────────────────────────────────────────────────────

function resolveRoundEnd(
  state: CrazyEightsMultiplayerState,
  hands: Record<string, Card[]>,
  lastCard: Card,
  winnerId: string,
) {
  // Winner scores points left in all other hands
  let roundScore = 0
  for (const [pid, hand] of Object.entries(hands)) {
    if (pid !== winnerId) {
      roundScore += handPoints(hand)
    }
  }

  const newScores = { ...state.scores }
  newScores[winnerId] = (newScores[winnerId] ?? 0) + roundScore

  const isGameOver = newScores[winnerId] >= state.targetScore

  const newState: CrazyEightsMultiplayerState = {
    ...state,
    discardPile: [...state.discardPile, lastCard],
    currentSuit: lastCard.suit,
    scores: newScores,
    phase: 'playing',
    choosingSuitPlayerId: null,
    lastAction: 'won the round',
    message: isGameOver ? 'Game over!' : `Round over! +${roundScore} points`,
  }

  return {
    state: newState,
    hands,
    broadcast: { action: 'round-end', winnerId, roundScore },
  }
}
