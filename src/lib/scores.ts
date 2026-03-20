'use client'

export interface ScoreEntry {
  score: number
  date: string
}

const STORAGE_KEY = 'retroride-scores'

function getScores(): Record<string, ScoreEntry[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveScores(scores: Record<string, ScoreEntry[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scores))
}

export function getHighScore(gameId: string): number {
  const scores = getScores()
  const entries = scores[gameId] || []
  return entries.length > 0 ? Math.max(...entries.map(e => e.score)) : 0
}

export function getTopScores(gameId: string, limit = 5): ScoreEntry[] {
  const scores = getScores()
  const entries = scores[gameId] || []
  return entries.sort((a, b) => b.score - a.score).slice(0, limit)
}

export function saveScore(gameId: string, score: number) {
  const scores = getScores()
  if (!scores[gameId]) scores[gameId] = []
  scores[gameId].push({ score, date: new Date().toISOString() })
  // Keep top 20 per game
  scores[gameId] = scores[gameId]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
  saveScores(scores)
}

export function getTotalGamesPlayed(): number {
  const scores = getScores()
  return Object.values(scores).reduce((sum, entries) => sum + entries.length, 0)
}

// Achievements
const ACHIEVEMENTS_KEY = 'retroride-achievements'

export interface Achievement {
  id: string
  name: string
  icon: string
  description: string
  condition: () => boolean
}

export function getUnlockedAchievements(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function unlockAchievement(id: string) {
  const unlocked = getUnlockedAchievements()
  if (!unlocked.includes(id)) {
    unlocked.push(id)
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked))
  }
}
