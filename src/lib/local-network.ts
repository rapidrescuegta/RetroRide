// ─── P2P Network Layer ───────────────────────────────────────────────────────
// Supports both local (QR-based) and remote (signaling-based) connections.
// Uses Google STUN servers so WebRTC works over the internet, not just LAN.
// ─────────────────────────────────────────────────────────────────────────────

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
export type ConnectionStateHandler = (state: 'connecting' | 'connected' | 'disconnected' | 'failed') => void

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

export function generateId(len = 6): string {
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
 * Used for LAN-mode QR-based connections (backward compatible).
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

// ─── ICE / STUN / TURN Configuration ─────────────────────────────────────────
// STUN servers discover public IP addresses for NAT traversal.
// TURN servers relay traffic when direct P2P is impossible (~15-20% of
// connections behind symmetric NATs or strict corporate firewalls).
// Without TURN, those users would get "Connection timed out" errors.

// Custom TURN configuration can be injected at runtime.
// Call `setTurnConfig(...)` before creating a LocalNetwork instance.
let _customTurnConfig: RTCIceServer[] | null = null

export function setTurnConfig(servers: RTCIceServer[]) {
  _customTurnConfig = servers
}

function buildInternetRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  if (_customTurnConfig && _customTurnConfig.length > 0) {
    iceServers.push(..._customTurnConfig)
  } else {
    // Free public TURN servers as fallback for NAT traversal.
    // These are rate-limited but reliable enough for casual gaming.
    iceServers.push(
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    )
  }

  return {
    iceTransportPolicy: 'all',
    iceServers,
  }
}

const LAN_RTC_CONFIG: RTCConfiguration = {
  iceTransportPolicy: 'all',
  iceServers: [], // Local network only — no STUN/TURN needed
}

export type ConnectionMode = 'lan' | 'internet'

export class LocalNetwork {
  isHost: boolean = false
  roomId: string = ''
  peers: Map<string, PeerInfo> = new Map()
  localPeer: PeerInfo = { id: '', name: '', avatar: '' }
  mode: ConnectionMode = 'internet'

  private connections: Map<string, RTCPeerConnection> = new Map()
  private channels: Map<string, RTCDataChannel> = new Map()
  private messageHandlers: MessageHandler[] = []
  private peerJoinedHandlers: PeerHandler[] = []
  private peerLeftHandlers: PeerLeftHandler[] = []
  private connectionStateHandlers: ConnectionStateHandler[] = []
  private hostConnection: RTCPeerConnection | null = null
  private hostChannel: RTCDataChannel | null = null

  // Store the host's peer connection for accepting joiners
  private pendingPc: RTCPeerConnection | null = null
  private pendingPeerId: string = ''

  private get rtcConfig(): RTCConfiguration {
    return this.mode === 'internet' ? buildInternetRtcConfig() : LAN_RTC_CONFIG
  }

  constructor(mode: ConnectionMode = 'internet') {
    this.mode = mode
  }

  // ─── Internet Mode: Full SDP exchange via signaling server ─────────────────

  /**
   * HOST (internet mode): Create a room and return the full SDP offer.
   * The offer should be posted to the signaling server under the room code.
   */
  async createRoomWithSignaling(localPeer: PeerInfo): Promise<{ roomId: string; offer: string }> {
    this.isHost = true
    this.roomId = generateId(6)
    this.localPeer = { ...localPeer, id: localPeer.id || generateId(8) }

    const pc = new RTCPeerConnection(this.rtcConfig)
    const dc = pc.createDataChannel('gamebuddi', { ordered: true })

    this.monitorConnection(pc, 'pending-joiner')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await this.waitForIceGathering(pc)

    this.pendingPc = pc
    this.setupHostDataChannel(dc, '')

    const fullSdp = pc.localDescription!.sdp

    return {
      roomId: this.roomId,
      offer: JSON.stringify({
        type: 'offer',
        sdp: fullSdp,
        roomId: this.roomId,
        host: {
          id: this.localPeer.id,
          name: this.localPeer.name,
          avatar: this.localPeer.avatar,
        },
      }),
    }
  }

  /**
   * JOINER (internet mode): Process the host's full SDP offer from the signaling server.
   * Returns the full SDP answer to post back.
   */
  async joinRoomWithSignaling(offerPayload: string, localPeer: PeerInfo): Promise<string> {
    this.isHost = false
    this.localPeer = { ...localPeer, id: localPeer.id || generateId(8) }

    const parsed = JSON.parse(offerPayload)
    this.roomId = parsed.roomId

    // Add host to our peers list
    const hostPeerInfo: PeerInfo = {
      id: parsed.host.id,
      name: parsed.host.name,
      avatar: parsed.host.avatar,
    }
    this.peers.set('host', hostPeerInfo)

    const pc = new RTCPeerConnection(this.rtcConfig)
    this.hostConnection = pc

    this.monitorConnection(pc, 'host')

    // Set up incoming data channel handler
    pc.ondatachannel = (event) => {
      this.hostChannel = event.channel
      this.setupJoinerDataChannel(event.channel)
    }

    // Set the full remote SDP offer
    await pc.setRemoteDescription({ type: 'offer', sdp: parsed.sdp })

    // Create and set answer
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await this.waitForIceGathering(pc)

    const fullAnswerSdp = pc.localDescription!.sdp

    return JSON.stringify({
      type: 'answer',
      sdp: fullAnswerSdp,
      joiner: {
        id: this.localPeer.id,
        name: this.localPeer.name,
        avatar: this.localPeer.avatar,
      },
    })
  }

