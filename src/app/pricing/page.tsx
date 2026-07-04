import type { Metadata } from 'next'
import { TIERS, PRICING_FAQS } from './pricing-data'
import PricingClient from './PricingClient'

export const metadata: Metadata = {
  title: 'GameBuddi Pricing — Free, Family & Group Plans',
  description:
    'Play 30+ classic arcade and card games free. Upgrade for multiplayer, tournaments, and local hotspot play — plans for families, squads, classrooms, and care centers from $4.99/mo.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'GameBuddi Pricing',
    description:
      'Free to play solo. Family multiplayer from $9.99/mo. Squad, Classroom & Care Center plans available.',
    type: 'website',
    url: 'https://www.gamebuddi.com/pricing',
  },
}

function ProductJsonLd() {
  const offers = TIERS.filter((t) => t.monthlyPrice !== null && t.monthlyPrice > 0).map((t) => ({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `GameBuddi ${t.name}`,
    description: t.tagline,
    brand: { '@type': 'Brand', name: 'GameBuddi' },
    offers: [
      {
        '@type': 'Offer',
        price: String(t.monthlyPrice),
        priceCurrency: 'USD',
        url: 'https://www.gamebuddi.com/pricing',
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        price: String(t.annualPrice),
        priceCurrency: 'USD',
        url: 'https://www.gamebuddi.com/pricing',
        availability: 'https://schema.org/InStock',
      },
    ],
  }))
  return (
    <script
      id="schema-pricing-products"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(offers) }}
    />
  )
}

function FaqJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PRICING_FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
  return (
    <script
      id="schema-pricing-faq"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export default function PricingPage() {
  return (
    <>
      <ProductJsonLd />
      <FaqJsonLd />
      <PricingClient />
    </>
  )
}
