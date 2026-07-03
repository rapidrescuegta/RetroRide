import type { Metadata } from 'next'
import Link from 'next/link'
import { posts } from './posts'

export const metadata: Metadata = {
  title: 'GameBuddi Blog — Game Guides for Families & Friends',
  description:
    'Honest guides to playing card games online and offline with friends and family — cribbage, euchre, offline multiplayer, travel games, and more.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: 'GameBuddi Blog — Game Guides for Families & Friends',
    description:
      'Honest guides to playing card games online and offline with friends and family — cribbage, euchre, offline multiplayer, travel games, and more.',
    url: '/blog',
    type: 'website',
  },
}

export const dynamic = 'force-static'
export const revalidate = 3600

export default function BlogIndexPage() {
  const sorted = [...posts].sort((a, b) => (a.date < b.date ? 1 : -1))

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-12">
          <p className="text-sm font-semibold uppercase tracking-wider text-violet-600 mb-3">
            GameBuddi Blog
          </p>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Game guides for families &amp; friends
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl">
            Honest, practical guides to playing card games with the people you actually know —
            online, offline, on planes, at cottages, and everywhere Wi-Fi fails.
          </p>
        </div>

        <div className="space-y-10">
          {sorted.map((post) => (
            <article key={post.slug} className="border-b border-slate-200 pb-10 last:border-b-0">
              <p className="text-sm font-semibold uppercase tracking-wider text-violet-600 mb-2">
                {post.category}
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mb-3 leading-tight">
                <Link href={`/blog/${post.slug}`} className="hover:text-violet-600">
                  {post.title}
                </Link>
              </h2>
              <p className="text-slate-600 mb-4 leading-relaxed">{post.excerpt}</p>
              <div className="flex items-center gap-4 text-sm text-slate-500">
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
              <Link
                href={`/blog/${post.slug}`}
                className="inline-flex items-center gap-2 mt-4 text-violet-600 font-semibold hover:text-violet-700"
              >
                Read the guide →
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200">
          <h3 className="text-2xl font-bold text-slate-900 mb-3">Play free on GameBuddi</h3>
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
      </div>
    </div>
  )
}
