'use client'

import { useState, useCallback, useEffect } from 'react'

const CAPTURE_KEY = 'retroride-email-capture'
const PENDING_EMAIL_KEY = 'retroride-pending-email'

interface CaptureState {
  subscribed: boolean
  dismissedAt: number
  dismissCount: number
}

function getCaptureState(): CaptureState {
  if (typeof window === 'undefined') return { subscribed: false, dismissedAt: 0, dismissCount: 0 }
  try {
    const raw = localStorage.getItem(CAPTURE_KEY)
    return raw ? JSON.parse(raw) : { subscribed: false, dismissedAt: 0, dismissCount: 0 }
  } catch {
    return { subscribed: false, dismissedAt: 0, dismissCount: 0 }
  }
}

function saveCaptureState(state: CaptureState) {
  localStorage.setItem(CAPTURE_KEY, JSON.stringify(state))
}

/** Check if we should show the email capture prompt */
export function shouldShowEmailCapture(): boolean {
  if (typeof window === 'undefined') return false

  const state = getCaptureState()
  if (state.subscribed) return false

  // Already a paid member — never show
  const familySession = localStorage.getItem('retroride-family')
  if (familySession) return false

  // Don't show if there's a pending email waiting for verification
  const pending = localStorage.getItem(PENDING_EMAIL_KEY)
  if (pending) return false

  const scoresRaw = localStorage.getItem('retroride-scores')
  if (!scoresRaw) return false
  const scores = JSON.parse(scoresRaw)
  const totalGames = Object.values(scores).reduce((sum: number, entries: any) => sum + entries.length, 0)

  // First prompt after 3 games, then 5 more per dismiss
  const threshold = 3 + (state.dismissCount * 5)
  return totalGames >= threshold
}

export function markDismissed() {
  const state = getCaptureState()
  state.dismissedAt = Date.now()
  state.dismissCount++
  saveCaptureState(state)
}

export function markSubscribed() {
  const state = getCaptureState()
  state.subscribed = true
  saveCaptureState(state)
  localStorage.removeItem(PENDING_EMAIL_KEY)
}

/** Get pending email that needs verification (saved offline) */
export function getPendingEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(PENDING_EMAIL_KEY)
}

/** Save email locally when offline — will verify later */
function savePendingEmail(email: string) {
  localStorage.setItem(PENDING_EMAIL_KEY, email.toLowerCase().trim())
}

/** Clear pending email */
export function clearPendingEmail() {
  localStorage.removeItem(PENDING_EMAIL_KEY)
}

