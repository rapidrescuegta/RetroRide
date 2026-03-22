// ─── Multiplayer Game State Management ──────────────────────────────────────
// Provides the useMultiplayerGame hook that any card game can plug into.
// Host device is authoritative — validates moves, broadcasts state.
// Players send actions, receive state updates.
// ─────────────────────────────────────────────────────────────────────────────

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Card } from './card-engine'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string
  name: string
  avatar: string
  handSize: number   // other players only see hand size, not cards
  score: number
  isConnected: boolean
}

export interface GameAction {
  type: string
  playerId: string
  data: any
}

export type GamePhase = 'lobby' | 'playing' | 'round-end' | 'game-over'

export type GameMessage =
  | { type: 'game-start'; state: any }
  | { type: 'game-action'; action: GameAction }
  | { type: 'game-state'; state: any }
  | { type: 'game-over'; scores: Record<string, number>; winner: string }
  | { type: 'hand-update'; cards: Card[] }

// ─── Network Interface ──────────────────────────────────────────────────────
// This will be provided by the local-network module.
// Defines the contract we need from any network layer.

export interface NetworkInterface {
  sendMessage(msg: any): void
  sendTo?(peerId: string, msg: any): void
  onMessage(handler: (msg: any, fromPeerId: string) => void): () => void
  isHost: boolean
  myPeerId: string
  getPeers(): { id: string; name: string; avatar: string }[]
}

// Module-level network reference — set once when room is established
let _network: NetworkInterface | null = null

export function setNetwork(network: NetworkInterface | null) {
  _network = network
}

export function getNetwork(): NetworkInterface | null {
  return _network
}

// ─── Game Config ────────────────────────────────────────────────────────────
// Each game (Rummy, Hearts, etc.) implements this interface.

