// ─── Texas Hold'em Poker – Pure Game Logic ──────────────────────────────────
// Simplified single-table Texas Hold'em against AI opponents.
// No React, no side effects. All state transitions are pure functions.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  type Suit,
  createDeck,
  shuffleDeck,
  dealCards,
  SUIT_SYMBOLS,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PokerPlayer {
  id: string
  name: string
  icon: string
  hand: Card[]
  chips: number
  currentBet: number
  folded: boolean
  isAI: boolean
  isAllIn: boolean
  lastAction: string | null
}

export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in'

export type HandRank =
  | 'high-card' | 'pair' | 'two-pair' | 'three-of-a-kind'
  | 'straight' | 'flush' | 'full-house' | 'four-of-a-kind'
  | 'straight-flush' | 'royal-flush'

export interface HandEvaluation {
  rank: HandRank
  rankValue: number
  kickers: number[]
  bestCards: Card[]
  description: string
}

export interface ShowdownResult {
  playerId: string
  handName: string
  bestCards: Card[]
  winnings: number
}

export interface PokerState {
  players: PokerPlayer[]
  deck: Card[]
  communityCards: Card[]
  pot: number
  currentPlayerIndex: number
  dealerIndex: number
  phase: 'pre-flop' | 'flop' | 'turn' | 'river' | 'showdown' | 'round-over' | 'game-over'
  currentBet: number
  lastRaiserIndex: number | null
  roundNumber: number
  message: string
  smallBlind: number
  bigBlind: number
  turnSeq: number
  showdownResults: ShowdownResult[] | null
  winnerId: string | null
}

// ─── Constants ──────────────────────────────────────────────────────────────

const AI_PLAYERS = [
  { name: 'Ace', icon: '\u{1F3B0}' },
  { name: 'Lucky', icon: '\u{1F3AF}' },
  { name: 'Shark', icon: '\u{1F988}' },
  { name: 'Bluff', icon: '\u{1F3B2}' },
]

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
  '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}

const STARTING_CHIPS = 1000

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(numAI: number = 3): PokerState {
  const players: PokerPlayer[] = [{
    id: 'human',
    name: 'You',
    icon: '\u{1F3AE}',
    hand: [],
    chips: STARTING_CHIPS,
    currentBet: 0,
    folded: false,
    isAI: false,
    isAllIn: false,
    lastAction: null,
  }]

  for (let i = 0; i < numAI; i++) {
    players.push({
      id: `ai-${i}`,
      name: AI_PLAYERS[i].name,
      icon: AI_PLAYERS[i].icon,
      hand: [],
      chips: STARTING_CHIPS,
      currentBet: 0,
      folded: false,
      isAI: true,
      isAllIn: false,
      lastAction: null,
    })
  }

  return startNewRound({
    players,
    deck: [],
    communityCards: [],
    pot: 0,
    currentPlayerIndex: 0,
    dealerIndex: -1,
    phase: 'pre-flop',
    currentBet: 0,
    lastRaiserIndex: null,
    roundNumber: 0,
    message: '',
    smallBlind: 10,
    bigBlind: 20,
    turnSeq: 0,
    showdownResults: null,
    winnerId: null,
  })
}

