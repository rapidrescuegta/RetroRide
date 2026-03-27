'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { GAMES, type GameInfo } from '@/lib/games'

// ─── Floating Emoji Background ───────────────────────────────────────────────
function FloatingEmojis() {
  const emojis = ['🎮', '🕹️', '👾', '🐍', '🏓', '🟦', '🚀', '🐸', '💣', '🃏', '🐦', '🔴']
  const [particles, setParticles] = useState<
    { id: number; emoji: string; x: number; y: number; size: number; speed: number; delay: number; drift: number }[]
  >([])

  useEffect(() => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      emoji: emojis[i % emojis.length],
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 18 + Math.random() * 24,
      speed: 15 + Math.random() * 25,
      delay: Math.random() * -20,
      drift: -30 + Math.random() * 60,
    }))
    setParticles(items)
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute opacity-[0.12]"
          style={{
            left: `${p.x}%`,
            fontSize: `${p.size}px`,
            animation: `floatUp ${p.speed}s linear ${p.delay}s infinite`,
          }}
        >
          {p.emoji}
        </span>
      ))}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(100vh) translateX(0px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.12; }
          90% { opacity: 0.12; }
          100% { transform: translateY(-100px) translateX(40px) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          let frame = 0
          const totalFrames = 40
          const step = () => {
            frame++
            const progress = frame / totalFrames
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (frame < totalFrames) requestAnimationFrame(step)
          }
          requestAnimationFrame(step)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  )
}

// ─── Section wrapper with fade-in ────────────────────────────────────────────
function Section({
  children,
  className = '',
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      id={id}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </section>
  )
}

// ─── Game Card ───────────────────────────────────────────────────────────────
function GameCard({ game }: { game: GameInfo }) {
  const diffColors: Record<string, string> = {
    kids: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    everyone: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    adults: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }
  const diffLabels: Record<string, string> = {
    kids: 'Kids',
    everyone: 'Everyone',
    adults: 'Challenge',
  }

  return (
    <div
      className="game-card group relative rounded-2xl p-4 flex flex-col items-center gap-2 cursor-default"
      style={{
        background: `linear-gradient(135deg, ${game.color}15, ${game.color}08)`,
        border: `1px solid ${game.color}30`,
      }}
    >
      <span className="text-4xl group-hover:scale-110 transition-transform duration-300">{game.icon}</span>
      <span
        className="text-sm font-semibold text-center"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '9px', lineHeight: '1.4' }}
      >
        {game.name}
      </span>
      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${diffColors[game.difficulty]}`}>
        {diffLabels[game.difficulty]}
      </span>
    </div>
  )
}

// ─── Pricing Card ────────────────────────────────────────────────────────────
function PricingCard({
  name,
  price,
  period,
  features,
  plan,
  featured = false,
  badge,
}: {
  name: string
  price: string
  period: string
  features: string[]
  plan: string
  featured?: boolean
  badge?: string
}) {
  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col items-center text-center transition-all duration-300 hover:-translate-y-1 ${
        featured
          ? 'bg-gradient-to-b from-[#8b5cf6]/20 to-[#06b6d4]/10 border-2 border-[#8b5cf6]/60 scale-[1.03] shadow-[0_0_40px_rgba(139,92,246,0.2)]'
          : 'bg-[#1a1a3e]/80 border border-white/10'
      }`}
    >
      {badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-black text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>
          {badge}
        </span>
      )}
      <h3
        className="text-lg font-bold mb-1 mt-1"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '13px' }}
      >
        {name}
      </h3>
      <p className="text-[#94a3b8] text-sm mb-3">{period}</p>
      <div className="mb-4">
        <span className="text-4xl font-bold text-white">{price}</span>
      </div>
      <ul className="text-sm text-[#94a3b8] space-y-2 mb-6 text-left w-full">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={`/family?plan=${plan}`}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 text-center block ${
          featured
            ? 'bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] text-white hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:scale-105'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        Get Started
      </Link>
    </div>
  )
}

// ─── Testimonial Card ────────────────────────────────────────────────────────
function TestimonialCard({
  quote,
  name,
  context,
  stars,
}: {
  quote: string
  name: string
  context: string
  stars: number
}) {
  return (
    <div className="bg-[#1a1a3e]/60 border border-white/10 rounded-2xl p-6 flex flex-col gap-3 hover:border-[#8b5cf6]/30 transition-colors duration-300">
      <div className="flex gap-0.5">
        {Array.from({ length: stars }, (_, i) => (
          <span key={i} className="text-[#f59e0b]">&#9733;</span>
        ))}
      </div>
      <p className="text-[#cbd5e1] text-sm leading-relaxed italic">&ldquo;{quote}&rdquo;</p>
      <div className="mt-auto">
        <p className="text-white font-semibold text-sm">{name}</p>
        <p className="text-[#64748b] text-xs">{context}</p>
      </div>
    </div>
  )
}

