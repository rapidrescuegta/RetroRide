'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { LocalNetwork, PeerInfo, NetworkMessage } from '@/lib/local-network'
import type { SignalingClient, SignalingState } from '@/lib/signaling'

// ─── Types ───────────────────────────────────────────────────────────────────

type ConnectionMode = 'choose' | 'online-host' | 'online-join' | 'local-host' | 'local-join'

interface LocalRoomProps {
  network: LocalNetwork
  signalingClient?: SignalingClient | null
  onStartGame?: () => void
  /** If provided, auto-start in a specific mode (e.g., from tournament) */
  initialMode?: ConnectionMode
  /** Tournament match ID, if this room is for a tournament match */
  tournamentMatchId?: string
}

interface ChatMsg {
  from: string
  name: string
  avatar: string
  text: string
  ts: number
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LocalRoom({
  network,
  signalingClient,
  onStartGame,
  initialMode = 'choose',
  tournamentMatchId,
}: LocalRoomProps) {
  const [mode, setMode] = useState<ConnectionMode>(initialMode)
  const [peers, setPeers] = useState<PeerInfo[]>(network.getPeers())
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [roomCodeInput, setRoomCodeInput] = useState('')
  const [signalingState, setSignalingState] = useState<SignalingState>('idle')
  const [signalingDetail, setSignalingDetail] = useState<string>('')
  const [error, setError] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ─── Network event handlers ────────────────────────────────────────────────

  useEffect(() => {
    const handleJoin = () => {
      setPeers([...network.getPeers()])
    }

    const handleLeft = () => {
      setPeers([...network.getPeers()])
    }

    const handleMessage = (msg: NetworkMessage) => {
      if (msg.type === 'chat' || msg.data?.type === 'chat') {
        const chatData = msg.data
        setChatMessages(prev => [...prev, {
          from: msg.from,
          name: chatData.name || 'Unknown',
          avatar: chatData.avatar || '',
          text: chatData.text || '',
          ts: Date.now(),
        }])
      }
    }

    const removeJoin = network.onPeerJoined(handleJoin)
    const removeLeft = network.onPeerLeft(handleLeft)
    const removeMsg = network.onMessage(handleMessage)

    return () => {
      removeJoin()
      removeLeft()
      removeMsg()
    }
  }, [network])

  // ─── Signaling state listener ──────────────────────────────────────────────

  useEffect(() => {
    if (!signalingClient) return

    const cleanup = signalingClient.onStateChange((state, detail) => {
      setSignalingState(state)
      if (detail) setSignalingDetail(detail)

      if (state === 'connected') {
        setPeers([...network.getPeers()])
      }
    })

    return cleanup
  }, [signalingClient, network])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ─── Actions ───────────────────────────────────────────────────────────────

  const handleHostOnline = useCallback(async () => {
    if (!signalingClient) {
      setError('Online multiplayer not available')
      return
    }

    setMode('online-host')
    setError('')

    try {
      await signalingClient.hostRoom(network.localPeer)
    } catch (err: any) {
      if (err.message !== 'Aborted') {
        setError(err.message || 'Failed to create room')
      }
    }
  }, [signalingClient, network])

  const handleJoinOnline = useCallback(async () => {
    if (!signalingClient) {
      setError('Online multiplayer not available')
      return
    }

    const code = roomCodeInput.trim().toUpperCase()
    if (!code || code.length < 4) {
      setError('Please enter a valid room code')
      return
    }

    setMode('online-join')
    setError('')

    try {
      await signalingClient.joinRoom(code, network.localPeer)
    } catch (err: any) {
      if (err.message !== 'Aborted') {
        setError(err.message || 'Failed to join room')
      }
    }
  }, [signalingClient, roomCodeInput, network])

  const handleBack = useCallback(() => {
    signalingClient?.abort()
    setMode('choose')
    setError('')
    setSignalingState('idle')
    setSignalingDetail('')
  }, [signalingClient])

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return

    network.sendMessage({
      type: 'chat',
      name: network.localPeer.name,
      avatar: network.localPeer.avatar,
      text,
    })

    // Add locally
    setChatMessages(prev => [...prev, {
      from: network.localPeer.id,
      name: network.localPeer.name,
      avatar: network.localPeer.avatar,
      text,
      ts: Date.now(),
    }])

    setChatInput('')
  }

  const copyRoomCode = useCallback(() => {
    const code = signalingClient?.roomCode || network.roomId
    if (code) {
      navigator.clipboard?.writeText(code).catch(() => {
        // Clipboard API not available
      })
    }
  }, [signalingClient, network])

  // ─── Connection state indicator ────────────────────────────────────────────

  const getStatusBadge = () => {
    switch (signalingState) {
      case 'creating':
        return { text: 'Creating room...', color: 'text-yellow-400', pulse: true }
      case 'waiting-for-join':
        return { text: 'Waiting for players...', color: 'text-cyan-400', pulse: true }
      case 'joining':
        return { text: 'Finding room...', color: 'text-yellow-400', pulse: true }
      case 'connecting':
        return { text: 'Connecting P2P...', color: 'text-yellow-400', pulse: true }
      case 'connected':
        return { text: 'Connected', color: 'text-green-400', pulse: false }
      case 'timeout':
        return { text: 'Timed out', color: 'text-red-400', pulse: false }
      case 'error':
        return { text: 'Error', color: 'text-red-400', pulse: false }
      default:
        return null
    }
  }

  const isConnected = signalingState === 'connected' || peers.length > 0
  const roomCode = signalingClient?.roomCode || network.roomId

  // ─── Mode Selection Screen ─────────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-center mb-2">
          <h3
            className="text-sm font-bold text-white mb-1"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
          >
            MULTIPLAYER
          </h3>
          <p className="text-xs text-slate-400">Choose how to connect</p>
        </div>

