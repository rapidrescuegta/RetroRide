import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function generateCode(familyName: string): string {
  const prefix = familyName.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase() || 'FAM'
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${suffix}`
}

// POST: Create a new family
export async function POST(req: NextRequest) {
  const { familyName, memberName, email, avatar, emailConsent } = await req.json()

  if (!familyName || !memberName || !email) {
    return NextResponse.json({ error: 'Family name, your name, and email are required' }, { status: 400 })
  }

  // Check email isn't already used
  const existing = await prisma.member.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing) {
    return NextResponse.json({ error: 'This email is already registered. Try joining instead.' }, { status: 400 })
  }

  const code = generateCode(familyName)

  const family = await prisma.family.create({
    data: {
      name: familyName,
      code,
      members: {
        create: {
          name: memberName,
          email: email.toLowerCase().trim(),
          emailVerified: true,
          emailConsent: emailConsent !== false,
          avatar: avatar || '😀',
        },
      },
    },
    include: { members: true },
  })

  return NextResponse.json({
    family: { id: family.id, name: family.name, code: family.code },
    member: family.members[0],
  })
}

// GET: Get family info by code
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const familyId = req.nextUrl.searchParams.get('familyId')

  if (!code && !familyId) {
    return NextResponse.json({ error: 'code or familyId required' }, { status: 400 })
  }

  const family = await prisma.family.findFirst({
    where: code ? { code } : { id: familyId! },
    include: {
      members: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!family) {
    return NextResponse.json({ error: 'Family not found' }, { status: 404 })
  }

  return NextResponse.json({ family })
}
