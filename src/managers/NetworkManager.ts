/**
 * NetworkManager - P2P networking using Trystero
 * Handles room joining, peer connections, and game action messaging
 * 
 * Requirements: 1.3, 1.4, 1.5, 12.4
 */

import { joinRoom, Room, selfId } from 'trystero';
import type { GameState, PlayerColor } from './GameStateManager';

// Trystero requires JSON-serializable data with index signature
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Wrapper for network messages to ensure JSON serialization
 * Uses index signature to satisfy Trystero's DataPayload constraint
 */
interface NetworkMessage {
  [key: string]: JsonValue;
  actionType: string;
  payload: JsonValue;
}

// ============================================
// Types and Interfaces
// ============================================

/**
 * Game action types for P2P messaging
 * Requirement 1.5: Start new game with random color assignment
 */
export type GameAction =
  | { type: 'PLAY_CARD'; cardId: string; cardName: string; target?: string; pieceType?: string; effectAction?: string }
  | { type: 'MOVE_PIECE'; from: string; to: string }
  | { type: 'MULLIGAN' }
  | { type: 'READY' }
  | { type: 'END_TURN' }
  | { type: 'REMATCH_REQUEST' }
  | { type: 'REMATCH_ACCEPT' }
  | { type: 'REMATCH_DECLINE' }
  | { type: 'STATE_SYNC'; state: GameState }
  | { type: 'PLAYER_STATS_SYNC'; clock: number; stopwatch: number; mode: 'focus' | 'disturb'; deckCount: number; discardCount: number }
  | { type: 'EVENT_LOG'; entries: EventLogEntry[] }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'COLOR_ASSIGNMENT'; whitePlayerId: string; blackPlayerId: string };

/**
 * Event log entry for syncing game history
 * Requirement 12.4: Sync event log between players
 */
export interface EventLogEntry {
  id: string;
  timestamp: number;
  player: PlayerColor | 'system';
  message: string;
}

/**
 * Connection state for tracking peer status
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'waiting' | 'connected';

/**
 * Network event callbacks
 */
export interface NetworkCallbacks {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onPeerJoined?: (peerId: string) => void;
  onPeerLeft?: (peerId: string) => void;
  onAction?: (action: GameAction, peerId: string) => void;
  onStateSync?: (state: GameState) => void;
  onEventLogSync?: (entries: EventLogEntry[]) => void;
  onColorAssigned?: (localColor: PlayerColor) => void;
  onError?: (error: Error) => void;
}

/**
 * Trystero configuration
 */
interface TrysteroConfig {
  appId: string;
  rtcConfig?: RTCConfiguration;
}

// ============================================
// Constants
// ============================================

const DEFAULT_APP_ID = 'card-chess-game-v1';
const RECONNECT_TIMEOUT_MS = 30000;
const PEER_TIMEOUT_MS = 60000;
const PING_INTERVAL_MS = 5000;

// WebSocket Secure (wss://) BitTorrent trackers for HTTPS compatibility
const WSS_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev'
];


// ============================================
// NetworkManager Class
// ============================================

/**
 * NetworkManager - Manages P2P connections via Trystero
 * 
 * Requirement 1.3: Connect to Trystero P2P network
 * Requirement 1.4: Establish direct WebRTC connection
 */
export class NetworkManager {
  private room: Room | null = null;
  private peerId: string | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private callbacks: NetworkCallbacks = {};
  private config: TrysteroConfig;
  
  // Trystero send/receive functions
  private sendMessage: ((message: NetworkMessage, peerId?: string) => void) | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPeerActivity: number = 0;
  private peerTimeoutCheck: ReturnType<typeof setInterval> | null = null;
  
  // Local player info
  private localPlayerId: string = '';
  private localColor: PlayerColor | null = null;
  private isHost: boolean = false;

  constructor(config?: Partial<TrysteroConfig>) {
    this.config = {
      appId: config?.appId || DEFAULT_APP_ID,
      rtcConfig: config?.rtcConfig
    };
    this.localPlayerId = selfId;
  }

  // ============================================
  // Connection Management
  // ============================================