export function startNewRound(state: PokerState): PokerState {
  const alivePlayers = state.players.filter(p => p.chips > 0 || !p.isAI)
  if (alivePlayers.filter(p => p.chips > 0).length <= 1) {
    const winner = state.players.reduce((best, p) => p.chips > best.chips ? p : best, state.players[0])
    return {
      ...state,
      phase: 'game-over',
      winnerId: winner.id,
      message: `${winner.name} wins the game!`,
    }
  }

  let deck = shuffleDeck(createDeck())
  const dealerIdx = (state.dealerIndex + 1) % state.players.length

  const newPlayers = state.players.map(p => {
    if (p.chips <= 0 && p.isAI) {
      return { ...p, hand: [], folded: true, currentBet: 0, isAllIn: false, lastAction: null }
    }
    const { dealt, remaining } = dealCards(deck, 2)
    deck = remaining
    return { ...p, hand: dealt, folded: false, currentBet: 0, isAllIn: false, lastAction: null }
  })

  const sbIdx = getNextActive(dealerIdx, newPlayers)
  const bbIdx = getNextActive(sbIdx, newPlayers)
  const sb = Math.min(state.smallBlind, newPlayers[sbIdx].chips)
  const bb = Math.min(state.bigBlind, newPlayers[bbIdx].chips)

  newPlayers[sbIdx] = { ...newPlayers[sbIdx], chips: newPlayers[sbIdx].chips - sb, currentBet: sb }
  newPlayers[bbIdx] = { ...newPlayers[bbIdx], chips: newPlayers[bbIdx].chips - bb, currentBet: bb }
  if (newPlayers[sbIdx].chips === 0) newPlayers[sbIdx].isAllIn = true
  if (newPlayers[bbIdx].chips === 0) newPlayers[bbIdx].isAllIn = true

  const firstToAct = getNextActive(bbIdx, newPlayers)
  const firstPlayer = newPlayers[firstToAct]

  return {
    ...state,
    players: newPlayers,
    deck,
    communityCards: [],
    pot: sb + bb,
    currentPlayerIndex: firstToAct,
    dealerIndex: dealerIdx,
    phase: 'pre-flop',
    currentBet: bb,
    lastRaiserIndex: bbIdx,
    roundNumber: state.roundNumber + 1,
    message: firstPlayer.isAI
      ? `${firstPlayer.name} is thinking...`
      : 'Your turn: Call, Raise, or Fold.',
    turnSeq: state.turnSeq + 1,
    showdownResults: null,
    winnerId: null,
  }
}

function getNextActive(from: number, players: PokerPlayer[]): number {
  const n = players.length
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    if (!players[idx].folded && players[idx].chips > 0) return idx
  }
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n
    if (!players[idx].folded) return idx
  }
  return (from + 1) % n
}

// ─── Available Actions ──────────────────────────────────────────────────────

export function getAvailableActions(state: PokerState): PokerAction[] {
  const player = state.players[state.currentPlayerIndex]
  if (!player || player.folded || player.isAllIn) return []
  if (state.phase === 'round-over' || state.phase === 'game-over' || state.phase === 'showdown') return []

  const actions: PokerAction[] = ['fold']
  const toCall = state.currentBet - player.currentBet

  if (toCall === 0) actions.push('check')
  else actions.push('call')

  if (player.chips > toCall) actions.push('raise')
  if (player.chips > 0) actions.push('all-in')

  return actions
}

// ─── Perform Action ─────────────────────────────────────────────────────────

export function performAction(state: PokerState, action: PokerAction, raiseAmount?: number): PokerState {
  const player = state.players[state.currentPlayerIndex]
  if (!player || player.folded) return state

  let ns: PokerState
  switch (action) {
    case 'fold': ns = doFold(state); break
    case 'check': ns = doCheck(state); break
    case 'call': ns = doCall(state); break
    case 'raise': ns = doRaise(state, raiseAmount || state.bigBlind * 2); break
    case 'all-in': ns = doAllIn(state); break
    default: return state
  }
  return { ...ns, turnSeq: state.turnSeq + 1 }
}

function doFold(state: PokerState): PokerState {
  const player = state.players[state.currentPlayerIndex]
  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, folded: true, lastAction: 'fold' } : p
  )
  if (newPlayers.filter(p => !p.folded).length === 1) return resolveWinner({ ...state, players: newPlayers })
  return advanceTurn({ ...state, players: newPlayers, message: `${player.name} folds.` })
}

function doCheck(state: PokerState): PokerState {
  const player = state.players[state.currentPlayerIndex]
  if (state.currentBet > player.currentBet) return state
  const newPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, lastAction: 'check' } : p
  )
  return advanceTurn({ ...state, players: newPlayers, message: `${player.name} checks.` })
}

