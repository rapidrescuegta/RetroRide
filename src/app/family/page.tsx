'use client'

import { useState, useCallback } from 'react'
import { useFamily } from '@/lib/family-context'
import AvatarCreator from '@/components/AvatarCreator'
import Link from 'next/link'

const AVATARS = [
  '😎', '🤩', '😂', '🥳', '😈', '👻', '🤖', '👽', '🦊', '🐶',
  '🐱', '🐼', '🦁', '🐸', '🐵', '🦄', '🐲', '🦋', '🏀', '⚽',
  '🎸', '🎮', '🍕', '🍔', '🌮', '🍩', '🚀', '⭐', '🔥', '💎',
]

function AvatarPicker({ selected, onSelect }: { selected: string; onSelect: (a: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {AVATARS.map(a => (
        <button
          key={a}
          type="button"
          onClick={() => onSelect(a)}
          className={`text-2xl w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
            selected === a
              ? 'bg-purple-600/40 ring-2 ring-purple-400 scale-110 shadow-lg shadow-purple-500/30'
              : 'bg-slate-800/60 hover:bg-slate-700/60 hover:scale-105'
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  )
}

function SuccessCreateScreen({ familyCode }: { familyCode: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(familyCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="text-center space-y-6 py-8">
      <div className="text-6xl mb-4">🎉</div>
      <h2
        className="text-xl font-bold neon-text"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
      >
        Family Created!
      </h2>
      <p className="text-slate-400 text-sm">Share this code with your family so they can join:</p>
      <button
        onClick={handleCopy}
        className="inline-block bg-slate-800/80 border border-purple-500/40 rounded-2xl px-8 py-5 cursor-pointer hover:border-purple-400/60 transition-all group"
      >
        <p
          className="text-3xl font-bold tracking-[0.3em] text-cyan-400 neon-text group-hover:text-cyan-300 transition-colors"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '22px' }}
        >
          {familyCode.slice(0, 4)}-{familyCode.slice(4)}
        </p>
        <p className="text-xs text-slate-500 mt-2">
          {copied ? '✅ Copied!' : 'Tap to copy'}
        </p>
      </button>
      <p className="text-sm text-pink-400">
        Share this code with your family!
      </p>
      <Link
        href="/"
        className="touch-btn inline-flex px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
      >
        🎮 Start Playing
      </Link>
    </div>
  )
}

function SuccessJoinScreen({ familyName, members }: { familyName: string; members: { id: string; name: string; avatar: string }[] }) {
  return (
    <div className="text-center space-y-6 py-8">
      <div className="text-6xl mb-4">🎊</div>
      <h2
        className="text-xl font-bold neon-text"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
      >
        Welcome to {familyName}!
      </h2>
      <div className="space-y-2 max-w-xs mx-auto">
        {members.map(m => (
          <div
            key={m.id}
            className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-3"
          >
            <span className="text-2xl">{m.avatar}</span>
            <span className="text-sm font-medium text-slate-200">{m.name}</span>
          </div>
        ))}
      </div>
      <Link
        href="/"
        className="touch-btn inline-flex px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
      >
        🎮 Start Playing
      </Link>
    </div>
  )
}

function FamilyDashboard() {
  const ctx = useFamily()
  if (!ctx) return null
  const { family, member, members, switchMember, logout } = ctx

  return (
    <div className="space-y-6">
      {/* Family info */}
      <div className="bg-slate-800/40 border border-purple-500/20 rounded-2xl p-5 text-center">
        <h2
          className="text-lg font-bold neon-text mb-1"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '14px' }}
        >
          {family!.name}
        </h2>
        <p className="text-xs text-slate-500 mt-2">
          Code: <span className="text-cyan-400 font-mono tracking-wider">{family!.code.slice(0, 4)}-{family!.code.slice(4)}</span>
        </p>
      </div>

      {/* Members */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">Players</h3>
        {members.map(m => {
          const isActive = m.id === member?.id
          return (
            <div
              key={m.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                isActive
                  ? 'bg-purple-600/20 border border-purple-500/40 shadow-lg shadow-purple-500/10'
                  : 'bg-slate-800/40 border border-transparent'
              }`}
            >
              <span className="text-2xl">{m.avatar}</span>
              <span className="flex-1 text-sm font-medium text-slate-200">{m.name}</span>
              {isActive ? (
                <span className="text-xs text-purple-400 font-semibold px-2 py-1 rounded-full bg-purple-500/10">
                  Playing
                </span>
              ) : (
                <button
                  onClick={() => switchMember(m.id)}
                  className="text-xs text-cyan-400 font-semibold px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors"
                >
                  Switch
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/"
          className="touch-btn w-full px-6 py-3 rounded-xl font-semibold text-white text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all"
        >
          🎮 Back to Games
        </Link>
        <Link
          href="/leaderboard"
          className="touch-btn w-full px-6 py-3 rounded-xl font-semibold text-center text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
        >
          🏆 Leaderboard
        </Link>
        <button
          onClick={logout}
          className="touch-btn w-full px-6 py-3 rounded-xl font-semibold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all"
        >
          Leave Family
        </button>
      </div>
    </div>
  )
}

export default function FamilyPage() {
  const ctx = useFamily()
  const [mode, setMode] = useState<'create' | 'join'>('create')
  const [familyName, setFamilyName] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [avatar, setAvatar] = useState('😎')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [justCreated, setJustCreated] = useState(false)
  const [justJoined, setJustJoined] = useState(false)
  const [avatarMode, setAvatarMode] = useState<'emoji' | 'camera'>('emoji')
  const [showCamera, setShowCamera] = useState(false)
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [emailVerified, setEmailVerified] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)

  const formatCode = (raw: string) => {
    const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)
    if (clean.length > 4) return clean.slice(0, 4) + '-' + clean.slice(4)
    return clean
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(formatCode(e.target.value))
    setError('')
  }

  const handleSendVerification = useCallback(async () => {
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setSendingCode(true)
    setError('')
    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setCodeSent(true)
    } catch {
      setError('Failed to send code')
    } finally {
      setSendingCode(false)
    }
  }, [email])

  const handleVerifyCode = useCallback(async () => {
    if (verificationCode.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setEmailVerified(true)
    } catch {
      setError('Verification failed')
    } finally {
      setLoading(false)
    }
  }, [email, verificationCode])

  const handleCreate = useCallback(async () => {
    if (!ctx || !familyName.trim() || !playerName.trim() || !emailVerified) return
    setLoading(true)
    setError('')
    try {
      await ctx.createFamily(familyName.trim(), playerName.trim(), email.trim(), avatar)
      setJustCreated(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create family')
    } finally {
      setLoading(false)
    }
  }, [ctx, familyName, playerName, email, avatar, emailVerified])

  const handleJoin = useCallback(async () => {
    if (!ctx || !playerName.trim() || !emailVerified || code.replace('-', '').length !== 8) return
    setLoading(true)
    setError('')
    try {
      const rawCode = code.replace('-', '')
      const err = await ctx.joinFamily(rawCode, playerName.trim(), email.trim(), avatar)
      if (err) {
        setError(err)
      } else {
        await ctx.refreshMembers()
        setJustJoined(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join family')
    } finally {
      setLoading(false)
    }
  }, [ctx, playerName, email, code, avatar, emailVerified])

  // If logged in, show appropriate screen
  if (ctx?.isLoggedIn) {
    // Just created a family — show success with code
    if (justCreated && ctx.family?.code) {
      return (
        <div className="min-h-screen pb-8 page-enter">
          <header className="relative px-4 pt-8 pb-4 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
            <div className="relative">
              <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
                &larr; Home
              </Link>
            </div>
          </header>
          <div className="max-w-md mx-auto px-4">
            <SuccessCreateScreen familyCode={ctx.family.code} />
          </div>
        </div>
      )
    }

    // Just joined a family — show welcome
    if (justJoined && ctx.family) {
      return (
        <div className="min-h-screen pb-8 page-enter">
          <header className="relative px-4 pt-8 pb-4 text-center">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
            <div className="relative">
              <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
                &larr; Home
              </Link>
            </div>
          </header>
          <div className="max-w-md mx-auto px-4">
            <SuccessJoinScreen familyName={ctx.family.name} members={ctx.members} />
          </div>
        </div>
      )
    }

    // Already logged in — show dashboard
    return (
      <div className="min-h-screen pb-8 page-enter">
        <header className="relative px-4 pt-8 pb-4 text-center">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
          <div className="relative">
            <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">
              &larr; Home
            </Link>
            <h1
              className="text-xl font-bold neon-text mt-3"
              style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}
            >
              Your Family
            </h1>
          </div>
        </header>
        <div className="max-w-md mx-auto px-4">
          <FamilyDashboard />
        </div>
      </div>
    )
  }

  // Setup form (create or join)
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
            Family Mode
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Compete with your family on leaderboards!
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 space-y-6">
        {/* Mode toggle */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
          <button
            onClick={() => { setMode('create'); setError('') }}
            className={`flex-1 touch-btn py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'create'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Create a Family
          </button>
          <button
            onClick={() => { setMode('join'); setError('') }}
            className={`flex-1 touch-btn py-2.5 rounded-lg text-sm font-semibold transition-all ${
              mode === 'join'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            Join a Family
          </button>
        </div>

        {/* Form */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-5">
          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Family Name
              </label>
              <input
                type="text"
                placeholder="The Smiths"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                maxLength={30}
                className="w-full bg-slate-900/60 border border-slate-600/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
              />
            </div>
          )}

          {mode === 'join' && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Family Code
              </label>
              <input
                type="text"
                placeholder="ABCD-1234"
                value={code}
                onChange={handleCodeChange}
                maxLength={9}
                className="w-full bg-slate-900/60 border border-slate-600/40 rounded-xl px-4 py-3 text-sm text-center text-cyan-400 font-mono tracking-[0.2em] placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                style={{ fontSize: '18px' }}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <input
              type="text"
              placeholder="Player name"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              maxLength={20}
              className="w-full bg-slate-900/60 border border-slate-600/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all"
            />
          </div>

          {/* Email + Verification */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="you@email.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); setCodeSent(false); setEmailVerified(false) }}
                disabled={emailVerified}
                className={`flex-1 bg-slate-900/60 border rounded-xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none transition-all ${
                  emailVerified
                    ? 'border-emerald-500/40 text-emerald-400'
                    : 'border-slate-600/40 text-slate-200 focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30'
                }`}
              />
              {!emailVerified && (
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={sendingCode || !email.includes('@')}
                  className="px-4 py-3 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-all whitespace-nowrap"
                >
                  {sendingCode ? '...' : codeSent ? 'Resend' : 'Send Code'}
                </button>
              )}
              {emailVerified && (
                <span className="flex items-center text-emerald-400 text-lg px-2">✓</span>
              )}
            </div>

            {codeSent && !emailVerified && (
              <div className="mt-3">
                <p className="text-xs text-slate-400 mb-2">Enter the 6-digit code sent to your email:</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="000000"
                    value={verificationCode}
                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="flex-1 bg-slate-900/60 border border-slate-600/40 rounded-xl px-4 py-3 text-center text-lg font-mono tracking-[0.3em] text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyCode}
                    disabled={loading || verificationCode.length !== 6}
                    className="px-4 py-3 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-all"
                  >
                    Verify
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Your Avatar
            </label>

            {/* Avatar mode toggle */}
            <div className="flex bg-slate-900/60 rounded-xl p-1 gap-1 mb-4">
              <button
                type="button"
                onClick={() => setAvatarMode('emoji')}
                className={`flex-1 touch-btn py-2 rounded-lg text-xs font-semibold transition-all ${
                  avatarMode === 'emoji'
                    ? 'bg-purple-600/40 text-purple-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                😎 Pick Emoji
              </button>
              <button
                type="button"
                onClick={() => setAvatarMode('camera')}
                className={`flex-1 touch-btn py-2 rounded-lg text-xs font-semibold transition-all ${
                  avatarMode === 'camera'
                    ? 'bg-cyan-600/40 text-cyan-300'
                    : 'text-slate-500 hover:text-slate-400'
                }`}
              >
                📸 Take Photo
              </button>
            </div>

            {avatarMode === 'emoji' && (
              <AvatarPicker selected={avatar} onSelect={setAvatar} />
            )}

            {avatarMode === 'camera' && !showCamera && (
              <div className="text-center py-6">
                {avatar.startsWith('data:') ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={avatar}
                      alt="Your avatar"
                      className="w-24 h-24 rounded-full border-2 border-cyan-500/50 shadow-lg shadow-cyan-500/20"
                    />
                    <p className="text-xs text-emerald-400 font-medium">Photo avatar set!</p>
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 underline transition-colors"
                    >
                      Retake photo
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="touch-btn px-6 py-4 rounded-xl bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-600/30 transition-all flex flex-col items-center gap-2 mx-auto"
                  >
                    <span className="text-3xl">📷</span>
                    <span className="text-sm text-cyan-400 font-medium">Open Camera</span>
                    <span className="text-xs text-slate-500">Take a selfie and turn it into a cartoon!</span>
                  </button>
                )}
              </div>
            )}

            {avatarMode === 'camera' && showCamera && (
              <AvatarCreator
                onAvatarSaved={(dataUrl) => {
                  setAvatar(dataUrl)
                  setShowCamera(false)
                }}
                onCancel={() => setShowCamera(false)}
              />
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit */}
          {mode === 'create' ? (
            <button
              onClick={handleCreate}
              disabled={loading || !familyName.trim() || !playerName.trim() || !emailVerified}
              className="touch-btn w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:hover:from-purple-600 disabled:hover:to-pink-600 shadow-lg shadow-purple-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Creating...
                </span>
              ) : (
                'Create Family'
              )}
            </button>
          ) : (
            <button
              onClick={handleJoin}
              disabled={loading || !playerName.trim() || !emailVerified || code.replace('-', '').length !== 8}
              className="touch-btn w-full py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:hover:from-cyan-600 disabled:hover:to-blue-600 shadow-lg shadow-cyan-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="animate-spin">⏳</span> Joining...
                </span>
              ) : (
                'Join Family'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
