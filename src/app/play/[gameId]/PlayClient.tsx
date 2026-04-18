'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { getGameById, LEVEL_LABELS, type GameLevel } from '@/lib/games'
import { saveScore, getHighScore } from '@/lib/scores'
import { useFamily } from '@/lib/family-context'
import { isSoundEnabled, setSoundEnabled, isMusicEnabled, setMusicEnabled, startMusic, stopMusic } from '@/lib/sounds'
import EmailCapturePrompt, { shouldShowEmailCapture } from '@/components/EmailCapturePrompt'
import GameController from '@/components/GameController'
import MultiplayerLobby from '@/components/MultiplayerLobby'
import MultiplayerGameView from '@/components/MultiplayerGameView'
import { isMultiplayerSupported, getPlayerCount, getCardMultiplayerConfig } from '@/lib/multiplayer-registry'
import { getNetwork, setNetwork } from '@/lib/multiplayer-game'
import type { NetworkAdapter } from '@/lib/network-adapter'
import { autoSubmitTournamentScore } from '@/lib/tournament-auto-score'

// ─── Lazy-loaded game bundles ────────────────────────────────────────────────
// Each game ships as its own chunk. Visiting /play/wordle no longer pulls in
// the Pac-Man, Chess, Euchre... bundles. Saves ~1–2 MB of JS per route on
// first paint and keeps the app fast on 3G / plane Wi-Fi.
//
// ssr:false is safe because PlayClient itself is a client component and games
// use canvas / localStorage, so they can't render on the server anyway.
// `loading` renders inside the existing arcade frame, no layout shift.

const GAME_LOADING = (
  <div className="flex h-full w-full items-center justify-center bg-black/30 text-sm text-white/70">
    Loading game…
  </div>
)

function lazyGame(loader: () => Promise<{ default: React.ComponentType<GameProps> }>) {
  return dynamic(loader, { ssr: false, loading: () => GAME_LOADING }) as React.ComponentType<GameProps>
}

function getControllerConfig(gameId: string): { dpad: boolean; buttons: ('A' | 'B')[]; buttonKeys: { A?: string; B?: string } } | null {
  const dpadAndShoot = ['space-invaders', 'asteroids', 'galaga']
  const dpadOnly = ['snake', 'pac-man', 'frogger', 'crossy-road']
  const dpadAndDrop = ['tetris']
  const tapOnly = ['flappy-bird', 'dino-run']
  const slideOnly = ['breakout', 'brick-breaker', 'pong']
  const noController = ['memory-match', 'tic-tac-toe', 'simon', 'whack-a-mole', 'connect-four',
    'hangman', 'wordle', 'minesweeper', '2048', 'checkers', 'chess', 'doodle-jump',
    'rummy-500', 'crazy-eights', 'go-fish', 'hearts', 'spades', 'war', 'blackjack', 'solitaire', 'old-maid',
    'poker', 'color-clash', 'gin-rummy', 'euchre', 'cribbage', 'snap']

  if (noController.includes(gameId) || slideOnly.includes(gameId)) return null
  if (dpadAndShoot.includes(gameId)) return { dpad: true, buttons: ['A'], buttonKeys: { A: ' ' } }
  if (dpadOnly.includes(gameId)) return { dpad: true, buttons: [], buttonKeys: {} }
  if (dpadAndDrop.includes(gameId)) return { dpad: true, buttons: ['A'], buttonKeys: { A: 'ArrowUp' } }
  if (tapOnly.includes(gameId)) return { dpad: false, buttons: ['A'], buttonKeys: { A: ' ' } }
  return null
}

type GameProps = { onGameOver: (score: number) => void; level: GameLevel }

