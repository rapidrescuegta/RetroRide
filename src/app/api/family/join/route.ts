import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getFamilyEntitlements, lockedResponse } from '@/lib/entitlements'

// POST: Join a family with a code
export async function POST(req: NextRequest) {
  try {
    const { code, memberName, email, avatar, emailConsent } = await req.json()

    if (!code || !memberName || !email) {
      return NextResponse.json({ error: 'Family code, your name, and email are required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const family = await prisma.family.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: { members: true },
    })

    if (!family) {
      return NextResponse.json({ error: 'Family not found. Check the code and try again.' }, { status: 404 })
    }

    // Check if email already exists (re-login)
    const existingByEmail = family.members.find(
      m => m.email === normalizedEmail
    )
    if (existingByEmail) {
      return NextResponse.json({
        family: { id: family.id, name: family.name, code: family.code },
        member: existingByEmail,
      })
    }

    // Check if name already taken in this family
    const existingByName = family.members.find(
      m => m.name.toLowerCase() === memberName.toLowerCase()
    )
    if (existingByName) {
      return NextResponse.json({ error: 'That name is already taken in this family. Pick a different name.' }, { status: 400 })
    }

    // Check email isn't used in another family
    const emailUsed = await prisma.member.findUnique({ where: { email: normalizedEmail } })
    if (emailUsed) {
      return NextResponse.json({ error: 'This email is already registered in another family.' }, { status: 400 })
    }

    // Member limit — set by the family's plan. Checked AFTER the re-login
    // shortcut above, so an existing member can always sign back in.
    const entitlements = await getFamilyEntitlements(family.id)
    if (family.members.length >= entitlements.maxMembers) {
      const locked = lockedResponse('maxMembers', entitlements)
      return NextResponse.json(
        {
          ...locked,
          error: `This family is full — ${entitlements.label} includes ${entitlements.maxMembers} member${entitlements.maxMembers === 1 ? '' : 's'}. Upgrade to add more.`,
        },
        { status: 403 }
      )
    }

    const member = await prisma.member.create({
      data: {
        name: memberName,
        email: normalizedEmail,
        emailVerified: true,
        emailConsent: emailConsent !== false,
        avatar: avatar || '😀',
        familyId: family.id,
      },
    })

    return NextResponse.json({
      family: { id: family.id, name: family.name, code: family.code },
      member,
    })
  } catch (error) {
    console.error('[family/join] POST failed:', error)
    return NextResponse.json({ error: 'Failed to join family' }, { status: 500 })
  }
}
