'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { NetworkAdapter } from '@/lib/network-adapter'
import type { Player } from '@/lib/multiplayer-game'
import { setNetwork } from '@/lib/multiplayer-game'
import { getGameById } from '@/lib/games'

// ─── Game Imports ────────────────────────────────────────────────────────────
// Lazy-loaded via dynamic map in the component to avoid bundling all at once.

import SnakeGame from '@/games/snake/SnakeGame'
import TetrisGame from '@/games/tetris/TetrisGame'
import Game2048 from '@/games/2048/Game2048'
import FlappyBirdGame from '@/games/flappy-bird/FlappyBirdGame'
import DinoRunGame from '@/games/dino-run/DinoRunGame'
import SpaceInvadersGame from '@/games/space-invaders/SpaceInvadersGame'

type GameLevel = 'easy' | 'medium' | 'hard'
type GameProps = { onGameOver: (score: number) => void; level: GameLevel }

const ARCADE_COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  'snake': SnakeGame as React.ComponentType<GameProps>,
  'tetris': TetrisGame as React.ComponentType<GameProps>,
  '2048': Game2048 as React.ComponentType<GameProps>,
  'flappy-bird': FlappyBirdGame as React.ComponentType<GameProps>,
  'dino-run': DinoRunGame as React.ComponentType<GameProps>,
  'space-invaders': SpaceInvadersGame as React.ComponentType<GameProps>,
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface ScoreCompetitionProps {
  gameId: string
  adapter: NetworkAdapter
  timerSeconds?: number
  onLeave: () => void
}

type Phase = 'lobby' | 'countdown' | 'playing' | 'results'

interface PlayerScore {
  id: string
  name: string
  avatar: string
  score: number
  alive: boolean
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ScoreCompetition({
  gameId,
  adapter,
  timerSeconds = 120,
  onLeave,
}: ScoreCompetitionProps) {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [players, setPlayers] = useState<PlayerScore[]>([])
  const [countdown, setCountdown] = useState(3)
  const [timeLeft, setTimeLeft] = useState(timerSeconds)
  const [myScore, setMyScore] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const scoreIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const myScoreRef = useRef(0)
  const isHost = adapter.isHost
  const myId = adapter.myPeerId

  const gameInfo = getGameById(gameId)
  const GameComponent = ARCADE_COMPONENTS[gameId]

  // ─── Wire up network ───────────────────────────────────────────────────

  useEffect(() => {
    setNetwork(adapter)
    return () => setNetwork(null)
  }, [adapter])

  // ─── Sync players from network ─────────────────────────────────────────

  useEffect(() => {
    const syncPlayers = () => {
      const peers = adapter.getPeers()
      setPlayers(prev => {
        return peers.map(p => {
          const existing = prev.find(ep => ep.id === p.id)
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            score: existing?.score ?? 0,
            alive: existing?.alive ?? true,
          }
        })
      })
    }

    syncPlayers()
    const interval = setInterval(syncPlayers, 2000)
    return () => clearInterval(interval)
  }, [adapter])

  // ─── Message handler ──────────────────────────────────────────────────

  useEffect(() => {
    const cleanup = adapter.onMessage((msg: any) => {
      const data = msg.data ?? msg

      switch (data.type) {
        case 'score-update': {
          setPlayers(prev =>
            prev.map(p =>
              p.id === data.playerId
                ? { ...p, score: data.score }
                : p
            )
          )
          break
        }

        case 'player-finished': {
          setPlayers(prev =>
            prev.map(p =>
              p.id === data.playerId
                ? { ...p, score: data.score, alive: false }
                : p
            )
          )
          break
        }

        case 'competition-start': {
          setPhase('countdown')
          setCountdown(3)
          break
        }

        case 'competition-end': {
          setPhase('results')
          if (timerRef.current) clearInterval(timerRef.current)
          if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
          break
        }

        case 'timer-sync': {
          setTimeLeft(data.timeLeft)
          break
        }
      }
    })

    return cleanup
  }, [adapter])

  // ─── Countdown logic ──────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'countdown') return

