// ─── Color Clash – Pure Game Logic ──────────────────────────────────────────
// A UNO-style card shedding game using a custom color deck.
// No React, no side effects. All state transitions are pure functions.
// ─────────────────────────────────────────────────────────────────────────────

// We use a custom deck (not standard 52-card) so we build our own cards.

export type CCColor = 'red' | 'blue' | 'green' | 'yellow'
export type CCValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2'

export type CCWildValue = 'wild' | 'wild-draw4'

export interface CCCard {
  id: string
  color: CCColor | 'wild'
  value: CCValue | CCWildValue
  faceUp: boolean
}

export interface CCPlayer {
  id: string
  name: string
  icon: string
  hand: CCCard[]
  score: number
  isAI: boolean
}

export interface ColorClashState {
  players: CCPlayer[]
  deck: CCCard[]
  discardPile: CCCard[]
  currentPlayerIndex: number
  currentColor: CCColor
  direction: 1 | -1
  phase: 'playing' | 'choosing-color' | 'round-over' | 'game-over'
  pendingDraw: number // accumulated draw2/draw4 cards
  roundWinner: string | null
  gameWinner: string | null
  targetScore: number
  message: string
  lastAction: string
  skipNextPlayer: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CC_COLORS: CCColor[] = ['red', 'blue', 'green', 'yellow']

export const COLOR_DISPLAY: Record<CCColor | 'wild', { label: string; hex: string; bg: string }> = {
  red: { label: 'Red', hex: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
  blue: { label: 'Blue', hex: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
  green: { label: 'Green', hex: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
  yellow: { label: 'Yellow', hex: '#eab308', bg: 'rgba(234, 179, 8, 0.2)' },
  wild: { label: 'Wild', hex: '#a78bfa', bg: 'rgba(167, 139, 250, 0.2)' },
}

export const VALUE_DISPLAY: Record<string, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  'skip': '\u{1F6AB}', 'reverse': '\u{1F504}', 'draw2': '+2',
  'wild': '\u{1F308}', 'wild-draw4': '+4',
}

const AI_PLAYERS = [
  { name: 'Bot Alice', icon: '\u{1F916}' },
  { name: 'Bot Bob', icon: '\u{1F3B0}' },
  { name: 'Bot Carol', icon: '\u{1F3B2}' },
]

// ─── Deck Creation ──────────────────────────────────────────────────────────

function createColorClashDeck(): CCCard[] {
  const cards: CCCard[] = []
  let idCounter = 0

  for (const color of CC_COLORS) {
    // One 0 per color
    cards.push({ id: `cc-${idCounter++}`, color, value: '0', faceUp: false })
    // Two of each 1-9, skip, reverse, draw2
    const values: CCValue[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2']
    for (const value of values) {
      cards.push({ id: `cc-${idCounter++}`, color, value, faceUp: false })
      cards.push({ id: `cc-${idCounter++}`, color, value, faceUp: false })
    }
  }

  // 4 wilds and 4 wild-draw4
  for (let i = 0; i < 4; i++) {
    cards.push({ id: `cc-${idCounter++}`, color: 'wild', value: 'wild', faceUp: false })
    cards.push({ id: `cc-${idCounter++}`, color: 'wild', value: 'wild-draw4', faceUp: false })
  }

  return cards
}

function shuffleDeck(deck: CCCard[]): CCCard[] {
  const shuffled = [...deck]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ─── Scoring ────────────────────────────────────────────────────────────────

export function cardPoints(card: CCCard): number {
  if (card.value === 'wild' || card.value === 'wild-draw4') return 50
  if (card.value === 'skip' || card.value === 'reverse' || card.value === 'draw2') return 20
  return parseInt(card.value) || 0
}

export function handPoints(hand: CCCard[]): number {
  return hand.reduce((sum, c) => sum + cardPoints(c), 0)
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(numAI: number = 1): ColorClashState {
  let deck = shuffleDeck(createColorClashDeck())
  const cardsPerPlayer = 7
  const players: CCPlayer[] = []

  // Deal to human
  const humanHand = deck.slice(0, cardsPerPlayer).map(c => ({ ...c, faceUp: true }))
  deck = deck.slice(cardsPerPlayer)
  players.push({
    id: 'human',
    name: 'You',
    icon: '\u{1F3AE}',
    hand: sortHand(humanHand),
    score: 0,
    isAI: false,
  })

  // Deal to AI
  for (let i = 0; i < numAI; i++) {
    const aiHand = deck.slice(0, cardsPerPlayer).map(c => ({ ...c, faceUp: true }))
    deck = deck.slice(cardsPerPlayer)
    players.push({
      id: `ai-${i}`,
      name: AI_PLAYERS[i].name,
      icon: AI_PLAYERS[i].icon,
      hand: sortHand(aiHand),
      score: 0,
      isAI: true,
    })
  }

  // Flip starter card (must be a number card)
  let startIdx = 0
  while (deck[startIdx].color === 'wild' || ['skip', 'reverse', 'draw2'].includes(deck[startIdx].value)) {
    startIdx++
  }
  const startCard = { ...deck[startIdx], faceUp: true }
  deck = [...deck.slice(0, startIdx), ...deck.slice(startIdx + 1)]

  return {
    players,
    deck,
    discardPile: [startCard],
    currentPlayerIndex: 0,
    currentColor: startCard.color as CCColor,
    direction: 1,
    phase: 'playing',
    pendingDraw: 0,
    roundWinner: null,
    gameWinner: null,
    targetScore: 300,
    message: 'Your turn! Play a matching card or draw.',
    lastAction: '',
    skipNextPlayer: false,
  }
}

function sortHand(hand: CCCard[]): CCCard[] {
  const colorOrder: Record<string, number> = { red: 0, blue: 1, green: 2, yellow: 3, wild: 4 }
  return [...hand].sort((a, b) => {
    const cd = colorOrder[a.color] - colorOrder[b.color]
    if (cd !== 0) return cd
    return a.value.localeCompare(b.value)
  })
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function canPlayCard(card: CCCard, topCard: CCCard, requiredColor: CCColor): boolean {
  if (card.color === 'wild') return true
  if (card.color === requiredColor) return true
  if (card.value === topCard.value && topCard.color !== 'wild') return true
  return false
}

export function getPlayableCards(hand: CCCard[], topCard: CCCard, requiredColor: CCColor): CCCard[] {
  return hand.filter(c => canPlayCard(c, topCard, requiredColor))
}

export function hasPlayableCard(hand: CCCard[], topCard: CCCard, requiredColor: CCColor): boolean {
  return hand.some(c => canPlayCard(c, topCard, requiredColor))
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function playCard(state: ColorClashState, cardId: string): ColorClashState {
  const player = state.players[state.currentPlayerIndex]
  const card = player.hand.find(c => c.id === cardId)
  if (!card) return state

  const topCard = state.discardPile[state.discardPile.length - 1]
  if (!canPlayCard(card, topCard, state.currentColor)) return state

  const newHand = player.hand.filter(c => c.id !== cardId)
  const playedCard = { ...card, faceUp: true }

  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: sortHand(newHand) } : p
  )

  // Wild cards require color choice
  if (card.color === 'wild') {
    return {
      ...state,
      players: newPlayers,
      discardPile: [...state.discardPile, playedCard],
      phase: 'choosing-color',
      pendingDraw: card.value === 'wild-draw4' ? state.pendingDraw + 4 : state.pendingDraw,
      lastAction: card.value === 'wild-draw4' ? 'wild-draw4' : 'wild',
      message: player.isAI ? `${player.name} played a Wild!` : 'Choose a color!',
    }
  }

  // Handle special action cards
  let newDirection = state.direction
  let skip = false
  let drawAdd = 0

  if (card.value === 'reverse') {
    newDirection = state.direction === 1 ? -1 : 1
    if (state.players.length === 2) skip = true // in 2-player, reverse acts like skip
  } else if (card.value === 'skip') {
    skip = true
  } else if (card.value === 'draw2') {
    drawAdd = 2
  }

  // Check if player went out
  if (newHand.length === 0) {
    return resolveRoundEnd(state, newPlayers, playedCard, card.color as CCColor)
  }

  // Advance turn
  let nextIdx = getNextPlayerIndex(state.currentPlayerIndex, newDirection, state.players.length)
  if (skip) {
    nextIdx = getNextPlayerIndex(nextIdx, newDirection, state.players.length)
  }

  // If draw2, the next player must draw
  const nextState: ColorClashState = {
    ...state,
    players: newPlayers,
    deck: state.deck,
    discardPile: [...state.discardPile, playedCard],
    currentPlayerIndex: nextIdx,
    currentColor: card.color as CCColor,
    direction: newDirection,
    pendingDraw: state.pendingDraw + drawAdd,
    lastAction: card.value,
    skipNextPlayer: false,
    message: '',
  }

  // Handle pending draws for next player
  if (nextState.pendingDraw > 0 && card.value !== 'draw2') {
    // No more stacking; resolve draws at turn start in the component
  }

  const nextPlayer = newPlayers[nextIdx]
  nextState.message = nextPlayer.isAI
    ? `${nextPlayer.name} is thinking...`
    : 'Your turn! Play a matching card or draw.'

  return nextState
}

export function chooseColor(state: ColorClashState, color: CCColor): ColorClashState {
  const player = state.players[state.currentPlayerIndex]

  // Check if player went out
  if (player.hand.length === 0) {
    return resolveRoundEnd(state, state.players, state.discardPile[state.discardPile.length - 1], color)
  }

  let nextIdx = getNextPlayerIndex(state.currentPlayerIndex, state.direction, state.players.length)

  // wild-draw4 also skips (the next player draws and loses turn)
  if (state.lastAction === 'wild-draw4') {
    // Next player draws 4 (handled at turn start)
  }

  const nextPlayer = state.players[nextIdx]
  return {
    ...state,
    currentColor: color,
    currentPlayerIndex: nextIdx,
    phase: 'playing',
    lastAction: '',
    message: nextPlayer.isAI
      ? `${player.name} chose ${COLOR_DISPLAY[color].label}. ${nextPlayer.name} is thinking...`
      : `${player.name} chose ${COLOR_DISPLAY[color].label}. Your turn!`,
  }
}

export function drawCards(state: ColorClashState): ColorClashState {
  const player = state.players[state.currentPlayerIndex]
  const drawCount = Math.max(1, state.pendingDraw)

  let newDeck = [...state.deck]
  let newDiscard = [...state.discardPile]
  const drawnCards: CCCard[] = []

  for (let i = 0; i < drawCount; i++) {
    if (newDeck.length === 0) {
      // Reshuffle discard (keep top)
      if (newDiscard.length <= 1) break
      const top = newDiscard[newDiscard.length - 1]
      newDeck = shuffleDeck(newDiscard.slice(0, -1).map(c => ({ ...c, faceUp: false })))
      newDiscard = [top]
    }
    drawnCards.push({ ...newDeck[0], faceUp: true })
    newDeck = newDeck.slice(1)
  }

  const newHand = sortHand([...player.hand, ...drawnCards])
  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p
  )

  // If had pending draw, turn passes after drawing
  if (state.pendingDraw > 0) {
    const nextIdx = getNextPlayerIndex(state.currentPlayerIndex, state.direction, state.players.length)
    const nextPlayer = newPlayers[nextIdx]
    return {
      ...state,
      players: newPlayers,
      deck: newDeck,
      discardPile: newDiscard,
      currentPlayerIndex: nextIdx,
      pendingDraw: 0,
      lastAction: 'drew',
      message: nextPlayer.isAI
        ? `${player.name} drew ${drawCount}. ${nextPlayer.name} is thinking...`
        : `${player.name} drew ${drawCount}. Your turn!`,
    }
  }

  // Drew 1 voluntarily; player can now play or pass
  const topCard = newDiscard[newDiscard.length - 1]
  if (!hasPlayableCard(newHand, topCard, state.currentColor)) {
    const nextIdx = getNextPlayerIndex(state.currentPlayerIndex, state.direction, state.players.length)
    const nextPlayer = newPlayers[nextIdx]
    return {
      ...state,
      players: newPlayers,
      deck: newDeck,
      discardPile: newDiscard,
      currentPlayerIndex: nextIdx,
      pendingDraw: 0,
      lastAction: 'drew-passed',
      message: nextPlayer.isAI
        ? `${player.name} drew and passed. ${nextPlayer.name} is thinking...`
        : `${player.name} drew and passed. Your turn!`,
    }
  }

  return {
    ...state,
    players: newPlayers,
    deck: newDeck,
    discardPile: newDiscard,
    pendingDraw: 0,
    lastAction: 'drew',
    message: player.isAI
      ? `${player.name} drew a card.`
      : 'Drew a card. Play a card or pass.',
  }
}

export function passTurn(state: ColorClashState): ColorClashState {
  const nextIdx = getNextPlayerIndex(state.currentPlayerIndex, state.direction, state.players.length)
  const nextPlayer = state.players[nextIdx]
  return {
    ...state,
    currentPlayerIndex: nextIdx,
    pendingDraw: 0,
    message: nextPlayer.isAI
      ? `${nextPlayer.name} is thinking...`
      : 'Your turn!',
  }
}

// ─── Round Resolution ───────────────────────────────────────────────────────

function resolveRoundEnd(
  state: ColorClashState,
  newPlayers: CCPlayer[],
  lastPlayedCard: CCCard,
  lastColor: CCColor
): ColorClashState {
  const winnerIndex = state.currentPlayerIndex
  const winner = newPlayers[winnerIndex]

  let roundScore = 0
  for (let i = 0; i < newPlayers.length; i++) {
    if (i !== winnerIndex) roundScore += handPoints(newPlayers[i].hand)
  }

  const updatedPlayers = newPlayers.map((p, i) =>
    i === winnerIndex ? { ...p, score: p.score + roundScore } : p
  )

  const gameWinner = updatedPlayers.find(p => p.score >= state.targetScore)

  return {
    ...state,
    players: updatedPlayers,
    discardPile: [...state.discardPile, lastPlayedCard],
    currentColor: lastColor,
    phase: gameWinner ? 'game-over' : 'round-over',
    roundWinner: winner.id,
    gameWinner: gameWinner?.id ?? null,
    pendingDraw: 0,
    message: gameWinner
      ? `${gameWinner.name} wins the game with ${gameWinner.score} points!`
      : `${winner.name} wins the round! (+${roundScore} points)`,
  }
}

export function startNewRound(state: ColorClashState): ColorClashState {
  const scores = state.players.map(p => p.score)
  const fresh = initGame(state.players.length - 1)
  return {
    ...fresh,
    players: fresh.players.map((p, i) => ({ ...p, score: scores[i] })),
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNextPlayerIndex(current: number, direction: 1 | -1, total: number): number {
  return (current + direction + total) % total
}

// ─── AI Logic ───────────────────────────────────────────────────────────────

export function getAIMove(
  state: ColorClashState,
  difficulty: 'easy' | 'medium' | 'hard'
): { action: 'play'; cardId: string } | { action: 'draw' } | { action: 'pass' } {
  const player = state.players[state.currentPlayerIndex]
  const topCard = state.discardPile[state.discardPile.length - 1]

  // Must draw if pending
  if (state.pendingDraw > 0) {
    return { action: 'draw' }
  }

  const playable = getPlayableCards(player.hand, topCard, state.currentColor)

  if (playable.length === 0) {
    if (state.deck.length === 0 && state.discardPile.length <= 1) {
      return { action: 'pass' }
    }
    return { action: 'draw' }
  }

  if (difficulty === 'easy') {
    const card = playable[Math.floor(Math.random() * playable.length)]
    return { action: 'play', cardId: card.id }
  }

  // Prefer action cards, save wilds
  const nonWilds = playable.filter(c => c.color !== 'wild')
  const actionCards = nonWilds.filter(c => ['skip', 'reverse', 'draw2'].includes(c.value))
  const numberCards = nonWilds.filter(c => !['skip', 'reverse', 'draw2'].includes(c.value))

  if (difficulty === 'hard') {
    // Play action cards first to disrupt, save wilds
    if (actionCards.length > 0) {
      return { action: 'play', cardId: actionCards[0].id }
    }
    if (numberCards.length > 0) {
      // Play from the color we have most of
      const colorCounts: Record<string, number> = {}
      player.hand.filter(c => c.color !== 'wild').forEach(c => {
        colorCounts[c.color] = (colorCounts[c.color] || 0) + 1
      })
      const sorted = [...numberCards].sort((a, b) => (colorCounts[b.color] || 0) - (colorCounts[a.color] || 0))
      return { action: 'play', cardId: sorted[0].id }
    }
    // Only wilds left
    return { action: 'play', cardId: playable[0].id }
  }

  // Medium
  if (nonWilds.length > 0) {
    const card = nonWilds[Math.floor(Math.random() * nonWilds.length)]
    return { action: 'play', cardId: card.id }
  }
  return { action: 'play', cardId: playable[0].id }
}

export function getAIColorChoice(
  state: ColorClashState,
  difficulty: 'easy' | 'medium' | 'hard'
): CCColor {
  const player = state.players[state.currentPlayerIndex]

  if (difficulty === 'easy') {
    return CC_COLORS[Math.floor(Math.random() * CC_COLORS.length)]
  }

  // Pick color we have most of
  const colorCounts: Record<CCColor, number> = { red: 0, blue: 0, green: 0, yellow: 0 }
  player.hand.filter(c => c.color !== 'wild').forEach(c => {
    colorCounts[c.color as CCColor]++
  })

  let best: CCColor = 'red'
  let bestCount = -1
  for (const c of CC_COLORS) {
    if (colorCounts[c] > bestCount) {
      bestCount = colorCounts[c]
      best = c
    }
  }
  return best
}

export function isStalemate(state: ColorClashState): boolean {
  if (state.deck.length > 0) return false
  if (state.discardPile.length > 1) return false
  const topCard = state.discardPile[state.discardPile.length - 1]
  return state.players.every(p => !hasPlayableCard(p.hand, topCard, state.currentColor))
}