function doCall(state: PokerState): PokerState {
  const player = state.players[state.currentPlayerIndex]
  const toCall = Math.min(state.currentBet - player.currentBet, player.chips)
  const newPlayers = state.players.map((p, i) => {
    if (i !== state.currentPlayerIndex) return p
    const allIn = toCall >= p.chips
    return { ...p, chips: p.chips - toCall, currentBet: p.currentBet + toCall, isAllIn: allIn, lastAction: allIn ? 'all-in' : 'call' }
  })
  return advanceTurn({ ...state, players: newPlayers, pot: state.pot + toCall, message: `${player.name} calls.` })
}

function doRaise(state: PokerState, totalRaise: number): PokerState {
  const player = state.players[state.currentPlayerIndex]
  const totalBet = Math.min(totalRaise, player.chips + player.currentBet)
  const additional = totalBet - player.currentBet
  if (additional <= 0) return state
  const newPlayers = state.players.map((p, i) => {
    if (i !== state.currentPlayerIndex) return p
    const allIn = additional >= p.chips
    return { ...p, chips: p.chips - additional, currentBet: totalBet, isAllIn: allIn, lastAction: allIn ? 'all-in' : 'raise' }
  })
  return advanceTurn({
    ...state, players: newPlayers, pot: state.pot + additional, currentBet: totalBet,
    lastRaiserIndex: state.currentPlayerIndex, message: `${player.name} raises to ${totalBet}.`,
  })
}

function doAllIn(state: PokerState): PokerState {
  const player = state.players[state.currentPlayerIndex]
  const amount = player.chips
  const newBet = player.currentBet + amount
  const newPlayers = state.players.map((p, i) => {
    if (i !== state.currentPlayerIndex) return p
    return { ...p, chips: 0, currentBet: newBet, isAllIn: true, lastAction: 'all-in' }
  })
  return advanceTurn({
    ...state, players: newPlayers, pot: state.pot + amount,
    currentBet: Math.max(state.currentBet, newBet),
    lastRaiserIndex: newBet > state.currentBet ? state.currentPlayerIndex : state.lastRaiserIndex,
    message: `${player.name} goes all-in!`,
  })
}

// ─── Turn Advancement ──────────────────────────────────────────────────────

function advanceTurn(state: PokerState): PokerState {
  const active = state.players.filter(p => !p.folded)
  if (active.length <= 1) return resolveWinner(state)

  const canAct = state.players.filter(p => !p.folded && !p.isAllIn && p.chips > 0)
  if (canAct.length <= 1 && canAct.every(p => p.currentBet === state.currentBet)) {
    return runOutCommunity(state)
  }

  const n = state.players.length
  let nextIdx = state.currentPlayerIndex
  for (let i = 1; i <= n; i++) {
    const idx = (state.currentPlayerIndex + i) % n
    if (!state.players[idx].folded && !state.players[idx].isAllIn && state.players[idx].chips > 0) {
      nextIdx = idx; break
    }
  }

  const allBetsMatched = canAct.every(p => p.currentBet === state.currentBet)

  if (allBetsMatched && state.lastRaiserIndex !== null && nextIdx === state.lastRaiserIndex) {
    return advanceBettingRound(state)
  }

  if (allBetsMatched && state.lastRaiserIndex === null && canAct.every(p => p.lastAction !== null)) {
    return advanceBettingRound(state)
  }

  const nextPlayer = state.players[nextIdx]
  return {
    ...state, currentPlayerIndex: nextIdx,
    message: nextPlayer.isAI ? `${nextPlayer.name} is thinking...` : 'Your turn.',
  }
}

