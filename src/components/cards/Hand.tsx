'use client'

import { useRef, useState, useEffect } from 'react'
import type { Card } from '@/lib/card-engine'
import PlayingCard from './PlayingCard'

interface HandProps {
  cards: Card[]
  selectedIds?: string[]
  onCardSelect?: (cardId: string) => void
  maxVisible?: number
  size?: 'sm' | 'md' | 'lg'
}

const CARD_WIDTHS = { sm: 48, md: 64, lg: 80 }

export default function Hand({
  cards,
  selectedIds = [],
  onCardSelect,
  maxVisible,
  size = 'md',
}: HandProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [scrollOffset, setScrollOffset] = useState(0)
  const touchStartRef = useRef<number>(0)

  const visibleCards = maxVisible ? cards.slice(0, maxVisible) : cards
  const cardW = CARD_WIDTHS[size]
  const count = visibleCards.length

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(entries => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // Calculate overlap so cards fit in the container
  const minOverlap = cardW * 0.35    // minimum visible per card
  const idealSpacing = cardW * 0.7   // nice spacing when there's room
  const totalIdealWidth = count * idealSpacing + (cardW - idealSpacing)

  const spacing = containerWidth > 0 && totalIdealWidth > containerWidth && count > 1
    ? Math.max(minOverlap, (containerWidth - cardW) / (count - 1))
    : idealSpacing

  const totalWidth = count > 0 ? (count - 1) * spacing + cardW : 0
  const needsScroll = totalWidth > containerWidth && containerWidth > 0

  // Fan rotation: slight arc when 3+ cards
  const maxRotation = Math.min(count * 1.5, 15)
  const getRotation = (index: number) => {
    if (count <= 2) return 0
    const normalized = (index / (count - 1)) * 2 - 1 // -1 to 1
    return normalized * maxRotation
  }
  const getVerticalOffset = (index: number) => {
    if (count <= 2) return 0
    const normalized = (index / (count - 1)) * 2 - 1 // -1 to 1
    return Math.abs(normalized) * 8 // slight arc
  }

  // Touch scrolling for overflow
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!needsScroll) return
    const delta = touchStartRef.current - e.touches[0].clientX
    touchStartRef.current = e.touches[0].clientX
    setScrollOffset(prev => {
      const maxScroll = totalWidth - containerWidth
      return Math.max(0, Math.min(maxScroll, prev + delta))
    })
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full flex justify-center overflow-hidden py-3"
      style={{ minHeight: size === 'lg' ? 130 : size === 'md' ? 108 : 85 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      <div
        className="relative flex items-end"
        style={{
          width: totalWidth,
          transform: needsScroll ? `translateX(-${scrollOffset}px)` : undefined,
          transition: 'transform 0.1s ease-out',
        }}
      >
        {visibleCards.map((card, i) => {
          const isSelected = selectedIds.includes(card.id)
          const rotation = getRotation(i)
          const verticalOff = getVerticalOffset(i)

          return (
            <div
              key={card.id}
              className="absolute bottom-0 transition-all duration-200 ease-out"
              style={{
                left: i * spacing,
                transform: `rotate(${rotation}deg) translateY(-${verticalOff}px)`,
                transformOrigin: 'bottom center',
                zIndex: isSelected ? count + 1 : i,
              }}
            >
              <PlayingCard
                card={card}
                faceUp
                selected={isSelected}
                onClick={() => onCardSelect?.(card.id)}
                size={size}
              />
            </div>
          )
        })}
      </div>

      {/* Overflow indicators */}
      {needsScroll && scrollOffset > 5 && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a1a] to-transparent pointer-events-none z-10" />
      )}
      {needsScroll && scrollOffset < totalWidth - containerWidth - 5 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a1a] to-transparent pointer-events-none z-10" />
      )}
    </div>
  )
}
