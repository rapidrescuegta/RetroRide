// ─── Old Maid – Multiplayer Game Config ──────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// Players draw cards from each other, match pairs, and try not to be
// the one left holding the Old Maid (the unpaired Queen).
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Rank } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

export interface OldMaidMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  /** The player whose hand is being drawn from. */
  targetPlayerId: string
  /** Pairs each player has collected (rank list). */
  pairs: Record<string, Rank[]>
  /** Players who have emptied their hand. */
  isOut: Record<string, boolean>
  phase: 'picking' | 'game-over'
  message: string
  lastAction: string | null
  lastEvent: OldMaidEvent | null
  oldMaidHolder: string | null
}

export interface OldMaidEvent {
  type: 'card-picked' | 'pair-found' | 'player-out'
  playerId: string
  targetId?: string
  rank?: Rank
  message: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function removePairsFromHand(hand: Card[]): { newHand: Card[]; foundPairs: Rank[] } {
  const rankGroups: Record<string, Card[]> = {}
  for (const c of hand) {
    if (!rankGroups[c.rank]) rankGroups[c.rank] = []
    rankGroups[c.rank].push(c)
  }

  const foundPairs: Rank[] = []
  const removeIds: string[] = []

  for (const [rank, cards] of Object.entries(rankGroups)) {
    while (cards.length >= 2) {
      const pair = cards.splice(0, 2)
      foundPairs.push(rank as Rank)
      removeIds.push(pair[0].id, pair[1].id)
    }
  }

  const newHand = removeCards(hand, removeIds)
  return { newHand, foundPairs }
}

function findNextActivePlayer(
  playerOrder: string[],
  isOut: Record<string, boolean>,
  hands: Record<string, Card[]>,
  startIndex: number,
  exclude?: string,
): number {
  const n = playerOrder.length
  for (let i = 0; i < n; i++) {
    const idx = (startIndex + i) % n
    const pid = playerOrder[idx]
    if (pid === exclude) continue
    if (!isOut[pid] && (hands[pid]?.length ?? 0) > 0) return idx
  }
  return startIndex
}

function findTarget(
  playerOrder: string[],
  isOut: Record<string, boolean>,
  hands: Record<string, Card[]>,
  currentIndex: number,
): string {
  const n = playerOrder.length
  for (let i = 1; i < n; i++) {
    const idx = (currentIndex + i) % n
    const pid = playerOrder[idx]
    if (!isOut[pid] && (hands[pid]?.length ?? 0) > 0) return pid
  }
  return playerOrder[(currentIndex + 1) % n]
}

function countActivePlayers(
  playerOrder: string[],
  isOut: Record<string, boolean>,
  hands: Record<string, Card[]>,
): number {
  return playerOrder.filter(pid => !isOut[pid] && (hands[pid]?.length ?? 0) > 0).length
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const oldMaidMultiplayer: MultiplayerGameConfig<OldMaidMultiplayerState> = {
  gameType: 'old-maid',
  minPlayers: 2,
  maxPlayers: 4,

  initializeGame(players: Player[]) {
    // Create deck and remove one Queen to create the Old Maid
    let deck = createDeck()
    deck = deck.filter(c => !(c.rank === 'Q' && c.suit === 'clubs'))
    deck = shuffleDeck(deck)

    const playerOrder = players.map(p => p.id)
    const hands: Record<string, Card[]> = {}
    const pairs: Record<string, Rank[]> = {}
    const isOut: Record<string, boolean> = {}

    // Deal all cards evenly (some may get one more)
    const allHands: Card[][] = Array.from({ length: players.length }, () => [])
    deck.forEach((card, i) => {
      allHands[i % players.length].push({ ...card, faceUp: true })
    })

    for (let i = 0; i < players.length; i++) {
      const pid = playerOrder[i]
      hands[pid] = sortHand(allHands[i])
      pairs[pid] = []
      isOut[pid] = false
    }

    // Remove initial pairs from all hands
    for (const pid of playerOrder) {
      const { newHand, foundPairs } = removePairsFromHand(hands[pid])
      hands[pid] = sortHand(newHand)
      pairs[pid] = foundPairs
    }

    // Mark players with no cards as out
    for (const pid of playerOrder) {
      if (hands[pid].length === 0) {
        isOut[pid] = true
      }
    }

    const firstActive = findNextActivePlayer(playerOrder, isOut, hands, 0)
    const firstPlayerId = playerOrder[firstActive]
    const targetId = findTarget(playerOrder, isOut, hands, firstActive)

    const state: OldMaidMultiplayerState = {
      playerOrder,
      currentTurnIndex: firstActive,
      currentTurnPlayerId: firstPlayerId,
      targetPlayerId: targetId,
      pairs,
      isOut,
      phase: 'picking',
      message: `${players[firstActive].name}'s turn to pick`,
      lastAction: null,
      lastEvent: null,
      oldMaidHolder: null,
    }

    return { state, hands }
  },

  processAction(
    state: OldMaidMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>,
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    if (type !== 'pick-card') {
      return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }

    if (playerId !== state.currentTurnPlayerId) {
      return { state, hands, broadcast: null, error: 'Not your turn' }
    }

    const cardIndex = data.cardIndex as number
    const targetHand = hands[state.targetPlayerId] ?? []

    if (cardIndex < 0 || cardIndex >= targetHand.length) {
      return { state, hands, broadcast: null, error: 'Invalid card index' }
    }

    // Pick the card from the target's hand
    const pickedCard = { ...targetHand[cardIndex], faceUp: true }
    const newTargetHand = [...targetHand]
    newTargetHand.splice(cardIndex, 1)
    newHands[state.targetPlayerId] = sortHand(newTargetHand)

    // Add to picker's hand
    const pickerHand = [...(hands[playerId] ?? []), pickedCard]

    // Check for new pairs
    const { newHand: remainingHand, foundPairs } = removePairsFromHand(pickerHand)
    newHands[playerId] = sortHand(remainingHand)

    const newPairs = { ...state.pairs }
    newPairs[playerId] = [...(newPairs[playerId] ?? []), ...foundPairs]

    const events: OldMaidEvent[] = []
    events.push({
      type: 'card-picked',
      playerId,
      targetId: state.targetPlayerId,
      message: 'Picked a card',
    })

    if (foundPairs.length > 0) {
      events.push({
        type: 'pair-found',
        playerId,
        rank: foundPairs[0],
        message: `Found a pair of ${foundPairs.join(', ')}!`,
      })
    }

    // Update isOut status
    const newIsOut = { ...state.isOut }
    for (const pid of state.playerOrder) {
      if ((newHands[pid]?.length ?? 0) === 0) {
        if (!newIsOut[pid]) {
          newIsOut[pid] = true
          events.push({
            type: 'player-out',
            playerId: pid,
            message: `Done! No more cards.`,
          })
        }
      }
    }

    // Check game over (only 1 active player left)
    const activeCount = countActivePlayers(state.playerOrder, newIsOut, newHands)

    if (activeCount <= 1) {
      // Find the Old Maid holder (last player with cards)
      const holder = state.playerOrder.find(
        pid => !newIsOut[pid] && (newHands[pid]?.length ?? 0) > 0
      ) ?? null

      const newState: OldMaidMultiplayerState = {
        ...state,
        pairs: newPairs,
        isOut: newIsOut,
        phase: 'game-over',
        oldMaidHolder: holder,
        lastAction: 'picked a card',
        lastEvent: events[events.length - 1],
        message: 'Game over!',
      }
      return { state: newState, hands: newHands, broadcast: { events } }
    }

    // Advance to next player
    const nextIndex = findNextActivePlayer(
      state.playerOrder,
      newIsOut,
      newHands,
      (state.currentTurnIndex + 1) % state.playerOrder.length,
    )
    const nextPlayerId = state.playerOrder[nextIndex]
    const nextTarget = findTarget(state.playerOrder, newIsOut, newHands, nextIndex)

    const newState: OldMaidMultiplayerState = {
      ...state,
      currentTurnIndex: nextIndex,
      currentTurnPlayerId: nextPlayerId,
      targetPlayerId: nextTarget,
      pairs: newPairs,
      isOut: newIsOut,
      phase: 'picking',
      lastAction: foundPairs.length > 0 ? `paired ${foundPairs.join(', ')}` : 'picked a card',
      lastEvent: events[events.length - 1],
      message: foundPairs.length > 0
        ? `Pair found! Next player's turn.`
        : `Card picked. Next player's turn.`,
    }

    return { state: newState, hands: newHands, broadcast: { events } }
  },

  checkGameOver(state: OldMaidMultiplayerState) {
    if (state.phase === 'game-over') {
      // Everyone except the Old Maid holder wins
      // Score: pairs collected (higher = better), Old Maid holder gets 0
      const scores: Record<string, number> = {}
      let maxPairs = 0
      let winnerId = state.playerOrder[0]

      for (const pid of state.playerOrder) {
        if (pid === state.oldMaidHolder) {
          scores[pid] = 0
        } else {
          scores[pid] = (state.pairs[pid]?.length ?? 0) * 10
          if (scores[pid] > maxPairs) {
            maxPairs = scores[pid]
            winnerId = pid
          }
        }
      }

      return { isOver: true, scores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state: OldMaidMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      targetPlayerId: state.targetPlayerId,
      pairs: state.pairs,
      isOut: state.isOut,
      phase: state.phase,
      message: state.message,
      lastAction: state.lastAction,
      lastEvent: state.lastEvent,
      oldMaidHolder: state.oldMaidHolder,
    }
  },
}
