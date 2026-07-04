import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dorm & Squad Tournaments — Hearts, Euchre, Cribbage Online | GameBuddi',
  description:
    "Run your floor's tournament. 20 members. Auto-advancing brackets. Hearts, Euchre, Cribbage, Chess, plus 27 more. $19/mo for the whole squad.",
  alternates: { canonical: '/university' },
  openGraph: {
    title: 'Dorm & Squad Tournaments | GameBuddi',
    description: 'Auto-advancing brackets for your dorm, frat, or friend group. 20 members, $19/mo.',
    url: 'https://www.gamebuddi.com/university',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

const PAINS = [
  {
    title: '"Game night is 40% logistics"',
    pain: "Who's hosting. Who has the cards. Whose deck is missing the 7 of clubs. By the time you sit down, half the energy is gone.",
    solve: 'Tap a link. Everyone joins from their own phone or laptop. Same room or 5 cities apart. Game starts. Done.',
  },
  {
    title: '"We started a tournament. We never finished it."',
    pain: "Round 1 went great. Then someone went home for the weekend. Then exams. The bracket is a Google Sheet no one's looked at since October.",
    solve: "Brackets that run themselves. Auto-advance, push notifications, \"you've been challenged\" alerts. The bracket finishes itself.",
  },
  {
    title: '"Different friend groups, different apps"',
    pain: "The Hearts crew uses one app. The Cribbage crew uses another. Nobody's in all three.",
    solve: "One squad. 30+ games. Everyone's on the same scoreboard regardless of what they want to play tonight.",
  },
]

const FEATURES = [
  { icon: '🏆', title: 'Tournament mode', body: 'Round-robin or single-elimination brackets. Auto-seeding. Alerts when it\u2019s your turn.' },
  { icon: '👥', title: 'Up to 20 members', body: 'Big enough for a hall, a frat, an entire intramural team. Custom squad name.' },
  { icon: '🎮', title: '30+ multiplayer classics', body: 'Hearts, Euchre, Cribbage, Chess, plus arcade classics. Cross-device.' },
  { icon: '📲', title: 'Push notifications', body: 'Knows when you\u2019ve been challenged. Knows when your turn is up.' },
]

function JsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Dorm & Squad Tournaments — GameBuddi',
      url: 'https://www.gamebuddi.com/university',
      description: 'Tournament app for dorms, frats, and friend groups — Hearts, Euchre, Cribbage and 27 more.',
      isPartOf: { '@type': 'WebSite', name: 'GameBuddi', url: 'https://www.gamebuddi.com' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'GameBuddi Squad',
      description: 'Group gaming plan for up to 20 members with tournament brackets.',
      brand: { '@type': 'Brand', name: 'GameBuddi' },
      offers: [
        { '@type': 'Offer', price: '19', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', price: '159', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
      ],
    },
  ]
  return (
    <script id="schema-university" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}

export default function UniversityPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100">
      <JsonLd />
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <span className="neon-text text-sm" style={{ fontFamily: "'Press Start 2P', monospace" }}>GameBuddi</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <Link href="/" className="hover:text-white transition-colors">Games</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-20 pb-16 text-center max-w-3xl mx-auto">
        <p className="text-pink-400 uppercase tracking-widest text-xs font-semibold mb-6">
          For the dorm. For the squad. For the group chat.
        </p>
        <h1 className="neon-text text-2xl sm:text-3xl leading-relaxed mb-6" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Run the tournament. Win the floor.
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8">
          Squad mode: 20 members. Tournament brackets. Hearts, Euchre, Cribbage, and 27 more. The
          group chat stops being about logistics and starts being about who&apos;s in 1st.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pricing?plan=squad_monthly"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all"
          >
            Start your squad →
          </Link>
          <Link href="/pricing" className="text-cyan-400 font-semibold hover:text-white transition-colors">
            See Squad features
          </Link>
        </div>
        <p className="text-xs text-[#64748b] mt-4">Free tier available · Cancel anytime</p>
      </section>

      {/* Pain points */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PAINS.map((p) => (
            <div key={p.title} className="bg-[#1a1a3e]/80 border border-white/10 rounded-2xl p-6">
              <h2 className="text-white font-bold text-base mb-3">{p.title}</h2>
              <p className="text-[#94a3b8] text-sm mb-4">{p.pain}</p>
              <p className="text-sm text-emerald-300"><span className="font-semibold">GameBuddi solves it:</span> {p.solve}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-[#1a1a3e]/60 border border-white/10 rounded-2xl p-5 text-center">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="text-white font-bold text-sm mb-2">{f.title}</h3>
              <p className="text-[#94a3b8] text-xs leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 text-center">
        <h2 className="neon-text text-xl sm:text-2xl mb-6" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Bracket up.
        </h2>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-md mx-auto">
          Your floor is one tap away from being the floor everyone else wants to live on.
        </p>
        <Link
          href="/pricing?plan=squad_monthly"
          className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold text-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all"
        >
          Get Squad — $19/mo →
        </Link>
        <p className="text-xs text-[#64748b] mt-4">Free tier available · Cancel anytime</p>
      </section>

      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#475569]">
          <span>&copy; {new Date().getFullYear()} GameBuddi. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/landing" className="hover:text-white transition-colors">Not your fit? See everything GameBuddi does</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
