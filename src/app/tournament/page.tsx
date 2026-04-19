'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useFamily } from '@/lib/family-context'
import { GAMES } from '@/lib/games'
import {
  type Tournament,
  fetchTournaments,
  createTournamentAPI,
  deleteTournamentAPI,
} from '@/lib/tournament-store'

// ─── Constants ──────────────────────────────────────────────────────────────

const TOURNAMENT_GAMES = GAMES.filter(g =>
  ['crazy-eights', 'go-fish', 'hearts', 'spades', 'war', 'blackjack', 'old-maid', 'poker', 'color-clash',
   'tic-tac-toe', 'connect-four', 'checkers', 'chess', 'memory-match'].includes(g.id)
)

type TournamentFormat = 'round-robin' | 'elimination' | 'best-of'

const PRESETS = [
  {
    id: 'weekend',
    name: 'Weekend Challenge',
    icon: '\u{1F3C6}',
    description: 'Family tournament \u2014 Fri to Sun!',
    color: '#f59e0b',
    format: 'round-robin' as TournamentFormat,
    maxPlayers: 8,
    defaultName: 'Weekend Showdown',
  },
  {
    id: 'plane',
    name: 'Plane Ride',
    icon: '\u{2708}\u{FE0F}',
    description: 'Quick best-of-3 \u2014 perfect for travel!',
    color: '#06b6d4',
    format: 'best-of' as TournamentFormat,
    maxPlayers: 4,
    defaultName: 'Sky High Challenge',
  },
  {
    id: 'bracket',
    name: 'Elimination',
    icon: '\u{1F525}',
    description: 'Single elimination \u2014 winner takes all!',
    color: '#ef4444',
    format: 'elimination' as TournamentFormat,
    maxPlayers: 8,
    defaultName: 'Bracket Brawl',
  },
]

// ─── Create Form ────────────────────────────────────────────────────────────

