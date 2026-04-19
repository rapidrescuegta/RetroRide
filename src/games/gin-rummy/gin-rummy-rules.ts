// ─── Gin Rummy Game Logic ────────────────────────────────────────────────────
// Pure functions — no React, no network, no side effects.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  type Suit,
  createDeck,
  shuffleDeck,
  sortHand,
  removeCards,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Meld {
  cards: Card[]
  type: 'set' | 'run'
}

export interface GinRummyState {
  deck: Card[]
  discardPile: Card[]
  playerHand: Card[]
  aiHand: Card[]
  currentPlayer: 'player' | 'ai'
  phase: 'draw' | 'discard' | 'knock-decision' | 'lay-off' | 'round-over' | 'game-over'
  playerScore: number
  aiScore: number
  roundNumber: number
  targetScore: number
  message: string
  knocker: 'player' | 'ai' | null
  playerMelds: Meld[]
  aiMelds: Meld[]
  playerDeadwood: Card[]
  aiDeadwood: Card[]
  roundResult: {
    knocker: 'player' | 'ai'
    knockerDeadwood: number
    defenderDeadwood: number
    points: number
    winner: 'player' | 'ai'
    isGin: boolean
    isUndercut: boolean
  } | null
  drawnCard: Card | null
  drawnFrom: 'deck' | 'discard' | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const RANK_VALUES: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 10, 'Q': 10, 'K': 10,
}

const RANK_ORDER: Record<Rank, number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function cardDeadwoodValue(card: Card): number {
  return RANK_VALUES[card.rank]
}

export function deadwoodTotal(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + cardDeadwoodValue(c), 0)
}

/** Find the best set of melds that minimizes deadwood. */
export function findBestMelds(hand: Card[]): { melds: Meld[]; deadwood: Card[] } {
  let bestMelds: Meld[] = []
  let bestDeadwood = [...hand]
  let bestDeadwoodValue = deadwoodTotal(hand)

  // Try all possible combinations of melds
  const allSets = findAllSets(hand)
  const allRuns = findAllRuns(hand)
  const allPossible = [...allSets, ...allRuns]

  // Try combinations using backtracking
  function tryMelds(melds: Meld[], usedIds: Set<string>, index: number) {
    // Calculate current deadwood
    const remaining = hand.filter(c => !usedIds.has(c.id))
    const dw = deadwoodTotal(remaining)
    if (dw < bestDeadwoodValue) {
      bestDeadwoodValue = dw
      bestMelds = [...melds]
      bestDeadwood = remaining
    }

    for (let i = index; i < allPossible.length; i++) {
      const meld = allPossible[i]
      if (meld.cards.some(c => usedIds.has(c.id))) continue

      const newUsed = new Set(usedIds)
      meld.cards.forEach(c => newUsed.add(c.id))
      tryMelds([...melds, meld], newUsed, i + 1)
    }
  }

  tryMelds([], new Set(), 0)
  return { melds: bestMelds, deadwood: bestDeadwood }
}

function findAllSets(hand: Card[]): Meld[] {
  const byRank: Record<string, Card[]> = {}
  for (const c of hand) {
    if (!byRank[c.rank]) byRank[c.rank] = []
    byRank[c.rank].push(c)
  }

  const sets: Meld[] = []
  for (const rank in byRank) {
    const cards = byRank[rank]
    if (cards.length >= 3) {
      // Add all 3-card combinations
      if (cards.length === 3) {
        sets.push({ cards: [...cards], type: 'set' })
      } else {
        // 4 cards: add the 4-card set and all 3-card subsets
        sets.push({ cards: [...cards], type: 'set' })
        for (let i = 0; i < cards.length; i++) {
          const subset = cards.filter((_, j) => j !== i)
          sets.push({ cards: subset, type: 'set' })
        }
      }
    }
  }
  return sets
}

function findAllRuns(hand: Card[]): Meld[] {
  const bySuit: Record<Suit, Card[]> = {
    hearts: [], diamonds: [], clubs: [], spades: []
  }
  for (const c of hand) {
    bySuit[c.suit].push(c)
  }

  const runs: Meld[] = []
  for (const suit of Object.keys(bySuit) as Suit[]) {
    const cards = bySuit[suit].sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank])
    if (cards.length < 3) continue

    // Find all consecutive runs of 3+
    for (let start = 0; start < cards.length - 2; start++) {
      const run: Card[] = [cards[start]]
      for (let j = start + 1; j < cards.length; j++) {
        if (RANK_ORDER[cards[j].rank] === RANK_ORDER[run[run.length - 1].rank] + 1) {
          run.push(cards[j])
          if (run.length >= 3) {
            runs.push({ cards: [...run], type: 'run' })
          }
        } else {
          break
        }
      }
    }
  }
  return runs
}

