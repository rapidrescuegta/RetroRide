'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface GameControllerProps {
  dpad?: boolean
  buttons?: ('A' | 'B')[]
  dpadKeys?: { up: string; down: string; left: string; right: string }
  buttonKeys?: { A?: string; B?: string }
  autoHide?: boolean
}

const DEFAULT_DPAD_KEYS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }
const DEFAULT_BUTTON_KEYS = { A: ' ', B: 'Escape' }

function dispatchKey(key: string, type: 'keydown' | 'keyup') {
  const event = new KeyboardEvent(type, {
    key,
    code: key === ' ' ? 'Space' : key === 'Escape' ? 'Escape' : key,
    bubbles: true,
    cancelable: true,
  })
  window.dispatchEvent(event)
}

type Direction = 'up' | 'down' | 'left' | 'right'

export default function GameController({
  dpad = true,
  buttons = ['A'],
  dpadKeys = DEFAULT_DPAD_KEYS,
  buttonKeys = DEFAULT_BUTTON_KEYS,
  autoHide = true,
}: GameControllerProps) {
  const [isTouch, setIsTouch] = useState(false)
  const [activeDirs, setActiveDirs] = useState<Set<Direction>>(new Set())
  const [activeButtons, setActiveButtons] = useState<Set<string>>(new Set())
  const dpadRef = useRef<HTMLDivElement>(null)
  const repeatTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const activeDirsRef = useRef<Set<Direction>>(new Set())
  const mergedButtonKeys = { ...DEFAULT_BUTTON_KEYS, ...buttonKeys }

  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouch(touch)
  }, [])

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      repeatTimers.current.forEach(timer => clearInterval(timer))
      repeatTimers.current.clear()
    }
  }, [])

  const startRepeat = useCallback((key: string, id: string) => {
    if (repeatTimers.current.has(id)) return
    dispatchKey(key, 'keydown')
    const timer = setInterval(() => dispatchKey(key, 'keydown'), 100)
    repeatTimers.current.set(id, timer)
  }, [])

  const stopRepeat = useCallback((key: string, id: string) => {
    const timer = repeatTimers.current.get(id)
    if (timer) {
      clearInterval(timer)
      repeatTimers.current.delete(id)
    }
    dispatchKey(key, 'keyup')
  }, [])

  // D-pad touch handling with diagonal support
  const getDirsFromTouch = useCallback((touch: React.Touch): Set<Direction> => {
    if (!dpadRef.current) return new Set()
    const rect = dpadRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = touch.clientX - cx
    const dy = touch.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 8) return new Set() // dead zone at center

    const dirs = new Set<Direction>()
    const angle = Math.atan2(dy, dx) * (180 / Math.PI) // -180 to 180

    // Use 45-degree sectors with overlap for diagonals
    // Right: -67.5 to 67.5, Down: 22.5 to 157.5, Left: 112.5 to -112.5, Up: -157.5 to -22.5
    if (angle > -67.5 && angle < 67.5) dirs.add('right')
    if (angle > 22.5 && angle < 157.5) dirs.add('down')
    if (angle > 112.5 || angle < -112.5) dirs.add('left')
    if (angle > -157.5 && angle < -22.5) dirs.add('up')

    return dirs
  }, [])

  const updateDpad = useCallback((newDirs: Set<Direction>) => {
    const prevDirs = activeDirsRef.current
    const keys = dpadKeys

    // Stop directions that are no longer active
    prevDirs.forEach(dir => {
      if (!newDirs.has(dir)) {
        stopRepeat(keys[dir], `dpad-${dir}`)
      }
    })

    // Start directions that are newly active
    newDirs.forEach(dir => {
      if (!prevDirs.has(dir)) {
        startRepeat(keys[dir], `dpad-${dir}`)
      }
    })

    activeDirsRef.current = newDirs
    setActiveDirs(new Set(newDirs))
  }, [dpadKeys, startRepeat, stopRepeat])

  const handleDpadTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length > 0) {
      const dirs = getDirsFromTouch(e.touches[0])
      updateDpad(dirs)
    }
  }, [getDirsFromTouch, updateDpad])

  const handleDpadEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    // Check if there are still touches on the dpad
    const remaining = new Set<Direction>()
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i]
      if (dpadRef.current) {
        const rect = dpadRef.current.getBoundingClientRect()
        if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
          getDirsFromTouch(t).forEach(d => remaining.add(d))
        }
      }
    }
    updateDpad(remaining)
  }, [getDirsFromTouch, updateDpad])

  // Action button handlers
  const handleButtonStart = useCallback((btn: string, e: React.TouchEvent) => {
    e.preventDefault()
    const key = mergedButtonKeys[btn as keyof typeof mergedButtonKeys] || ' '
    startRepeat(key, `btn-${btn}`)
    setActiveButtons(prev => new Set(prev).add(btn))
  }, [mergedButtonKeys, startRepeat])

  const handleButtonEnd = useCallback((btn: string, e: React.TouchEvent) => {
    e.preventDefault()
    const key = mergedButtonKeys[btn as keyof typeof mergedButtonKeys] || ' '
    stopRepeat(key, `btn-${btn}`)
    setActiveButtons(prev => {
      const next = new Set(prev)
      next.delete(btn)
      return next
    })
  }, [mergedButtonKeys, stopRepeat])

  if (autoHide && !isTouch) return null

  return (
    <div
      className="flex-shrink-0 w-full"
      style={{
        height: '120px',
        background: 'linear-gradient(180deg, #0f0a1e, #0a0a1a)',
        borderTop: '1px solid rgba(139, 92, 246, 0.2)',
        touchAction: 'none',
      }}
    >
      <div className="flex items-center justify-between h-full px-6 max-w-lg mx-auto">
        {/* D-pad */}
        {dpad ? (
          <div
            ref={dpadRef}
            className="relative"
            style={{ width: '120px', height: '120px' }}
            onTouchStart={handleDpadTouch}
            onTouchMove={handleDpadTouch}
            onTouchEnd={handleDpadEnd}
            onTouchCancel={handleDpadEnd}
          >
            {/* Circular base */}
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: '#1a1a2e', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)' }}
            />

            {/* Cross shape */}
            {/* Vertical bar */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{
                top: '12px',
                width: '38px',
                height: '96px',
                background: '#2a2a4a',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
            {/* Horizontal bar */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                left: '12px',
                width: '96px',
                height: '38px',
                background: '#2a2a4a',
                borderRadius: '6px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />

            {/* Center dot */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ width: '10px', height: '10px', background: '#3a3a5a' }}
            />

            {/* Up arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
              style={{
                top: '14px',
                width: '34px',
                height: '28px',
                borderRadius: '4px 4px 0 0',
                transition: 'all 0.1s',
                ...(activeDirs.has('up')
                  ? { background: 'rgba(139, 92, 246, 0.4)', boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)' }
                  : {}),
              }}
            >
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M8 1L14 9H2L8 1Z" fill={activeDirs.has('up') ? '#a78bfa' : '#6b7280'} />
              </svg>
            </div>

            {/* Down arrow */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
              style={{
                bottom: '14px',
                width: '34px',
                height: '28px',
                borderRadius: '0 0 4px 4px',
                transition: 'all 0.1s',
                ...(activeDirs.has('down')
                  ? { background: 'rgba(139, 92, 246, 0.4)', boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)' }
                  : {}),
              }}
            >
              <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
                <path d="M8 9L2 1H14L8 9Z" fill={activeDirs.has('down') ? '#a78bfa' : '#6b7280'} />
              </svg>
            </div>

            {/* Left arrow */}
            <div
              className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                left: '14px',
                width: '28px',
                height: '34px',
                borderRadius: '4px 0 0 4px',
                transition: 'all 0.1s',
                ...(activeDirs.has('left')
                  ? { background: 'rgba(139, 92, 246, 0.4)', boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)' }
                  : {}),
              }}
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M1 8L9 2V14L1 8Z" fill={activeDirs.has('left') ? '#a78bfa' : '#6b7280'} />
              </svg>
            </div>

            {/* Right arrow */}
            <div
              className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center"
              style={{
                right: '14px',
                width: '28px',
                height: '34px',
                borderRadius: '0 4px 4px 0',
                transition: 'all 0.1s',
                ...(activeDirs.has('right')
                  ? { background: 'rgba(139, 92, 246, 0.4)', boxShadow: '0 0 12px rgba(139, 92, 246, 0.6)' }
                  : {}),
              }}
            >
              <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
                <path d="M9 8L1 14V2L9 8Z" fill={activeDirs.has('right') ? '#a78bfa' : '#6b7280'} />
              </svg>
            </div>
          </div>
        ) : (
          <div style={{ width: '120px' }} />
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          {buttons.includes('B') && (
            <button
              className="relative flex items-center justify-center rounded-full font-bold text-sm select-none"
              style={{
                width: '52px',
                height: '52px',
                background: activeButtons.has('B')
                  ? 'radial-gradient(circle, #f472b6, #ec4899)'
                  : 'radial-gradient(circle, #ec4899, #be185d)',
                boxShadow: activeButtons.has('B')
                  ? '0 0 16px rgba(236, 72, 153, 0.7), inset 0 -2px 4px rgba(0,0,0,0.2)'
                  : '0 4px 8px rgba(0,0,0,0.3), inset 0 -3px 4px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.15)',
                transform: activeButtons.has('B') ? 'scale(0.93)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s',
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
              onTouchStart={(e) => handleButtonStart('B', e)}
              onTouchEnd={(e) => handleButtonEnd('B', e)}
              onTouchCancel={(e) => handleButtonEnd('B', e)}
            >
              B
            </button>
          )}
          {buttons.includes('A') && (
            <button
              className="relative flex items-center justify-center rounded-full font-bold text-sm select-none"
              style={{
                width: '52px',
                height: '52px',
                background: activeButtons.has('A')
                  ? 'radial-gradient(circle, #22d3ee, #06b6d4)'
                  : 'radial-gradient(circle, #06b6d4, #0e7490)',
                boxShadow: activeButtons.has('A')
                  ? '0 0 16px rgba(6, 182, 212, 0.7), inset 0 -2px 4px rgba(0,0,0,0.2)'
                  : '0 4px 8px rgba(0,0,0,0.3), inset 0 -3px 4px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.15)',
                transform: activeButtons.has('A') ? 'scale(0.93)' : 'scale(1)',
                transition: 'transform 0.08s, box-shadow 0.08s',
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
              onTouchStart={(e) => handleButtonStart('A', e)}
              onTouchEnd={(e) => handleButtonEnd('A', e)}
              onTouchCancel={(e) => handleButtonEnd('A', e)}
            >
              A
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