// ─── Feature Card ────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-[#1a1a3e]/50 border border-white/10 rounded-2xl p-6 hover:border-[#8b5cf6]/30 hover:-translate-y-1 transition-all duration-300 text-center">
      <span className="text-4xl mb-3 block">{icon}</span>
      <h3 className="text-white font-bold text-sm mb-2">{title}</h3>
      <p className="text-[#94a3b8] text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

// ─── Step Card ───────────────────────────────────────────────────────────────
function StepCard({ num, icon, title, desc }: { num: number; icon: string; title: string; desc: string }) {
  const colors = ['#8b5cf6', '#06b6d4', '#ec4899']
  const c = colors[(num - 1) % 3]
  return (
    <div className="flex flex-col items-center text-center gap-3">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl relative"
        style={{ background: `${c}20`, border: `2px solid ${c}50` }}
      >
        {icon}
        <span
          className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ background: c, fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}
        >
          {num}
        </span>
      </div>
      <h3 className="text-white font-bold text-sm">{title}</h3>
      <p className="text-[#94a3b8] text-sm leading-relaxed max-w-xs">{desc}</p>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function LandingPage() {
  const kidsGames = GAMES.filter((g) => g.difficulty === 'kids')
  const cardGames = GAMES.filter((g) => g.difficulty === 'everyone')
  const adultGames = GAMES.filter((g) => g.difficulty === 'adults')
  const totalGames = GAMES.length

  return (
    <div className="min-h-screen bg-[#0a0a1a] overflow-x-hidden" style={{ scrollBehavior: 'smooth' }}>
      {/* ─── HERO ──────────────────────────────────────────────────────── */}
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        {/* Radial gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(6,182,212,0.08) 0%, transparent 50%)',
          }}
        />
        <FloatingEmojis />

        <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto gap-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <span className="text-5xl">🕹️</span>
            <h1
              className="neon-text text-2xl sm:text-3xl md:text-4xl"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              GameBuddi
            </h1>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Game Night Goes{' '}
            <span className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#06b6d4] bg-clip-text text-transparent">
              Everywhere
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-[#94a3b8] max-w-xl leading-relaxed">
            <AnimatedCounter target={totalGames} /> classic games — free to play solo. Upgrade to Family Mode to play together.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link
              href="/"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] text-white font-bold text-lg hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:scale-105 transition-all duration-300"
            >
              Play Free
            </Link>
            <a
              href="#pricing"
              className="px-8 py-4 rounded-xl border-2 border-[#8b5cf6]/50 text-white font-bold text-lg hover:bg-[#8b5cf6]/10 hover:border-[#8b5cf6] transition-all duration-300"
            >
              Get Family Mode
            </a>
          </div>

          {/* Social proof strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-[#64748b]">
            <span className="flex items-center gap-1">
              <span className="text-[#f59e0b]">&#9733;&#9733;&#9733;&#9733;&#9733;</span> 4.9 rating
            </span>
            <span>|</span>
            <span>Local Hotspot Play</span>
            <span>|</span>
            <span>Works Offline</span>
            <span>|</span>
            <span>No Ads</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-[#64748b]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </div>

      {/* ─── LOCAL PLAY HERO BANNER ───────────────────────────────────── */}
      <Section className="px-4 py-16 max-w-5xl mx-auto">
        <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.1) 50%, rgba(236,72,153,0.1) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
        >
          <div className="text-6xl mb-4 block relative inline-flex items-center justify-center">
            <span>📶</span>
            <span className="absolute -top-1 -right-6 text-2xl rotate-12 text-red-500">🚫</span>
          </div>
          <h2
            className="neon-text text-lg sm:text-xl mb-3"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            No WiFi? No Problem.
          </h2>
          <p className="text-[#f59e0b] text-sm font-semibold mb-4 tracking-wide uppercase">
            Zero internet required — not even satellite
          </p>
          <p className="text-[#cbd5e1] text-lg max-w-2xl mx-auto leading-relaxed mb-6">
            On a cruise ship with no signal? Plane at 35,000 feet? Train through a tunnel?
            One person turns on their phone&apos;s hotspot, everyone connects, and you&apos;re
            playing together. Card games, challenges, chat — all without WiFi, data, or any internet at all.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-[#94a3b8]">
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#128674; Cruise Ships</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#9992;&#65039; Flights</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#128646; Trains</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#128663; Road Trips</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#127956;&#65039; Cabins</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#9978;&#65039; Camping</span>
            <span className="bg-white/5 border border-white/10 rounded-full px-4 py-2">&#127758; Traveling Abroad</span>
          </div>
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/30 to-transparent" />

      {/* ─── GAMES SHOWCASE ───────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <AnimatedCounter target={totalGames} /> Games
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Arcade classics, card games, and brain teasers — something for every age. Free to play solo.
          </p>
        </div>

        {/* Kids Games */}
        <div className="mb-10">
          <h3 className="text-emerald-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <span className="text-lg">&#127922;</span> Kid-Friendly ({kidsGames.length} games)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {kidsGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>

        {/* Card Games */}
        <div className="mb-10">
          <h3 className="text-blue-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <span className="text-lg">&#127183;</span> Multiplayer Card Games ({cardGames.length} games)
            <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-[#8b5cf6]/20 text-[#a78bfa] border border-[#8b5cf6]/30">NEW</span>
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {cardGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
          <p className="text-[#64748b] text-xs mt-3">
            Play solo vs AI or together via local hotspot — 2 to 7 players depending on the game.
          </p>
        </div>

        {/* Adult / Challenge Games */}
        <div>
          <h3 className="text-orange-400 font-semibold text-sm mb-4 flex items-center gap-2">
            <span className="text-lg">&#128293;</span> Challenge Mode ({adultGames.length} games)
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {adultGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/30 to-transparent" />

      {/* ─── FAMILY FEATURES ──────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            Unlock Family Mode
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Solo games are always free. Family Mode unlocks multiplayer, chat, leaderboards, and local play.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="📡"
            title="Local Hotspot Play"
            desc="Play together anywhere, no internet needed. One person creates a hotspot, everyone connects, and you're playing in seconds."
          />
          <FeatureCard
            icon="🃏"
            title="Multiplayer Card Games"
            desc="Rummy 500, Hearts, Spades, Crazy Eights, and Go Fish. Play with 2-7 people on your own phones."
          />
          <FeatureCard
            icon="📶"
            title="Works Everywhere Offline"
            desc="Installed as a PWA on your home screen. Games, chat, and scores all work without WiFi and sync when you're back online."
          />
          <FeatureCard
            icon="🏆"
            title="Family Leaderboards"
            desc={`Crown the champion. Track scores across all ${totalGames} games with per-game rankings and overall standings.`}
          />
          <FeatureCard
            icon="💬"
            title="Email Invites & Chat"
            desc="Invite family by email — they join with a simple code. Chat, send challenges, and talk trash in real-time."
          />
          <FeatureCard
            icon="📊"
            title="Weekly Rankings"
            desc="Get ranking digest emails so you always know who's on top. Daily and weekly leaderboard updates delivered to your inbox."
          />
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#06b6d4]/30 to-transparent" />

      {/* ─── FREE vs PAID ─────────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            How It Works
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Play solo for free. Upgrade when you want to play together.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free tier */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🎮</span>
              <div>
                <h3 className="text-white font-bold text-lg">Solo Play</h3>
                <span className="text-emerald-400 text-sm font-bold">Always Free</span>
              </div>
            </div>
            <ul className="space-y-2.5 text-sm text-[#94a3b8]">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span>
                All {totalGames} games — no limits
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span>
                Card games vs AI opponents
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span>
                Works offline — planes, trains, anywhere
              </li>
              <li className="flex items-center gap-2">
                <span className="text-emerald-400">&#10003;</span>
                No account needed, no ads
              </li>
              <li className="flex items-center gap-2 text-[#475569]">
                <span className="text-[#475569]">&#10007;</span>
                No multiplayer
              </li>
              <li className="flex items-center gap-2 text-[#475569]">
                <span className="text-[#475569]">&#10007;</span>
                No stats, leaderboards, or rankings
              </li>
              <li className="flex items-center gap-2 text-[#475569]">
                <span className="text-[#475569]">&#10007;</span>
                No messaging or challenges
              </li>
            </ul>
            <Link
              href="/"
              className="block w-full py-3 rounded-xl font-semibold text-sm text-center bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
            >
              Play Free Now
            </Link>
          </div>

          {/* Paid tier */}
          <div className="rounded-2xl border-2 border-[#8b5cf6]/60 bg-[#8b5cf6]/5 p-6 space-y-4 relative shadow-[0_0_30px_rgba(139,92,246,0.15)]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white text-[10px] font-bold px-4 py-1 rounded-full whitespace-nowrap" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}>
              PLAY TOGETHER
            </span>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-3xl">👥</span>
              <div>
                <h3 className="text-white font-bold text-lg">Family Mode</h3>
                <span className="text-[#a78bfa] text-sm font-bold">From $4.99</span>
              </div>
            </div>
            <p className="text-xs text-[#94a3b8]">Everything in Solo Play, plus:</p>
            <ul className="space-y-2.5 text-sm text-[#94a3b8]">
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">Multiplayer on local hotspot — no WiFi needed</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">Card games with real people (2-7 players)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">In-app messaging & challenges</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">Leaderboards, stats & crown rankings</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">Weekly ranking emails</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#a78bfa]">&#10003;</span>
                <span className="text-white">Invite members by email</span>
              </li>
            </ul>
            <a
              href="#pricing"
              className="block w-full py-3 rounded-xl font-semibold text-sm text-center bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:scale-[1.02] transition-all"
            >
              See Plans & Pricing
            </a>
          </div>
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#ec4899]/30 to-transparent" />

      {/* ─── PRICING ──────────────────────────────────────────────────── */}
      <Section id="pricing" className="px-4 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            Upgrade to Family Mode
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Solo games are always free. Family Mode unlocks multiplayer, chat, leaderboards, and local play.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PricingCard
            name="Weekend"
            price="$4.99"
            period="3 days"
            plan="weekend"
            features={[
              `All ${totalGames} games`,
              'Local hotspot play',
              'Multiplayer card games',
              'Family leaderboards',
              'Family chat',
              'Perfect for a trip',
            ]}
          />
          <PricingCard
            name="Weekly"
            price="$7.99"
            period="7 days"
            plan="weekly"
            features={[
              `All ${totalGames} games`,
              'Local hotspot play',
              'Multiplayer card games',
              'Family leaderboards',
              'Family chat',
              'Live challenges',
            ]}
          />
          <PricingCard
            name="Monthly"
            price="$14.99"
            period="per month"
            plan="monthly"
            features={[
              `All ${totalGames} games`,
              'Local hotspot play',
              'Multiplayer card games',
              'Family leaderboards',
              'Family chat',
              'Live challenges',
              'Weekly ranking emails',
              'Cancel anytime',
            ]}
          />
          <PricingCard
            name="Annual"
            price="$49.99"
            period="per year"
            plan="annual"
            featured
            badge="BEST VALUE  ·  Save 72%"
            features={[
              `All ${totalGames} games`,
              'Local hotspot play',
              'Multiplayer card games',
              'Family leaderboards',
              'Family chat',
              'Live challenges',
              'Weekly ranking emails',
              'Priority support',
              'Just $4.17/month',
            ]}
          />
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#f59e0b]/30 to-transparent" />

      {/* ─── TESTIMONIALS ─────────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            Families Love GameBuddi
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TestimonialCard
            quote="We played Rummy 500 the entire flight to London. No WiFi needed — just turned on a hotspot and all four of us were connected in seconds. The kids didn't ask for the iPad once."
            name="The Martinez Family"
            context="6-hour flight to London"
            stars={5}
          />
          <TestimonialCard
            quote="My subway commute used to be dead time. Now my daughter and I play Go Fish and Hearts every morning. The local play is genius — it just works underground with no signal."
            name="David & Lily R."
            context="Daily subway commute"
            stars={5}
          />
          <TestimonialCard
            quote="No WiFi at the cabin this Thanksgiving — didn't matter at all. After dinner we played Spades teams, then the kids ran a Wordle tournament. The weekly rankings email the next Monday was hilarious."
            name="The Nguyen Family"
            context="Thanksgiving at the cabin"
            stars={5}
          />
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#8b5cf6]/30 to-transparent" />

      {/* ─── FINAL CTA ────────────────────────────────────────────────── */}
      <Section className="px-4 py-24 text-center">
        <h2
          className="neon-text text-2xl sm:text-3xl mb-6"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Ready to Play?
        </h2>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-md mx-auto">
          {totalGames} classic games, free to play solo. Upgrade to Family Mode for multiplayer, chat, leaderboards, and local play.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold text-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all duration-300"
          >
            Play Free Now
          </Link>
          <Link
            href="/family"
            className="px-10 py-4 rounded-xl border-2 border-[#8b5cf6]/50 text-white font-bold text-lg hover:bg-[#8b5cf6]/10 hover:border-[#8b5cf6] transition-all duration-300"
          >
            Upgrade to Family Mode
          </Link>
        </div>
      </Section>

      {/* ─── FOOTER ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <span
              className="neon-text text-sm"
              style={{ fontFamily: "'Press Start 2P', monospace" }}
            >
              GameBuddi
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#64748b]">
            <Link href="/" className="hover:text-white transition-colors">
              Games
            </Link>
            <a href="#pricing" className="hover:text-white transition-colors">
              Pricing
            </a>
            <Link href="/family" className="hover:text-white transition-colors">
              Family Mode
            </Link>
            <Link href="/leaderboard" className="hover:text-white transition-colors">
              Leaderboards
            </Link>
            <Link href="/local-play" className="hover:text-white transition-colors">
              Local Play
            </Link>
          </div>
          <p className="text-xs text-[#475569]">&copy; {new Date().getFullYear()} GameBuddi. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
