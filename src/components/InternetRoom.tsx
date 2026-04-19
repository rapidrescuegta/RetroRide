'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { LocalNetwork, PeerInfo, NetworkMessage } from '@/lib/local-network'

interface InternetRoomProps {
  network: LocalNetwork
  roomCode: string
  onStartGame?: () => void
}

interface ChatMsg {
  from: string
  name: string
  avatar: string
  text: string
  ts: number
}

type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'connecting'

function QualityIndicator({ quality }: { quality: ConnectionQuality }) {
  const bars = quality === 'excellent' ? 3 : quality === 'good' ? 2 : quality === 'poor' ? 1 : 0
  const color = quality === 'excellent'
    ? '#10b981'
    : quality === 'good'
    ? '#06b6d4'
    : quality === 'poor'
    ? '#f59e0b'
    : '#64748b'

  return (
    <div className="flex items-end gap-[2px] h-3" title={`Connection: ${quality}`}>
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className="w-[3px] rounded-sm transition-colors"
          style={{
            height: `${level * 4}px`,
            backgroundColor: level <= bars ? color : '#334155',
          }}
        />
      ))}
    </div>
  )
}

export default function InternetRoom({ network, roomCode, onStartGame }: InternetRoomProps) {
  const [peers, setPeers] = useState<PeerInfo[]>(network.getPeers())
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('good')
  const chatEndRef = useRef<HTMLDivElement>(null)

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

    // Monitor connection quality
    const removeState = network.onConnectionStateChange((state) => {
      if (state === 'connected') setConnectionQuality('good')
      else if (state === 'connecting') setConnectionQuality('connecting')
      else if (state === 'disconnected' || state === 'failed') setConnectionQuality('poor')
    })

    return () => {
      removeJoin()
      removeLeft()
      removeMsg()
      removeState()
    }
  }, [network])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const copyRoomCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(roomCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }, [roomCode])

  const shareRoom = useCallback(async () => {
    const appUrl = window.location.origin
    const shareData = {
      title: 'Join my GameBuddi room!',
      text: `Join my game room with code: ${roomCode}`,
      url: `${appUrl}/local?room=${roomCode}`,
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // User cancelled
      }
    } else {
      await copyRoomCode()
    }
  }, [roomCode, copyRoomCode])

  const sendChat = () => {
    const text = chatInput.trim()
    if (!text) return

    network.sendMessage({
      type: 'chat',
      name: network.localPeer.name,
      avatar: network.localPeer.avatar,
      text,
    })

    setChatMessages(prev => [...prev, {
      from: network.localPeer.id,
      name: network.localPeer.name,
      avatar: network.localPeer.avatar,
      text,
      ts: Date.now(),
    }])

    setChatInput('')
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Room info */}
      <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Room Code</p>
            <p
              className="text-lg font-bold text-cyan-400 tracking-widest"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
            >
              {roomCode}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <QualityIndicator quality={connectionQuality} />
            {network.isHost && (
              <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-amber-600/20 text-amber-400 rounded-full border border-amber-600/30">
                Host
              </span>
            )}
            <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-purple-600/20 text-purple-400 rounded-full border border-purple-600/30">
              Online
            </span>
          </div>
        </div>

        {/* Share buttons */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={copyRoomCode}
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

      {/* Start Game button (host only) */}
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
    </div>
  )
}
