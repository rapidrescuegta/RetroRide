'use client'

import type { Card } from '@/lib/card-engine'
import type { ReactNode } from 'react'
import PlayingCard from './PlayingCard'

interface GameTableProps {
  discardPile?: Card[]
  deckCount?: number
  centerCards?: Card[]
  children?: ReactNode
  onDeckClick?: () => void
  onDiscardClick?: () => void
}

export default function GameTable({
  discardPile = [],
  deckCount = 0,
  centerCards = [],
  children,
  onDeckClick,
  onDiscardClick,
}: GameTableProps) {
  const topDiscard = discardPile.length > 0 ? discardPile[discardPile.length - 1] : null

  return (
    <div className="relative w-full flex-1 flex items-center justify-center">
      {/* Table surface */}
      <div
        className="relative w-full max-w-lg mx-auto rounded-2xl p-6 flex flex-col items-center gap-4"
        style={{
          background: 'radial-gradient(ellipse at center, #12101f 0%, #0a0914 80%)',
          border: '1px solid #1f1b35',
          boxShadow: '0 0 40px #a78bfa08, inset 0 0 60px #00000040',
          minHeight: 180,
        }}
      >
        {/* Deck + Discard row */}
        <div className="flex items-center gap-6">
          {/* Draw deck */}
          <div className="flex flex-col items-center gap-1">
            {deckCount > 0 ? (
              <button
                type="button"
                onClick={onDeckClick}
                className="relative transition-transform duration-150 hover:scale-105 active:scale-95"
                aria-label={`Draw pile: ${deckCount} cards`}
              >
                {/* Stacked cards effect */}
                <div
                  className="absolute rounded-lg"
                  style={{
                    width: 64, height: 90,
                    background: '#1a1335',
                    border: '1px solid #2d2a3e',
                    top: -3, left: 2,
                  }}
                />
                <div
                  className="absolute rounded-lg"
                  style={{
                    width: 64, height: 90,
                    background: '#1e1640',
                    border: '1px solid #2d2a3e',
                    top: -1.5, left: 1,
                  }}
                />
                <PlayingCard
                  card={{ id: 'deck', suit: 'spades', rank: 'A', value: 0, faceUp: false }}
                  faceUp={false}
                  size="md"
                />
              </button>
            ) : (
              <div
                className="rounded-lg border-2 border-dashed flex items-center justify-center"
                style={{
                  width: 64, height: 90,
                  borderColor: '#2d2a3e',
                }}
              >
                <span className="text-[#2d2a3e] text-xs">Empty</span>
              </div>
            )}
            <span className="text-[10px] text-[#888] font-mono">
              {deckCount > 0 ? `${deckCount}` : ''}
            </span>
          </div>

          {/* Discard pile */}
          <div className="flex flex-col items-center gap-1">
            {topDiscard ? (
              <button
                type="button"
                onClick={onDiscardClick}
                className="relative transition-transform duration-150 hover:scale-105"
                aria-label="Discard pile"
              >
                {/* Shadow of cards beneath */}
                {discardPile.length > 1 && (
                  <div
                    className="absolute rounded-lg"
                    style={{
                      width: 64, height: 90,
                      background: '#151322',
                      border: '1px solid #2d2a3e',
                      top: -2, left: 1,
                    }}
                  />
                )}
                <PlayingCard card={topDiscard} faceUp size="md" />
              </button>
            ) : (
              <div
                className="rounded-lg border-2 border-dashed flex items-center justify-center"
                style={{
                  width: 64, height: 90,
                  borderColor: '#2d2a3e',
                }}
              >
                <span className="text-[#2d2a3e] text-xs">Discard</span>
              </div>
            )}
            <span className="text-[10px] text-[#888] font-mono">
              {discardPile.length > 0 ? `${discardPile.length}` : ''}
            </span>
          </div>
        </div>

        {/* Center cards (played tricks, etc.) */}
        {centerCards.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {centerCards.map(card => (
              <div
                key={card.id}
                className="transition-all duration-300 ease-out"
                style={{
                  animation: 'cardSlideIn 0.3s ease-out',
                }}
              >
                <PlayingCard card={card} faceUp size="sm" />
              </div>
            ))}
          </div>
        )}

        {/* Game-specific content */}
        {children}
      </div>

      {/* CSS animation */}
      <style jsx>{`
        @keyframes cardSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
