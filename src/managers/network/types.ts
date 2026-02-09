/**
 * @fileoverview Network manager shared types
 *
 * @module managers/network/types
 */

import type { GameState, PlayerColor } from '../GameStateManager';

/**
 * JSON-serializable value type for Trystero messages
 * Trystero requires all data to be JSON-serializable
 */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * Wrapper for network messages to ensure JSON serialization
 * Uses index signature to satisfy Trystero's DataPayload constraint
 */
export interface NetworkMessage {
  [key: string]: JsonValue;
  actionType: string;
  payload: JsonValue;
}

/**
 * Game action types for P2P messaging
 *
 * Each action type represents a different game event that needs
 * to be synchronized between players.
 *
 * Action Categories:
 * - Game actions: PLAY_CARD, MOVE_PIECE, END_TURN
 * - Phase actions: MULLIGAN, READY
 * - Meta actions: PLAYER_NAME, COLOR_REQUEST, COLOR_ASSIGNMENT
 * - Sync actions: STATE_SYNC, EVENT_LOG, PLAYER_STATS_SYNC
 * - Connection: PING, PONG
 * - Rematch: REMATCH_REQUEST, REMATCH_ACCEPT, REMATCH_DECLINE
 */
export type GameAction =
  | {
      type: 'PLAY_CARD';
      cardId: string;
      cardName: string;
      target?: string;
      targets?: string[];
      pieceType?: string;
      pieceTypes?: Array<string | null>;
      effectAction?: string;
      effectActions?: string[];
    }
  | { type: 'MOVE_PIECE'; from: string; to: string; promotion?: string }
  | { type: 'MULLIGAN'; time_cost: number }
  | { type: 'READY' }
  | { type: 'END_TURN'; disturbAmount?: number }
  | { type: 'DISCARD_CARDS'; count: number }
  | { type: 'PLAYER_NAME'; name: string }
  | { type: 'COLOR_REQUEST' }
  | { type: 'CHAT_MESSAGE'; message: string; senderColor: PlayerColor; senderName: string }
  | { type: 'REMATCH_REQUEST' }
  | { type: 'REMATCH_ACCEPT' }
  | { type: 'REMATCH_DECLINE' }
  | { type: 'OFFER_DRAW' }
  | { type: 'ACCEPT_DRAW' }
  | { type: 'RESIGN' }
  | { type: 'STATE_SYNC'; state: GameState }
  | { type: 'PLAYER_STATS_SYNC'; clock: number; stopwatch: number; mode: 'focus' | 'disturb'; deckCount: number; discardCount: number; handCount: number; energy: number; energyCap: number; disturb: number }
  | { type: 'EVENT_LOG'; entries: EventLogEntry[] }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number }
  | { type: 'COLOR_ASSIGNMENT'; whitePlayerId: string; blackPlayerId: string };

/**
 * Event log entry for syncing game history
 *
 * Each entry represents a game event that should be displayed
 * in the event log and synchronized between players.
 *
 * @property id - Unique identifier for deduplication
 * @property timestamp - Unix timestamp for ordering
 * @property player - Who performed the action ('white', 'black', or 'system')
 * @property message - Human-readable description of the event
 */
export interface EventLogEntry {
  id: string;
  timestamp: number;
  player: PlayerColor | 'system';
  message: string;
  displayName?: string;
}

/**
 * Connection state for tracking peer status
 *
 * State transitions:
 * - disconnected -> connecting: When joinRoom() is called
 * - connecting -> waiting: When room is joined, waiting for peer
 * - waiting -> connected: When peer joins
 * - connected -> waiting: When peer leaves
 * - any -> disconnected: When leaveRoom() is called
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'waiting' | 'connected';

/**
 * Network event callbacks interface
 *
 * Set these callbacks to respond to network events.
 * All callbacks are optional.
 */
export interface NetworkCallbacks {
  /** Called when connection state changes */
  onConnectionStateChange?: (state: ConnectionState) => void;
  /** Called when a peer joins the room */
  onPeerJoined?: (peerId: string) => void;
  /** Called when a peer leaves the room */
  onPeerLeft?: (peerId: string) => void;
  /** Called when a game action is received */
  onAction?: (action: GameAction, peerId: string) => void;
  /** Called when state sync is received */
  onStateSync?: (state: GameState) => void;
  /** Called when event log sync is received */
  onEventLogSync?: (entries: EventLogEntry[]) => void;
  /** Called when color is assigned */
  onColorAssigned?: (localColor: PlayerColor) => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Trystero configuration options
 */
export interface TrysteroConfig {
  appId: string;
  rtcConfig?: RTCConfiguration;
}
