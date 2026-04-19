'use client'

import { useState } from 'react'
import { X, Send, Bug, Lightbulb, HelpCircle } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useFamily } from '@/lib/family-context'

const CATEGORIES = [
  { value: 'bug', label: 'Bug', icon: Bug },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb },
  { value: 'question', label: 'Question', icon: HelpCircle },
] as const

type LogEntry = {
  level: string
  message: string
  timestamp: string
}

interface FeedbackModalProps {
  screenshot: string | null
  consoleLogs: LogEntry[]
  onClose: () => void
}

export function FeedbackModal({ screenshot, consoleLogs, onClose }: FeedbackModalProps) {
  const pathname = usePathname()
  const family = useFamily()
  const [comment, setComment] = useState('')
  const [category, setCategory] = useState<string>('bug')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!comment.trim()) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comment,
          screenshot,
          consoleLogs,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          category,
          memberId: family?.member?.id ?? null,
          familyId: family?.family?.id ?? null,
          userName: family?.member?.name ?? null,
        }),
      })
      if (res.ok) {
        setSent(true)
        setTimeout(onClose, 1500)
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to send feedback')
      }
    } catch {
      setError('Network error — please try again')
    }
    setSending(false)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'var(--bg-card, #1a1a3e)',
          border: '1px solid rgba(139, 92, 246, 0.35)',
          boxShadow:
            '0 0 40px rgba(139, 92, 246, 0.25), 0 20px 60px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{
            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
            background:
              'linear-gradient(90deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.08))',
          }}
        >
          <h2
            className="font-bold text-base tracking-wide"
            style={{ color: 'var(--text-primary, #f1f5f9)' }}
          >
            Send Feedback
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="transition-colors"
            style={{ color: 'var(--text-secondary, #94a3b8)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {sent ? (
            <div className="text-center py-8">
              <div
                className="text-lg font-bold mb-1"
                style={{ color: 'var(--accent-green, #10b981)' }}
              >
                Thanks!
              </div>
              <div style={{ color: 'var(--text-secondary, #94a3b8)' }} className="text-sm">
                Your feedback has been submitted.
              </div>
            </div>
          ) : (
            <>
              {/* Screenshot preview */}
              {screenshot && (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid rgba(139, 92, 246, 0.25)' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshot}
                    alt="Screenshot"
                    className="w-full h-40 object-cover object-top"
                  />
                </div>
              )}

              {/* Category selector */}
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(({ value, label, icon: Icon }) => {
                  const active = category === value
                  return (
                    <button
                      key={value}
                      onClick={() => setCategory(value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{
                        background: active
                          ? 'rgba(139, 92, 246, 0.2)'
                          : 'transparent',
                        color: active
                          ? 'var(--accent-purple, #8b5cf6)'
                          : 'var(--text-secondary, #94a3b8)',
                        border: active
                          ? '1px solid rgba(139, 92, 246, 0.5)'
                          : '1px solid rgba(148, 163, 184, 0.25)',
                      }}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  )
                })}
              </div>

              {/* Comment */}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Describe what happened or what you'd like to see..."
                className="w-full h-28 rounded-lg px-3 py-2.5 text-sm resize-none outline-none focus:ring-2"
                style={{
                  background: 'var(--bg-secondary, #12122a)',
                  color: 'var(--text-primary, #f1f5f9)',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  // @ts-expect-error — CSS custom property fallback for ring
                  '--tw-ring-color': 'rgba(139, 92, 246, 0.45)',
                }}
                autoFocus
              />

              {/* Page context */}
              <div
                className="text-xs font-mono truncate"
                style={{ color: 'var(--text-secondary, #94a3b8)', opacity: 0.7 }}
              >
                Page: {pathname}
                {consoleLogs.length > 0 && (
                  <> &middot; {consoleLogs.length} console log{consoleLogs.length === 1 ? '' : 's'} captured</>
                )}
              </div>

              {error && (
                <div
                  className="text-xs px-3 py-2 rounded-lg"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div
            className="flex justify-end gap-3 px-5 py-4"
            style={{ borderTop: '1px solid rgba(139, 92, 246, 0.2)' }}
          >
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-secondary, #94a3b8)' }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!comment.trim() || sending}
              className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-all disabled:opacity-50 hover:scale-105 active:scale-95"
              style={{
                background:
                  'linear-gradient(135deg, var(--accent-purple, #8b5cf6), var(--accent-pink, #ec4899))',
                color: '#fff',
                boxShadow: '0 0 20px rgba(139, 92, 246, 0.35)',
              }}
            >
              <Send size={14} />
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
