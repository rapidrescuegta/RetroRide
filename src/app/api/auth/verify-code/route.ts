import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { email, code } = await req.json()

  if (!email || !code) {
    return NextResponse.json({ error: 'Email and code required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Find matching unused code
  const verification = await prisma.verificationCode.findFirst({
    where: {
      email: normalizedEmail,
      code: code.trim(),
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!verification) {
    return NextResponse.json({ error: 'Invalid or expired code. Please try again.' }, { status: 400 })
  }

  // Mark as used
  await prisma.verificationCode.update({
    where: { id: verification.id },
    data: { used: true },
  })

  return NextResponse.json({ verified: true, email: normalizedEmail })
}
