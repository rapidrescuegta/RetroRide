'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface QRScannerProps {
  onScan: (data: string) => void
  onError?: (err: string) => void
}

export default function QRScanner({ onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [scanning, setScanning] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [error, setError] = useState('')
  const scanningRef = useRef(false)

  const stopCamera = useCallback(() => {
    scanningRef.current = false
    setScanning(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startScanning = useCallback(async () => {
    setError('')
    setScanning(true)
    scanningRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // Check if BarcodeDetector is available
      if (!('BarcodeDetector' in window)) {
        setShowManual(true)
        setError('Camera scanning not supported on this device.')
        stopCamera()
        return
      }

      // @ts-expect-error BarcodeDetector is not in TS lib types yet
      const detector = new BarcodeDetector({ formats: ['qr_code'] })

      const poll = async () => {
        if (!scanningRef.current || !videoRef.current) return

        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const value = barcodes[0].rawValue
            if (value) {
              stopCamera()
              onScan(value)
              return
            }
          }
        } catch {
          // detect() can fail if video isn't ready
        }

        if (scanningRef.current) {
          setTimeout(poll, 200)
        }
      }

      // Start polling after a brief delay to let video stabilize
      setTimeout(poll, 500)
    } catch (err: any) {
      const msg = err?.message || 'Could not access camera'
      setError(msg)
      onError?.(msg)
      setShowManual(true)
      stopCamera()
    }
  }, [onScan, onError, stopCamera])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      scanningRef.current = false
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  const handleManualSubmit = () => {
    const trimmed = manualCode.trim()
    if (trimmed) {
      onScan(trimmed)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Camera view */}
      {scanning && (
        <div className="relative rounded-xl overflow-hidden border border-purple-500/30"
          style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.2)' }}
        >
          <video
            ref={videoRef}
            className="w-64 h-64 object-cover bg-black"
            playsInline
            muted
          />

          {/* Scanning overlay with corner markers */}
          <div className="absolute inset-0 pointer-events-none">
            {/* Scan region */}
            <div className="absolute inset-8">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyan-400" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyan-400" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyan-400" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyan-400" />
            </div>

            {/* Scanning line animation */}
            <div
              className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
              style={{
                animation: 'scanLine 2s ease-in-out infinite',
                top: '50%',
              }}
            />
          </div>

          <style>{`
            @keyframes scanLine {
              0%, 100% { transform: translateY(-60px); opacity: 0.3; }
              50% { transform: translateY(60px); opacity: 1; }
            }
          `}</style>

          {/* Cancel button */}
          <button
            onClick={stopCamera}
            className="absolute bottom-2 right-2 px-3 py-1 bg-red-600/80 text-white text-xs rounded-lg hover:bg-red-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Scan button */}
      {!scanning && (
        <button
          onClick={startScanning}
          className="touch-btn px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-semibold text-sm hover:from-cyan-500 hover:to-purple-500 transition-all"
          style={{ boxShadow: '0 0 20px rgba(6, 182, 212, 0.3)' }}
        >
          Scan QR Code
        </button>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-400 text-center">{error}</p>
      )}

      {/* Manual paste fallback */}
      <button
        onClick={() => setShowManual(!showManual)}
        className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
      >
        {showManual ? 'Hide manual input' : "Can't scan? Paste code"}
      </button>

      {showManual && (
        <div className="w-full flex gap-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Paste the code here..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleManualSubmit()
            }}
          />
          <button
            onClick={handleManualSubmit}
            className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-500 transition-colors"
          >
            Go
          </button>
        </div>
      )}
    </div>
  )
}