    if (countdown <= 0) {
      setPhase('playing')
      setGameKey(k => k + 1)
      setTimeLeft(timerSeconds)
      return
    }

    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, timerSeconds])

  // ─── Game timer (host authoritative) ──────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1
        if (next <= 0) {
          // Time is up
          if (isHost) {
            adapter.sendMessage({ type: 'competition-end' })
          }
          setPhase('results')
          if (timerRef.current) clearInterval(timerRef.current)
          if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
          return 0
        }

        // Host sends timer sync every 5 seconds
        if (isHost && next % 5 === 0) {
          adapter.sendMessage({ type: 'timer-sync', timeLeft: next })
        }

        return next
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, isHost, adapter])

  // ─── Broadcast own score periodically ─────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing') return

    scoreIntervalRef.current = setInterval(() => {
      adapter.sendMessage({
        type: 'score-update',
        playerId: myId,
        score: myScoreRef.current,
      })
    }, 500)

    return () => {
      if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current)
    }
  }, [phase, adapter, myId])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleStartCompetition = useCallback(() => {
    if (!isHost) return
    adapter.sendMessage({ type: 'competition-start' })
    setPhase('countdown')
    setCountdown(3)
  }, [isHost, adapter])

  const handleGameOver = useCallback((score: number) => {
    myScoreRef.current = score
    setMyScore(score)

    // Update own score in players list
    setPlayers(prev =>
      prev.map(p =>
        p.id === myId ? { ...p, score, alive: false } : p
      )
    )

    // Notify others
    adapter.sendMessage({
      type: 'player-finished',
      playerId: myId,
      score,
    })
  }, [adapter, myId])

  // Track score changes during gameplay (arcade games update score continuously)
  const handleScoreChange = useCallback((score: number) => {
    myScoreRef.current = score
    setMyScore(score)
  }, [])

  // ─── Format timer ─────────────────────────────────────────────────────

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
    const secs = s % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // ─── Sort players by score ────────────────────────────────────────────

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  // ─── Lobby Phase ──────────────────────────────────────────────────────

  if (phase === 'lobby') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <span className="text-4xl mb-2 block">{gameInfo?.icon ?? '🎮'}</span>
            <h2
              className="text-lg font-bold text-white mb-1"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              {gameInfo?.name?.toUpperCase() ?? gameId.toUpperCase()}
            </h2>
            <p className="text-xs text-slate-500">Score Competition</p>
            <p className="text-xs text-purple-400 mt-1">
              {formatTime(timerSeconds)} — play simultaneously, highest score wins!
            </p>
          </div>

          {/* Player list */}
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Players ({players.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50"
                >
                  <span className="text-lg">{p.avatar}</span>
                  <span className="text-sm text-white">{p.name}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Start button (host only) */}
          {isHost && (
            <button
              onClick={handleStartCompetition}
              disabled={players.length < 2}
              className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-500 hover:to-cyan-500 transition-all"
              style={{
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '12px',
              }}
            >
              START COMPETITION
            </button>
          )}

          {!isHost && (
            <p className="text-center text-sm text-slate-400">
              Waiting for host to start...
            </p>
          )}

          <button
            onClick={onLeave}
            className="w-full py-2 text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    )
  }

  // ─── Countdown Phase ──────────────────────────────────────────────────

  if (phase === 'countdown') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-4">Get ready!</p>
          <p
            className="text-7xl font-bold text-cyan-400 animate-pulse"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            {countdown}
          </p>
          <p className="text-slate-500 text-xs mt-4">{gameInfo?.name ?? gameId}</p>
        </div>
      </div>
    )
  }

  // ─── Results Phase ────────────────────────────────────────────────────

  if (phase === 'results') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-sm w-full">
          <p className="text-3xl mb-2">🏆</p>
          <h3 className="text-white font-bold text-xl mb-1">Competition Over!</h3>
          <p className="text-purple-400 text-sm mb-4">{gameInfo?.name ?? gameId}</p>

          <div className="space-y-2 mb-4">
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  i === 0 ? 'bg-amber-500/20 ring-1 ring-amber-400/50' : 'bg-slate-800/50'
                }`}
              >
                <span className="text-sm text-slate-300">
                  {i === 0 ? '👑 ' : `#${i + 1} `}{p.avatar} {p.name}
                </span>
                <span className="text-amber-400 font-bold text-sm">
                  {p.score.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onLeave}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
          >
            Back to Lobby
          </button>
        </div>
      </div>
    )
  }

  // ─── Playing Phase ────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
    >
      {/* Top bar: timer + scores */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <button
          onClick={onLeave}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Leave
        </button>

        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-bold ${
              timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-cyan-400'
            }`}
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
          >
            {formatTime(timeLeft)}
          </span>
        </div>

        <span
          className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          {gameInfo?.name ?? gameId}
        </span>
      </div>

      {/* Score sidebar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/30 overflow-x-auto">
        {sortedPlayers.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg flex-shrink-0 ${
              p.id === myId
                ? 'bg-purple-500/20 border border-purple-500/30'
                : 'bg-slate-900/50'
            } ${!p.alive ? 'opacity-50' : ''}`}
          >
            <span className="text-sm">{p.avatar}</span>
            <span className="text-[10px] text-white font-semibold whitespace-nowrap">
              {p.name}
            </span>
            <span className="text-[10px] text-amber-400 font-bold">
              {p.score.toLocaleString()}
            </span>
            {!p.alive && (
              <span className="text-[8px] text-red-400">DONE</span>
            )}
          </div>
        ))}
      </div>

      {/* Game area */}
      <div className="flex-1 relative overflow-hidden">
        {GameComponent ? (
          <GameComponent
            key={gameKey}
            onGameOver={handleGameOver}
            level="medium"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-500 text-sm">
              Game "{gameId}" not available for competition mode.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
