import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Offline Games for Kids on Planes & Road Trips | GameBuddi',
  description:
    '30+ classic games that work offline. Up to 6 family members. Cribbage, Hearts, Connect-4, Battleship — playable on the plane, in the car, in the hotel. Free to start.',
  alternates: { canonical: '/travel' },
  openGraph: {
    title: 'Offline Games for Kids on Planes & Road Trips | GameBuddi',
    description:
      '30+ classic games that work offline. Up to 6 family members — no WiFi needed.',
    url: 'https://www.gamebuddi.com/travel',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

const PAINS = [
  {
    title: '"The iPad battery dies on hour 2"',
    pain: "You loaded 'enough' YouTube before takeoff. The screen-time feels endless until it ends. Then it's the longest 4 hours of your life.",
    solve:
      'Lightweight games — no video streaming — that sip battery. A full transatlantic flight on one charge, for the whole family, not one kid.',
  },
  {
    title: '"We\'re not all watching the same screen"',
    pain: 'Three kids. Three devices. Three fights. The parent inevitably gives up their phone too.',
    solve:
      'Multi-device family mode. Six accounts on one plan. Everyone plays each other — Hearts across the row of seats, Battleship across the back of the minivan.',
  },
  {
    title: '"I want them off the tablet-zombie stare"',
    pain: "Active kids' brains. Long quiet hours. The boredom isn't the problem — the screen-glaze stare is.",
    solve:
      'Real games — Cribbage, Connect-4, Checkers, Battleship, Hearts. The same games you grew up playing on road trips, just digital and offline. Nobody stares; everyone competes.',
  },
]

const FEATURES = [
  { icon: '🛩️', title: 'Offline-first PWA', body: 'Pre-cache all 30+ games once on WiFi at home. Plays anywhere. Sync resumes when you land.' },
  { icon: '👨‍👩‍👧‍👦', title: 'Up to 6 family members', body: 'One plan, six accounts. Phones, tablets, laptops. Everyone has their own avatar and score history.' },
  { icon: '🎮', title: '30+ classic games', body: 'Cribbage, Hearts, Euchre, Connect-4, Battleship, Checkers, Chess and more. Games you actually want to play.' },
  { icon: '🔋', title: 'All-day battery', body: 'No streaming, no heavy graphics. A full 6-hour drive on one device charge.' },
]

function WebPageJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Offline Games for Kids on Planes & Road Trips',
    url: 'https://www.gamebuddi.com/travel',
    description:
      '30+ classic games that work offline for family travel — planes, road trips, hotels.',
    isPartOf: { '@type': 'WebSite', name: 'GameBuddi', url: 'https://www.gamebuddi.com' },
  }
  return (
    <script id="schema-travel" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}

export default function TravelPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100">
      <WebPageJsonLd />
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
        <p className="text-cyan-400 uppercase tracking-widest text-xs font-semibold mb-6">For parents on the move</p>
        <h1 className="neon-text text-2xl sm:text-3xl leading-relaxed mb-6" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          When the WiFi dies. The games don&apos;t.
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8">
          GameBuddi works offline. 30+ classic games. Up to 6 family members. Cached on the device
          before you even take off — Cribbage at 36,000 feet, Hearts in the back seat, Connect-4 in
          the hotel room.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pricing?plan=family_monthly"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all"
          >
            Start free →
          </Link>
          <Link href="/pricing" className="text-cyan-400 font-semibold hover:text-white transition-colors">
            See plans
          </Link>
        </div>
        <p className="text-xs text-[#64748b] mt-4">Free to start · Cancel anytime</p>
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
          Ready for takeoff?
        </h2>
        <p className="text-[#94a3b8] text-lg mb-8 max-w-md mx-auto">
          Start your family&apos;s next trip with games they&apos;ll actually want to play.
        </p>
        <Link
          href="/pricing?plan=family_monthly"
          className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#ec4899] text-white font-bold text-lg hover:shadow-[0_0_30px_rgba(236,72,153,0.4)] hover:scale-105 transition-all"
        >
          Get the Family plan →
        </Link>
        <p className="text-xs text-[#64748b] mt-4">Free tier available · Cancel anytime</p>
      </section>

      <footer className="border-t border-white/5 py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#475569]">
          <span>&copy; {new Date().getFullYear()} GameBuddi. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/landing" className="hover:text-white transition-colors">Not a traveler? See everything GameBuddi does</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
