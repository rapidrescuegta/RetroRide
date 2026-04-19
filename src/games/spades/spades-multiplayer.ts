// ─── Spades – Multiplayer Game Config ────────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// Spades is a 4-player partnership trick-taking game with bidding.
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

interface Trick {
  cards: { playerId: string; card: Card }[]
  leadSuit: Suit | null
  winner: string | null
}

export interface SpadesMultiplayerState {
  playerOrder: string[]           // [south, west, north, east]
  teams: [string[], string[]]     // [[south, north], [west, east]]
  teamNames: [string, string]
  currentTurnIndex: number
  currentTurnPlayerId: string
  bids: Record<string, number | null>  // null = not yet bid, -1 = nil
  tricksWon: Record<string, number>
  currentTrick: Trick
  completedTricks: Trick[]
  cumulativeScores: [number, number]
  cumulativeBags: [number, number]
  roundNumber: number
  dealer: string
  phase: 'bidding' | 'playing' | 'round-over' | 'game-over'
  spadesBroken: boolean
  trickNumber: number
  message: string
  lastAction: string | null
  roundResults: {
    teamBids: [number, number]
    teamTricks: [number, number]
    teamRoundScore: [number, number]
    nilResults: { playerId: string; success: boolean }[]
  } | null
  winner: number | null  // team index
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WINNING_SCORE = 500

// ─── Helpers ────────────────────────────────────────────────────────────────

function determineTrickWinner(trick: Trick): string {
  const leadSuit = trick.leadSuit!
  let highestTrump = -1
  let trumpWinner: string | null = null
  let highestLead = -1
  let leadWinner = trick.cards[0].playerId

  for (const { playerId, card } of trick.cards) {
    if (card.suit === 'spades') {
      if (card.value > highestTrump) {
        highestTrump = card.value
        trumpWinner = playerId
      }
    }
    if (card.suit === leadSuit && card.value > highestLead) {
      highestLead = card.value
      leadWinner = playerId
    }
  }

  return trumpWinner || leadWinner
}

function getPlayableCardIds(
  hand: Card[],
  currentTrick: Trick,
  spadesBroken: boolean,
): string[] {
  // Must follow suit if possible
  if (currentTrick.cards.length > 0 && currentTrick.leadSuit) {
    const suitCards = hand.filter(c => c.suit === currentTrick.leadSuit)
    if (suitCards.length > 0) {
      return suitCards.map(c => c.id)
    }
    // Can't follow suit — can play anything (including spades)
    return hand.map(c => c.id)
  }

  // Leading a trick
  if (currentTrick.cards.length === 0) {
    if (!spadesBroken) {
      const nonSpades = hand.filter(c => c.suit !== 'spades')
      if (nonSpades.length > 0) return nonSpades.map(c => c.id)
    }
    return hand.map(c => c.id)
  }

  return hand.map(c => c.id)
}

function getTeamIndex(teams: [string[], string[]], playerId: string): number {
  return teams[0].includes(playerId) ? 0 : 1
}

function getTeamBid(bids: Record<string, number | null>, team: string[]): number {
  let total = 0
  for (const pid of team) {
    const bid = bids[pid]
    if (bid === null || bid === -1) continue
    total += bid
  }
  return total
}

// ─── Config ─────────────────────────────────────────────────────────────────

export const spadesMultiplayer: MultiplayerGameConfig<SpadesMultiplayerState> = {
  gameType: 'spades',
  minPlayers: 4,
  maxPlayers: 4,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createDeck())
    const hands: Record<string, Card[]> = {}
    const playerOrder = players.map(p => p.id)

    // Teams: partners sit across [south+north] vs [west+east]
    const teams: [string[], string[]] = [
      [playerOrder[0], playerOrder[2]],
      [playerOrder[1], playerOrder[3]],
    ]

    for (let i = 0; i < 4; i++) {
      hands[playerOrder[i]] = sortHand(
        deck.slice(i * 13, (i + 1) * 13).map(c => ({ ...c, faceUp: true }))
      )
    }

    // Dealer is last player; first bidder is left of dealer
    const dealer = playerOrder[3]
    const firstBidder = playerOrder[0]

    const state: SpadesMultiplayerState = {
      playerOrder,
      teams,
      teamNames: ['Team 1', 'Team 2'],
      currentTurnIndex: 0,
      currentTurnPlayerId: firstBidder,
      bids: Object.fromEntries(playerOrder.map(p => [p, null])),
      tricksWon: Object.fromEntries(playerOrder.map(p => [p, 0])),
      currentTrick: { cards: [], leadSuit: null, winner: null },
      completedTricks: [],
      cumulativeScores: [0, 0],
      cumulativeBags: [0, 0],
      roundNumber: 0,
      dealer,
      phase: 'bidding',
      spadesBroken: false,
      trickNumber: 0,
      message: 'Place your bids!',
      lastAction: null,
      roundResults: null,
      winner: null,
    }

