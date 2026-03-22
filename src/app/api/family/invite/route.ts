import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const { familyId, email, invitedByMemberId } = await req.json()

  if (!familyId || !email || !invitedByMemberId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const normalizedEmail = email.toLowerCase().trim()

  // Validate family exists
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    include: { members: true },
  })

  if (!family) {
    return NextResponse.json({ error: 'Family not found' }, { status: 404 })
  }

  // Validate inviter is a member of this family
  const inviter = family.members.find((m) => m.id === invitedByMemberId)
  if (!inviter) {
    return NextResponse.json({ error: 'You are not a member of this family' }, { status: 403 })
  }

  // Check if this email is already a member
  const existingMember = family.members.find(
    (m) => m.email.toLowerCase() === normalizedEmail
  )
  if (existingMember) {
    return NextResponse.json({ error: 'This person is already in your family!' }, { status: 400 })
  }

  // Check for existing pending invite to this email for this family
  const existingInvite = await prisma.invite.findFirst({
    where: {
      familyId,
      email: normalizedEmail,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
  })

  if (existingInvite) {
    return NextResponse.json({ error: 'An invite was already sent to this email' }, { status: 400 })
  }

  // Create invite with 7-day expiry
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const invite = await prisma.invite.create({
    data: {
      familyId,
      email: normalizedEmail,
      invitedBy: invitedByMemberId,
      expiresAt,
    },
  })

  // Send invite email via Resend
  const appUrl = process.env.NEXTAUTH_URL || 'https://retroride-production.up.railway.app'
  const familyCode = family.code
  const formattedCode = familyCode.slice(0, 4) + '-' + familyCode.slice(4)

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
          from: process.env.EMAIL_FROM || 'RetroRide <noreply@retroride.app>',
          to: [normalizedEmail],
          subject: `${inviter.name} invited you to join ${family.name} on RetroRide!`,
          html: `
            <div style="font-family: 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; background: #0f0a1e; border-radius: 16px; overflow: hidden;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 50%, #06b6d4 100%); padding: 32px 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 8px;">🕹️🎮🚀</div>
                <h1 style="color: white; font-size: 28px; font-weight: 800; margin: 0; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                  RetroRide
                </h1>
                <p style="color: rgba(255,255,255,0.85); font-size: 14px; margin: 6px 0 0;">
                  Family Arcade
                </p>
              </div>

              <!-- Body -->
              <div style="padding: 32px 24px;">
                <p style="color: #c4b5fd; font-size: 16px; text-align: center; margin: 0 0 24px;">
                  <strong style="color: #e879f9;">${inviter.name}</strong> wants you to join
                  <strong style="color: #22d3ee;"> ${family.name}</strong>!
                </p>

                <p style="color: #94a3b8; font-size: 14px; text-align: center; margin: 0 0 20px;">
                  Use this code to join the family and start competing on the leaderboards:
                </p>

                <!-- Family Code Box -->
                <div style="background: linear-gradient(135deg, #1e1b4b 0%, #172554 100%); border: 2px solid #7c3aed; border-radius: 16px; padding: 24px; text-align: center; margin: 0 0 24px;">
                  <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 12px;">
                    Your Family Code
                  </p>
                  <p style="font-size: 36px; font-weight: 900; color: #22d3ee; letter-spacing: 8px; font-family: 'Courier New', monospace; margin: 0; text-shadow: 0 0 20px rgba(34,211,238,0.4);">
                    ${formattedCode}
                  </p>
                </div>

                <!-- CTA Button -->
                <div style="text-align: center; margin: 0 0 24px;">
                  <a href="${appUrl}/family" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: white; font-size: 16px; font-weight: 700; padding: 14px 36px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 20px rgba(124,58,237,0.4);">
                    🎮 Join the Fun!
                  </a>
                </div>

                <!-- Instructions -->
                <div style="background: rgba(139,92,246,0.1); border-radius: 12px; padding: 16px; margin: 0 0 16px;">
                  <p style="color: #a78bfa; font-size: 13px; margin: 0 0 8px; font-weight: 600;">How to join:</p>
                  <ol style="color: #94a3b8; font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>Tap the button above or go to <a href="${appUrl}/family" style="color: #22d3ee; text-decoration: none;">${appUrl.replace('https://', '')}/family</a></li>
                    <li>Choose <strong style="color: #e2e8f0;">"Join a Family"</strong></li>
                    <li>Enter the code: <strong style="color: #22d3ee;">${formattedCode}</strong></li>
                    <li>Pick your name and avatar</li>
                    <li>Start playing! 🕹️</li>
                  </ol>
                </div>
              </div>

              <!-- Footer -->
              <div style="padding: 16px 24px; text-align: center; border-top: 1px solid rgba(139,92,246,0.2);">
                <p style="color: #475569; font-size: 11px; margin: 0;">
                  This invite expires in 7 days. If you didn't expect this, just ignore it.
                </p>
              </div>
            </div>
          `,
        }),
      })
    } catch (err) {
      console.error('Failed to send invite email:', err)
    }
  } else {
    console.log(`[DEV] Invite sent to ${normalizedEmail} for family ${family.name} (code: ${familyCode})`)
  }

  return NextResponse.json({ invite })
}

export async function GET(req: NextRequest) {
  const familyId = req.nextUrl.searchParams.get('familyId')

  if (!familyId) {
    return NextResponse.json({ error: 'familyId required' }, { status: 400 })
  }

  const invites = await prisma.invite.findMany({
    where: {
      familyId,
      status: 'pending',
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ invites })
}