// ─── Initialize ─────────────────────────────────────────────────────────────

export function initGame(): GinRummyState {
  const deck = shuffleDeck(createDeck())

  const playerHand = sortHand(deck.slice(0, 10).map(c => ({ ...c, faceUp: true })))
  const aiHand = sortHand(deck.slice(10, 20).map(c => ({ ...c, faceUp: true })))
  const firstDiscard = { ...deck[20], faceUp: true }
  const remaining = deck.slice(21)

  return {
    deck: remaining,
    discardPile: [firstDiscard],
    playerHand,
    aiHand,
    currentPlayer: 'player',
    phase: 'draw',
    playerScore: 0,
    aiScore: 0,
    roundNumber: 1,
    targetScore: 100,
    message: 'Your turn! Draw from deck or discard pile.',
    knocker: null,
    playerMelds: [],
    aiMelds: [],
    playerDeadwood: [],
    aiDeadwood: [],
    roundResult: null,
    drawnCard: null,
    drawnFrom: null,
  }
}

export function startNewRound(state: GinRummyState): GinRummyState {
  const deck = shuffleDeck(createDeck())
  const playerHand = sortHand(deck.slice(0, 10).map(c => ({ ...c, faceUp: true })))
  const aiHand = sortHand(deck.slice(10, 20).map(c => ({ ...c, faceUp: true })))
  const firstDiscard = { ...deck[20], faceUp: true }
  const remaining = deck.slice(21)

  return {
    ...state,
    deck: remaining,
    discardPile: [firstDiscard],
    playerHand,
    aiHand,
    currentPlayer: 'player',
    phase: 'draw',
    roundNumber: state.roundNumber + 1,
    message: 'Your turn! Draw from deck or discard pile.',
    knocker: null,
    playerMelds: [],
    aiMelds: [],
    playerDeadwood: [],
    aiDeadwood: [],
    roundResult: null,
    drawnCard: null,
    drawnFrom: null,
  }
}

// ─── Drawing ────────────────────────────────────────────────────────────────

export function drawFromDeck(state: GinRummyState): GinRummyState {
  if (state.phase !== 'draw') return state
  if (state.deck.length === 0) return state

  const card = { ...state.deck[0], faceUp: true }
  const hand = state.currentPlayer === 'player' ? state.playerHand : state.aiHand
  const newHand = sortHand([...hand, card])

  return {
    ...state,
    deck: state.deck.slice(1),
    ...(state.currentPlayer === 'player'
      ? { playerHand: newHand }
      : { aiHand: newHand }),
    phase: 'discard',
    drawnCard: card,
    drawnFrom: 'deck',
    message: state.currentPlayer === 'player'
      ? 'Select a card to discard.'
      : 'AI is thinking...',
  }
}

export function drawFromDiscard(state: GinRummyState): GinRummyState {
  if (state.phase !== 'draw') return state
  if (state.discardPile.length === 0) return state

  const card = { ...state.discardPile[state.discardPile.length - 1], faceUp: true }
  const hand = state.currentPlayer === 'player' ? state.playerHand : state.aiHand
  const newHand = sortHand([...hand, card])

  return {
    ...state,
    discardPile: state.discardPile.slice(0, -1),
    ...(state.currentPlayer === 'player'
      ? { playerHand: newHand }
      : { aiHand: newHand }),
    phase: 'discard',
    drawnCard: card,
    drawnFrom: 'discard',
    message: state.currentPlayer === 'player'
      ? 'Select a card to discard.'
      : 'AI is thinking...',
  }
}

// ─── Discarding ─────────────────────────────────────────────────────────────