function CreateTournamentForm({
  onCreated,
  onCancel,
  initialPreset,
}: {
  onCreated: () => void
  onCancel: () => void
  initialPreset?: typeof PRESETS[0]
}) {
  const ctx = useFamily()
  const [name, setName] = useState(initialPreset?.defaultName || '')
  const [gameId, setGameId] = useState(TOURNAMENT_GAMES[0]?.id || 'crazy-eights')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    setError('')

    try {
      const memberId = ctx?.member?.id || 'local-player'
      const familyId = ctx?.family?.id || 'local'
      await createTournamentAPI(name.trim(), familyId, [gameId], memberId)
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700/50 rounded-2xl p-5 space-y-4">
      <h3 className="text-white font-bold text-lg">Create Tournament</h3>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tournament Name</label>
        <input type="text" placeholder="Weekend Showdown" value={name} onChange={e => setName(e.target.value)} maxLength={40}
          className="w-full bg-slate-900/60 border border-slate-600/40 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Game</label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
          {TOURNAMENT_GAMES.map(g => (
            <button key={g.id} onClick={() => setGameId(g.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                gameId === g.id ? 'bg-purple-500/20 ring-1 ring-purple-400/50 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
              }`}>
              <span>{g.icon}</span>
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={handleCreate} disabled={!name.trim() || creating}
          className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 shadow-lg shadow-purple-600/30 transition-all">
          {creating ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Creating...
            </span>
          ) : (
            'Create Tournament'
          )}
        </button>
        <button onClick={onCancel}
          className="px-6 py-3 rounded-xl font-semibold text-slate-400 bg-slate-800/50 hover:bg-slate-700/50 transition-all">Cancel</button>
      </div>
    </div>
  )
}

// ─── Tournament Card ────────────────────────────────────────────────────────

function TournamentCard({ tournament, onDelete }: { tournament: Tournament; onDelete: () => void }) {
  const gameId = tournament.gameIds?.[0]
  const game = gameId ? GAMES.find(g => g.id === gameId) : null
  const statusColors: Record<string, string> = { pending: '#f59e0b', active: '#22c55e', completed: '#64748b' }
  const sc = statusColors[tournament.status] || '#64748b'

  // Gather unique players from entries
  const playerMap = new Map<string, { avatar: string; name: string }>()
  for (const entry of tournament.entries) {
    if (entry.member && !playerMap.has(entry.memberId)) {
      playerMap.set(entry.memberId, { avatar: entry.member.avatar, name: entry.member.name })
    }
  }
  const players = Array.from(playerMap.values())

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 hover:border-purple-500/40 transition-all">
      <Link href={`/tournaments/${tournament.id}`} className="block">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="text-white font-semibold text-sm">{tournament.name}</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              {game?.icon} {game?.name} {'\u00B7'} {tournament.gameIds.length} game{tournament.gameIds.length !== 1 ? 's' : ''}
            </p>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full uppercase tracking-wider"
            style={{ color: sc, background: `${sc}15`, border: `1px solid ${sc}30` }}>
            {tournament.status}
          </span>
        </div>

        {/* Players */}
        <div className="flex items-center gap-2 mt-3">
          {players.length > 0 ? (
            <>
              <div className="flex -space-x-2">
                {players.slice(0, 6).map((p, i) => (
                  <span key={i} className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-sm" title={p.name}>{p.avatar}</span>
                ))}
              </div>
              <span className="text-xs text-slate-500">{players.length} player{players.length !== 1 ? 's' : ''}</span>
            </>
          ) : (
            <span className="text-xs text-slate-500">No scores yet</span>
          )}
        </div>

        {/* Progress bar */}
        {tournament.gameIds.length > 0 && (
          <div className="mt-3">
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400 transition-all duration-500"
                style={{
                  width: `${(() => {
                    const completedGames = new Set(tournament.entries.map(e => e.gameId)).size
                    return (completedGames / tournament.gameIds.length) * 100
                  })()}%`
                }}
              />
            </div>
          </div>
        )}

        {tournament.completedAt && (
          <div className="mt-2 text-xs text-slate-500">
            Completed {new Date(tournament.completedAt).toLocaleDateString()}
          </div>
        )}
      </Link>

      {tournament.status === 'active' && (
        <div className="mt-3 flex justify-end">
          <button onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function TournamentHubPage() {
  const ctx = useFamily()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<typeof PRESETS[0] | undefined>()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [loading, setLoading] = useState(true)

  const loadTournaments = useCallback(async () => {
    try {
      const familyId = ctx?.family?.id
      if (!familyId) {
        setTournaments([])
        return
      }
      const data = await fetchTournaments(familyId)
      setTournaments(data)
    } catch {
      // Failed to load
    } finally {
      setLoading(false)
    }
  }, [ctx?.family?.id])

  useEffect(() => {
    loadTournaments()
  }, [loadTournaments])

  const handlePresetClick = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset)
    setShowCreate(true)
  }

  const handleCreated = () => {
    setShowCreate(false)
    setSelectedPreset(undefined)
    loadTournaments()
  }

  const handleDelete = async (id: string) => {
    const memberId = ctx?.member?.id
    if (!memberId) return
    const ok = await deleteTournamentAPI(id, memberId)
    if (ok) loadTournaments()
  }

  const filteredTournaments = filter === 'all'
    ? tournaments
    : tournaments.filter(t => t.status === filter)

  const activeTournaments = tournaments.filter(t => t.status === 'active')

  return (
    <div className="min-h-screen pb-8 page-enter">
      <header className="relative px-4 pt-8 pb-6 text-center">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative">
          <Link href="/" className="text-slate-400 text-sm hover:text-slate-300 transition-colors">{'\u2190'} Home</Link>
          <h1 className="text-xl font-bold neon-text mt-3" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '16px' }}>
            My Tournaments
          </h1>
          <p className="text-slate-400 text-sm mt-2">Create and manage your tournaments</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 space-y-6">
        {/* Quick Presets */}
        {!showCreate && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider px-1">Quick Start</h3>
            <div className="grid grid-cols-1 gap-3">
              {PRESETS.map(preset => (
                <button key={preset.id} onClick={() => handlePresetClick(preset)}
                  className="flex items-center gap-4 bg-slate-800/40 border border-slate-700/40 rounded-2xl p-4 hover:border-purple-500/40 transition-all text-left group">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: `${preset.color}15`, border: `1px solid ${preset.color}30` }}>{preset.icon}</div>
                  <div>
                    <h4 className="text-white font-semibold text-sm group-hover:text-purple-300 transition-colors">{preset.name}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{preset.description}</p>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto shrink-0"><path d="M9 18l6-6-6-6" /></svg>
                </button>
              ))}
            </div>
            <button onClick={() => { setSelectedPreset(undefined); setShowCreate(true) }}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 transition-all">
              + Custom Tournament
            </button>
          </div>
        )}

        {showCreate && (
          <CreateTournamentForm
            onCreated={handleCreated}
            onCancel={() => { setShowCreate(false); setSelectedPreset(undefined) }}
            initialPreset={selectedPreset}
          />
        )}

        {/* Browse all presets link */}
        <div className="text-center">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
          >
            Browse all tournament presets {'\u2192'}
          </Link>
        </div>

        {/* Live tournaments */}
        {activeTournaments.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider px-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />Live Tournaments
            </h3>
            {activeTournaments.map(t => (
              <TournamentCard key={t.id} tournament={t} onDelete={() => handleDelete(t.id)} />
            ))}
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex bg-slate-800/60 rounded-xl p-1 gap-1">
          {(['all', 'active', 'completed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
                filter === f ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-slate-400 hover:text-slate-300'
              }`}>{f}</button>
          ))}
        </div>

        {/* Tournament List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTournaments.length === 0 && (
              <div className="text-center py-8">
                <p className="text-3xl mb-3">{'\u{1F3C6}'}</p>
                <p className="text-slate-400 text-sm">No tournaments yet.</p>
                <p className="text-slate-500 text-xs mt-1">Create one and invite your family!</p>
              </div>
            )}
            {filteredTournaments.map(t => (
              <TournamentCard key={t.id} tournament={t} onDelete={() => handleDelete(t.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
