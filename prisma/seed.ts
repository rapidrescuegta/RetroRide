/**
 * Database seed script for GameBuddi.
 *
 * Creates sample data for development and staging environments:
 *   - A sample family with members
 *   - Scores across multiple games
 *   - A sample tournament with entries
 *
 * Usage: npx prisma db seed
 */

import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('[seed] Starting database seed...')

  // ── Family ──────────────────────────────────────────────────────────────

  const family = await prisma.family.upsert({
    where: { code: 'DEMO-FAMILY' },
    update: {},
    create: {
      name: 'The Demo Family',
      code: 'DEMO-FAMILY',
      subscriptionStatus: 'active',
      planType: 'monthly',
      planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  })

  console.log(`[seed] Family: ${family.name} (${family.id})`)

  // ── Members ─────────────────────────────────────────────────────────────

  const membersData = [
    { name: 'Alex', email: 'alex@demo.gamebuddi.com', avatar: '😎' },
    { name: 'Jordan', email: 'jordan@demo.gamebuddi.com', avatar: '🎮' },
    { name: 'Sam', email: 'sam@demo.gamebuddi.com', avatar: '🌟' },
    { name: 'Riley', email: 'riley@demo.gamebuddi.com', avatar: '🦊' },
  ]

  const members = await Promise.all(
    membersData.map((m) =>
      prisma.member.upsert({
        where: { familyId_name: { familyId: family.id, name: m.name } },
        update: {},
        create: {
          name: m.name,
          email: m.email,
          emailVerified: true,
          avatar: m.avatar,
          familyId: family.id,
        },
      })
    )
  )

  for (const m of members) {
    console.log(`[seed] Member: ${m.name} (${m.id})`)
  }

  // ── Scores ──────────────────────────────────────────────────────────────

  const gameScores: { gameId: string; scores: number[] }[] = [
    { gameId: 'snake', scores: [120, 85, 200, 55] },
    { gameId: 'tetris', scores: [3400, 2100, 5600, 1800] },
    { gameId: 'pac-man', scores: [1500, 2200, 900, 3100] },
    { gameId: 'space-invaders', scores: [800, 1100, 650, 1400] },
    { gameId: '2048', scores: [8192, 4096, 16384, 2048] },
    { gameId: 'memory-match', scores: [95, 88, 100, 72] },
  ]

  let scoreCount = 0
  for (const gs of gameScores) {
    for (let i = 0; i < members.length; i++) {
      await prisma.score.create({
        data: {
          gameId: gs.gameId,
          score: gs.scores[i],
          memberId: members[i].id,
        },
      })
      scoreCount++
    }
  }

  console.log(`[seed] Created ${scoreCount} scores across ${gameScores.length} games`)

  // ── Tournament ──────────────────────────────────────────────────────────

  const tournament = await prisma.tournament.create({
    data: {
      name: 'Weekend Showdown',
      familyId: family.id,
      gameIds: ['snake', 'tetris', 'pac-man'],
      status: 'active',
      createdBy: members[0].id,
    },
  })

  console.log(`[seed] Tournament: ${tournament.name} (${tournament.id})`)

  // Tournament entries: each member plays each game
  const placements = [
    // snake placements
    { gameId: 'snake', scores: [200, 120, 85, 55], placements: [1, 2, 3, 4], points: [10, 7, 5, 3] },
    // tetris placements
    { gameId: 'tetris', scores: [5600, 3400, 2100, 1800], placements: [1, 2, 3, 4], points: [10, 7, 5, 3] },
    // pac-man placements
    { gameId: 'pac-man', scores: [3100, 2200, 1500, 900], placements: [1, 2, 3, 4], points: [10, 7, 5, 3] },
  ]

  // Assign different members to different placements per game for variety
  const memberOrder = [
    [2, 0, 1, 3], // snake:  Sam 1st, Alex 2nd, Jordan 3rd, Riley 4th
    [2, 0, 1, 3], // tetris: Sam 1st, Alex 2nd, Jordan 3rd, Riley 4th
    [3, 1, 0, 2], // pac-man: Riley 1st, Jordan 2nd, Alex 3rd, Sam 4th
  ]

  let entryCount = 0
  for (let g = 0; g < placements.length; g++) {
    const p = placements[g]
    const order = memberOrder[g]
    for (let i = 0; i < members.length; i++) {
      await prisma.tournamentEntry.create({
        data: {
          tournamentId: tournament.id,
          memberId: members[order[i]].id,
          gameId: p.gameId,
          score: p.scores[i],
          placement: p.placements[i],
          points: p.points[i],
        },
      })
      entryCount++
    }
  }

  console.log(`[seed] Created ${entryCount} tournament entries`)

  // ── Notification Preferences ────────────────────────────────────────────

  await prisma.notificationPreference.create({
    data: {
      memberId: members[0].id,
      rankingEmail: 'weekly',
      challengeEmail: true,
      newMemberEmail: true,
    },
  })

  console.log('[seed] Created notification preferences for Alex')

  console.log('[seed] Seeding complete.')
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
