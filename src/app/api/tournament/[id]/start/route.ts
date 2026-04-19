import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: Start a tournament (set status to active)
// In the score-based system, "starting" simply means marking it active.
// Players participate by submitting scores — no bracket generation needed.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tournamentId } = await params
    const { memberId } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    if (tournament.createdBy !== memberId) {
      return NextResponse.json(
        { error: 'Only the tournament creator can start it' },
        { status: 403 }
      )
    }

    if (tournament.status !== 'pending') {
      return NextResponse.json(
        { error: 'Tournament has already been started or completed' },
        { status: 400 }
      )
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { status: 'active' },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        entries: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
        },
      },
    })

    return NextResponse.json({ tournament: updated })
  } catch (error) {
    console.error('Tournament start error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
