'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LocalNetwork } from '@/lib/local-network'
import { SignalingClient } from '@/lib/signaling'
import { NetworkAdapter } from '@/lib/network-adapter'
import MultiplayerGameView from '@/components/MultiplayerGameView'
import { getMultiplayerConfig } from '@/lib/multiplayer-registry'
import { reportMatchResult, type BracketMatchData, type BracketParticipantData } from '@/lib/tournament-store'
import { getRoundName, totalRounds } from '@/lib/bracket'
import { getGameById } from '@/lib/games'

// ─── Types ──────────────────────────────────────────────────────────────

interface TournamentMatchViewProps {
  tournamentId: string
  tournamentName: string
  match: BracketMatchData
  participants: BracketParticipantData[]
  bracketSize: number
  gameId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string
  onComplete: (winnerId: string) => void
  onBack: () => void
}

type Phase = 'connecting' | 'playing' | 'result'

// ─── Component ──────────────────────────────────────────────────────────

export default function TournamentMatchView({
  tournamentId,
  tournamentName,
  match,
  participants,
  bracketSize,
  gameId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  onComplete,
  onBack,
}: TournamentMatchViewProps) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [adapter, setAdapter] = useState<NetworkAdapter | null>(null)
  const [error, setError] = useState('')
  const [resultWinner, setResultWinner] = useState<string | null>(null)
  const networkRef = useRef<LocalNetwork | null>(null)
  const signalingRef = useRef<SignalingClient | null>(null)

  const isPlayer1 = match.player1Id === currentUserId
  const opponentId = isPlayer1 ? match.player2Id : match.player1Id
  const opponent = participants.find(p => p.memberId === opponentId)
  const gameInfo = getGameById(gameId)
  const registryEntry = getMultiplayerConfig(gameId)
  const numRounds = totalRounds(bracketSize)
  const roundName = getRoundName(match.round, numRounds)

  // ── Connect to match room ──────────────────────────────────────────

  useEffect(() => {
    if (!match.roomCode) {
      setError('No room code — match has not been started')
      return
    }

    const net = new LocalNetwork('internet')
    networkRef.current = net

    const signaling = new SignalingClient(net)
    signalingRef.current = signaling

    const localPeer = {
      id: currentUserId,
      name: currentUserName,
      avatar: currentUserAvatar,
    }

    signaling.onStateChange((state, detail) => {
      if (state === 'connected') {
        const netAdapter = new NetworkAdapter(net)
        setAdapter(netAdapter)
        setPhase('playing')
      } else if (state === 'error') {
        setError(detail || 'Connection error')
      } else if (state === 'timeout') {
        setError('Connection timed out — opponent may not be ready')
      }
    })

    // Lower seed (player1) hosts, higher seed (player2) joins
    if (isPlayer1) {
      signaling.hostRoom(localPeer).catch(err => {
        if (err?.message !== 'Aborted') setError(err?.message || 'Failed to host')
      })
    } else {
      // Wait a moment for host to set up, then join
      setTimeout(() => {
        signaling.joinRoom(match.roomCode!, localPeer).catch(err => {
          if (err?.message !== 'Aborted') setError(err?.message || 'Failed to join')
        })
      }, 1500)
    }

    return () => {
      networkRef.current?.close()
      signalingRef.current?.cleanup()
    }
  }, [match.roomCode, isPlayer1, currentUserId, currentUserName, currentUserAvatar])

  // ── Handle game completion ─────────────────────────────────────────

  const handleLeave = useCallback(async () => {
    // If the game is done and we have a result, report it
    if (resultWinner) {
      onComplete(resultWinner)
      return
    }

    // Otherwise just go back (forfeit scenario — opponent wins)
    const winnerId = opponentId
    if (winnerId) {
      try {
        await reportMatchResult(tournamentId, match.id, currentUserId, winnerId)
      } catch { /* ignore */ }
      onComplete(winnerId)
    } else {
      onBack()
    }
  }, [resultWinner, opponentId, tournamentId, match.id, currentUserId, onComplete, onBack])

  // ── Connecting Phase ───────────────────────────────────────────────

  if (phase === 'connecting') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
      >
        <div className="text-center max-w-sm w-full space-y-6">
          {/* Tournament context */}
          <div>
            <p className="text-[10px] text-amber-400 uppercase tracking-wider font-bold mb-1">
              🏒 {tournamentName}
            </p>
            <p className="text-xs text-slate-400">{roundName}</p>
          </div>

          {/* Matchup */}
          <div className="flex items-center justify-center gap-6">
            <div className="text-center">
              <div className="text-3xl mb-1">{currentUserAvatar}</div>
              <p className="text-xs text-white font-medium">{currentUserName}</p>
            </div>
            <div className="text-xl text-slate-500 font-bold">VS</div>
            <div className="text-center">
              <div className="text-3xl mb-1">{opponent?.member?.avatar || '❓'}</div>
              <p className="text-xs text-white font-medium">
                {opponent?.member?.name || 'Opponent'}
              </p>
            </div>
          </div>

          {/* Game */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">{gameInfo?.icon || '🎮'}</span>
            <span className="text-sm text-slate-300">{gameInfo?.name || gameId}</span>
          </div>

          {error ? (
            <div className="space-y-3">
              <p className="text-xs text-red-400">{error}</p>
              <button
                onClick={onBack}
                className="px-6 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                Back to Bracket
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                <p className="text-sm text-slate-400">
                  {isPlayer1 ? 'Hosting match...' : 'Joining match...'}
                </p>
              </div>
              <p className="text-[10px] text-slate-600">
                Room: {match.roomCode}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Playing Phase ──────────────────────────────────────────────────

  if (phase === 'playing' && adapter && registryEntry?.cardConfig) {
    return (
      <div className="fixed inset-0 z-50">
        {/* Tournament header bar */}
        <div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-900/80 to-purple-900/80 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between border-b border-amber-500/20">
          <span className="text-[10px] text-amber-400 font-bold">
            🏒 {roundName}
          </span>
          <span className="text-[10px] text-slate-300">
            {currentUserName} vs {opponent?.member?.name || 'Opponent'}
          </span>
          <span className="text-[10px] text-slate-400">
            {gameInfo?.icon} {gameInfo?.name}
          </span>
        </div>

        <div className="pt-8">
          <MultiplayerGameView
            config={registryEntry.cardConfig}
            adapter={adapter}
            onLeave={handleLeave}
            registryEntry={registryEntry}
          />
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-slate-400">Setting up match...</p>
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-white">
          Back to Bracket
        </button>
      </div>
    </div>
  )
}
