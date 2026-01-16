/**
 * @fileoverview NetworkManager - P2P networking with Cloudflare Worker fallback
 * 
 * This module handles all peer-to-peer networking for Card Chess with
 * automatic fallback to Cloudflare Worker relay when P2P fails.
 * 
 * Key Features:
 * - Primary: Direct P2P connections via WebRTC with STUN servers only
 * - Fallback: Cloudflare Worker relay when P2P connection fails
 * - Automatic host determination (lower peer ID is host)
 * - Random color assignment by host
 * - Keep-alive pings for P2P, heartbeat for relay
 * - Auto-rejoin for faster peer discovery
 * - State synchronization for desync recovery
 * 
 * Connection Strategy:
 * 1. Attempt direct P2P connection using STUN servers only
 * 2. If no peer found within 15 seconds, fallback to Cloudflare Worker relay
 * 3. Relay provides reliable communication when P2P is blocked
 * 
 * Requirements addressed:
 * - 1.3: Connect to P2P network (Trystero) or relay fallback
 * - 1.4: Establish direct WebRTC connection or relay connection
 * - 1.5: Start new game with random color assignment
 * - 12.4: Sync event log between players
 * 
 * @module managers/network/NetworkManager
 * @requires trystero
 * @requires ../GameStateManager
 * @requires ./CloudflareRelayManager
 */

import { joinRoom, Room, selfId } from 'trystero';
import type { GameState, PlayerColor } from '../GameStateManager';
import {
  DEFAULT_APP_ID,
  DEFAULT_RTC_CONFIG,
  PEER_TIMEOUT_MS,
  PING_INTERVAL_MS,
  WSS_TRACKERS,
  STUN_SERVER_ENDPOINT,
  STUN_FETCH_TIMEOUT_MS
} from './constants';
import { deserializeAction, serializeAction } from './serialization';
import {
  areStatesInSync as areStatesInSyncHelper,
  detectDesync as detectDesyncHelper,
  hashState as hashStateHelper,
  mergeEventLogs as mergeEventLogsHelper,
  recoverFromDesync as recoverFromDesyncHelper
} from './stateSync';
import type {
  ConnectionState,
  EventLogEntry,
  GameAction,
  NetworkCallbacks,
  NetworkMessage,
  TrysteroConfig
} from './types';
import { CloudflareRelayManager } from './CloudflareRelayManager';


/* ============================================
 * NETWORK MANAGER CLASS
 * ============================================
 */

/**
 * NetworkManager - Manages P2P connections with Cloudflare Worker fallback
 * 
 * This class handles all networking for the game with a two-tier approach:
 * 1. Primary: Direct P2P connections via Trystero (WebRTC + STUN)
 * 2. Fallback: Cloudflare Worker relay when P2P fails
 * 
 * Connection Flow:
 * 1. Call joinRoom(roomId) to join a matchmaking room
 * 2. First attempts direct P2P connection using STUN servers
 * 3. If no peer found within 15 seconds, falls back to Cloudflare Worker relay
 * 4. Wait for onPeerJoined callback when another player joins
 * 5. Host (lower peer ID) assigns colors randomly
 * 6. onColorAssigned callback fires with local player's color
 * 7. Game can begin - use send* methods to communicate
 * 
 * @example
 * const network = new NetworkManager();
 * 
 * network.onColorAssigned((color) => {
 *   console.log('Playing as:', color);
 * });
 * 
 * network.onAction((action, peerId) => {
 *   handleOpponentAction(action);
 * });
 * 
 * await network.joinRoom('my-room-id');
 * 
 * Used by: MenuScene (matchmaking), GameScene (gameplay)
 */
export class NetworkManager {
  /* ----------------------------------------
   * Private Properties
   * ---------------------------------------- */
  
  /** Current Trystero room instance */
  private room: Room | null = null;
  
  /** Connected peer's ID */
  private peerId: string | null = null;
  
  /** Current connection state */
  private connectionState: ConnectionState = 'disconnected';
  
  /** Registered event callbacks */
  private callbacks: NetworkCallbacks = {};
  
  /** Trystero configuration */
  private config: TrysteroConfig;
  
  /** Function to send messages (set when room is joined) */
  private sendMessage: ((message: NetworkMessage, peerId?: string) => void) | null = null;
  
  /** Interval for sending keep-alive pings */
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Timestamp of last peer activity */
  private lastPeerActivity: number = 0;
  
  /** Interval for checking peer timeout */
  private peerTimeoutCheck: ReturnType<typeof setInterval> | null = null;
  
  /** Interval for auto-rejoin attempts */
  private rejoinInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Current room ID for rejoin */
  private currentRoomId: string = '';
  
