import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendFeedbackNotification } from '@/lib/email'

const MAX_SCREENSHOT_BYTES = 700_000
const MAX_COMMENT_LENGTH = 5000
const VALID_CATEGORIES = new Set(['bug', 'suggestion', 'question'])

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
  if (!comment) {
    return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json({ error: 'Comment too long' }, { status: 400 })
  }

  const screenshot =
    typeof body.screenshot === 'string' && body.screenshot ? body.screenshot : null
  if (screenshot && screenshot.length > MAX_SCREENSHOT_BYTES) {
    return NextResponse.json({ error: 'Screenshot too large' }, { status: 413 })
  }

  const category =
    typeof body.category === 'string' && VALID_CATEGORIES.has(body.category)
      ? body.category
      : 'bug'

  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl.slice(0, 500) : ''
  const memberId = typeof body.memberId === 'string' ? body.memberId : null
  const familyId = typeof body.familyId === 'string' ? body.familyId : null
  const userName = typeof body.userName === 'string' ? body.userName.slice(0, 100) : null
  const userEmail = typeof body.userEmail === 'string' ? body.userEmail.slice(0, 200) : null

  const consoleLogs = Array.isArray(body.consoleLogs) ? body.consoleLogs : null

  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null

  let feedback
  try {
    feedback = await prisma.feedback.create({
      data: {
        memberId,
        familyId,
        userName,
        userEmail,
        pageUrl,
        comment,
        screenshot,
        // Prisma's Json type accepts unknown arrays/objects
        consoleLogs: consoleLogs as never,
        category,
        userAgent,
        ipAddress,
      },
    })
  } catch (err) {
    console.error('[feedback] Failed to store feedback:', err)
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  // Fire-and-forget email notification — never block the response
  sendFeedbackNotification({
    feedbackId: feedback.id,
    category,
    comment,
    pageUrl,
    userName,
    userEmail,
    familyId,
    userAgent,
    ipAddress,
    screenshot,
    consoleLogCount: consoleLogs?.length ?? 0,
  }).catch((err) => {
    console.error('[feedback] Email notification failed:', err)
  })

  return NextResponse.json({ id: feedback.id, status: 'received' }, { status: 201 })
}
