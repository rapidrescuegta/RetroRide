import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculateStandings } from '@/lib/tournament'

// GET: Get standings/leaderboard data for a tournament
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, name: true, status: true, gameIds: true },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const entries = await prisma.tournamentEntry.findMany({
      where: { tournamentId },
      include: {
        member: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: [{ gameId: 'asc' }, { placement: 'asc' }],
    })

    // Build standings from entries
    const standings = calculateStandings(entries)

    // Group entries by game
    const gameResults: Record<string, typeof entries> = {}
    for (const entry of entries) {
      if (!gameResults[entry.gameId]) gameResults[entry.gameId] = []
      gameResults[entry.gameId].push(entry)
    }

    return NextResponse.json({
      tournament,
      standings,
      gameResults,
      totalGames: tournament.gameIds.length,
    })
  } catch (error) {
    console.error('Bracket GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