function advanceBettingRound(state: PokerState): PokerState {
  const newPlayers = state.players.map(p => ({ ...p, currentBet: 0, lastAction: null }))
  let community = [...state.communityCards]
  let deck = [...state.deck]
  let nextPhase: PokerState['phase']

  switch (state.phase) {
    case 'pre-flop': {
      const { dealt, remaining } = dealCards(deck, 3)
      community = dealt; deck = remaining; nextPhase = 'flop'; break
    }
    case 'flop': {
      const { dealt, remaining } = dealCards(deck, 1)
      community = [...community, ...dealt]; deck = remaining; nextPhase = 'turn'; break
    }
    case 'turn': {
      const { dealt, remaining } = dealCards(deck, 1)
      community = [...community, ...dealt]; deck = remaining; nextPhase = 'river'; break
    }
    default: return resolveShowdown({ ...state, players: newPlayers })
  }

  const canAct = newPlayers.filter(p => !p.folded && !p.isAllIn && p.chips > 0)
  if (canAct.length <= 1) {
    return runOutCommunity({ ...state, players: newPlayers, communityCards: community, deck, phase: nextPhase, currentBet: 0, lastRaiserIndex: null })
  }

  const first = getNextActive(state.dealerIndex, newPlayers)
  const fp = newPlayers[first]
  return {
    ...state, players: newPlayers, deck, communityCards: community, phase: nextPhase,
    currentPlayerIndex: first, currentBet: 0, lastRaiserIndex: null,
    message: fp.isAI ? `${fp.name} is thinking...` : `${nextPhase.charAt(0).toUpperCase() + nextPhase.slice(1)}! Your turn.`,
  }
}

function runOutCommunity(state: PokerState): PokerState {
  let community = [...state.communityCards]
  let deck = [...state.deck]
  while (community.length < 5 && deck.length > 0) {
    const { dealt, remaining } = dealCards(deck, 1)
    community = [...community, ...dealt]; deck = remaining
  }
  return resolveShowdown({ ...state, communityCards: community, deck })
}

// ─── Showdown & Resolution ─────────────────────────────────────────────────

function resolveShowdown(state: PokerState): PokerState {
  const active = state.players.filter(p => !p.folded)
  if (active.length <= 1) return resolveWinner(state)

  const results = active.map(p => ({ player: p, eval: evaluateHand([...p.hand, ...state.communityCards]) }))
  results.sort((a, b) => {
    if (a.eval.rankValue !== b.eval.rankValue) return b.eval.rankValue - a.eval.rankValue
    for (let i = 0; i < Math.min(a.eval.kickers.length, b.eval.kickers.length); i++) {
      if (a.eval.kickers[i] !== b.eval.kickers[i]) return b.eval.kickers[i] - a.eval.kickers[i]
    }
    return 0
  })

  const winner = results[0]
  const showdownResults: ShowdownResult[] = results.map(r => ({
    playerId: r.player.id, handName: r.eval.description, bestCards: r.eval.bestCards,
    winnings: r.player.id === winner.player.id ? state.pot : 0,
  }))

  const newPlayers = state.players.map(p => p.id === winner.player.id ? { ...p, chips: p.chips + state.pot } : p)
  const alive = newPlayers.filter(p => p.chips > 0)

  if (alive.length <= 1) {
    return { ...state, players: newPlayers, phase: 'game-over', showdownResults, winnerId: alive[0]?.id || winner.player.id, message: `${winner.player.name} wins the game!`, pot: 0 }
  }
  return { ...state, players: newPlayers, phase: 'round-over', showdownResults, winnerId: winner.player.id, message: `${winner.player.name} wins $${state.pot} with ${winner.eval.description}!`, pot: 0 }
}

