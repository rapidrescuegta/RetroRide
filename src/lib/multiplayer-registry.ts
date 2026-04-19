// ─── Multiplayer Game Registry ──────────────────────────────────────────────
// Defines which games support multiplayer, their type, and player count.
// Used by MultiplayerGameView to route to the correct component / mode.
// ─────────────────────────────────────────────────────────────────────────────

import type { MultiplayerGameConfig as CardMultiplayerConfig } from './multiplayer-game'
import { goFishMultiplayer } from '@/games/go-fish/go-fish-multiplayer'
import { crazyEightsMultiplayer } from '@/games/crazy-eights/crazy-eights-multiplayer'
import { heartsMultiplayer } from '@/games/hearts/hearts-multiplayer'
import { spadesMultiplayer } from '@/games/spades/spades-multiplayer'
import { pokerMultiplayer } from '@/games/poker/poker-multiplayer'
import { blackjackMultiplayer } from '@/games/blackjack/blackjack-multiplayer'
import { warMultiplayer } from '@/games/war/war-multiplayer'
import { oldMaidMultiplayer } from '@/games/old-maid/old-maid-multiplayer'
import { ginRummyMultiplayer } from '@/games/gin-rummy/gin-rummy-multiplayer'
import { colorClashMultiplayer } from '@/games/color-clash/color-clash-multiplayer'
import { euchreMultiplayer } from '@/games/euchre/euchre-multiplayer'
import { cribbageMultiplayer } from '@/games/cribbage/cribbage-multiplayer'
import { rummy500Multiplayer } from '@/games/rummy-500/rummy-500-multiplayer'

// ─── Types ──────────────────────────────────────────────────────────────────

export type MultiplayerType = 'turn-based' | 'real-time' | 'card-game'

export interface MultiplayerGameEntry {
  gameId: string
  type: MultiplayerType
  minPlayers: number
  maxPlayers: number
  description: string
  /** Card game configs that plug into useMultiplayerGame hook (card-game type only). */
  cardConfig?: CardMultiplayerConfig<any>
  /** Default timer in seconds for real-time score competitions. */
  timerSeconds?: number
}

// ─── Registry ────────────────────────────────────────────────────────────────

