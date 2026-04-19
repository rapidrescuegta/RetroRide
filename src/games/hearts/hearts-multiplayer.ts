// ─── Hearts – Multiplayer Game Config ────────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// Hearts is a 4-player trick-taking game where the goal is to AVOID points.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Suit } from '@/lib/card-engine'
import {
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── State Types ────────────────────────────────────────────────────────────

type PassDirection = 'left' | 'right' | 'across' | 'none'

interface Trick {
  cards: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  winner: string | null
}

export interface HeartsMultiplayerState {
  playerOrder: string[]
  currentTurnIndex: number
  currentTurnPlayerId: string
  tricks: Trick[]
  currentTrick: Trick
  roundScores: Record<string, number>
  cumulativeScores: Record<string, number>
  roundNumber: number
  passDirection: PassDirection
  phase: 'passing' | 'playing' | 'round-over' | 'game-over'
  passSelections: Record<string, string[]>  // playerId -> selected card ids
  passComplete: Record<string, boolean>
  heartsBroken: boolean
  trickNumber: number
  message: string
  lastAction: string | null
  shotTheMoon: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PASS_ROTATION: PassDirection[] = ['left', 'right', 'across', 'none']
const GAME_OVER_SCORE = 100

// ─── Helpers ────────────────────────────────────────────────────────────────

function getPassTarget(
  players: string[],
  playerId: string,
  direction: PassDirection,
): string {
  const idx = players.indexOf(playerId)
  switch (direction) {
    case 'left': return players[(idx + 1) % 4]
    case 'right': return players[(idx + 3) % 4]
    case 'across': return players[(idx + 2) % 4]
    default: return playerId
  }
}

function getPassDirectionLabel(dir: PassDirection): string {
  switch (dir) {
    case 'left': return 'Pass Left'
    case 'right': return 'Pass Right'
    case 'across': return 'Pass Across'
    case 'none': return 'No Pass'
  }
}

function determineTrickWinner(trick: Trick): string {
  const leadSuit = trick.leadSuit!
  let highest = -1
  let winner = trick.cards[0].playerId

  for (const { playerId, card } of trick.cards) {
    if (card.suit === leadSuit && card.value > highest) {
      highest = card.value
      winner = playerId
    }
  }

  return winner
}

function getPlayableCardIds(
  hand: Card[],
  currentTrick: Trick,
  heartsBroken: boolean,
  trickNumber: number,
): string[] {
  const isFirstTrick = trickNumber === 0

  // First card of first trick must be 2 of clubs
  if (currentTrick.cards.length === 0 && isFirstTrick) {
    const twoClubs = hand.find(c => c.id === '2-clubs')
    if (twoClubs) return [twoClubs.id]
  }

  // Must follow suit if possible
  if (currentTrick.cards.length > 0 && currentTrick.leadSuit) {
    const suitCards = hand.filter(c => c.suit === currentTrick.leadSuit)
    if (suitCards.length > 0) {
      return suitCards.map(c => c.id)
    }
    // Can't follow suit
    if (isFirstTrick) {
      const nonPenalty = hand.filter(c => c.suit !== 'hearts' && c.id !== 'Q-spades')
      if (nonPenalty.length > 0) return nonPenalty.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  // Leading a trick
  if (currentTrick.cards.length === 0) {
    if (!heartsBroken) {
      const nonHearts = hand.filter(c => c.suit !== 'hearts')
      if (nonHearts.length > 0) return nonHearts.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  return hand.map(c => c.id)
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const heartsMultiplayer: MultiplayerGameConfig<HeartsMultiplayerState> = {
  gameType: 'hearts',
  minPlayers: 4,
  maxPlayers: 4,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const hands: Record<string, Card[]> = {}
    const playerOrder = players.map(p => p.id)
    const cumulativeScores: Record<string, number> = {}

    for (let i = 0; i < 4; i++) {
      hands[playerOrder[i]] = sortHand(
        deck.slice(i * 13, (i + 1) * 13).map(c => ({ ...c, faceUp: true }))
      )
      cumulativeScores[playerOrder[i]] = 0
    }

    const passDirection = PASS_ROTATION[0]

    // Find who has 2 of clubs
    let firstPlayer = playerOrder[0]
    for (const pid of playerOrder) {
      if (hands[pid].some(c => c.id === '2-clubs')) {
        firstPlayer = pid
        break
      }
    }

    const state: HeartsMultiplayerState = {
      playerOrder,
      currentTurnIndex: playerOrder.indexOf(firstPlayer),
      currentTurnPlayerId: firstPlayer,
      tricks: [],
      currentTrick: { cards: [], leadSuit: null, winner: null },
      roundScores: Object.fromEntries(playerOrder.map(p => [p, 0])),
      cumulativeScores,
      roundNumber: 0,
      passDirection,
      phase: passDirection === 'none' ? 'playing' : 'passing',
      passSelections: Object.fromEntries(playerOrder.map(p => [p, []])),
      passComplete: Object.fromEntries(playerOrder.map(p => [p, false])),
      heartsBroken: false,
      trickNumber: 0,
      message: passDirection === 'none'
        ? `${players.find(p => p.id === firstPlayer)?.name}'s turn`
        : `${getPassDirectionLabel(passDirection)} — select 3 cards to pass`,
      lastAction: null,
      shotTheMoon: null,
    }

    return { state, hands }
  },

  processAction(
    state: HeartsMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>,
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      // ── Card passing phase ──
      case 'select-pass': {
        if (state.phase !== 'passing') {
          return { state, hands, broadcast: null, error: 'Not in passing phase' }
        }

        const cardIds = data.cardIds as string[]
        if (cardIds.length !== 3) {
          return { state, hands, broadcast: null, error: 'Must select exactly 3 cards' }
        }

        // Validate cards are in player's hand
        const playerHand = hands[playerId] ?? []
        for (const cid of cardIds) {
          if (!playerHand.find(c => c.id === cid)) {
            return { state, hands, broadcast: null, error: 'Card not in your hand' }
          }
        }

        const newPassSelections = { ...state.passSelections, [playerId]: cardIds }
        const newPassComplete = { ...state.passComplete, [playerId]: true }

        // Check if all players have selected
        const allDone = state.playerOrder.every(pid =>
          pid === playerId ? true : newPassComplete[pid]
        )

        if (!allDone) {
          const newState: HeartsMultiplayerState = {
            ...state,
            passSelections: newPassSelections,
            passComplete: newPassComplete,
            message: 'Waiting for other players to pass...',
          }
          return { state: newState, hands: newHands, broadcast: { event: 'pass-selected', playerId } }
        }

        // Execute the pass
        for (const pid of state.playerOrder) {
          const passCardIds = newPassSelections[pid]
          const passCards = newHands[pid].filter(c => passCardIds.includes(c.id))
          newHands[pid] = removeCards(newHands[pid], passCardIds)

          const target = getPassTarget(state.playerOrder, pid, state.passDirection)
          newHands[target] = [...newHands[target], ...passCards]
        }

        // Sort all hands
        for (const pid of state.playerOrder) {
          newHands[pid] = sortHand(newHands[pid])
        }

        // Find who has 2 of clubs after passing
        let firstPlayer = state.playerOrder[0]
        for (const pid of state.playerOrder) {
          if (newHands[pid].some(c => c.id === '2-clubs')) {
            firstPlayer = pid
            break
          }
        }

        const newState: HeartsMultiplayerState = {
          ...state,
          currentTurnIndex: state.playerOrder.indexOf(firstPlayer),
          currentTurnPlayerId: firstPlayer,
          phase: 'playing',
          passSelections: Object.fromEntries(state.playerOrder.map(p => [p, []])),
          passComplete: Object.fromEntries(state.playerOrder.map(p => [p, false])),
          message: 'Cards passed! 2 of clubs leads.',
        }
        return { state: newState, hands: newHands, broadcast: { event: 'pass-complete' } }
      }

      // ── Play a card ──
      case 'play-card': {
        if (state.phase !== 'playing') {
          return { state, hands, broadcast: null, error: 'Game is not in playing phase' }
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

        const playable = getPlayableCardIds(playerHand, state.currentTrick, state.heartsBroken, state.trickNumber)
        if (!playable.includes(cardId)) {
          return { state, hands, broadcast: null, error: 'Cannot play that card' }
        }

        // Remove card from hand
        newHands[playerId] = sortHand(removeCards(playerHand, [cardId]))
        const playedCard = { ...card, faceUp: true }

        const newTrick: Trick = {
          cards: [...state.currentTrick.cards, { playerId, card: playedCard }],
          leadSuit: state.currentTrick.leadSuit || playedCard.suit,
          winner: null,
        }

        const heartsBroken = state.heartsBroken || playedCard.suit === 'hearts'

        // Trick not yet complete
        if (newTrick.cards.length < 4) {
          const nextIdx = (state.playerOrder.indexOf(playerId) + 1) % 4
          const nextPlayer = state.playerOrder[nextIdx]

          const newState: HeartsMultiplayerState = {
            ...state,
            currentTurnIndex: nextIdx,
            currentTurnPlayerId: nextPlayer,
            currentTrick: newTrick,
            heartsBroken,
            lastAction: `played ${card.rank} of ${card.suit}`,
            message: `Waiting for next player...`,
          }
          return { state: newState, hands: newHands, broadcast: { event: 'card-played', card: playedCard } }
        }

        // Trick is complete
        const winner = determineTrickWinner(newTrick)
        newTrick.winner = winner

        // Calculate trick points
        let trickPoints = 0
        for (const { card: c } of newTrick.cards) {
          if (c.suit === 'hearts') trickPoints += 1
          if (c.id === 'Q-spades') trickPoints += 13
        }

        const newRoundScores = { ...state.roundScores }
        newRoundScores[winner] = (newRoundScores[winner] || 0) + trickPoints

        const completedTricks = [...state.tricks, newTrick]
        const newTrickNumber = state.trickNumber + 1

        // Check if round is over (13 tricks)
        if (completedTricks.length === 13) {
          return finishRound(state, newHands, newRoundScores, completedTricks, newTrickNumber, heartsBroken)
        }

        // Next trick — winner leads
        const winnerIdx = state.playerOrder.indexOf(winner)
        const newState: HeartsMultiplayerState = {
          ...state,
          currentTurnIndex: winnerIdx,
          currentTurnPlayerId: winner,
          tricks: completedTricks,
          currentTrick: { cards: [], leadSuit: null, winner: null },
          roundScores: newRoundScores,
          heartsBroken,
          trickNumber: newTrickNumber,
          lastAction: `took the trick (+${trickPoints} pts)`,
          message: trickPoints > 0
            ? `Trick taken with ${trickPoints} point${trickPoints > 1 ? 's' : ''}!`
            : 'Trick taken.',
        }
        return { state: newState, hands: newHands, broadcast: { event: 'trick-won', winner, points: trickPoints } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: HeartsMultiplayerState) {
    if (state.phase === 'game-over') {
      // Winner is the player with the LOWEST score
      let lowestScore = Infinity
      let winnerId = state.playerOrder[0]
      for (const pid of state.playerOrder) {
        if (state.cumulativeScores[pid] < lowestScore) {
          lowestScore = state.cumulativeScores[pid]
          winnerId = pid
        }
      }
      return {
        isOver: true,
        scores: state.cumulativeScores,
        winner: winnerId,
      }
    }
    return { isOver: false }
  },

  getPublicState(state: HeartsMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      currentTrick: {
        cards: state.currentTrick.cards.map(({ playerId, card }) => ({
          playerId,
          card: { ...card, faceUp: true },
        })),
        leadSuit: state.currentTrick.leadSuit,
        winner: state.currentTrick.winner,
      },
      trickNumber: state.trickNumber,
      roundScores: state.roundScores,
      cumulativeScores: state.cumulativeScores,
      roundNumber: state.roundNumber,
      passDirection: state.passDirection,
      phase: state.phase,
      passComplete: state.passComplete,
      heartsBroken: state.heartsBroken,
      message: state.message,
      lastAction: state.lastAction,
      shotTheMoon: state.shotTheMoon,
    }
  },
}

// ─── Helper: Round End ──────────────────────────────────────────────────────

function finishRound(
  state: HeartsMultiplayerState,
  hands: Record<string, Card[]>,
  roundScores: Record<string, number>,
  completedTricks: Trick[],
  trickNumber: number,
  heartsBroken: boolean,
): {
  state: HeartsMultiplayerState
  hands: Record<string, Card[]>
  broadcast: any
} {
  // Check for shooting the moon
  let moonShooter: string | null = null
  for (const pid of state.playerOrder) {
    if (roundScores[pid] === 26) {
      moonShooter = pid
      break
    }
  }

  const adjustedScores: Record<string, number> = {}
  if (moonShooter) {
    for (const pid of state.playerOrder) {
      adjustedScores[pid] = pid === moonShooter ? 0 : 26
    }
  } else {
    for (const pid of state.playerOrder) {
      adjustedScores[pid] = roundScores[pid]
    }
  }

  const newCumulative: Record<string, number> = {}
  for (const pid of state.playerOrder) {
    newCumulative[pid] = (state.cumulativeScores[pid] || 0) + adjustedScores[pid]
  }

  // Check game over
  const maxScore = Math.max(...Object.values(newCumulative))
  const gameOver = maxScore >= GAME_OVER_SCORE

  const newState: HeartsMultiplayerState = {
    ...state,
    tricks: completedTricks,
    currentTrick: { cards: [], leadSuit: null, winner: null },
    roundScores: adjustedScores,
    cumulativeScores: newCumulative,
    heartsBroken,
    trickNumber,
    phase: gameOver ? 'game-over' : 'round-over',
    shotTheMoon: moonShooter,
    message: moonShooter
      ? 'Shot the Moon! Everyone else gets 26 points!'
      : gameOver
      ? 'Game over!'
      : 'Round complete!',
    lastAction: 'round ended',
  }

  return {
    state: newState,
    hands,
    broadcast: {
      event: 'round-end',
      roundScores: adjustedScores,
      cumulativeScores: newCumulative,
      shotTheMoon: moonShooter,
    },
  }
}