function resolveWinner(state: PokerState): PokerState {
  const winner = state.players.filter(p => !p.folded)[0]
  const showdownResults: ShowdownResult[] = [{ playerId: winner.id, handName: 'Win by fold', bestCards: [], winnings: state.pot }]
  const newPlayers = state.players.map(p => p.id === winner.id ? { ...p, chips: p.chips + state.pot } : p)
  const alive = newPlayers.filter(p => p.chips > 0)

  if (alive.length <= 1) {
    return { ...state, players: newPlayers, phase: 'game-over', showdownResults, winnerId: alive[0]?.id || winner.id, message: `${winner.name} wins the game!`, pot: 0 }
  }
  return { ...state, players: newPlayers, phase: 'round-over', showdownResults, winnerId: winner.id, message: `${winner.name} wins $${state.pot}! Everyone else folded.`, pot: 0 }
}

// ─── Hand Evaluation ────────────────────────────────────────────────────────

export function evaluateHand(cards: Card[]): HandEvaluation {
  let best: HandEvaluation | null = null
  for (const combo of getCombinations(cards, 5)) {
    const ev = evaluate5Cards(combo)
    if (!best || ev.rankValue > best.rankValue || (ev.rankValue === best.rankValue && cmpKickers(ev.kickers, best.kickers) > 0)) best = ev
  }
  return best || { rank: 'high-card', rankValue: 0, kickers: [], bestCards: cards.slice(0, 5), description: 'High Card' }
}

function evaluate5Cards(cards: Card[]): HandEvaluation {
  const sorted = [...cards].sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank])
  const values = sorted.map(c => RANK_VALUES[c.rank])
  const suits = sorted.map(c => c.suit)
  const flush = suits.every(s => s === suits[0])
  const straight = checkStraight(values)
  const counts: Record<number, number> = {}
  values.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
  const groups = Object.entries(counts).map(([v, c]) => ({ value: parseInt(v), count: c })).sort((a, b) => b.count - a.count || b.value - a.value)

  if (flush && straight && values[0] === 14 && values[4] === 10) return mk('royal-flush', 9, values, sorted, 'Royal Flush')
  if (flush && straight) return mk('straight-flush', 8, [getSH(values)], sorted, `Straight Flush (${rn(getSH(values))} high)`)
  if (groups[0].count === 4) return mk('four-of-a-kind', 7, [groups[0].value, groups[1].value], sorted, `Four ${rn(groups[0].value)}s`)
  if (groups[0].count === 3 && groups[1]?.count === 2) return mk('full-house', 6, [groups[0].value, groups[1].value], sorted, `Full House (${rn(groups[0].value)}s over ${rn(groups[1].value)}s)`)
  if (flush) return mk('flush', 5, values, sorted, `Flush (${rn(values[0])} high)`)
  if (straight) return mk('straight', 4, [getSH(values)], sorted, `Straight (${rn(getSH(values))} high)`)
  if (groups[0].count === 3) return mk('three-of-a-kind', 3, [groups[0].value, ...groups.slice(1).map(g => g.value)], sorted, `Three ${rn(groups[0].value)}s`)
  if (groups[0].count === 2 && groups[1]?.count === 2) return mk('two-pair', 2, [groups[0].value, groups[1].value, groups[2]?.value || 0], sorted, `Two Pair (${rn(groups[0].value)}s and ${rn(groups[1].value)}s)`)
  if (groups[0].count === 2) return mk('pair', 1, [groups[0].value, ...groups.slice(1).map(g => g.value)], sorted, `Pair of ${rn(groups[0].value)}s`)
  return mk('high-card', 0, values, sorted, `${rn(values[0])} High`)
}

function mk(rank: HandRank, rankValue: number, kickers: number[], bestCards: Card[], description: string): HandEvaluation {
  return { rank, rankValue, kickers, bestCards, description }
}

function checkStraight(values: number[]): boolean {
  const u = [...new Set(values)].sort((a, b) => b - a)
  if (u.length < 5) return false
  for (let i = 0; i <= u.length - 5; i++) { let s = true; for (let j = 1; j < 5; j++) { if (u[i] - u[i + j] !== j) { s = false; break } } if (s) return true }
  return u.includes(14) && u.includes(2) && u.includes(3) && u.includes(4) && u.includes(5)
}

