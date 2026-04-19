// ─── Blackjack – Pure Game Logic ─────────────────────────────────────────────
// Player vs dealer. Hit, Stand, Double Down, Split.
// Dealer hits on soft 17.
// ─────────────────────────────────────────────────────────────────────────────

import {
  type Card,
  type Rank,
  createDeck,
  shuffleDeck,
} from '@/lib/card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Hand {
  cards: Card[]
  bet: number
  doubled: boolean
  stood: boolean
  busted: boolean
  blackjack: boolean
  result: 'win' | 'lose' | 'push' | 'blackjack' | null
}

export interface BlackjackState {
  shoe: Card[]              // multi-deck shoe
  playerHands: Hand[]       // player can have multiple hands (split)
  activeHandIndex: number   // which hand is currently being played
  dealerCards: Card[]       // dealer's cards
  dealerRevealed: boolean   // has dealer flipped hole card
  balance: number
  currentBet: number
  phase: 'betting' | 'dealing' | 'player-turn' | 'dealer-turn' | 'resolving' | 'round-over' | 'game-over'
  message: string
  roundNumber: number
  animationKey: number
}

// ─── Card values ────────────────────────────────────────────────────────────

function cardValue(rank: Rank): number {
  if (rank === 'A') return 11
  if (['K', 'Q', 'J'].includes(rank)) return 10
  return parseInt(rank)
}

/** Calculate hand total, counting Aces as 1 or 11 optimally */
export function handTotal(cards: Card[]): number {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += cardValue(card.rank)
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return total
}

/** Is this a soft hand (contains an Ace counted as 11)? */
export function isSoftHand(cards: Card[]): boolean {
  let total = 0
  let aces = 0
  for (const card of cards) {
    total += cardValue(card.rank)
    if (card.rank === 'A') aces++
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces--
  }
  return aces > 0 && total <= 21
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21
}

export function isBusted(cards: Card[]): boolean {
  return handTotal(cards) > 21
}

export function canSplit(hand: Hand): boolean {
  return hand.cards.length === 2 &&
    hand.cards[0].rank === hand.cards[1].rank &&
    !hand.doubled
}

export function canDoubleDown(hand: Hand): boolean {
  return hand.cards.length === 2 && !hand.doubled
}

// ─── Shoe creation ──────────────────────────────────────────────────────────

function createShoe(numDecks: number): Card[] {
  const shoe: Card[] = []
  for (let i = 0; i < numDecks; i++) {
    const deck = createDeck()
    // Make each card ID unique across decks
    shoe.push(...deck.map(c => ({ ...c, id: `${c.id}-d${i}` })))
  }
  return shuffleDeck(shoe)
}

function dealOne(shoe: Card[], faceUp: boolean = true): { card: Card; shoe: Card[] } {
  const card = { ...shoe[0], faceUp }
  return { card, shoe: shoe.slice(1) }
}

// ─── Initialization ─────────────────────────────────────────────────────────

export function initGame(balance: number = 1000): BlackjackState {
  const numDecks = 6 // Standard blackjack shoe
  return {
    shoe: createShoe(numDecks),
    playerHands: [],
    activeHandIndex: 0,
    dealerCards: [],
    dealerRevealed: false,
    balance,
    currentBet: 0,
    phase: 'betting',
    message: 'Place your bet!',
    roundNumber: 0,
    animationKey: 0,
  }
}

// ─── Betting ────────────────────────────────────────────────────────────────

export function placeBet(state: BlackjackState, amount: number): BlackjackState {
  if (state.phase !== 'betting') return state
  if (amount > state.balance) return state
  if (amount <= 0) return state

  return {
    ...state,
    currentBet: amount,
    message: `Bet: $${amount}. Ready to deal!`,
  }
}

// ─── Deal ───────────────────────────────────────────────────────────────────

