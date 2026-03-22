// ─── Card Engine ─────────────────────────────────────────────────────────────
// Core utilities for standard 52-card deck games.
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A'

export interface Card {
  id: string        // unique: "7-hearts"
  suit: Suit
  rank: Rank
  value: number     // numeric value (for ordering / scoring)
  faceUp: boolean
}

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

export const SUIT_COLORS: Record<Suit, string> = {
  hearts: '#ef4444',
  diamonds: '#ef4444',
  clubs: '#e2e8f0',
  spades: '#e2e8f0',
}

/** Numeric order for each rank (2=2 … A=14). */
const RANK_ORDER: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

/** Suit sort order for consistent hand display. */
const SUIT_ORDER: Record<Suit, number> = {
  clubs: 0, diamonds: 1, hearts: 2, spades: 3,
}

// ─── Deck Creation ──────────────────────────────────────────────────────────

/** Create a standard 52-card deck (unshuffled). */
export function createDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
        value: RANK_ORDER[rank],
        faceUp: false,
      })
    }
  }
  return deck
}

// ─── Shuffling ──────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns a new array, original untouched). */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ─── Dealing ────────────────────────────────────────────────────────────────

/** Deal `count` cards off the top of the deck. */
export function dealCards(
  deck: Card[],
  count: number
): { dealt: Card[]; remaining: Card[] } {
  const dealt = deck.slice(0, count).map(c => ({ ...c, faceUp: true }))
  const remaining = deck.slice(count)
  return { dealt, remaining }
}

// ─── Sorting ────────────────────────────────────────────────────────────────

/** Sort a hand by suit then by rank within suit. */
export function sortHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]
    if (suitDiff !== 0) return suitDiff
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank]
  })
}

// ─── Scoring ────────────────────────────────────────────────────────────────

/** Get the point value of a card for a specific game variant. */
export function getCardValue(
  card: Card,
  game: 'rummy' | 'hearts' | 'spades' | 'crazy-eights'
): number {
  switch (game) {
    case 'rummy': {
      // Face cards = 10, Ace = 15 (Rummy 500 style), number cards = face value
      if (card.rank === 'A') return 15
      if (['J', 'Q', 'K'].includes(card.rank)) return 10
      return RANK_ORDER[card.rank]
    }
    case 'hearts': {
      // Hearts = 1pt each, Queen of Spades = 13pts, everything else = 0
      if (card.suit === 'hearts') return 1
      if (card.suit === 'spades' && card.rank === 'Q') return 13
      return 0
    }
    case 'spades': {
      // Rank order for trick-taking (higher = stronger)
      return RANK_ORDER[card.rank]
    }
    case 'crazy-eights': {
      // 8s = 50pts, face cards = 10, Ace = 1, rest = face value
      if (card.rank === '8') return 50
      if (['J', 'Q', 'K'].includes(card.rank)) return 10
      if (card.rank === 'A') return 1
      return RANK_ORDER[card.rank]
    }
  }
}

// ─── Meld Validation (Rummy) ────────────────────────────────────────────────

/** Check if cards form a valid meld (set of 3+ same rank, or run of 3+ same suit). */
export function isValidMeld(cards: Card[]): boolean {
  if (cards.length < 3) return false
  return isSet(cards) || isRun(cards)
}

/** Check if cards are a set (3 or 4 of the same rank). */
export function isSet(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false
  const rank = cards[0].rank
  const suits = new Set(cards.map(c => c.suit))
  return cards.every(c => c.rank === rank) && suits.size === cards.length
}

/** Check if cards form a run (3+ consecutive cards of the same suit). */
export function isRun(cards: Card[]): boolean {
  if (cards.length < 3) return false

  const suit = cards[0].suit
  if (!cards.every(c => c.suit === suit)) return false

  const values = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b)

  // Check for duplicates
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[i - 1]) return false
  }

  // Check consecutive
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) {
      // Allow Ace-low run: A-2-3
      if (i === values.length - 1 && values[i] === 14 && values[0] === 2) {
        // Re-check the rest is consecutive from 2
        const lowValues = values.slice(0, -1)
        let isConsecutive = true
        for (let j = 1; j < lowValues.length; j++) {
          if (lowValues[j] !== lowValues[j - 1] + 1) {
            isConsecutive = false
            break
          }
        }
        if (isConsecutive && lowValues[0] === 2) return true
      }
      return false
    }
  }

  return true
}

/** Calculate the meld score for Rummy 500. */
export function getMeldScore(cards: Card[]): number {
  if (!isValidMeld(cards)) return 0
  return cards.reduce((sum, card) => sum + getCardValue(card, 'rummy'), 0)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Find a card in an array by id. */
export function findCard(cards: Card[], id: string): Card | undefined {
  return cards.find(c => c.id === id)
}

/** Remove cards from an array by id. Returns new array. */
export function removeCards(cards: Card[], ids: string[]): Card[] {
  const idSet = new Set(ids)
  return cards.filter(c => !idSet.has(c.id))
}

/** Get the display label for a card. */
export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`
}
