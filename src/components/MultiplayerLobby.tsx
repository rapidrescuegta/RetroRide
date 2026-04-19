'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LocalNetwork, generateId, setTurnConfig } from '@/lib/local-network'
import type { PeerInfo, ConnectionMode } from '@/lib/local-network'
import { SignalingClient } from '@/lib/signaling'
import type { SignalingState } from '@/lib/signaling'
import { NetworkAdapter } from '@/lib/network-adapter'
import { setNetwork } from '@/lib/multiplayer-game'
import { getMultiplayerConfig, getPlayerCount } from '@/lib/multiplayer-registry'

// ─── Types ──────────────────────────────────────────────────────────────────

type LobbyPhase =
  | 'choose-mode'     // Pick host vs join
  | 'creating'        // Host: setting up room
  | 'waiting'         // Host: waiting for players
  | 'joining'         // Joiner: entering room code
  | 'connecting'      // WebRTC handshake in progress
  | 'ready'           // All connected, host can start
  | 'error'

interface MultiplayerLobbyProps {
  gameId: string
  gameName: string
  gameIcon: string
  gameColor: string
  onStart: () => void
  onCancel: () => void
}

// ─── Random names and avatars for anonymous players ─────────────────────────

const AVATARS = ['🎮', '🕹️', '👾', '🎲', '🃏', '🏆', '⭐', '🔥', '💎', '🎯', '🚀', '🌟']
const NAMES = ['Player', 'Gamer', 'Pro', 'Ace', 'Star', 'Champ', 'Hero', 'Legend']