export function deal(state: BlackjackState): BlackjackState {
  if (state.phase !== 'betting' || state.currentBet <= 0) return state

  let shoe = [...state.shoe]

  // Reshuffle if shoe is low
  if (shoe.length < 52) {
    shoe = createShoe(6)
  }

  // Deal 2 cards to player, 2 to dealer (one face-down)
  const p1 = dealOne(shoe); shoe = p1.shoe
  const d1 = dealOne(shoe); shoe = d1.shoe
  const p2 = dealOne(shoe); shoe = p2.shoe
  const d2 = dealOne(shoe, false); shoe = d2.shoe // dealer hole card face-down

  const playerCards = [p1.card, p2.card]
  const dealerCards = [d1.card, d2.card]
  const playerBJ = isBlackjack(playerCards)
  const dealerBJ = isBlackjack(dealerCards)

  const hand: Hand = {
    cards: playerCards,
    bet: state.currentBet,
    doubled: false,
    stood: false,
    busted: false,
    blackjack: playerBJ,
    result: null,
  }

  // Check for immediate blackjack
  if (playerBJ || dealerBJ) {
    const revealedDealer = dealerCards.map(c => ({ ...c, faceUp: true }))
    let result: Hand['result'] = null
    let message = ''
    let balanceChange = 0

    if (playerBJ && dealerBJ) {
      result = 'push'
      message = 'Both have Blackjack! Push.'
      balanceChange = 0
    } else if (playerBJ) {
      result = 'blackjack'
      message = 'BLACKJACK! You win 3:2!'
      balanceChange = Math.floor(state.currentBet * 1.5)
    } else {
      result = 'lose'
      message = 'Dealer has Blackjack!'
      balanceChange = -state.currentBet
    }

    const newBalance = state.balance + balanceChange

    return {
      ...state,
      shoe,
      playerHands: [{ ...hand, result }],
      dealerCards: revealedDealer,
      dealerRevealed: true,
      balance: newBalance,
      phase: 'round-over',
      message,
      roundNumber: state.roundNumber + 1,
      animationKey: state.animationKey + 1,
    }
  }

  return {
    ...state,
    shoe,
    playerHands: [hand],
    activeHandIndex: 0,
    dealerCards,
    dealerRevealed: false,
    balance: state.balance - state.currentBet,
    phase: 'player-turn',
    message: `Your hand: ${handTotal(playerCards)}. Hit, Stand${canDoubleDown(hand) ? ', Double' : ''}${canSplit(hand) ? ', or Split' : ''}?`,
    roundNumber: state.roundNumber + 1,
    animationKey: state.animationKey + 1,
  }
}

// ─── Player Actions ─────────────────────────────────────────────────────────

function advanceToNextHand(state: BlackjackState): BlackjackState {
  const nextIndex = state.activeHandIndex + 1
  if (nextIndex < state.playerHands.length) {
    const nextHand = state.playerHands[nextIndex]
    return {
      ...state,
      activeHandIndex: nextIndex,
      message: `Hand ${nextIndex + 1}: ${handTotal(nextHand.cards)}. Hit or Stand?`,
    }
  }
  // All hands played, dealer's turn
  return {
    ...state,
    phase: 'dealer-turn',
    dealerRevealed: true,
    dealerCards: state.dealerCards.map(c => ({ ...c, faceUp: true })),
    message: 'Dealer reveals...',
  }
}

export function hit(state: BlackjackState): BlackjackState {
  if (state.phase !== 'player-turn') return state
  const hand = state.playerHands[state.activeHandIndex]
  if (hand.stood || hand.busted) return state

  let shoe = [...state.shoe]
  if (shoe.length < 10) shoe = createShoe(6)

  const { card, shoe: newShoe } = dealOne(shoe)
  const newCards = [...hand.cards, card]
  const total = handTotal(newCards)
  const busted = total > 21

  const newHand: Hand = {
    ...hand,
    cards: newCards,
    busted,
  }

  const newHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? newHand : h
  )

  let newState: BlackjackState = {
    ...state,
    shoe: newShoe,
    playerHands: newHands,
    animationKey: state.animationKey + 1,
  }

  if (busted) {
    newState.message = `Bust! (${total})`
    return advanceToNextHand(newState)
  }

  if (total === 21) {
    newState.message = `21! Standing.`
    newHands[state.activeHandIndex] = { ...newHand, stood: true }
    return advanceToNextHand(newState)
  }

  newState.message = `Your hand: ${total}. Hit or Stand?`
  return newState
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.phase !== 'player-turn') return state
  const hand = state.playerHands[state.activeHandIndex]
  if (hand.stood || hand.busted) return state

  const newHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? { ...h, stood: true } : h
  )

  return advanceToNextHand({
    ...state,
    playerHands: newHands,
  })
}

export function doubleDown(state: BlackjackState): BlackjackState {
  if (state.phase !== 'player-turn') return state
  const hand = state.playerHands[state.activeHandIndex]
  if (!canDoubleDown(hand)) return state
  if (state.balance < hand.bet) return { ...state, message: 'Not enough chips to double!' }

  let shoe = [...state.shoe]
  if (shoe.length < 10) shoe = createShoe(6)

  const { card, shoe: newShoe } = dealOne(shoe)
  const newCards = [...hand.cards, card]
  const total = handTotal(newCards)
  const busted = total > 21

  const newHand: Hand = {
    ...hand,
    cards: newCards,
    bet: hand.bet * 2,
    doubled: true,
    stood: !busted,
    busted,
  }

  const newHands = state.playerHands.map((h, i) =>
    i === state.activeHandIndex ? newHand : h
  )

  const newState: BlackjackState = {
    ...state,
    shoe: newShoe,
    playerHands: newHands,
    balance: state.balance - hand.bet, // deduct additional bet
    animationKey: state.animationKey + 1,
    message: busted ? `Bust on double! (${total})` : `Doubled: ${total}`,
  }

  return advanceToNextHand(newState)
}

