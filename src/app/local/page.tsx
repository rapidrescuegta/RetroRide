'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useFamily } from '@/lib/family-context'
import { LocalNetwork, type PeerInfo } from '@/lib/local-network'
import { SignalingClient, type SignalingState } from '@/lib/signaling'
import { NetworkAdapter } from '@/lib/network-adapter'
import QRCode from '@/components/QRCode'
import QRScanner from '@/components/QRScanner'
import LocalRoom from '@/components/LocalRoom'
import InternetRoom from '@/components/InternetRoom'
import MultiplayerGameView from '@/components/MultiplayerGameView'
import { crazyEightsMultiplayer } from '@/games/crazy-eights/crazy-eights-multiplayer'
import { goFishMultiplayer } from '@/games/go-fish/go-fish-multiplayer'
import { heartsMultiplayer } from '@/games/hearts/hearts-multiplayer'
import { spadesMultiplayer } from '@/games/spades/spades-multiplayer'
import { pokerMultiplayer } from '@/games/poker/poker-multiplayer'
import { blackjackMultiplayer } from '@/games/blackjack/blackjack-multiplayer'
import { warMultiplayer } from '@/games/war/war-multiplayer'
import { oldMaidMultiplayer } from '@/games/old-maid/old-maid-multiplayer'
import { ginRummyMultiplayer } from '@/games/gin-rummy/gin-rummy-multiplayer'
import { colorClashMultiplayer } from '@/games/color-clash/color-clash-multiplayer'
import { euchreMultiplayer } from '@/games/euchre/euchre-multiplayer'
import { cribbageMultiplayer } from '@/games/cribbage/cribbage-multiplayer'
import { rummy500Multiplayer } from '@/games/rummy-500/rummy-500-multiplayer'
import type { MultiplayerGameConfig } from '@/lib/multiplayer-game'
import Link from 'next/link'

type PlayMode = 'local' | 'online'
type Tab = 'create' | 'join'
type Phase = 'setup' | 'waiting' | 'scanning' | 'connected' | 'playing'

const MULTIPLAYER_GAMES: { id: string; name: string; icon: string; desc: string; config: MultiplayerGameConfig<any> }[] = [
  { id: 'crazy-eights', name: 'Crazy Eights', icon: '8', desc: '2-6 players - Match suit or rank, 8s are wild!', config: crazyEightsMultiplayer },
  { id: 'go-fish', name: 'Go Fish', icon: '\u{1F41F}', desc: '2-6 players - Collect books of 4 matching cards', config: goFishMultiplayer },
  { id: 'hearts', name: 'Hearts', icon: '\u{2665}\u{FE0F}', desc: '4 players - Avoid hearts and the Queen of Spades', config: heartsMultiplayer },
  { id: 'spades', name: 'Spades', icon: '\u{2660}\u{FE0F}', desc: '4 players - Bid and take tricks with your partner', config: spadesMultiplayer },
  { id: 'poker', name: 'Poker', icon: '\u{1F0CF}', desc: '2-6 players - Texas Hold\'em with betting rounds', config: pokerMultiplayer },
  { id: 'blackjack', name: 'Blackjack', icon: '\u{1F0A1}', desc: '2-6 players - Get 21 without busting', config: blackjackMultiplayer },
  { id: 'gin-rummy', name: 'Gin Rummy', icon: '\u{1F3B4}', desc: '2 players - Meld your hand and knock to win', config: ginRummyMultiplayer },
  { id: 'war', name: 'War', icon: '\u{2694}\u{FE0F}', desc: '2 players - Highest card wins the battle', config: warMultiplayer },
  { id: 'old-maid', name: 'Old Maid', icon: '\u{1F474}', desc: '2-4 players - Don\'t get stuck with the Old Maid!', config: oldMaidMultiplayer },
  { id: 'color-clash', name: 'Color Clash', icon: '\u{1F308}', desc: '2-6 players - Match colors in this fast card game', config: colorClashMultiplayer },
  { id: 'euchre', name: 'Euchre', icon: '\u{1F0A0}', desc: '4 players - Team trick-taking with trump bidding', config: euchreMultiplayer },
  { id: 'cribbage', name: 'Cribbage', icon: '\u{1F3AF}', desc: '2 players - Peg to 121 with card combinations', config: cribbageMultiplayer },
  { id: 'rummy-500', name: 'Rummy 500', icon: '5\u{FE0F}\u{20E3}', desc: '2-4 players - Meld cards and reach 500 points', config: rummy500Multiplayer },
]

