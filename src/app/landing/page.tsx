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
  const adultGames = GAMES.filter((g) => g.difficulty === 'adults')

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
              RetroRide
            </h1>
          </div>

          {/* Headline */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight tracking-tight">
            Family Game Night,{' '}
            <span className="bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#06b6d4] bg-clip-text text-transparent">
              Anywhere
            </span>
          </h2>

          <p className="text-lg sm:text-xl text-[#94a3b8] max-w-xl leading-relaxed">
            <AnimatedCounter target={25} suffix="+" /> classic arcade games. No WiFi needed. Challenge your whole family.
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

      {/* ─── GAMES SHOWCASE ───────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            <AnimatedCounter target={25} suffix="+" /> Classic Games
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            From Snake to Chess — something for every age. All playable right now, totally free.
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
            Challenge Your Family
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Family Mode turns RetroRide into the ultimate family competition. Everyone plays, everyone competes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <FeatureCard
            icon="👨‍👩‍👧‍👦"
            title="Family Leaderboards"
            desc="Everyone in your family competes for the top spot. Crown the champion after every game."
          />
          <FeatureCard
            icon="💬"
            title="Family Chat"
            desc="Talk trash, send challenges, and celebrate wins — all inside the app."
          />
          <FeatureCard
            icon="📸"
            title="Cartoon Avatars"
            desc="Take a selfie and get a fun cartoon avatar. Kids love picking their character."
          />
          <FeatureCard
            icon="🏆"
            title="Live Challenges"
            desc="Challenge anyone in your family to Chess, Checkers, or a Wordle Race in real time."
          />
          <FeatureCard
            icon="✈️"
            title="Works Offline"
            desc="No WiFi? No problem. Perfect for flights, road trips, and waiting rooms."
          />
          <FeatureCard
            icon="⭐"
            title="Difficulty Levels"
            desc="Easy mode for little ones, hard mode for competitive adults. Everyone has fun."
          />
        </div>
      </Section>

      {/* ─── DIVIDER ──────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto h-px bg-gradient-to-r from-transparent via-[#06b6d4]/30 to-transparent" />

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────── */}
      <Section className="px-4 py-20 max-w-4xl mx-auto">
        <div className="text-center mb-14">
          <h2
            className="neon-text text-xl sm:text-2xl mb-4"
            style={{ fontFamily: "'Press Start 2P', monospace" }}
          >
            How It Works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <StepCard
            num={1}
            icon="🎮"
            title="Download & Play Free"
            desc="All 25+ games are free to play. No account needed, no ads, no catch."
          />
          <StepCard
            num={2}
            icon="👨‍👩‍👧‍👦"
            title="Create Your Family"
            desc="Share a simple code. Everyone joins your family in seconds — even Grandma."
          />
          <StepCard
            num={3}
            icon="🏆"
            title="Compete Everywhere"
            desc="Leaderboards, chat, and live challenges — even when you're offline at 35,000 feet."
          />
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
            Unlock Family Mode
          </h2>
          <p className="text-[#94a3b8] text-lg max-w-lg mx-auto">
            Free games for everyone. Family Mode adds leaderboards, chat, challenges, and avatars.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <PricingCard
            name="Weekend"
            price="$4.99"
            period="3 days"
            plan="weekend"
            features={[
              'All 25+ games',
              'Family leaderboards',
              'Family chat',
              'Cartoon avatars',
              'Perfect for a trip',
            ]}
          />
          <PricingCard
            name="Weekly"
            price="$7.99"
            period="7 days"
            plan="weekly"
            features={[
              'All 25+ games',
              'Family leaderboards',
              'Family chat',
              'Cartoon avatars',
              'Live challenges',
            ]}
          />
          <PricingCard
            name="Monthly"
            price="$14.99"
            period="per month"
            plan="monthly"
            features={[
              'All 25+ games',
              'Family leaderboards',
              'Family chat',
              'Cartoon avatars',
              'Live challenges',
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
              'All 25+ games',
              'Family leaderboards',
              'Family chat',
              'Cartoon avatars',
              'Live challenges',
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
            Families Love RetroRide
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <TestimonialCard
            quote="We downloaded this for a 5-hour flight to Orlando. The kids didn't ask for the iPad once. My husband and I got into a serious Chess rivalry by the time we landed."
            name="The Martinez Family"
            context="Used on a flight to Florida"
            stars={5}
          />
          <TestimonialCard
            quote="My 7-year-old beats me at Snake every single time and won't let me forget it. The family leaderboard has made car rides actually fun. Best $5 we've spent."
            name="Sarah & Tom K."
            context="Weekly road trips"
            stars={5}
          />
          <TestimonialCard
            quote="No WiFi at the cabin this Thanksgiving — didn't matter. The whole family played Wordle races after dinner. Even Grandpa got competitive with Checkers."
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
          Ready for Game Night?
        </h2>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-md mx-auto">
          25+ free games waiting for you. No download, no signup, just play.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold text-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all duration-300"
          >
            Play Free Now
          </Link>
          <a
            href="#pricing"
            className="text-[#8b5cf6] hover:text-[#a78bfa] font-semibold transition-colors text-lg"
          >
            or Get Family Mode &rarr;
          </a>
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
              RetroRide
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
          </div>
          <p className="text-xs text-[#475569]">&copy; {new Date().getFullYear()} RetroRide. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
