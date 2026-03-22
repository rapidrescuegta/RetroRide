import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Check if already subscribed
  const existing = await prisma.subscriber.findUnique({ where: { email: normalizedEmail } })
  if (existing) {
    return NextResponse.json({ already: true })
  }

  // Check if they're already a Member (Family Mode user)
  const member = await prisma.member.findUnique({ where: { email: normalizedEmail } })
  if (member) {
    return NextResponse.json({ already: true })
  }

  // Create subscriber
  await prisma.subscriber.create({
    data: { email: normalizedEmail, emailVerified: true, emailConsent: true }
  })

  return NextResponse.json({ subscribed: true })
}