function LocalPlayGate() {
  return (
    <div className="min-h-screen pb-8 page-enter">
      <header className="relative px-4 pt-8 pb-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">&larr; Home</Link>
          <h1 className="text-xl font-bold neon-text mt-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}>Multiplayer</h1>
        </div>
      </header>
      <div className="max-w-md mx-auto px-4 text-center space-y-6 pt-8">
        <div className="text-6xl">📡</div>
        <h2 className="text-lg font-semibold text-white">Multiplayer is a Family Mode feature</h2>
        <p className="text-slate-400 text-sm">Play together locally or online with friends and family.</p>
        <ul className="text-sm text-slate-400 space-y-2 text-left max-w-xs mx-auto">
          <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">&#10003;</span><span>Multiplayer card games with real people</span></li>
          <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">&#10003;</span><span>Play online with a room code</span></li>
          <li className="flex items-start gap-2"><span className="text-purple-400 mt-0.5">&#10003;</span><span>Works on planes, trains, and road trips</span></li>
        </ul>
        <Link href="/family" className="touch-btn inline-flex px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105">Upgrade to Family Mode</Link>
        <div><Link href="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">Or play solo for free &rarr;</Link></div>
      </div>
    </div>
  )
}

export default function LocalPlayPage() {
  const familyCtx = useFamily()
  const [playMode, setPlayMode] = useState<PlayMode>('online')
  const [tab, setTab] = useState<Tab>('create')
  const [playerName, setPlayerName] = useState(familyCtx?.member?.name || '')
  const [playerAvatar, setPlayerAvatar] = useState(familyCtx?.member?.avatar || '')
  const networkRef = useRef<LocalNetwork | null>(null)
  const signalingRef = useRef<SignalingClient | null>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [qrData, setQrData] = useState('')
  const [joinerQrData, setJoinerQrData] = useState('')
  const [connectedCount, setConnectedCount] = useState(0)
  const [error, setError] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [showGamePicker, setShowGamePicker] = useState(false)
  const [selectedGame, setSelectedGame] = useState<MultiplayerGameConfig<any> | null>(null)
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [signalingState, setSignalingState] = useState<SignalingState>('idle')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const urlRoom = params.get('room')
      if (urlRoom) { setPlayMode('online'); setTab('join'); setJoinCode(urlRoom.toUpperCase()) }
    }
  }, [])

  const adapter = useMemo(() => {
    if (!networkRef.current) return null
    return new NetworkAdapter(networkRef.current)
  }, [phase])

  const avatars = ['😎', '🎮', '👾', '🤖', '🦊', '🐉', '🚀', '⭐', '🎯', '🔥', '💎', '🌟']

  useEffect(() => {
    if (familyCtx?.member?.name && !playerName) setPlayerName(familyCtx.member.name)
    if (familyCtx?.member?.avatar && !playerAvatar) setPlayerAvatar(familyCtx.member.avatar)
    if (!playerAvatar) setPlayerAvatar(avatars[Math.floor(Math.random() * avatars.length)])
  }, [familyCtx?.member])

  useEffect(() => { return () => { networkRef.current?.close(); signalingRef.current?.cleanup() } }, [])

  const getLocalPeer = (): PeerInfo => ({ id: '', name: playerName || 'Player', avatar: playerAvatar || '😎' })

  const handleCreateRoom = useCallback(async () => {
    setError('')
    try {
      const net = new LocalNetwork('lan')
      networkRef.current = net
      net.onPeerJoined(() => setConnectedCount(net.getPeers().length))
      net.onPeerLeft(() => setConnectedCount(net.getPeers().length))
      const offerData = await net.createRoom(getLocalPeer())
      setQrData(offerData)
      setPhase('waiting')
    } catch (err: any) { setError(err?.message || 'Failed to create room') }
  }, [playerName, playerAvatar])

  const handleScanJoiner = useCallback(() => setShowScanner(true), [])

  const handleJoinerScanned = useCallback(async (data: string) => {
    setShowScanner(false); setError('')
    try {
      const net = networkRef.current
      if (!net) throw new Error('No network')
      await net.acceptJoiner(data)
      setConnectedCount(net.getPeers().length)
      const newOffer = await net.getCurrentOffer()
      if (newOffer) setQrData(newOffer)
      if (net.getPeers().length > 0) setPhase('connected')
    } catch (err: any) { setError(err?.message || 'Failed to accept joiner') }
  }, [])

  const handleStartJoinScan = useCallback(() => setShowScanner(true), [])

  const handleHostScanned = useCallback(async (data: string) => {
    setShowScanner(false); setError('')
    try {
      const net = new LocalNetwork('lan')
      networkRef.current = net
      net.onPeerJoined(() => { setConnectedCount(net.getPeers().length); setPhase('connected') })
      net.onPeerLeft(() => setConnectedCount(net.getPeers().length))
      const answerData = await net.joinRoom(data, getLocalPeer())
      setJoinerQrData(answerData)
      setPhase('scanning')
    } catch (err: any) { setError(err?.message || 'Failed to join room') }
  }, [playerName, playerAvatar])

  const handleCreateOnlineRoom = useCallback(async () => {
    setError('')
    try {
      const net = new LocalNetwork('internet')
      networkRef.current = net
      net.onPeerJoined(() => { setConnectedCount(net.getPeers().length); if (net.getPeers().length > 0) setPhase('connected') })
      net.onPeerLeft(() => setConnectedCount(net.getPeers().length))
      const signaling = new SignalingClient(net)
      signalingRef.current = signaling
      signaling.onStateChange((state, detail) => {
        setSignalingState(state)
        if (state === 'waiting-for-join') { setRoomCode(signaling.roomCode); setPhase('waiting') }
        else if (state === 'connected') setPhase('connected')
        else if (state === 'error') setError(detail || 'Connection error')
        else if (state === 'timeout') setError('Timed out waiting for players. Try again.')
      })
      await signaling.hostRoom(getLocalPeer())
    } catch (err: any) { if (err?.message !== 'Aborted') setError(err?.message || 'Failed to create online room') }
  }, [playerName, playerAvatar])

  const handleJoinOnlineRoom = useCallback(async () => {
    if (!joinCode.trim()) { setError('Enter a room code to join'); return }
    setError(''); setSignalingState('joining')
    try {
      const net = new LocalNetwork('internet')
      networkRef.current = net
      net.onPeerJoined(() => setConnectedCount(net.getPeers().length))
      net.onPeerLeft(() => setConnectedCount(net.getPeers().length))
      const signaling = new SignalingClient(net)
      signalingRef.current = signaling
      signaling.onStateChange((state, detail) => {
        setSignalingState(state)
        if (state === 'connected') { setRoomCode(signaling.roomCode); setPhase('connected') }
        else if (state === 'error') { setError(detail || 'Failed to connect'); setSignalingState('idle') }
      })
      await signaling.joinRoom(joinCode, getLocalPeer())
    } catch (err: any) { if (err?.message !== 'Aborted') { setError(err?.message || 'Failed to join room'); setSignalingState('idle') } }
  }, [joinCode, playerName, playerAvatar])

  const handleStartGame = useCallback(() => setShowGamePicker(true), [])
  const handleSelectGame = useCallback((config: MultiplayerGameConfig<any>) => { setSelectedGame(config); setShowGamePicker(false); setPhase('playing') }, [])
  const handleLeaveGame = useCallback(() => { setSelectedGame(null); setPhase('connected') }, [])

  const handleLeave = useCallback(() => {
    networkRef.current?.close(); networkRef.current = null
    signalingRef.current?.cleanup(); signalingRef.current = null
    setPhase('setup'); setQrData(''); setJoinerQrData(''); setRoomCode(''); setJoinCode(''); setConnectedCount(0); setError(''); setShowScanner(false); setShowGamePicker(false); setSelectedGame(null); setSignalingState('idle')
  }, [])

  if (!familyCtx?.isLoggedIn) return <LocalPlayGate />

  return (
    <div className="min-h-screen pb-8 page-enter">
      <header className="relative px-4 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors text-sm">&larr; Back</Link>
          <h1 className="text-sm font-bold neon-text" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px' }}>Multiplayer</h1>
          <div className="w-12" />
        </div>
      </header>

      <div className="px-4">
        {phase === 'setup' && (<>
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-800/80 border border-slate-700/50 mb-4">
            <button onClick={() => { setPlayMode('online'); setError('') }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${playMode === 'online' ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Online Play
            </button>
            <button onClick={() => { setPlayMode('local'); setError('') }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${playMode === 'local' ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-300'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.858 15.355-5.858 21.213 0" /></svg>
              Local Play
            </button>
          </div>

          {/* Player identity */}
          <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Your Player</p>
            <div className="flex items-center gap-3 mb-3">
              <button className="text-3xl p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-purple-500 transition-colors" onClick={() => { const idx = avatars.indexOf(playerAvatar); setPlayerAvatar(avatars[(idx + 1) % avatars.length]) }}>{playerAvatar || '😎'}</button>
              <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" className="flex-1 px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-purple-500" maxLength={20} />
            </div>
            <div className="flex flex-wrap gap-2">
              {avatars.map(a => (<button key={a} onClick={() => setPlayerAvatar(a)} className={`text-xl p-1.5 rounded-lg transition-all ${playerAvatar === a ? 'bg-purple-600/30 border border-purple-500/50 scale-110' : 'bg-slate-900/50 border border-slate-700/30 hover:border-slate-600'}`}>{a}</button>))}
            </div>
          </div>

          {/* ONLINE MODE */}
          {playMode === 'online' && (<>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTab('create')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${tab === 'create' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>Create Room</button>
              <button onClick={() => setTab('join')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${tab === 'join' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>Join Room</button>
            </div>
            {tab === 'create' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2"><p className="text-sm text-slate-300 mb-1">Host an online game room</p><p className="text-xs text-slate-500">Share the room code with friends anywhere in the world</p></div>
                <button onClick={handleCreateOnlineRoom} disabled={!playerName.trim() || signalingState === 'creating'} className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-bold text-sm hover:from-purple-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' }}>{signalingState === 'creating' ? 'Creating...' : 'Create Online Room'}</button>
              </div>
            )}
            {tab === 'join' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2"><p className="text-sm text-slate-300 mb-1">Join an online room</p><p className="text-xs text-slate-500">Enter the 6-character room code from the host</p></div>
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6))} placeholder="ROOM CODE" className="w-full px-4 py-4 rounded-xl bg-slate-900 border border-slate-700 text-white text-center text-xl tracking-[0.3em] placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono" maxLength={6} autoCapitalize="characters" />
                <button onClick={handleJoinOnlineRoom} disabled={!playerName.trim() || joinCode.length < 6 || signalingState === 'joining' || signalingState === 'connecting'} className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:from-cyan-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)' }}>{signalingState === 'joining' ? 'Finding room...' : signalingState === 'connecting' ? 'Connecting...' : 'Join Room'}</button>
              </div>
            )}
          </>)}

          {/* LOCAL MODE */}
          {playMode === 'local' && (<>
            <div className="flex gap-2 mb-4">
              <button onClick={() => setTab('create')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${tab === 'create' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>Create Room</button>
              <button onClick={() => setTab('join')} className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${tab === 'join' ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}>Join Room</button>
            </div>
            {tab === 'create' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2"><p className="text-sm text-slate-300 mb-1">Host a local game room</p><p className="text-xs text-slate-500">Others will scan your QR code to join</p></div>
                <button onClick={handleCreateRoom} disabled={!playerName.trim()} className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-500 hover:to-pink-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ boxShadow: '0 0 30px rgba(139, 92, 246, 0.3)' }}>Create Room</button>
              </div>
            )}
            {tab === 'join' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-2"><p className="text-sm text-slate-300 mb-1">Join a nearby room</p><p className="text-xs text-slate-500">Scan the host&apos;s QR code to connect</p></div>
                {!showScanner ? (
                  <button onClick={handleStartJoinScan} disabled={!playerName.trim()} className="touch-btn w-full py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-bold text-sm hover:from-cyan-500 hover:to-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed" style={{ boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)' }}>Scan Host&apos;s Code</button>
                ) : (<QRScanner onScan={handleHostScanned} onError={(err) => setError(err)} />)}
              </div>
            )}
          </>)}
        </>)}

        {/* ONLINE: Waiting */}
        {phase === 'waiting' && playMode === 'online' && (
          <div className="flex flex-col items-center gap-6">
            <div className="rounded-xl bg-slate-800/50 border border-purple-500/30 p-6 w-full">
              <p className="text-xs text-slate-500 uppercase tracking-wider text-center mb-2">Share this room code</p>
              <p className="text-2xl font-bold text-center text-cyan-400 tracking-[0.4em]" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '20px' }}>{roomCode}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <p className="text-sm text-purple-300">{signalingState === 'creating' ? 'Setting up room...' : signalingState === 'waiting-for-join' ? 'Waiting for players to join...' : signalingState === 'connecting' ? 'Player connecting...' : 'Waiting...'}</p>
              </div>
              <p className="text-xs text-slate-500">Share the code above with friends &mdash; they can join from anywhere</p>
              {connectedCount > 0 && <p className="text-xs text-emerald-400 mt-2">{connectedCount} player{connectedCount !== 1 ? 's' : ''} connected</p>}
            </div>
            <button onClick={handleLeave} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Cancel Room</button>
          </div>
        )}

        {/* LOCAL: HOST waiting */}
        {phase === 'waiting' && playMode === 'local' && tab === 'create' && (
          <div className="flex flex-col items-center gap-6">
            <QRCode data={qrData} size={220} label="Have players scan this code to join" />
            <div className="text-center"><p className="text-sm text-slate-300">Waiting for players...</p><p className="text-xs text-slate-500 mt-1">{connectedCount} player{connectedCount !== 1 ? 's' : ''} connected</p></div>
            {!showScanner ? (<button onClick={handleScanJoiner} className="touch-btn px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold text-sm hover:from-cyan-500 hover:to-purple-500 transition-all">Scan Player&apos;s Response</button>) : (<QRScanner onScan={handleJoinerScanned} onError={(err) => setError(err)} />)}
            {connectedCount > 0 && (<button onClick={() => setPhase('connected')} className="touch-btn w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-all">Done Adding Players ({connectedCount})</button>)}
            <button onClick={handleLeave} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Cancel Room</button>
          </div>
        )}

        {/* LOCAL: JOINER QR */}
        {phase === 'scanning' && playMode === 'local' && tab === 'join' && (
          <div className="flex flex-col items-center gap-6">
            <QRCode data={joinerQrData} size={220} label="Show this to the host to complete pairing" />
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" /><p className="text-sm text-amber-300">Waiting for host to scan your code...</p></div>
              <p className="text-xs text-slate-500">The host needs to scan this QR code to connect you</p>
            </div>
            <button onClick={handleLeave} className="text-xs text-slate-500 hover:text-red-400 transition-colors">Cancel</button>
          </div>
        )}

        {/* CONNECTED */}
        {phase === 'connected' && networkRef.current && (
          <div className="flex flex-col gap-4">
            {playMode === 'online' ? (<InternetRoom network={networkRef.current} roomCode={roomCode} onStartGame={handleStartGame} />) : (<LocalRoom network={networkRef.current} onStartGame={handleStartGame} />)}
            {showGamePicker && (
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
                <p className="text-sm font-semibold text-white mb-3">Pick a Game</p>
                <div className="space-y-2 mb-3">
                  {MULTIPLAYER_GAMES.map(game => (
                    <button key={game.id} onClick={() => handleSelectGame(game.config)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-900/50 border border-slate-700/50 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left">
                      <span className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-slate-800 border border-slate-700/50">{game.icon}</span>
                      <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-white">{game.name}</p><p className="text-[10px] text-slate-500">{game.desc}</p></div>
                      <span className="text-slate-500 text-xs">&rarr;</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowGamePicker(false)} className="w-full py-2 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600 transition-colors">Cancel</button>
              </div>
            )}
            <button onClick={handleLeave} className="w-full py-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-600/30 transition-all">Leave Room</button>
          </div>
        )}

        {/* PLAYING */}
        {phase === 'playing' && selectedGame && adapter && (
          <div className="fixed inset-0 z-50"><MultiplayerGameView config={selectedGame} adapter={adapter} onLeave={handleLeaveGame} /></div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30">
            <p className="text-xs text-red-400">{error}</p>
            <button onClick={() => setError('')} className="text-xs text-red-500 hover:text-red-400 mt-1">Dismiss</button>
          </div>
        )}

        {/* How it works */}
        {phase === 'setup' && (
          <div className="mt-6 rounded-xl bg-slate-800/30 border border-slate-700/30 p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">How it works</p>
            {playMode === 'online' ? (
              <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
                <li>Create a room to get a 6-character code</li>
                <li>Share the code with friends anywhere</li>
                <li>They enter the code to join your room</li>
                <li>Play together over the internet!</li>
              </ol>
            ) : (
              <ol className="text-xs text-slate-500 space-y-1.5 list-decimal list-inside">
                <li>One device creates a room (becomes the host)</li>
                <li>Others scan the host&apos;s QR code</li>
                <li>Host scans each player&apos;s response code</li>
                <li>Everyone is connected &mdash; play together!</li>
              </ol>
            )}
            <p className="text-[10px] text-slate-600 mt-3">{playMode === 'online' ? 'Uses WebRTC for peer-to-peer connection. Low latency, no game data stored on servers.' : 'Works over WiFi hotspot or local network. No internet required.'}</p>
          </div>
        )}
      </div>
    </div>
  )
}
