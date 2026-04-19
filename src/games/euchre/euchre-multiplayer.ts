// ─── Euchre – Multiplayer Game Config ─────────────────────────────────────────
// Implements MultiplayerGameConfig for real P2P multiplayer over WebRTC.
// Host is authoritative — validates moves, broadcasts state.
// 4-player team game (2v2): bid on trump, play 5 tricks per hand, first to 10 wins.
// ─────────────────────────────────────────────────────────────────────────────

import type { Card, Suit } from '@/lib/card-engine'
import { shuffleDeck, sortHand, removeCards, SUIT_SYMBOLS } from '@/lib/card-engine'
import type { MultiplayerGameConfig, Player, GameAction } from '@/lib/multiplayer-game'

// ─── Constants ───────────────────────────────────────────────────────────────

const EUCHRE_RANKS = ['9', '10', 'J', 'Q', 'K', 'A'] as const
type EuchreRank = (typeof EUCHRE_RANKS)[number]

const RANK_VALUE: Record<string, number> = {
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

const SAME_COLOR: Record<Suit, Suit> = {
  hearts: 'diamonds', diamonds: 'hearts',
  clubs: 'spades', spades: 'clubs',
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrickCard { playerId: string; card: Card }

interface Trick {
  cards: TrickCard[]
  leadSuit: Suit | null
  winner: string | null
}

type Phase =
  | 'bid-round-1' | 'bid-round-2'
  | 'playing' | 'trick-over' | 'hand-over' | 'game-over'

export interface EuchreMultiplayerState {
  playerOrder: string[]          // 4 player IDs in seat order
  teams: [string[], string[]]    // [[p0, p2], [p1, p3]] — partners across
  dealer: number                 // Index into playerOrder
  currentPlayer: number          // Index into playerOrder
  phase: Phase
  turnedCard: Card | null
  trump: Suit | null
  maker: string | null
  goingAlone: boolean
  alonePlayer: string | null
  deck: Card[]
  currentTrick: Trick
  completedTricks: Trick[]
  trickNumber: number
  teamScores: [number, number]
  handTricks: [number, number]
  bidRound: 1 | 2
  handNumber: number
  message: string
  lastAction: string | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createEuchreDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const cards: Card[] = []
  let id = 0
  for (const suit of suits) {
    for (const rank of EUCHRE_RANKS) {
      cards.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: RANK_VALUE[rank],
        faceUp: false,
      })
      id++
    }
  }
  return cards
}

function getTeamIndex(playerIndex: number): 0 | 1 {
  return (playerIndex % 2) as 0 | 1
}

function getEffectiveSuit(card: Card, trump: Suit): Suit {
  // Left bower (J of same color as trump) counts as trump
  if (card.rank === 'J' && card.suit === SAME_COLOR[trump]) return trump
  return card.suit
}

function getCardStrength(card: Card, trump: Suit, leadSuit: Suit | null): number {
  // Right bower: highest
  if (card.rank === 'J' && card.suit === trump) return 100
  // Left bower: second highest
  if (card.rank === 'J' && card.suit === SAME_COLOR[trump]) return 99
  // Trump suit
  if (getEffectiveSuit(card, trump) === trump) return 50 + card.value
  // Lead suit
  if (leadSuit && getEffectiveSuit(card, trump) === leadSuit) return 20 + card.value
  // Off-suit
  return card.value
}

function determineTrickWinner(trick: Trick, trump: Suit): string {
  const leadSuit = trick.cards.length > 0
    ? getEffectiveSuit(trick.cards[0].card, trump)
    : null
  let best = trick.cards[0]
  let bestStrength = getCardStrength(best.card, trump, leadSuit)
  for (let i = 1; i < trick.cards.length; i++) {
    const strength = getCardStrength(trick.cards[i].card, trump, leadSuit)
    if (strength > bestStrength) {
      best = trick.cards[i]
      bestStrength = strength
    }
  }
  return best.playerId
}

function nextSeatIndex(index: number, skip?: number | null, total = 4): number {
  let next = (index + 1) % total
  if (skip !== undefined && skip !== null && next === skip) next = (next + 1) % total
  return next
}

function getPlayableCards(hand: Card[], trick: Trick, trump: Suit): Card[] {
  if (trick.cards.length === 0) return hand // Lead can play anything
  const leadSuit = getEffectiveSuit(trick.cards[0].card, trump)
  const following = hand.filter(c => getEffectiveSuit(c, trump) === leadSuit)
  return following.length > 0 ? following : hand
}

// ─── Config ──────────────────────────────────────────────────────────────────

