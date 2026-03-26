// Shared audio utility for RetroRide
// Provides a simple interface for playing sound effects and background music

type SoundName = string;

// Pre-loaded audio objects (lazy-initialized)
const soundCache = new Map<SoundName, HTMLAudioElement>();
const bgmCache = new Map<string, HTMLAudioElement>();

// Global mute state
let _globalMuted = false;
let _bgmMuted = false;

export function isMuted(): boolean {
  return _globalMuted;
}

export function isBgmMuted(): boolean {
  return _bgmMuted;
}

export function setGlobalMuted(muted: boolean): void {
  _globalMuted = muted;
}

export function setBgmMuted(muted: boolean): void {
  _bgmMuted = muted;
  // Apply to all playing BGM
  bgmCache.forEach(audio => {
    if (muted) {
      audio.pause();
    }
  });
}

function getSound(name: SoundName): HTMLAudioElement {
  if (typeof window === 'undefined') {
    // Server-side rendering guard
    const dummy = { play: () => {}, pause: () => {}, currentTime: 0 } as unknown as HTMLAudioElement;
    return dummy;
  }
  if (!soundCache.has(name)) {
    const audio = new Audio(`/sounds/${name}`);
    audio.preload = 'auto';
    soundCache.set(name, audio);
  }
  return soundCache.get(name)!;
}

/**
 * Play a sound effect by filename (without the /sounds/ prefix or .wav extension)
 * e.g. playSound('snake_eat')
 */
export function playSound(name: SoundName): void {
  if (_globalMuted) return;
  try {
    const audio = getSound(name);
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Silently fail if audio fails to play (e.g., user hasn't interacted yet)
    });
  } catch {
    // Ignore errors
  }
}

/**
 * Play a sound effect with volume control (0.0 - 1.0)
 */
export function playSoundVolume(name: SoundName, volume: number): void {
  if (_globalMuted) return;
  try {
    const audio = getSound(name);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Ignore errors
  }
}

// Active BGM track
let activeBgm: HTMLAudioElement | null = null;
let activeBgmKey: string | null = null;

export function playBgm(key: string, loop = true): void {
  if (_bgmMuted || _globalMuted) return;
  if (typeof window === 'undefined') return;
  
  // If same track is playing, don't restart
  if (activeBgmKey === key && activeBgm && !activeBgm.paused) return;
  
  // Stop current BGM
  stopBgm();
  
  const audio = new Audio(`/sounds/${key}`);
  audio.loop = loop;
  audio.volume = 0.4; // Default BGM volume
  audio.preload = 'auto';
  bgmCache.set(key, audio);
  
  audio.play().catch(() => {});
  activeBgm = audio;
  activeBgmKey = key;
}

export function stopBgm(): void {
  if (activeBgm) {
    activeBgm.pause();
    activeBgm.currentTime = 0;
    activeBgm = null;
    activeBgmKey = null;
  }
}

export function setBgmVolume(volume: number): void {
  if (activeBgm) {
    activeBgm.volume = Math.max(0, Math.min(1, volume));
  }
}