const MULTIPLAYER_GAMES: MultiplayerGameEntry[] = [
  // ── Card Games ─────────────────────────────────────────────────────────
  {
    gameId: 'crazy-eights',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Match suit or rank, 8s are wild!',
    cardConfig: crazyEightsMultiplayer,
  },
  {
    gameId: 'go-fish',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Collect books of 4 matching cards',
    cardConfig: goFishMultiplayer,
  },
  {
    gameId: 'hearts',
    type: 'card-game',
    minPlayers: 4,
    maxPlayers: 4,
    description: 'Avoid hearts and the Queen of Spades!',
    cardConfig: heartsMultiplayer,
  },
  {
    gameId: 'spades',
    type: 'card-game',
    minPlayers: 4,
    maxPlayers: 4,
    description: 'Bid and win tricks with your partner!',
    cardConfig: spadesMultiplayer,
  },
  {
    gameId: 'war',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Flip cards — higher wins!',
    cardConfig: warMultiplayer,
  },
  {
    gameId: 'blackjack',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 6,
    description: 'Beat the dealer to 21!',
    cardConfig: blackjackMultiplayer,
  },
  {
    gameId: 'old-maid',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 4,
    description: "Don't get stuck with the Queen!",
    cardConfig: oldMaidMultiplayer,
  },
  {
    gameId: 'poker',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 6,
    description: 'Texas Hold\'em with betting rounds!',
    cardConfig: pokerMultiplayer,
  },
  {
    gameId: 'gin-rummy',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Meld cards and knock to win!',
    cardConfig: ginRummyMultiplayer,
  },
  {
    gameId: 'color-clash',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 6,
    description: 'Match colors in this fast card game!',
    cardConfig: colorClashMultiplayer,
  },
  {
    gameId: 'euchre',
    type: 'card-game',
    minPlayers: 4,
    maxPlayers: 4,
    description: 'Team trick-taking with trump bidding!',
    cardConfig: euchreMultiplayer,
  },
  {
    gameId: 'cribbage',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Peg to 121 with card combinations!',
    cardConfig: cribbageMultiplayer,
  },

  {
    gameId: 'rummy-500',
    type: 'card-game',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Meld sets and runs — race to 500!',
    cardConfig: rummy500Multiplayer,
  },

  // ── Strategy / Turn-Based Board Games ──────────────────────────────────
  {
    gameId: 'tic-tac-toe',
    type: 'turn-based',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Get three in a row!',
  },
  {
    gameId: 'connect-four',
    type: 'turn-based',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Drop four in a row!',
  },
  {
    gameId: 'checkers',
    type: 'turn-based',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Jump and capture!',
  },
  {
    gameId: 'chess',
    type: 'turn-based',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic strategy game!',
  },

  // ── Arcade / Real-Time Score Competition ───────────────────────────────
  {
    gameId: 'snake',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Eat food, grow longer — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'tetris',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Stack and clear lines — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: '2048',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Merge tiles — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'flappy-bird',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Fly through pipes — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'dino-run',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Jump over cacti — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'space-invaders',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Defend Earth — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'pac-man',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Eat dots and avoid ghosts — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'asteroids',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Blast space rocks — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'frogger',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Cross the road — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'galaga',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Shoot alien swarms — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'breakout',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Break bricks — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'crossy-road',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Cross roads and rivers — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'doodle-jump',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Bounce to the top — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'brick-breaker',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Smash bricks — highest score wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'pong',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 2,
    description: 'Classic paddle — first to 10 wins!',
    timerSeconds: 180,
  },
  {
    gameId: 'whack-a-mole',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Whack moles — highest score wins!',
    timerSeconds: 60,
  },
  {
    gameId: 'memory-match',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Find pairs — fastest time wins!',
    timerSeconds: 120,
  },
  {
    gameId: 'simon',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Remember the sequence — highest round wins!',
    timerSeconds: 180,
  },
  {
    gameId: 'minesweeper',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Clear the field — fastest time wins!',
    timerSeconds: 300,
  },
  {
    gameId: 'wordle',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Guess the word — fewest guesses wins!',
    timerSeconds: 300,
  },
  {
    gameId: 'hangman',
    type: 'real-time',
    minPlayers: 2,
    maxPlayers: 4,
    description: 'Guess the word — fewest misses wins!',
    timerSeconds: 180,
  },
]

// ─── Lookup Helpers ──────────────────────────────────────────────────────────

const _entryMap = new Map<string, MultiplayerGameEntry>(
  MULTIPLAYER_GAMES.map(e => [e.gameId, e])
)

/** Legacy card-game configs keyed by gameId (for backward compat). */
const _cardConfigMap: Record<string, CardMultiplayerConfig> = {}
for (const entry of MULTIPLAYER_GAMES) {
  if (entry.cardConfig) {
    _cardConfigMap[entry.gameId] = entry.cardConfig
  }
}

/** Get the multiplayer entry for a game, or null if not supported. */
export function getMultiplayerConfig(gameId: string): MultiplayerGameEntry | null {
  return _entryMap.get(gameId) ?? null
}

/** Get the card-game MultiplayerGameConfig (for useMultiplayerGame hook). */
export function getCardMultiplayerConfig(gameId: string): CardMultiplayerConfig | null {
  return _cardConfigMap[gameId] ?? null
}

/** Check if a game supports online multiplayer. */
export function isMultiplayerSupported(gameId: string): boolean {
  return _entryMap.has(gameId)
}

/** Alias for isMultiplayerSupported — used by some callers. */
export function isMultiplayerGame(gameId: string): boolean {
  return _entryMap.has(gameId)
}

/** Get list of all game IDs that support multiplayer. */
export function getMultiplayerGameIds(): string[] {
  return MULTIPLAYER_GAMES.map(e => e.gameId)
}

/** Get player count info for a multiplayer game. */
export function getPlayerCount(gameId: string): { min: number; max: number } | null {
  const entry = _entryMap.get(gameId)
  if (!entry) return null
  return { min: entry.minPlayers, max: entry.maxPlayers }
}

/** Get all multiplayer entries. */
export function getAllMultiplayerGames(): MultiplayerGameEntry[] {
  return [...MULTIPLAYER_GAMES]
}

/** Get multiplayer entries filtered by type. */
export function getMultiplayerGamesByType(type: MultiplayerType): MultiplayerGameEntry[] {
  return MULTIPLAYER_GAMES.filter(e => e.type === type)
}
