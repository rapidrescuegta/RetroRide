import { prisma } from '@/lib/prisma'

export async function checkFamilyAccess(familyId: string): Promise<boolean> {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: { subscriptionStatus: true, planExpiresAt: true },
  })

  if (!family) return false
  if (family.subscriptionStatus !== 'active') return false

  // If there's an expiration date (one-time passes), check it
  if (family.planExpiresAt && family.planExpiresAt < new Date()) {
    // Mark as expired
    await prisma.family.update({
      where: { id: familyId },
      data: { subscriptionStatus: 'expired' },
    })
    return false
  }

  return true
}
