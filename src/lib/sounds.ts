'use client'

// Lazy-init AudioContext (must be created after user interaction)
let ctx: AudioContext | null = null
let enabled = true

function getCtx(): AudioContext | null {
  if (!enabled) return null
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// Settings stored in localStorage
const SOUND_KEY = 'retroride-sound'
export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(SOUND_KEY)
  return stored !== 'off'
}
export function setSoundEnabled(on: boolean) {
  enabled = on
  localStorage.setItem(SOUND_KEY, on ? 'on' : 'off')
}

// Initialize from localStorage on load
if (typeof window !== 'undefined') {
  enabled = isSoundEnabled()
}

/** Classic laser/pew — short descending square wave */
export function playShoot() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(800, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.1)
  gain.gain.setValueAtTime(0.12, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.1)
}

/** Explosion/hit — white noise burst with lowpass sweep */
export function playExplosion() {
  const c = getCtx()
  if (!c) return
  // Create white noise buffer
  const bufferSize = c.sampleRate * 0.2
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(4000, c.currentTime)
  filter.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.2)
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.15, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2)
  noise.connect(filter)
  filter.connect(gain)
  gain.connect(c.destination)
  noise.start(c.currentTime)
  noise.stop(c.currentTime + 0.2)
}

/** Player death — descending tone with vibrato */
export function playDeath() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const vibrato = c.createOscillator()
  const vibratoGain = c.createGain()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(600, c.currentTime)
  osc.frequency.exponentialRampToValueAtTime(100, c.currentTime + 0.5)
  // Vibrato
  vibrato.type = 'sine'
  vibrato.frequency.setValueAtTime(8, c.currentTime)
  vibratoGain.gain.setValueAtTime(15, c.currentTime)
  vibrato.connect(vibratoGain)
  vibratoGain.connect(osc.frequency)
  gain.gain.setValueAtTime(0.12, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  vibrato.start(c.currentTime)
  osc.stop(c.currentTime + 0.5)
  vibrato.stop(c.currentTime + 0.5)
}

/** Score/coin/item pickup — two quick ascending notes */
export function playPickup() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(800, c.currentTime)
  osc.frequency.setValueAtTime(1200, c.currentTime + 0.05)
  gain.gain.setValueAtTime(0.15, c.currentTime)
  gain.gain.setValueAtTime(0.15, c.currentTime + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.1)
}

/** Extra life earned — ascending arpeggio C-E-G-C */
export function playOneUp() {
  const c = getCtx()
  if (!c) return
  const notes = [523, 659, 784, 1047]
  const dur = 0.08
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, c.currentTime + i * dur)
    gain.gain.setValueAtTime(0.15, c.currentTime + i * dur)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (i + 1) * dur)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime + i * dur)
    osc.stop(c.currentTime + (i + 1) * dur)
  })
}

/** Game over jingle — slow descending steps */
export function playGameOver() {
  const c = getCtx()
  if (!c) return
  const notes = [400, 300, 200, 100]
  const dur = 0.15
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, c.currentTime + i * dur)
    gain.gain.setValueAtTime(0.1, c.currentTime + i * dur)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (i + 1) * dur)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime + i * dur)
    osc.stop(c.currentTime + (i + 1) * dur)
  })
}

/** Movement tick — very short click */
export function playMove() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(1000, c.currentTime)
  gain.gain.setValueAtTime(0.08, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.02)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.02)
}

/** Menu selection — short blip */
export function playSelect() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(600, c.currentTime)
  gain.gain.setValueAtTime(0.12, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.05)
}

/** Ball bounce — short boop */
export function playBounce() {
  const c = getCtx()
  if (!c) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(400, c.currentTime)
  gain.gain.setValueAtTime(0.12, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.05)
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start(c.currentTime)
  osc.stop(c.currentTime + 0.05)
}

/** Level complete/win — ascending fanfare */
export function playWin() {
  const c = getCtx()
  if (!c) return
  const notes = [523, 587, 659, 784, 880, 1047]
  const dur = 0.05
  notes.forEach((freq, i) => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, c.currentTime + i * dur)
    gain.gain.setValueAtTime(0.12, c.currentTime + i * dur)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (i + 1) * dur)
    osc.connect(gain)
    gain.connect(c.destination)
    osc.start(c.currentTime + i * dur)
    osc.stop(c.currentTime + (i + 1) * dur)
  })
}
