// ─── Signaling Client ────────────────────────────────────────────────────────
// Room-code based signaling for WebRTC over the internet.
// Uses a simple REST API as a relay (no WebSocket needed).
// Flow:
//   1. Host creates room -> posts SDP offer to /api/signal
//   2. Joiner enters room code -> fetches offer from /api/signal
//   3. Joiner creates SDP answer -> posts it to /api/signal
//   4. Host polls for answer -> fetches it from /api/signal
//   5. Both sides now have SDP, WebRTC connects peer-to-peer
// ─────────────────────────────────────────────────────────────────────────────

import { LocalNetwork, generateId } from './local-network'
import type { PeerInfo } from './local-network'

const SIGNAL_BASE = '/api/signal'
const POLL_INTERVAL_MS = 1500
const POLL_TIMEOUT_MS = 120_000 // 2 minutes max wait

export type SignalingState =
  | 'idle'
  | 'creating'          // Host is creating the room
  | 'waiting-for-join'  // Host is waiting for a joiner
  | 'joining'           // Joiner is fetching the offer
  | 'connecting'        // WebRTC handshake in progress
  | 'connected'         // Data channel is open
  | 'error'
  | 'timeout'

export type SignalingStateHandler = (state: SignalingState, detail?: string) => void

/**
 * High-level signaling orchestrator that coordinates the LocalNetwork WebRTC
 * layer with the REST signaling API.
 */
export class SignalingClient {
  private network: LocalNetwork
  private stateHandlers: SignalingStateHandler[] = []
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private backgroundPollTimer: ReturnType<typeof setInterval> | null = null
  private aborted = false

  state: SignalingState = 'idle'
  roomCode: string = ''

  constructor(network: LocalNetwork) {
    this.network = network
  }

  onStateChange(handler: SignalingStateHandler): () => void {
    this.stateHandlers.push(handler)
    return () => {
      this.stateHandlers = this.stateHandlers.filter(h => h !== handler)
    }
  }

  private setState(state: SignalingState, detail?: string) {
    this.state = state
    for (const handler of this.stateHandlers) {
      handler(state, detail)
    }
  }

  // ─── Host Flow ─────────────────────────────────────────────────────────────

  /**
   * HOST: Create a room, post offer to signaling server, then poll for answers.
   * Returns when the first joiner connects.
   */
  async hostRoom(localPeer: PeerInfo): Promise<void> {
    this.aborted = false
    this.setState('creating')

    try {
      // Create the WebRTC offer
      const { roomId, offer } = await this.network.createRoomWithSignaling(localPeer)
      this.roomCode = roomId

      // Post the offer to the signaling server
      const res = await fetch(SIGNAL_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          roomCode: roomId,
          offer,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to create room' }))
        throw new Error(err.error || 'Failed to create room')
      }

      this.setState('waiting-for-join')

      // Poll for answers
      await this.pollForAnswers(roomId)
    } catch (err: any) {
      if (!this.aborted) {
        this.setState('error', err.message || 'Unknown error')
      }
      throw err
    }
  }