const GAME_COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  'snake': lazyGame(() => import('@/games/snake/SnakeGame')),
  'pong': lazyGame(() => import('@/games/pong/PongGame')),
  'tetris': lazyGame(() => import('@/games/tetris/TetrisGame')),
  'breakout': lazyGame(() => import('@/games/breakout/BreakoutGame')),
  'memory-match': lazyGame(() => import('@/games/memory-match/MemoryMatchGame')),
  'tic-tac-toe': lazyGame(() => import('@/games/tic-tac-toe/TicTacToeGame')),
  'simon': lazyGame(() => import('@/games/simon/SimonGame')),
  'flappy-bird': lazyGame(() => import('@/games/flappy-bird/FlappyBirdGame')),
  'dino-run': lazyGame(() => import('@/games/dino-run/DinoRunGame')),
  'whack-a-mole': lazyGame(() => import('@/games/whack-a-mole/WhackAMoleGame')),
  '2048': lazyGame(() => import('@/games/2048/Game2048')),
  'space-invaders': lazyGame(() => import('@/games/space-invaders/SpaceInvadersGame')),
  'connect-four': lazyGame(() => import('@/games/connect-four/ConnectFourGame')),
  'hangman': lazyGame(() => import('@/games/hangman/HangmanGame')),
  'wordle': lazyGame(() => import('@/games/wordle/WordleGame')),
  'minesweeper': lazyGame(() => import('@/games/minesweeper/MinesweeperGame')),
  'frogger': lazyGame(() => import('@/games/frogger/FroggerGame')),
  'asteroids': lazyGame(() => import('@/games/asteroids/AsteroidsGame')),
  'pac-man': lazyGame(() => import('@/games/pac-man/PacManGame')),
  'galaga': lazyGame(() => import('@/games/galaga/GalagaGame')),
  'checkers': lazyGame(() => import('@/games/checkers/CheckersGame')),
  'brick-breaker': lazyGame(() => import('@/games/brick-breaker/BrickBreakerGame')),
  'crossy-road': lazyGame(() => import('@/games/crossy-road/CrossyRoadGame')),
  'doodle-jump': lazyGame(() => import('@/games/doodle-jump/DoodleJumpGame')),
  'chess': lazyGame(() => import('@/games/chess/ChessGame')),
  'rummy-500': lazyGame(() => import('@/games/rummy-500/RummyGame')),
  'crazy-eights': lazyGame(() => import('@/games/crazy-eights/CrazyEightsGame')),
  'go-fish': lazyGame(() => import('@/games/go-fish/GoFishGame')),
  'hearts': lazyGame(() => import('@/games/hearts/HeartsGame')),
  'spades': lazyGame(() => import('@/games/spades/SpadesGame')),
  'solitaire': lazyGame(() => import('@/games/solitaire/SolitaireGame')),
  'war': lazyGame(() => import('@/games/war/WarGame')),
  'blackjack': lazyGame(() => import('@/games/blackjack/BlackjackGame')),
  'old-maid': lazyGame(() => import('@/games/old-maid/OldMaidGame')),
  'poker': lazyGame(() => import('@/games/poker/PokerGame')),
  'color-clash': lazyGame(() => import('@/games/color-clash/ColorClashGame')),
  'gin-rummy': lazyGame(() => import('@/games/gin-rummy/GinRummyGame')),
  'euchre': lazyGame(() => import('@/games/euchre/EuchreGame')),
  'cribbage': lazyGame(() => import('@/games/cribbage/CribbageGame')),
  'snap': lazyGame(() => import('@/games/snap/SnapGame')),
}

const LEVEL_STORAGE_KEY = 'retroride-last-level'

