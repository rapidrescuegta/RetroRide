// ─── Network Adapter ────────────────────────────────────────────────────────
// Wraps LocalNetwork to satisfy the NetworkInterface expected by useMultiplayerGame.
// ─────────────────────────────────────────────────────────────────────────────

import type { LocalNetwork, NetworkMessage } from './local-network'
import type { NetworkInterface } from './multiplayer-game'

export class NetworkAdapter implements NetworkInterface {
  constructor(private network: LocalNetwork) {}

  sendMessage(msg: any): void {
    this.network.sendMessage(msg)
  }

  sendTo(peerId: string, msg: any): void {
    // Send a targeted message through the network.
    // The host relays messages with a `to` field to the correct peer.
    this.network.sendMessage({ ...msg, to: peerId })
  }

  onMessage(handler: (msg: any, fromPeerId: string) => void): () => void {
    const wrappedHandler = (netMsg: NetworkMessage, fromPeerId: string) => {
      // Pass the data payload (which contains the GameMessage) and the sender id
      handler(netMsg.data ?? netMsg, fromPeerId)
    }
    return this.network.onMessage(wrappedHandler)
  }

  get isHost(): boolean {
    return this.network.isHost
  }

  get myPeerId(): string {
    return this.network.localPeer.id
  }

  getPeers(): { id: string; name: string; avatar: string }[] {
    // Include ourselves in the peer list so the game knows about all players
    const remotePeers = this.network.getPeers().map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
    }))
    return [
      {
        id: this.network.localPeer.id,
        name: this.network.localPeer.name,
        avatar: this.network.localPeer.avatar,
      },
      ...remotePeers,
    ]
  }
}
