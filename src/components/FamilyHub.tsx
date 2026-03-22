'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useFamily } from '@/lib/family-context'
import { GAMES } from '@/lib/games'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMember {
  id: string
  name: string
  avatar: string
}

interface ChatMsg {
  id: string
  familyId: string
  memberId: string
  text: string
  type: string
  createdAt: string
  member: ChatMember
}

interface ChallengeData {
  from: string
  to: string
  gameId: string
  status: 'pending' | 'accepted' | 'declined'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function parseChallengeText(text: string): ChallengeData | null {
  try {
    const data = JSON.parse(text)
    if (data.from && data.to && data.gameId && data.status) return data as ChallengeData
    return null
  } catch {
    return null
  }
}

function getGameInfo(gameId: string) {
  return GAMES.find((g) => g.id === gameId)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OnlineBar({
  online,
  offline,
  currentMemberId,
  onChallenge,
}: {
  online: ChatMember[]
  offline: ChatMember[]
  currentMemberId: string | undefined
  onChallenge: (toMemberId: string, gameId: string) => void
}) {
  const [challengeTarget, setChallengeTarget] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 overflow-x-auto scrollbar-hide">
      {online.map((m) => (
        <div key={m.id} className="relative flex-shrink-0">
          <button
            onClick={() =>
              m.id !== currentMemberId
                ? setChallengeTarget(challengeTarget === m.id ? null : m.id)
                : undefined
            }
            className="flex flex-col items-center gap-1 group"
            title={m.name}
          >
            <span className="text-2xl relative">
              {m.avatar}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-slate-900 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
            </span>
            <span className="text-[10px] text-slate-300 max-w-[48px] truncate">
              {m.id === currentMemberId ? 'You' : m.name}
            </span>
          </button>

          {/* Challenge picker dropdown */}
          {challengeTarget === m.id && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 w-44 bg-slate-800 border border-purple-500/40 rounded-xl shadow-2xl shadow-purple-500/10 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <p className="text-[10px] text-slate-400 px-3 pb-1 uppercase tracking-wider">
                Challenge {m.name}
              </p>
              {GAMES.slice(0, 8).map((game) => (
                <button
                  key={game.id}
                  onClick={() => {
                    onChallenge(m.id, game.id)
                    setChallengeTarget(null)
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-purple-500/20 flex items-center gap-2 transition-colors"
                >
                  <span>{game.icon}</span>
                  <span className="text-slate-200">{game.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ))}

      {offline.map((m) => (
        <div key={m.id} className="flex flex-col items-center gap-1 flex-shrink-0 opacity-40">
          <span className="text-2xl grayscale">{m.avatar}</span>
          <span className="text-[10px] text-slate-500 max-w-[48px] truncate">{m.name}</span>
        </div>
      ))}

      {online.length === 0 && offline.length === 0 && (
        <p className="text-xs text-slate-500 italic">No family members yet</p>
      )}
    </div>
  )
}

function MessageBubble({
  msg,
  isOwn,
  allMembers,
  currentMemberId,
  onChallengeRespond,
}: {
  msg: ChatMsg
  isOwn: boolean
  allMembers: ChatMember[]
  currentMemberId: string | undefined
  onChallengeRespond: (messageId: string, status: 'accepted' | 'declined') => void
}) {
  if (msg.type === 'challenge') {
    const data = parseChallengeText(msg.text)
    if (!data) return null
    const game = getGameInfo(data.gameId)
    const fromMember = allMembers.find((m) => m.id === data.from)
    const toMember = allMembers.find((m) => m.id === data.to)
    const isForMe = data.to === currentMemberId
    const isPending = data.status === 'pending'

    return (
      <div className="flex justify-center my-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div
          className="rounded-xl px-4 py-3 max-w-[280px] w-full border bg-slate-800/80 backdrop-blur"
          style={{
            borderColor: game?.color ? `${game.color}66` : 'rgba(168,85,247,0.4)',
            boxShadow: game?.color
              ? `0 0 16px ${game.color}22`
              : '0 0 16px rgba(168,85,247,0.1)',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">{game?.icon || '🎮'}</span>
            <div>
              <p className="text-sm font-semibold text-white">{game?.name || 'Game'} Challenge!</p>
              <p className="text-[11px] text-slate-400">
                {fromMember?.name || 'Someone'} vs {toMember?.name || 'Someone'}
              </p>
            </div>
          </div>

          {isPending && isForMe ? (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onChallengeRespond(msg.id, 'accepted')}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onChallengeRespond(msg.id, 'declined')}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors"
              >
                Decline
              </button>
            </div>
          ) : (
            <p
              className={`text-xs font-medium mt-1 ${
                data.status === 'accepted'
                  ? 'text-green-400'
                  : data.status === 'declined'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }`}
            >
              {data.status === 'pending'
                ? 'Waiting for response...'
                : data.status === 'accepted'
                  ? 'Challenge accepted!'
                  : 'Challenge declined'}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (msg.type === 'result') {
    return (
      <div className="flex justify-center my-2 animate-in fade-in duration-300">
        <div className="rounded-xl px-4 py-2.5 bg-yellow-500/10 border border-yellow-500/30 max-w-[260px]">
          <p className="text-sm text-yellow-300 text-center">{msg.text}</p>
        </div>
      </div>
    )
  }

  // Regular message
  return (
    <div
      className={`flex gap-2 my-1 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
        isOwn ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {!isOwn && <span className="text-lg flex-shrink-0 mt-1">{msg.member.avatar}</span>}
      <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isOwn && (
          <span className="text-[10px] text-slate-500 mb-0.5 px-1">{msg.member.name}</span>
        )}
        <div
          className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
            isOwn
              ? 'bg-purple-600/60 text-white rounded-br-md'
              : 'bg-slate-700/70 text-slate-200 rounded-bl-md'
          }`}
        >
          {msg.text}
        </div>
        <span className="text-[9px] text-slate-600 mt-0.5 px-1">{timeAgo(msg.createdAt)}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FamilyHub() {
  const ctx = useFamily()
  const family = ctx?.family ?? null
  const member = ctx?.member ?? null
  const setOnlineMembers = ctx?.setOnlineMembers

  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [online, setOnline] = useState<ChatMember[]>([])
  const [offline, setOffline] = useState<ChatMember[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const lastSeenRef = useRef<string | null>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Track if user is near the bottom (for auto-scroll)
  const isNearBottom = useCallback(() => {
    const el = chatContainerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  const scrollToBottom = useCallback((force = false) => {
    if (force || isNearBottom()) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isNearBottom])

  // ---------- Presence polling ----------
  useEffect(() => {
    if (!member) return

    const ping = async () => {
      try {
        const res = await fetch('/api/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: member.id }),
        })
        if (res.ok) {
          const data = await res.json()
          setOnline(data.onlineMembers || [])
          setOffline(data.offlineMembers || [])
          setOnlineMembers?.(data.onlineMembers || [])
        }
      } catch {
        // silently retry next interval
      }
    }

    ping()
    const interval = setInterval(ping, 5000)
    return () => clearInterval(interval)
  }, [member, setOnlineMembers])

  // ---------- Chat polling ----------
  useEffect(() => {
    if (!family) return

    const poll = async () => {
      try {
        const params = new URLSearchParams({ familyId: family.id })
        if (lastSeenRef.current) params.set('since', lastSeenRef.current)

        const res = await fetch(`/api/chat?${params}`)
        if (res.ok) {
          const data = await res.json()
          const newMsgs: ChatMsg[] = data.messages || []

          if (newMsgs.length > 0) {
            if (lastSeenRef.current) {
              // Append only genuinely new messages
              setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id))
                const fresh = newMsgs.filter((m) => !existingIds.has(m.id))
                return fresh.length ? [...prev, ...fresh] : prev
              })
            } else {
              setMessages(newMsgs)
            }
            lastSeenRef.current = newMsgs[newMsgs.length - 1].createdAt
            setTimeout(() => scrollToBottom(), 50)
          }
        }
      } catch {
        // retry on next tick
      } finally {
        setLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [family, scrollToBottom])

  // ---------- Send message ----------
  const sendMessage = useCallback(async () => {
    if (!family || !member || !input.trim() || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId: family.id, memberId: member.id, text }),
      })
      if (res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
        lastSeenRef.current = data.message.createdAt
        setTimeout(() => scrollToBottom(true), 50)
      }
    } catch {
      // restore text on failure
      setInput(text)
    } finally {
      setSending(false)
    }
  }, [family, member, input, sending, scrollToBottom])

  // ---------- Send challenge ----------
  const sendChallenge = useCallback(
    async (toMemberId: string, gameId: string) => {
      if (!family || !member) return
      try {
        const res = await fetch('/api/challenge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familyId: family.id,
            fromMemberId: member.id,
            toMemberId,
            gameId,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.message.id)) return prev
            return [...prev, data.message]
          })
          lastSeenRef.current = data.message.createdAt
          setTimeout(() => scrollToBottom(true), 50)
        }
      } catch {
        // ignore
      }
    },
    [family, member, scrollToBottom]
  )

  // ---------- Respond to challenge ----------
  const respondToChallenge = useCallback(
    async (messageId: string, status: 'accepted' | 'declined') => {
      try {
        const res = await fetch('/api/challenge', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId, status }),
        })
        if (res.ok) {
          const data = await res.json()
          setMessages((prev) => prev.map((m) => (m.id === data.message.id ? data.message : m)))
        }
      } catch {
        // ignore
      }
    },
    []
  )

  // ---------- Build the "all members" list for display ----------
  const allMembers: ChatMember[] = [
    ...online,
    ...offline.filter((o) => !online.some((on) => on.id === o.id)),
  ]

  // ---------- Not logged in ----------
  if (!family || !member) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur p-6 text-center">
        <p className="text-slate-400 text-sm">Join or create a family to start chatting!</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur flex flex-col overflow-hidden max-h-[520px]">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white tracking-wide">
          Family Hub
        </h3>
        <span className="text-[10px] text-slate-500">
          {online.length} online
        </span>
      </div>

      {/* Online members bar */}
      <OnlineBar
        online={online}
        offline={offline}
        currentMemberId={member.id}
        onChallenge={sendChallenge}
      />

      {/* Chat area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-[160px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <span className="text-3xl">💬</span>
            <p className="text-xs text-slate-500">No messages yet. Say hi!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.memberId === member.id}
              allMembers={allMembers}
              currentMemberId={member.id}
              onChallengeRespond={respondToChallenge}
            />
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          sendMessage()
        }}
        className="border-t border-white/10 px-3 py-2.5 flex gap-2 items-center"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-slate-800/60 text-sm text-white placeholder:text-slate-500 rounded-xl px-3 py-2 border border-white/10 focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/20 transition-colors"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </form>
    </div>
  )
}
