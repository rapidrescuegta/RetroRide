import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllSlugs, getPostBySlug } from '../posts'

type Params = { slug: string }

export const dynamic = 'force-static'
export const revalidate = 3600

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `/blog/${post.slug}`,
      type: 'article',
      publishedTime: post.date,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
    },
  }
}

export default async function BlogPostPage(
  { params }: { params: Promise<Params> }
) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'GameBuddi',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.gamebuddi.com/icon-512.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://www.gamebuddi.com/blog/${post.slug}`,
    },
  }

  const faqSchema =
    post.faqs && post.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faqs.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }
      : null

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <article className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/blog"
          className="text-sm text-violet-600 hover:text-violet-700 font-semibold"
        >
          ← Back to blog
        </Link>

        <p className="text-sm font-semibold uppercase tracking-wider text-violet-600 mt-8 mb-3">
          {post.category}
        </p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4 leading-tight">
          {post.title}
        </h1>
        <div className="flex items-center gap-4 text-sm text-slate-500 mb-10 pb-8 border-b border-slate-200">
          <span>{post.author}</span>
          <span aria-hidden>·</span>
          <time dateTime={post.date}>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          <span aria-hidden>·</span>
          <span>{post.readTime}</span>
        </div>

        <div
          className="max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.faqs && post.faqs.length > 0 && (
          <div className="mt-16 pt-12 border-t border-slate-200">
            <h2 className="text-2xl font-bold text-slate-900 mb-8">
              Frequently asked questions
            </h2>
            <div className="space-y-6">
              {post.faqs.map((faq, i) => (
                <div key={i}>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    {faq.q}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200">
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            Play free on GameBuddi
          </h3>
          <p className="text-slate-600 mb-6">
            30 classic games, group challenges, and multiplayer that works even without Wi-Fi.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-3 rounded-lg"
          >
            Start playing free →
          </Link>
        </div>
      </article>
    </div>
  )
}
