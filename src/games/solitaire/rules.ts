// ─── Solitaire (Klondike) – Pure Game Logic ─────────────────────────────────
// Classic 7-column tableau, 4 foundation piles, draw-3 from stock.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Suit,
  type Rank,
  createDeck,
  shuffleDeck,
  SUITS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SolitaireState {
  tableau: Card[][]       // 7 columns
  foundations: Card[][]   // 4 piles (one per suit: hearts, diamonds, clubs, spades)
  stock: Card[]           // remaining cards to draw from
  waste: Card[]           // drawn cards from stock
  phase: 'playing' | 'won' | 'game-over'
  moves: number
  startTime: number
  score: number
  message: string
  undoStack: SolitaireSnapshot[]
  selectedSource: CardSource | null
}

export interface SolitaireSnapshot {
  tableau: Card[][]
  foundations: Card[][]
  stock: Card[]
  waste: Card[]
  moves: number
  score: number
}

export type CardSource =
  | { type: 'tableau'; col: number; cardIndex: number }
  | { type: 'waste' }
  | { type: 'foundation'; pile: number }

// ─── Rank helpers ───────────────────────────────────────────────────────────

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

function isBlack(card: Card): boolean {
  return card.suit === 'clubs' || card.suit === 'spades'
}

function oppositeColor(a: Card, b: Card): boolean {
  return isRed(a) !== isRed(b)
}

