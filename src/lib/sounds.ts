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

// ---------------------------------------------------------------------------
// Background Music — Looping chiptune tracks
// ---------------------------------------------------------------------------

let musicNodes: { oscs: OscillatorNode[]; gains: GainNode[]; timer: ReturnType<typeof setTimeout> | null } | null = null
let musicPlaying = false

const MUSIC_KEY = 'retroride-music'
export function isMusicEnabled(): boolean {
  if (typeof window === 'undefined') return true
  const stored = localStorage.getItem(MUSIC_KEY)
  return stored !== 'off'
}
export function setMusicEnabled(on: boolean) {
  localStorage.setItem(MUSIC_KEY, on ? 'on' : 'off')
  if (!on) stopMusic()
}

// Note frequencies
const N: Record<string, number> = {
  C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247,
  C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494,
  C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988,
  R: 0, // rest
}

type MusicTrack = { melody: [string, number][]; bass: [string, number][]; bpm: number }

// Upbeat arcade theme — catchy, energetic
const ARCADE_THEME: MusicTrack = {
  bpm: 140,
  melody: [
    ['E4', 0.5], ['G4', 0.5], ['A4', 0.5], ['B4', 0.5],
    ['C5', 1], ['B4', 0.5], ['A4', 0.5],
    ['G4', 1], ['E4', 0.5], ['G4', 0.5],
    ['A4', 1.5], ['R', 0.5],
    ['A4', 0.5], ['B4', 0.5], ['C5', 0.5], ['D5', 0.5],
    ['E5', 1], ['D5', 0.5], ['C5', 0.5],
    ['B4', 0.5], ['A4', 0.5], ['G4', 0.5], ['A4', 0.5],
    ['E4', 1.5], ['R', 0.5],
    ['C5', 0.5], ['B4', 0.5], ['A4', 0.5], ['G4', 0.5],
    ['A4', 1], ['E4', 1],
    ['G4', 0.5], ['A4', 0.5], ['B4', 1],
    ['C5', 1.5], ['R', 0.5],
  ],
  bass: [
    ['A3', 1], ['A3', 1], ['C4', 1], ['C4', 1],
    ['G3', 1], ['G3', 1], ['E3', 1], ['E3', 1],
    ['F3', 1], ['F3', 1], ['C4', 1], ['C4', 1],
    ['G3', 1], ['G3', 1], ['A3', 1], ['A3', 1],
    ['A3', 1], ['A3', 1], ['C4', 1], ['C4', 1],
    ['G3', 1], ['G3', 1], ['A3', 1], ['A3', 1],
  ],
}

// Chill puzzle theme — slower, mellow
const PUZZLE_THEME: MusicTrack = {
  bpm: 100,
  melody: [
    ['C4', 1], ['E4', 1], ['G4', 1], ['E4', 1],
    ['F4', 1], ['A4', 1], ['G4', 2],
    ['E4', 1], ['D4', 1], ['C4', 1], ['E4', 1],
    ['D4', 2], ['R', 2],
    ['C4', 1], ['E4', 0.5], ['F4', 0.5], ['G4', 1], ['E4', 1],
    ['A4', 1], ['G4', 1], ['F4', 1], ['E4', 1],
    ['D4', 1], ['E4', 1], ['C4', 2],
    ['R', 2], ['R', 2],
  ],
  bass: [
    ['C3', 2], ['C3', 2], ['F3', 2], ['F3', 2],
    ['G3', 2], ['G3', 2], ['C3', 2], ['C3', 2],
    ['C3', 2], ['C3', 2], ['F3', 2], ['F3', 2],
    ['G3', 2], ['G3', 2], ['C3', 2], ['C3', 2],
  ],
}

function scheduleTrack(track: MusicTrack) {
  const c = getCtx()
  if (!c || !enabled || !isMusicEnabled()) return

  const beatDur = 60 / track.bpm
  const melodyGain = c.createGain()
  melodyGain.gain.setValueAtTime(0.06, c.currentTime)
  melodyGain.connect(c.destination)

  const bassGain = c.createGain()
  bassGain.gain.setValueAtTime(0.04, c.currentTime)
  bassGain.connect(c.destination)

  const oscs: OscillatorNode[] = []
  const gains: GainNode[] = [melodyGain, bassGain]

  // Schedule melody
  let t = c.currentTime + 0.1
  for (const [note, beats] of track.melody) {
    const dur = beats * beatDur
    if (note !== 'R' && N[note]) {
      const osc = c.createOscillator()
      const noteGain = c.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(N[note], t)
      noteGain.gain.setValueAtTime(0.06, t)
      noteGain.gain.setValueAtTime(0.06, t + dur * 0.8)
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95)
      osc.connect(noteGain)
      noteGain.connect(melodyGain)
      osc.start(t)
      osc.stop(t + dur)
      oscs.push(osc)
    }
    t += dur
  }
  const melodyDuration = t - c.currentTime - 0.1

  // Schedule bass
  t = c.currentTime + 0.1
  for (const [note, beats] of track.bass) {
    const dur = beats * beatDur
    if (note !== 'R' && N[note]) {
      const osc = c.createOscillator()
      const noteGain = c.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(N[note], t)
      noteGain.gain.setValueAtTime(0.04, t)
      noteGain.gain.setValueAtTime(0.04, t + dur * 0.7)
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.9)
      osc.connect(noteGain)
      noteGain.connect(bassGain)
      osc.start(t)
      osc.stop(t + dur)
      oscs.push(osc)
    }
    t += dur
  }

  // Loop: schedule next iteration just before this one ends
  const timer = setTimeout(() => {
    if (musicPlaying) scheduleTrack(track)
  }, (melodyDuration - 0.2) * 1000)

  musicNodes = { oscs, gains, timer }
}

/** Start background music. type: 'arcade' (action games) or 'puzzle' (tetris, snake, etc.) */
export function startMusic(type: 'arcade' | 'puzzle' = 'arcade') {
  if (musicPlaying) stopMusic()
  if (!isMusicEnabled() || !enabled) return
  musicPlaying = true
  const track = type === 'puzzle' ? PUZZLE_THEME : ARCADE_THEME
  scheduleTrack(track)
}

/** Stop background music */
export function stopMusic() {
  musicPlaying = false
  if (musicNodes) {
    if (musicNodes.timer) clearTimeout(musicNodes.timer)
    musicNodes.oscs.forEach(osc => { try { osc.stop() } catch {} })
    musicNodes = null
  }
}

/** Check if music is currently playing */
export function isMusicPlaying(): boolean {
  return musicPlaying
}
