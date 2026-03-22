'use client'

import { useState, useRef, useEffect } from 'react'
import type { LocalNetwork, PeerInfo, NetworkMessage } from '@/lib/local-network'

interface LocalRoomProps {
  network: LocalNetwork
  onStartGame?: () => void
}

interface ChatMsg {
  from: string
  name: string
  avatar: string
  text: string
  ts: number
}

export default function LocalRoom({ network, onStartGame }: LocalRoomProps) {
  const [peers, setPeers] = useState<PeerInfo[]>(network.getPeers())
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
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

    network.onPeerJoined(handleJoin)
    network.onPeerLeft(handleLeft)
    network.onMessage(handleMessage)

    return () => {
      // Handlers are stored in arrays, no easy removal — acceptable for this component lifecycle
    }
  }, [network])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

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
              {network.roomId}
            </p>
          </div>
          {network.isHost && (
            <span className="px-2 py-1 text-[10px] font-semibold uppercase bg-amber-600/20 text-amber-400 rounded-full border border-amber-600/30">
              Host
            </span>
          )}
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
    </div>
  )
}
