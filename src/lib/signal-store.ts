// ─── Signaling Store ─────────────────────────────────────────────────────────
// Abstraction over the signaling persistence layer used by /api/signal.
//
// Two backends are provided:
//
//  • PrismaSignalStore — DB-backed, multi-instance safe. Used in production
//    when DATABASE_URL is set and Prisma can connect.
//
//  • MemorySignalStore — single-process, zero-dependency. Used as a fallback
//    when Postgres is unavailable (e.g. a family running `npm run dev` on a
//    laptop during a plane trip, with just the hotspot between phones).
//
// The active store is picked by `getSignalStore()` at first use and cached.
// Expired rooms are pruned on each write.
// ─────────────────────────────────────────────────────────────────────────────

// NOTE: Prisma is lazy-imported inside PrismaSignalStore methods.
// `src/lib/db.ts` throws at module-load time when DATABASE_URL is missing,
// so a top-level `import { prisma } from './prisma'` would break the
// DB-less memory fallback (which is exactly when DATABASE_URL is blank).
// Dynamic import keeps the memory path completely Prisma-free.
type PrismaLike = typeof import('./prisma')['prisma']
let _prisma: PrismaLike | null = null
async function getPrisma(): Promise<PrismaLike> {
  if (!_prisma) {
    const mod = await import('./prisma')
    _prisma = mod.prisma
  }
  return _prisma
}

export interface SignalStore {
  /** Implementation tag — useful for logs / health endpoints. */
  readonly backend: 'prisma' | 'memory'

  /** Does this room exist and still valid? */
  roomExists(code: string): Promise<boolean>

  /** Create a new room and store the host's offer. Throws if the code is taken. */
  createRoom(code: string, offer: string, ttlMs: number): Promise<void>

  /** Replace the host's offer (e.g. after accepting a joiner). */
  updateOffer(code: string, offer: string): Promise<boolean>

  /** Queue a joiner answer. Returns the new queue length. */
  pushAnswer(code: string, answer: string): Promise<number>

  /** Fetch the current offer for a joiner. */
  getOffer(code: string): Promise<string | null>

  /** Fetch offer + queued answers for the host. */
  getHostView(code: string): Promise<{ offer: string | null; answers: string[] }>

  /** Remove the Nth queued answer. */
  consumeAnswer(code: string, index: number): Promise<number>

  /** Tear down a room. */
  closeRoom(code: string): Promise<void>
}

// ─── Prisma-backed store ─────────────────────────────────────────────────────

class PrismaSignalStore implements SignalStore {
  readonly backend = 'prisma' as const

