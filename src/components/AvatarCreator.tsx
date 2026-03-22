'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface AvatarCreatorProps {
  onAvatarSaved: (avatarDataUrl: string) => void
  onCancel: () => void
}

type FilterStyle = 'comic' | 'popart' | 'pixel' | 'neon'
type Step = 'capture' | 'style' | 'confirm'

const FILTER_LABELS: Record<FilterStyle, string> = {
  comic: 'Comic',
  popart: 'Pop Art',
  pixel: 'Pixel Art',
  neon: 'Neon',
}

const AVATAR_SIZE = 128
const PROCESS_SIZE = 256

// ────────────────────────────────────────────────
// Filter helpers
// ────────────────────────────────────────────────

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function getGray(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function sobelEdges(src: ImageData, w: number, h: number): Uint8ClampedArray {
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    gray[i] = getGray(src.data[i * 4], src.data[i * 4 + 1], src.data[i * 4 + 2])
  }
  const edges = new Uint8ClampedArray(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const gx =
        -gray[(y - 1) * w + (x - 1)] + gray[(y - 1) * w + (x + 1)] +
        -2 * gray[y * w + (x - 1)] + 2 * gray[y * w + (x + 1)] +
        -gray[(y + 1) * w + (x - 1)] + gray[(y + 1) * w + (x + 1)]
      const gy =
        -gray[(y - 1) * w + (x - 1)] - 2 * gray[(y - 1) * w + x] - gray[(y - 1) * w + (x + 1)] +
        gray[(y + 1) * w + (x - 1)] + 2 * gray[(y + 1) * w + x] + gray[(y + 1) * w + (x + 1)]
      edges[idx] = clamp(Math.sqrt(gx * gx + gy * gy))
    }
  }
  return edges
}

function posterize(value: number, levels: number): number {
  const step = 255 / (levels - 1)
  return clamp(Math.round(Math.round(value / step) * step))
}

function boostSaturation(r: number, g: number, b: number, factor: number): [number, number, number] {
  const gray = 0.299 * r + 0.587 * g + 0.114 * b
  return [
    clamp(gray + factor * (r - gray)),
    clamp(gray + factor * (g - gray)),
    clamp(gray + factor * (b - gray)),
  ]
}

// ────────────────────────────────────────────────
// Comic filter
// ────────────────────────────────────────────────

function applyComicFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const edges = sobelEdges(imageData, width, height)

  // Posterize + saturate
  const levels = 10
  for (let i = 0; i < data.length; i += 4) {
    let r = posterize(data[i], levels)
    let g = posterize(data[i + 1], levels)
    let b = posterize(data[i + 2], levels)
    ;[r, g, b] = boostSaturation(r, g, b, 1.6)
    // Brighten slightly
    r = clamp(r * 1.1 + 15)
    g = clamp(g * 1.1 + 15)
    b = clamp(b * 1.1 + 15)
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  // Overlay dark outlines from edges
  const edgeThreshold = 40
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const pi = idx * 4
      const edgeVal = edges[idx]
      if (edgeVal > edgeThreshold) {
        const strength = Math.min(1, (edgeVal - edgeThreshold) / 80)
        data[pi] = clamp(data[pi] * (1 - strength) + 20 * strength)
        data[pi + 1] = clamp(data[pi + 1] * (1 - strength) + 15 * strength)
        data[pi + 2] = clamp(data[pi + 2] * (1 - strength) + 30 * strength)
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ────────────────────────────────────────────────
// Pop Art filter
// ────────────────────────────────────────────────

const POP_ART_PALETTE: [number, number, number][] = [
  [255, 20, 80],   // hot pink
  [255, 200, 0],   // yellow
  [0, 200, 255],   // cyan
  [180, 50, 255],  // purple
  [20, 20, 20],    // black
]

function nearestPalette(r: number, g: number, b: number, palette: [number, number, number][]): [number, number, number] {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2]
    const d = dr * dr + dg * dg + db * db
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

function applyPopArtFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  // High contrast + limited palette
  for (let i = 0; i < data.length; i += 4) {
    // Boost contrast
    let r = clamp((data[i] - 128) * 1.8 + 128)
    let g = clamp((data[i + 1] - 128) * 1.8 + 128)
    let b = clamp((data[i + 2] - 128) * 1.8 + 128)
    // Saturate
    ;[r, g, b] = boostSaturation(r, g, b, 2.0)
    // Snap to palette
    const [pr, pg, pb] = nearestPalette(r, g, b, POP_ART_PALETTE)
    data[i] = pr
    data[i + 1] = pg
    data[i + 2] = pb
  }

  // Halftone dot pattern
  const dotSpacing = 6
  const maxRadius = dotSpacing / 2
  ctx.putImageData(imageData, 0, 0)

  // Read back the palette-mapped image for halftone
  const mapped = ctx.getImageData(0, 0, width, height)
  // Fill white then draw dots
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)

  for (let cy = 0; cy < height; cy += dotSpacing) {
    for (let cx = 0; cx < width; cx += dotSpacing) {
      const pi = (cy * width + cx) * 4
      const r = mapped.data[pi], g = mapped.data[pi + 1], b = mapped.data[pi + 2]
      const brightness = getGray(r, g, b) / 255
      const radius = maxRadius * (1 - brightness * 0.3)
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fill()
    }
  }
}