function rankOf(card: Card): number {
  return RANK_ORDER[card.rank]
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(): SolitaireState {
  const deck = shuffleDeck(createDeck())
  const tableau: Card[][] = []
  let idx = 0

  // Deal 7 columns: col i gets i+1 cards, top card face-up
  for (let i = 0; i < 7; i++) {
    const col: Card[] = []
    for (let j = 0; j <= i; j++) {
      const card = { ...deck[idx], faceUp: j === i }
      col.push(card)
      idx++
    }
    tableau.push(col)
  }

  const stock = deck.slice(idx).map(c => ({ ...c, faceUp: false }))

  return {
    tableau,
    foundations: [[], [], [], []], // hearts, diamonds, clubs, spades
    stock,
    waste: [],
    phase: 'playing',
    moves: 0,
    startTime: Date.now(),
    score: 0,
    message: 'Move cards to build foundations Ace to King!',
    undoStack: [],
    selectedSource: null,
  }
}

// ─── Snapshot for undo ──────────────────────────────────────────────────────

function takeSnapshot(state: SolitaireState): SolitaireSnapshot {
  return {
    tableau: state.tableau.map(col => col.map(c => ({ ...c }))),
    foundations: state.foundations.map(pile => pile.map(c => ({ ...c }))),
    stock: state.stock.map(c => ({ ...c })),
    waste: state.waste.map(c => ({ ...c })),
    moves: state.moves,
    score: state.score,
  }
}

export function undo(state: SolitaireState): SolitaireState {
  if (state.undoStack.length === 0) return state
  const snapshot = state.undoStack[state.undoStack.length - 1]
  return {
    ...state,
    tableau: snapshot.tableau,
    foundations: snapshot.foundations,
    stock: snapshot.stock,
    waste: snapshot.waste,
    moves: snapshot.moves,
    score: Math.max(0, snapshot.score - 5), // penalty for undo
    undoStack: state.undoStack.slice(0, -1),
    selectedSource: null,
    message: 'Undo!',
  }
}

// ─── Draw from stock ────────────────────────────────────────────────────────

export function drawFromStock(state: SolitaireState): SolitaireState {
  const snapshot = takeSnapshot(state)

  if (state.stock.length === 0) {
    // Recycle waste back to stock
    if (state.waste.length === 0) return state
    return {
      ...state,
      stock: [...state.waste].reverse().map(c => ({ ...c, faceUp: false })),
      waste: [],
      undoStack: [...state.undoStack, snapshot],
      selectedSource: null,
      message: 'Deck recycled.',
    }
  }

  // Draw 3 (or fewer)
  const drawCount = Math.min(3, state.stock.length)
  const drawn = state.stock.slice(0, drawCount).map(c => ({ ...c, faceUp: true }))
  const remaining = state.stock.slice(drawCount)

  return {
    ...state,
    stock: remaining,
    waste: [...state.waste, ...drawn],
    undoStack: [...state.undoStack, snapshot],
    selectedSource: null,
    message: `Drew ${drawCount} card${drawCount > 1 ? 's' : ''}.`,
  }
}

// ─── Validation helpers ─────────────────────────────────────────────────────

/** Can this card go on top of a tableau column? */
export function canPlaceOnTableau(card: Card, column: Card[]): boolean {
  if (column.length === 0) {
    return card.rank === 'K' // Only kings on empty columns
  }
  const topCard = column[column.length - 1]
  return topCard.faceUp && oppositeColor(card, topCard) && rankOf(card) === rankOf(topCard) - 1
}

/** Can this card go on a foundation pile? */
export function canPlaceOnFoundation(card: Card, pile: Card[]): boolean {
  if (pile.length === 0) {
    return card.rank === 'A' // Only aces start foundations
  }
  const topCard = pile[pile.length - 1]
  return card.suit === topCard.suit && rankOf(card) === rankOf(topCard) + 1
}

/** Get the foundation pile index for a suit */
function foundationIndex(suit: Suit): number {
  return SUITS.indexOf(suit)
}

// ─── Get source card(s) ─────────────────────────────────────────────────────

export function getSourceCards(state: SolitaireState, source: CardSource): Card[] {
  switch (source.type) {
    case 'waste':
      return state.waste.length > 0 ? [state.waste[state.waste.length - 1]] : []
    case 'foundation':
      return state.foundations[source.pile].length > 0
        ? [state.foundations[source.pile][state.foundations[source.pile].length - 1]]
        : []
    case 'tableau': {
      const col = state.tableau[source.col]
      if (source.cardIndex < 0 || source.cardIndex >= col.length) return []
      if (!col[source.cardIndex].faceUp) return []
      return col.slice(source.cardIndex)
    }
  }
}

// ─── Move cards ─────────────────────────────────────────────────────────────

export function moveToTableau(state: SolitaireState, source: CardSource, targetCol: number): SolitaireState {
  const cards = getSourceCards(state, source)
  if (cards.length === 0) return state
  if (!canPlaceOnTableau(cards[0], state.tableau[targetCol])) return state

  const snapshot = takeSnapshot(state)
  let newState = { ...state }

  // Remove from source
  switch (source.type) {
    case 'waste': {
      newState = { ...newState, waste: state.waste.slice(0, -1) }
      break
    }
    case 'foundation': {
      const newFoundations = state.foundations.map((p, i) =>
        i === source.pile ? p.slice(0, -1) : [...p]
      )
      newState = { ...newState, foundations: newFoundations }
      break
    }
    case 'tableau': {
      const newTableau = state.tableau.map((col, i) => {
        if (i === source.col) {
          const remaining = col.slice(0, source.cardIndex)
          // Flip the new top card face-up
          if (remaining.length > 0 && !remaining[remaining.length - 1].faceUp) {
            remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], faceUp: true }
          }
          return remaining
        }
        return [...col]
      })
      newState = { ...newState, tableau: newTableau }
      break
    }
  }

  // Add to target tableau column
  const finalTableau = (newState.tableau || state.tableau).map((col, i) => {
    if (i === targetCol) {
      return [...col, ...cards]
    }
    return source.type === 'tableau' && newState.tableau ? [...newState.tableau[i]] : [...col]
  })

  // Use the tableau from newState if it was updated (for tableau source), otherwise build fresh
  const mergedTableau = source.type === 'tableau'
    ? newState.tableau!.map((col, i) => i === targetCol ? [...col, ...cards] : [...col])
    : finalTableau

  const scoreAdd = source.type === 'waste' ? 5 : source.type === 'foundation' ? -10 : 0

  return {
    ...newState,
    tableau: mergedTableau,
    moves: state.moves + 1,
    score: Math.max(0, state.score + scoreAdd),
    undoStack: [...state.undoStack.slice(-1), snapshot], // keep max 1 undo
    selectedSource: null,
    message: '',
  }
}

