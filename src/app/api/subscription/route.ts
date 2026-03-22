import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkFamilyAccess } from '@/lib/subscription'

export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId')

  if (!familyId) {
    return NextResponse.json({ error: 'familyId is required' }, { status: 400 })
  }

  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { planType: true, planExpiresAt: true },
  })

  if (!family) {
    return NextResponse.json({ error: 'Family not found' }, { status: 404 })
  }

  const hasAccess = await checkFamilyAccess(familyId)

  return NextResponse.json({
    hasAccess,
    plan: family.planType || null,
    expiresAt: family.planExpiresAt?.toISOString() || null,
  })
}
