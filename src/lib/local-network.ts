export interface PeerInfo {
  id: string
  name: string
  avatar: string
}

export interface NetworkMessage {
  type: string
  from: string
  to?: string
  data: any
}

export type MessageHandler = (msg: NetworkMessage, fromPeerId: string) => void
export type PeerHandler = (peer: PeerInfo) => void
export type PeerLeftHandler = (peerId: string) => void

interface CompactOffer {
  u: string    // ice-ufrag
  p: string    // ice-pwd
  f: string    // fingerprint hash
  ip: string   // local IP
  port: number
  id: string   // room id
  name: string
  avatar: string
}

interface CompactAnswer {
  u: string
  p: string
  f: string
  ip: string
  port: number
  id: string   // peer id
  name: string
  avatar: string
}

function generateId(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/**
 * Extract ice-ufrag, ice-pwd, fingerprint, and first host candidate (ip + port) from an SDP string.
 */
function extractSdpParams(sdp: string): { ufrag: string; pwd: string; fingerprint: string; ip: string; port: number } {
  const ufragMatch = sdp.match(/a=ice-ufrag:(\S+)/)
  const pwdMatch = sdp.match(/a=ice-pwd:(\S+)/)
  const fpMatch = sdp.match(/a=fingerprint:\S+ (\S+)/)
  // Look for a host candidate with a private IP
  const candidateMatch = sdp.match(/a=candidate:\S+ \d+ udp \d+ ([\d.]+) (\d+) typ host/)

  return {
    ufrag: ufragMatch?.[1] ?? '',
    pwd: pwdMatch?.[1] ?? '',
    fingerprint: fpMatch?.[1] ?? '',
    ip: candidateMatch?.[1] ?? '192.168.43.1',
    port: candidateMatch ? parseInt(candidateMatch[2], 10) : 9,
  }
}

/**
 * Build a minimal SDP from compact parameters.
 * This SDP is enough to establish a WebRTC data channel on a local network without STUN/TURN.
 */
function buildSdp(params: { ufrag: string; pwd: string; fingerprint: string; ip: string; port: number }, role: 'offer' | 'answer'): string {
  const { ufrag, pwd, fingerprint, ip, port } = params
  const setup = role === 'offer' ? 'actpass' : 'active'

  return [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=extmap-allow-mixed',
    'a=msid-semantic: WMS',
    'm=application ' + port + ' UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 ' + ip,
    'a=candidate:1 1 udp 2113937151 ' + ip + ' ' + port + ' typ host',
    'a=ice-ufrag:' + ufrag,
    'a=ice-pwd:' + pwd,
    'a=ice-options:trickle',
    'a=fingerprint:sha-256 ' + fingerprint,
    'a=setup:' + setup,
    'a=mid:0',
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  ].join('\r\n') + '\r\n'
}

export class LocalNetwork {
  isHost: boolean = false
  roomId: string = ''
  peers: Map<string, PeerInfo> = new Map()
  localPeer: PeerInfo = { id: '', name: '', avatar: '' }

  private connections: Map<string, RTCPeerConnection> = new Map()
  private channels: Map<string, RTCDataChannel> = new Map()
  private messageHandlers: MessageHandler[] = []
  private peerJoinedHandlers: PeerHandler[] = []
  private peerLeftHandlers: PeerLeftHandler[] = []
  private hostConnection: RTCPeerConnection | null = null
  private hostChannel: RTCDataChannel | null = null

  // Store the host's peer connection for accepting joiners
  private pendingPc: RTCPeerConnection | null = null
  private pendingPeerId: string = ''

  private rtcConfig: RTCConfiguration = {
    iceTransportPolicy: 'all',
    iceServers: [], // Local network only — no STUN/TURN
  }

  /**
   * HOST: Create a room and return compact offer string for QR encoding.
   */
  async createRoom(localPeer: PeerInfo): Promise<string> {
    this.isHost = true
    this.roomId = generateId(6)
    this.localPeer = { ...localPeer, id: localPeer.id || generateId(8) }

    // Create a peer connection that will be used for the first joiner
    const pc = new RTCPeerConnection(this.rtcConfig)
    const dc = pc.createDataChannel('retroride', { ordered: true })

    // Wait for ICE gathering to complete
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await this.waitForIceGathering(pc)

    const sdp = pc.localDescription!.sdp
    const params = extractSdpParams(sdp)

    this.pendingPc = pc
    this.setupHostDataChannel(dc, '')

    const compact: CompactOffer = {
      u: params.ufrag,
      p: params.pwd,
      f: params.fingerprint,
      ip: params.ip,
      port: params.port,
      id: this.roomId,
      name: this.localPeer.name,
      avatar: this.localPeer.avatar,
    }

    return JSON.stringify(compact)
  }

  /**
   * JOINER: Process host's QR data and return compact answer string.
   */
  async joinRoom(hostOfferStr: string, localPeer: PeerInfo): Promise<string> {
    this.isHost = false
    this.localPeer = { ...localPeer, id: localPeer.id || generateId(8) }

    const hostOffer: CompactOffer = JSON.parse(hostOfferStr)
    this.roomId = hostOffer.id

    // Add host to our peers list
    const hostPeerInfo: PeerInfo = {
      id: 'host',
      name: hostOffer.name,
      avatar: hostOffer.avatar,
    }
    this.peers.set('host', hostPeerInfo)

    const pc = new RTCPeerConnection(this.rtcConfig)
    this.hostConnection = pc

    // Set up incoming data channel handler
    pc.ondatachannel = (event) => {
      this.hostChannel = event.channel
      this.setupJoinerDataChannel(event.channel)
    }

    // Build and set remote offer SDP
    const offerSdp = buildSdp({
      ufrag: hostOffer.u,
      pwd: hostOffer.p,
      fingerprint: hostOffer.f,
      ip: hostOffer.ip,
      port: hostOffer.port,
    }, 'offer')

    await pc.setRemoteDescription({ type: 'offer', sdp: offerSdp })

    // Create and set answer
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await this.waitForIceGathering(pc)

    const answerSdp = pc.localDescription!.sdp
    const params = extractSdpParams(answerSdp)

    const compact: CompactAnswer = {
      u: params.ufrag,
      p: params.pwd,
      f: params.fingerprint,
      ip: params.ip,
      port: params.port,
      id: this.localPeer.id,
      name: this.localPeer.name,
      avatar: this.localPeer.avatar,
    }

    return JSON.stringify(compact)
  }

  /**
   * HOST: Process joiner's answer QR to complete the connection.
   */
  async acceptJoiner(answerDataStr: string): Promise<void> {
    if (!this.isHost || !this.pendingPc) {
      throw new Error('No pending connection to accept')
    }

    const answerData: CompactAnswer = JSON.parse(answerDataStr)
    const peerId = answerData.id

    const peerInfo: PeerInfo = {
      id: peerId,
      name: answerData.name,
      avatar: answerData.avatar,
    }

    // Build and set remote answer SDP
    const answerSdp = buildSdp({
      ufrag: answerData.u,
      pwd: answerData.p,
      fingerprint: answerData.f,
      ip: answerData.ip,
      port: answerData.port,
    }, 'answer')

    const pc = this.pendingPc

    await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    // Store the connection
    this.connections.set(peerId, pc)
    this.peers.set(peerId, peerInfo)
    this.pendingPeerId = peerId

    // Update the data channel mapping once open
    const existingChannel = this.channels.get('')
    if (existingChannel) {
      this.channels.delete('')
      this.channels.set(peerId, existingChannel)
      this.setupHostDataChannel(existingChannel, peerId)
    }

    // Notify the new peer about existing peers
    this.notifyPeerJoined(peerInfo)

    // Broadcast peer list to all connected peers
    this.broadcastPeerList()

    // Clear pending — ready for next joiner
    this.pendingPc = null

    // Prepare for next joiner
    await this.prepareForNextJoiner()
  }

  /**
   * HOST: Prepare a new peer connection for the next joiner.
   * Returns the new compact offer string for QR.
   */
  async prepareForNextJoiner(): Promise<string> {
    const pc = new RTCPeerConnection(this.rtcConfig)
    const dc = pc.createDataChannel('retroride', { ordered: true })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await this.waitForIceGathering(pc)

    const sdp = pc.localDescription!.sdp
    const params = extractSdpParams(sdp)

    this.pendingPc = pc
    this.setupHostDataChannel(dc, '')

    const compact: CompactOffer = {
      u: params.ufrag,
      p: params.pwd,
      f: params.fingerprint,
      ip: params.ip,
      port: params.port,
      id: this.roomId,
      name: this.localPeer.name,
      avatar: this.localPeer.avatar,
    }

    return JSON.stringify(compact)
  }

  /**
   * Send a message to all peers.
   * Host broadcasts to all connected peers.
   * Joiner sends to host (who relays).
   */
  sendMessage(msg: { type: string; [key: string]: any }): void {
    const fullMsg: NetworkMessage = {
      type: msg.type,
      from: this.localPeer.id,
      to: msg.to,
      data: msg,
    }

    const raw = JSON.stringify(fullMsg)

    if (this.isHost) {
      // Send to all connected peers
      for (const [, channel] of this.channels) {
        if (channel.readyState === 'open') {
          channel.send(raw)
        }
      }
    } else {
      // Send to host
      if (this.hostChannel && this.hostChannel.readyState === 'open') {
        this.hostChannel.send(raw)
      }
    }
  }

  /**
   * Register a message handler.
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler)
  }

  /**
   * Register a handler for when a peer joins.
   */
  onPeerJoined(handler: PeerHandler): void {
    this.peerJoinedHandlers.push(handler)
  }

  /**
   * Register a handler for when a peer leaves.
   */
  onPeerLeft(handler: PeerLeftHandler): void {
    this.peerLeftHandlers.push(handler)
  }

  /**
   * Get list of connected peers.
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values())
  }

  /**
   * Get the current QR offer string (for displaying to new joiners).
   */
  async getCurrentOffer(): Promise<string | null> {
    if (!this.isHost || !this.pendingPc) return null

    const sdp = this.pendingPc.localDescription?.sdp
    if (!sdp) return null

    const params = extractSdpParams(sdp)
    const compact: CompactOffer = {
      u: params.ufrag,
      p: params.pwd,
      f: params.fingerprint,
      ip: params.ip,
      port: params.port,
      id: this.roomId,
      name: this.localPeer.name,
      avatar: this.localPeer.avatar,
    }
    return JSON.stringify(compact)
  }

  /**
   * Clean up all connections.
   */
  close(): void {
    for (const [, channel] of this.channels) {
      channel.close()
    }
    for (const [, connection] of this.connections) {
      connection.close()
    }
    if (this.hostConnection) {
      this.hostConnection.close()
    }
    if (this.hostChannel) {
      this.hostChannel.close()
    }
    if (this.pendingPc) {
      this.pendingPc.close()
    }
    this.channels.clear()
    this.connections.clear()
    this.peers.clear()
    this.messageHandlers = []
    this.peerJoinedHandlers = []
    this.peerLeftHandlers = []
  }

  // --- Private helpers ---

  private async waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return

    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 3000)

      pc.onicecandidate = (event) => {
        if (event.candidate === null) {
          clearTimeout(timeout)
          resolve()
        }
      }

      // Also check periodically
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') {
          clearInterval(check)
          clearTimeout(timeout)
          resolve()
        }
      }, 100)
    })
  }

  private setupHostDataChannel(dc: RTCDataChannel, peerId: string): void {
    this.channels.set(peerId, dc)

    dc.onopen = () => {
      // Send peer list to newly connected peer
      if (peerId) {
        const peerListMsg: NetworkMessage = {
          type: '__peer_list',
          from: this.localPeer.id,
          to: peerId,
          data: {
            type: '__peer_list',
            peers: [
              { id: this.localPeer.id, name: this.localPeer.name, avatar: this.localPeer.avatar },
              ...Array.from(this.peers.values()),
            ],
          },
        }
        dc.send(JSON.stringify(peerListMsg))
      }
    }

    dc.onmessage = (event) => {
      try {
        const msg: NetworkMessage = JSON.parse(event.data)
        const fromId = peerId || msg.from

        // Handle relay messages
        if (msg.to && msg.to !== this.localPeer.id) {
          // Forward to specific peer
          const targetChannel = this.channels.get(msg.to)
          if (targetChannel && targetChannel.readyState === 'open') {
            targetChannel.send(event.data)
          }
          return
        }

        // If no specific target or targeted at host, process locally
        // Also relay to all other peers (broadcast)
        if (!msg.to) {
          for (const [id, channel] of this.channels) {
            if (id !== fromId && id !== '' && channel.readyState === 'open') {
              channel.send(event.data)
            }
          }
        }

        // Process locally
        for (const handler of this.messageHandlers) {
          handler(msg, fromId)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    dc.onclose = () => {
      if (peerId) {
        this.channels.delete(peerId)
        this.connections.delete(peerId)
        this.peers.delete(peerId)
        this.notifyPeerLeft(peerId)
        this.broadcastPeerList()
      }
    }
  }

  private setupJoinerDataChannel(dc: RTCDataChannel): void {
    dc.onopen = () => {
      // Send our info to host
      const introMsg: NetworkMessage = {
        type: '__intro',
        from: this.localPeer.id,
        data: {
          type: '__intro',
          peer: this.localPeer,
        },
      }
      dc.send(JSON.stringify(introMsg))
    }

    dc.onmessage = (event) => {
      try {
        const msg: NetworkMessage = JSON.parse(event.data)

        // Handle peer list updates from host
        if (msg.type === '__peer_list') {
          const peers = msg.data.peers as PeerInfo[]
          for (const peer of peers) {
            if (peer.id !== this.localPeer.id && !this.peers.has(peer.id)) {
              this.peers.set(peer.id, peer)
              this.notifyPeerJoined(peer)
            }
          }
          return
        }

        if (msg.type === '__peer_joined') {
          const peer = msg.data.peer as PeerInfo
          if (peer.id !== this.localPeer.id) {
            this.peers.set(peer.id, peer)
            this.notifyPeerJoined(peer)
          }
          return
        }

        if (msg.type === '__peer_left') {
          const leftId = msg.data.peerId as string
          this.peers.delete(leftId)
          this.notifyPeerLeft(leftId)
          return
        }

        // Regular message
        for (const handler of this.messageHandlers) {
          handler(msg, msg.from)
        }
      } catch {
        // Ignore malformed messages
      }
    }

    dc.onclose = () => {
      // Lost connection to host
      this.peers.clear()
      this.notifyPeerLeft('host')
    }
  }

  private notifyPeerJoined(peer: PeerInfo): void {
    for (const handler of this.peerJoinedHandlers) {
      handler(peer)
    }

    // If host, notify all other peers
    if (this.isHost) {
      const joinMsg: NetworkMessage = {
        type: '__peer_joined',
        from: this.localPeer.id,
        data: { type: '__peer_joined', peer },
      }
      const raw = JSON.stringify(joinMsg)
      for (const [id, channel] of this.channels) {
        if (id !== peer.id && id !== '' && channel.readyState === 'open') {
          channel.send(raw)
        }
      }
    }
  }

  private notifyPeerLeft(peerId: string): void {
    for (const handler of this.peerLeftHandlers) {
      handler(peerId)
    }

    // If host, notify all peers
    if (this.isHost) {
      const leftMsg: NetworkMessage = {
        type: '__peer_left',
        from: this.localPeer.id,
        data: { type: '__peer_left', peerId },
      }
      const raw = JSON.stringify(leftMsg)
      for (const [id, channel] of this.channels) {
        if (id !== peerId && id !== '' && channel.readyState === 'open') {
          channel.send(raw)
        }
      }
    }
  }

  private broadcastPeerList(): void {
    if (!this.isHost) return

    const allPeers: PeerInfo[] = [
      { id: this.localPeer.id, name: this.localPeer.name, avatar: this.localPeer.avatar },
      ...Array.from(this.peers.values()),
    ]

    const peerListMsg: NetworkMessage = {
      type: '__peer_list',
      from: this.localPeer.id,
      data: { type: '__peer_list', peers: allPeers },
    }

    const raw = JSON.stringify(peerListMsg)
    for (const [id, channel] of this.channels) {
      if (id !== '' && channel.readyState === 'open') {
        channel.send(raw)
      }
    }
  }
}