  /**
   * HOST (internet mode): Accept a joiner's full SDP answer from the signaling server.
   */
  async acceptJoinerWithSignaling(answerPayload: string): Promise<void> {
    if (!this.isHost || !this.pendingPc) {
      throw new Error('No pending connection to accept')
    }

    const parsed = JSON.parse(answerPayload)
    const peerId = parsed.joiner.id

    const peerInfo: PeerInfo = {
      id: peerId,
      name: parsed.joiner.name,
      avatar: parsed.joiner.avatar,
    }

    const pc = this.pendingPc

    // Set the full remote SDP answer
    await pc.setRemoteDescription({ type: 'answer', sdp: parsed.sdp })

    // Store the connection
    this.connections.set(peerId, pc)
    this.peers.set(peerId, peerInfo)
    this.pendingPeerId = peerId

    // Update the data channel mapping
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

    // Clear pending -- ready for next joiner
    this.pendingPc = null

    // Prepare for next joiner
    await this.prepareForNextJoinerWithSignaling()
  }

  /**
   * HOST (internet mode): Prepare a new peer connection for the next joiner.
   * Returns the new full SDP offer to post to signaling server.
   */
  async prepareForNextJoinerWithSignaling(): Promise<string> {
    const pc = new RTCPeerConnection(this.rtcConfig)
    const dc = pc.createDataChannel('gamebuddi', { ordered: true })

    this.monitorConnection(pc, 'pending-joiner')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await this.waitForIceGathering(pc)

    this.pendingPc = pc
    this.setupHostDataChannel(dc, '')

    const fullSdp = pc.localDescription!.sdp

    return JSON.stringify({
      type: 'offer',
      sdp: fullSdp,
      roomId: this.roomId,
      host: {
        id: this.localPeer.id,
        name: this.localPeer.name,
        avatar: this.localPeer.avatar,
      },
    })
  }

  // ─── LAN Mode: Compact QR-based exchange (backward compatible) ─────────────

  /**
   * HOST: Create a room and return compact offer string for QR encoding.
   */
  async createRoom(localPeer: PeerInfo): Promise<string> {
    this.isHost = true
    this.roomId = generateId(6)
    this.localPeer = { ...localPeer, id: localPeer.id || generateId(8) }

    // Create a peer connection that will be used for the first joiner
    const pc = new RTCPeerConnection(this.rtcConfig)
    const dc = pc.createDataChannel('gamebuddi', { ordered: true })

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
    const dc = pc.createDataChannel('gamebuddi', { ordered: true })

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

  // ─── Common API ────────────────────────────────────────────────────────────

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
   * Register a message handler. Returns a cleanup function to remove it.
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler)
    return () => {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Register a handler for when a peer joins. Returns a cleanup function.
   */
  onPeerJoined(handler: PeerHandler): () => void {
    this.peerJoinedHandlers.push(handler)
    return () => {
      this.peerJoinedHandlers = this.peerJoinedHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Register a handler for when a peer leaves. Returns a cleanup function.
   */
  onPeerLeft(handler: PeerLeftHandler): () => void {
    this.peerLeftHandlers.push(handler)
    return () => {
      this.peerLeftHandlers = this.peerLeftHandlers.filter(h => h !== handler)
    }
  }

  /**
   * Register a handler for connection state changes. Returns a cleanup function.
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.push(handler)
    return () => {
      this.connectionStateHandlers = this.connectionStateHandlers.filter(h => h !== handler)
    }
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
   * Get the current full SDP offer (for internet-mode signaling).
   */
  async getCurrentFullOffer(): Promise<string | null> {
    if (!this.isHost || !this.pendingPc) return null

    const sdp = this.pendingPc.localDescription?.sdp
    if (!sdp) return null

    return JSON.stringify({
      type: 'offer',
      sdp,
      roomId: this.roomId,
      host: {
        id: this.localPeer.id,
        name: this.localPeer.name,
        avatar: this.localPeer.avatar,
      },
    })
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
    this.connectionStateHandlers = []
  }

  // --- Private helpers ---

  private async waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') return

    return new Promise<void>((resolve) => {
      let resolved = false
      const done = () => {
        if (resolved) return
        resolved = true
        clearTimeout(timeout)
        clearInterval(check)
        pc.onicecandidate = null
        resolve()
      }

      // Longer timeout for STUN/TURN (internet mode needs time for srflx/relay candidates)
      const timeoutMs = this.mode === 'internet' ? 8000 : 3000
      const timeout = setTimeout(done, timeoutMs)

      pc.onicecandidate = (event) => {
        if (event.candidate === null) {
          done()
        }
      }

      // Also check periodically
      const check = setInterval(() => {
        if (pc.iceGatheringState === 'complete') {
          done()
        }
      }, 100)
    })
  }

  private monitorConnection(pc: RTCPeerConnection, label: string): void {
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      let mapped: 'connecting' | 'connected' | 'disconnected' | 'failed'
      switch (state) {
        case 'connecting':
        case 'new':
          mapped = 'connecting'
          break
        case 'connected':
          mapped = 'connected'
          break
        case 'disconnected':
        case 'closed':
          mapped = 'disconnected'
          break
        case 'failed':
          mapped = 'failed'
          break
        default:
          return
      }
      for (const handler of this.connectionStateHandlers) {
        handler(mapped)
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        // Attempt ICE restart for internet connections
        if (this.mode === 'internet' && this.isHost) {
          pc.restartIce()
        }
      }
    }
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
