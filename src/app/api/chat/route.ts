import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const familyId = searchParams.get('familyId')
    const since = searchParams.get('since')

    if (!familyId) {
      return NextResponse.json({ error: 'familyId is required' }, { status: 400 })
    }

    const whereClause: Record<string, unknown> = { familyId }
    if (since) {
      whereClause.createdAt = { gt: new Date(since) }
    }

    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        member: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    // Return in chronological order
    return NextResponse.json({ messages: messages.reverse() })
  } catch (error) {
    console.error('Chat GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { familyId, memberId, text, type } = await req.json()

    if (!familyId || !memberId || !text) {
      return NextResponse.json(
        { error: 'familyId, memberId, and text are required' },
        { status: 400 }
      )
    }

    const message = await prisma.chatMessage.create({
      data: {
        familyId,
        memberId,
        text,
        type: type || 'message',
      },
      include: {
        member: {
          select: { id: true, name: true, avatar: true },
        },
      },
    })

    return NextResponse.json({ message })
  } catch (error) {
    console.error('Chat POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