  /** Number of rejoin attempts made */
  private rejoinAttempts: number = 0;
  
  /** Rejoin interval in milliseconds */
  private static readonly REJOIN_INTERVAL_MS = 8000;
  
  /** Maximum rejoin attempts before giving up */
  private static readonly MAX_REJOIN_ATTEMPTS = 10;
  
  /** Interval between color request retries */
  private static readonly COLOR_REQUEST_INTERVAL_MS = 3000;
  
  /** Maximum color request attempts */
  private static readonly MAX_COLOR_REQUESTS = 3;
  
  /** Local player's unique ID (from Trystero) */
  private localPlayerId: string = '';
  
  /** Local player's assigned color */
  private localColor: PlayerColor | null = null;
  
  /** Whether this client is the host (determines colors) */
  private isHost: boolean = false;
  
  /** Last color assignment sent (for retransmission) */
  private lastColorAssignment: GameAction | null = null;
  
  /** Timeout for color request retry */
  private colorRequestTimeout: ReturnType<typeof setTimeout> | null = null;
  
  /** Number of color request attempts made */
  private colorRequestAttempts: number = 0;
  
  /** Cloudflare Worker relay manager for fallback communication */
  private relayManager: CloudflareRelayManager | null = null;
  
  /** Whether currently using relay fallback */
  private usingRelay: boolean = false;
  
  /** P2P connection timeout for fallback trigger */
  private p2pTimeout: ReturnType<typeof setTimeout> | null = null;
  
  /** P2P connection timeout duration (ms) */
  private static readonly P2P_TIMEOUT_MS = 15000;
  
  /** Cached STUN servers from Twilio */
  private cachedStunServers: RTCIceServer[] | null = null;
  
  /** Timestamp when STUN servers were cached */
  private stunServersCachedAt: number = 0;
  
  /** STUN servers cache duration (6 hours - well within 24h TTL) */
  private static readonly STUN_CACHE_DURATION_MS = 6 * 60 * 60 * 1000;

  /**
   * Creates a new NetworkManager instance
   * 
   * @param config - Optional Trystero configuration
   * 
   * Used by: MenuScene.create()
   */
  constructor(config?: Partial<TrysteroConfig>) {
    this.config = {
      appId: config?.appId || DEFAULT_APP_ID,
      rtcConfig: config?.rtcConfig || DEFAULT_RTC_CONFIG
    };
    this.localPlayerId = selfId;
  }


  /* ============================================
   * STUN SERVER MANAGEMENT
   * ============================================
   * Methods for fetching STUN servers from Twilio while filtering out TURN servers.
   */