  /**
   * Join a matchmaking room
   * Requirement 1.3: Connect to Trystero P2P network
   * 
   * @param roomId The room identifier to join
   */
  async joinRoom(roomId: string): Promise<void> {
    if (this.room) {
      this.leaveRoom();
    }

    this.setConnectionState('connecting');

    try {
      // Join room using Trystero's BitTorrent tracker strategy
      // Use WSS trackers for HTTPS compatibility (GitHub Pages, etc.)
      this.room = joinRoom(
        { 
          appId: this.config.appId,
          relayUrls: WSS_TRACKERS,
          rtcConfig: this.config.rtcConfig
        }, 
        roomId
      );
      
      // Set up action channel with NetworkMessage wrapper
      const [sendMessage, onMessage] = this.room.makeAction<NetworkMessage>('action');
      this.sendMessage = sendMessage;
      
      // Handle incoming messages
      onMessage((message, peerId) => {
        this.lastPeerActivity = Date.now();
        const action = this.deserializeAction(message);
        if (action) {
          this.handleIncomingAction(action, peerId);
        }
      });

      // Handle peer joining
      // Requirement 1.4: Establish direct WebRTC connection
      this.room.onPeerJoin((peerId) => {
        this.handlePeerJoin(peerId);
      });

      // Handle peer leaving
      this.room.onPeerLeave((peerId) => {
        this.handlePeerLeave(peerId);
      });

      this.setConnectionState('waiting');
      this.startPeerTimeoutCheck();

    } catch (error) {
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Leave the current room and clean up
   */
  leaveRoom(): void {
    this.stopPingInterval();
    this.stopPeerTimeoutCheck();
    
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    
    this.sendMessage = null;
    this.peerId = null;
    this.localColor = null;
    this.isHost = false;
    this.setConnectionState('disconnected');
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get local player ID
   */
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Get connected peer ID
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Get local player color
   */
  getLocalColor(): PlayerColor | null {
    return this.localColor;
  }

  /**
   * Check if this client is the host (determines colors)
   */
  getIsHost(): boolean {
    return this.isHost;
  }

  // ============================================
  // Callback Registration
  // ============================================

  /**
   * Set network event callbacks
   */
  setCallbacks(callbacks: NetworkCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Set individual callback
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.callbacks.onConnectionStateChange = callback;
  }

  onPeerJoined(callback: (peerId: string) => void): void {
    this.callbacks.onPeerJoined = callback;
  }

  onPeerLeft(callback: (peerId: string) => void): void {
    this.callbacks.onPeerLeft = callback;
  }

  onAction(callback: (action: GameAction, peerId: string) => void): void {
    this.callbacks.onAction = callback;
  }

  onStateSync(callback: (state: GameState) => void): void {
    this.callbacks.onStateSync = callback;
  }

  onEventLogSync(callback: (entries: EventLogEntry[]) => void): void {
    this.callbacks.onEventLogSync = callback;
  }

  onColorAssigned(callback: (localColor: PlayerColor) => void): void {
    this.callbacks.onColorAssigned = callback;
  }

  onError(callback: (error: Error) => void): void {
    this.callbacks.onError = callback;
  }


  // ============================================
  // Action Sending (Requirement 1.5)
  // ============================================

  /**
   * Serialize a GameAction to NetworkMessage for transmission
   */
  private serializeAction(action: GameAction): NetworkMessage {
    return {
      actionType: action.type,
      payload: JSON.parse(JSON.stringify(action)) as JsonValue
    };
  }

  /**
   * Deserialize a NetworkMessage back to GameAction
   */
  private deserializeAction(message: NetworkMessage): GameAction | null {
    try {
      return message.payload as unknown as GameAction;
    } catch {
      console.error('Failed to deserialize action:', message);
      return null;
    }
  }

  /**
   * Send a game action to the peer
   * Requirement 1.5: Start new game with random color assignment
   */
  sendGameAction(action: GameAction): void {
    if (!this.sendMessage || !this.peerId) {
      console.warn('Cannot send action: not connected to peer');
      return;
    }
    
    const message = this.serializeAction(action);
    this.sendMessage(message, this.peerId);
  }

  /**
   * Send state sync to peer
   * Requirement 12.4: Sync event log between players
   */
  sendStateSync(state: GameState): void {
    this.sendGameAction({ type: 'STATE_SYNC', state });
  }

  /**
   * Send event log sync to peer
   * Requirement 12.4: Sync event log between players
   */
  sendEventLogSync(entries: EventLogEntry[]): void {
    this.sendGameAction({ type: 'EVENT_LOG', entries });
  }

  /**
   * Send play card action
   */
  sendPlayCard(cardId: string, cardName: string, target?: string, pieceType?: string, effectAction?: string): void {
    this.sendGameAction({ type: 'PLAY_CARD', cardId, cardName, target, pieceType, effectAction });
  }

  /**
   * Send move piece action
   */
  sendMovePiece(from: string, to: string): void {
    this.sendGameAction({ type: 'MOVE_PIECE', from, to });
  }

  /**
   * Send mulligan action
   */
  sendMulligan(): void {
    this.sendGameAction({ type: 'MULLIGAN' });
  }

  /**
   * Send ready action
   */
  sendReady(): void {
    this.sendGameAction({ type: 'READY' });
  }

  /**
   * Send end turn action
   */
  sendEndTurn(): void {
    this.sendGameAction({ type: 'END_TURN' });
  }

  /**
   * Send player stats sync (clock, stopwatch, mode)
   */
  sendPlayerStats(clock: number, stopwatch: number, mode: 'focus' | 'disturb', deckCount: number, discardCount: number): void {
    this.sendGameAction({ type: 'PLAYER_STATS_SYNC', clock, stopwatch, mode, deckCount, discardCount });
  }

  /**
   * Send rematch request
   */
  sendRematchRequest(): void {
    this.sendGameAction({ type: 'REMATCH_REQUEST' });
  }

  /**
   * Send rematch accept
   */
  sendRematchAccept(): void {
    this.sendGameAction({ type: 'REMATCH_ACCEPT' });
  }

  /**
   * Send rematch decline
   */
  sendRematchDecline(): void {
    this.sendGameAction({ type: 'REMATCH_DECLINE' });
  }

  // ============================================
  // Private Handlers
  // ============================================

  /**
   * Handle peer joining the room
   * Requirement 1.4: Establish direct WebRTC connection
   * Requirement 1.5: Random color assignment
   */
  private handlePeerJoin(peerId: string): void {
    // Only handle first peer (1v1 game)
    if (this.peerId) {
      console.warn('Already connected to a peer, ignoring new peer:', peerId);
      return;
    }

    this.peerId = peerId;
    this.lastPeerActivity = Date.now();
    this.setConnectionState('connected');
    
    // Determine who is host (lower ID is host)
    // Host assigns colors randomly
    this.isHost = this.localPlayerId < peerId;
    
    if (this.isHost) {
      // Randomly assign colors
      const localIsWhite = Math.random() < 0.5;
      this.localColor = localIsWhite ? 'white' : 'black';
      
      // Send color assignment to peer
      const colorAssignment: GameAction = {
        type: 'COLOR_ASSIGNMENT',
        whitePlayerId: localIsWhite ? this.localPlayerId : peerId,
        blackPlayerId: localIsWhite ? peerId : this.localPlayerId
      };
      this.sendGameAction(colorAssignment);
      
      // Notify local callback
      this.callbacks.onColorAssigned?.(this.localColor);
    }
    
    this.callbacks.onPeerJoined?.(peerId);
    this.startPingInterval();
  }

  /**
   * Handle peer leaving the room
   */
  private handlePeerLeave(peerId: string): void {
    if (this.peerId !== peerId) return;
    
    this.peerId = null;
    this.stopPingInterval();
    this.setConnectionState('waiting');
    this.callbacks.onPeerLeft?.(peerId);
  }

  /**
   * Handle incoming action from peer
   */
  private handleIncomingAction(action: GameAction, peerId: string): void {
    switch (action.type) {
      case 'STATE_SYNC':
        this.callbacks.onStateSync?.(action.state);
        break;
        
      case 'EVENT_LOG':
        this.callbacks.onEventLogSync?.(action.entries);
        break;
        
      case 'COLOR_ASSIGNMENT':
        // Determine local color from assignment
        if (action.whitePlayerId === this.localPlayerId) {
          this.localColor = 'white';
        } else if (action.blackPlayerId === this.localPlayerId) {
          this.localColor = 'black';
        }
        if (this.localColor) {
          this.callbacks.onColorAssigned?.(this.localColor);
        }
        break;
        
      case 'PING':
        // Respond to ping with pong
        this.sendGameAction({ type: 'PONG', timestamp: action.timestamp });
        break;
        
      case 'PONG':
        // Ping response received, peer is alive
        break;
        
      default:
        // Forward other actions to callback
        this.callbacks.onAction?.(action, peerId);
        break;
    }
  }

  /**
   * Set connection state and notify callback
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.callbacks.onConnectionStateChange?.(state);
    }
  }

  // ============================================
  // Keep-alive and Timeout Management
  // ============================================

  /**
   * Start ping interval to keep connection alive
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.peerId) {
        this.sendGameAction({ type: 'PING', timestamp: Date.now() });
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Start peer timeout check
   */
  private startPeerTimeoutCheck(): void {
    this.stopPeerTimeoutCheck();
    this.peerTimeoutCheck = setInterval(() => {
      if (this.peerId && Date.now() - this.lastPeerActivity > PEER_TIMEOUT_MS) {
        console.warn('Peer timed out');
        this.handlePeerLeave(this.peerId);
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stop peer timeout check
   */
  private stopPeerTimeoutCheck(): void {
    if (this.peerTimeoutCheck) {
      clearInterval(this.peerTimeoutCheck);
      this.peerTimeoutCheck = null;
    }
  }

  // ============================================
  // State Synchronization (Requirement 12.4)
  // ============================================

  /**
   * Request state sync from peer (for desync recovery)
   */
  requestStateSync(): void {
    // Host is the source of truth
    if (!this.isHost && this.peerId) {
      // Non-host requests sync by sending current state
      // Host will respond with authoritative state
      this.sendGameAction({ type: 'STATE_SYNC', state: {} as GameState });
    }
  }

  /**
   * Handle state sync as host - send authoritative state
   */
  handleStateSyncRequest(localState: GameState): void {
    if (this.isHost && this.peerId) {
      this.sendStateSync(localState);
    }
  }

  /**
   * Detect desync between local and remote state
   * Returns true if states are out of sync
   */
  detectDesync(localState: GameState, remoteState: GameState): boolean {
    return !NetworkManager.areStatesInSync(localState, remoteState);
  }

  /**
   * Recover from desync - non-host adopts host's state
   * @param hostState The authoritative state from host
   * @returns The state to use (host's state if we're not host)
   */
  recoverFromDesync(localState: GameState, hostState: GameState): GameState {
    if (this.isHost) {
      // Host's state is authoritative
      return localState;
    } else {
      // Non-host adopts host's state
      return hostState;
    }
  }

  /**
   * Check if states are in sync (simple hash comparison)
   */
  static areStatesInSync(state1: GameState, state2: GameState): boolean {
    // Compare key state properties
    if (state1.phase !== state2.phase) return false;
    if (state1.currentTurn !== state2.currentTurn) return false;
    if (state1.turnNumber !== state2.turnNumber) return false;
    if (state1.boardFEN !== state2.boardFEN) return false;
    
    // Compare player states
    for (const color of ['white', 'black'] as const) {
      const p1 = state1.players[color];
      const p2 = state2.players[color];
      
      if (p1.clock !== p2.clock) return false;
      if (p1.energy !== p2.energy) return false;
      if (p1.energyCap !== p2.energyCap) return false;
      if (p1.disturbTags !== p2.disturbTags) return false;
      if (p1.hand.length !== p2.hand.length) return false;
      if (p1.deck.length !== p2.deck.length) return false;
    }
    
    return true;
  }

  /**
   * Generate a simple hash of game state for quick comparison
   */
  static hashState(state: GameState): string {
    const key = [
      state.phase,
      state.currentTurn,
      state.turnNumber,
      state.boardFEN,
      state.players.white.clock,
      state.players.white.energy,
      state.players.white.hand.length,
      state.players.black.clock,
      state.players.black.energy,
      state.players.black.hand.length
    ].join('|');
    
    return key;
  }

  /**
   * Merge event logs from two sources, removing duplicates
   * Requirement 12.4: Sync event log between players
   */
  static mergeEventLogs(local: EventLogEntry[], remote: EventLogEntry[]): EventLogEntry[] {
    const merged = new Map<string, EventLogEntry>();
    
    // Add all local entries
    for (const entry of local) {
      merged.set(entry.id, entry);
    }
    
    // Add remote entries (won't overwrite existing)
    for (const entry of remote) {
      if (!merged.has(entry.id)) {
        merged.set(entry.id, entry);
      }
    }
    
    // Sort by timestamp
    return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
  }
}

// Export constants for testing
export {
  DEFAULT_APP_ID,
  RECONNECT_TIMEOUT_MS,
  PEER_TIMEOUT_MS,
  PING_INTERVAL_MS
};
