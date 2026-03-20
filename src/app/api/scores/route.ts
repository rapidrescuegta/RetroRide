import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: Save a score
export async function POST(req: NextRequest) {
  const { gameId, score, memberId } = await req.json()

  if (!gameId || score === undefined || !memberId) {
    return NextResponse.json({ error: 'gameId, score, and memberId required' }, { status: 400 })
  }

  const entry = await prisma.score.create({
    data: { gameId, score, memberId },
  })

  return NextResponse.json({ score: entry })
}

// GET: Get scores for a member
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('memberId')
  const gameId = req.nextUrl.searchParams.get('gameId')

  if (!memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  }

  const where: Record<string, string> = { memberId }
  if (gameId) where.gameId = gameId

  const scores = await prisma.score.findMany({
    where,
    orderBy: { score: 'desc' },
    take: 50,
  })

  return NextResponse.json({ scores })
}