  async cleanupExpired(): Promise<void> {
    try {
      const prisma = await getPrisma()
      await prisma.signalingRoom.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      })
    } catch {
      // best-effort
    }
  }

  async roomExists(code: string): Promise<boolean> {
    const prisma = await getPrisma()
    const room = await prisma.signalingRoom.findUnique({ where: { code } })
    if (!room) return false
    if (room.expiresAt < new Date()) {
      await prisma.signalingRoom.delete({ where: { code } }).catch(() => {})
      return false
    }
    return true
  }

  async createRoom(code: string, offer: string, ttlMs: number): Promise<void> {
    await this.cleanupExpired()
    const expiresAt = new Date(Date.now() + ttlMs)
    const prisma = await getPrisma()

    const existing = await prisma.signalingRoom.findUnique({ where: { code } })
    if (existing) {
      if (existing.expiresAt > new Date()) {
        throw new Error('Room code already in use. Try again.')
      }
      await prisma.signalingRoom.delete({ where: { code } })
    }

    await prisma.signalingRoom.create({
      data: { code, hostMemberId: 'host', expiresAt },
    })
    await prisma.signalingMessage.create({
      data: { roomCode: code, fromMemberId: 'host', type: 'offer', payload: offer },
    })
  }

  async updateOffer(code: string, offer: string): Promise<boolean> {
    if (!(await this.roomExists(code))) return false
    const prisma = await getPrisma()
    await prisma.signalingMessage.deleteMany({ where: { roomCode: code, type: 'offer' } })
    await prisma.signalingMessage.create({
      data: { roomCode: code, fromMemberId: 'host', type: 'offer', payload: offer },
    })
    return true
  }

  async pushAnswer(code: string, answer: string): Promise<number> {
    if (!(await this.roomExists(code))) {
      throw new Error('Room not found')
    }
    const prisma = await getPrisma()
    await prisma.signalingMessage.create({
      data: { roomCode: code, fromMemberId: 'joiner', type: 'answer', payload: answer },
    })
    return prisma.signalingMessage.count({ where: { roomCode: code, type: 'answer' } })
  }

  async getOffer(code: string): Promise<string | null> {
    if (!(await this.roomExists(code))) return null
    const prisma = await getPrisma()
    const msg = await prisma.signalingMessage.findFirst({
      where: { roomCode: code, type: 'offer' },
      orderBy: { createdAt: 'desc' },
    })
    return msg?.payload ?? null
  }

  async getHostView(code: string): Promise<{ offer: string | null; answers: string[] }> {
    if (!(await this.roomExists(code))) return { offer: null, answers: [] }
    const prisma = await getPrisma()
    const [offerMsg, answerMsgs] = await Promise.all([
      prisma.signalingMessage.findFirst({
        where: { roomCode: code, type: 'offer' },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.signalingMessage.findMany({
        where: { roomCode: code, type: 'answer' },
        orderBy: { createdAt: 'asc' },
      }),
    ])
    return {
      offer: offerMsg?.payload ?? null,
      answers: answerMsgs.map(a => a.payload),
    }
  }

  async consumeAnswer(code: string, index: number): Promise<number> {
    if (!(await this.roomExists(code))) return 0
    const prisma = await getPrisma()
    const answers = await prisma.signalingMessage.findMany({
      where: { roomCode: code, type: 'answer' },
      orderBy: { createdAt: 'asc' },
    })
    if (answers[index]) {
      await prisma.signalingMessage.delete({ where: { id: answers[index].id } })
    }
    return Math.max(0, answers.length - 1)
  }

  async closeRoom(code: string): Promise<void> {
    try {
      const prisma = await getPrisma()
      await prisma.signalingRoom.delete({ where: { code } })
    } catch {
      // already gone
    }
  }
}

// ─── In-memory store (DB-less fallback) ──────────────────────────────────────

interface MemoryRoom {
  offer: string | null
  answers: string[]
  expiresAt: number
}

class MemorySignalStore implements SignalStore {
  readonly backend = 'memory' as const

  // Process-global map so HMR doesn't wipe in-flight rooms during development.
  private rooms: Map<string, MemoryRoom>

  constructor() {
    const globalScope = globalThis as typeof globalThis & {
      __retrorideMemorySignalRooms?: Map<string, MemoryRoom>
    }
    if (!globalScope.__retrorideMemorySignalRooms) {
      globalScope.__retrorideMemorySignalRooms = new Map()
    }
    this.rooms = globalScope.__retrorideMemorySignalRooms
  }

  private pruneExpired(): void {
    const now = Date.now()
    for (const [code, room] of this.rooms) {
      if (room.expiresAt < now) this.rooms.delete(code)
    }
  }

  async roomExists(code: string): Promise<boolean> {
    this.pruneExpired()
    return this.rooms.has(code)
  }

  async createRoom(code: string, offer: string, ttlMs: number): Promise<void> {
    this.pruneExpired()
    const existing = this.rooms.get(code)
    if (existing && existing.expiresAt > Date.now()) {
      throw new Error('Room code already in use. Try again.')
    }
    this.rooms.set(code, {
      offer,
      answers: [],
      expiresAt: Date.now() + ttlMs,
    })
  }

  async updateOffer(code: string, offer: string): Promise<boolean> {
    const room = this.rooms.get(code)
    if (!room || room.expiresAt < Date.now()) return false
    room.offer = offer
    return true
  }

  async pushAnswer(code: string, answer: string): Promise<number> {
    const room = this.rooms.get(code)
    if (!room || room.expiresAt < Date.now()) {
      throw new Error('Room not found')
    }
    room.answers.push(answer)
    return room.answers.length
  }

  async getOffer(code: string): Promise<string | null> {
    const room = this.rooms.get(code)
    if (!room || room.expiresAt < Date.now()) return null
    return room.offer
  }

  async getHostView(code: string): Promise<{ offer: string | null; answers: string[] }> {
    const room = this.rooms.get(code)
    if (!room || room.expiresAt < Date.now()) return { offer: null, answers: [] }
    return { offer: room.offer, answers: [...room.answers] }
  }

  async consumeAnswer(code: string, index: number): Promise<number> {
    const room = this.rooms.get(code)
    if (!room) return 0
    if (index >= 0 && index < room.answers.length) {
      room.answers.splice(index, 1)
    }
    return room.answers.length
  }

  async closeRoom(code: string): Promise<void> {
    this.rooms.delete(code)
  }
}

// ─── Backend selection ───────────────────────────────────────────────────────

let _store: SignalStore | null = null
let _backendLogged = false

function hasDatabaseUrl(): boolean {
  const url = process.env.DATABASE_URL
  return !!url && url.trim() !== ''
}

/**
 * Returns the active signaling store. Picks Prisma when DATABASE_URL is set,
 * otherwise falls back to the in-memory store (fine for a single-laptop
 * hotspot setup; not suitable for multi-instance production).
 */
export function getSignalStore(): SignalStore {
  if (_store) return _store

  if (hasDatabaseUrl()) {
    _store = new PrismaSignalStore()
  } else {
    _store = new MemorySignalStore()
  }

  if (!_backendLogged) {
    _backendLogged = true
    console.log(`[signal] Using ${_store.backend} store for WebRTC signaling`)
  }
  return _store
}

/**
 * Runtime probe: if the Prisma store is active but the DB is unreachable,
 * switch to memory for the rest of this process. Useful on first request if
 * the configured DB is down but the app should still allow LAN play.
 */
export async function downgradeToMemoryIfDbDead(): Promise<SignalStore> {
  const current = getSignalStore()
  if (current.backend !== 'prisma') return current
  try {
    const prisma = await getPrisma()
    await prisma.$queryRaw`SELECT 1`
    return current
  } catch {
    console.warn('[signal] Database unreachable — falling back to in-memory signaling')
    _store = new MemorySignalStore()
    return _store
  }
}
