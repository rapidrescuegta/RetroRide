// ─── Tournament Presets / Templates ──────────────────────────────────
// Fun, family-friendly presets for quick tournament setup

export interface TournamentPreset {
  id: string
  name: string
  description: string
  icon: string
  gameIds: string[]
  format: 'elimination' | 'round-robin' | 'best-of'
  bestOf?: number
  maxPlayers: number
  estimatedTime: string
  theme: string // tailwind gradient
  timedRounds?: boolean
  defaultRoundDuration?: number // seconds
  /** Highlighted on the tournament hub as a featured challenge. */
  featured?: boolean
  /** Tag shown next to the preset (e.g. "Offline", "Family", "Competitive"). */
  tag?: string
}

export const TOURNAMENT_PRESETS: TournamentPreset[] = [
  {
    id: 'weekend-warrior',
    name: 'Weekend Showdown',
    description: 'The ultimate family weekend challenge — 5 games across all genres. Gather friends & family and crown the champion!',
    icon: '🏖️',
    gameIds: ['snake', 'tetris', 'pac-man', '2048', 'wordle'],
    format: 'round-robin',
    maxPlayers: 8,
    estimatedTime: '2 hours',
    theme: 'from-orange-500 to-pink-600',
    featured: true,
    tag: 'Family Favorite',
  },
  {
    id: 'plane-ride-challenge',
    name: 'Plane Ride Challenge',
    description: 'Perfect for flights — quick offline games that pass the time fast! No wifi needed, works completely offline.',
    icon: '✈️',
    gameIds: ['flappy-bird', 'dino-run', '2048', 'snake', 'hangman', 'wordle', 'memory-match'],
    format: 'elimination',
    maxPlayers: 4,
    estimatedTime: '1 hour',
    theme: 'from-sky-500 to-indigo-600',
    featured: true,
    tag: 'Offline',
  },
  {
    id: 'card-night',
    name: 'Card Night',
    description: 'Grab some snacks and settle in — a classic card game battle!',
    icon: '🃏',
    gameIds: ['crazy-eights', 'hearts', 'spades', 'poker', 'blackjack'],
    format: 'best-of',
    bestOf: 5,
    maxPlayers: 4,
    estimatedTime: '1.5 hours',
    theme: 'from-emerald-500 to-teal-600',
  },
  {
    id: 'family-game-night',
    name: 'Family Game Night',
    description: 'Easy games the whole family can enjoy — even the littlest players!',
    icon: '👨‍👩‍👧‍👦',
    gameIds: ['tic-tac-toe', 'connect-four', 'memory-match', 'simon', 'whack-a-mole', 'go-fish', 'old-maid'],
    format: 'round-robin',
    maxPlayers: 6,
    estimatedTime: '45 min',
    theme: 'from-purple-500 to-pink-500',
    featured: true,
    tag: 'Family Favorite',
  },
  {
    id: 'retro-arcade',
    name: 'Retro Arcade Bash',
    description: 'Old-school classics — prove you are the arcade champion!',
    icon: '👾',
    gameIds: ['tetris', 'space-invaders', 'pac-man', 'galaga', 'asteroids'],
    format: 'elimination',
    maxPlayers: 4,
    estimatedTime: '1.5 hours',
    theme: 'from-violet-500 to-fuchsia-600',
  },
  {
    id: 'road-trip',
    name: 'Road Trip Tournament',
    description: 'Round robin with offline-friendly card games. Play in the car, no wifi needed!',
    icon: '🚗',
    gameIds: ['war', 'old-maid', 'go-fish', 'crazy-eights', 'solitaire', 'hangman'],
    format: 'round-robin',
    maxPlayers: 4,
    estimatedTime: '1 hour',
    theme: 'from-green-500 to-emerald-600',
    tag: 'Offline',
  },
  {
    id: 'card-shark',
    name: 'Card Shark Championship',
    description: 'All card games — poker, hearts, spades, and more. For serious players!',
    icon: '🂡',
    gameIds: ['poker', 'hearts', 'spades', 'crazy-eights', 'blackjack', 'color-clash'],
    format: 'best-of',
    bestOf: 5,
    maxPlayers: 4,
    estimatedTime: '2 hours',
    theme: 'from-red-500 to-amber-600',
  },
  {
    id: 'quick-match',
    name: 'Quick Match',
    description: 'One game, one winner — settle the score in 5 minutes flat!',
    icon: '⚡',
    gameIds: [], // Random game will be selected at creation time
    format: 'best-of',
    bestOf: 1,
    maxPlayers: 2,
    estimatedTime: '5 min',
    theme: 'from-amber-500 to-red-500',
  },
  {
    id: 'friday-night-throwdown',
    name: 'Friday Night Throwdown',
    description: 'Competitive arcade + card games mix — for the grown-ups who mean business!',
    icon: '🔥',
    gameIds: ['tetris', 'pac-man', 'poker', 'hearts', 'space-invaders', 'spades'],
    format: 'elimination',
    maxPlayers: 6,
    estimatedTime: '2 hours',
    theme: 'from-red-600 to-orange-500',
  },
  {
    id: 'kids-vs-parents',
    name: 'Kids vs Parents',
    description: 'Easy games where kids can actually beat mom and dad — fair and fun for all ages!',
    icon: '👨‍👧‍👦',
    gameIds: ['memory-match', 'whack-a-mole', 'connect-four', 'go-fish', 'old-maid', 'simon'],
    format: 'round-robin',
    maxPlayers: 6,
    estimatedTime: '1 hour',
    theme: 'from-pink-500 to-yellow-400',
  },
  {
    id: 'brain-games',
    name: 'Brain Games',
    description: 'Puzzle-focused tournament — outsmart everyone with logic and strategy!',
    icon: '🧠',
    gameIds: ['2048', 'wordle', 'chess', 'minesweeper', 'checkers'],
    format: 'round-robin',
    maxPlayers: 4,
    estimatedTime: '1.5 hours',
    theme: 'from-indigo-500 to-purple-600',
  },
  {
    id: 'speed-run',
    name: 'Speed Run',
    description: '3 quick arcade games, 60 seconds each — fastest fingers win!',
    icon: '⏱️',
    gameIds: ['snake', 'flappy-bird', 'dino-run'],
    format: 'elimination',
    maxPlayers: 8,
    estimatedTime: '15 min',
    timedRounds: true,
    defaultRoundDuration: 60,
    theme: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'cabin-weekend',
    name: 'Cabin Weekend',
    description: 'A 3-day tournament for the cabin or cottage — card games, arcade classics, and brainy puzzles!',
    icon: '🏕️',
    gameIds: ['hearts', 'spades', 'cribbage', 'euchre', 'tetris', 'pac-man', '2048', 'wordle', 'checkers'],
    format: 'round-robin',
    maxPlayers: 6,
    estimatedTime: '3 days',
    theme: 'from-amber-600 to-green-600',
  },
  {
    id: 'holiday-party',
    name: 'Holiday Party',
    description: 'Party-friendly games for a big group — easy to learn, fast to play, tons of laughs!',
    icon: '🎉',
    gameIds: ['crazy-eights', 'go-fish', 'color-clash', 'war', 'old-maid', 'whack-a-mole', 'memory-match', 'simon'],
    format: 'round-robin',
    maxPlayers: 8,
    estimatedTime: '2 hours',
    theme: 'from-rose-500 to-amber-400',
    tag: 'Party',
  },
  {
    id: 'friends-night-in',
    name: 'Friends Night In',
    description: 'Competitive mix of poker, arcade, and strategy — perfect for a group of friends battling it out!',
    icon: '🍕',
    gameIds: ['poker', 'tetris', 'pac-man', 'chess', 'hearts', 'blackjack'],
    format: 'elimination',
    maxPlayers: 6,
    estimatedTime: '2 hours',
    theme: 'from-fuchsia-500 to-violet-600',
    featured: true,
    tag: 'Friends',
  },
  {
    id: 'sunday-brunch',
    name: 'Sunday Brunch Games',
    description: 'Relaxed, casual games for a lazy Sunday — everyone plays at their own pace!',
    icon: '☕',
    gameIds: ['wordle', 'solitaire', 'cribbage', 'gin-rummy', 'rummy-500', 'hangman'],
    format: 'round-robin',
    maxPlayers: 4,
    estimatedTime: '1.5 hours',
    theme: 'from-yellow-400 to-orange-500',
    tag: 'Chill',
  },
  {
    id: 'snap-and-slap',
    name: 'Snap & Slap Showdown',
    description: 'Fast-twitch reaction games only — Snap, War, and Whack-a-Mole. Who has the quickest hands?',
    icon: '👋',
    gameIds: ['snap', 'war', 'whack-a-mole', 'flappy-bird'],
    format: 'best-of',
    bestOf: 3,
    maxPlayers: 4,
    estimatedTime: '30 min',
    theme: 'from-amber-500 to-rose-600',
    tag: 'Reflex',
  },
  {
    id: 'kids-champion',
    name: "Kids' Champion",
    description: 'Easy wins for the little ones — Snap, Go Fish, Old Maid, Memory Match, and more!',
    icon: '🧒',
    gameIds: ['snap', 'go-fish', 'old-maid', 'memory-match', 'whack-a-mole', 'simon', 'tic-tac-toe'],
    format: 'round-robin',
    maxPlayers: 6,
    estimatedTime: '1 hour',
    theme: 'from-sky-400 to-emerald-500',
    featured: true,
    tag: 'Kids',
  },
]

export function getPresetById(id: string): TournamentPreset | undefined {
  return TOURNAMENT_PRESETS.find((p) => p.id === id)
}

export const FORMAT_LABELS: Record<string, { label: string; icon: string }> = {
  elimination: { label: 'Elimination', icon: '🔥' },
  'round-robin': { label: 'Round Robin', icon: '🔄' },
  'best-of': { label: 'Best Of', icon: '🎯' },
}
