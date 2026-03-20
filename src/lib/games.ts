export type Difficulty = 'kids' | 'everyone' | 'adults'

export interface GameInfo {
  id: string
  name: string
  icon: string
  color: string
  difficulty: Difficulty
  description: string
  controls: string
}

export const GAMES: GameInfo[] = [
  // === KIDS (Easy) ===
  {
    id: 'snake',
    name: 'Snake',
    icon: '🐍',
    color: '#10b981',
    difficulty: 'kids',
    description: 'Eat food, grow longer!',
    controls: 'Swipe or arrow keys',
  },
  {
    id: 'whack-a-mole',
    name: 'Whack-a-Mole',
    icon: '🔨',
    color: '#f59e0b',
    difficulty: 'kids',
    description: 'Tap the moles before they hide!',
    controls: 'Tap to whack',
  },
  {
    id: 'memory-match',
    name: 'Memory Match',
    icon: '🃏',
    color: '#ec4899',
    difficulty: 'kids',
    description: 'Find all the matching pairs!',
    controls: 'Tap to flip cards',
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic-Tac-Toe',
    icon: '❌',
    color: '#8b5cf6',
    difficulty: 'kids',
    description: 'Get three in a row!',
    controls: 'Tap to place',
  },
  {
    id: 'simon',
    name: 'Simon Says',
    icon: '🔴',
    color: '#ef4444',
    difficulty: 'kids',
    description: 'Remember the color pattern!',
    controls: 'Tap the colors',
  },
  {
    id: 'dino-run',
    name: 'Dino Run',
    icon: '🦖',
    color: '#6b7280',
    difficulty: 'kids',
    description: 'Jump over cacti!',
    controls: 'Tap or spacebar to jump',
  },
  {
    id: 'pong',
    name: 'Pong',
    icon: '🏓',
    color: '#06b6d4',
    difficulty: 'kids',
    description: 'Classic paddle ball!',
    controls: 'Drag or arrow keys',
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    icon: '🔴',
    color: '#dc2626',
    difficulty: 'kids',
    description: 'Drop four in a row!',
    controls: 'Tap column to drop',
  },
  {
    id: 'breakout',
    name: 'Breakout',
    icon: '🧱',
    color: '#f97316',
    difficulty: 'kids',
    description: 'Break all the bricks!',
    controls: 'Drag or arrow keys',
  },
  {
    id: 'flappy-bird',
    name: 'Flappy Bird',
    icon: '🐦',
    color: '#84cc16',
    difficulty: 'kids',
    description: 'Fly through the pipes!',
    controls: 'Tap to flap',
  },
  {
    id: 'hangman',
    name: 'Hangman',
    icon: '📝',
    color: '#a855f7',
    difficulty: 'kids',
    description: 'Guess the word!',
    controls: 'Tap letters',
  },
  {
    id: '2048',
    name: '2048',
    icon: '🔢',
    color: '#eab308',
    difficulty: 'kids',
    description: 'Merge tiles to reach 2048!',
    controls: 'Swipe or arrow keys',
  },
  // === ADULTS (Harder) ===
  {
    id: 'tetris',
    name: 'Tetris',
    icon: '🟦',
    color: '#3b82f6',
    difficulty: 'adults',
    description: 'Stack and clear lines!',
    controls: 'Swipe or arrow keys',
  },
  {
    id: 'space-invaders',
    name: 'Space Invaders',
    icon: '👾',
    color: '#22c55e',
    difficulty: 'adults',
    description: 'Defend Earth from aliens!',
    controls: 'Drag to move, tap to shoot',
  },
  {
    id: 'pac-man',
    name: 'Pac-Man',
    icon: '🟡',
    color: '#facc15',
    difficulty: 'adults',
    description: 'Eat dots, avoid ghosts!',
    controls: 'Swipe or arrow keys',
  },
  {
    id: 'asteroids',
    name: 'Asteroids',
    icon: '☄️',
    color: '#a1a1aa',
    difficulty: 'adults',
    description: 'Blast space rocks!',
    controls: 'Arrow keys + space to shoot',
  },
  {
    id: 'frogger',
    name: 'Frogger',
    icon: '🐸',
    color: '#4ade80',
    difficulty: 'adults',
    description: 'Cross the road safely!',
    controls: 'Swipe or arrow keys',
  },
  {
    id: 'minesweeper',
    name: 'Minesweeper',
    icon: '💣',
    color: '#64748b',
    difficulty: 'adults',
    description: 'Clear the minefield!',
    controls: 'Tap to reveal, long-press to flag',
  },
  {
    id: 'wordle',
    name: 'Wordle',
    icon: '🟩',
    color: '#16a34a',
    difficulty: 'adults',
    description: 'Guess the 5-letter word!',
    controls: 'Type letters',
  },
  {
    id: 'galaga',
    name: 'Galaga',
    icon: '🚀',
    color: '#e11d48',
    difficulty: 'adults',
    description: 'Shoot alien formations!',
    controls: 'Drag to move, tap to shoot',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    icon: '⚫',
    color: '#b45309',
    difficulty: 'adults',
    description: 'Jump and capture!',
    controls: 'Tap piece, then tap destination',
  },
  {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    icon: '💥',
    color: '#7c3aed',
    difficulty: 'adults',
    description: 'Smash bricks with power-ups!',
    controls: 'Drag or arrow keys',
  },
  {
    id: 'crossy-road',
    name: 'Crossy Road',
    icon: '🐔',
    color: '#65a30d',
    difficulty: 'adults',
    description: 'Cross roads and rivers!',
    controls: 'Swipe to move',
  },
  {
    id: 'doodle-jump',
    name: 'Doodle Jump',
    icon: '⬆️',
    color: '#0ea5e9',
    difficulty: 'adults',
    description: 'Bounce higher and higher!',
    controls: 'Tilt or arrow keys',
  },
]

export function getGameById(id: string): GameInfo | undefined {
  return GAMES.find(g => g.id === id)
}

export function getGamesByDifficulty(diff: Difficulty): GameInfo[] {
  return GAMES.filter(g => g.difficulty === diff)
}