export default function PlayClient({ gameId }: { gameId: string }) {
  const router = useRouter()
  const game = getGameById(gameId)
  const familyCtx = useFamily()

  const [gameState, setGameState] = useState<'pick-level' | 'multiplayer-lobby' | 'multiplayer-playing' | 'playing' | 'over'>('pick-level')
  const [level, setLevel] = useState<GameLevel>('medium')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [tournamentSubmitted, setTournamentSubmitted] = useState(0)
  const [showEmailCapture, setShowEmailCapture] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const [musicOn, setMusicOn] = useState(true)
  const [multiplayerAdapter, setMultiplayerAdapter] = useState<NetworkAdapter | null>(null)

  useEffect(() => {
    setSoundOn(isSoundEnabled())
    setMusicOn(isMusicEnabled())
  }, [])

  // Stop music on unmount
  useEffect(() => {
    return () => { stopMusic() }
  }, [])

  const toggleSound = () => {
    const newState = !soundOn
    setSoundOn(newState)
    setSoundEnabled(newState)
    if (!newState) { stopMusic(); setMusicOn(false); setMusicEnabled(false) }
  }

  const toggleMusic = () => {
    const newState = !musicOn
    setMusicOn(newState)
    setMusicEnabled(newState)
    if (newState && gameState === 'playing') {
      const puzzleGames = ['tetris', 'snake', '2048', 'minesweeper', 'wordle', 'chess', 'checkers']
      const noMusic = ['rummy-500', 'crazy-eights', 'go-fish', 'hearts', 'spades', 'war', 'blackjack', 'solitaire', 'old-maid', 'poker', 'color-clash', 'gin-rummy', 'euchre', 'cribbage', 'snap']
      if (!noMusic.includes(gameId)) {
        startMusic(puzzleGames.includes(gameId) ? 'puzzle' : 'arcade')
      }
    } else {
      stopMusic()
    }
  }

  // Restore last used level
  useEffect(() => {
    const saved = localStorage.getItem(LEVEL_STORAGE_KEY)
    if (saved === 'easy' || saved === 'medium' || saved === 'hard') {
      setLevel(saved)
    }
  }, [])

  useEffect(() => {
    if (game) {
      setHighScore(getHighScore(game.id))
    }
  }, [game])

  const startGame = (selectedLevel: GameLevel) => {
    setLevel(selectedLevel)
    localStorage.setItem(LEVEL_STORAGE_KEY, selectedLevel)
    setGameState('playing')
    // Start background music
    const puzzleGames = ['tetris', 'snake', '2048', 'minesweeper', 'wordle', 'chess', 'checkers']
    const noMusic = ['rummy-500', 'crazy-eights', 'go-fish', 'hearts', 'spades', 'war', 'blackjack', 'solitaire', 'old-maid', 'poker', 'color-clash', 'gin-rummy', 'euchre', 'cribbage', 'snap']
    if (!noMusic.includes(gameId)) {
      startMusic(puzzleGames.includes(gameId) ? 'puzzle' : 'arcade')
    }
  }

  const handleGameOver = useCallback((finalScore: number) => {
    stopMusic()
    setScore(finalScore)
    // Submit to family leaderboard
    if (familyCtx?.isLoggedIn && game) {
      familyCtx.submitScore(game.id, finalScore)
    }
    setGameState('over')
    if (game) {
      saveScore(game.id, finalScore)
      const prevHigh = getHighScore(game.id)
      if (finalScore >= prevHigh) {
        setIsNewHigh(true)
        setHighScore(finalScore)
      }
    }
    // Auto-submit to active tournaments (background, non-blocking)
    if (familyCtx?.isLoggedIn && familyCtx.family?.id && familyCtx.member?.id && game) {
      autoSubmitTournamentScore(
        familyCtx.family.id,
        familyCtx.member.id,
        game.id,
        finalScore
      ).then((count) => {
        if (count > 0) setTournamentSubmitted(count)
      }).catch(() => {})
    }
    // Check if we should show email capture
    if (shouldShowEmailCapture()) {
      setShowEmailCapture(true)
    }
    setTimeout(() => setShowOverlay(true), 1800)
  }, [game, familyCtx])

  const handleRestart = () => {
    setGameState('playing')
    setScore(0)
    setIsNewHigh(false)
    setShowOverlay(false)
    setTournamentSubmitted(0)
    // Restart music
    const puzzleGames = ['tetris', 'snake', '2048', 'minesweeper', 'wordle', 'chess', 'checkers']
    const noMusic = ['rummy-500', 'crazy-eights', 'go-fish', 'hearts', 'spades', 'war', 'blackjack', 'solitaire', 'old-maid', 'poker', 'color-clash', 'gin-rummy', 'euchre', 'cribbage', 'snap']
    if (!noMusic.includes(gameId)) {
      startMusic(puzzleGames.includes(gameId) ? 'puzzle' : 'arcade')
    }
    setShowEmailCapture(false)
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl mb-4">🕹️</p>
          <p className="text-slate-400">Game not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-purple-600 rounded-lg text-white"
          >
            Back to Games
          </button>
        </div>
      </div>
    )
  }

  const GameComponent = GAME_COMPONENTS[gameId]

  // Level picker screen
  if (gameState === 'pick-level') {
    return (
      <div className="min-h-screen flex flex-col page-enter">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800/50">
          <button
            onClick={() => router.push('/')}
            className="touch-btn text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="text-center">
            <span className="text-lg mr-1">{game.icon}</span>
            <span className="font-semibold text-sm" style={{ color: game.color }}>
              {game.name}
            </span>
          </div>
          <div className="w-[48px]" />
        </div>

        {/* Level selection */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6 max-w-sm w-full">
            <p className="text-5xl mb-4">{game.icon}</p>
            <h2 className="text-xl font-bold text-white mb-2">{game.name}</h2>
            <p className="text-slate-400 text-sm mb-8">Choose your difficulty</p>

            <div className="flex flex-col gap-3">
              {(['easy', 'medium', 'hard'] as GameLevel[]).map(lvl => {
                const info = LEVEL_LABELS[lvl]
                const isSelected = lvl === level
                return (
                  <button
                    key={lvl}
                    onClick={() => startGame(lvl)}
                    className={`w-full px-6 py-4 rounded-xl font-semibold text-left transition-all active:scale-[0.97] flex items-center justify-between ${
                      isSelected
                        ? 'ring-2 ring-offset-2 ring-offset-slate-900'
                        : ''
                    }`}
                    style={{
                      background: `${info.color}15`,
                      border: `1px solid ${info.color}40`,
                      ...(isSelected ? { ringColor: info.color } : {}),
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{info.stars}</span>
                      <span className="text-white text-base">{info.label}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={info.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )
              })}
            </div>

            {/* Play Online button for multiplayer-capable games */}
            {isMultiplayerSupported(gameId) && (
              <button
                onClick={() => setGameState('multiplayer-lobby')}
                className="w-full mt-4 px-6 py-4 rounded-xl font-semibold text-left transition-all active:scale-[0.97] flex items-center justify-between"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed15, #06b6d415)',
                  border: '1px solid #7c3aed40',
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{'\u{1F310}'}</span>
                  <div>
                    <span className="text-white text-base">Play Online</span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(() => {
                        const pc = getPlayerCount(gameId)
                        return pc
                          ? pc.min === pc.max
                            ? `${pc.min} players`
                            : `${pc.min}-${pc.max} players`
                          : 'Multiplayer'
                      })()}
                    </p>
                  </div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}

            {highScore > 0 && (
              <p className="text-xs text-slate-500 mt-6">
                Your best: <span className="text-amber-400 font-semibold">{highScore.toLocaleString()}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Multiplayer lobby screen
  if (gameState === 'multiplayer-lobby') {
    return (
      <MultiplayerLobby
        gameId={gameId}
        gameName={game.name}
        gameIcon={game.icon}
        gameColor={game.color}
        onStart={() => {
          // The lobby has already called setNetwork(adapter) at this point.
          // Capture the adapter so we can pass it to MultiplayerGameView.
          const net = getNetwork()
          if (net) {
            setMultiplayerAdapter(net as unknown as NetworkAdapter)
            setGameState('multiplayer-playing')
          } else {
            // Fallback: no network available, go to single player
            setGameState('playing')
          }
        }}
        onCancel={() => setGameState('pick-level')}
      />
    )
  }

  // Multiplayer playing screen
  if (gameState === 'multiplayer-playing' && multiplayerAdapter) {
    const cardConfig = getCardMultiplayerConfig(gameId)
    if (!cardConfig) {
      // No card config found, fall back to single player
      setGameState('playing')
      return null
    }

    return (
      <MultiplayerGameView
        config={cardConfig}
        adapter={multiplayerAdapter}
        onLeave={() => {
          setNetwork(null)
          setMultiplayerAdapter(null)
          setGameState('pick-level')
        }}
      />
    )
  }

  return (
    <div className="h-dvh flex flex-col page-enter overflow-hidden">
      {/* Top bar — compact */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/50 flex-shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => router.push('/')}
            className="touch-btn text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={toggleSound}
            className="touch-btn text-slate-400 hover:text-white transition-colors p-1 text-sm"
            aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
          >
            {soundOn ? '\u{1F50A}' : '\u{1F507}'}
          </button>
          <button
            onClick={toggleMusic}
            className="touch-btn text-slate-400 hover:text-white transition-colors p-1 text-sm"
            aria-label={musicOn ? 'Stop music' : 'Play music'}
          >
            {musicOn ? '\u{1F3B5}' : '\u{1F3B5}\u{FE0E}'}
          </button>
        </div>

        <div className="text-center flex items-center gap-1">
          <span className="text-base">{game.icon}</span>
          <span className="font-semibold text-xs" style={{ color: game.color }}>
            {game.name}
          </span>
          <span className="text-[10px]" style={{ color: LEVEL_LABELS[level].color }}>
            {LEVEL_LABELS[level].stars}
          </span>
          <span className="text-[8px] text-slate-600 ml-1">v5</span>
        </div>

        <div className="text-[10px] text-slate-500 min-w-[50px] text-right">
          {highScore > 0 && <>Best: {highScore.toLocaleString()}</>}
        </div>
      </div>

      {/* Game area — fills remaining space */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden min-h-0">
        {gameState === 'playing' && GameComponent && (
          <GameComponent key={level} onGameOver={handleGameOver} level={level} />
        )}

        {gameState === 'playing' && !GameComponent && (
          <div className="text-center p-8">
            <p className="text-4xl mb-4">{game.icon}</p>
            <p className="text-slate-400 mb-2">Coming soon!</p>
            <button
              onClick={() => router.push('/')}
              className="px-6 py-2 bg-slate-700 rounded-lg text-white text-sm"
            >
              Back
            </button>
          </div>
        )}

        {/* Game Over overlay */}
        {showOverlay && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-[fadeIn_0.4s_ease]">
            <div className="text-center p-8 rounded-2xl bg-slate-900/90 border border-slate-700 max-w-xs mx-4">
              {isNewHigh && (
                <div className="text-amber-400 font-bold text-sm mb-2 animate-bounce">
                  🏆 NEW HIGH SCORE!
                </div>
              )}
              {score > 0 && (
                <p className="text-lg font-bold text-emerald-400 mb-2">
                  🎉 Congratulations!
                </p>
              )}
              <p className="text-4xl mb-3">{game.icon}</p>
              <p className="text-slate-400 text-sm mb-1">
                {score > 0 ? 'Great job!' : 'Game Over'}
              </p>
              <p className="text-3xl font-bold text-white mb-4">
                {score.toLocaleString()}
              </p>

              {tournamentSubmitted > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400 font-medium">
                    🏆 Score submitted to {tournamentSubmitted} tournament{tournamentSubmitted > 1 ? 's' : ''}!
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRestart}
                  className="w-full px-6 py-3 rounded-xl font-semibold text-white transition-all hover:brightness-110"
                  style={{ background: game.color }}
                >
                  Play Again
                </button>
                <button
                  onClick={() => setGameState('pick-level')}
                  className="w-full px-6 py-3 bg-slate-800 rounded-xl text-slate-300 text-sm hover:bg-slate-700 transition-all"
                >
                  Change Difficulty
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full px-6 py-3 bg-slate-700 rounded-xl text-slate-300 text-sm hover:bg-slate-600 transition-all"
                >
                  Back to Games
                </button>
              </div>

              {showEmailCapture && (
                <EmailCapturePrompt onClose={() => setShowEmailCapture(false)} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* On-screen game controller (touch devices only) */}
      {gameState === 'playing' && (() => {
        const config = getControllerConfig(gameId)
        if (!config) return null
        return <GameController dpad={config.dpad} buttons={config.buttons} buttonKeys={config.buttonKeys} />
      })()}

      {/* Controls hint (hidden when game controller is showing) */}
      {!(gameState === 'playing' && getControllerConfig(gameId)) && (
        <div className="text-center py-2 text-xs text-slate-600">
          {game.controls}
        </div>
      )}
    </div>
  )
}
