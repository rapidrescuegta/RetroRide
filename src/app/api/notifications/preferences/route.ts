import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULTS = {
  rankingEmail: 'weekly',
  challengeEmail: true,
  newMemberEmail: true,
}

// GET: Get notification preferences for a member
export async function GET(req: NextRequest) {
  const memberId = req.nextUrl.searchParams.get('memberId')

  if (!memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  }

  // Verify member exists
  const member = await prisma.member.findUnique({ where: { id: memberId } })
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  const pref = await prisma.notificationPreference.findUnique({
    where: { memberId },
  })

  if (!pref) {
    // Return defaults
    return NextResponse.json({ memberId, ...DEFAULTS })
  }

  return NextResponse.json({
    memberId: pref.memberId,
    rankingEmail: pref.rankingEmail,
    challengeEmail: pref.challengeEmail,
    newMemberEmail: pref.newMemberEmail,
  })
}

// PATCH: Update notification preferences
export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { memberId, rankingEmail, challengeEmail, newMemberEmail } = body

  if (!memberId) {
    return NextResponse.json({ error: 'memberId required' }, { status: 400 })
  }

  // Verify member exists
  const member = await prisma.member.findUnique({ where: { id: memberId } })
  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Validate rankingEmail if provided
  if (rankingEmail !== undefined && !['daily', 'weekly', 'off'].includes(rankingEmail)) {
    return NextResponse.json({ error: 'rankingEmail must be "daily", "weekly", or "off"' }, { status: 400 })
  }

  // Build update data — only include fields that were provided
  const data: Record<string, unknown> = {}
  if (rankingEmail !== undefined) data.rankingEmail = rankingEmail
  if (challengeEmail !== undefined) data.challengeEmail = challengeEmail
  if (newMemberEmail !== undefined) data.newMemberEmail = newMemberEmail

  const pref = await prisma.notificationPreference.upsert({
    where: { memberId },
    create: {
      memberId,
      rankingEmail: rankingEmail ?? DEFAULTS.rankingEmail,
      challengeEmail: challengeEmail ?? DEFAULTS.challengeEmail,
      newMemberEmail: newMemberEmail ?? DEFAULTS.newMemberEmail,
    },
    update: data,
  })

  return NextResponse.json({
    memberId: pref.memberId,
    rankingEmail: pref.rankingEmail,
    challengeEmail: pref.challengeEmail,
    newMemberEmail: pref.newMemberEmail,
  })
}
