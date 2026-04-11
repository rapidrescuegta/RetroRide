import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: Get a single tournament with all entries
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        family: { select: { id: true, name: true } },
        entries: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        participants: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { seed: 'asc' },
        },
        matches: {
          orderBy: [{ round: 'asc' }, { position: 'asc' }],
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    return NextResponse.json({ tournament })
  } catch (error) {
    console.error('Tournament GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Delete a tournament (creator only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const memberId = req.nextUrl.searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    const tournament = await prisma.tournament.findUnique({ where: { id } })
    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }
    if (tournament.createdBy !== memberId) {
      return NextResponse.json({ error: 'Only the creator can delete a tournament' }, { status: 403 })
    }

    await prisma.tournamentEntry.deleteMany({ where: { tournamentId: id } })
    await prisma.tournament.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Tournament DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
