// ─── Color Clash – Multiplayer Game Config ───────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// UNO-style color matching card game with custom deck.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'
import {
  type CCCard,
  type CCColor,
  type CCValue,
  type CCWildValue,
  canPlayCard,
  cardPoints,
  handPoints,
  COLOR_DISPLAY,
  VALUE_DISPLAY,
} from './color-clash-rules'

// ─── State Types ────────────────────────────────────────────────────────────

export interface ColorClashMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  deck: CCCard[]
  discardPile: CCCard[]
  currentColor: CCColor
  direction: 1 | -1
  phase: 'playing' | 'choosing-color' | 'game-over'
  choosingColorPlayerId: string | null
  pendingDraw: number
  scores: Record<string, number>
  targetScore: number
  message: string
  lastPlayedCard: CCCard | null
  lastAction: string | null
}

// ─── Deck Creation ──────────────────────────────────────────────────────────

const CC_COLORS: CCColor[] = ['red', 'blue', 'green', 'yellow']

function createColorClashDeck(): CCCard[] {
  const cards: CCCard[] = []
  let idCounter = 0

  for (const color of CC_COLORS) {
    cards.push({ id: `cc-${idCounter++}`, color, value: '0', faceUp: false })
    const values: CCValue[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']
    for (const value of values) {
      cards.push({ id: `cc-${idCounter++}`, color, value, faceUp: false })
      cards.push({ id: `cc-${idCounter++}`, color, value, faceUp: false })
    }
  }

  for (let i = 0; i < 4; i++) {
    cards.push({ id: `cc-${idCounter++}`, color: 'wild', value: 'wild', faceUp: false })
    cards.push({ id: `cc-${idCounter++}`, color: 'wild', value: 'wild-draw4', faceUp: false })
  }

  return cards
}

function shuffleDeck(deck: CCCard[]): CCCard[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function sortHand(hand: CCCard[]): CCCard[] {
  const colorOrder: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 }
  return [...hand].sort((a, b) => {
    const cd = colorOrder[a.color] - colorOrder[b.color]
    if (cd !== 0) return cd
    return a.value.localeCompare(b.value)
  })
}

function getNextPlayerIndex(current: number, direction: 1 | -1, total: number): number {
  return (current + direction + total) % total
}

function hasPlayableCard(hand: CCCard[], topCard: CCCard, requiredColor: CCColor): boolean {
  return hand.some(c => canPlayCard(c, topCard, requiredColor))
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Cast CCCard[] to Card[] for the multiplayer hook (cards are opaque to the hook). */
function asDeckCards(cards: CCCard[]): Card[] {
  return cards as unknown as Card[]
}

/** Cast Card[] back to CCCard[] when reading from hands map. */
function asCCCards(cards: Card[]): CCCard[] {
  return cards as unknown as CCCard[]
}

function resolveRoundEnd(
  state: ColorClashMultiplayerState,
  hands: Record<string, Card[]>,
  lastCard: CCCard,
  winnerId: string,
) {
  let roundScore = 0
  for (const [pid, hand] of Object.entries(hands)) {
    if (pid !== winnerId) {
      roundScore += handPoints(asCCCards(hand))
    }
  }

  const newScores = { ...state.scores }
  newScores[winnerId] = (newScores[winnerId] ?? 0) + roundScore

  const isGameOver = newScores[winnerId] >= state.targetScore

  const newState: ColorClashMultiplayerState = {
    ...state,
    discardPile: [...state.discardPile, lastCard],
    currentColor: (lastCard.color === 'wild' ? state.currentColor : lastCard.color) as CCColor,
    scores: newScores,
    phase: isGameOver ? 'game-over' : 'playing',
    choosingColorPlayerId: null,
    lastAction: 'won the round',
    message: isGameOver ? 'Game over!' : `Round over! +${roundScore} points`,
  }

  return {
    state: newState,
    hands,
    broadcast: { action: 'round-end', winnerId, roundScore },
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const colorClashMultiplayer: MultiplayerGameConfig<ColorClashMultiplayerState> = {
  gameType: 'color-clash',
  minPlayers: 2,
  maxPlayers: 6,

  initializeGame(players: Player[]) {
    let deck = shuffleDeck(createColorClashDeck())
    const cardsPerPlayer = 7
    const hands: Record<string, Card[]> = {}

    for (const player of players) {
      const dealt = deck.slice(0, cardsPerPlayer).map(c => ({ ...c, faceUp: true }))
      deck = deck.slice(cardsPerPlayer)
      hands[player.id] = asDeckCards(sortHand(dealt))
    }

    // Find a number card for the starter (skip wilds and action cards)
    let startIdx = 0
    while (
      deck[startIdx].color === 'wild' ||
      ['skip', 'reverse', 'draw2'].includes(deck[startIdx].value)
    ) {
      startIdx++
    }
    const startCard: CCCard = { ...deck[startIdx], faceUp: true }
    deck = [...deck.slice(0, startIdx), ...deck.slice(startIdx + 1)]

    const playerOrder = players.map(p => p.id)
    const scores: Record<string, number> = {}
    players.forEach(p => { scores[p.id] = 0 })

    const state: ColorClashMultiplayerState = {
      playerOrder,
      currentTurnIndex: 0,
      currentTurnPlayerId: playerOrder[0],
      deck,
      discardPile: [startCard],
      currentColor: startCard.color as CCColor,
      direction: 1,
      phase: 'playing',
      choosingColorPlayerId: null,
      pendingDraw: 0,
      scores,
      targetScore: 300,
      message: `${players[0].name}'s turn`,
      lastPlayedCard: null,
      lastAction: null,
    }

    return { state, hands }
  },

  processAction(
    state: ColorClashMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    // Validate turn (except choose-color which can come from the choosing player)
    if (type === 'choose-color') {
      if (state.phase !== 'choosing-color' || state.choosingColorPlayerId !== playerId) {
        return { state, hands, broadcast: null, error: 'Not your turn to choose a color' }
      }
    } else {
      if (playerId !== state.currentTurnPlayerId) {
        return { state, hands, broadcast: null, error: 'Not your turn' }
      }
    }

    switch (type) {
      case 'play-card': {
        const cardId = data.cardId as string
        const playerHand = asCCCards(hands[playerId] ?? [])
        const card = playerHand.find(c => c.id === cardId)
        if (!card) {
          return { state, hands, broadcast: null, error: 'Card not in your hand' }
        }

        const topCard = state.discardPile[state.discardPile.length - 1]
        if (!canPlayCard(card, topCard, state.currentColor)) {
          return { state, hands, broadcast: null, error: 'Cannot play that card' }
        }

        // Remove card from hand
        const newHand = sortHand(playerHand.filter(c => c.id !== cardId))
        newHands[playerId] = asDeckCards(newHand)
        const playedCard: CCCard = { ...card, faceUp: true }

        // Wild cards require color choice
        if (card.color === 'wild') {
          const newState: ColorClashMultiplayerState = {
            ...state,
            discardPile: [...state.discardPile, playedCard],
            phase: 'choosing-color',
            choosingColorPlayerId: playerId,
            pendingDraw: card.value === 'wild-draw4' ? state.pendingDraw + 4 : state.pendingDraw,
            lastPlayedCard: playedCard,
            lastAction: card.value === 'wild-draw4' ? 'wild-draw4' : 'wild',
            message: 'Choosing a color...',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'play-card', card: playedCard } }
        }

        // Handle special action cards
        let newDirection = state.direction
        let skip = false
        let drawAdd = 0

        if (card.value === 'reverse') {
          newDirection = state.direction === 1 ? -1 : 1
          if (state.playerOrder.length === 2) skip = true
        } else if (card.value === 'skip') {
          skip = true
        } else if (card.value === 'draw2') {
          drawAdd = 2
        }

        // Check if player went out
        if (newHand.length === 0) {
          return resolveRoundEnd(state, newHands, playedCard, playerId)
        }

        // Advance turn
        let nextIdx = getNextPlayerIndex(state.currentTurnIndex, newDirection, state.playerOrder.length)
        if (skip) {
          nextIdx = getNextPlayerIndex(nextIdx, newDirection, state.playerOrder.length)
        }

        const newState: ColorClashMultiplayerState = {
          ...state,
          currentTurnIndex: nextIdx,
          currentTurnPlayerId: state.playerOrder[nextIdx],
          discardPile: [...state.discardPile, playedCard],
          currentColor: card.color as CCColor,
          direction: newDirection,
          pendingDraw: state.pendingDraw + drawAdd,
          lastPlayedCard: playedCard,
          lastAction: card.value,
          message: 'Waiting for next player...',
        }

        return { state: newState, hands: newHands, broadcast: { action: 'play-card', card: playedCard } }
      }

      case 'draw-cards': {
        const playerHand = asCCCards(hands[playerId] ?? [])
        const drawCount = Math.max(1, state.pendingDraw)

        let newDeck = [...state.deck]
        let newDiscard = [...state.discardPile]
        const drawnCards: CCCard[] = []

        for (let i = 0; i < drawCount; i++) {
          if (newDeck.length === 0) {
            if (newDiscard.length <= 1) break
            const top = newDiscard[newDiscard.length - 1]
            newDeck = shuffleDeck(newDiscard.slice(0, -1).map(c => ({ ...c, faceUp: false })))
            newDiscard = [top]
          }
          drawnCards.push({ ...newDeck[0], faceUp: true })
          newDeck = newDeck.slice(1)
        }

        const newPlayerHand = sortHand([...playerHand, ...drawnCards])
        newHands[playerId] = asDeckCards(newPlayerHand)

        // If had pending draw, turn passes
        if (state.pendingDraw > 0) {
          const nextIdx = getNextPlayerIndex(state.currentTurnIndex, state.direction, state.playerOrder.length)
          const newState: ColorClashMultiplayerState = {
            ...state,
            currentTurnIndex: nextIdx,
            currentTurnPlayerId: state.playerOrder[nextIdx],
            deck: newDeck,
            discardPile: newDiscard,
            pendingDraw: 0,
            lastAction: 'drew',
            message: 'Waiting for next player...',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'draw', count: drawCount } }
        }

        // Drew 1 voluntarily; check if can play
        const topCard = newDiscard[newDiscard.length - 1]
        if (!hasPlayableCard(newPlayerHand, topCard, state.currentColor)) {
          // Auto-pass
          const nextIdx = getNextPlayerIndex(state.currentTurnIndex, state.direction, state.playerOrder.length)
          const newState: ColorClashMultiplayerState = {
            ...state,
            currentTurnIndex: nextIdx,
            currentTurnPlayerId: state.playerOrder[nextIdx],
            deck: newDeck,
            discardPile: newDiscard,
            pendingDraw: 0,
            lastAction: 'drew-passed',
            message: 'Drew and passed.',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'draw-pass' } }
        }

        // Player can still play a card this turn
        const newState: ColorClashMultiplayerState = {
          ...state,
          deck: newDeck,
          discardPile: newDiscard,
          pendingDraw: 0,
          lastAction: 'drew',
          message: 'Drew a card.',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'draw' } }
      }

      case 'choose-color': {
        const color = data.color as CCColor
        const playerHand = asCCCards(hands[playerId] ?? [])

        // Check if player went out (played wild as last card)
        if (playerHand.length === 0) {
          const newState: ColorClashMultiplayerState = {
            ...state,
            currentColor: color,
            phase: 'playing',
            choosingColorPlayerId: null,
          }
          return resolveRoundEnd(newState, newHands, state.discardPile[state.discardPile.length - 1], playerId)
        }

        const nextIdx = getNextPlayerIndex(state.currentTurnIndex, state.direction, state.playerOrder.length)

        const newState: ColorClashMultiplayerState = {
          ...state,
          currentColor: color,
          currentTurnIndex: nextIdx,
          currentTurnPlayerId: state.playerOrder[nextIdx],
          phase: 'playing',
          choosingColorPlayerId: null,
          lastAction: `chose ${COLOR_DISPLAY[color].label}`,
          message: `Color changed to ${COLOR_DISPLAY[color].label}`,
        }

        return { state: newState, hands: newHands, broadcast: { action: 'choose-color', color } }
      }

      case 'pass': {
        const nextIdx = getNextPlayerIndex(state.currentTurnIndex, state.direction, state.playerOrder.length)
        const newState: ColorClashMultiplayerState = {
          ...state,
          currentTurnIndex: nextIdx,
          currentTurnPlayerId: state.playerOrder[nextIdx],
          pendingDraw: 0,
          lastAction: 'passed',
          message: 'Passed.',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'pass' } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: ColorClashMultiplayerState) {
    for (const [playerId, score] of Object.entries(state.scores)) {
      if (score >= state.targetScore) {
        return {
          isOver: true,
          scores: state.scores,
          winner: playerId,
        }
      }
    }
    if (state.phase === 'game-over') {
      let maxScore = 0
      let winnerId = state.playerOrder[0]
      for (const [pid, score] of Object.entries(state.scores)) {
        if (score > maxScore) {
          maxScore = score
          winnerId = pid
        }
      }
      return { isOver: true, scores: state.scores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state: ColorClashMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      topCard: state.discardPile[state.discardPile.length - 1],
      discardPileSize: state.discardPile.length,
      deckSize: state.deck.length,
      currentColor: state.currentColor,
      direction: state.direction,
      phase: state.phase,
      choosingColorPlayerId: state.choosingColorPlayerId,
      pendingDraw: state.pendingDraw,
      scores: state.scores,
      targetScore: state.targetScore,
      message: state.message,
      lastPlayedCard: state.lastPlayedCard,
      lastAction: state.lastAction,
    }
  },
}
