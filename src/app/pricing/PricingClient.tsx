'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { TIERS, PRICING_FAQS, type TierDisplay } from './pricing-data'

type Audience = 'b2c' | 'b2b'
type Cadence = 'monthly' | 'annual'

function getStoredFamilyId(): string | null {
  try {
    const raw = localStorage.getItem('retroride-family')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.family?.id ?? null
  } catch {
    return null
  }
}

function planKeyFor(tier: TierDisplay, cadence: Cadence): string | null {
  return cadence === 'monthly' ? tier.monthlyKey : tier.annualKey
}

function TierCard({
  tier,
  cadence,
  onSelect,
  busy,
}: {
  tier: TierDisplay
  cadence: Cadence
  onSelect: (tier: TierDisplay) => void
  busy: string | null
}) {
  const price =
    tier.monthlyPrice === null
      ? 'Custom'
      : tier.monthlyPrice === 0
        ? '$0'
        : cadence === 'monthly'
          ? `$${tier.monthlyPrice}`
          : `$${tier.annualPrice}`
  const period =
    tier.monthlyPrice === null
      ? 'annual invoice'
      : tier.monthlyPrice === 0
        ? 'forever'
        : cadence === 'monthly'
          ? 'per month'
          : 'per year'
  const savings =
    tier.monthlyPrice && tier.annualPrice && cadence === 'annual'
      ? Math.round((1 - tier.annualPrice / (tier.monthlyPrice * 12)) * 100)
      : null
  const isBusy = busy === tier.id

  return (
    <div
      className={`relative rounded-2xl p-6 flex flex-col transition-all duration-300 hover:-translate-y-1 ${
        tier.featured
          ? 'bg-gradient-to-b from-[#8b5cf6]/20 to-[#06b6d4]/10 border-2 border-[#8b5cf6]/60 shadow-[0_0_40px_rgba(139,92,246,0.2)]'
          : 'bg-[#1a1a3e]/80 border border-white/10'
      }`}
    >
      {tier.badge && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#f59e0b] to-[#f97316] text-black font-bold px-3 py-1 rounded-full whitespace-nowrap"
          style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '8px' }}
        >
          {tier.badge}
        </span>
      )}
      <h3
        className="text-white font-bold mb-1 mt-1"
        style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '13px' }}
      >
        {tier.name}
      </h3>
      <p className="text-[#94a3b8] text-xs mb-4">{tier.tagline}</p>
      <div className="mb-1">
        <span className="text-4xl font-bold text-white">{price}</span>
      </div>
      <p className="text-[#94a3b8] text-sm mb-1">{period}</p>
      <p className="text-emerald-400 text-xs mb-4 h-4">
        {savings && savings > 0 ? `Save ${savings}% vs monthly` : '\u00A0'}
      </p>
      <ul className="text-sm text-[#94a3b8] space-y-2 mb-6 text-left flex-1">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-400 mt-0.5">&#10003;</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSelect(tier)}
        disabled={isBusy}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 text-center block disabled:opacity-60 ${
          tier.featured
            ? 'bg-gradient-to-r from-[#8b5cf6] to-[#06b6d4] text-white hover:shadow-[0_0_25px_rgba(139,92,246,0.4)] hover:scale-105'
            : 'bg-white/10 text-white hover:bg-white/20'
        }`}
      >
        {isBusy ? 'Opening checkout…' : tier.cta}
      </button>
    </div>
  )
}

function PricingInner() {
  const searchParams = useSearchParams()
  const [audience, setAudience] = useState<Audience>('b2c')
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Deep link: /pricing?plan=family_annual preselects toggles.
  useEffect(() => {
    const plan = searchParams.get('plan')
    if (!plan) return
    const tier = TIERS.find((t) => t.monthlyKey === plan || t.annualKey === plan)
    if (tier) {
      setAudience(tier.audience === 'b2b' ? 'b2b' : 'b2c')
      if (tier.annualKey === plan) setCadence('annual')
    }
  }, [searchParams])

  const visibleTiers = TIERS.filter((t) =>
    audience === 'b2c' ? t.audience === 'b2c' || t.audience === 'both' : t.audience === 'b2b' || t.audience === 'both'
  )

  async function handleSelect(tier: TierDisplay) {
    setNotice(null)
    if (tier.id === 'free') {
      window.location.assign('/')
      return
    }
    if (tier.id === 'enterprise') {
      window.location.assign('mailto:hello@gamebuddi.com?subject=Enterprise%20inquiry')
      return
    }
    const planKey = planKeyFor(tier, cadence)
    if (!planKey) return

    const familyId = getStoredFamilyId()
    if (!familyId) {
      // No family yet — send through the create flow, then back here.
      window.location.assign(`/family?plan=${planKey}`)
      return
    }

    setBusy(tier.id)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId, plan: planKey }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.assign(data.url)
        return
      }
      setNotice(data.error || 'Something went wrong starting checkout. Please try again.')
    } catch {
      setNotice('Something went wrong starting checkout. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-slate-100">
      {/* Header */}
      <header className="border-b border-white/5 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-2xl">🕹️</span>
            <span className="neon-text text-sm" style={{ fontFamily: "'Press Start 2P', monospace" }}>
              GameBuddi
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-[#94a3b8]">
            <Link href="/" className="hover:text-white transition-colors">Games</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/family" className="hover:text-white transition-colors">Family Mode</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 pt-16 pb-8 text-center">
        <h1
          className="neon-text text-2xl sm:text-3xl mb-6"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Unlock the Full Arcade
        </h1>
        <p className="text-[#94a3b8] text-lg max-w-xl mx-auto">
          30+ classic games. Tournaments. Offline-first. Pick the plan that fits your family,
          your squad, or your classroom.
        </p>
      </section>

      {/* Toggles */}
      <div className="sticky top-0 z-10 bg-[#0a0a1a]/95 backdrop-blur border-b border-white/5 px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4">
          <div className="inline-flex rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setAudience('b2c')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                audience === 'b2c' ? 'bg-[#8b5cf6] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Families &amp; Friends
            </button>
            <button
              onClick={() => setAudience('b2b')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                audience === 'b2b' ? 'bg-[#8b5cf6] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Schools &amp; Organizations
            </button>
          </div>
          <div className="inline-flex rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setCadence('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                cadence === 'monthly' ? 'bg-[#06b6d4] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCadence('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                cadence === 'annual' ? 'bg-[#06b6d4] text-white' : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Annual <span className="text-emerald-300">(save up to 35%)</span>
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <div className="max-w-2xl mx-auto mt-6 px-4">
          <p className="text-center text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
            {notice}
          </p>
        </div>
      )}

      {/* Tier cards */}
      <section className="px-4 py-12 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {visibleTiers.map((t) => (
            <TierCard key={t.id} tier={t} cadence={cadence} onSelect={handleSelect} busy={busy} />
          ))}
        </div>
        <p className="text-center text-[#64748b] text-xs mt-8">
          Stripe-secured checkout · All major cards · Apple Pay &amp; Google Pay · Cancel anytime · No contracts
        </p>
      </section>

      {/* FAQ */}
      <section className="px-4 py-12 max-w-3xl mx-auto">
        <h2
          className="neon-text text-xl text-center mb-10"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          Questions?
        </h2>
        <div className="space-y-3">
          {PRICING_FAQS.map((f, i) => (
            <details key={i} className="group bg-[#1a1a3e]/60 border border-white/10 rounded-xl px-5 py-4">
              <summary className="cursor-pointer text-white font-semibold text-sm list-none flex items-center justify-between">
                {f.q}
                <span className="text-[#8b5cf6] group-open:rotate-45 transition-transform text-lg">+</span>
              </summary>
              <p className="text-[#94a3b8] text-sm mt-3 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="text-center text-[#64748b] text-sm mt-8">
          Plan or refund questions? Email{' '}
          <a href="mailto:billing@gamebuddi.com" className="text-[#06b6d4] hover:underline">
            billing@gamebuddi.com
          </a>{' '}
          — we reply within one business day.
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4 mt-10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#475569]">
          <span>&copy; {new Date().getFullYear()} GameBuddi. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors">Games</Link>
            <Link href="/landing" className="hover:text-white transition-colors">About</Link>
            <Link href="/blog" className="hover:text-white transition-colors">Blog</Link>
            <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function PricingClient() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a]" />}>
      <PricingInner />
    </Suspense>
  )
}
