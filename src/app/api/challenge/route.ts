import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { familyId, fromMemberId, toMemberId, gameId } = await req.json()

    if (!familyId || !fromMemberId || !toMemberId || !gameId) {
      return NextResponse.json(
        { error: 'familyId, fromMemberId, toMemberId, and gameId are required' },
        { status: 400 }
      )
    }

    const challengeData = JSON.stringify({
      from: fromMemberId,
      to: toMemberId,
      gameId,
      status: 'pending',
    })

    const message = await prisma.chatMessage.create({
      data: {
        familyId,
        memberId: fromMemberId,
        text: challengeData,
        type: 'challenge',
      },
      include: {
        member: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Challenge POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { messageId, status } = await req.json()

    if (!messageId || !status) {
      return NextResponse.json(
        { error: 'messageId and status are required' },
        { status: 400 }
      )
    }

    if (!['accepted', 'declined'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "accepted" or "declined"' },
        { status: 400 }
      )
    }

    const existing = await prisma.chatMessage.findUnique({
      where: { id: messageId },
    })

    if (!existing || existing.type !== 'challenge') {
      return NextResponse.json(
        { error: 'Challenge message not found' },
        { status: 404 }
      )
    }

    let challengeData: Record<string, string>
    try {
      challengeData = JSON.parse(existing.text)
    } catch {
      return NextResponse.json(
        { error: 'Invalid challenge data' },
        { status: 400 }
      )
    }

    challengeData.status = status

    const message = await prisma.chatMessage.update({
      where: { id: messageId },
      data: { text: JSON.stringify(challengeData) },
      include: {
        member: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Challenge PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
