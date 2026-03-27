import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'GameBuddi <noreply@gamebuddi.com>',
          to: [normalizedEmail],
          subject: `Your GameBuddi verification code: ${code}`,
          html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #8b5cf6; text-align: center;">🎮 GameBuddi</h2>
              <p style="text-align: center; color: #555;">Your verification code is:</p>
              <div style="background: #1a1a3e; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; color: #06b6d4; letter-spacing: 8px; font-family: monospace;">${code}</span>
              </div>
              <p style="text-align: center; color: #888; font-size: 13px;">This code expires in 10 minutes.</p>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error('Failed to send email:', err)
    }
  } else {
    // Dev mode: log the code
    console.log(`[DEV] Verification code for ${normalizedEmail}: ${code}`)
  }

  return NextResponse.json({ sent: true })
}
