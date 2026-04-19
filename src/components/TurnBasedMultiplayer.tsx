'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { NetworkAdapter } from '@/lib/network-adapter'
import { setNetwork } from '@/lib/multiplayer-game'
import { getGameById } from '@/lib/games'

// ─── Game Imports ────────────────────────────────────────────────────────────

import TicTacToeGame from '@/games/tic-tac-toe/TicTacToeGame'
import ConnectFourGame from '@/games/connect-four/ConnectFourGame'
import CheckersGame from '@/games/checkers/CheckersGame'
import ChessGame from '@/games/chess/ChessGame'

type GameLevel = 'easy' | 'medium' | 'hard'
type GameProps = { onGameOver: (score: number) => void; level: GameLevel }

const STRATEGY_COMPONENTS: Record<string, React.ComponentType<GameProps>> = {
  'tic-tac-toe': TicTacToeGame as React.ComponentType<GameProps>,
  'connect-four': ConnectFourGame as React.ComponentType<GameProps>,
  'checkers': CheckersGame as React.ComponentType<GameProps>,
  'chess': ChessGame as React.ComponentType<GameProps>,
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface TurnBasedMultiplayerProps {
  gameId: string
  adapter: NetworkAdapter
  onLeave: () => void
}

interface PlayerInfo {
  id: string
  name: string
  avatar: string
  score: number
}

type Phase = 'lobby' | 'playing' | 'results'

// ─── Component ──────────────────────────────────────────────────────────────

export default function TurnBasedMultiplayer({
  gameId,
  adapter,
  onLeave,
}: TurnBasedMultiplayerProps) {
  const [phase, setPhase] = useState<Phase>('lobby')
  const [players, setPlayers] = useState<PlayerInfo[]>([])
  const [currentTurnIndex, setCurrentTurnIndex] = useState(0)
  const [gameKey, setGameKey] = useState(0)
  const [resultMessage, setResultMessage] = useState('')
  const [playerScores, setPlayerScores] = useState<Record<string, number>>({})
  const isHost = adapter.isHost
  const myId = adapter.myPeerId
  const gameInfo = getGameById(gameId)
  const GameComponent = STRATEGY_COMPONENTS[gameId]

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
        case 'turn-game-start': {
          setPhase('playing')
          setCurrentTurnIndex(0)
          setGameKey(k => k + 1)
          break
        }

        case 'turn-change': {
          setCurrentTurnIndex(data.turnIndex)
          break
        }

        case 'turn-game-over': {
          setPhase('results')
          setPlayerScores(data.scores ?? {})
          setResultMessage(data.message ?? 'Game Over!')
          break
        }

        case 'turn-game-action': {
          // Forward game actions between players (board state sync)
          // This will be consumed by future per-game multiplayer adapters
          break
        }
      }
    })

    return cleanup
  }, [adapter])

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleStartGame = useCallback(() => {
    if (!isHost) return
    adapter.sendMessage({ type: 'turn-game-start' })
    setPhase('playing')
    setCurrentTurnIndex(0)
    setGameKey(k => k + 1)
  }, [isHost, adapter])

  const handleGameOver = useCallback((score: number) => {
    const myPlayer = players.find(p => p.id === myId)
    const opponentPlayer = players.find(p => p.id !== myId)

    // In turn-based games, score > 0 typically means a win
    const scores: Record<string, number> = {}
    for (const p of players) {
      scores[p.id] = p.id === myId ? score : 0
    }

    // Broadcast game over
    adapter.sendMessage({
      type: 'turn-game-over',
      scores,
      message: score > 0
        ? `${myPlayer?.name ?? 'Player'} wins!`
        : 'Draw!',
    })

    setPlayerScores(scores)
    setResultMessage(
      score > 0
        ? `${myPlayer?.name ?? 'Player'} wins!`
        : 'Draw!'
    )
    setPhase('results')
  }, [adapter, myId, players])

  // ─── Determine whose turn it is ───────────────────────────────────────

  const isMyTurn = players.length > 0 && players[currentTurnIndex % players.length]?.id === myId
  const currentPlayer = players[currentTurnIndex % players.length]

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
            <p className="text-xs text-slate-500">Turn-Based Multiplayer</p>
          </div>

          {/* Player list */}
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-wider">
              Players ({players.length})
              {2 > players.length && (
                <span className="text-amber-400 ml-2">
                  Need {2 - players.length} more
                </span>
              )}
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
              onClick={handleStartGame}
              disabled={players.length < 2}
              className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-500 hover:to-cyan-500 transition-all"
              style={{
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '12px',
              }}
            >
              START GAME
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

  // ─── Results Phase ────────────────────────────────────────────────────

  if (phase === 'results') {
    const sortedPlayers = [...players].sort((a, b) =>
      (playerScores[b.id] ?? 0) - (playerScores[a.id] ?? 0)
    )

    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 text-center max-w-sm w-full">
          <p className="text-3xl mb-2">{gameInfo?.icon ?? '🏆'}</p>
          <h3 className="text-white font-bold text-xl mb-1">Game Over!</h3>
          <p className="text-purple-400 text-sm mb-4">{resultMessage}</p>

          <div className="space-y-2 mb-4">
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                  i === 0 && (playerScores[p.id] ?? 0) > 0
                    ? 'bg-amber-500/20 ring-1 ring-amber-400/50'
                    : 'bg-slate-800/50'
                }`}
              >
                <span className="text-sm text-slate-300">
                  {i === 0 && (playerScores[p.id] ?? 0) > 0 ? '👑 ' : ''}{p.avatar} {p.name}
                </span>
                <span className="text-amber-400 font-bold text-sm">
                  {playerScores[p.id] ?? 0} pts
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
      {/* Top bar: turn indicator + players */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-slate-700/50">
        <button
          onClick={onLeave}
          className="text-xs text-slate-500 hover:text-red-400 transition-colors"
        >
          Leave
        </button>

        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isMyTurn ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-300">
            {isMyTurn
              ? 'Your turn!'
              : `${currentPlayer?.name ?? 'Opponent'}'s turn...`
            }
          </span>
        </div>

        <span
          className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          {gameInfo?.name ?? gameId}
        </span>
      </div>

      {/* Player avatars bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/50 border-b border-slate-700/30">
        {players.map((p, i) => (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg flex-shrink-0 ${
              i === (currentTurnIndex % players.length)
                ? 'bg-cyan-500/20 border border-cyan-500/30'
                : p.id === myId
                  ? 'bg-purple-500/10 border border-purple-500/20'
                  : 'bg-slate-900/50'
            }`}
          >
            <span className="text-sm">{p.avatar}</span>
            <span className="text-[10px] text-white font-semibold whitespace-nowrap">
              {p.name}
            </span>
            {i === (currentTurnIndex % players.length) && (
              <span className="text-[8px] text-cyan-400 animate-pulse">TURN</span>
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
              Game "{gameId}" not available for multiplayer mode.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
