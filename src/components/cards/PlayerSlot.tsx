'use client'

import type { Player } from '@/lib/multiplayer-game'

interface PlayerSlotProps {
  player: Player
  isCurrentTurn: boolean
  position: 'top' | 'left' | 'right' | 'top-left' | 'top-right'
}

const POSITION_STYLES: Record<PlayerSlotProps['position'], string> = {
  'top':       'flex-col items-center',
  'left':      'flex-row items-center',
  'right':     'flex-row-reverse items-center',
  'top-left':  'flex-col items-center',
  'top-right': 'flex-col items-center',
}

export default function PlayerSlot({
  player,
  isCurrentTurn,
  position,
}: PlayerSlotProps) {
  const cardFanCount = Math.min(player.handSize, 7)

  return (
    <div className={`flex gap-2 ${POSITION_STYLES[position]}`}>
      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="relative rounded-full overflow-hidden transition-all duration-500"
          style={{
            width: 40,
            height: 40,
            boxShadow: isCurrentTurn
              ? '0 0 16px #a78bfa80, 0 0 4px #a78bfa'
              : '0 2px 8px #00000040',
            border: isCurrentTurn
              ? '2px solid #a78bfa'
              : '2px solid #2d2a3e',
          }}
        >
          {/* Avatar display */}
          <div className="w-full h-full flex items-center justify-center bg-[#1e1b2e] text-lg">
            {player.avatar || player.name.charAt(0).toUpperCase()}
          </div>
          {/* Turn pulse */}
          {isCurrentTurn && (
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                animation: 'turnPulse 2s ease-in-out infinite',
                border: '2px solid #a78bfa',
              }}
            />
          )}
        </div>

        <span className="text-[10px] text-[#ccc] font-medium truncate max-w-[64px] text-center">
          {player.name}
        </span>

        {/* Score */}
        <span className="text-[9px] text-[#888] font-mono">
          {player.score} pts
        </span>

        {/* Connection indicator */}
        {!player.isConnected && (
          <span className="text-[8px] text-red-400">Disconnected</span>
        )}
      </div>

      {/* Mini card fan showing hand size */}
      {cardFanCount > 0 && (
        <div className="relative flex items-center justify-center" style={{ width: 50, height: 30 }}>
          {Array.from({ length: cardFanCount }, (_, i) => {
            const angle = cardFanCount <= 1
              ? 0
              : ((i / (cardFanCount - 1)) * 2 - 1) * 15
            return (
              <div
                key={i}
                className="absolute rounded-sm"
                style={{
                  width: 16,
                  height: 22,
                  background: 'linear-gradient(145deg, #2a1f4e, #1a1335)',
                  border: '1px solid #2d2a3e',
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: 'bottom center',
                  left: '50%',
                  marginLeft: -8,
                }}
              />
            )
          })}
          {/* Card count badge */}
          <div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full px-1 text-[8px] font-bold font-mono z-10"
            style={{
              background: '#1e1b2e',
              color: '#a78bfa',
              border: '1px solid #2d2a3e',
            }}
          >
            {player.handSize}
          </div>
        </div>
      )}

      {/* Turn animation keyframes */}
      <style jsx>{`
        @keyframes turnPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0; transform: scale(1.4); }
        }
      `}</style>
    </div>
  )
}