// Map of game → sound hooks for common events
export const GAME_SOUNDS: Record<string, {
  sfx: Record<string, string>;
  bgm?: string;
}> = {
  'snake': {
    sfx: { move: 'snake_move', eat: 'snake_eat', gameOver: 'snake_game_over' },
  },
  'whack-a-mole': {
    sfx: { hit: 'whack_hit', moleUp: 'whack_mole_up', gameOver: 'whack_game_over' },
  },
  'memory-match': {
    sfx: { flip: 'memory_flip', match: 'memory_match', noMatch: 'memory_no_match', gameOver: 'memory_game_over' },
  },
  'tic-tac-toe': {
    sfx: { place: 'ttt_place', win: 'ttt_win', lose: 'ttt_lose', draw: 'ttt_draw' },
  },
  'simon': {
    sfx: { red: 'simon_red', green: 'simon_green', yellow: 'simon_yellow', blue: 'simon_blue', gameOver: 'simon_game_over' },
  },
  'dino-run': {
    sfx: { jump: 'dino_jump', hit: 'dino_hit', gameOver: 'dino_game_over' },
  },
  'pong': {
    sfx: { paddle: 'pong_paddle', wall: 'pong_wall', score: 'pong_score', win: 'pong_win', gameOver: 'pong_game_over' },
  },
  'breakout': {
    sfx: { paddle: 'breakout_paddle', brick: 'breakout_brick', wall: 'breakout_wall', levelComplete: 'breakout_level_complete', gameOver: 'breakout_game_over' },
    bgm: 'bgm_breakout.wav',
  },
  'brick-breaker': {
    sfx: { paddle: 'brick_paddle', hit: 'brick_hit', gameOver: 'brick_game_over' },
  },
  'connect-four': {
    sfx: { drop: 'cf_drop', win: 'cf_win', gameOver: 'cf_game_over' },
  },
  'crazy-eights': {
    sfx: { play: 'ce_play', draw: 'ce_draw', win: 'ce_win', gameOver: 'ce_game_over' },
  },
  'crossy-road': {
    sfx: { hop: 'crossy_hop', car: 'crossy_car', gameOver: 'crossy_game_over' },
    bgm: 'bgm_crossy_road.wav',
  },
  'duck-hunt': {
    sfx: { shoot: 'dh_shoot', duckFall: 'dh_duck_fall', miss: 'dh_miss', roundClear: 'dh_round_clear' },
  },
  '2048': {
    sfx: { merge: 'g2048_merge', score: 'g2048_score', gameOver: 'g2048_game_over' },
  },
  'doodle-jump': {
    sfx: { jump: 'dj_jump', bounce: 'dj_bounce', gameOver: 'dj_game_over' },
  },
  'flappy-bird': {
    sfx: { flap: 'fb_flap', hit: 'fb_hit', score: 'fb_score', gameOver: 'fb_game_over' },
    bgm: 'bgm_flappy_bird.wav',
  },
  'frogger': {
    sfx: { hop: 'frogger_hop', splash: 'frogger_splash', hit: 'frogger_hit', win: 'frogger_win', gameOver: 'frogger_game_over' },
    bgm: 'bgm_frogger.wav',
  },
  'galaga': {
    sfx: { shoot: 'galaga_shoot', hit: 'galaga_hit', playerHit: 'galaga_player_hit', gameOver: 'galaga_game_over' },
    bgm: 'bgm_galaga.wav',
  },
  'go-fish': {
    sfx: { draw: 'gofish_draw', match: 'gofish_match', ask: 'gofish_ask', gameOver: 'gofish_game_over' },
  },
  'hangman': {
    sfx: { letter: 'hangman_letter', wrong: 'hangman_wrong', win: 'hangman_win', lose: 'hangman_lose' },
  },
  'hearts': {
    sfx: { play: 'hearts_play', shootMoon: 'hearts_shoot_moon', gameOver: 'hearts_game_over' },
  },
  'rummy-500': {
    sfx: { meld: 'rummy_meld', play: 'rummy_play', win: 'rummy_win', gameOver: 'rummy_game_over' },
  },
  'space-invaders': {
    sfx: { move: 'si_move', shoot: 'si_shoot', march: 'si_march', hit: 'si_hit', death: 'si_death', levelComplete: 'si_level_complete', gameOver: 'si_game_over' },
    bgm: 'bgm_space_invaders.wav',
  },
  'tetris': {
    sfx: { melody: 'tetris_melody', lineClear: 'tetris_line_clear', place: 'tetris_place', gameOver: 'tetris_game_over' },
    bgm: 'bgm_tetris.wav',
  },
  'wordle': {
    sfx: { type: 'wordle_type', correct: 'wordle_correct', wrong: 'wordle_wrong', win: 'wordle_win', gameOver: 'wordle_game_over' },
  },
  'pac-man': {
    sfx: { power: 'pacman_power', waka: 'pacman_waka', eatGhost: 'pacman_eat_ghost', death: 'pacman_death', win: 'pacman_win', gameOver: 'pacman_game_over' },
    bgm: 'bgm_pacman.wav',
  },
  'checkers': {
    sfx: { place: 'checkers_place', capture: 'checkers_capture', win: 'checkers_win', gameOver: 'checkers_game_over' },
  },
  'chess': {
    sfx: { place: 'chess_place', capture: 'chess_capture', check: 'chess_check', win: 'chess_win', gameOver: 'chess_game_over' },
  },
  'asteroids': {
    sfx: {},
    bgm: 'bgm_asteroids.wav',
  },
  'spades': {
    sfx: {},
  },
  'minesweeper': {
    sfx: {},
  },
};