export function discardCard(state: GinRummyState, cardId: string): GinRummyState {
  if (state.phase !== 'discard') return state

  const hand = state.currentPlayer === 'player' ? state.playerHand : state.aiHand
  const card = hand.find(c => c.id === cardId)
  if (!card) return state

  const newHand = sortHand(removeCards(hand, [cardId]))
  const newDiscard = [...state.discardPile, card]

  // Check deadwood for knock eligibility
  const { deadwood } = findBestMelds(newHand)
  const dw = deadwoodTotal(deadwood)

  // Check if deck is almost empty (last 2 cards = draw)
  if (state.deck.length <= 2) {
    // Round is a draw -- no scoring
    return {
      ...state,
      ...(state.currentPlayer === 'player'
        ? { playerHand: newHand }
        : { aiHand: newHand }),
      discardPile: newDiscard,
      phase: 'round-over',
      message: 'Deck exhausted -- round is a draw!',
      roundResult: null,
      drawnCard: null,
      drawnFrom: null,
    }
  }

  // Switch turns
  const nextPlayer = state.currentPlayer === 'player' ? 'ai' : 'player'

  // If can knock, show option (only for human player)
  if (state.currentPlayer === 'player' && dw <= 10) {
    return {
      ...state,
      playerHand: newHand,
      discardPile: newDiscard,
      phase: 'knock-decision',
      message: dw === 0
        ? 'GIN! Knock for bonus points, or continue playing.'
        : `Deadwood: ${dw}. Knock or continue?`,
      drawnCard: null,
      drawnFrom: null,
    }
  }

  return {
    ...state,
    ...(state.currentPlayer === 'player'
      ? { playerHand: newHand }
      : { aiHand: newHand }),
    discardPile: newDiscard,
    currentPlayer: nextPlayer,
    phase: 'draw',
    message: nextPlayer === 'player'
      ? 'Your turn! Draw from deck or discard pile.'
      : 'AI is thinking...',
    drawnCard: null,
    drawnFrom: null,
  }
}

// ─── Knocking ───────────────────────────────────────────────────────────────

export function knock(state: GinRummyState, who: 'player' | 'ai'): GinRummyState {
  const knockerHand = who === 'player' ? state.playerHand : state.aiHand
  const defenderHand = who === 'player' ? state.aiHand : state.playerHand

  const knockerResult = findBestMelds(knockerHand)
  const defenderResult = findBestMelds(defenderHand)

  const knockerDW = deadwoodTotal(knockerResult.deadwood)
  const defenderDW = deadwoodTotal(defenderResult.deadwood)

  const isGin = knockerDW === 0
  const isUndercut = !isGin && defenderDW <= knockerDW

  let points: number
  let winner: 'player' | 'ai'

  if (isGin) {
    points = defenderDW + 25
    winner = who
  } else if (isUndercut) {
    points = knockerDW - defenderDW + 25
    winner = who === 'player' ? 'ai' : 'player'
  } else {
    points = knockerDW - defenderDW
    // The knocker wins the difference (defender has more deadwood)
    // Wait -- if knocker has less deadwood, knocker wins
    winner = who
    points = defenderDW - knockerDW
  }

  const newPlayerScore = state.playerScore + (winner === 'player' ? points : 0)
  const newAiScore = state.aiScore + (winner === 'ai' ? points : 0)

  const isGameOver = newPlayerScore >= state.targetScore || newAiScore >= state.targetScore

  return {
    ...state,
    phase: isGameOver ? 'game-over' : 'round-over',
    knocker: who,
    playerMelds: who === 'player' ? knockerResult.melds : defenderResult.melds,
    aiMelds: who === 'ai' ? knockerResult.melds : defenderResult.melds,
    playerDeadwood: who === 'player' ? knockerResult.deadwood : defenderResult.deadwood,
    aiDeadwood: who === 'ai' ? knockerResult.deadwood : defenderResult.deadwood,
    playerScore: newPlayerScore,
    aiScore: newAiScore,
    roundResult: {
      knocker: who,
      knockerDeadwood: knockerDW,
      defenderDeadwood: defenderDW,
      points,
      winner,
      isGin,
      isUndercut,
    },
    message: isGin
      ? `${who === 'player' ? 'You' : 'AI'} got GIN! +${points} points!`
      : isUndercut
        ? `UNDERCUT! ${winner === 'player' ? 'You' : 'AI'} win${winner === 'player' ? '' : 's'} ${points} points!`
        : `${winner === 'player' ? 'You' : 'AI'} win${winner === 'player' ? '' : 's'} ${points} points!`,
  }
}

export function continuePlay(state: GinRummyState): GinRummyState {
  if (state.phase !== 'knock-decision') return state
  return {
    ...state,
    currentPlayer: 'ai',
    phase: 'draw',
    message: 'AI is thinking...',
  }
}

// ─── AI ─────────────────────────────────────────────────────────────────────

export function aiTurn(state: GinRummyState, difficulty: 'easy' | 'medium' | 'hard'): GinRummyState {
  if (state.currentPlayer !== 'ai') return state

  // Draw phase
  if (state.phase === 'draw') {
    const afterDraw = aiDraw(state, difficulty)
    // Discard phase
    return aiDiscard(afterDraw, difficulty)
  }

  return state
}

