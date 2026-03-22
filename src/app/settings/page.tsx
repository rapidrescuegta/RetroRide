'use client'

import { useState, useEffect, useCallback } from 'react'
import { useFamily } from '@/lib/family-context'
import Link from 'next/link'

type RankingFrequency = 'daily' | 'weekly' | 'off'

interface Preferences {
  rankingEmail: RankingFrequency
  challengeEmail: boolean
  newMemberEmail: boolean
}

const DEFAULTS: Preferences = {
  rankingEmail: 'weekly',
  challengeEmail: true,
  newMemberEmail: true,
}

function SavedIndicator({ show }: { show: boolean }) {
  return (
    <div
      className={`fixed top-6 right-6 flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium transition-all duration-300 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
      }`}
    >
      <span className="text-lg">&#10003;</span> Saved
    </div>
  )
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none ${
        enabled
          ? 'bg-purple-600 shadow-lg shadow-purple-600/30'
          : 'bg-slate-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function RadioOption({
  label,
  sublabel,
  selected,
  onSelect,
}: {
  label: string
  sublabel: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all ${
        selected
          ? 'bg-purple-600/20 border border-purple-500/40'
          : 'bg-slate-800/40 border border-transparent hover:bg-slate-800/60'
      }`}
    >
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'border-purple-400' : 'border-slate-600'
        }`}
      >
        {selected && (
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${selected ? 'text-purple-300' : 'text-slate-300'}`}>
          {label}
        </p>
        <p className="text-xs text-slate-500">{sublabel}</p>
      </div>
    </button>
  )
}

export default function SettingsPage() {
  const ctx = useFamily()
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [showSaved, setShowSaved] = useState(false)

  // Fetch preferences on mount
  useEffect(() => {
    if (!ctx?.member?.id) return
    fetch(`/api/notifications/preferences?memberId=${ctx.member.id}`)
      .then(r => r.json())
      .then(data => {
        setPrefs({
          rankingEmail: data.rankingEmail || 'weekly',
          challengeEmail: data.challengeEmail ?? true,
          newMemberEmail: data.newMemberEmail ?? true,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ctx?.member?.id])

  // Save preference to API
  const save = useCallback(
    async (update: Partial<Preferences>) => {
      if (!ctx?.member?.id) return
      const newPrefs = { ...prefs, ...update }
      setPrefs(newPrefs)

      try {
        await fetch('/api/notifications/preferences', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: ctx.member.id, ...update }),
        })
        setShowSaved(true)
        setTimeout(() => setShowSaved(false), 1500)
      } catch {
        // Silently fail — preference will reset on next load
      }
    },
    [ctx?.member?.id, prefs]
  )

  // Not logged in
  if (!ctx?.isLoggedIn) {
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
              Settings
            </h1>
          </div>
        </header>
        <div className="max-w-md mx-auto px-4 text-center py-12">
          <p className="text-slate-400 text-sm mb-4">Upgrade to Family Mode to access settings.</p>
          <Link
            href="/family"
            className="inline-flex px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all"
          >
            Upgrade
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-8 page-enter">
      <SavedIndicator show={showSaved} />

      {/* Header */}
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
            Settings
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            {ctx.member?.avatar} {ctx.member?.name}
          </p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 space-y-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-2xl animate-pulse">&#9881;</div>
            <p className="text-sm text-slate-500 mt-2">Loading preferences...</p>
          </div>
        ) : (
          <>
            {/* Notification Preferences */}
            <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span className="text-purple-400">&#9993;</span> Notifications
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose what emails you want to receive.
                </p>
              </div>

              {/* Ranking Emails */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Ranking Digest Emails
                </h3>
                <div className="space-y-2">
                  <RadioOption
                    label="Daily"
                    sublabel="Get rankings every morning"
                    selected={prefs.rankingEmail === 'daily'}
                    onSelect={() => save({ rankingEmail: 'daily' })}
                  />
                  <RadioOption
                    label="Weekly"
                    sublabel="Get rankings every Monday"
                    selected={prefs.rankingEmail === 'weekly'}
                    onSelect={() => save({ rankingEmail: 'weekly' })}
                  />
                  <RadioOption
                    label="Off"
                    sublabel="No ranking emails"
                    selected={prefs.rankingEmail === 'off'}
                    onSelect={() => save({ rankingEmail: 'off' })}
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-700/50" />

              {/* Challenge Notifications */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-300">Challenge Notifications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When someone challenges you to beat their score
                  </p>
                </div>
                <Toggle
                  enabled={prefs.challengeEmail}
                  onToggle={() => save({ challengeEmail: !prefs.challengeEmail })}
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-slate-700/50" />

              {/* New Member Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-300">New Member Alerts</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When someone new joins your family
                  </p>
                </div>
                <Toggle
                  enabled={prefs.newMemberEmail}
                  onToggle={() => save({ newMemberEmail: !prefs.newMemberEmail })}
                />
              </div>
            </div>

            {/* Back to games */}
            <Link
              href="/"
              className="touch-btn block w-full px-6 py-3 rounded-xl font-semibold text-white text-center bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all"
            >
              Back to Games
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
