'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { getGameById, LEVEL_LABELS, type GameLevel } from '@/lib/games'
import { saveScore, getHighScore } from '@/lib/scores'
import { useFamily } from '@/lib/family-context'
import EmailCapturePrompt, { shouldShowEmailCapture } from '@/components/EmailCapturePrompt'
import GameController from '@/components/GameController'

// Game imports
import SnakeGame from '@/games/snake/SnakeGame'
import PongGame from '@/games/pong/PongGame'
import TetrisGame from '@/games/tetris/TetrisGame'
import BreakoutGame from '@/games/breakout/BreakoutGame'
import MemoryMatchGame from '@/games/memory-match/MemoryMatchGame'
import TicTacToeGame from '@/games/tic-tac-toe/TicTacToeGame'
import SimonGame from '@/games/simon/SimonGame'
import FlappyBirdGame from '@/games/flappy-bird/FlappyBirdGame'
import DinoRunGame from '@/games/dino-run/DinoRunGame'
import WhackAMoleGame from '@/games/whack-a-mole/WhackAMoleGame'
import Game2048 from '@/games/2048/Game2048'
import SpaceInvadersGame from '@/games/space-invaders/SpaceInvadersGame'
import ConnectFourGame from '@/games/connect-four/ConnectFourGame'
import HangmanGame from '@/games/hangman/HangmanGame'
import WordleGame from '@/games/wordle/WordleGame'
import MinesweeperGame from '@/games/minesweeper/MinesweeperGame'
import FroggerGame from '@/games/frogger/FroggerGame'
import AsteroidsGame from '@/games/asteroids/AsteroidsGame'
import PacManGame from '@/games/pac-man/PacManGame'
import GalagaGame from '@/games/galaga/GalagaGame'
import CheckersGame from '@/games/checkers/CheckersGame'
import BrickBreakerGame from '@/games/brick-breaker/BrickBreakerGame'
import CrossyRoadGame from '@/games/crossy-road/CrossyRoadGame'
import DoodleJumpGame from '@/games/doodle-jump/DoodleJumpGame'
import ChessGame from '@/games/chess/ChessGame'
import RummyGame from '@/games/rummy-500/RummyGame'
import CrazyEightsGame from '@/games/crazy-eights/CrazyEightsGame'
import GoFishGame from '@/games/go-fish/GoFishGame'
import HeartsGame from '@/games/hearts/HeartsGame'
import SpadesGame from '@/games/spades/SpadesGame'

function getControllerConfig(gameId: string): { dpad: boolean; buttons: ('A' | 'B')[]; buttonKeys: { A?: string; B?: string } } | null {
  const dpadAndShoot = ['space-invaders', 'asteroids', 'galaga']
  const dpadOnly = ['snake', 'pac-man', 'frogger', 'crossy-road']
  const dpadAndDrop = ['tetris']
  const tapOnly = ['flappy-bird', 'dino-run']
  const slideOnly = ['breakout', 'brick-breaker', 'pong']
  const noController = ['memory-match', 'tic-tac-toe', 'simon', 'whack-a-mole', 'connect-four',
    'hangman', 'wordle', 'minesweeper', '2048', 'checkers', 'chess', 'doodle-jump',
    'rummy-500', 'crazy-eights', 'go-fish', 'hearts', 'spades']

  if (noController.includes(gameId) || slideOnly.includes(gameId)) return null
  if (dpadAndShoot.includes(gameId)) return { dpad: true, buttons: ['A'], buttonKeys: { A: ' ' } }
  if (dpadOnly.includes(gameId)) return { dpad: true, buttons: [], buttonKeys: {} }
  if (dpadAndDrop.includes(gameId)) return { dpad: true, buttons: ['A'], buttonKeys: { A: 'ArrowUp' } }
  if (tapOnly.includes(gameId)) return { dpad: false, buttons: ['A'], buttonKeys: { A: ' ' } }
  return null
}

type GameProps = { onGameOver: (score: number) => void; level: GameLevel }

const GAME_COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  'snake': SnakeGame as React.ComponentType<GameProps>,
  'pong': PongGame as React.ComponentType<GameProps>,
  'tetris': TetrisGame as React.ComponentType<GameProps>,
  'breakout': BreakoutGame as React.ComponentType<GameProps>,
  'memory-match': MemoryMatchGame as React.ComponentType<GameProps>,
  'tic-tac-toe': TicTacToeGame as React.ComponentType<GameProps>,
  'simon': SimonGame as React.ComponentType<GameProps>,
  'flappy-bird': FlappyBirdGame as React.ComponentType<GameProps>,
  'dino-run': DinoRunGame as React.ComponentType<GameProps>,
  'whack-a-mole': WhackAMoleGame as React.ComponentType<GameProps>,
  '2048': Game2048 as React.ComponentType<GameProps>,
  'space-invaders': SpaceInvadersGame as React.ComponentType<GameProps>,
  'connect-four': ConnectFourGame as React.ComponentType<GameProps>,
  'hangman': HangmanGame as React.ComponentType<GameProps>,
  'wordle': WordleGame as React.ComponentType<GameProps>,
  'minesweeper': MinesweeperGame as React.ComponentType<GameProps>,
  'frogger': FroggerGame as React.ComponentType<GameProps>,
  'asteroids': AsteroidsGame as React.ComponentType<GameProps>,
  'pac-man': PacManGame as React.ComponentType<GameProps>,
  'galaga': GalagaGame as React.ComponentType<GameProps>,
  'checkers': CheckersGame as React.ComponentType<GameProps>,
  'brick-breaker': BrickBreakerGame as React.ComponentType<GameProps>,
  'crossy-road': CrossyRoadGame as React.ComponentType<GameProps>,
  'doodle-jump': DoodleJumpGame as React.ComponentType<GameProps>,
  'chess': ChessGame as React.ComponentType<GameProps>,
  'rummy-500': RummyGame as React.ComponentType<GameProps>,
  'crazy-eights': CrazyEightsGame as React.ComponentType<GameProps>,
  'go-fish': GoFishGame as React.ComponentType<GameProps>,
  'hearts': HeartsGame as React.ComponentType<GameProps>,
  'spades': SpadesGame as React.ComponentType<GameProps>,
}

const LEVEL_STORAGE_KEY = 'retroride-last-level'

export default function PlayClient({ gameId }: { gameId: string }) {
  const router = useRouter()
  const game = getGameById(gameId)
  const familyCtx = useFamily()

  const [gameState, setGameState] = useState<'pick-level' | 'playing' | 'over'>('pick-level')
  const [level, setLevel] = useState<GameLevel>('medium')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [showEmailCapture, setShowEmailCapture] = useState(false)

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
  }

  const handleGameOver = useCallback((finalScore: number) => {
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

  return (
    <div className="h-dvh flex flex-col page-enter overflow-hidden">
      {/* Top bar — compact */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/50 flex-shrink-0">
        <button
          onClick={() => router.push('/')}
          className="touch-btn text-slate-400 hover:text-white transition-colors p-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div className="text-center flex items-center gap-1">
          <span className="text-base">{game.icon}</span>
          <span className="font-semibold text-xs" style={{ color: game.color }}>
            {game.name}
          </span>
          <span className="text-[10px]" style={{ color: LEVEL_LABELS[level].color }}>
            {LEVEL_LABELS[level].stars}
          </span>
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
              <p className="text-3xl font-bold text-white mb-6">
                {score.toLocaleString()}
              </p>

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