export interface MultiplayerGameConfig<TState = any, TBroadcast = any> {
  gameType: string
  minPlayers: number
  maxPlayers: number
  /** Host calls this to create initial game state. Returns state + per-player hands. */
  initializeGame: (players: Player[]) => {
    state: TState
    hands: Record<string, Card[]>  // playerId -> their private hand
  }
  /** Host calls this to validate and process an action. */
  processAction: (
    state: TState,
    action: GameAction,
    hands: Record<string, Card[]>
  ) => {
    state: TState
    hands: Record<string, Card[]>
    broadcast: TBroadcast
    error?: string
  }
  /** Check if the game / round is over. */
  checkGameOver: (state: TState) => {
    isOver: boolean
    scores?: Record<string, number>
    winner?: string
  }
  /** Build the public state visible to all players (strip private info). */
  getPublicState: (state: TState) => any
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface UseMultiplayerGameReturn {
  players: Player[]
  gamePhase: GamePhase
  isHost: boolean
  isMyTurn: boolean
  myHand: Card[]
  currentTurnPlayerId: string | null
  startGame: () => void
  sendAction: (action: Omit<GameAction, 'playerId'>) => void
  gameState: any
  lastAction: GameAction | null
  scores: Record<string, number>
  winner: string | null
  error: string | null
}

export function useMultiplayerGame<TState = any>(
  config: MultiplayerGameConfig<TState>
): UseMultiplayerGameReturn {
  const [players, setPlayers] = useState<Player[]>([])
  const [gamePhase, setGamePhase] = useState<GamePhase>('lobby')
  const [myHand, setMyHand] = useState<Card[]>([])
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<any>(null)
  const [lastAction, setLastAction] = useState<GameAction | null>(null)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [winner, setWinner] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Host-only authoritative state (not exposed to React renders directly)
  const hostStateRef = useRef<TState | null>(null)
  const hostHandsRef = useRef<Record<string, Card[]>>({})

  const network = _network
  const isHost = network?.isHost ?? false
  const myId = network?.myPeerId ?? ''

  // ── Sync players from network peers ──
  useEffect(() => {
    if (!network) return

    const syncPlayers = () => {
      const peers = network.getPeers()
      setPlayers(prev => {
        const updated: Player[] = peers.map(p => {
          const existing = prev.find(ep => ep.id === p.id)
          return {
            id: p.id,
            name: p.name,
            avatar: p.avatar,
            handSize: existing?.handSize ?? 0,
            score: existing?.score ?? 0,
            isConnected: true,
          }
        })
        return updated
      })
    }

    syncPlayers()
    const interval = setInterval(syncPlayers, 2000)
    return () => clearInterval(interval)
  }, [network])

  // ── Message handler ──
  useEffect(() => {
    if (!network) return

    const cleanup = network.onMessage((msg: GameMessage, fromPeerId: string) => {
      switch (msg.type) {
        case 'game-start': {
          setGamePhase('playing')
          setGameState(msg.state)
          setCurrentTurnPlayerId(msg.state?.currentTurnPlayerId ?? null)
          setError(null)
          break
        }

        case 'hand-update': {
          setMyHand(msg.cards)
          break
        }

        case 'game-state': {
          setGameState(msg.state)
          setCurrentTurnPlayerId(msg.state?.currentTurnPlayerId ?? null)
          // Update player hand sizes and scores from broadcast
          if (msg.state?.players) {
            setPlayers(msg.state.players)
          }
          break
        }

        case 'game-action': {
          // Only host processes actions
          if (isHost && hostStateRef.current) {
            processActionOnHost(msg.action)
          }
          break
        }

        case 'game-over': {
          setGamePhase('game-over')
          setScores(msg.scores)
          setWinner(msg.winner)
          break
        }
      }
    })

    return cleanup
  }, [network, isHost])

  // ── Host: Process an action ──
  const processActionOnHost = useCallback(
    (action: GameAction) => {
      if (!hostStateRef.current || !network) return

      const result = config.processAction(
        hostStateRef.current,
        action,
        hostHandsRef.current
      )

      if (result.error) {
        // Send error back to the player who made the action
        if (network.sendTo) {
          network.sendTo(action.playerId, {
            type: 'game-state',
            state: {
              ...config.getPublicState(hostStateRef.current),
              error: result.error,
            },
          })
        }
        return
      }

      // Update authoritative state
      hostStateRef.current = result.state
      hostHandsRef.current = result.hands

      // Check game over
      const gameOverCheck = config.checkGameOver(result.state)

      if (gameOverCheck.isOver) {
        const gameOverMsg: GameMessage = {
          type: 'game-over',
          scores: gameOverCheck.scores ?? {},
          winner: gameOverCheck.winner ?? '',
        }
        network.sendMessage(gameOverMsg)
        setGamePhase('game-over')
        setScores(gameOverCheck.scores ?? {})
        setWinner(gameOverCheck.winner ?? null)
        return
      }

      // Build public state with player info
      const publicState = config.getPublicState(result.state)
      const playersWithInfo: Player[] = players.map(p => ({
        ...p,
        handSize: (result.hands[p.id] ?? []).length,
      }))
      const stateMsg: GameMessage = {
        type: 'game-state',
        state: { ...publicState, players: playersWithInfo },
      }

      // Broadcast public state to all
      network.sendMessage(stateMsg)

      // Send private hands to each player
      for (const [playerId, hand] of Object.entries(result.hands)) {
        const handMsg: GameMessage = { type: 'hand-update', cards: hand }
        if (playerId === myId) {
          setMyHand(hand)
        } else if (network.sendTo) {
          network.sendTo(playerId, handMsg)
        }
      }

      // Update host's own state
      setGameState({ ...publicState, players: playersWithInfo })
      setCurrentTurnPlayerId(publicState.currentTurnPlayerId ?? null)
      setLastAction(action)
    },
    [config, network, players, myId]
  )

  // ── Start Game (host only) ──
  const startGame = useCallback(() => {
    if (!isHost || !network) return
    if (players.length < config.minPlayers) {
      setError(`Need at least ${config.minPlayers} players`)
      return
    }

    const { state, hands } = config.initializeGame(players)
    hostStateRef.current = state
    hostHandsRef.current = hands

    const publicState = config.getPublicState(state)
    const playersWithInfo: Player[] = players.map(p => ({
      ...p,
      handSize: (hands[p.id] ?? []).length,
    }))

    // Broadcast game start
    const startMsg: GameMessage = {
      type: 'game-start',
      state: { ...publicState, players: playersWithInfo },
    }
    network.sendMessage(startMsg)

    // Send private hands
    for (const [playerId, hand] of Object.entries(hands)) {
      const handMsg: GameMessage = { type: 'hand-update', cards: hand }
      if (playerId === myId) {
        setMyHand(hand)
      } else if (network.sendTo) {
        network.sendTo(playerId, handMsg)
      }
    }

    setGamePhase('playing')
    setGameState({ ...publicState, players: playersWithInfo })
    setCurrentTurnPlayerId(publicState.currentTurnPlayerId ?? null)
    setError(null)
  }, [isHost, network, players, config, myId])

  // ── Send Action (any player) ──
  const sendAction = useCallback(
    (action: Omit<GameAction, 'playerId'>) => {
      if (!network) return

      const fullAction: GameAction = { ...action, playerId: myId }

      if (isHost) {
        // Process locally
        processActionOnHost(fullAction)
      } else {
        // Send to host
        const msg: GameMessage = { type: 'game-action', action: fullAction }
        network.sendMessage(msg)
      }

      setLastAction(fullAction)
    },
    [network, myId, isHost, processActionOnHost]
  )

  return {
    players,
    gamePhase,
    isHost,
    isMyTurn: currentTurnPlayerId === myId,
    myHand,
    currentTurnPlayerId,
    startGame,
    sendAction,
    gameState,
    lastAction,
    scores,
    winner,
    error,
  }
}
