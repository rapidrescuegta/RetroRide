'use client'

import { useState, useEffect, useRef } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import { FeedbackModal } from './FeedbackModal'

type LogEntry = {
  level: string
  message: string
  timestamp: string
}

const MAX_LOGS = 100

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([])
  const [capturing, setCapturing] = useState(false)
  const logsRef = useRef<LogEntry[]>([])

  // Intercept console logs from page load
  useEffect(() => {
    const origLog = console.log
    const origWarn = console.warn
    const origError = console.error

    const capture = (level: string, args: unknown[]) => {
      const message = args
        .map((a) => {
          if (typeof a === 'object') {
            try { return JSON.stringify(a, null, 2) } catch { return String(a) }
          }
          return String(a)
        })
        .join(' ')
      const entry: LogEntry = { level, message, timestamp: new Date().toISOString() }
      logsRef.current = [...logsRef.current.slice(-(MAX_LOGS - 1)), entry]
    }

    console.log = (...args) => { capture('log', args); origLog.apply(console, args) }
    console.warn = (...args) => { capture('warn', args); origWarn.apply(console, args) }
    console.error = (...args) => { capture('error', args); origError.apply(console, args) }

    // Also capture unhandled errors
    const onError = (e: ErrorEvent) => {
      const entry: LogEntry = {
        level: 'error',
        message: `${e.message} (${e.filename}:${e.lineno}:${e.colno})`,
        timestamp: new Date().toISOString(),
      }
      logsRef.current = [...logsRef.current.slice(-(MAX_LOGS - 1)), entry]
    }

    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const entry: LogEntry = {
        level: 'error',
        message: `Unhandled rejection: ${e.reason}`,
        timestamp: new Date().toISOString(),
      }
      logsRef.current = [...logsRef.current.slice(-(MAX_LOGS - 1)), entry]
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      console.log = origLog
      console.warn = origWarn
      console.error = origError
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  const handleClick = async () => {
    setCapturing(true)
    try {
      // Dynamic import — keeps html2canvas out of the initial bundle
      const { default: html2canvas } = await import('html2canvas')

      // Read the live body background so the screenshot matches whatever theme
      // the user sees. Falls back to the RetroRide primary bg if transparent.
      const liveBg = getComputedStyle(document.body).backgroundColor
      const backgroundColor =
        !liveBg || liveBg === 'rgba(0, 0, 0, 0)' || liveBg === 'transparent'
          ? '#0a0a1a'
          : liveBg

      const canvas = await html2canvas(document.body, {
        backgroundColor,
        useCORS: true,
        height: window.innerHeight,
        y: window.scrollY,
        scale: 1,
      })

      const maxWidth = 1200
      const ratio = Math.min(1, maxWidth / canvas.width)
      const resized = document.createElement('canvas')
      resized.width = canvas.width * ratio
      resized.height = canvas.height * ratio
      const ctx = resized.getContext('2d')
      ctx?.drawImage(canvas, 0, 0, resized.width, resized.height)

      const dataUrl = resized.toDataURL('image/jpeg', 0.5)
      setScreenshot(dataUrl)
    } catch {
      setScreenshot(null)
    }
    // Snapshot the logs at the moment they click feedback
    setConsoleLogs([...logsRef.current])
    setCapturing(false)
    setOpen(true)
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={capturing}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-50 rounded-full p-3 shadow-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
        style={{
          background:
            'linear-gradient(135deg, var(--accent-purple, #8b5cf6), var(--accent-pink, #ec4899))',
          color: '#fff',
          boxShadow:
            '0 0 20px rgba(139, 92, 246, 0.45), 0 4px 12px rgba(0, 0, 0, 0.4)',
        }}
        title="Send feedback"
      >
        {capturing ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <MessageSquarePlus size={20} />
        )}
      </button>
      {open && (
        <FeedbackModal
          screenshot={screenshot}
          consoleLogs={consoleLogs}
          onClose={() => {
            setOpen(false)
            setScreenshot(null)
            setConsoleLogs([])
          }}
        />
      )}
    </>
  )
}