function aiDraw(state: GinRummyState, difficulty: 'easy' | 'medium' | 'hard'): GinRummyState {
  if (difficulty === 'easy') {
    // Random: 50/50 deck vs discard
    if (state.discardPile.length > 0 && Math.random() < 0.3) {
      return drawFromDiscard(state)
    }
    return drawFromDeck(state)
  }

  // Medium/Hard: check if discard pile top card helps
  if (state.discardPile.length > 0) {
    const topDiscard = state.discardPile[state.discardPile.length - 1]
    const currentResult = findBestMelds(state.aiHand)
    const currentDW = deadwoodTotal(currentResult.deadwood)

    // Simulate adding the discard
    const withDiscard = [...state.aiHand, topDiscard]
    // Try removing each card to find best discard
    let bestDW = currentDW
    for (const c of withDiscard) {
      const without = withDiscard.filter(x => x.id !== c.id)
      const result = findBestMelds(without)
      const dw = deadwoodTotal(result.deadwood)
      if (dw < bestDW) bestDW = dw
    }

    if (bestDW < currentDW - (difficulty === 'hard' ? 0 : 2)) {
      return drawFromDiscard(state)
    }
  }

  return drawFromDeck(state)
}

function aiDiscard(state: GinRummyState, difficulty: 'easy' | 'medium' | 'hard'): GinRummyState {
  const hand = state.aiHand
  if (hand.length !== 11) return state

  if (difficulty === 'easy') {
    // Discard random card (not from a meld if possible)
    const result = findBestMelds(hand)
    const meldIds = new Set(result.melds.flatMap(m => m.cards.map(c => c.id)))
    const nonMeld = hand.filter(c => !meldIds.has(c.id))
    const candidates = nonMeld.length > 0 ? nonMeld : hand
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    const afterDiscard = discardCard(state, pick.id)

    // Check if AI can knock
    const aiHand2 = afterDiscard.aiHand
    const { deadwood } = findBestMelds(aiHand2)
    const dw = deadwoodTotal(deadwood)
    if (dw <= 10 && afterDiscard.phase === 'draw') {
      // AI decided to pass on knock opportunity on easy
      return afterDiscard
    }
    if (afterDiscard.phase === 'knock-decision') {
      // For AI, auto-decide knock
      return aiDecideKnock(afterDiscard, difficulty)
    }
    return afterDiscard
  }

  // Medium/Hard: find discard that minimizes deadwood
  let bestDiscardId = hand[0].id
  let bestDW = Infinity

  for (const c of hand) {
    const without = hand.filter(x => x.id !== c.id)
    const result = findBestMelds(without)
    const dw = deadwoodTotal(result.deadwood)
    if (dw < bestDW) {
      bestDW = dw
      bestDiscardId = c.id
    }
  }

  let afterDiscard = discardCard(state, bestDiscardId)

  // Check knock
  if (afterDiscard.phase === 'knock-decision') {
    return aiDecideKnock(afterDiscard, difficulty)
  }

  // AI side: check if we should knock after our discard
  // (discardCard only sets knock-decision for human player, so check manually)
  if (afterDiscard.currentPlayer === 'player' && afterDiscard.phase === 'draw') {
    const { deadwood } = findBestMelds(afterDiscard.aiHand)
    const dw = deadwoodTotal(deadwood)
    if (dw <= 10) {
      // AI knocks (only medium/hard reach here; easy returns above)
      if (difficulty === 'medium' && dw > 5 && Math.random() < 0.5) {
        return afterDiscard
      }
      return knock(afterDiscard, 'ai')
    }
  }

  return afterDiscard
}

function aiDecideKnock(state: GinRummyState, difficulty: 'easy' | 'medium' | 'hard'): GinRummyState {
  // This is called when the current player is 'player' but it's actually the AI's knock decision
  // Re-route: continue play (skip knock) for human player's knock-decision triggered during AI turn
  // Actually, discardCard sets knock-decision only when currentPlayer is 'player', so this shouldn't happen for AI
  // Let's handle it by just continuing
  return continuePlay(state)
}

export function getCanKnock(hand: Card[]): boolean {
  const { deadwood } = findBestMelds(hand)
  return deadwoodTotal(deadwood) <= 10
}

export function getDeadwoodValue(hand: Card[]): number {
  const { deadwood } = findBestMelds(hand)
  return deadwoodTotal(deadwood)
}