function getSH(values: number[]): number {
  const u = [...new Set(values)].sort((a, b) => b - a)
  if (u.includes(14) && u.includes(5) && u.includes(4) && u.includes(3) && u.includes(2)) {
    for (let i = 0; i <= u.length - 5; i++) { let s = true; for (let j = 1; j < 5; j++) { if (u[i] - u[i + j] !== j) { s = false; break } } if (s) return u[i] }
    return 5
  }
  return u[0]
}

function rn(v: number): string { return ({ 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten' } as Record<number, string>)[v] || String(v) }
function cmpKickers(a: number[], b: number[]): number { for (let i = 0; i < Math.min(a.length, b.length); i++) { if (a[i] !== b[i]) return a[i] - b[i] } return 0 }

function getCombinations(arr: Card[], k: number): Card[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  return [...getCombinations(rest, k - 1).map(c => [first, ...c]), ...getCombinations(rest, k)]
}

// ─── AI Logic ───────────────────────────────────────────────────────────────

export function getAIDecision(state: PokerState, difficulty: 'easy' | 'medium' | 'hard'): { action: PokerAction; raiseAmount?: number } {
  const player = state.players[state.currentPlayerIndex]
  const toCall = state.currentBet - player.currentBet
  const canChk = toCall === 0

  let hs = 0
  if (state.communityCards.length >= 3) {
    hs = evaluateHand([...player.hand, ...state.communityCards]).rankValue
  } else {
    const v1 = RANK_VALUES[player.hand[0]?.rank || '2'], v2 = RANK_VALUES[player.hand[1]?.rank || '2']
    if (v1 === v2 && v1 >= 10) hs = 6
    else if (v1 === v2) hs = 3
    else if (Math.max(v1, v2) >= 13 && Math.min(v1, v2) >= 10) hs = 5
    else if (Math.max(v1, v2) >= 12) hs = 1
  }

  if (difficulty === 'easy') {
    const r = Math.random()
    if (canChk) return r < 0.7 ? { action: 'check' } : { action: 'raise', raiseAmount: state.currentBet + state.bigBlind }
    return r < 0.3 ? { action: 'fold' } : r < 0.8 ? { action: 'call' } : { action: 'raise', raiseAmount: state.currentBet + state.bigBlind }
  }
  if (difficulty === 'medium') {
    if (canChk) { if (hs >= 3) return { action: 'raise', raiseAmount: state.currentBet + state.bigBlind * 2 }; return hs >= 1 ? { action: 'check' } : (Math.random() < 0.8 ? { action: 'check' } : { action: 'raise', raiseAmount: state.currentBet + state.bigBlind }) }
    if (hs >= 2) return { action: 'call' }; if (hs >= 1 && toCall <= state.bigBlind * 2) return { action: 'call' }; return Math.random() < 0.3 ? { action: 'call' } : { action: 'fold' }
  }
  // Hard
  if (canChk) { if (hs >= 4) return { action: 'raise', raiseAmount: state.currentBet + state.bigBlind * 3 }; if (hs >= 2 && Math.random() < 0.6) return { action: 'raise', raiseAmount: state.currentBet + state.bigBlind * 2 }; if (Math.random() < 0.15) return { action: 'raise', raiseAmount: state.currentBet + state.bigBlind * 2 }; return { action: 'check' } }
  if (hs >= 5) return { action: 'raise', raiseAmount: Math.min(state.currentBet + state.bigBlind * 3, player.chips + player.currentBet) }
  if (hs >= 3) return { action: 'call' }; if (hs >= 1 && toCall <= state.bigBlind * 3) return { action: 'call' }; return Math.random() < 0.1 ? { action: 'call' } : { action: 'fold' }
}

// ─── Score ─────────────────────────────────────────────────────────────────

export function getScore(state: PokerState): number {
  return state.players.find(p => p.id === 'human')?.chips || 0
}
