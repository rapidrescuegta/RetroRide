// ─── WebRTC Signaling Relay API ──────────────────────────────────────────────
// Exchanges SDP offers/answers between host and joiner using 6-character room
// codes. Rooms auto-expire after 2 hours.
//
// Backend is a SignalStore abstraction (see src/lib/signal-store.ts):
//   • Prisma/Postgres — multi-instance production.
//   • In-memory — fallback when DATABASE_URL is unset OR the DB is unreachable
//                 at request time. Great for laptop-hosted hotspot play on a
//                 plane / car trip where no DB is running.
//
// Clients don't need to know which backend is active; the wire protocol is
// identical. Polling-based (no WebSockets) keeps this serverless-friendly.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getSignalStore, downgradeToMemoryIfDbDead } from '@/lib/signal-store'

const ROOM_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

async function store() {
  // Lazy downgrade ensures the first request with a dead DB still succeeds.
  return downgradeToMemoryIfDbDead()
}

// ─── GET: Fetch room data ────────────────────────────────────────────────────
// ?roomCode=ABC123&role=host   -> returns { offer, answers[] }
// ?roomCode=ABC123&role=joiner -> returns { offer }

export async function GET(req: NextRequest) {
  const roomCode = req.nextUrl.searchParams.get('roomCode')
  const role = req.nextUrl.searchParams.get('role') || 'joiner'

  if (!roomCode) {
    return NextResponse.json({ error: 'roomCode is required' }, { status: 400 })
  }

  const code = roomCode.toUpperCase()
  const s = await store()

  if (!(await s.roomExists(code))) {
    return NextResponse.json({ error: 'Room not found or has expired' }, { status: 404 })
  }

  if (role === 'host') {
    const view = await s.getHostView(code)
    return NextResponse.json({
      roomCode: code,
      offer: view.offer,
      answers: view.answers,
      backend: s.backend,
    })
  }

  const offer = await s.getOffer(code)
  return NextResponse.json({ roomCode: code, offer, backend: s.backend })
}

// ─── POST: Signaling actions ─────────────────────────────────────────────────
// Actions: create, answer, update-offer, consume-answer, close

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, roomCode } = body

    if (!action || !roomCode) {
      return NextResponse.json(
        { error: 'action and roomCode are required' },
        { status: 400 }
      )
    }

    const code = roomCode.toUpperCase()
    const s = await store()

    switch (action) {
      case 'create': {
        const { offer } = body
        if (!offer) {
          return NextResponse.json({ error: 'offer is required' }, { status: 400 })
        }
        try {
          await s.createRoom(code, offer, ROOM_TTL_MS)
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Failed to create room'
          return NextResponse.json({ error: message }, { status: 409 })
        }
        return NextResponse.json({ roomCode: code, created: true, backend: s.backend })
      }

      case 'answer': {
        const { answer } = body
        if (!answer) {
          return NextResponse.json({ error: 'answer is required' }, { status: 400 })
        }
        try {
          const position = await s.pushAnswer(code, answer)
          return NextResponse.json({ queued: true, position })
        } catch {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
      }

      case 'update-offer': {
        const { offer } = body
        if (!offer) {
          return NextResponse.json({ error: 'offer is required' }, { status: 400 })
        }
        const ok = await s.updateOffer(code, offer)
        if (!ok) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        return NextResponse.json({ updated: true })
      }

      case 'consume-answer': {
        if (!(await s.roomExists(code))) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 })
        }
        const answerIndex = body.answerIndex ?? 0
        const remaining = await s.consumeAnswer(code, answerIndex)
        return NextResponse.json({ consumed: true, remaining })
      }

      case 'close': {
        await s.closeRoom(code)
        return NextResponse.json({ closed: true })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error('Signal API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
