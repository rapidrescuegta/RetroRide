'use client'

import { useState, useEffect, useRef } from 'react'
import { LocalNetwork } from '@/lib/local-network'
import { SignalingClient } from '@/lib/signaling'
import type { BracketMatchData, BracketParticipantData } from '@/lib/tournament-store'
import { getGameById } from '@/lib/games'
import { getRoundName, totalRounds } from '@/lib/bracket'

// ─── Types ──────────────────────────────────────────────────────────────

interface SpectatorViewProps {
  match: BracketMatchData
  participants: BracketParticipantData[]
  bracketSize: number
  tournamentName: string
  onBack: () => void
}

interface GameStateUpdate {
  type: string
  state?: Record<string, unknown>
  scores?: Record<string, number>
  [key: string]: unknown
}

// ─── Component ──────────────────────────────────────────────────────────

export default function SpectatorView({
  match,
  participants,
  bracketSize,
  tournamentName,
  onBack,
}: SpectatorViewProps) {
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState<GameStateUpdate | null>(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<string[]>([])
  const networkRef = useRef<LocalNetwork | null>(null)
  const signalingRef = useRef<SignalingClient | null>(null)

  const p1 = participants.find(p => p.memberId === match.player1Id)
  const p2 = participants.find(p => p.memberId === match.player2Id)
  const gameInfo = getGameById(match.tournamentId ? (participants[0]?.tournamentId || '') : '')
  const numRounds = totalRounds(bracketSize)
  const roundName = getRoundName(match.round, numRounds)

  // ── Connect as spectator ───────────────────────────────────────────

  useEffect(() => {
    if (!match.roomCode || match.status !== 'in-progress') {
      setError('Match is not live')
      return
    }

    const net = new LocalNetwork('internet')
    networkRef.current = net

    const signaling = new SignalingClient(net)
    signalingRef.current = signaling

    const spectatorPeer = {
      id: `spectator-${Date.now()}`,
      name: 'Spectator',
      avatar: '👁️',
    }

    // Listen for game state messages
    net.onMessage((msg) => {
      try {
        const data = typeof msg === 'string' ? JSON.parse(msg) : msg
        if (data.type === 'game-state' || data.type === 'game-over') {
          setGameState(data)
        }
        if (data.type === 'game-action' || data.type === 'game-start') {
          setMessages(prev => [...prev.slice(-20), `${data.type}: ${JSON.stringify(data).slice(0, 80)}`])
        }
      } catch { /* ignore parse errors */ }
    })

    signaling.onStateChange((state, detail) => {
      if (state === 'connected') {
        setConnected(true)
        // Send spectator identification
        net.sendMessage({ type: 'spectator-join' })
      } else if (state === 'error') {
        setError(detail || 'Failed to connect as spectator')
      }
    })

    signaling.joinRoom(match.roomCode, spectatorPeer).catch(err => {
      if (err?.message !== 'Aborted') {
        setError(err?.message || 'Failed to join as spectator')
      }
    })

    return () => {
      networkRef.current?.close()
      signalingRef.current?.cleanup()
    }
  }, [match.roomCode, match.status])

  // ── Scores from game state ─────────────────────────────────────────

  const scores = gameState?.scores as Record<string, number> | undefined
  const p1Score = scores && match.player1Id ? scores[match.player1Id] : null
  const p2Score = scores && match.player2Id ? scores[match.player2Id] : null
  const isGameOver = gameState?.type === 'game-over'

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
    >
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            ← Back to Bracket
          </button>
          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
            👁️ Spectating
          </span>
        </div>

        <div className="text-center mb-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">
            🏒 {tournamentName} — {roundName}
          </p>
        </div>

        {/* Matchup scoreboard */}
        <div className="flex items-center justify-center gap-6 py-4 rounded-xl bg-slate-800/40 border border-slate-700/30">
          <div className="text-center min-w-[80px]">
            <div className="text-3xl mb-1">{p1?.member?.avatar || '❓'}</div>
            <p className="text-xs text-white font-medium">{p1?.member?.name || 'Player 1'}</p>
            {p1Score !== null && (
              <p className="text-lg font-bold text-cyan-400 mt-1">{p1Score}</p>
            )}
          </div>

          <div className="flex flex-col items-center gap-1">
            {connected ? (
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-bold">LIVE</span>
              </div>
            ) : (
              <span className="text-sm text-slate-500">VS</span>
            )}
            {isGameOver && (
              <span className="text-xs text-amber-400 font-bold mt-1">FINAL</span>
            )}
          </div>

          <div className="text-center min-w-[80px]">
            <div className="text-3xl mb-1">{p2?.member?.avatar || '❓'}</div>
            <p className="text-xs text-white font-medium">{p2?.member?.name || 'Player 2'}</p>
            {p2Score !== null && (
              <p className="text-lg font-bold text-cyan-400 mt-1">{p2Score}</p>
            )}
          </div>
        </div>
      </div>

      {/* Game state visualization */}
      <div className="flex-1 px-4 pb-4">
        {error ? (
          <div className="text-center py-8">
            <p className="text-sm text-red-400 mb-4">{error}</p>
            <button
              onClick={onBack}
              className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors"
            >
              Back to Bracket
            </button>
          </div>
        ) : !connected ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-3 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400">Connecting to match...</p>
            <p className="text-[10px] text-slate-600 mt-2">Room: {match.roomCode}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Live game state display */}
            <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">
                Live Game State
              </p>

              {gameState ? (
                <div className="space-y-2">
                  {/* Public state rendering */}
                  {gameState.state && typeof gameState.state === 'object' && (
                    <>
                      {/* Current turn */}
                      {(gameState.state as Record<string, unknown>).currentTurn && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Turn:</span>
                          <span className="text-xs text-cyan-400">
                            {participants.find(
                              p => p.memberId === (gameState.state as Record<string, unknown>).currentTurn
                            )?.member?.name || 'Unknown'}
                          </span>
                        </div>
                      )}

                      {/* Top card (for card games) */}
                      {(gameState.state as Record<string, unknown>).topCard && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Top Card:</span>
                          <span className="text-xs text-white">
                            {String(JSON.stringify((gameState.state as Record<string, unknown>).topCard))}
                          </span>
                        </div>
                      )}

                      {/* Deck size */}
                      {typeof (gameState.state as Record<string, unknown>).deckSize === 'number' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">Cards in deck:</span>
                          <span className="text-xs text-amber-400">
                            {(gameState.state as Record<string, unknown>).deckSize as number}
                          </span>
                        </div>
                      )}
                    </>
                  )}

                  {isGameOver && (
                    <div className="text-center py-4">
                      <p className="text-lg font-bold text-amber-400">🏆 Match Complete!</p>
                      {typeof gameState.winner === 'string' && gameState.winner && (
                        <p className="text-sm text-white mt-2">
                          Winner: {participants.find(p => p.memberId === String(gameState.winner))?.member?.name || 'Unknown'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-sm text-slate-400">Waiting for game data...</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Game state will appear here as the match progresses
                  </p>
                </div>
              )}
            </div>

            {/* Activity feed */}
            {messages.length > 0 && (
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                  Activity
                </p>
                <div className="space-y-1 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {messages.map((msg, i) => (
                    <p key={i} className="text-[10px] text-slate-400 font-mono">
                      {msg}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
