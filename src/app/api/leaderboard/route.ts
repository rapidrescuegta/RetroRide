import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: Family leaderboard
export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId')
  const gameId = req.nextUrl.searchParams.get('gameId')

  if (!familyId) {
    return NextResponse.json({ error: 'familyId required' }, { status: 400 })
  }

  // Get all members of the family
  const members = await prisma.member.findMany({
    where: { familyId },
    orderBy: { createdAt: 'asc' },
  })

  const memberIds = members.map(m => m.id)

  if (gameId) {
    // Leaderboard for a specific game
    const scores = await prisma.score.findMany({
      where: {
        memberId: { in: memberIds },
        gameId,
      },
      orderBy: { score: 'desc' },
      include: { member: { select: { name: true, avatar: true } } },
    })

    // Best score per member
    const bestByMember = new Map<string, typeof scores[0]>()
    for (const s of scores) {
      if (!bestByMember.has(s.memberId) || s.score > bestByMember.get(s.memberId)!.score) {
        bestByMember.set(s.memberId, s)
      }
    }

    const leaderboard = Array.from(bestByMember.values())
      .sort((a, b) => b.score - a.score)
      .map((s, i) => ({
        rank: i + 1,
        memberId: s.memberId,
        memberName: s.member.name,
        memberAvatar: s.member.avatar,
        score: s.score,
        date: s.createdAt,
      }))

    return NextResponse.json({ leaderboard, gameId })
  }

  // Overall: best scores per game per member, count games where each member is #1
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

  // Count crowns (games where member has highest score)
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

  const overview = members.map(m => ({
    memberId: m.id,
    memberName: m.name,
    memberAvatar: m.avatar,
    crowns: crowns.get(m.id) || 0,
    totalPoints: totalPoints.get(m.id) || 0,
    gamesPlayed: new Set(
      allScores.filter(s => s.memberId === m.id).map(s => s.gameId)
    ).size,
  })).sort((a, b) => b.crowns - a.crowns || b.totalPoints - a.totalPoints)

  return NextResponse.json({ overview, members })
}
