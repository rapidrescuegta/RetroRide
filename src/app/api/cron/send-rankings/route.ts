import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWeeklyRankings, type RankingEntry } from '@/lib/email'

export async function POST(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = req.nextUrl.searchParams.get('type') || 'weekly'
  if (!['daily', 'weekly'].includes(type)) {
    return NextResponse.json({ error: 'type must be "daily" or "weekly"' }, { status: 400 })
  }

  // Get all families
  const families = await prisma.family.findMany({
    include: {
      members: {
        include: {
          notificationPref: true,
        },
      },
    },
  })

  let emailsSent = 0

  for (const family of families) {
    // Find members who want this type of ranking email
    const recipients = family.members.filter(m => {
      const pref = m.notificationPref
      // Default is "weekly" if no preference set
      const rankingPref = pref?.rankingEmail ?? 'weekly'
      return rankingPref === type && m.emailVerified
    })

    if (recipients.length === 0) continue

    // Build leaderboard data for this family
    const memberIds = family.members.map(m => m.id)
    const allScores = await prisma.score.findMany({
      where: { memberId: { in: memberIds } },
      orderBy: { score: 'desc' },
      include: { member: { select: { name: true, avatar: true } } },
    })

    // Group best score per member per game
    const bestScores = new Map<string, Map<string, number>>()
    for (const s of allScores) {
      if (!bestScores.has(s.gameId)) bestScores.set(s.gameId, new Map())
      const gameMap = bestScores.get(s.gameId)!
      if (!gameMap.has(s.memberId) || s.score > gameMap.get(s.memberId)!) {
        gameMap.set(s.memberId, s.score)
      }
    }

    // Count crowns and total points
    const crowns = new Map<string, number>()
    const totalPoints = new Map<string, number>()

    for (const [, gameMap] of bestScores) {
      let bestMemberId = ''
      let bestScore = -1
      for (const [memberId, score] of gameMap) {
        totalPoints.set(memberId, (totalPoints.get(memberId) || 0) + score)
        if (score > bestScore) {
          bestScore = score
          bestMemberId = memberId
        }
      }
      if (bestMemberId) {
        crowns.set(bestMemberId, (crowns.get(bestMemberId) || 0) + 1)
      }
    }

    const overview: RankingEntry[] = family.members.map(m => ({
      name: m.name,
      avatar: m.avatar,
      crowns: crowns.get(m.id) || 0,
      totalPoints: totalPoints.get(m.id) || 0,
      gamesPlayed: new Set(
        allScores.filter(s => s.memberId === m.id).map(s => s.gameId)
      ).size,
    })).sort((a, b) => b.crowns - a.crowns || b.totalPoints - a.totalPoints)

    if (overview.length === 0) continue

    // Send to each recipient
    for (const member of recipients) {
      if (!process.env.RESEND_API_KEY) {
        console.log(`[DEV] Would send ${type} ranking email to ${member.email}`)
        emailsSent++
        continue
      }

      try {
        await sendWeeklyRankings(
          member.email,
          family.name,
          overview,
          type as 'daily' | 'weekly'
        )
        emailsSent++
      } catch (err) {
        console.error(`Failed to send ranking email to ${member.email}:`, err)
      }
    }
  }

  return NextResponse.json({ sent: emailsSent, type })
}
