import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST: Join a family with a code
export async function POST(req: NextRequest) {
  const { code, memberName, avatar } = await req.json()

  if (!code || !memberName) {
    return NextResponse.json({ error: 'Family code and your name are required' }, { status: 400 })
  }

  const family = await prisma.family.findUnique({
    where: { code: code.toUpperCase().trim() },
    include: { members: true },
  })

  if (!family) {
    return NextResponse.json({ error: 'Family not found. Check the code and try again.' }, { status: 404 })
  }

  // Check if name already taken in this family
  const existing = family.members.find(
    m => m.name.toLowerCase() === memberName.toLowerCase()
  )
  if (existing) {
    // Return existing member (re-login)
    return NextResponse.json({
      family: { id: family.id, name: family.name, code: family.code },
      member: existing,
    })
  }

  const member = await prisma.member.create({
    data: {
      name: memberName,
      avatar: avatar || '😀',
      familyId: family.id,
    },
  })

  return NextResponse.json({
    family: { id: family.id, name: family.name, code: family.code },
    member,
  })
}
