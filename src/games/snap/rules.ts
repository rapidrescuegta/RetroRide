// ─── Snap – Pure Game Logic ──────────────────────────────────────────────────
// Classic Snap card game: split deck, take turns flipping cards onto a shared pile.
// When two consecutive cards match in rank, the first to slap wins the pile.
// Slap wrongly and you lose a penalty card to your opponent.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  createDeck,
  shuffleDeck,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SnapPhase =
  | 'idle'        // between flips, waiting for next flip
  | 'flipping'    // card in the air (short animation)
  | 'snap-window' // match detected — race to slap!
  | 'resolving'   // pile being awarded
  | 'game-over'

export type Slapper = 'player' | 'ai' | null

export interface SnapState {
  playerDeck: Card[]
  aiDeck: Card[]
  pile: Card[]              // shared pile, top of stack = pile[pile.length - 1]
  lastFlipper: 'player' | 'ai' | null
  /** Whose deck flips next (alternates). */
  nextFlipper: 'player' | 'ai'
  phase: SnapPhase
  /** During snap-window, set when a slapper is determined. */
  slapWinner: Slapper
  /** True when the current slap was a wrong call (penalty awarded). */
  wrongSlap: 'player' | 'ai' | null
  message: string
  /** Cumulative stats. */
  playerPiles: number
  aiPiles: number
  totalRounds: number
  /** Incrementing key to trigger card animations. */
  animationKey: number
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(): SnapState {
  const deck = shuffleDeck(createDeck())
  const half = Math.floor(deck.length / 2)
  return {
    playerDeck: deck.slice(0, half).map(c => ({ ...c, faceUp: false })),
    aiDeck: deck.slice(half).map(c => ({ ...c, faceUp: false })),
    pile: [],
    lastFlipper: null,
    nextFlipper: 'player',
    phase: 'idle',
    slapWinner: null,
    wrongSlap: null,
    message: 'Tap Flip to play your top card!',
    playerPiles: 0,
    aiPiles: 0,
    totalRounds: 0,
    animationKey: 0,
  }
}

// ─── Flip the top card ──────────────────────────────────────────────────────

export function flipCard(state: SnapState): SnapState {
  if (state.phase !== 'idle') return state

  const flipper = state.nextFlipper
  const deck = flipper === 'player' ? [...state.playerDeck] : [...state.aiDeck]

  if (deck.length === 0) {
    // Current flipper has no cards — other player wins
    const winner = flipper === 'player' ? 'ai' : 'player'
    return {
      ...state,
      phase: 'game-over',
      message: winner === 'player' ? 'You win the game!' : 'AI wins the game!',
    }
  }

  const card = { ...deck.shift()!, faceUp: true }
  const pile = [...state.pile, card]

  // Match detection: does new card's rank equal previous pile card's rank?
  const prev = state.pile[state.pile.length - 1]
  const isMatch = prev !== undefined && prev.rank === card.rank

  const nextFlipper: 'player' | 'ai' = flipper === 'player' ? 'ai' : 'player'

  const base: SnapState = {
    ...state,
    playerDeck: flipper === 'player' ? deck : state.playerDeck,
    aiDeck: flipper === 'ai' ? deck : state.aiDeck,
    pile,
    lastFlipper: flipper,
    nextFlipper,
    totalRounds: state.totalRounds + 1,
    animationKey: state.animationKey + 1,
    wrongSlap: null,
    slapWinner: null,
  }

  if (isMatch) {
    return {
      ...base,
      phase: 'snap-window',
      message: 'SNAP! Tap SLAP now!',
    }
  }

  return {
    ...base,
    phase: 'idle',
    message: nextFlipper === 'player' ? 'Your turn — tap Flip!' : 'AI flipping…',
  }
}

// ─── Player or AI attempts to slap ──────────────────────────────────────────

export function slap(state: SnapState, by: 'player' | 'ai'): SnapState {
  // Don't allow double-slaps
  if (state.phase === 'resolving' || state.phase === 'game-over') return state
  if (state.slapWinner !== null) return state

  // Check if current top is a match with the previous
  const top = state.pile[state.pile.length - 1]
  const prev = state.pile[state.pile.length - 2]
  const isMatch = top !== undefined && prev !== undefined && top.rank === prev.rank

  if (state.phase === 'snap-window' && isMatch) {
    // Valid slap — award the pile
    const shuffledPile = shuffleDeck(state.pile.map(c => ({ ...c, faceUp: false })))
    const playerDeck = [...state.playerDeck]
    const aiDeck = [...state.aiDeck]

    if (by === 'player') {
      playerDeck.push(...shuffledPile)
    } else {
      aiDeck.push(...shuffledPile)
    }

    const gameOver = playerDeck.length === 0 || aiDeck.length === 0

    return {
      ...state,
      playerDeck,
      aiDeck,
      pile: [],
      phase: gameOver ? 'game-over' : 'resolving',
      slapWinner: by,
      message: gameOver
        ? (playerDeck.length === 0 ? 'AI wins the game!' : 'You win the game!')
        : by === 'player'
          ? `SNAP! You take ${shuffledPile.length} cards!`
          : `AI snapped first — +${shuffledPile.length} cards to AI.`,
      playerPiles: by === 'player' ? state.playerPiles + 1 : state.playerPiles,
      aiPiles: by === 'ai' ? state.aiPiles + 1 : state.aiPiles,
      animationKey: state.animationKey + 1,
    }
  }

  // Wrong slap — give penalty card to opponent (top of slapper's deck)
  if (by === 'player' && state.playerDeck.length > 0) {
    const playerDeck = [...state.playerDeck]
    const aiDeck = [...state.aiDeck]
    const penalty = { ...playerDeck.shift()!, faceUp: false }
    aiDeck.push(penalty)
    return {
      ...state,
      playerDeck,
      aiDeck,
      wrongSlap: 'player',
      message: 'Wrong slap! 1 card to AI.',
      animationKey: state.animationKey + 1,
    }
  }
  if (by === 'ai' && state.aiDeck.length > 0) {
    const playerDeck = [...state.playerDeck]
    const aiDeck = [...state.aiDeck]
    const penalty = { ...aiDeck.shift()!, faceUp: false }
    playerDeck.push(penalty)
    return {
      ...state,
      playerDeck,
      aiDeck,
      wrongSlap: 'ai',
      message: 'AI slapped wrong! 1 card to you.',
      animationKey: state.animationKey + 1,
    }
  }
  return state
}

// ─── Slap window expired (nobody slapped in time) ───────────────────────────

export function expireSnapWindow(state: SnapState): SnapState {
  if (state.phase !== 'snap-window') return state
  return {
    ...state,
    phase: 'idle',
    message: state.nextFlipper === 'player' ? 'Missed! Your turn — tap Flip.' : 'Missed! AI flipping…',
  }
}

// ─── Clear the "resolving" state after awarding the pile ────────────────────

export function continueAfterPile(state: SnapState): SnapState {
  if (state.phase !== 'resolving') return state
  return {
    ...state,
    phase: 'idle',
    slapWinner: null,
    message: state.nextFlipper === 'player' ? 'Your turn — tap Flip!' : 'AI flipping…',
  }
}

// ─── Difficulty → AI reaction time (ms) ─────────────────────────────────────

export function aiReactionTime(level: 'easy' | 'medium' | 'hard'): number {
  // Lower = faster AI. Range includes jitter.
  const base = level === 'easy' ? 1200 : level === 'medium' ? 700 : 380
  const jitter = level === 'easy' ? 400 : level === 'medium' ? 250 : 150
  return base + Math.floor(Math.random() * jitter)
}

/** AI auto-flip delay when it's the AI's turn to flip. */
export function aiFlipDelay(level: 'easy' | 'medium' | 'hard'): number {
  return level === 'easy' ? 1100 : level === 'medium' ? 850 : 650
}

/** Probability AI makes a wrong slap (catches a non-match). */
export function aiWrongSlapChance(level: 'easy' | 'medium' | 'hard'): number {
  return level === 'easy' ? 0.15 : level === 'medium' ? 0.05 : 0.02
}

export const RULES = {
  name: 'Snap',
  description: 'Lightning-fast card matching! Take turns flipping — when two in a row match rank, slap first to win the pile. Slap wrongly and lose a card!',
  controls: 'Tap Flip to play, tap SLAP when you see a match',
  tips: [
    'Watch the top two cards — same rank means SLAP!',
    'Don\'t slap unless you see a real match — wrong slaps cost a card.',
    'Win when your opponent runs out of cards.',
  ],
}
