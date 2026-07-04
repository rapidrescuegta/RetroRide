import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Contact GameBuddi — Get in Touch',
  description:
    'Questions about GameBuddi? Reach our sales, support, or billing team. We typically reply within one business day.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact GameBuddi',
    description: 'Questions about GameBuddi? Reach our team.',
    type: 'website',
    url: 'https://www.gamebuddi.com/contact',
  },
}

const CARDS = [
  {
    title: 'Sales & general',
    email: 'hello@gamebuddi.com',
    blurb: 'Plan questions, partnerships, press, anything else.',
    accent: '#8b5cf6',
  },
  {
    title: 'Support',
    email: 'support@gamebuddi.com',
    blurb: 'Help with your account, gameplay issues, bug reports.',
    accent: '#06b6d4',
  },
  {
    title: 'Billing',
    email: 'billing@gamebuddi.com',
    blurb: 'Invoices, plan changes, refund requests.',
    accent: '#f59e0b',
  },
]

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100">
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <span className="neon-text text-sm" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              GameBuddi
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="/family" className="hover:text-white transition-colors">Family Mode</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-4 py-20">
        <Link href="/" className="text-sm text-[#94a3b8] hover:text-white transition-colors mb-8 inline-block">
          ← Back to GameBuddi
        </Link>
        <h1
          className="neon-text text-2xl sm:text-3xl mb-4"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Talk To Us
        </h1>
        <p className="text-[#94a3b8] text-lg max-w-2xl mb-10">
          Three inboxes, one team. Pick the one that fits — we read everything
          and reply within one business day.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mb-10">
          {CARDS.map((c) => (
            <div
              key={c.email}
              className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: `linear-gradient(135deg, ${c.accent}15, ${c.accent}05)`,
                border: `1px solid ${c.accent}30`,
              }}
            >
              <h2 className="text-white font-bold text-sm mb-2">{c.title}</h2>
              <a
                href={`mailto:${c.email}`}
                className="block text-sm font-medium mb-3 hover:underline"
                style={{ color: c.accent }}
              >
                {c.email}
              </a>
              <p className="text-[#94a3b8] text-xs leading-relaxed">{c.blurb}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#1a1a3e]/60 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-bold text-sm mb-2">Response time</h3>
          <p className="text-[#94a3b8] text-sm">
            We aim to reply within one business day, Monday–Friday. For
            urgent account issues, email{' '}
            <a href="mailto:support@gamebuddi.com" className="text-[#06b6d4] hover:underline">
              support@gamebuddi.com
            </a>{' '}
            with &ldquo;URGENT&rdquo; in the subject line.
          </p>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10 px-4 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#475569]">
          <span>&copy; {new Date().getFullYear()} GameBuddi. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/landing" className="hover:text-white transition-colors">Home</Link>
            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
