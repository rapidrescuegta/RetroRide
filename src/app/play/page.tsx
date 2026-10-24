import type { Metadata } from 'next'
import Link from 'next/link'
import { GAMES, type GameInfo } from '@/lib/games'

export const metadata: Metadata = {
  title: 'All Games — GameBuddi',
  description:
    'Browse every classic arcade and card game on GameBuddi — 40+ games that work offline, on a phone, tablet or laptop.',
  alternates: { canonical: '/play' },
}

/**
 * The manifest's share_target and the service worker's precache list both point
 * at /play. Before this page existed the route 404'd, which silently broke the
 * atomic `cache.addAll()` precache batch (one bad URL aborted every page).
 * This is the static, server-rendered index of every game.
 */
function GameTile({ game }: { game: GameInfo }) {
  const easy = game.difficulty === 'kids'
  return (
    <Link href={`/play/${game.id}`} className="block group">
      <div
        className="game-card relative rounded-2xl p-4 cursor-pointer overflow-hidden h-full transition-transform group-hover:-translate-y-0.5"
        style={{
          background: `linear-gradient(135deg, ${game.color}15, ${game.color}08)`,
          border: `1px solid ${game.color}30`,
        }}
      >
        <div className="absolute top-2 right-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: easy ? '#10b98120' : '#8b5cf620',
              color: easy ? '#10b981' : '#8b5cf6',
            }}
          >
            {easy ? 'Easy' : 'Hard'}
          </span>
        </div>
        <div className="text-4xl mb-2">{game.icon}</div>
        <h3 className="font-bold text-sm mb-1" style={{ color: game.color }}>
          {game.name}
        </h3>
        <p className="text-xs text-slate-400 leading-relaxed">{game.description}</p>
      </div>
    </Link>
  )
}

export default function PlayIndexPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100">
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <span
              className="neon-text text-sm"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              GameBuddi
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <Link href="/" className="hover:text-white transition-colors">
              Games
            </Link>
            <Link href="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
            <Link href="/family" className="hover:text-white transition-colors">
              Family Mode
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <h1
          className="neon-text text-xl sm:text-2xl mb-2"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          All Games
        </h1>
        <p className="text-sm text-slate-400 mb-8">
          {GAMES.length} classic games — no wifi needed.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {GAMES.map((game) => (
            <GameTile key={game.id} game={game} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-block rounded-xl bg-purple-600 hover:bg-purple-500 transition-colors px-5 py-2.5 text-sm font-semibold text-white"
          >
            ← Back to home
          </Link>
        </div>
      </main>
    </div>
  )
}
