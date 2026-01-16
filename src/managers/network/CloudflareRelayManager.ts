/**
 * @fileoverview CloudflareRelayManager - Fallback communication via Cloudflare Worker
 * 
 * This module provides a fallback communication mechanism when direct P2P
 * connections fail. It uses a Cloudflare Worker as a relay server to
 * transmit game actions between players.
 * 
 * Key Features:
 * - WebSocket-like communication via Server-Sent Events (SSE) and fetch
 * - Room-based message routing
 * - Automatic reconnection on connection loss
 * - Message queuing during disconnections
 * - Compatible with existing GameAction types
 * 
 * @module managers/network/CloudflareRelayManager
 */

import { RELAY_WORKER_ENDPOINT } from './constants';
import type { GameAction, ConnectionState } from './types';

/**
 * Callback interface for relay events
 */
interface RelayCallbacks {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onPeerJoined?: (peerId: string) => void;
  onPeerLeft?: (peerId: string) => void;
  onAction?: (action: GameAction, peerId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * CloudflareRelayManager - Fallback communication via Cloudflare Worker
 * 
 * When direct P2P connections fail, this manager provides reliable
 * communication through a Cloudflare Worker relay server.
 * 
 * Connection Flow:
 * 1. Call connect(roomId) to join a relay room
 * 2. Listen for onPeerJoined when another player connects
 * 3. Use sendAction() to send game actions
 * 4. Receive actions via onAction callback
 * 
 * @example
 * const relay = new CloudflareRelayManager();
 * 
 * relay.onAction((action, peerId) => {
 *   handleOpponentAction(action);
 * });
 * 
 * await relay.connect('my-room-id');
 * relay.sendAction({ type: 'PLAY_CARD', cardId: '123', cardName: 'Knight' });
 */
export class CloudflareRelayManager {
  /* ----------------------------------------
   * Private Properties
   * ---------------------------------------- */
  
  /** Current room ID */
  private roomId: string | null = null;
  
  /** Local player's unique ID */
  private playerId: string;
  
  /** Connected peer's ID */
  private peerId: string | null = null;
  
  /** Current connection state */
  private connectionState: ConnectionState = 'disconnected';
  
  /** Event callbacks */
  private callbacks: RelayCallbacks = {};
  
  /** Server-Sent Events connection for receiving messages */
  private eventSource: EventSource | null = null;
  
  /** Message queue for when disconnected */
  private messageQueue: GameAction[] = [];
  
  /** Reconnection timer */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  /** Heartbeat interval */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Reconnection attempt count */
  private reconnectAttempts: number = 0;
  
  /** Maximum reconnection attempts */
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  
  /** Reconnection delay (ms) */
  private static readonly RECONNECT_DELAY_MS = 3000;
  
  /** Heartbeat interval (ms) */
  private static readonly HEARTBEAT_INTERVAL_MS = 30000;

  /**
   * Creates a new CloudflareRelayManager instance
   */
  constructor() {
    this.playerId = this.generatePlayerId();
  }

  /* ============================================
   * PUBLIC API
   * ============================================ */

  /**
   * Connects to a relay room
   * 
   * @param roomId - The room identifier to join
   */
  async connect(roomId: string): Promise<void> {
    if (this.roomId === roomId && this.connectionState !== 'disconnected') {
      return; // Already connected to this room
    }

    this.disconnect();
    this.roomId = roomId;
    this.setConnectionState('connecting');

    try {
      await this.establishConnection();
      this.setConnectionState('waiting');
      this.startHeartbeat();
    } catch (error) {
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Disconnects from the relay room
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnectTimer();
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.roomId = null;
    this.peerId = null;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.setConnectionState('disconnected');
  }

  /**
   * Sends a game action to the connected peer
   * 
   * @param action - The action to send
   */
  async sendAction(action: GameAction): Promise<void> {
    if (!this.roomId || !this.peerId) {
      console.warn('Cannot send action: not connected to peer');
      this.messageQueue.push(action);
      return;
    }

    try {
      const response = await fetch(`${RELAY_WORKER_ENDPOINT}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId: this.roomId,
          senderId: this.playerId,
          targetId: this.peerId,
          action
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to send action: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to send action:', error);
      this.messageQueue.push(action);
      
      // Try to reconnect if send fails
      if (this.connectionState === 'connected') {
        this.handleConnectionLoss();
      }
    }
  }

  /**
   * Gets the current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Gets the local player's ID
   */
  getPlayerId(): string {
    return this.playerId;
  }

  /**
   * Gets the connected peer's ID
   */
  getPeerId(): string | null {
    return this.peerId;
  }

  /* ============================================
   * CALLBACK REGISTRATION
   * ============================================ */

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

  onError(callback: (error: Error) => void): void {
    this.callbacks.onError = callback;
  }

  /* ============================================
   * PRIVATE METHODS
   * ============================================ */

  /**
   * Generates a unique player ID
   */
  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Establishes the SSE connection to the relay server
   */
  private async establishConnection(): Promise<void> {
    if (!this.roomId) {
      throw new Error('No room ID set');
    }

    // First, join the room
    const joinResponse = await fetch(`${RELAY_WORKER_ENDPOINT}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roomId: this.roomId,
        playerId: this.playerId
      })
    });

    if (!joinResponse.ok) {
      throw new Error(`Failed to join room: ${joinResponse.status}`);
    }

    // Then establish SSE connection for receiving messages
    const sseUrl = `${RELAY_WORKER_ENDPOINT}/listen?roomId=${encodeURIComponent(this.roomId)}&playerId=${encodeURIComponent(this.playerId)}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onopen = () => {
      console.log('Relay connection established');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch (error) {
        console.error('Failed to parse server message:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.error('Relay connection error');
      this.handleConnectionLoss();
    };

    // Wait for connection to be established
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      const checkConnection = () => {
        if (this.eventSource?.readyState === EventSource.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.eventSource?.readyState === EventSource.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('Connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };

      checkConnection();
    });
  }

  /**
   * Handles messages from the relay server
   */
  private handleServerMessage(data: any): void {
    switch (data.type) {
      case 'peer_joined':
        if (data.peerId !== this.playerId) {
          this.peerId = data.peerId;
          this.setConnectionState('connected');
          this.callbacks.onPeerJoined?.(data.peerId);
          this.flushMessageQueue();
        }
        break;

      case 'peer_left':
        if (data.peerId === this.peerId) {
          this.peerId = null;
          this.setConnectionState('waiting');
          this.callbacks.onPeerLeft?.(data.peerId);
        }
        break;

      case 'action':
        if (data.senderId === this.peerId) {
          this.callbacks.onAction?.(data.action, data.senderId);
        }
        break;

      case 'error':
        this.callbacks.onError?.(new Error(data.message));
        break;
    }
  }

  /**
   * Handles connection loss and attempts reconnection
   */
  private handleConnectionLoss(): void {
    if (this.connectionState === 'disconnected') {
      return; // Already handling disconnection
    }

    console.log('Relay connection lost, attempting to reconnect...');
    this.setConnectionState('connecting');

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.attemptReconnection();
  }

  /**
   * Attempts to reconnect to the relay server
   */
  private attemptReconnection(): void {
    if (this.reconnectAttempts >= CloudflareRelayManager.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(new Error('Connection lost and could not reconnect'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${CloudflareRelayManager.MAX_RECONNECT_ATTEMPTS}`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.roomId) {
          await this.establishConnection();
          this.setConnectionState(this.peerId ? 'connected' : 'waiting');
          this.flushMessageQueue();
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnection();
      }
    }, CloudflareRelayManager.RECONNECT_DELAY_MS);
  }

  /**
   * Sends queued messages after reconnection
   */
  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0 || !this.peerId) {
      return;
    }

    console.log(`Flushing ${this.messageQueue.length} queued messages`);
    const messages = [...this.messageQueue];
    this.messageQueue = [];

    for (const action of messages) {
      try {
        await this.sendAction(action);
      } catch (error) {
        console.error('Failed to send queued message:', error);
        // Re-queue failed messages
        this.messageQueue.push(action);
      }
    }
  }

  /**
   * Updates connection state and notifies callback
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.callbacks.onConnectionStateChange?.(state);
    }
  }

  /**
   * Starts the heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      if (this.roomId) {
        try {
          await fetch(`${RELAY_WORKER_ENDPOINT}/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomId: this.roomId,
              playerId: this.playerId
            })
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, CloudflareRelayManager.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * Stops the heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Stops the reconnection timer
   */
  private stopReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}