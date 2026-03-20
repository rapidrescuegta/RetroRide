'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { getGameById } from '@/lib/games'
import { saveScore, getHighScore } from '@/lib/scores'
import { useFamily } from '@/lib/family-context'

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

const GAME_COMPONENTS: Record<string, React.ComponentType<{ onGameOver: (score: number) => void }>> = {
  'snake': SnakeGame,
  'pong': PongGame,
  'tetris': TetrisGame,
  'breakout': BreakoutGame,
  'memory-match': MemoryMatchGame,
  'tic-tac-toe': TicTacToeGame,
  'simon': SimonGame,
  'flappy-bird': FlappyBirdGame,
  'dino-run': DinoRunGame,
  'whack-a-mole': WhackAMoleGame,
  '2048': Game2048,
  'space-invaders': SpaceInvadersGame,
  'connect-four': ConnectFourGame,
  'hangman': HangmanGame,
  'wordle': WordleGame,
  'minesweeper': MinesweeperGame,
  'frogger': FroggerGame,
  'asteroids': AsteroidsGame,
  'pac-man': PacManGame,
  'galaga': GalagaGame,
  'checkers': CheckersGame,
  'brick-breaker': BrickBreakerGame,
  'crossy-road': CrossyRoadGame,
  'doodle-jump': DoodleJumpGame,
  'chess': ChessGame,
}

export default function PlayClient({ gameId }: { gameId: string }) {
  const router = useRouter()
  const game = getGameById(gameId)
  const familyCtx = useFamily()

  const [gameState, setGameState] = useState<'playing' | 'over'>('playing')
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [isNewHigh, setIsNewHigh] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    if (game) {
      setHighScore(getHighScore(game.id))
    }
  }, [game])

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
    // Delay showing the overlay so the player can see the game's own result
    setTimeout(() => setShowOverlay(true), 1800)
  }, [game])

  const handleRestart = () => {
    setGameState('playing')
    setScore(0)
    setIsNewHigh(false)
    setShowOverlay(false)
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

        <div className="text-xs text-slate-500 min-w-[60px] text-right">
          {highScore > 0 && <>Best: {highScore.toLocaleString()}</>}
        </div>
      </div>

      {/* Game area */}
      <div className="flex-1 flex items-center justify-center relative">
        {gameState === 'playing' && GameComponent && (
          <GameComponent onGameOver={handleGameOver} />
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
                  onClick={() => router.push('/')}
                  className="w-full px-6 py-3 bg-slate-700 rounded-xl text-slate-300 text-sm hover:bg-slate-600 transition-all"
                >
                  Back to Games
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="text-center py-2 text-xs text-slate-600">
        {game.controls}
      </div>
    </div>
  )
}