/** Try to send verification code for a pending email (call when back online) */
export async function sendPendingVerification(): Promise<boolean> {
  const email = getPendingEmail()
  if (!email || !navigator.onLine) return false
  try {
    const res = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Main prompt component (shown in game over overlay)
// ---------------------------------------------------------------------------

export default function EmailCapturePrompt({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<'email' | 'saved-offline' | 'verify' | 'done'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSendCode = useCallback(async () => {
    if (!email.includes('@')) { setError('Enter a valid email'); return }
    setLoading(true)
    setError('')

    // If offline, save locally and show success
    if (!navigator.onLine) {
      savePendingEmail(email)
      setStep('saved-offline')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      savePendingEmail(email)
      setStep('verify')
    } catch {
      // Network failed — save offline
      savePendingEmail(email)
      setStep('saved-offline')
    } finally {
      setLoading(false)
    }
  }, [email])

  const handleVerify = useCallback(async () => {
    if (code.length !== 6) { setError('Enter the 6-digit code'); return }
    setLoading(true)
    setError('')
    try {
      const verifyRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const verifyData = await verifyRes.json()
      if (verifyData.error) { setError(verifyData.error); return }

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      markSubscribed()
      setStep('done')
      setTimeout(onClose, 2000)
    } catch {
      setError('Verification failed')
    } finally {
      setLoading(false)
    }
  }, [email, code, onClose])

  const handleDismiss = () => {
    markDismissed()
    onClose()
  }

  // --- Saved offline confirmation ---
  if (step === 'saved-offline') {
    return (
      <div className="mt-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3 text-center animate-in fade-in duration-300">
        <p className="text-cyan-400 text-sm font-semibold">Got it! 📧</p>
        <p className="text-slate-400 text-xs mt-1">
          We&apos;ll send a verification code to <span className="text-cyan-300">{email}</span> once you&apos;re back online.
        </p>
        <button
          onClick={onClose}
          className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          Sounds good
        </button>
      </div>
    )
  }

  // --- Success ---
  if (step === 'done') {
    return (
      <div className="mt-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 text-center animate-in fade-in duration-300">
        <p className="text-emerald-400 text-sm font-semibold">You&apos;re in! 🎮</p>
        <p className="text-slate-400 text-xs mt-1">We&apos;ll let you know when new games drop.</p>
      </div>
    )
  }

  // --- Verification step ---
  if (step === 'verify') {
    return (
      <div className="mt-4 bg-slate-800/80 border border-purple-500/30 rounded-xl px-4 py-4 space-y-3 animate-in fade-in duration-300">
        <p className="text-xs text-slate-400 text-center">Enter the 6-digit code sent to <span className="text-cyan-400">{email}</span></p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="000000"
            value={code}
            onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
            maxLength={6}
            className="flex-1 bg-slate-900/60 border border-slate-600/40 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-[0.2em] text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-all"
          >
            {loading ? '...' : 'Verify'}
          </button>
        </div>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button onClick={handleDismiss} className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors">
          Maybe later
        </button>
      </div>
    )
  }

  // --- Email input step ---
  return (
    <div className="mt-4 bg-slate-800/80 border border-purple-500/30 rounded-xl px-4 py-4 space-y-3 animate-in fade-in duration-300">
      <div className="text-center">
        <p className="text-sm font-semibold text-purple-300">Never miss a new game</p>
        <p className="text-xs text-slate-400 mt-1">Get notified when we add games + save your high scores.</p>
      </div>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => { setEmail(e.target.value); setError('') }}
          className="flex-1 bg-slate-900/60 border border-slate-600/40 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 transition-all"
        />
        <button
          onClick={handleSendCode}
          disabled={loading || !email.includes('@')}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-40 transition-all whitespace-nowrap"
        >
          {loading ? '...' : 'Get Updates'}
        </button>
      </div>
      <p className="text-[10px] text-slate-500 text-center">
        {navigator.onLine
          ? "We\u2019ll send a quick code to verify. Unsubscribe anytime."
          : "Works offline! We\u2019ll verify your email when you\u2019re back online."
        }
      </p>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      <button onClick={handleDismiss} className="w-full text-xs text-slate-500 hover:text-slate-400 transition-colors">
        No thanks
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pending verification banner (shown on home page when back online)
// ---------------------------------------------------------------------------

export function PendingVerificationBanner() {
  const [email, setEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'sending' | 'verify' | 'done' | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const pending = getPendingEmail()
    if (!pending) return

    // Already subscribed? Clean up
    const state = getCaptureState()
    if (state.subscribed) {
      clearPendingEmail()
      return
    }

    setEmail(pending)

    // If online, auto-send the verification code
    if (navigator.onLine) {
      setStep('sending')
      sendPendingVerification().then(sent => {
        setStep(sent ? 'verify' : null)
      })
    }

    // Listen for coming back online
    const handleOnline = () => {
      setStep('sending')
      sendPendingVerification().then(sent => {
        setStep(sent ? 'verify' : null)
      })
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  const handleVerify = useCallback(async () => {
    if (!email || code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const verifyRes = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const verifyData = await verifyRes.json()
      if (verifyData.error) { setError(verifyData.error); setLoading(false); return }

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      markSubscribed()
      setStep('done')
      setTimeout(() => setStep(null), 2500)
    } catch {
      setError('Verification failed')
    } finally {
      setLoading(false)
    }
  }, [email, code])

  const handleDismiss = () => {
    clearPendingEmail()
    setStep(null)
    setEmail(null)
  }

  if (!email || !step) return null

  if (step === 'sending') {
    return (
      <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-center animate-in fade-in duration-300">
        <p className="text-xs text-purple-300">Sending verification code to {email}...</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-in fade-in duration-300">
        <p className="text-emerald-400 text-sm font-semibold">Verified! You&apos;re subscribed 🎮</p>
      </div>
    )
  }

  // Verify step
  return (
    <div className="mx-4 mb-4 px-4 py-3 rounded-xl bg-slate-800/80 border border-purple-500/30 space-y-2 animate-in fade-in duration-300">
      <p className="text-xs text-slate-400 text-center">
        Check your email — we sent a code to <span className="text-cyan-400">{email}</span>
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="000000"
          value={code}
          onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
          maxLength={6}
          className="flex-1 bg-slate-900/60 border border-slate-600/40 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-[0.2em] text-cyan-400 placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 transition-all"
        />
        <button
          onClick={handleVerify}
          disabled={loading || code.length !== 6}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-all"
        >
          {loading ? '...' : 'Verify'}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      <button onClick={handleDismiss} className="w-full text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
        Dismiss
      </button>
    </div>
  )
}