  private async pollForAnswers(roomCode: string): Promise<void> {
    const startTime = Date.now()

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        if (this.aborted) {
          reject(new Error('Aborted'))
          return
        }

        if (Date.now() - startTime > POLL_TIMEOUT_MS) {
          this.setState('timeout')
          reject(new Error('Timed out waiting for a player to join'))
          return
        }

        try {
          const res = await fetch(`${SIGNAL_BASE}?roomCode=${roomCode}&role=host`)
          if (!res.ok) {
            // Room might have expired, retry
            this.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
            return
          }

          const data = await res.json()

          if (data.answers && data.answers.length > 0) {
            // Process the first unhandled answer
            const answer = data.answers[0]
            this.setState('connecting')

            try {
              await this.network.acceptJoinerWithSignaling(answer)

              // Post the updated offer for the next potential joiner
              const nextOffer = await this.network.getCurrentFullOffer()
              if (nextOffer) {
                await fetch(SIGNAL_BASE, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'update-offer',
                    roomCode,
                    offer: nextOffer,
                  }),
                })
              }

              // Mark this answer as consumed
              await fetch(SIGNAL_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'consume-answer',
                  roomCode,
                  answerIndex: 0,
                }),
              })

              this.setState('connected')
              resolve()

              // Continue polling for more joiners in the background
              this.continuePollForMoreJoiners(roomCode)
            } catch {
              // Connection failed, keep polling
              this.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
            }
            return
          }

          // No answers yet, keep polling
          this.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        } catch {
          // Network error, retry
          this.pollTimer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      }

      poll()
    })
  }

  private continuePollForMoreJoiners(roomCode: string): void {
    this.backgroundPollTimer = setInterval(async () => {
      if (this.aborted) {
        if (this.backgroundPollTimer) clearInterval(this.backgroundPollTimer)
        return
      }

      try {
        const res = await fetch(`${SIGNAL_BASE}?roomCode=${roomCode}&role=host`)
        if (!res.ok) return

        const data = await res.json()

        if (data.answers && data.answers.length > 0) {
          const answer = data.answers[0]

          try {
            await this.network.acceptJoinerWithSignaling(answer)

            // Update offer for next joiner
            const nextOffer = await this.network.getCurrentFullOffer()
            if (nextOffer) {
              await fetch(SIGNAL_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'update-offer',
                  roomCode,
                  offer: nextOffer,
                }),
              })
            }

            // Consume the answer
            await fetch(SIGNAL_BASE, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'consume-answer',
                roomCode,
                answerIndex: 0,
              }),
            })
          } catch {
            // Failed to connect this joiner, will retry
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, POLL_INTERVAL_MS)
  }

  // ─── Joiner Flow ───────────────────────────────────────────────────────────

  /**
   * JOINER: Enter a room code, fetch the host's offer, create an answer,
   * and post it back. The WebRTC connection completes automatically.
   */
  async joinRoom(roomCode: string, localPeer: PeerInfo): Promise<void> {
    this.aborted = false
    this.roomCode = roomCode.toUpperCase().trim()
    this.setState('joining')

    try {
      // Fetch the host's offer
      const res = await fetch(`${SIGNAL_BASE}?roomCode=${this.roomCode}&role=joiner`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Room not found' }))
        throw new Error(err.error || 'Room not found')
      }

      const data = await res.json()
      if (!data.offer) {
        throw new Error('Room not found or has expired')
      }

      this.setState('connecting')

      // Create the WebRTC answer
      const answer = await this.network.joinRoomWithSignaling(data.offer, localPeer)

      // Post the answer back to the signaling server
      const postRes = await fetch(SIGNAL_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'answer',
          roomCode: this.roomCode,
          answer,
        }),
      })

      if (!postRes.ok) {
        throw new Error('Failed to send answer to signaling server')
      }

      // Wait for the data channel to actually open
      await this.waitForDataChannel()

      this.setState('connected')
    } catch (err: any) {
      if (!this.aborted) {
        this.setState('error', err.message || 'Unknown error')
      }
      throw err
    }
  }

  private waitForDataChannel(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const done = (err?: Error) => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        clearInterval(check)
        removePeerHandler()
        if (err) reject(err)
        else resolve()
      }

      const timeout = setTimeout(() => {
        done(new Error('Connection timed out - the host may be behind a strict firewall. Try a different network or ask the host to use mobile data.'))
      }, 30_000)

      // Check if already connected
      const checkConnected = () => {
        const peers = this.network.getPeers()
        if (peers.length > 0) {
          done()
        }
      }

      const check = setInterval(checkConnected, 500)
      checkConnected()

      // Also listen for peer join events
      const removePeerHandler = this.network.onPeerJoined(() => {
        done()
      })
    })
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  abort(): void {
    this.aborted = true
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.backgroundPollTimer) {
      clearInterval(this.backgroundPollTimer)
      this.backgroundPollTimer = null
    }
    this.setState('idle')
  }

  /**
   * Clean up the room on the signaling server.
   */
  async cleanup(): Promise<void> {
    this.abort()
    if (this.roomCode) {
      try {
        await fetch(SIGNAL_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'close',
            roomCode: this.roomCode,
          }),
        })
      } catch {
        // Best effort cleanup
      }
    }
  }
}
