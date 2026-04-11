import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calculatePlacements } from '@/lib/tournament'
import { generateBracket, nextPowerOf2 } from '@/lib/bracket'

// GET: List tournaments for a family
export async function GET(req: NextRequest) {
  try {
    const familyId = req.nextUrl.searchParams.get('familyId')
    const status = req.nextUrl.searchParams.get('status')

    if (!familyId) {
      return NextResponse.json({ error: 'familyId is required' }, { status: 400 })
    }

    const where: Record<string, string> = { familyId }
    if (status) where.status = status

    const tournaments = await prisma.tournament.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        entries: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
        },
        participants: {
          include: {
            member: { select: { id: true, name: true, avatar: true } },
          },
        },
        matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ tournaments })
  } catch (error) {
    console.error('Tournament GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Create a new tournament (score-based or elimination)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, familyId, createdBy, format } = body

    if (!name || !familyId || !createdBy) {
      return NextResponse.json(
        { error: 'name, familyId, and createdBy are required' },
        { status: 400 }
      )
    }

    // Verify member belongs to family
    const member = await prisma.member.findFirst({
      where: { id: createdBy, familyId },
    })
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this family' }, { status: 404 })
    }

    // ── Elimination bracket ─────────────────────────────────────────
    if (format === 'elimination') {
      const { gameId, participantIds } = body

      if (!gameId) {
        return NextResponse.json({ error: 'gameId is required for elimination tournaments' }, { status: 400 })
      }
      if (!Array.isArray(participantIds) || participantIds.length < 2) {
        return NextResponse.json({ error: 'At least 2 participants are required' }, { status: 400 })
      }
      if (participantIds.length > 16) {
        return NextResponse.json({ error: 'Maximum 16 participants' }, { status: 400 })
      }

      // Verify all participants belong to the family
      const members = await prisma.member.findMany({
        where: { id: { in: participantIds }, familyId },
        select: { id: true },
      })
      if (members.length !== participantIds.length) {
        return NextResponse.json({ error: 'Some participants not found in family' }, { status: 400 })
      }

      const bracketSize = nextPowerOf2(participantIds.length)
      const participants = participantIds.map((id: string, i: number) => ({
        memberId: id,
        seed: i + 1,
      }))
      const bracketSlots = generateBracket(participants, bracketSize)

      // Create tournament + participants + matches in a transaction
      const tournament = await prisma.$transaction(async (tx) => {
        const t = await tx.tournament.create({
          data: {
            name,
            familyId,
            gameIds: [gameId],
            gameId,
            format: 'elimination',
            bracketSize,
            currentRound: 1,
            createdBy,
            status: 'active',
          },
        })

        // Create participants
        await tx.bracketParticipant.createMany({
          data: participants.map((p: { memberId: string; seed: number }) => ({
            tournamentId: t.id,
            memberId: p.memberId,
            seed: p.seed,
          })),
        })

        // Create bracket matches
        await tx.bracketMatch.createMany({
          data: bracketSlots.map((slot) => ({
            tournamentId: t.id,
            round: slot.round,
            position: slot.position,
            player1Id: slot.player1Id,
            player2Id: slot.player2Id,
            winnerId: slot.winnerId,
            loserId: slot.loserId,
            status: slot.status,
          })),
        })

        return t
      })

      // Fetch the full tournament with relations
      const full = await prisma.tournament.findUnique({
        where: { id: tournament.id },
        include: {
          creator: { select: { id: true, name: true, avatar: true } },
          entries: true,
          participants: {
            include: { member: { select: { id: true, name: true, avatar: true } } },
            orderBy: { seed: 'asc' },
          },
          matches: { orderBy: [{ round: 'asc' }, { position: 'asc' }] },
        },
      })

      return NextResponse.json({ tournament: full })
    }

    // ── Score-based tournament (existing behavior) ──────────────────
    const { gameIds } = body

    if (!Array.isArray(gameIds) || gameIds.length < 3 || gameIds.length > 7) {
      return NextResponse.json(
        { error: 'gameIds must be an array of 3-7 game IDs' },
        { status: 400 }
      )
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        familyId,
        gameIds,
        createdBy,
        status: 'active',
      },
      include: {
        creator: { select: { id: true, name: true, avatar: true } },
        entries: true,
      },
    })

    return NextResponse.json({ tournament })
  } catch (error) {
    console.error('Tournament POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH: Submit a score entry OR complete a tournament
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()

    // Action: complete tournament
    if (body.action === 'complete') {
      const { tournamentId, memberId } = body
      if (!tournamentId || !memberId) {
        return NextResponse.json(
          { error: 'tournamentId and memberId are required' },
          { status: 400 }
        )
      }

      const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } })
      if (!tournament) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
      }
      if (tournament.createdBy !== memberId) {
        return NextResponse.json(
          { error: 'Only the creator can complete a tournament' },
          { status: 403 }
        )
      }

      const updated = await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'completed', completedAt: new Date() },
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
    }

    // Action: submit a score
    const { tournamentId, memberId, gameId, score } = body
    if (!tournamentId || !memberId || !gameId || score === undefined) {
      return NextResponse.json(
        { error: 'tournamentId, memberId, gameId, and score are required' },
        { status: 400 }
      )
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        entries: {
          where: { gameId },
          include: { member: { select: { id: true, name: true, avatar: true } } },
        },
      },
    })

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }
    if (tournament.status !== 'active') {
      return NextResponse.json({ error: 'Tournament is not active' }, { status: 400 })
    }
    if (!tournament.gameIds.includes(gameId)) {
      return NextResponse.json({ error: 'Game is not part of this tournament' }, { status: 400 })
    }

    // Verify member belongs to family
    const member = await prisma.member.findFirst({
      where: { id: memberId, familyId: tournament.familyId },
    })
    if (!member) {
      return NextResponse.json({ error: 'Member not found in this family' }, { status: 404 })
    }

    // Build all scores for this game including the new one
    const allScores = tournament.entries
      .filter((e) => e.memberId !== memberId)
      .map((e) => ({ memberId: e.memberId, score: e.score }))
    allScores.push({ memberId, score })

    // Recalculate placements for all entries in this game
    const placements = calculatePlacements(allScores)

    // Use a transaction to update all placements atomically
    await prisma.$transaction(async (tx) => {
      // Upsert the new/updated entry
      const myPlacement = placements.find((p) => p.memberId === memberId)!
      await tx.tournamentEntry.upsert({
        where: {
          tournamentId_memberId_gameId: { tournamentId, memberId, gameId },
        },
        create: {
          tournamentId,
          memberId,
          gameId,
          score,
          placement: myPlacement.placement,
          points: myPlacement.points,
        },
        update: {
          score,
          placement: myPlacement.placement,
          points: myPlacement.points,
        },
      })

      // Update placements for other entries that may have shifted
      for (const p of placements) {
        if (p.memberId === memberId) continue
        const exists = tournament.entries.some((e) => e.memberId === p.memberId)
        if (exists) {
          await tx.tournamentEntry.update({
            where: {
              tournamentId_memberId_gameId: { tournamentId, memberId: p.memberId, gameId },
            },
            data: {
              placement: p.placement,
              points: p.points,
            },
          })
        }
      }
    })

    // Fetch updated tournament
    const updated = await prisma.tournament.findUnique({
      where: { id: tournamentId },
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
    console.error('Tournament PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
