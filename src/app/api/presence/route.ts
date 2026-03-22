import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const { memberId } = await req.json()

    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    // Upsert this member's presence
    await prisma.presence.upsert({
      where: { memberId },
      update: { lastSeen: new Date(), isOnline: true },
      create: { memberId, lastSeen: new Date(), isOnline: true },
    })

    // Look up the member's familyId
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { familyId: true },
    })

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get all family members with presence info
    const thirtySecondsAgo = new Date(Date.now() - 30_000)

    const familyMembers = await prisma.member.findMany({
      where: { familyId: member.familyId },
      select: {
        id: true,
        name: true,
        avatar: true,
        presence: {
          select: { lastSeen: true, isOnline: true },
        },
      },
    })

    const onlineMembers = familyMembers
      .filter(
        (m) =>
          m.presence?.isOnline && m.presence.lastSeen >= thirtySecondsAgo
      )
      .map((m) => ({ id: m.id, name: m.name, avatar: m.avatar }))

    const offlineMembers = familyMembers
      .filter(
        (m) =>
          !m.presence?.isOnline || !m.presence?.lastSeen || m.presence.lastSeen < thirtySecondsAgo
      )
      .map((m) => ({ id: m.id, name: m.name, avatar: m.avatar }))

    return NextResponse.json({ onlineMembers, offlineMembers })
  } catch (error) {
    console.error('Presence error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