export function moveToFoundation(state: SolitaireState, source: CardSource): SolitaireState {
  const cards = getSourceCards(state, source)
  if (cards.length !== 1) return state // Can only move single cards to foundation

  const card = cards[0]
  const pileIdx = foundationIndex(card.suit)
  if (!canPlaceOnFoundation(card, state.foundations[pileIdx])) return state

  const snapshot = takeSnapshot(state)
  let newState = { ...state }

  // Remove from source
  switch (source.type) {
    case 'waste': {
      newState = { ...newState, waste: state.waste.slice(0, -1) }
      break
    }
    case 'tableau': {
      const newTableau = state.tableau.map((col, i) => {
        if (i === source.col) {
          const remaining = col.slice(0, -1)
          if (remaining.length > 0 && !remaining[remaining.length - 1].faceUp) {
            remaining[remaining.length - 1] = { ...remaining[remaining.length - 1], faceUp: true }
          }
          return remaining
        }
        return [...col]
      })
      newState = { ...newState, tableau: newTableau }
      break
    }
    case 'foundation': {
      // Moving from one foundation to another doesn't make sense
      return state
    }
  }

  // Add to foundation
  const newFoundations = (newState.foundations || state.foundations).map((pile, i) =>
    i === pileIdx ? [...pile, card] : [...pile]
  )

  const scoreAdd = source.type === 'waste' ? 15 : 10

  const result: SolitaireState = {
    ...newState,
    foundations: newFoundations,
    moves: state.moves + 1,
    score: state.score + scoreAdd,
    undoStack: [...state.undoStack.slice(-1), snapshot],
    selectedSource: null,
    message: '',
  }

  // Check win
  if (newFoundations.every(pile => pile.length === 13)) {
    return { ...result, phase: 'won', message: 'You win!' }
  }

  return result
}

// ─── Auto-complete check ────────────────────────────────────────────────────

/** Can we auto-complete? All tableau cards are face-up and stock/waste are empty */
export function canAutoComplete(state: SolitaireState): boolean {
  if (state.stock.length > 0 || state.waste.length > 0) return false
  return state.tableau.every(col => col.every(card => card.faceUp))
}

/** Auto-complete one step (move lowest available card to foundation) */
export function autoCompleteStep(state: SolitaireState): SolitaireState | null {
  // Check waste first
  if (state.waste.length > 0) {
    const card = state.waste[state.waste.length - 1]
    const pileIdx = foundationIndex(card.suit)
    if (canPlaceOnFoundation(card, state.foundations[pileIdx])) {
      return moveToFoundation(state, { type: 'waste' })
    }
  }

  // Check each tableau column
  for (let col = 0; col < 7; col++) {
    const column = state.tableau[col]
    if (column.length === 0) continue
    const card = column[column.length - 1]
    const pileIdx = foundationIndex(card.suit)
    if (canPlaceOnFoundation(card, state.foundations[pileIdx])) {
      return moveToFoundation(state, { type: 'tableau', col, cardIndex: column.length - 1 })
    }
  }

  return null // Nothing to auto-complete
}

// ─── Find valid moves for a source ──────────────────────────────────────────

export type MoveTarget =
  | { type: 'tableau'; col: number }
  | { type: 'foundation' }

export function getValidMoves(state: SolitaireState, source: CardSource): MoveTarget[] {
  const cards = getSourceCards(state, source)
  if (cards.length === 0) return []
  const targets: MoveTarget[] = []

  // Check foundation (only single cards)
  if (cards.length === 1) {
    const pileIdx = foundationIndex(cards[0].suit)
    if (canPlaceOnFoundation(cards[0], state.foundations[pileIdx])) {
      targets.push({ type: 'foundation' })
    }
  }

  // Check tableau columns
  for (let col = 0; col < 7; col++) {
    if (source.type === 'tableau' && source.col === col) continue
    if (canPlaceOnTableau(cards[0], state.tableau[col])) {
      targets.push({ type: 'tableau', col })
    }
  }

  return targets
}

// ─── Score calculation ──────────────────────────────────────────────────────

export function calculateFinalScore(state: SolitaireState): number {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000)
  const timeBonus = Math.max(0, 1000 - elapsed * 2)
  const movesPenalty = state.moves * 2
  return Math.max(0, state.score + timeBonus - movesPenalty)
}

export const RULES = {
  name: 'Solitaire (Klondike)',
  description: 'The classic card game! Build four foundation piles from Ace to King, one per suit. Move cards between tableau columns in descending order, alternating colors.',
  controls: 'Tap a card to select, tap destination to move. Tap stock pile to draw 3 cards.',
  tips: [
    'Always move Aces and Twos to foundations immediately',
    'Try to uncover face-down cards as soon as possible',
    'Keep tableau columns balanced - do not empty columns without a King to fill them',
    'Use the undo button if you get stuck (costs 5 points)',
  ],
}
