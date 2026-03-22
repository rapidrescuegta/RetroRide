'use client'

import { type Card, SUIT_SYMBOLS, SUIT_COLORS } from '@/lib/card-engine'

interface PlayingCardProps {
  card: Card
  faceUp?: boolean
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { w: 48, h: 67, text: 'text-[10px]', symbol: 'text-sm', center: 'text-lg' },
  md: { w: 64, h: 90, text: 'text-xs', symbol: 'text-base', center: 'text-2xl' },
  lg: { w: 80, h: 112, text: 'text-sm', symbol: 'text-lg', center: 'text-3xl' },
} as const

const FACE_CARD_LABELS: Record<string, string> = {
  J: '♞',   // Knight symbol for Jack
  Q: '♛',   // Crown for Queen
  K: '♚',   // Crown for King
}

export default function PlayingCard({
  card,
  faceUp = true,
  selected = false,
  onClick,
  size = 'md',
}: PlayingCardProps) {
  const s = SIZES[size]
  const showFace = faceUp && card.faceUp !== false
  const color = SUIT_COLORS[card.suit]
  const symbol = SUIT_SYMBOLS[card.suit]
  const isFaceCard = ['J', 'Q', 'K'].includes(card.rank)
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex-shrink-0 select-none transition-all duration-200 ease-out"
      style={{
        width: s.w,
        height: s.h,
        transform: selected ? 'translateY(-8px)' : 'translateY(0)',
        filter: selected
          ? `drop-shadow(0 0 12px ${isRed ? '#ef444480' : '#a78bfa80'})`
          : 'none',
      }}
      aria-label={showFace ? `${card.rank} of ${card.suit}` : 'Face-down card'}
    >
      {showFace ? (
        /* ── Face-up card ── */
        <div
          className="relative w-full h-full rounded-lg overflow-hidden border transition-transform duration-150 hover:scale-[1.03]"
          style={{
            background: 'linear-gradient(145deg, #1e1b2e 0%, #151322 100%)',
            borderColor: selected
              ? isRed ? '#ef4444' : '#a78bfa'
              : '#2d2a3e',
            boxShadow: isFaceCard
              ? `0 0 16px ${isRed ? '#ef444430' : '#a78bfa30'}, inset 0 1px 0 #ffffff08`
              : 'inset 0 1px 0 #ffffff08',
          }}
        >
          {/* Top-left rank + suit */}
          <div className="absolute top-0.5 left-1 flex flex-col items-center leading-none" style={{ color }}>
            <span className={`${s.text} font-bold`}>{card.rank}</span>
            <span className={s.text} style={{ lineHeight: 1 }}>{symbol}</span>
          </div>

          {/* Center symbol */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color }}
          >
            {isFaceCard ? (
              <span className={`${s.center} opacity-90`}>
                {FACE_CARD_LABELS[card.rank]}
              </span>
            ) : (
              <span className={s.center}>{symbol}</span>
            )}
          </div>

          {/* Bottom-right rank + suit (inverted) */}
          <div
            className="absolute bottom-0.5 right-1 flex flex-col items-center leading-none rotate-180"
            style={{ color }}
          >
            <span className={`${s.text} font-bold`}>{card.rank}</span>
            <span className={s.text} style={{ lineHeight: 1 }}>{symbol}</span>
          </div>

          {/* Subtle inner glow for face cards */}
          {isFaceCard && (
            <div
              className="absolute inset-0 rounded-lg pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${isRed ? '#ef444410' : '#a78bfa10'} 0%, transparent 70%)`,
              }}
            />
          )}
        </div>
      ) : (
        /* ── Card back ── */
        <div
          className="w-full h-full rounded-lg overflow-hidden border border-[#2d2a3e] transition-transform duration-150 hover:scale-[1.03]"
          style={{
            background: 'linear-gradient(145deg, #2a1f4e 0%, #1a1335 100%)',
          }}
        >
          {/* Diamond pattern on card back */}
          <div className="absolute inset-1 rounded-md border border-[#ffffff10] flex items-center justify-center overflow-hidden">
            <div
              className="w-full h-full opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #a78bfa 25%, transparent 25%),
                  linear-gradient(-45deg, #a78bfa 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #a78bfa 75%),
                  linear-gradient(-45deg, transparent 75%, #a78bfa 75%)
                `,
                backgroundSize: `${Math.round(s.w / 5)}px ${Math.round(s.w / 5)}px`,
                backgroundPosition: `0 0, 0 ${Math.round(s.w / 10)}px, ${Math.round(s.w / 10)}px -${Math.round(s.w / 10)}px, -${Math.round(s.w / 10)}px 0`,
              }}
            />
          </div>
          {/* Center emblem */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full flex items-center justify-center"
              style={{
                width: Math.round(s.w * 0.4),
                height: Math.round(s.w * 0.4),
                background: 'radial-gradient(circle, #a78bfa30, transparent)',
              }}
            >
              <span className="text-[#a78bfa60]" style={{ fontSize: Math.round(s.w * 0.2) }}>
                ♠
              </span>
            </div>
          </div>
        </div>
      )}
    </button>
  )
}