export const euchreMultiplayer: MultiplayerGameConfig<EuchreMultiplayerState> = {
  gameType: 'euchre',
  minPlayers: 4,
  maxPlayers: 4,

  initializeGame(players: Player[]) {
    const deck = shuffleDeck(createEuchreDeck())
    const playerOrder = players.map(p => p.id)
    const teams: [string[], string[]] = [
      [playerOrder[0], playerOrder[2]], // Partners across
      [playerOrder[1], playerOrder[3]],
    ]

    const hands: Record<string, Card[]> = {}
    // Deal 5 cards each
    for (let i = 0; i < 4; i++) {
      hands[playerOrder[i]] = sortHand(
        deck.slice(i * 5, (i + 1) * 5).map(c => ({ ...c, faceUp: true }))
      )
    }

    const turnedCard = { ...deck[20], faceUp: true }
    const remaining = deck.slice(21)

    const dealerIndex = 0
    const firstBidder = nextSeatIndex(dealerIndex)

    const state: EuchreMultiplayerState = {
      playerOrder,
      teams,
      dealer: dealerIndex,
      currentPlayer: firstBidder,
      phase: 'bid-round-1',
      turnedCard,
      trump: null,
      maker: null,
      goingAlone: false,
      alonePlayer: null,
      deck: remaining,
      currentTrick: { cards: [], leadSuit: null, winner: null },
      completedTricks: [],
      trickNumber: 0,
      teamScores: [0, 0],
      handTricks: [0, 0],
      bidRound: 1,
      handNumber: 1,
      message: `${players[firstBidder].name}'s bid — order up ${SUIT_SYMBOLS[turnedCard.suit]} or pass?`,
      lastAction: null,
    }

    return { state, hands }
  },

  processAction(state, action, hands) {
    const { type, playerId, data } = action
    const newHands = { ...hands }
    const playerIndex = state.playerOrder.indexOf(playerId)

    if (playerIndex === -1) {
      return { state, hands, broadcast: null, error: 'Invalid player' }
    }

    switch (type) {
      // ─── Bid: Order Up (round 1) ───────────────────────────────────
      case 'order-up': {
        if (state.phase !== 'bid-round-1') return { state, hands, broadcast: null, error: 'Not bidding round 1' }
        if (playerIndex !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn to bid' }

        const trump = state.turnedCard!.suit
        const dealerPid = state.playerOrder[state.dealer]

        // Dealer picks up turned card, auto-discards worst non-trump
        const dealerHand = [...(hands[dealerPid] ?? []), { ...state.turnedCard!, faceUp: true }]
        const nonTrump = dealerHand.filter(c => getEffectiveSuit(c, trump) !== trump)
        const toDiscard = nonTrump.length > 0
          ? nonTrump.reduce((worst, c) => c.value < worst.value ? c : worst)
          : dealerHand.reduce((worst, c) => getCardStrength(c, trump, null) < getCardStrength(worst, trump, null) ? c : worst)
        newHands[dealerPid] = sortHand(removeCards(dealerHand, [toDiscard.id]))

        const leadPlayer = nextSeatIndex(state.dealer)

        const newState: EuchreMultiplayerState = {
          ...state,
          phase: 'playing',
          trump,
          maker: playerId,
          turnedCard: null,
          currentPlayer: leadPlayer,
          currentTrick: { cards: [], leadSuit: null, winner: null },
          message: `${trump} is trump! ${state.playerOrder[leadPlayer]} leads.`,
          lastAction: 'ordered up',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'order-up', trump } }
      }

      // ─── Bid: Pass ─────────────────────────────────────────────────
      case 'pass': {
        if (state.phase !== 'bid-round-1' && state.phase !== 'bid-round-2') {
          return { state, hands, broadcast: null, error: 'Not in bidding phase' }
        }
        if (playerIndex !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn to bid' }

        const nextBidder = nextSeatIndex(state.currentPlayer)

        if (state.phase === 'bid-round-1') {
          // If dealer passes in round 1, move to round 2
          if (playerIndex === state.dealer) {
            const firstBidder = nextSeatIndex(state.dealer)
            const newState: EuchreMultiplayerState = {
              ...state,
              phase: 'bid-round-2',
              bidRound: 2,
              currentPlayer: firstBidder,
              message: 'Round 2 — name a trump suit (not the turned suit).',
              lastAction: 'all passed round 1',
            }
            return { state: newState, hands, broadcast: { action: 'pass-to-round-2' } }
          }
          // Next player bids
          const newState: EuchreMultiplayerState = {
            ...state,
            currentPlayer: nextBidder,
            message: `Passed. Next player's bid.`,
            lastAction: 'passed',
          }
          return { state: newState, hands, broadcast: { action: 'pass' } }
        }

        // Round 2 — if dealer must "stick"
        if (state.phase === 'bid-round-2' && playerIndex === state.dealer) {
          // Stick the dealer: must call trump
          return { state, hands, broadcast: null, error: 'Dealer must call trump (stick the dealer)' }
        }

        // Next player in round 2
        const newState: EuchreMultiplayerState = {
          ...state,
          currentPlayer: nextBidder,
          message: `Passed. Next player's bid.`,
          lastAction: 'passed',
        }
        return { state: newState, hands, broadcast: { action: 'pass' } }
      }

      // ─── Bid: Call Trump (round 2) ─────────────────────────────────
      case 'call-trump': {
        if (state.phase !== 'bid-round-2') return { state, hands, broadcast: null, error: 'Not in bid round 2' }
        if (playerIndex !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn to bid' }

        const suit = data.suit as Suit
        if (state.turnedCard && suit === state.turnedCard.suit) {
          return { state, hands, broadcast: null, error: 'Cannot call the turned suit in round 2' }
        }

        const leadPlayer = nextSeatIndex(state.dealer)

        const newState: EuchreMultiplayerState = {
          ...state,
          phase: 'playing',
          trump: suit,
          maker: playerId,
          turnedCard: null,
          currentPlayer: leadPlayer,
          currentTrick: { cards: [], leadSuit: null, winner: null },
          message: `${SUIT_SYMBOLS[suit]} is trump! ${state.playerOrder[leadPlayer]} leads.`,
          lastAction: `called ${suit}`,
        }
        return { state: newState, hands: newHands, broadcast: { action: 'call-trump', suit } }
      }

      // ─── Play Card ─────────────────────────────────────────────────
      case 'play-card': {
        if (state.phase !== 'playing') return { state, hands, broadcast: null, error: 'Not in playing phase' }
        if (playerIndex !== state.currentPlayer) return { state, hands, broadcast: null, error: 'Not your turn' }

        const cardId = data.cardId as string
        const playerHand = hands[playerId] ?? []
        const card = playerHand.find(c => c.id === cardId)
        if (!card) return { state, hands, broadcast: null, error: 'Card not in hand' }

        // Validate follow suit
        const playable = getPlayableCards(playerHand, state.currentTrick, state.trump!)
        if (!playable.find(c => c.id === cardId)) {
          return { state, hands, broadcast: null, error: 'Must follow suit if able' }
        }

        newHands[playerId] = sortHand(removeCards(playerHand, [cardId]))

        const newTrick: Trick = {
          cards: [...state.currentTrick.cards, { playerId, card: { ...card, faceUp: true } }],
          leadSuit: state.currentTrick.leadSuit ?? getEffectiveSuit(card, state.trump!),
          winner: null,
        }

        // Trick complete? (4 cards, or 3 if going alone)
        const trickSize = state.goingAlone ? 3 : 4
        if (newTrick.cards.length >= trickSize) {
          const winnerId = determineTrickWinner(newTrick, state.trump!)
          const winnerIndex = state.playerOrder.indexOf(winnerId)
          const winningTeam = getTeamIndex(winnerIndex)
          const newHandTricks = [...state.handTricks] as [number, number]
          newHandTricks[winningTeam]++

          const completedTrick = { ...newTrick, winner: winnerId }
          const newCompleted = [...state.completedTricks, completedTrick]
          const newTrickNumber = state.trickNumber + 1

          // Hand complete after 5 tricks?
          if (newTrickNumber >= 5) {
            const makerIndex = state.playerOrder.indexOf(state.maker!)
            const makerTeam = getTeamIndex(makerIndex)
            const defenderTeam = makerTeam === 0 ? 1 : 0

            let pointsEarned = 0
            let scoringTeam = makerTeam

            if (newHandTricks[makerTeam] >= 5) {
              pointsEarned = state.goingAlone ? 4 : 2 // March
            } else if (newHandTricks[makerTeam] >= 3) {
              pointsEarned = 1
            } else {
              // Euchred
              pointsEarned = 2
              scoringTeam = defenderTeam
            }

            const newTeamScores = [...state.teamScores] as [number, number]
            newTeamScores[scoringTeam] += pointsEarned

            const isGameOver = newTeamScores[0] >= 10 || newTeamScores[1] >= 10

            const newState: EuchreMultiplayerState = {
              ...state,
              phase: isGameOver ? 'game-over' : 'hand-over',
              currentTrick: completedTrick,
              completedTricks: newCompleted,
              trickNumber: newTrickNumber,
              handTricks: newHandTricks,
              teamScores: newTeamScores,
              message: isGameOver
                ? `Game over! Team ${scoringTeam + 1} wins!`
                : `Hand over. +${pointsEarned} to team ${scoringTeam + 1}.`,
              lastAction: `trick won`,
            }
            return { state: newState, hands: newHands, broadcast: { action: 'trick-complete', winner: winnerId } }
          }

          // More tricks to play
          const newState: EuchreMultiplayerState = {
            ...state,
            phase: 'trick-over',
            currentTrick: completedTrick,
            completedTricks: newCompleted,
            trickNumber: newTrickNumber,
            handTricks: newHandTricks,
            currentPlayer: winnerIndex,
            message: `Trick won! ${winnerId} leads next.`,
            lastAction: 'trick won',
          }
          return { state: newState, hands: newHands, broadcast: { action: 'trick-complete', winner: winnerId } }
        }

        // Next player's turn
        const skipIndex = state.goingAlone
          ? state.playerOrder.indexOf(
              state.teams[getTeamIndex(state.playerOrder.indexOf(state.alonePlayer!)) === 0 ? 0 : 1]
                .find(pid => pid !== state.alonePlayer!) ?? ''
            )
          : null
        const nextPlayer = nextSeatIndex(state.currentPlayer, skipIndex)

        const newState: EuchreMultiplayerState = {
          ...state,
          currentTrick: newTrick,
          currentPlayer: nextPlayer,
          message: `Waiting for next player...`,
          lastAction: 'played card',
        }
        return { state: newState, hands: newHands, broadcast: { action: 'play-card' } }
      }

      // ─── Continue (after trick or hand) ────────────────────────────
      case 'continue': {
        if (state.phase === 'trick-over') {
          const newState: EuchreMultiplayerState = {
            ...state,
            phase: 'playing',
            currentTrick: { cards: [], leadSuit: null, winner: null },
            message: 'Lead the next trick.',
            lastAction: null,
          }
          return { state: newState, hands, broadcast: { action: 'continue' } }
        }

        if (state.phase === 'hand-over') {
          // Deal new hand, rotate dealer
          const newDealer = nextSeatIndex(state.dealer)
          const deck = shuffleDeck(createEuchreDeck())

          for (let i = 0; i < 4; i++) {
            newHands[state.playerOrder[i]] = sortHand(
              deck.slice(i * 5, (i + 1) * 5).map(c => ({ ...c, faceUp: true }))
            )
          }

          const turnedCard = { ...deck[20], faceUp: true }
          const firstBidder = nextSeatIndex(newDealer)

          const newState: EuchreMultiplayerState = {
            ...state,
            dealer: newDealer,
            currentPlayer: firstBidder,
            phase: 'bid-round-1',
            turnedCard,
            trump: null,
            maker: null,
            goingAlone: false,
            alonePlayer: null,
            deck: deck.slice(21),
            currentTrick: { cards: [], leadSuit: null, winner: null },
            completedTricks: [],
            trickNumber: 0,
            handTricks: [0, 0],
            bidRound: 1,
            handNumber: state.handNumber + 1,
            message: `New hand. ${state.playerOrder[firstBidder]}'s bid.`,
            lastAction: null,
          }
          return { state: newState, hands: newHands, broadcast: { action: 'new-hand' } }
        }

        return { state, hands, broadcast: null, error: 'Nothing to continue' }
      }

      default:
        return { state, hands, broadcast: null, error: `Unknown action: ${type}` }
    }
  },

  checkGameOver(state) {
    if (state.phase === 'game-over') {
      const winningTeam = state.teamScores[0] >= 10 ? 0 : 1
      const scores: Record<string, number> = {}
      for (let i = 0; i < state.playerOrder.length; i++) {
        scores[state.playerOrder[i]] = state.teamScores[getTeamIndex(i)]
      }
      // Winner is first player on winning team
      const winner = state.teams[winningTeam][0]
      return { isOver: true, scores, winner }
    }
    return { isOver: false }
  },

  getPublicState(state) {
    return {
      playerOrder: state.playerOrder,
      teams: state.teams,
      dealer: state.dealer,
      currentPlayer: state.currentPlayer,
      currentPlayerId: state.playerOrder[state.currentPlayer],
      phase: state.phase,
      turnedCard: state.turnedCard,
      trump: state.trump,
      maker: state.maker,
      goingAlone: state.goingAlone,
      currentTrick: state.currentTrick,
      completedTricks: state.completedTricks,
      trickNumber: state.trickNumber,
      teamScores: state.teamScores,
      handTricks: state.handTricks,
      bidRound: state.bidRound,
      handNumber: state.handNumber,
      message: state.message,
      lastAction: state.lastAction,
    }
  },
}
