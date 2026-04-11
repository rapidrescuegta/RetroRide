import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getNextMatchPosition } from '@/lib/bracket'

type Params = { params: Promise<{ id: string }> }

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// GET: Get match details (for players joining a match)
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { id: tournamentId } = await params
    const matchId = req.nextUrl.searchParams.get('matchId')

    if (!matchId) {
      // Return all matches for this tournament
      const matches = await prisma.bracketMatch.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
      })
      return NextResponse.json({ matches })
    }

    const match = await prisma.bracketMatch.findUnique({
      where: { id: matchId },
    })

    if (!match || match.tournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    return NextResponse.json({ match })
  } catch (error) {
    console.error('Match GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Match lifecycle actions (start-match, report-result)
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id: tournamentId } = await params
    const body = await req.json()
    const { action, matchId, memberId } = body

    if (!action || !matchId || !memberId) {
      return NextResponse.json(
        { error: 'action, matchId, and memberId are required' },
        { status: 400 }
      )
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })
    if (!tournament || tournament.format !== 'elimination') {
      return NextResponse.json({ error: 'Elimination tournament not found' }, { status: 404 })
    }

    const match = await prisma.bracketMatch.findUnique({
      where: { id: matchId },
    })
    if (!match || match.tournamentId !== tournamentId) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // ── Start Match ──────────────────────────────────────────────────
    if (action === 'start-match') {
      if (match.status !== 'ready') {
        return NextResponse.json({ error: 'Match is not ready to start' }, { status: 400 })
      }

      // Only match participants can start
      if (match.player1Id !== memberId && match.player2Id !== memberId) {
        return NextResponse.json({ error: 'You are not a participant in this match' }, { status: 403 })
      }

      const roomCode = generateRoomCode()
      const updated = await prisma.bracketMatch.update({
        where: { id: matchId },
        data: {
          status: 'in-progress',
          roomCode,
          startedAt: new Date(),
        },
      })

      return NextResponse.json({ match: updated, roomCode })
    }

    // ── Report Result ────────────────────────────────────────────────
    if (action === 'report-result') {
      const { winnerId, player1Score, player2Score } = body

      if (!winnerId) {
        return NextResponse.json({ error: 'winnerId is required' }, { status: 400 })
      }

      if (match.status !== 'in-progress') {
        return NextResponse.json({ error: 'Match is not in progress' }, { status: 400 })
      }

      // Validate winner is a participant
      if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
        return NextResponse.json({ error: 'Winner must be a match participant' }, { status: 400 })
      }

      const loserId = winnerId === match.player1Id ? match.player2Id : match.player1Id

      // Determine the total number of rounds
      const totalRounds = Math.log2(tournament.bracketSize ?? 2)
      const isFinal = match.round === totalRounds

      await prisma.$transaction(async (tx) => {
        // Update the completed match
        await tx.bracketMatch.update({
          where: { id: matchId },
          data: {
            winnerId,
            loserId,
            player1Score: player1Score ?? null,
            player2Score: player2Score ?? null,
            status: 'completed',
            completedAt: new Date(),
          },
        })

        // Mark loser as eliminated
        if (loserId) {
          await tx.bracketParticipant.updateMany({
            where: { tournamentId, memberId: loserId },
            data: {
              eliminated: true,
              eliminatedAt: new Date(),
              eliminatedIn: match.round,
            },
          })
        }

        // Advance winner to next round (unless this is the final)
        if (!isFinal) {
          const next = getNextMatchPosition(match.round, match.position)
          const nextMatch = await tx.bracketMatch.findUnique({
            where: {
              tournamentId_round_position: {
                tournamentId,
                round: next.round,
                position: next.position,
              },
            },
          })

          if (nextMatch) {
            const updateData: Record<string, unknown> =
              next.slot === 'player1'
                ? { player1Id: winnerId }
                : { player2Id: winnerId }

            // Check if the other player is already set
            const otherPlayer =
              next.slot === 'player1' ? nextMatch.player2Id : nextMatch.player1Id
            if (otherPlayer) {
              updateData.status = 'ready'
            }

            await tx.bracketMatch.update({
              where: { id: nextMatch.id },
              data: updateData,
            })
          }

          // Update tournament current round
          await tx.tournament.update({
            where: { id: tournamentId },
            data: { currentRound: Math.max(tournament.currentRound, match.round + 1) },
          })
        } else {
          // Final match — complete the tournament
          await tx.tournament.update({
            where: { id: tournamentId },
            data: {
              status: 'completed',
              completedAt: new Date(),
            },
          })
        }
      })

      // Return updated bracket
      const matches = await prisma.bracketMatch.findMany({
        where: { tournamentId },
        orderBy: [{ round: 'asc' }, { position: 'asc' }],
      })

      const participants = await prisma.bracketParticipant.findMany({
        where: { tournamentId },
        include: { member: { select: { id: true, name: true, avatar: true } } },
        orderBy: { seed: 'asc' },
      })

      return NextResponse.json({
        match: matches.find(m => m.id === matchId),
        matches,
        participants,
        tournamentComplete: isFinal,
        winnerId: isFinal ? winnerId : undefined,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error('Match POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
