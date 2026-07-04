import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Group Game Software for Classrooms & Senior Centers | GameBuddi',
  description:
    '30+ multiplayer games with group tournaments for schools, after-school programs, and senior care. Up to 30 students per classroom or 50 residents per care center. Annual invoicing available.',
  alternates: { canonical: '/institutions' },
  openGraph: {
    title: 'Group Game Software for Classrooms & Senior Centers | GameBuddi',
    description: 'Group tournaments your coordinator can launch in 60 seconds. Classroom $29/mo, Care Center $49/mo.',
    url: 'https://www.gamebuddi.com/institutions',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
}

const PAINS = [
  {
    title: 'Indoor recess is a nightmare',
    pain: 'Rainy day. Cancelled gym. 28 kids. Limited supplies. The default fallback is a YouTube video — which the principal hates and the kids tune out.',
    solve: 'Launch a classroom tournament in 60 seconds. 30 kids in brackets across Hearts, Connect-4, Checkers and more. Quiet engagement that\u2019s still active.',
  },
  {
    title: 'Activity coordinators improvise every day',
    pain: 'One coordinator, 30 residents. The activity calendar runs on Bingo and hymn-sing. New activities are hard to introduce, hard to staff, hard to standardize.',
    solve: 'Recurring group tournaments run from a tablet at the front of the room. Senior-friendly UI mode (large fonts, high contrast). A Cribbage league residents look forward to.',
  },
  {
    title: 'Procurement says no to one more SaaS bill',
    pain: 'Your district or facility already pays for 12 software tools. Adding a 13th means budget defense in a meeting you don\u2019t have time for.',
    solve: '$29/mo for a full classroom. $49/mo for a 50-resident facility. Annual invoicing available. One of the smallest line-items your admin team will see this year.',
  },
]

const FEATURES = [
  { icon: '📊', title: 'Group tournaments', body: 'Launch and track group sessions — round-robin or elimination brackets, auto-seeded.' },
  { icon: '♿', title: 'Accessibility-minded', body: 'Large fonts, high contrast, simple touch controls. Built for players who haven\u2019t held a phone before.' },
  { icon: '🎓', title: 'Classic, age-appropriate games', body: 'Cribbage, Hearts, Checkers, Chess, Connect-4 — familiar games, no chat with strangers, no ads on paid plans.' },
  { icon: '🧾', title: 'Billing-friendly', body: 'Flat monthly pricing. Annual invoice billing available for schools and facilities.' },
]

function JsonLd() {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Group Game Software for Classrooms & Senior Centers — GameBuddi',
      url: 'https://www.gamebuddi.com/institutions',
      description: 'Multiplayer classic games with group tournaments for schools and senior care programs.',
      isPartOf: { '@type': 'WebSite', name: 'GameBuddi', url: 'https://www.gamebuddi.com' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'GameBuddi Classroom',
      description: 'Group gaming plan for educators — up to 30 students.',
      brand: { '@type': 'Brand', name: 'GameBuddi' },
      offers: [
        { '@type': 'Offer', price: '29', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', price: '249', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'GameBuddi Care Center',
      description: 'Group gaming plan for senior care and day programs — up to 50 residents.',
      brand: { '@type': 'Brand', name: 'GameBuddi' },
      offers: [
        { '@type': 'Offer', price: '49', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', price: '419', priceCurrency: 'USD', url: 'https://www.gamebuddi.com/pricing', availability: 'https://schema.org/InStock' },
      ],
    },
  ]
  return (
    <script id="schema-institutions" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  )
}

export default function InstitutionsPage() {
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
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-20 pb-16 text-center max-w-3xl mx-auto">
        <p className="text-slate-300 uppercase tracking-widest text-xs font-semibold mb-6">
          For schools, after-school programs, and senior centers
        </p>
        <h1 className="neon-text text-2xl sm:text-3xl leading-relaxed mb-6" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Engagement, on demand. For your whole group.
        </h1>
        <p className="text-[#94a3b8] text-lg mb-8">
          30+ classic games. Up to 30 students per Classroom plan, 50 residents per Care Center
          plan. Group tournaments your activity coordinator can launch in 60 seconds.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/pricing?plan=classroom_monthly"
            className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white font-bold hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] hover:scale-105 transition-all"
          >
            See plans →
          </Link>
          <a
            href="mailto:hello@gamebuddi.com?subject=GameBuddi%20for%20institutions"
            className="text-cyan-400 font-semibold hover:text-white transition-colors"
          >
            Talk to us
          </a>
        </div>
        <p className="text-xs text-[#64748b] mt-4">Cancel anytime · Annual invoice billing available</p>
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

      {/* Two plans */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2 className="neon-text text-lg text-center mb-10" style={{ fontFamily: "'Press Start 2P', monospace" }}>
          Two plans, one platform
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a1a3e]/80 border border-[#06b6d4]/40 rounded-2xl p-8 text-center">
            <h3 className="text-white font-bold mb-2" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px' }}>CLASSROOM</h3>
            <p className="text-3xl font-bold text-white mb-1">$29<span className="text-base font-normal text-[#94a3b8]">/mo</span></p>
            <p className="text-[#94a3b8] text-sm mb-4">or $249/yr</p>
            <ul className="text-sm text-[#94a3b8] space-y-2 mb-6 text-left">
              <li>✓ Up to 30 students</li>
              <li>✓ Teacher-managed tournaments</li>
              <li>✓ Content controls</li>
              <li>✓ K-12 friendly</li>
            </ul>
            <Link href="/pricing?plan=classroom_monthly" className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#3b82f6] text-white font-semibold text-sm hover:scale-[1.02] transition-all">
              Get Classroom →
            </Link>
          </div>
          <div className="bg-[#1a1a3e]/80 border border-[#f59e0b]/40 rounded-2xl p-8 text-center">
            <h3 className="text-white font-bold mb-2" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '12px' }}>CARE CENTER</h3>
            <p className="text-3xl font-bold text-white mb-1">$49<span className="text-base font-normal text-[#94a3b8]">/mo</span></p>
            <p className="text-[#94a3b8] text-sm mb-4">or $419/yr</p>
            <ul className="text-sm text-[#94a3b8] space-y-2 mb-6 text-left">
              <li>✓ Up to 50 residents/clients</li>
              <li>✓ Coordinator-run group sessions</li>
              <li>✓ Senior-friendly UI mode</li>
              <li>✓ Recurring tournament templates</li>
            </ul>
            <Link href="/pricing?plan=carecenter_monthly" className="block w-full py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-black font-semibold text-sm hover:scale-[1.02] transition-all">
              Get Care Center →
            </Link>
          </div>
        </div>
        <p className="text-center text-[#94a3b8] text-sm mt-8">
          Need 50+ seats or custom terms?{' '}
          <a href="mailto:hello@gamebuddi.com?subject=Enterprise%20inquiry" className="text-[#06b6d4] hover:underline">Talk to us →</a>
        </p>
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