// ────────────────────────────────────────────────
// Pixel Art filter
// ────────────────────────────────────────────────

const PIXEL_PALETTE: [number, number, number][] = [
  [30, 20, 50],    // dark
  [80, 50, 120],   // deep purple
  [139, 92, 246],  // accent purple
  [6, 182, 212],   // cyan
  [16, 185, 129],  // green
  [236, 72, 153],  // pink
  [245, 158, 11],  // yellow
  [241, 245, 249], // white
  [148, 163, 184], // gray
  [200, 100, 80],  // skin warm
  [170, 130, 100], // skin mid
  [120, 80, 60],   // skin dark
  [60, 40, 30],    // hair dark
  [200, 170, 130], // hair light
]

function applyPixelFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixelSize = Math.max(Math.floor(width / 32), 4)
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      // Average block color
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const pi = ((y + dy) * width + (x + dx)) * 4
          rSum += data[pi]
          gSum += data[pi + 1]
          bSum += data[pi + 2]
          count++
        }
      }
      const avgR = rSum / count, avgG = gSum / count, avgB = bSum / count
      // Snap to palette
      const [pr, pg, pb] = nearestPalette(avgR, avgG, avgB, PIXEL_PALETTE)
      // Fill block
      for (let dy = 0; dy < pixelSize && y + dy < height; dy++) {
        for (let dx = 0; dx < pixelSize && x + dx < width; dx++) {
          const pi = ((y + dy) * width + (x + dx)) * 4
          data[pi] = pr
          data[pi + 1] = pg
          data[pi + 2] = pb
        }
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

// ────────────────────────────────────────────────
// Neon filter
// ────────────────────────────────────────────────

const NEON_COLORS: [number, number, number][] = [
  [139, 92, 246],  // purple
  [6, 182, 212],   // cyan
  [236, 72, 153],  // pink
  [16, 185, 129],  // green
  [245, 158, 11],  // yellow
]

function applyNeonFilter(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const imageData = ctx.getImageData(0, 0, width, height)
  const edges = sobelEdges(imageData, width, height)
  const data = imageData.data

  // Dark background with neon edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const pi = idx * 4
      const edgeVal = edges[idx]

      if (edgeVal > 30) {
        // Color edge based on original hue region
        const r = data[pi], g = data[pi + 1], b = data[pi + 2]
        const hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b)
        const colorIdx = Math.abs(Math.floor((hue + Math.PI) / (Math.PI * 2) * NEON_COLORS.length)) % NEON_COLORS.length
        const nc = NEON_COLORS[colorIdx]
        const intensity = Math.min(1, edgeVal / 100)
        data[pi] = clamp(nc[0] * intensity)
        data[pi + 1] = clamp(nc[1] * intensity)
        data[pi + 2] = clamp(nc[2] * intensity)
      } else {
        // Dark background - slight tint from original
        data[pi] = clamp(data[pi] * 0.08)
        data[pi + 1] = clamp(data[pi + 1] * 0.06)
        data[pi + 2] = clamp(data[pi + 2] * 0.12)
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)

  // Glow pass: draw again with blur and additive blending
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = width
  tempCanvas.height = height
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(ctx.getImageData(0, 0, width, height), 0, 0)

  ctx.save()
  ctx.filter = 'blur(3px)'
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(tempCanvas, 0, 0)
  ctx.filter = 'blur(6px)'
  ctx.globalAlpha = 0.5
  ctx.drawImage(tempCanvas, 0, 0)
  ctx.restore()
}

