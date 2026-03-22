'use client'

import type { ReactNode } from 'react'
import type { Player } from '@/lib/multiplayer-game'
import PlayerSlot from './PlayerSlot'

interface GameLayoutProps {
  players: Player[]
  currentPlayerId: string
  currentTurnId: string
  topContent?: ReactNode
  centerContent?: ReactNode
  bottomContent?: ReactNode
}

type SlotPosition = 'top' | 'left' | 'right' | 'top-left' | 'top-right'

/**
 * Distributes opponent players around the table.
 * 1 opponent  -> top
 * 2 opponents -> left, right
 * 3 opponents -> left, top, right
 * 4 opponents -> top-left, top, top-right, (left or right)
 */
function getPositions(count: number): SlotPosition[] {
  switch (count) {
    case 0: return []
    case 1: return ['top']
    case 2: return ['left', 'right']
    case 3: return ['left', 'top', 'right']
    case 4: return ['top-left', 'top', 'top-right', 'left']
    case 5: return ['top-left', 'top', 'top-right', 'left', 'right']
    default: return ['top-left', 'top', 'top-right', 'left', 'right']
  }
}

const POSITION_CLASSES: Record<SlotPosition, string> = {
  'top':       'col-start-2 row-start-1 justify-self-center self-start',
  'left':      'col-start-1 row-start-2 justify-self-start self-center',
  'right':     'col-start-3 row-start-2 justify-self-end self-center',
  'top-left':  'col-start-1 row-start-1 justify-self-start self-start',
  'top-right': 'col-start-3 row-start-1 justify-self-end self-start',
}

export default function GameLayout({
  players,
  currentPlayerId,
  currentTurnId,
  topContent,
  centerContent,
  bottomContent,
}: GameLayoutProps) {
  const opponents = players.filter(p => p.id !== currentPlayerId)
  const positions = getPositions(opponents.length)

  return (
    <div
      className="relative w-full h-full min-h-[100dvh] flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at 50% 30%, #0f0d1f 0%, #0a0a1a 50%, #050510 100%)',
      }}
    >
      {/* Top bar: game info, turn indicator */}
      {topContent && (
        <div className="flex-shrink-0 px-4 pt-3 pb-1 z-10">
          {topContent}
        </div>
      )}

      {/* Main game area: opponents + table */}
      <div className="flex-1 grid grid-cols-[60px_1fr_60px] grid-rows-[auto_1fr] gap-2 px-2 py-2 min-h-0">
        {/* Opponent slots */}
        {opponents.map((player, i) => {
          const pos = positions[i] ?? 'top'
          return (
            <div key={player.id} className={`${POSITION_CLASSES[pos]} z-10`}>
              <PlayerSlot
                player={player}
                isCurrentTurn={player.id === currentTurnId}
                position={pos}
              />
            </div>
          )
        })}

        {/* Center table */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          {centerContent}
        </div>
      </div>

      {/* Bottom: current player's hand + actions */}
      <div className="flex-shrink-0 px-2 pb-3 z-10">
        {/* Turn indicator for current player */}
        {currentTurnId === currentPlayerId && (
          <div className="text-center mb-1">
            <span
              className="inline-block text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full"
              style={{
                background: 'linear-gradient(90deg, #a78bfa20, #06b6d420)',
                color: '#a78bfa',
                border: '1px solid #a78bfa40',
                animation: 'yourTurnGlow 2s ease-in-out infinite',
              }}
            >
              Your Turn
            </span>
          </div>
        )}
        {bottomContent}
      </div>

      {/* Ambient glow effects */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #a78bfa06, transparent)' }}
      />

      <style jsx>{`
        @keyframes yourTurnGlow {
          0%, 100% { box-shadow: 0 0 8px #a78bfa30; }
          50% { box-shadow: 0 0 20px #a78bfa50; }
        }
      `}</style>
    </div>
  )
}
