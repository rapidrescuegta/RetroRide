import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkFamilyAccess } from '@/lib/subscription'
import { getFamilyEntitlements } from '@/lib/entitlements'

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
  const entitlements = await getFamilyEntitlements(familyId)

  return NextResponse.json({
    hasAccess,
    plan: family.planType || null,
    expiresAt: family.planExpiresAt?.toISOString() || null,
    // The full entitlement set, so the client can show the right upgrade
    // prompt without hard-coding the tier ladder a second time.
    entitlements,
  })
}