    return { state, hands }
  },

  processAction(
    state: SpadesMultiplayerState,
    action: GameAction,
    hands: Record<string, Card[]>,
  ) {
    const { type, playerId, data } = action
    const newHands = { ...hands }

    switch (type) {
      // ── Bidding ──
      case 'place-bid': {
        if (state.phase !== 'bidding') {
          return { state, hands, broadcast: null, error: 'Not in bidding phase' }
        }
        if (playerId !== state.currentTurnPlayerId) {
          return { state, hands, broadcast: null, error: 'Not your turn to bid' }
        }

        const bid = data.bid as number // 0 = nil, 1-13 = tricks
        if (bid < 0 || bid > 13) {
          return { state, hands, broadcast: null, error: 'Invalid bid' }
        }

        const newBids = { ...state.bids, [playerId]: bid === 0 ? -1 : bid }

        // Check if all players have bid
        const nextIdx = (state.playerOrder.indexOf(playerId) + 1) % 4
        const allBid = state.playerOrder.every(p => p === playerId || newBids[p] !== null)

        if (allBid) {
          // Move to playing — left of dealer leads
          const dealerIdx = state.playerOrder.indexOf(state.dealer)
          const firstLead = state.playerOrder[(dealerIdx + 1) % 4]
          const firstLeadIdx = state.playerOrder.indexOf(firstLead)

          const newState: SpadesMultiplayerState = {
            ...state,
            bids: newBids,
            currentTurnIndex: firstLeadIdx,
            currentTurnPlayerId: firstLead,
            phase: 'playing',
            message: 'All bids placed. Let the tricks begin!',
            lastAction: `bid ${bid === 0 ? 'Nil' : bid}`,
          }
          return { state: newState, hands: newHands, broadcast: { event: 'all-bids', bids: newBids } }
        }

        const newState: SpadesMultiplayerState = {
          ...state,
          bids: newBids,
          currentTurnIndex: nextIdx,
          currentTurnPlayerId: state.playerOrder[nextIdx],
          message: 'Waiting for bids...',
          lastAction: `bid ${bid === 0 ? 'Nil' : bid}`,
        }
        return { state: newState, hands: newHands, broadcast: { event: 'bid-placed', playerId, bid } }
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

        const playable = getPlayableCardIds(playerHand, state.currentTrick, state.spadesBroken)
        if (!playable.includes(cardId)) {
          return { state, hands, broadcast: null, error: 'Cannot play that card' }
        }

        newHands[playerId] = sortHand(removeCards(playerHand, [cardId]))
        const playedCard = { ...card, faceUp: true }

        const newTrick: Trick = {
          cards: [...state.currentTrick.cards, { playerId, card: playedCard }],
          leadSuit: state.currentTrick.leadSuit || playedCard.suit,
          winner: null,
        }

        const spadesBroken = state.spadesBroken || playedCard.suit === 'spades'

        // Trick not yet complete
        if (newTrick.cards.length < 4) {
          const nextIdx = (state.playerOrder.indexOf(playerId) + 1) % 4
          const nextPlayer = state.playerOrder[nextIdx]

          const newState: SpadesMultiplayerState = {
            ...state,
            currentTurnIndex: nextIdx,
            currentTurnPlayerId: nextPlayer,
            currentTrick: newTrick,
            spadesBroken,
            lastAction: `played ${card.rank} of ${card.suit}`,
            message: `Waiting for next player...`,
          }
          return { state: newState, hands: newHands, broadcast: { event: 'card-played', card: playedCard } }
        }

        // Trick is complete
        const winner = determineTrickWinner(newTrick)
        newTrick.winner = winner

        const newTricksWon = { ...state.tricksWon }
        newTricksWon[winner] = (newTricksWon[winner] || 0) + 1

        const completedTricks = [...state.completedTricks, newTrick]
        const newTrickNumber = state.trickNumber + 1

        // Check if round is over (13 tricks)
        if (completedTricks.length === 13) {
          return finishRound(state, newHands, newTricksWon, completedTricks, newTrickNumber, spadesBroken)
        }

        // Winner leads next trick
        const winnerIdx = state.playerOrder.indexOf(winner)
        const newState: SpadesMultiplayerState = {
          ...state,
          currentTurnIndex: winnerIdx,
          currentTurnPlayerId: winner,
          currentTrick: { cards: [], leadSuit: null, winner: null },
          completedTricks,
          tricksWon: newTricksWon,
          spadesBroken,
          trickNumber: newTrickNumber,
          lastAction: 'won the trick',
          message: 'Trick taken!',
        }
        return { state: newState, hands: newHands, broadcast: { event: 'trick-won', winner } }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state: SpadesMultiplayerState) {
    if (state.phase === 'game-over' && state.winner !== null) {
      // Convert team win to player scores
      const scores: Record<string, number> = {}
      for (const pid of state.playerOrder) {
        const teamIdx = getTeamIndex(state.teams, pid)
        scores[pid] = state.cumulativeScores[teamIdx]
      }
      // Winner is any player on the winning team
      const winnerId = state.teams[state.winner][0]
      return { isOver: true, scores, winner: winnerId }
    }
    return { isOver: false }
  },

  getPublicState(state: SpadesMultiplayerState) {
    return {
      currentTurnPlayerId: state.currentTurnPlayerId,
      currentTurnIndex: state.currentTurnIndex,
      playerOrder: state.playerOrder,
      teams: state.teams,
      teamNames: state.teamNames,
      bids: state.bids,
      tricksWon: state.tricksWon,
      currentTrick: {
        cards: state.currentTrick.cards.map(({ playerId, card }) => ({
          playerId,
          card: { ...card, faceUp: true },
        })),
        leadSuit: state.currentTrick.leadSuit,
        winner: state.currentTrick.winner,
      },
      trickNumber: state.trickNumber,
      cumulativeScores: state.cumulativeScores,
      cumulativeBags: state.cumulativeBags,
      roundNumber: state.roundNumber,
      dealer: state.dealer,
      phase: state.phase,
      spadesBroken: state.spadesBroken,
      message: state.message,
      lastAction: state.lastAction,
      roundResults: state.roundResults,
      winner: state.winner,
    }
  },
}

// ─── Helper: Round End ──────────────────────────────────────────────────────

function finishRound(
  state: SpadesMultiplayerState,
  hands: Record<string, Card[]>,
  tricksWon: Record<string, number>,
  completedTricks: Trick[],
  trickNumber: number,
  spadesBroken: boolean,
): {
  state: SpadesMultiplayerState
  hands: Record<string, Card[]>
  broadcast: any
} {
  const nilResults: { playerId: string; success: boolean }[] = []
  const teamTricks: [number, number] = [0, 0]
  const teamBids: [number, number] = [0, 0]
  const teamRoundScore: [number, number] = [0, 0]

  for (let t = 0; t < 2; t++) {
    for (const pid of state.teams[t]) {
      const tricks = tricksWon[pid] || 0

      if (state.bids[pid] === -1) {
        const success = tricks === 0
        nilResults.push({ playerId: pid, success })
        teamRoundScore[t] += success ? 100 : -100
        teamTricks[t] += tricks
      } else {
        teamTricks[t] += tricks
        teamBids[t] += state.bids[pid] || 0
      }
    }
  }

  for (let t = 0; t < 2; t++) {
    const bid = teamBids[t]
    if (bid === 0) continue

    if (teamTricks[t] >= bid) {
      teamRoundScore[t] += bid * 10
      const overtricks = teamTricks[t] - bid
      teamRoundScore[t] += overtricks
    } else {
      teamRoundScore[t] += bid * -10
    }
  }

  const newScores: [number, number] = [
    state.cumulativeScores[0] + teamRoundScore[0],
    state.cumulativeScores[1] + teamRoundScore[1],
  ]

  const newBags: [number, number] = [...state.cumulativeBags]
  for (let t = 0; t < 2; t++) {
    const bid = teamBids[t]
    const overtricks = Math.max(0, teamTricks[t] - bid)
    newBags[t] += overtricks
    if (newBags[t] >= 10) {
      const penalties = Math.floor(newBags[t] / 10)
      newScores[t] -= penalties * 100
      newBags[t] = newBags[t] % 10
    }
  }

  let gameOver = false
  let winner: number | null = null
  if (newScores[0] >= WINNING_SCORE || newScores[1] >= WINNING_SCORE) {
    gameOver = true
    if (newScores[0] >= WINNING_SCORE && newScores[1] >= WINNING_SCORE) {
      winner = newScores[0] >= newScores[1] ? 0 : 1
    } else {
      winner = newScores[0] >= WINNING_SCORE ? 0 : 1
    }
  }

  const roundResults = { teamBids, teamTricks, teamRoundScore, nilResults }

  const newState: SpadesMultiplayerState = {
    ...state,
    currentTrick: { cards: [], leadSuit: null, winner: null },
    completedTricks,
    tricksWon,
    cumulativeScores: newScores,
    cumulativeBags: newBags,
    spadesBroken,
    trickNumber,
    phase: gameOver ? 'game-over' : 'round-over',
    roundResults,
    winner,
    message: gameOver
      ? `Game over! ${winner === 0 ? 'Team 1' : 'Team 2'} wins!`
      : 'Round complete!',
    lastAction: 'round ended',
  }

  return {
    state: newState,
    hands,
    broadcast: { event: 'round-end', roundResults, scores: newScores },
  }
}
