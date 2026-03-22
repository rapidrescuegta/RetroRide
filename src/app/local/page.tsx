'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useFamily } from '@/lib/family-context'
import { LocalNetwork, type PeerInfo } from '@/lib/local-network'
import QRCode from '@/components/QRCode'
import QRScanner from '@/components/QRScanner'
import LocalRoom from '@/components/LocalRoom'
import Link from 'next/link'

type Tab = 'create' | 'join'
type Phase = 'setup' | 'waiting' | 'scanning' | 'connected'

function LocalPlayGate() {
  return (
    <div className="min-h-screen pb-8 page-enter">
      <header className="relative px-4 pt-8 pb-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
            &larr; Home
          </Link>
          <h1
            className="text-xl font-bold neon-text mt-3"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
          >
            Local Play
          </h1>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4 text-center space-y-6 pt-8">
        <div className="text-6xl">📡</div>
        <h2 className="text-lg font-semibold text-white">Local Play is a Family Mode feature</h2>
        <p className="text-slate-400 text-sm">
          Play together on a local hotspot — no internet needed.
        </p>
        <ul className="text-sm text-slate-400 space-y-2 text-left max-w-xs mx-auto">
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#10003;</span>
            <span>Multiplayer card games with real people</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#10003;</span>
            <span>Chat and challenges between players</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-0.5">&#10003;</span>
            <span>Works on planes, trains, and road trips</span>
          </li>
        </ul>
        <Link
          href="/family"
          className="touch-btn inline-flex px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
        >
          Upgrade to Family Mode
        </Link>
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
            Or play solo for free &rarr;
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LocalPlayPage() {
  const familyCtx = useFamily()
  const [tab, setTab] = useState<Tab>('create')

  // Player info
  const [playerName, setPlayerName] = useState(familyCtx?.member?.name || '')
  const [playerAvatar, setPlayerAvatar] = useState(familyCtx?.member?.avatar || '')

  // Network
  const networkRef = useRef<LocalNetwork | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [qrData, setQrData] = useState('')
  const [joinerQrData, setJoinerQrData] = useState('')
  const [connectedCount, setConnectedCount] = useState(0)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showGamePicker, setShowGamePicker] = useState(false)

  // Available avatars for quick pick
  const avatars = ['😎', '🎮', '👾', '🤖', '🦊', '🐉', '🚀', '⭐', '🎯', '🔥', '💎', '🌟']

  // Set defaults from family context
  useEffect(() => {
    if (familyCtx?.member?.name && !playerName) {
      setPlayerName(familyCtx.member.name)
    }
    if (familyCtx?.member?.avatar && !playerAvatar) {
      setPlayerAvatar(familyCtx.member.avatar)
    }
    if (!playerAvatar) {
      setPlayerAvatar(avatars[Math.floor(Math.random() * avatars.length)])
    }
  }, [familyCtx?.member])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      networkRef.current?.close()
    }
  }, [])

  const getLocalPeer = (): PeerInfo => ({
    id: '',
    name: playerName || 'Player',
    avatar: playerAvatar || '😎',
  })

  // --- HOST FLOW ---
  const handleCreateRoom = useCallback(async () => {
    setError('')
    try {
      const net = new LocalNetwork()
      networkRef.current = net

      net.onPeerJoined(() => {
        setConnectedCount(net.getPeers().length)
      })
      net.onPeerLeft(() => {
        setConnectedCount(net.getPeers().length)
      })

      const offerData = await net.createRoom(getLocalPeer())
      setQrData(offerData)
      setPhase('waiting')
    } catch (err: any) {
      setError(err?.message || 'Failed to create room')
    }
  }, [playerName, playerAvatar])

  const handleScanJoiner = useCallback(() => {
    setShowScanner(true)
  }, [])

  const handleJoinerScanned = useCallback(async (data: string) => {
    setShowScanner(false)
    setError('')
    try {
      const net = networkRef.current
      if (!net) throw new Error('No network')

      await net.acceptJoiner(data)
      setConnectedCount(net.getPeers().length)

      // Update QR for next joiner
      const newOffer = await net.getCurrentOffer()
      if (newOffer) setQrData(newOffer)

      if (net.getPeers().length > 0) {
        setPhase('connected')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to accept joiner')
    }
  }, [])

  // --- JOINER FLOW ---
  const handleStartJoinScan = useCallback(() => {
    setShowScanner(true)
  }, [])

  const handleHostScanned = useCallback(async (data: string) => {
    setShowScanner(false)
    setError('')
    try {
      const net = new LocalNetwork()
      networkRef.current = net

      net.onPeerJoined(() => {
        setConnectedCount(net.getPeers().length)
        setPhase('connected')
      })
      net.onPeerLeft(() => {
        setConnectedCount(net.getPeers().length)
      })

      const answerData = await net.joinRoom(data, getLocalPeer())
      setJoinerQrData(answerData)
      setPhase('scanning') // Show our QR for host to scan
    } catch (err: any) {
      setError(err?.message || 'Failed to join room')
    }
  }, [playerName, playerAvatar])

  const handleStartGame = useCallback(() => {
    setShowGamePicker(true)
  }, [])

  const handleLeave = useCallback(() => {
    networkRef.current?.close()
    networkRef.current = null
    setPhase('setup')
    setQrData('')
    setJoinerQrData('')
    setConnectedCount(0)
    setError('')
    setShowScanner(false)
    setShowGamePicker(false)
  }, [])

  if (!familyCtx?.isLoggedIn) {
    return <LocalPlayGate />
  }

  return (
    <div className="min-h-screen pb-8 page-enter">
      {/* Header */}
      <header className="relative px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            &larr; Back
          </Link>
          <h1
            className="text-sm font-bold neon-text"
            style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px' }}
          >
            Local Play
          </h1>
          <div className="w-12" />
        </div>
        <p className="text-center text-xs text-slate-500 mt-2">
          Play with nearby friends — no internet needed
        </p>
      </header>

      <div className="px-4">
        {/* Player setup (only in setup phase) */}
        {phase === 'setup' && (
          <>
            {/* Player identity */}
            <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Your Player</p>

              <div className="flex items-center gap-3 mb-3">
                <button
                  className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-purple-500 transition-colors"
                  onClick={() => {
                    const idx = avatars.indexOf(playerAvatar)
                    setPlayerAvatar(avatars[(idx + 1) % avatars.length])
                  }}
                >
                  {playerAvatar || '😎'}
                </button>
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  maxLength={20}
                />
              </div>

              {/* Avatar picker */}
              <div className="flex flex-wrap gap-2">
                {avatars.map(a => (
                  <button
                    key={a}
                    onClick={() => setPlayerAvatar(a)}
                    className={`text-xl p-1.5 rounded-lg transition-all ${
                      playerAvatar === a
                        ? 'bg-purple-600/30 border border-purple-500/50 scale-110'
                        : 'bg-slate-900/50 border border-slate-700/30 hover:border-slate-600'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab('create')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  tab === 'create'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                Create Room
              </button>
              <button
                onClick={() => setTab('join')}
                className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
                  tab === 'join'
                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                }`}
              >
                Join Room
              </button>
            </div>

            {/* Create Room tab */}
            {tab === 'create' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-slate-300 mb-1">Host a local game room</p>
                  <p className="text-xs text-slate-500">
                    Others will scan your QR code to join
                  </p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  disabled={!playerName.trim()}
                  className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)',
                  }}
                >
                  Create Room
                </button>
              </div>
            )}

            {/* Join Room tab */}
            {tab === 'join' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2">
                  <p className="text-sm text-slate-300 mb-1">Join a nearby room</p>
                  <p className="text-xs text-slate-500">
                    Scan the host&apos;s QR code to connect
                  </p>
                </div>

                {!showScanner ? (
                  <button
                    onClick={handleStartJoinScan}
                    disabled={!playerName.trim()}
                    className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:from-cyan-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    Scan Host&apos;s Code
                  </button>
                ) : (
                  <QRScanner
                    onScan={handleHostScanned}
                    onError={(err) => setError(err)}
                  />
                )}
              </div>
            )}
          </>
        )}

        {/* HOST: Waiting for players */}
        {phase === 'waiting' && tab === 'create' && (
          <div className="flex flex-col items-center gap-6">
            <QRCode
              data={qrData}
              size={220}
              label="Have players scan this code to join"
            />

            <div className="text-center">
              <p className="text-sm text-slate-300">
                Waiting for players...
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {connectedCount} player{connectedCount !== 1 ? 's' : ''} connected
              </p>
            </div>

            {/* Scan joiner button */}
            {!showScanner ? (
              <button
                onClick={handleScanJoiner}
                className="touch-btn px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold text-sm hover:from-cyan-500 hover:to-purple-500 transition-all"
              >
                Scan Player&apos;s Response
              </button>
            ) : (
              <QRScanner
                onScan={handleJoinerScanned}
                onError={(err) => setError(err)}
              />
            )}

            {connectedCount > 0 && (
              <button
                onClick={() => setPhase('connected')}
                className="touch-btn w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all"
              >
                Done Adding Players ({connectedCount})
              </button>
            )}

            <button
              onClick={handleLeave}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Cancel Room
            </button>
          </div>
        )}

        {/* JOINER: Show our QR for host to scan */}
        {phase === 'scanning' && tab === 'join' && (
          <div className="flex flex-col items-center gap-6">
            <QRCode
              data={joinerQrData}
              size={220}
              label="Show this to the host to complete pairing"
            />

            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <p className="text-sm text-amber-300">
                  Waiting for host to scan your code...
                </p>
              </div>
              <p className="text-xs text-slate-500">
                The host needs to scan this QR code to connect you
              </p>
            </div>

            <button
              onClick={handleLeave}
              className="text-xs text-slate-500 hover:text-red-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* CONNECTED: Show room */}
        {phase === 'connected' && networkRef.current && (
          <div className="flex flex-col gap-4">
            <LocalRoom
              network={networkRef.current}
              onStartGame={handleStartGame}
            />

            {/* Game picker modal */}
            {showGamePicker && (
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
                <p className="text-sm font-semibold text-white mb-3">Pick a Game</p>
                <p className="text-xs text-slate-500 mb-3">
                  Multiplayer games coming soon! For now, use chat to coordinate.
                </p>
                <button
                  onClick={() => setShowGamePicker(false)}
                  className="w-full py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            <button
              onClick={handleLeave}
              className="w-full py-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/30 transition-all"
            >
              Leave Room
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-xs text-red-500 hover:text-red-400 mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* How it works */}
        {phase === 'setup' && (
          <div className="mt-6 rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">How it works</p>
            <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
              <li>One device creates a room (becomes the host)</li>
              <li>Others scan the host&apos;s QR code</li>
              <li>Host scans each player&apos;s response code</li>
              <li>Everyone is connected — play together!</li>
            </ol>
            <p className="text-[10px] text-slate-600 mt-3">
              Works over WiFi hotspot or local network. No internet required.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
