import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/push-server'

// Runtime fallback for the VAPID public key.
//
// NEXT_PUBLIC_VAPID_PUBLIC_KEY is inlined into the client bundle at build
// time, which means rotating the keypair requires a rebuild. This endpoint
// serves the current key straight from the server so the browser can always
// fetch it (and so a key rotation takes effect without a redeploy).
//
// The public key is not a secret — it is meant to be handed to browsers.

export const dynamic = 'force-dynamic'

export async function GET() {
  const publicKey = getVapidPublicKey()

  return NextResponse.json(
    { publicKey, configured: publicKey.length > 0 },
    {
      status: publicKey ? 200 : 503,
      headers: { 'Cache-Control': 'public, max-age=3600' },
    }
  )
}
