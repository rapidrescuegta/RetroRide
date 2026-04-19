// ─── War – Pure Game Logic ───────────────────────────────────────────────────
// Classic War card game: split deck, flip cards, higher wins.
// Ties trigger a "war" scenario: 3 face-down + 1 face-up.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  createDeck,
  shuffleDeck,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WarState {
  playerDeck: Card[]
  aiDeck: Card[]
  playerCard: Card | null
  aiCard: Card | null
  // War scenario cards (face-down stakes + final face-up)
  warPlayerCards: Card[]
  warAiCards: Card[]
  pot: Card[] // all cards at stake in current battle
  phase: 'ready' | 'flipped' | 'war-stakes' | 'war-flip' | 'resolving' | 'game-over'
  message: string
  roundWinner: 'player' | 'ai' | 'war' | null
  warCount: number // how many consecutive wars this round
  playerScore: number
  aiScore: number
  totalRounds: number
  animationKey: number
}

// ─── Rank comparison ────────────────────────────────────────────────────────

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

function compareCards(a: Card, b: Card): number {
  return RANK_VALUES[a.rank] - RANK_VALUES[b.rank]
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(): WarState {
  const deck = shuffleDeck(createDeck())
  const half = Math.floor(deck.length / 2)
  return {
    playerDeck: deck.slice(0, half).map(c => ({ ...c, faceUp: false })),
    aiDeck: deck.slice(half).map(c => ({ ...c, faceUp: false })),
    playerCard: null,
    aiCard: null,
    warPlayerCards: [],
    warAiCards: [],
    pot: [],
    phase: 'ready',
    message: 'Tap to flip!',
    roundWinner: null,
    warCount: 0,
    playerScore: 26,
    aiScore: 26,
    totalRounds: 0,
    animationKey: 0,
  }
}

// ─── Flip cards ─────────────────────────────────────────────────────────────

export function flipCards(state: WarState): WarState {
  if (state.phase !== 'ready' && state.phase !== 'war-stakes') return state

  const playerDeck = [...state.playerDeck]
  const aiDeck = [...state.aiDeck]

  if (playerDeck.length === 0 || aiDeck.length === 0) {
    return {
      ...state,
      phase: 'game-over',
      message: playerDeck.length === 0 ? 'AI wins the game!' : 'You win the game!',
    }
  }

  // If we're in a war scenario, lay down face-down stakes first
  if (state.phase === 'war-stakes') {
    const stakesNeeded = Math.min(3, playerDeck.length - 1, aiDeck.length - 1)
    const warPlayerCards: Card[] = []
    const warAiCards: Card[] = []
    const pot = [...state.pot]

    for (let i = 0; i < stakesNeeded; i++) {
      warPlayerCards.push(playerDeck.shift()!)
      warAiCards.push(aiDeck.shift()!)
    }
    pot.push(...warPlayerCards, ...warAiCards)

    // Now flip the deciding cards
    if (playerDeck.length === 0 || aiDeck.length === 0) {
      // Not enough cards for war - whoever has more wins
      const winner = playerDeck.length >= aiDeck.length ? 'player' : 'ai'
      return {
        ...state,
        playerDeck,
        aiDeck,
        warPlayerCards,
        warAiCards,
        pot,
        phase: 'game-over',
        message: winner === 'player' ? 'You win! AI ran out of cards!' : 'AI wins! You ran out of cards!',
      }
    }

    const pCard = { ...playerDeck.shift()!, faceUp: true }
    const aCard = { ...aiDeck.shift()!, faceUp: true }
    pot.push(pCard, aCard)

    const cmp = compareCards(pCard, aCard)
    if (cmp === 0) {
      // Another war!
      return {
        ...state,
        playerDeck,
        aiDeck,
        playerCard: pCard,
        aiCard: aCard,
        warPlayerCards,
        warAiCards,
        pot,
        phase: 'war-stakes',
        message: 'DOUBLE WAR! Tap to continue!',
        roundWinner: 'war',
        warCount: state.warCount + 1,
        animationKey: state.animationKey + 1,
      }
    }

    const winner = cmp > 0 ? 'player' : 'ai'
    return {
      ...state,
      playerDeck,
      aiDeck,
      playerCard: pCard,
      aiCard: aCard,
      warPlayerCards,
      warAiCards,
      pot,
      phase: 'resolving',
      message: winner === 'player'
        ? `You win the war! +${pot.length} cards!`
        : `AI wins the war! +${pot.length} cards!`,
      roundWinner: winner,
      animationKey: state.animationKey + 1,
    }
  }

  // Normal flip
  const pCard = { ...playerDeck.shift()!, faceUp: true }
  const aCard = { ...aiDeck.shift()!, faceUp: true }
  const pot = [pCard, aCard]

  const cmp = compareCards(pCard, aCard)

  if (cmp === 0) {
    return {
      ...state,
      playerDeck,
      aiDeck,
      playerCard: pCard,
      aiCard: aCard,
      warPlayerCards: [],
      warAiCards: [],
      pot,
      phase: 'war-stakes',
      message: 'WAR! Tap to lay down stakes!',
      roundWinner: 'war',
      warCount: 1,
      totalRounds: state.totalRounds + 1,
      animationKey: state.animationKey + 1,
    }
  }

  const winner = cmp > 0 ? 'player' : 'ai'

  return {
    ...state,
    playerDeck,
    aiDeck,
    playerCard: pCard,
    aiCard: aCard,
    warPlayerCards: [],
    warAiCards: [],
    pot,
    phase: 'resolving',
    message: winner === 'player' ? 'You win this round!' : 'AI wins this round!',
    roundWinner: winner,
    warCount: 0,
    totalRounds: state.totalRounds + 1,
    animationKey: state.animationKey + 1,
  }
}

// ─── Collect cards (after resolving) ────────────────────────────────────────

export function collectCards(state: WarState): WarState {
  if (state.phase !== 'resolving') return state

  const playerDeck = [...state.playerDeck]
  const aiDeck = [...state.aiDeck]

  // Shuffle the pot before adding to winner's deck (prevents infinite loops)
  const shuffledPot = shuffleDeck(state.pot.map(c => ({ ...c, faceUp: false })))

  if (state.roundWinner === 'player') {
    playerDeck.push(...shuffledPot)
  } else {
    aiDeck.push(...shuffledPot)
  }

  // Check for game over
  if (playerDeck.length === 0) {
    return {
      ...state,
      playerDeck,
      aiDeck,
      playerCard: null,
      aiCard: null,
      warPlayerCards: [],
      warAiCards: [],
      pot: [],
      phase: 'game-over',
      message: 'AI wins the game!',
      playerScore: 0,
      aiScore: 52,
    }
  }
  if (aiDeck.length === 0) {
    return {
      ...state,
      playerDeck,
      aiDeck,
      playerCard: null,
      aiCard: null,
      warPlayerCards: [],
      warAiCards: [],
      pot: [],
      phase: 'game-over',
      message: 'You win the game!',
      playerScore: 52,
      aiScore: 0,
    }
  }

  return {
    ...state,
    playerDeck,
    aiDeck,
    playerCard: null,
    aiCard: null,
    warPlayerCards: [],
    warAiCards: [],
    pot: [],
    phase: 'ready',
    message: 'Tap to flip!',
    roundWinner: null,
    warCount: 0,
    playerScore: playerDeck.length,
    aiScore: aiDeck.length,
  }
}

export const RULES = {
  name: 'War',
  description: 'Classic card game of luck! Split the deck and flip cards — higher card wins. When tied, go to WAR: lay 3 face-down cards and flip one more to settle it.',
  controls: 'Tap to flip cards, tap again to collect',
  tips: [
    'War is mostly luck, so sit back and enjoy the ride!',
    'Watch for war scenarios — they can swing the game dramatically',
    'The game ends when one player collects all 52 cards',
  ],
}
