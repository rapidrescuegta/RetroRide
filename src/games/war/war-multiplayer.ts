// ─── War – Multiplayer Game Config ──────────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  dealCards,
  sortHand,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface WarMultiplayerState {
  playerOrder: [string, string]
  currentTurnPlayerId: string
  /** Each player's draw pile (face-down). */
  piles: Record<string, Card[]>
  /** Cards currently on the table for the current battle. */
  battlefield: Record<string, Card[]>
  /** Cards waiting in war stakes (face-down war cards). */
  warStakes: Card[]
  phase: 'flip' | 'war' | 'round-over' | 'game-over'
  /** Both players need to flip before resolution. */
  flipped: Record<string, boolean>
  scores: Record<string, number>
  message: string
  lastAction: string | null
  roundWinner: string | null
  /** Track consecutive wars in a single battle. */
  warDepth: number
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const warMultiplayer: MultiplayerGameConfig<WarMultiplayerState> = {
  gameType: 'war',
  minPlayers: 2,
  maxPlayers: 2,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const half = Math.floor(deck.length / 2)
    const p1Cards = deck.slice(0, half)
    const p2Cards = deck.slice(half)

    const playerOrder: [string, string] = [players[0].id, players[1].id]
    const piles: Record<string, Card[]> = {
      [playerOrder[0]]: p1Cards,
      [playerOrder[1]]: p2Cards,
    }
    const scores: Record<string, number> = {
      [playerOrder[0]]: p1Cards.length,
      [playerOrder[1]]: p2Cards.length,
    }
    const battlefield: Record<string, Card[]> = {
      [playerOrder[0]]: [],
      [playerOrder[1]]: [],
    }
    const flipped: Record<string, boolean> = {
      [playerOrder[0]]: false,
      [playerOrder[1]]: false,
    }

    const state: WarMultiplayerState = {
      playerOrder,
      currentTurnPlayerId: playerOrder[0], // both flip, but we track "whose turn" for UI
      piles,
      battlefield,
      warStakes: [],
      phase: 'flip',
      flipped,
      scores,
      message: 'Both players: flip a card!',
      lastAction: null,
      roundWinner: null,
      warDepth: 0,
    }

    // Hands are empty in War — cards are in piles, not "in hand"
    const hands: Record<string, Card[]> = {
      [playerOrder[0]]: [],
      [playerOrder[1]]: [],
    }

    return { state, hands }
  },

  processAction(
    state: WarMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) {
    const { type, playerId } = action

    if (type === 'flip') {
      if (state.phase !== 'flip' && state.phase !== 'war') {
        return { state, hands, broadcast: null, error: 'Cannot flip now' }
      }
      if (state.flipped[playerId]) {
        return { state, hands, broadcast: null, error: 'Already flipped' }
      }
      if (!state.playerOrder.includes(playerId)) {
        return { state, hands, broadcast: null, error: 'Not a player' }
      }

      const pile = [...state.piles[playerId]]
      if (pile.length === 0) {
        return { state, hands, broadcast: null, error: 'No cards left' }
      }

      // Draw the top card
      const card = { ...pile.shift()!, faceUp: true }
      const newPiles = { ...state.piles, [playerId]: pile }
      const newBattlefield = {
        ...state.battlefield,
        [playerId]: [...state.battlefield[playerId], card],
      }
      const newFlipped = { ...state.flipped, [playerId]: true }

      // Check if both players have flipped
      const otherPlayer = state.playerOrder.find(id => id !== playerId)!
      const bothFlipped = newFlipped[otherPlayer]

      if (!bothFlipped) {
        // Wait for other player
        const newState: WarMultiplayerState = {
          ...state,
          piles: newPiles,
          battlefield: newBattlefield,
          flipped: newFlipped,
          message: 'Waiting for other player to flip...',
          lastAction: 'flipped a card',
        }
        return { state: newState, hands, broadcast: { action: 'flip', playerId } }
      }

      // Both flipped — compare cards
      const p1 = state.playerOrder[0]
      const p2 = state.playerOrder[1]
      const card1 = newBattlefield[p1][newBattlefield[p1].length - 1]
      const card2 = newBattlefield[p2][newBattlefield[p2].length - 1]

      if (card1.value > card2.value) {
        return resolveWin(state, newPiles, newBattlefield, p1, hands)
      } else if (card2.value > card1.value) {
        return resolveWin(state, newPiles, newBattlefield, p2, hands)
      } else {
        // WAR! Each player puts one face-down card as stake, then we flip again
        return startWar(state, newPiles, newBattlefield, hands)
      }
    }

    if (type === 'continue') {
      // After a round result is shown, reset for next round
      if (state.phase !== 'round-over') {
        return { state, hands, broadcast: null, error: 'Not in round-over phase' }
      }

      const p1 = state.playerOrder[0]
      const p2 = state.playerOrder[1]

      // Check if anyone is out of cards
      if (state.piles[p1].length === 0 || state.piles[p2].length === 0) {
        const winner = state.piles[p1].length > 0 ? p1 : p2
        const newScores = {
          [p1]: state.piles[p1].length,
          [p2]: state.piles[p2].length,
        }
        const newState: WarMultiplayerState = {
          ...state,
          phase: 'game-over',
          scores: newScores,
          message: 'Game over!',
          roundWinner: winner,
        }
        return { state: newState, hands, broadcast: { action: 'game-over', winner } }
      }

      const newState: WarMultiplayerState = {
        ...state,
        phase: 'flip',
        battlefield: { [p1]: [], [p2]: [] },
        warStakes: [],
        flipped: { [p1]: false, [p2]: false },
        roundWinner: null,
        warDepth: 0,
        message: 'Both players: flip a card!',
        lastAction: null,
      }
      return { state: newState, hands, broadcast: { action: 'next-round' } }
    }

    return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
  },

  checkGameOver(state: WarMultiplayerState) {
    if (state.phase === 'game-over') {
      const p1 = state.playerOrder[0]
      const p2 = state.playerOrder[1]
      const winner = state.piles[p1].length > state.piles[p2].length ? p1 : p2
      return {
        isOver: true,
        scores: state.scores,
        winner,
      }
    }
    // Also check if either player is at 0 cards during play
    const p1 = state.playerOrder[0]
    const p2 = state.playerOrder[1]
    if (state.piles[p1].length === 0 && state.battlefield[p1].length === 0) {
      return { isOver: true, scores: state.scores, winner: p2 }
    }
    if (state.piles[p2].length === 0 && state.battlefield[p2].length === 0) {
      return { isOver: true, scores: state.scores, winner: p1 }
    }
    return { isOver: false }
  },

  getPublicState(state: WarMultiplayerState) {
    return {
      playerOrder: state.playerOrder,
      currentTurnPlayerId: state.currentTurnPlayerId,
      pileSizes: {
        [state.playerOrder[0]]: state.piles[state.playerOrder[0]].length,
        [state.playerOrder[1]]: state.piles[state.playerOrder[1]].length,
      },
      battlefield: state.battlefield,
      phase: state.phase,
      flipped: state.flipped,
      scores: state.scores,
      message: state.message,
      lastAction: state.lastAction,
      roundWinner: state.roundWinner,
      warDepth: state.warDepth,
    }
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function resolveWin(
  state: WarMultiplayerState,
  piles: Record<string, Card[]>,
  battlefield: Record<string, Card[]>,
  winnerId: string,
  hands: Record<string, Card[]>
) {
  const p1 = state.playerOrder[0]
  const p2 = state.playerOrder[1]

  // Winner collects all battlefield cards and war stakes
  const wonCards: Card[] = [
    ...battlefield[p1].map(c => ({ ...c, faceUp: false })),
    ...battlefield[p2].map(c => ({ ...c, faceUp: false })),
    ...state.warStakes.map(c => ({ ...c, faceUp: false })),
  ]

  // Shuffle won cards and add to bottom of winner's pile
  const shuffledWon = shuffleDeck(wonCards)
  const newPiles = {
    ...piles,
    [winnerId]: [...piles[winnerId], ...shuffledWon],
  }

  const newScores = {
    [p1]: newPiles[p1].length,
    [p2]: newPiles[p2].length,
  }

  const newState: WarMultiplayerState = {
    ...state,
    piles: newPiles,
    battlefield,
    warStakes: [],
    phase: 'round-over',
    flipped: { [p1]: false, [p2]: false },
    scores: newScores,
    message: `Battle won! (+${wonCards.length} cards)`,
    lastAction: 'won the battle',
    roundWinner: winnerId,
  }

  return { state: newState, hands, broadcast: { action: 'battle-won', winnerId, cardsWon: wonCards.length } }
}

function startWar(
  state: WarMultiplayerState,
  piles: Record<string, Card[]>,
  battlefield: Record<string, Card[]>,
  hands: Record<string, Card[]>
) {
  const p1 = state.playerOrder[0]
  const p2 = state.playerOrder[1]
  const newWarStakes = [...state.warStakes]
  const newPiles = { ...piles }

  // Each player puts one card face-down as war stake (if they have one)
  for (const pid of state.playerOrder) {
    if (newPiles[pid].length > 0) {
      const stakeCard = newPiles[pid].shift()!
      newWarStakes.push({ ...stakeCard, faceUp: false })
    }
  }

  const newFlipped: Record<string, boolean> = {
    [p1]: false,
    [p2]: false,
  }

  // If either player ran out during war, the other wins
  if (newPiles[p1].length === 0 && newPiles[p2].length === 0) {
    // True tie — split cards (rare)
    const allCards = [
      ...battlefield[p1], ...battlefield[p2], ...newWarStakes,
    ].map(c => ({ ...c, faceUp: false }))
    const half = Math.floor(allCards.length / 2)
    newPiles[p1] = allCards.slice(0, half)
    newPiles[p2] = allCards.slice(half)
    const newState: WarMultiplayerState = {
      ...state,
      piles: newPiles,
      battlefield: { [p1]: [], [p2]: [] },
      warStakes: [],
      phase: 'round-over',
      flipped: newFlipped,
      scores: { [p1]: newPiles[p1].length, [p2]: newPiles[p2].length },
      message: 'Both out of cards — draw!',
      lastAction: 'draw',
      roundWinner: null,
      warDepth: 0,
    }
    return { state: newState, hands, broadcast: { action: 'draw' } }
  }

  if (newPiles[p1].length === 0) {
    return resolveWin(state, newPiles, battlefield, p2, hands)
  }
  if (newPiles[p2].length === 0) {
    return resolveWin(state, newPiles, battlefield, p1, hands)
  }

  const newState: WarMultiplayerState = {
    ...state,
    piles: newPiles,
    battlefield,
    warStakes: newWarStakes,
    phase: 'war',
    flipped: newFlipped,
    warDepth: state.warDepth + 1,
    message: `WAR! (x${state.warDepth + 1}) Flip again!`,
    lastAction: 'war',
  }

  return { state: newState, hands, broadcast: { action: 'war', depth: state.warDepth + 1 } }
}
