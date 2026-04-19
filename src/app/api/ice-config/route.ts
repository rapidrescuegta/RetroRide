// ─── ICE Configuration API ──────────────────────────────────────────────────
// Returns TURN server credentials to the client for WebRTC NAT traversal.
// Keeps TURN credentials server-side (not exposed via NEXT_PUBLIC_ env vars).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'

// Public STUN servers (always included — free, no auth needed)
const PUBLIC_STUN: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
]

// Free public TURN relay (metered.ca offers a free tier)
const PUBLIC_TURN: RTCIceServer[] = [
  {
    urls: 'turn:a.relay.metered.ca:80',
    username: 'e8dd65d92aee3e4e09f9b21a',
    credential: 'uWdJjTvn5VRHVtFi',
  },
  {
    urls: 'turn:a.relay.metered.ca:443',
    username: 'e8dd65d92aee3e4e09f9b21a',
    credential: 'uWdJjTvn5VRHVtFi',
  },
  {
    urls: 'turn:a.relay.metered.ca:443?transport=tcp',
    username: 'e8dd65d92aee3e4e09f9b21a',
    credential: 'uWdJjTvn5VRHVtFi',
  },
]

export async function GET() {
  const turnUrl = process.env.TURN_SERVER_URL
  const turnUsername = process.env.TURN_SERVER_USERNAME
  const turnCredential = process.env.TURN_SERVER_CREDENTIAL

  const iceServers: RTCIceServer[] = [...PUBLIC_STUN]

  if (turnUrl) {
    // Prefer user-configured TURN server (placed first for priority)
    iceServers.unshift({
      urls: turnUrl,
      username: turnUsername || '',
      credential: turnCredential || '',
    })
  } else {
    // Fall back to free public TURN relay
    iceServers.push(...PUBLIC_TURN)
  }

  return NextResponse.json({ iceServers }, {
    headers: {
      'Cache-Control': 'private, max-age=300',
    },
  })
}
