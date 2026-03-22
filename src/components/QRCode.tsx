'use client'

import { useRef, useEffect } from 'react'
import QRCodeLib from 'qrcode'

interface QRCodeProps {
  data: string
  size?: number
  label?: string
}

export default function QRCode({ data, size = 200, label }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || !data) return

    QRCodeLib.toCanvas(canvasRef.current, data, {
      width: size,
      margin: 2,
      color: {
        dark: '#e2e8f0',
        light: '#0f172a',
      },
      errorCorrectionLevel: 'L',
    }).catch(() => {
      // QR generation failed silently
    })
  }, [data, size])

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-xl p-3 bg-slate-900 border border-purple-500/30"
        style={{
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.2), 0 0 40px rgba(139, 92, 246, 0.1)',
        }}
      >
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />

        <canvas
          ref={canvasRef}
          style={{ width: size, height: size, imageRendering: 'auto' }}
        />
      </div>

      {label && (
        <p className="text-xs text-slate-400 text-center">{label}</p>
      )}
    </div>
  )
}
