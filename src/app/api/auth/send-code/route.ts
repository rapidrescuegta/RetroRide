import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendVerificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  // Store the code
  await prisma.verificationCode.create({
    data: { email: normalizedEmail, code, expiresAt },
  })

  // Send email via Resend
  if (process.env.RESEND_API_KEY) {
    try {
      await sendVerificationEmail(normalizedEmail, code)
    } catch (err) {
      console.error('Failed to send verification email:', err)
    }
  } else {
    // Dev mode: log the code
    console.log(`[DEV] Verification code for ${normalizedEmail}: ${code}`)
  }

  return NextResponse.json({ sent: true })
}