// ────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────

export default function AvatarCreator({ onAvatarSaved, onCancel }: AvatarCreatorProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [step, setStep] = useState<Step>('capture')
  const [cameraError, setCameraError] = useState(false)
  const [rawImage, setRawImage] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<FilterStyle>('comic')
  const [filteredPreviews, setFilteredPreviews] = useState<Record<FilterStyle, string>>({} as Record<FilterStyle, string>)
  const [processing, setProcessing] = useState(false)

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraError(false)
    } catch {
      setCameraError(true)
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  useEffect(() => {
    if (step === 'capture') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [step, startCamera, stopCamera])

  // Capture frame from video
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    const size = Math.min(video.videoWidth, video.videoHeight)
    canvas.width = PROCESS_SIZE
    canvas.height = PROCESS_SIZE
    const ctx = canvas.getContext('2d')!
    // Center-crop square and mirror horizontally for selfie
    const sx = (video.videoWidth - size) / 2
    const sy = (video.videoHeight - size) / 2
    ctx.save()
    ctx.translate(PROCESS_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, size, size, 0, 0, PROCESS_SIZE, PROCESS_SIZE)
    ctx.restore()
    setRawImage(canvas.toDataURL('image/png'))
    setStep('style')
  }, [])

  // Upload file
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = PROCESS_SIZE
        canvas.height = PROCESS_SIZE
        const ctx = canvas.getContext('2d')!
        const size = Math.min(img.width, img.height)
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, PROCESS_SIZE, PROCESS_SIZE)
        setRawImage(canvas.toDataURL('image/png'))
        setStep('style')
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  // Generate all filter previews when rawImage changes
  useEffect(() => {
    if (!rawImage) return
    setProcessing(true)
    const img = new Image()
    img.onload = () => {
      const styles: FilterStyle[] = ['comic', 'popart', 'pixel', 'neon']
      const previews: Partial<Record<FilterStyle, string>> = {}

      for (const style of styles) {
        const c = document.createElement('canvas')
        c.width = PROCESS_SIZE
        c.height = PROCESS_SIZE
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, PROCESS_SIZE, PROCESS_SIZE)

        switch (style) {
          case 'comic': applyComicFilter(ctx, PROCESS_SIZE, PROCESS_SIZE); break
          case 'popart': applyPopArtFilter(ctx, PROCESS_SIZE, PROCESS_SIZE); break
          case 'pixel': applyPixelFilter(ctx, PROCESS_SIZE, PROCESS_SIZE); break
          case 'neon': applyNeonFilter(ctx, PROCESS_SIZE, PROCESS_SIZE); break
        }

        previews[style] = c.toDataURL('image/png')
      }

      setFilteredPreviews(previews as Record<FilterStyle, string>)
      setProcessing(false)
    }
    img.src = rawImage
  }, [rawImage])

  // Save final circular avatar
  const saveAvatar = useCallback(() => {
    const src = filteredPreviews[selectedStyle]
    if (!src) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = AVATAR_SIZE
      c.height = AVATAR_SIZE
      const ctx = c.getContext('2d')!
      // Circular clip
      ctx.beginPath()
      ctx.arc(AVATAR_SIZE / 2, AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(img, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
      onAvatarSaved(c.toDataURL('image/png'))
    }
    img.src = src
  }, [filteredPreviews, selectedStyle, onAvatarSaved])

  const retake = useCallback(() => {
    setRawImage(null)
    setFilteredPreviews({} as Record<FilterStyle, string>)
    setStep('capture')
  }, [])

  // ── Render ──

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {step === 'capture' ? 'Take a Selfie' : 'Choose Your Style'}
          </h2>
          <button
            onClick={onCancel}
            className="touch-btn w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-5">
          {/* ────── Step 1: Camera Capture ────── */}
          {step === 'capture' && (
            <div className="flex flex-col items-center gap-5 animate-[fadeIn_0.3s_ease]">
              {/* Circular camera frame */}
              <div
                className="relative w-56 h-56 rounded-full overflow-hidden border-4 flex items-center justify-center"
                style={{
                  borderColor: 'var(--accent-purple)',
                  boxShadow: '0 0 30px rgba(139, 92, 246, 0.3), inset 0 0 30px rgba(0,0,0,0.3)',
                  background: 'var(--bg-primary)',
                }}
              >
                {cameraError ? (
                  <div className="text-center px-4" style={{ color: 'var(--text-secondary)' }}>
                    <svg className="mx-auto mb-2" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <p className="text-sm">Camera unavailable</p>
                    <p className="text-xs mt-1">Use upload instead</p>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 w-full">
                {!cameraError && (
                  <button
                    onClick={capturePhoto}
                    className="touch-btn flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-pink))',
                      color: 'white',
                      boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
                    }}
                  >
                    <svg className="inline-block mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Take Photo
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="touch-btn flex-1 py-3 rounded-xl font-semibold text-sm border transition-all active:scale-95 hover:bg-white/5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <svg className="inline-block mr-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Upload Photo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* ────── Step 2: Choose Style ────── */}
          {step === 'style' && (
            <div className="flex flex-col items-center gap-5 animate-[fadeIn_0.3s_ease]">
              {/* Large preview */}
              <div
                className="relative w-48 h-48 rounded-full overflow-hidden border-4 transition-all duration-300"
                style={{
                  borderColor: 'var(--accent-cyan)',
                  boxShadow: '0 0 30px rgba(6, 182, 212, 0.3)',
                  background: 'var(--bg-primary)',
                }}
              >
                {processing ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className="w-10 h-10 rounded-full border-3 border-t-transparent animate-spin"
                      style={{ borderColor: 'var(--accent-purple)', borderTopColor: 'transparent' }}
                    />
                  </div>
                ) : filteredPreviews[selectedStyle] ? (
                  <img
                    src={filteredPreviews[selectedStyle]}
                    alt={`${selectedStyle} preview`}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>

              {/* Style thumbnails */}
              <div className="grid grid-cols-4 gap-3 w-full">
                {(['comic', 'popart', 'pixel', 'neon'] as FilterStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setSelectedStyle(style)}
                    className="flex flex-col items-center gap-1.5 transition-all active:scale-95"
                  >
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden border-2 transition-all duration-200"
                      style={{
                        borderColor: selectedStyle === style ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)',
                        boxShadow: selectedStyle === style ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none',
                        transform: selectedStyle === style ? 'scale(1.05)' : 'scale(1)',
                        background: 'var(--bg-primary)',
                      }}
                    >
                      {filteredPreviews[style] ? (
                        <img
                          src={filteredPreviews[style]}
                          alt={FILTER_LABELS[style]}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div
                            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                            style={{ borderColor: 'var(--accent-purple)', borderTopColor: 'transparent' }}
                          />
                        </div>
                      )}
                    </div>
                    <span
                      className="text-xs font-medium transition-colors"
                      style={{
                        color: selectedStyle === style ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                      }}
                    >
                      {FILTER_LABELS[style]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={retake}
                  className="touch-btn flex-1 py-3 rounded-xl font-semibold text-sm border transition-all active:scale-95 hover:bg-white/5"
                  style={{
                    borderColor: 'rgba(255,255,255,0.15)',
                    color: 'var(--text-primary)',
                  }}
                >
                  Retake
                </button>
                <button
                  onClick={saveAvatar}
                  disabled={processing}
                  className="touch-btn flex-1 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(6, 182, 212, 0.3)',
                  }}
                >
                  Save Avatar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden processing canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  )
}