function randomPeer(): PeerInfo {
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)]
  const name = NAMES[Math.floor(Math.random() * NAMES.length)]
  const num = Math.floor(Math.random() * 100)
  return {
    id: generateId(8),
    name: `${name}${num}`,
    avatar,
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MultiplayerLobby({
  gameId,
  gameName,
  gameIcon,
  gameColor,
  onStart,
  onCancel,
}: MultiplayerLobbyProps) {
  const [phase, setPhase] = useState<LobbyPhase>('choose-mode')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [peers, setPeers] = useState<PeerInfo[]>([])
  const [localPeer] = useState<PeerInfo>(() => randomPeer())
  const [error, setError] = useState<string | null>(null)
  const [signalingState, setSignalingState] = useState<SignalingState>('idle')
  const [copied, setCopied] = useState(false)

  const networkRef = useRef<LocalNetwork | null>(null)
  const signalingRef = useRef<SignalingClient | null>(null)

  const playerCount = getPlayerCount(gameId)
  const minPlayers = playerCount?.min ?? 2
  const maxPlayers = playerCount?.max ?? 6

  const isHost = networkRef.current?.isHost ?? false
  const totalPlayers = peers.length + 1 // +1 for local player
  const canStart = isHost && totalPlayers >= minPlayers

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      signalingRef.current?.cleanup()
      networkRef.current?.close()
      setNetwork(null)
    }
  }, [])

  // ── Fetch ICE config from server (TURN credentials stay server-side) ──
  const fetchIceConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/ice-config')
      if (res.ok) {
        const data = await res.json()
        if (data.iceServers?.length > 0) {
          setTurnConfig(data.iceServers)
        }
      }
    } catch {
      // ICE config fetch failed — LocalNetwork will use its built-in fallback
    }
  }, [])

  // ── Host: Create Room ──
  const handleHost = useCallback(async () => {
    setPhase('creating')
    setError(null)

    try {
      await fetchIceConfig()
      const network = new LocalNetwork('internet')
      networkRef.current = network

      // Listen for peer events
      network.onPeerJoined((peer) => {
        setPeers([...network.getPeers()])
      })
      network.onPeerLeft(() => {
        setPeers([...network.getPeers()])
      })
      network.onConnectionStateChange((state) => {
        if (state === 'failed') {
          setError('Connection failed. Player may be behind a strict firewall.')
        }
      })

      const signaling = new SignalingClient(network)
      signalingRef.current = signaling

      signaling.onStateChange((state, detail) => {
        setSignalingState(state)
        if (state === 'error') {
          setError(detail || 'Connection error')
          setPhase('error')
        }
        if (state === 'timeout') {
          setError('No one joined within 2 minutes. Try again.')
          setPhase('error')
        }
        if (state === 'connected') {
          setPeers([...network.getPeers()])
          setPhase('ready')
        }
      })

      await signaling.hostRoom(localPeer)
      setRoomCode(signaling.roomCode)
      setPhase('waiting')
    } catch (err: any) {
      setError(err.message || 'Failed to create room')
      setPhase('error')
    }
  }, [localPeer, fetchIceConfig])

  // ── Joiner: Join Room ──
  const handleJoin = useCallback(async () => {
    const code = joinCode.toUpperCase().trim()
    if (!code || code.length < 4) {
      setError('Enter a valid room code')
      return
    }

    setPhase('connecting')
    setError(null)

    await fetchIceConfig()

    try {
      const network = new LocalNetwork('internet')
      networkRef.current = network

      network.onPeerJoined((peer) => {
        setPeers([...network.getPeers()])
      })
      network.onPeerLeft(() => {
        setPeers([...network.getPeers()])
      })
      network.onConnectionStateChange((state) => {
        if (state === 'failed') {
          setError('Connection failed. The host may be behind a strict firewall.')
        }
      })

      const signaling = new SignalingClient(network)
      signalingRef.current = signaling

      signaling.onStateChange((state, detail) => {
        setSignalingState(state)
        if (state === 'error') {
          setError(detail || 'Connection error')
          setPhase('error')
        }
        if (state === 'connected') {
          setPeers([...network.getPeers()])
          setPhase('ready')
        }
      })

      await signaling.joinRoom(code, localPeer)
      setRoomCode(code)
    } catch (err: any) {
      setError(err.message || 'Failed to join room')
      setPhase('error')
    }
  }, [joinCode, localPeer, fetchIceConfig])

  // ── Start Game ──
  const handleStartGame = useCallback(() => {
    if (!networkRef.current) return

    // Wire up the network adapter so useMultiplayerGame can use it
    const adapter = new NetworkAdapter(networkRef.current)
    setNetwork(adapter)

    // Broadcast game-start signal so joiners know the game is beginning
    networkRef.current.sendMessage({
      type: '__game-starting',
      gameId,
    })

    onStart()
  }, [gameId, onStart])

  // ── Listen for game-start signal as joiner ──
  useEffect(() => {
    const network = networkRef.current
    if (!network || network.isHost) return

    const cleanup = network.onMessage((msg) => {
      const data = msg.data ?? msg
      if (data.type === '__game-starting') {
        // Wire up adapter and start
        const adapter = new NetworkAdapter(network)
        setNetwork(adapter)
        onStart()
      }
    })

    return cleanup
  }, [phase, onStart])

  // ── Copy Room Code ──
  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
    }
  }, [roomCode])

  // ── Share ──
  const shareRoom = useCallback(async () => {
    const shareData = {
      title: `Join my ${gameName} game!`,
      text: `Join my game room with code: ${roomCode}`,
      url: `${window.location.origin}/play/${gameId}?room=${roomCode}`,
    }
    if (navigator.share) {
      try { await navigator.share(shareData) } catch { /* cancelled */ }
    } else {
      await copyCode()
    }
  }, [roomCode, gameName, gameId, copyCode])

  // ── Render ──

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 page-enter"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)' }}
    >
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">{gameIcon}</p>
          <h1 className="text-xl font-bold text-white mb-1">{gameName}</h1>
          <p className="text-sm text-slate-400">Online Multiplayer</p>
          <p className="text-xs text-slate-600 mt-1">
            {minPlayers === maxPlayers
              ? `${minPlayers} players`
              : `${minPlayers}-${maxPlayers} players`}
          </p>
        </div>

        {/* ── Choose Mode ── */}
        {phase === 'choose-mode' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleHost}
              className="w-full py-4 rounded-xl font-bold text-white text-base transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${gameColor}, ${gameColor}cc)`,
                boxShadow: `0 0 30px ${gameColor}30`,
              }}
            >
              <span className="text-lg mr-2">+</span>
              Create Room
            </button>

            <div className="text-center text-slate-500 text-xs py-1">or</div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-center font-mono text-lg tracking-widest placeholder-slate-600 focus:outline-none focus:border-purple-500 uppercase"
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
              />
              <button
                onClick={handleJoin}
                disabled={joinCode.length < 4}
                className="px-6 py-3 rounded-xl font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: joinCode.length >= 4 ? '#7c3aed' : '#334155' }}
              >
                Join
              </button>
            </div>

            <button
              onClick={onCancel}
              className="mt-4 w-full py-3 rounded-xl bg-slate-800/50 text-slate-400 text-sm hover:bg-slate-800 transition-all"
            >
              Back
            </button>
          </div>
        )}

        {/* ── Creating / Connecting ── */}
        {(phase === 'creating' || phase === 'connecting') && (
          <div className="text-center py-8">
            <div className="inline-block w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-300">
              {phase === 'creating' ? 'Creating room...' : 'Connecting...'}
            </p>
            <p className="text-xs text-slate-500 mt-2">
              Setting up peer-to-peer connection
            </p>
          </div>
        )}

        {/* ── Waiting for Players / Ready ── */}
        {(phase === 'waiting' || phase === 'ready') && (
          <div className="flex flex-col gap-4">
            {/* Room Code Card */}
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">Room Code</p>
                  <p
                    className="text-2xl font-bold text-cyan-400 tracking-[0.3em]"
                    style={{ fontFamily: 'monospace' }}
                  >
                    {roomCode}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isHost && (
                    <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-amber-600/20 text-amber-400 rounded-full border border-amber-600/30">
                      Host
                    </span>
                  )}
                  <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-emerald-600/20 text-emerald-400 rounded-full border border-emerald-600/30">
                    {signalingState === 'connected' ? 'Connected' : 'Online'}
                  </span>
                </div>
              </div>

              {/* Share buttons */}
              {isHost && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={copyCode}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/50 text-sm text-slate-300 hover:border-cyan-500/50 hover:text-cyan-400 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {copied ? 'Copied!' : 'Copy Code'}
                  </button>
                  <button
                    onClick={shareRoom}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-900/80 border border-slate-700/50 text-sm text-slate-300 hover:border-purple-500/50 hover:text-purple-400 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </button>
                </div>
              )}

              {/* Player list */}
              <p className="text-xs text-slate-500 mb-2">
                Players ({totalPlayers}/{maxPlayers})
                {totalPlayers < minPlayers && (
                  <span className="ml-2 text-amber-400">
                    Need {minPlayers - totalPlayers} more
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-2">
                {/* Local player */}
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-green-500/30">
                  <span className="text-lg">{localPeer.avatar}</span>
                  <span className="text-sm text-white flex-1">{localPeer.name}</span>
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-slate-500">(You)</span>
                </div>

                {/* Remote peers */}
                {peers.map(peer => (
                  <div
                    key={peer.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-700/50"
                  >
                    <span className="text-lg">{peer.avatar}</span>
                    <span className="text-sm text-white flex-1">{peer.name}</span>
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  </div>
                ))}

                {/* Empty slots */}
                {Array.from({ length: maxPlayers - totalPlayers }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/30 border border-slate-800/50 border-dashed"
                  >
                    <span className="text-lg opacity-20">?</span>
                    <span className="text-sm text-slate-600">Waiting for player...</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Host: Start button / Joiner: Waiting message */}
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={!canStart}
                className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: canStart
                    ? `linear-gradient(135deg, #10b981, #06b6d4)`
                    : '#334155',
                  boxShadow: canStart ? '0 0 30px rgba(16, 185, 129, 0.3)' : 'none',
                }}
              >
                {canStart ? 'START GAME' : `Waiting for ${minPlayers - totalPlayers} more player${minPlayers - totalPlayers > 1 ? 's' : ''}...`}
              </button>
            ) : (
              <div className="text-center py-3 rounded-xl bg-slate-800/30 border border-slate-700/30">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Waiting for host to start the game...</p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                signalingRef.current?.cleanup()
                networkRef.current?.close()
                setNetwork(null)
                setPhase('choose-mode')
                setPeers([])
                setRoomCode('')
                setError(null)
              }}
              className="w-full py-3 rounded-xl bg-slate-800/50 text-slate-400 text-sm hover:bg-slate-800 transition-all"
            >
              Leave Room
            </button>
          </div>
        )}

        {/* ── Joining (enter code) ── */}
        {phase === 'joining' && (
          <div className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="ROOM CODE"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoFocus
              className="w-full px-4 py-4 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-center font-mono text-2xl tracking-[0.3em] placeholder-slate-600 focus:outline-none focus:border-purple-500 uppercase"
              onKeyDown={(e) => { if (e.key === 'Enter') handleJoin() }}
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.length < 4}
              className="w-full py-4 rounded-xl font-bold text-white text-base transition-all disabled:opacity-40"
              style={{ background: joinCode.length >= 4 ? '#7c3aed' : '#334155' }}
            >
              Join Room
            </button>
            <button
              onClick={() => { setPhase('choose-mode'); setError(null) }}
              className="w-full py-3 rounded-xl bg-slate-800/50 text-slate-400 text-sm"
            >
              Back
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-red-900/20 border border-red-500/30 p-4 text-center">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button
              onClick={() => {
                signalingRef.current?.cleanup()
                networkRef.current?.close()
                setNetwork(null)
                setPhase('choose-mode')
                setError(null)
              }}
              className="w-full py-3 rounded-xl bg-slate-800/50 text-slate-300 text-sm hover:bg-slate-800 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={onCancel}
              className="w-full py-3 rounded-xl bg-slate-800/30 text-slate-500 text-sm"
            >
              Back to Game
            </button>
          </div>
        )}

        {/* Error toast (non-blocking) */}
        {error && phase !== 'error' && (
          <div className="mt-4 rounded-lg bg-red-900/20 border border-red-500/30 px-3 py-2 text-center">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