export function split(state: BlackjackState): BlackjackState {
  if (state.phase !== 'player-turn') return state
  const hand = state.playerHands[state.activeHandIndex]
  if (!canSplit(hand)) return state
  if (state.balance < hand.bet) return { ...state, message: 'Not enough chips to split!' }

  let shoe = [...state.shoe]
  if (shoe.length < 10) shoe = createShoe(6)

  // Split into two hands
  const { card: card1, shoe: shoe1 } = dealOne(shoe)
  const { card: card2, shoe: shoe2 } = dealOne(shoe1)

  const hand1: Hand = {
    cards: [hand.cards[0], card1],
    bet: hand.bet,
    doubled: false,
    stood: false,
    busted: false,
    blackjack: false,
    result: null,
  }

  const hand2: Hand = {
    cards: [hand.cards[1], card2],
    bet: hand.bet,
    doubled: false,
    stood: false,
    busted: false,
    blackjack: false,
    result: null,
  }

  const newHands = [...state.playerHands]
  newHands.splice(state.activeHandIndex, 1, hand1, hand2)

  return {
    ...state,
    shoe: shoe2,
    playerHands: newHands,
    balance: state.balance - hand.bet,
    message: `Split! Hand 1: ${handTotal(hand1.cards)}. Hit or Stand?`,
    animationKey: state.animationKey + 1,
  }
}

// ─── Dealer Turn ────────────────────────────────────────────────────────────

export function dealerPlay(state: BlackjackState): BlackjackState {
  if (state.phase !== 'dealer-turn') return state

  // Check if all player hands are busted
  const allBusted = state.playerHands.every(h => h.busted)
  if (allBusted) {
    return resolveRound({
      ...state,
      dealerRevealed: true,
      dealerCards: state.dealerCards.map(c => ({ ...c, faceUp: true })),
    })
  }

  let shoe = [...state.shoe]
  let dealerCards = state.dealerCards.map(c => ({ ...c, faceUp: true }))
  let total = handTotal(dealerCards)

  // Dealer hits on soft 17 and below 17
  while (total < 17 || (total === 17 && isSoftHand(dealerCards))) {
    if (shoe.length < 10) shoe = createShoe(6)
    const { card, shoe: newShoe } = dealOne(shoe)
    dealerCards.push(card)
    shoe = newShoe
    total = handTotal(dealerCards)
  }

  return resolveRound({
    ...state,
    shoe,
    dealerCards,
    dealerRevealed: true,
  })
}

// ─── Round Resolution ───────────────────────────────────────────────────────

function resolveRound(state: BlackjackState): BlackjackState {
  const dealerTotal = handTotal(state.dealerCards)
  const dealerBusted = dealerTotal > 21

  let balanceChange = 0
  const resolvedHands = state.playerHands.map(hand => {
    if (hand.busted) {
      return { ...hand, result: 'lose' as const }
    }

    const playerTotal = handTotal(hand.cards)

    if (dealerBusted) {
      balanceChange += hand.bet * 2
      return { ...hand, result: 'win' as const }
    }

    if (playerTotal > dealerTotal) {
      balanceChange += hand.bet * 2
      return { ...hand, result: 'win' as const }
    }

    if (playerTotal === dealerTotal) {
      balanceChange += hand.bet // return bet
      return { ...hand, result: 'push' as const }
    }

    return { ...hand, result: 'lose' as const }
  })

  const newBalance = state.balance + balanceChange
  const wins = resolvedHands.filter(h => h.result === 'win').length
  const losses = resolvedHands.filter(h => h.result === 'lose').length
  const pushes = resolvedHands.filter(h => h.result === 'push').length

  let message = ''
  if (dealerBusted) {
    message = `Dealer busts with ${dealerTotal}! `
  } else {
    message = `Dealer: ${dealerTotal}. `
  }

  if (wins > 0 && losses === 0) message += 'You win!'
  else if (losses > 0 && wins === 0) message += 'Dealer wins.'
  else if (pushes > 0 && wins === 0 && losses === 0) message += 'Push!'
  else message += `${wins}W / ${losses}L / ${pushes}P`

  const isGameOver = newBalance <= 0

  return {
    ...state,
    playerHands: resolvedHands,
    balance: newBalance,
    phase: isGameOver ? 'game-over' : 'round-over',
    message: isGameOver ? 'Out of chips! Game over.' : message,
    animationKey: state.animationKey + 1,
  }
}

// ─── New Round ──────────────────────────────────────────────────────────────

export function newRound(state: BlackjackState): BlackjackState {
  return {
    ...state,
    playerHands: [],
    activeHandIndex: 0,
    dealerCards: [],
    dealerRevealed: false,
    currentBet: 0,
    phase: 'betting',
    message: 'Place your bet!',
  }
}

export const RULES = {
  name: 'Blackjack',
  description: 'Classic 21! Get closer to 21 than the dealer without going over. Face cards are 10, Aces are 1 or 11. Hit to draw, Stand to keep your hand, Double Down to double your bet for one more card, or Split pairs into two hands.',
  controls: 'Tap buttons to Hit, Stand, Double, or Split. Adjust bet with chip buttons.',
  tips: [
    'Always stand on 17 or higher',
    'Always hit on 11 or lower',
    'Double down on 10 or 11 when dealer shows 2-9',
    'Split Aces and 8s, never split 10s or 5s',
    'Dealer hits on soft 17 in this version',
  ],
}