        {/* Online Play */}
        <div className="rounded-xl bg-slate-800/50 border border-purple-500/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🌐</span>
            <div>
              <p className="text-sm font-semibold text-white">Play Online</p>
              <p className="text-[10px] text-slate-400">Connect with anyone over the internet</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleHostOnline}
              disabled={!signalingClient}
              className="touch-btn w-full py-3 rounded-lg bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold text-sm hover:from-purple-500 hover:to-cyan-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}
            >
              Create Room
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="Room code..."
                maxLength={6}
                className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 tracking-widest text-center"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '11px' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinOnline()
                }}
              />
              <button
                onClick={handleJoinOnline}
                disabled={!signalingClient || roomCodeInput.trim().length < 4}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold hover:bg-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Join
              </button>
            </div>
          </div>
        </div>

        {/* Local Play */}
        <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📡</span>
            <div>
              <p className="text-sm font-semibold text-white">Play on Same Network</p>
              <p className="text-[10px] text-slate-400">QR code scan for instant local connection</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setMode('local-host')}
              className="flex-1 touch-btn py-3 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-600 transition-all"
            >
              Host (QR)
            </button>
            <button
              onClick={() => setMode('local-join')}
              className="flex-1 touch-btn py-3 rounded-lg bg-slate-700 text-white font-semibold text-sm hover:bg-slate-600 transition-all"
            >
              Join (Scan)
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {tournamentMatchId && (
          <p className="text-[10px] text-slate-500 text-center">
            Tournament match: {tournamentMatchId.slice(0, 8)}...
          </p>
        )}
      </div>
    )
  }

  // ─── Online Hosting / Joining / Connected View ─────────────────────────────

  const statusBadge = getStatusBadge()

  return (
    <div className="flex flex-col gap-4">
      {/* Back button for non-connected states */}
      {!isConnected && (
        <button
          onClick={handleBack}
          className="self-start text-xs text-slate-400 hover:text-slate-300 transition-colors flex items-center gap-1"
        >
          <span>←</span> Back
        </button>
      )}

      {/* Room info */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Room Code</p>
            <div className="flex items-center gap-2">
              <p
                className="text-lg font-bold text-cyan-400 tracking-widest"
                style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
              >
                {roomCode || '------'}
              </p>
              {roomCode && (
                <button
                  onClick={copyRoomCode}
                  className="text-[10px] px-2 py-1 rounded bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                  title="Copy room code"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {network.isHost && (
              <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-amber-600/20 text-amber-400 rounded-full border border-amber-600/30">
                Host
              </span>
            )}
            {(mode === 'online-host' || mode === 'online-join') && (
              <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-purple-600/20 text-purple-400 rounded-full border border-purple-600/30">
                Online P2P
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {statusBadge && (
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2 h-2 rounded-full ${statusBadge.color.replace('text-', 'bg-')} ${statusBadge.pulse ? 'animate-pulse' : ''}`} />
            <p className={`text-xs ${statusBadge.color}`}>{statusBadge.text}</p>
            {signalingDetail && signalingState === 'error' && (
              <p className="text-[10px] text-red-400/70 ml-1">({signalingDetail})</p>
            )}
          </div>
        )}

        {/* Share instructions for host waiting */}
        {signalingState === 'waiting-for-join' && mode === 'online-host' && (
          <div className="mb-3 p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/30">
            <p className="text-xs text-cyan-300 mb-1 font-semibold">Share this code with your opponent:</p>
            <p className="text-xs text-slate-400">
              They can enter it on their device to join your game. Works from anywhere!
            </p>
          </div>
        )}

        {/* Connected players */}
        <p className="text-xs text-slate-500 mb-2">
          Players ({peers.length + 1})
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Local player */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/50 border border-green-500/30">
            <span className="text-lg">{network.localPeer.avatar}</span>
            <span className="text-sm text-white">{network.localPeer.name}</span>
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
              <span className="text-sm text-white">{peer.name}</span>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-lg bg-red-950/30 border border-red-800/30 p-3">
          <p className="text-xs text-red-400">{error}</p>
          <button
            onClick={handleBack}
            className="text-xs text-red-300 underline mt-1"
          >
            Try again
          </button>
        </div>
      )}

      {/* Start Game button (host only, when at least one peer is connected) */}
      {network.isHost && peers.length > 0 && (
        <button
          onClick={onStartGame}
          className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-base hover:from-emerald-500 hover:to-cyan-500 transition-all"
          style={{
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '12px',
          }}
        >
          START GAME
        </button>
      )}

      {/* Chat */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-700/50">
          <p className="text-xs text-slate-400 font-semibold">Chat</p>
        </div>

        {/* Messages */}
        <div className="h-40 overflow-y-auto px-4 py-2 space-y-2">
          {chatMessages.length === 0 && (
            <p className="text-xs text-slate-600 text-center py-4">
              No messages yet. Say hi!
            </p>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0">{msg.avatar}</span>
              <div>
                <span className="text-xs font-semibold text-purple-400">{msg.name}</span>
                <p className="text-sm text-slate-300">{msg.text}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 p-2 border-t border-slate-700/50">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendChat()
            }}
          />
          <button
            onClick={sendChat}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Tournament info */}
      {tournamentMatchId && (
        <div className="rounded-lg bg-amber-950/20 border border-amber-800/20 p-3">
          <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider">Tournament Match</p>
          <p className="text-xs text-slate-400 mt-1">
            Match ID: {tournamentMatchId.slice(0, 8)}... Results will be recorded automatically.
          </p>
        </div>
      )}
    </div>
  )
}