  /**
   * Fetches STUN servers from Twilio via Cloudflare Worker
   * 
   * Returns cached servers if still valid, otherwise fetches fresh STUN servers.
   * Filters out TURN servers to avoid bandwidth costs.
   * Falls back to default STUN-only config on failure.
   * 
   * @returns RTCConfiguration with STUN servers only
   * @private
   */
  private async fetchStunServers(): Promise<RTCConfiguration> {
    // Return cached servers if still valid
    const now = Date.now();
    if (this.cachedStunServers && (now - this.stunServersCachedAt) < NetworkManager.STUN_CACHE_DURATION_MS) {
      console.log('Using cached STUN servers');
      return this.buildStunOnlyConfig(this.cachedStunServers);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STUN_FETCH_TIMEOUT_MS);

      const response = await fetch(STUN_SERVER_ENDPOINT, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`STUN server fetch failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Extract servers from the response (handles both turnServers and rawServers arrays)
      const rawServers = data.turnServers || data.rawServers || [];
      
      // Filter to only STUN servers (exclude TURN servers)
      const stunServers: RTCIceServer[] = rawServers
        .filter((server: any) => {
          const urls = server.urls || server.url || '';
          const urlStr = Array.isArray(urls) ? urls[0] : urls;
          return urlStr?.startsWith('stun:');
        })
        .map((server: any) => ({
          urls: server.urls || server.url || ''
        }));
      
      // Cache the STUN servers
      this.cachedStunServers = stunServers;
      this.stunServersCachedAt = now;
      
      console.log(`Fetched ${stunServers.length} STUN servers from Twilio (TURN servers filtered out)`);
      return this.buildStunOnlyConfig(stunServers);
      
    } catch (error) {
      console.warn('Failed to fetch STUN servers, using default fallback:', error);
      return DEFAULT_RTC_CONFIG;
    }
  }

  /**
   * Builds RTCConfiguration with STUN servers only
   * 
   * Combines public STUN servers with Twilio STUN servers for optimal connectivity.
   * No TURN servers are included to avoid bandwidth costs.
   * 
   * @param twilioStunServers - Array of STUN servers from Twilio
   * @returns RTCConfiguration with STUN servers only
   * @private
   */
  private buildStunOnlyConfig(twilioStunServers: RTCIceServer[]): RTCConfiguration {
    // Combine public STUN servers with Twilio STUN servers
    const allStunServers: RTCIceServer[] = [
      // Fast public STUN servers (free, reliable)
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.stunprotocol.org:3478' },
      // Twilio STUN servers (additional options)
      ...twilioStunServers
    ];
    
    console.log(`Using ${allStunServers.length} STUN servers for P2P connection`);
    
    return {
      iceServers: allStunServers,
      iceTransportPolicy: 'all',      // Try all candidates, prefer direct
      bundlePolicy: 'max-bundle',     // Multiplex all streams on one connection
      iceCandidatePoolSize: 10        // Pre-gather candidates for faster connection
    };
  }

  /**
   * Gets STUN-only RTCConfiguration for direct P2P connections
   * 
   * Uses default STUN servers as immediate fallback.
   * 
   * @returns RTCConfiguration with default STUN servers
   * @private
   */
  private getDefaultStunConfig(): RTCConfiguration {
    console.log('Using default STUN-only configuration for direct P2P');
    
    return {
      iceServers: [
        // Public STUN servers for NAT traversal
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' }
      ],
      iceTransportPolicy: 'all',      // Try all candidates, prefer direct
      bundlePolicy: 'max-bundle',     // Multiplex all streams on one connection
      iceCandidatePoolSize: 10        // Pre-gather candidates for faster connection
    };
  }

  /**
   * Logs the connection type (direct P2P only)
   * 
   * @private
   */
  private logConnectionType(): void {
    // Delay to allow ICE negotiation to complete
    setTimeout(() => {
      try {
        if (!this.room) {
          console.log('📡 Direct P2P connection established');
          return;
        }
        
        // Use Trystero's official getPeers() API
        const peers = this.room.getPeers();
        const peerIds = Object.keys(peers);
        
        if (peerIds.length === 0) {
          console.log('📡 Direct P2P connection established (no peers found)');
          return;
        }
        
        const pc = peers[peerIds[0]];
        if (!pc) {
          console.log('📡 Direct P2P connection established (peer connection not available)');
          return;
        }
        
        pc.getStats().then((stats: RTCStatsReport) => {
          let found = false;
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' && !found) {
              found = true;
              const localType = report.localCandidateType;
              const remoteType = report.remoteCandidateType;
              
              console.log('✅ Direct P2P connection established');
              console.log(`   Connection: local=${localType}, remote=${remoteType}`);
            }
          });
          if (!found) {
            console.log('📡 Direct P2P connection established (ICE negotiation in progress)');
          }
        }).catch((e) => {
          console.log('📡 Direct P2P connection established (stats error)', e);
        });
      } catch (e) {
        console.log('📡 Direct P2P connection established (error checking type)', e);
      }
    }, 5000);
  }


  /* ============================================
   * CONNECTION MANAGEMENT
   * ============================================
   * Methods for joining/leaving rooms and managing connection state.
   */

  /**
   * Joins a matchmaking room
   * 
   * Algorithm:
   * 1. Leave any existing room
   * 2. Set state to 'connecting'
   * 3. Try direct P2P connection with STUN-only configuration
   * 4. If P2P fails after timeout, fallback to Cloudflare Worker relay
   * 5. Set up message channel and event handlers
   * 6. Set state to 'waiting'
   * 7. Start peer timeout check and auto-rejoin
   * 
   * @param roomId - The room identifier to join
   * @throws Error if connection fails
   * 
   * Used by: MenuScene.onJoinQueue()
   */
  async joinRoom(roomId: string): Promise<void> {
    // Clean up any existing connection
    if (this.room) {
      this.leaveRoom();
    }

    this.setConnectionState('connecting');

    try {
      // First, try direct P2P connection
      await this.tryP2PConnection(roomId);
      
      // Set timeout for P2P connection - if no peer joins, fallback to relay
      this.p2pTimeout = setTimeout(() => {
        if (this.connectionState === 'waiting' && !this.peerId) {
          console.log('P2P connection timeout, falling back to Cloudflare Worker relay');
          this.fallbackToRelay(roomId);
        }
      }, NetworkManager.P2P_TIMEOUT_MS);

      this.setConnectionState('waiting');
      this.startPeerTimeoutCheck();
      this.startRejoinInterval(roomId);

    } catch (error) {
      console.warn('P2P connection failed, trying Cloudflare Worker relay:', error);
      await this.fallbackToRelay(roomId);
    }
  }

  /**
   * Attempts to establish a direct P2P connection
   * 
   * @param roomId - The room identifier to join
   * @private
   */
  private async tryP2PConnection(roomId: string): Promise<void> {
    // Try to fetch STUN servers from Twilio, fallback to default if it fails
    let rtcConfig: RTCConfiguration;
    try {
      rtcConfig = await this.fetchStunServers();
    } catch (error) {
      console.warn('Failed to fetch STUN servers, using default config:', error);
      rtcConfig = this.getDefaultStunConfig();
    }
    
    // Join room using Trystero's BitTorrent tracker strategy
    // Connect to all WSS trackers for HTTPS compatibility
    this.room = joinRoom(
      { 
        appId: this.config.appId,
        relayUrls: WSS_TRACKERS,
        relayRedundancy: WSS_TRACKERS.length,
        rtcConfig
      }, 
      roomId
    );
    
    // Set up action channel with NetworkMessage wrapper
    const [sendMessage, onMessage] = this.room.makeAction<NetworkMessage>('action');
    this.sendMessage = sendMessage;
    
    // Handle incoming messages
    onMessage((message, peerId) => {
      this.lastPeerActivity = Date.now();
      const action = deserializeAction(message);
      if (action) {
        this.handleIncomingAction(action, peerId);
      }
    });

    // Handle peer joining
    this.room.onPeerJoin((peerId) => {
      this.handlePeerJoin(peerId);
    });

    // Handle peer leaving
    this.room.onPeerLeave((peerId) => {
      this.handlePeerLeave(peerId);
    });
  }

  /**
   * Falls back to Cloudflare Worker relay when P2P fails
   * 
   * @param roomId - The room identifier to join
   * @private
   */
  private async fallbackToRelay(roomId: string): Promise<void> {
    try {
      // Stop all P2P related intervals and timeouts
      this.stopRejoinInterval();
      this.stopPeerTimeoutCheck();
      
      // Clean up P2P connection
      if (this.room) {
        this.room.leave();
        this.room = null;
      }
      this.sendMessage = null;
      
      // Clear P2P timeout
      if (this.p2pTimeout) {
        clearTimeout(this.p2pTimeout);
        this.p2pTimeout = null;
      }
      
      // Initialize relay manager
      this.relayManager = new CloudflareRelayManager();
      this.usingRelay = true;
      
      // Set up relay callbacks
      this.relayManager.onConnectionStateChange((state) => {
        this.setConnectionState(state);
      });
      
      this.relayManager.onPeerJoined((peerId) => {
        this.handlePeerJoin(peerId);
      });
      
      this.relayManager.onPeerLeft((peerId) => {
        this.handlePeerLeave(peerId);
      });
      
      this.relayManager.onAction((action, peerId) => {
        this.lastPeerActivity = Date.now();
        this.handleIncomingAction(action, peerId);
      });
      
      this.relayManager.onError((error) => {
        this.callbacks.onError?.(error);
      });
      
      // Connect to relay
      await this.relayManager.connect(roomId);
      console.log('✅ Connected via Cloudflare Worker relay');
      console.log('Waiting for peer to join relay room:', roomId);
      
    } catch (error) {
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Leaves the current room and cleans up all resources
   * 
   * Used by: MenuScene.onCancelQueue(), GameScene.handleReturnToMenu()
   */
  leaveRoom(): void {
    this.stopPingInterval();
    this.stopPeerTimeoutCheck();
    this.stopRejoinInterval();
    this.stopColorRequestLoop();
    
    // Clear P2P timeout
    if (this.p2pTimeout) {
      clearTimeout(this.p2pTimeout);
      this.p2pTimeout = null;
    }
    
    // Clean up P2P connection
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    
    // Clean up relay connection
    if (this.relayManager) {
      this.relayManager.disconnect();
      this.relayManager = null;
    }
    
    this.sendMessage = null;
    this.peerId = null;
    this.localColor = null;
    this.isHost = false;
    this.currentRoomId = '';
    this.rejoinAttempts = 0;
    this.lastColorAssignment = null;
    this.usingRelay = false;
    this.setConnectionState('disconnected');
  }

  /**
   * Gets the current connection state
   * 
   * @returns Current ConnectionState
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Gets the local player's unique ID
   * 
   * @returns Local player ID string
   */
  getLocalPlayerId(): string {
    return this.localPlayerId;
  }

  /**
   * Gets the connected peer's ID
   * 
   * @returns Peer ID or null if not connected
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /**
   * Gets the local player's assigned color
   * 
   * @returns 'white', 'black', or null if not assigned
   */
  getLocalColor(): PlayerColor | null {
    return this.localColor;
  }

  /**
   * Checks if this client is the host
   * 
   * The host is responsible for:
   * - Assigning colors randomly
   * - Being the source of truth for state sync
   * 
   * @returns True if this client is the host
   */
  getIsHost(): boolean {
    return this.isHost;
  }


  /* ============================================
   * CALLBACK REGISTRATION
   * ============================================
   * Methods for registering event callbacks.
   */

  /**
   * Sets multiple network event callbacks at once
   * 
   * @param callbacks - Object containing callback functions
   */
  setCallbacks(callbacks: NetworkCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Registers callback for connection state changes
   * 
   * @param callback - Function called with new state
   * 
   * Used by: MenuScene.setupNetworkCallbacks()
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): void {
    this.callbacks.onConnectionStateChange = callback;
  }

  /**
   * Registers callback for peer joining
   * 
   * @param callback - Function called with peer ID
   * 
   * Used by: MenuScene.setupNetworkCallbacks()
   */
  onPeerJoined(callback: (peerId: string) => void): void {
    this.callbacks.onPeerJoined = callback;
  }

  /**
   * Registers callback for peer leaving
   * 
   * @param callback - Function called with peer ID
   * 
   * Used by: MenuScene.setupNetworkCallbacks(), GameScene.setupNetworkCallbacks()
   */
  onPeerLeft(callback: (peerId: string) => void): void {
    this.callbacks.onPeerLeft = callback;
  }

  /**
   * Registers callback for game actions
   * 
   * @param callback - Function called with action and peer ID
   * 
   * Used by: GameScene.setupNetworkCallbacks()
   */
  onAction(callback: (action: GameAction, peerId: string) => void): void {
    this.callbacks.onAction = callback;
  }

  /**
   * Registers callback for state sync
   * 
   * @param callback - Function called with game state
   */
  onStateSync(callback: (state: GameState) => void): void {
    this.callbacks.onStateSync = callback;
  }

  /**
   * Registers callback for event log sync
   * 
   * @param callback - Function called with log entries
   */
  onEventLogSync(callback: (entries: EventLogEntry[]) => void): void {
    this.callbacks.onEventLogSync = callback;
  }

  /**
   * Registers callback for color assignment
   * 
   * @param callback - Function called with local player's color
   * 
   * Used by: MenuScene.setupNetworkCallbacks()
   */
  onColorAssigned(callback: (localColor: PlayerColor) => void): void {
    this.callbacks.onColorAssigned = callback;
  }

  /**
   * Registers callback for errors
   * 
   * @param callback - Function called with error
   * 
   * Used by: MenuScene.setupNetworkCallbacks()
   */
  onError(callback: (error: Error) => void): void {
    this.callbacks.onError = callback;
  }

  /* ============================================
   * ACTION SENDING
   * ============================================
   * Methods for sending game actions to the peer.
   */

  /**
   * Sends a game action to the connected peer
   * 
   * @param action - The action to send
   * 
   * Used by: All send* methods below
   */
  sendGameAction(action: GameAction): void {
    if (this.usingRelay && this.relayManager) {
      // Use relay manager for sending
      this.relayManager.sendAction(action);
    } else if (this.sendMessage && this.peerId) {
      // Use P2P for sending
      const message = serializeAction(action);
      this.sendMessage(message, this.peerId);
    } else {
      console.warn('Cannot send action: not connected to peer');
    }
  }

  /**
   * Sends full game state to peer for synchronization
   * 
   * @param state - The game state to send
   * 
   * Used by: GameScene for state sync
   */
  sendStateSync(state: GameState): void {
    this.sendGameAction({ type: 'STATE_SYNC', state });
  }

  /**
   * Sends event log entries to peer
   * 
   * @param entries - Array of log entries to send
   * 
   * Used by: GameScene for log sync
   */
  sendEventLogSync(entries: EventLogEntry[]): void {
    this.sendGameAction({ type: 'EVENT_LOG', entries });
  }

  /**
   * Sends a play card action
   * 
   * @param cardId - ID of the card being played
   * @param cardName - Name of the card (for logging)
   * @param target - Optional target square
   * @param pieceType - Optional piece type for deploy cards
   * @param effectAction - Optional effect action type
   * 
   * Used by: GameScene.handleCardPlay()
   */
  sendPlayCard(cardId: string, cardName: string, target?: string, pieceType?: string, effectAction?: string): void {
    this.sendGameAction({ type: 'PLAY_CARD', cardId, cardName, target, pieceType, effectAction });
  }

  /**
   * Sends a move piece action
   * 
   * @param from - Source square (e.g., 'e2')
   * @param to - Destination square (e.g., 'e4')
   * 
   * Used by: GameScene.handlePieceMove()
   */
  sendMovePiece(from: string, to: string, promotion?: string): void {
    this.sendGameAction({ type: 'MOVE_PIECE', from, to, promotion });
  }

  /**
   * Sends a mulligan action (redraw hand)
   * 
   * Used by: GameScene.handleMulligan()
   */
  sendMulligan(): void {
    this.sendGameAction({ type: 'MULLIGAN' });
  }

  /**
   * Sends a ready action (done with mulligan)
   * 
   * Used by: GameScene.handleReady()
   */
  sendReady(): void {
    this.sendGameAction({ type: 'READY' });
  }

  /**
   * Sends an end turn action
   * 
   * Used by: GameScene.handleEndTurn()
   */
  sendEndTurn(disturbAmount?: number): void {
    this.sendGameAction({ type: 'END_TURN', disturbAmount });
  }

  /**
   * Sends player name to peer
   * 
   * @param name - The player's display name
   * 
   * Used by: GameScene.create()
   */
  sendPlayerName(name: string): void {
    this.sendGameAction({ type: 'PLAYER_NAME', name });
  }

  /**
   * Sends a quick chat message
   *
   * @param message - Chat message text
   * @param senderColor - Sender's player color
   * @param senderName - Sender's display name
   */
  sendChatMessage(message: string, senderColor: PlayerColor, senderName: string): void {
    this.sendGameAction({ type: 'CHAT_MESSAGE', message, senderColor, senderName });
  }

  /**
   * Sends player stats for UI sync
   * 
   * @param clock - Current clock time in seconds
   * @param stopwatch - Current stopwatch time in seconds
   * @param mode - Current focus/disturb mode
   * @param deckCount - Number of cards in deck
   * @param discardCount - Number of cards in discard
   * 
   * Used by: GameScene.updateUI()
   */
  sendPlayerStats(
    clock: number,
    stopwatch: number,
    mode: 'focus' | 'disturb',
    deckCount: number,
    discardCount: number,
    energy: number,
    energyCap: number,
    disturb: number
  ): void {
    this.sendGameAction({
      type: 'PLAYER_STATS_SYNC',
      clock,
      stopwatch,
      mode,
      deckCount,
      discardCount,
      energy,
      energyCap,
      disturb
    });
  }

  /**
   * Sends a rematch request
   * 
   * Used by: GameScene.handleRematchRequest()
   */
  sendRematchRequest(): void {
    this.sendGameAction({ type: 'REMATCH_REQUEST' });
  }

  /**
   * Sends rematch acceptance
   * 
   * Used by: GameScene.handleRematchReceived()
   */
  sendRematchAccept(): void {
    this.sendGameAction({ type: 'REMATCH_ACCEPT' });
  }

  /**
   * Sends rematch decline
   * 
   * Used by: GameScene.handleRematchDeclined()
   */
  sendRematchDecline(): void {
    this.sendGameAction({ type: 'REMATCH_DECLINE' });
  }


  /* ============================================
   * PRIVATE EVENT HANDLERS
   * ============================================
   * Internal methods for handling network events.
   */

  /**
   * Handles a peer joining the room
   * 
   * Algorithm:
   * 1. Ignore if already connected to a peer (1v1 game)
   * 2. Store peer ID and update state
   * 3. Clear P2P timeout (connection successful)
   * 4. Determine host (lower ID is host)
   * 5. If host: assign colors randomly and send assignment
   * 6. If not host: start requesting color assignment
   * 7. Notify callback and start keep-alive pings
   * 
   * @param peerId - The joining peer's ID
   * @private
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
    
    // Clear P2P timeout since we found a peer
    if (this.p2pTimeout) {
      clearTimeout(this.p2pTimeout);
      this.p2pTimeout = null;
    }
    
    // Determine host: lower ID is host
    // Host is responsible for assigning colors
    this.isHost = this.localPlayerId < peerId;
    
    if (this.isHost) {
      // Randomly assign colors (50/50 chance)
      const localIsWhite = Math.random() < 0.5;
      this.localColor = localIsWhite ? 'white' : 'black';
      
      // Send color assignment to peer
      const colorAssignment: GameAction = {
        type: 'COLOR_ASSIGNMENT',
        whitePlayerId: localIsWhite ? this.localPlayerId : peerId,
        blackPlayerId: localIsWhite ? peerId : this.localPlayerId
      };
      this.lastColorAssignment = colorAssignment;
      this.sendGameAction(colorAssignment);
      
      // Notify local callback
      this.callbacks.onColorAssigned?.(this.localColor);
    } else {
      // Non-host: request color assignment
      this.startColorRequestLoop();
    }
    
    this.callbacks.onPeerJoined?.(peerId);
    this.startPingInterval();
    this.logConnectionType();
  }

  /**
   * Handles a peer leaving the room
   * 
   * @param peerId - The leaving peer's ID
   * @private
   */
  private handlePeerLeave(peerId: string): void {
    if (this.peerId !== peerId) return;
    
    this.peerId = null;
    this.stopPingInterval();
    this.stopColorRequestLoop();
    this.setConnectionState('waiting');
    this.callbacks.onPeerLeft?.(peerId);
  }

  /**
   * Handles incoming actions from peer
   * 
   * Routes actions to appropriate handlers or callbacks.
   * 
   * @param action - The received game action
   * @param peerId - The sender's peer ID
   * @private
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
        if (this.localColor === null) {
          if (action.whitePlayerId === this.localPlayerId) {
            this.localColor = 'white';
          } else if (action.blackPlayerId === this.localPlayerId) {
            this.localColor = 'black';
          }
          if (this.localColor) {
            this.stopColorRequestLoop();
            this.callbacks.onColorAssigned?.(this.localColor);
          }
        }
        break;
        
      case 'COLOR_REQUEST':
        // Resend color assignment if we're host
        if (this.isHost && this.lastColorAssignment) {
          this.sendGameAction(this.lastColorAssignment);
        }
        break;
        
      case 'PING':
        // Respond to ping with pong
        this.sendGameAction({ type: 'PONG', timestamp: action.timestamp });
        break;
        
      case 'PONG':
        // Ping response received - peer is alive
        break;
        
      default:
        // Forward other actions to callback
        this.callbacks.onAction?.(action, peerId);
        break;
    }
  }

  /**
   * Updates connection state and notifies callback
   * 
   * @param state - New connection state
   * @private
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.callbacks.onConnectionStateChange?.(state);
    }
  }

  /* ============================================
   * KEEP-ALIVE AND TIMEOUT MANAGEMENT
   * ============================================
   * Methods for maintaining connection health.
   */

  /**
   * Starts the ping interval for keep-alive
   * 
   * Sends periodic pings to detect disconnections.
   * Only used for P2P connections - relay has its own heartbeat.
   * 
   * @private
   */
  private startPingInterval(): void {
    if (this.usingRelay) {
      return; // Relay manager handles its own heartbeat
    }
    
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.peerId) {
        this.sendGameAction({ type: 'PING', timestamp: Date.now() });
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stops the ping interval
   * 
   * @private
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Starts checking for peer timeout
   * 
   * If no activity from peer for PEER_TIMEOUT_MS, considers them disconnected.
   * 
   * @private
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
   * Stops the peer timeout check
   * 
   * @private
   */
  private stopPeerTimeoutCheck(): void {
    if (this.peerTimeoutCheck) {
      clearInterval(this.peerTimeoutCheck);
      this.peerTimeoutCheck = null;
    }
  }

  /**
   * Starts auto-rejoin interval for faster peer discovery
   * 
   * When both players join simultaneously, they might not see each other.
   * Periodically leaving and rejoining helps refresh tracker presence.
   * 
   * @param roomId - The room to rejoin
   * @private
   */
  private startRejoinInterval(roomId: string): void {
    this.stopRejoinInterval();
    this.currentRoomId = roomId;
    this.rejoinAttempts = 0;
    
    this.rejoinInterval = setInterval(() => {
      // Only rejoin if still waiting and haven't exceeded max attempts
      if (this.connectionState === 'waiting' && !this.peerId) {
        this.rejoinAttempts++;
        
        if (this.rejoinAttempts >= NetworkManager.MAX_REJOIN_ATTEMPTS) {
          console.log('Max rejoin attempts reached, stopping auto-rejoin');
          this.stopRejoinInterval();
          return;
        }
        
        console.log(`Auto-rejoin attempt ${this.rejoinAttempts}/${NetworkManager.MAX_REJOIN_ATTEMPTS}`);
        this.performRejoin();
      } else if (this.peerId) {
        // Peer found, stop rejoining
        this.stopRejoinInterval();
      }
    }, NetworkManager.REJOIN_INTERVAL_MS);
  }

  /**
   * Performs a rejoin to refresh tracker presence
   * 
   * @private
   */
  private async performRejoin(): Promise<void> {
    if (!this.currentRoomId || !this.room) return;
    
    const roomId = this.currentRoomId;
    
    // Leave current room
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.sendMessage = null;
    
    // Small delay before rejoining
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Rejoin the room
    try {
      if (this.usingRelay && this.relayManager) {
        // For relay connections, just reconnect
        await this.relayManager.connect(roomId);
      } else {
        // For P2P connections, rejoin the room
        // Try to fetch STUN servers from Twilio, fallback to default if it fails
        let rtcConfig: RTCConfiguration;
        try {
          rtcConfig = await this.fetchStunServers();
        } catch (error) {
          console.warn('Failed to fetch STUN servers during rejoin, using default config:', error);
          rtcConfig = this.getDefaultStunConfig();
        }
        
        this.room = joinRoom(
          { 
            appId: this.config.appId,
            relayUrls: WSS_TRACKERS,
            relayRedundancy: WSS_TRACKERS.length,
            rtcConfig
          }, 
          roomId
        );
        
        // Re-setup action channel
        const [sendMessage, onMessage] = this.room.makeAction<NetworkMessage>('action');
        this.sendMessage = sendMessage;
        
        onMessage((message, peerId) => {
          this.lastPeerActivity = Date.now();
          const action = deserializeAction(message);
          if (action) {
            this.handleIncomingAction(action, peerId);
          }
        });

        this.room.onPeerJoin((peerId) => {
          this.handlePeerJoin(peerId);
        });

        this.room.onPeerLeave((peerId) => {
          this.handlePeerLeave(peerId);
        });
      }
      
    } catch (error) {
      console.error('Rejoin failed:', error);
    }
  }

  /**
   * Stops the auto-rejoin interval
   * 
   * @private
   */
  private stopRejoinInterval(): void {
    if (this.rejoinInterval) {
      clearInterval(this.rejoinInterval);
      this.rejoinInterval = null;
    }
  }

  /**
   * Starts the color request loop for non-host
   * 
   * Periodically requests color assignment from host.
   * 
   * @private
   */
  private startColorRequestLoop(): void {
    this.stopColorRequestLoop();
    this.colorRequestAttempts = 0;
    
    const requestOnce = () => {
      if (this.localColor || !this.peerId) {
        this.stopColorRequestLoop();
        return;
      }
      
      this.colorRequestAttempts += 1;
      this.sendGameAction({ type: 'COLOR_REQUEST' });
      
      if (this.colorRequestAttempts < NetworkManager.MAX_COLOR_REQUESTS) {
        this.colorRequestTimeout = setTimeout(requestOnce, NetworkManager.COLOR_REQUEST_INTERVAL_MS);
      } else {
        this.colorRequestTimeout = null;
      }
    };
    
    this.colorRequestTimeout = setTimeout(requestOnce, NetworkManager.COLOR_REQUEST_INTERVAL_MS);
  }

  /**
   * Stops the color request loop
   * 
   * @private
   */
  private stopColorRequestLoop(): void {
    if (this.colorRequestTimeout) {
      clearTimeout(this.colorRequestTimeout);
      this.colorRequestTimeout = null;
    }
    this.colorRequestAttempts = 0;
  }


  /* ============================================
   * STATE SYNCHRONIZATION
   * ============================================
   * Methods for detecting and recovering from desync.
   */

  /**
   * Requests state sync from peer (for desync recovery)
   * 
   * Non-host sends a sync request; host responds with authoritative state.
   */
  requestStateSync(): void {
    if (!this.isHost && this.peerId) {
      this.sendGameAction({ type: 'STATE_SYNC', state: {} as GameState });
    }
  }

  /**
   * Handles state sync request as host
   * 
   * Sends the authoritative game state to the requesting peer.
   * 
   * @param localState - The current game state to send
   */
  handleStateSyncRequest(localState: GameState): void {
    if (this.isHost && this.peerId) {
      this.sendStateSync(localState);
    }
  }

  detectDesync(localState: GameState, remoteState: GameState): boolean {
    return detectDesyncHelper(localState, remoteState);
  }

  recoverFromDesync(localState: GameState, hostState: GameState): GameState {
    return recoverFromDesyncHelper(this.isHost, localState, hostState);
  }

  static areStatesInSync(state1: GameState, state2: GameState): boolean {
    return areStatesInSyncHelper(state1, state2);
  }

  static hashState(state: GameState): string {
    return hashStateHelper(state);
  }

  static mergeEventLogs(local: EventLogEntry[], remote: EventLogEntry[]): EventLogEntry[] {
    return mergeEventLogsHelper(local, remote);
  }
}
