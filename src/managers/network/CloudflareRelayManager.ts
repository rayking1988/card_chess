/**
 * @fileoverview CloudflareRelayManager - Fallback communication via Cloudflare Worker
 * 
 * This module provides a fallback communication mechanism when direct P2P
 * connections fail. It uses a Cloudflare Worker with WebSockets to
 * transmit game actions between players.
 * 
 * Key Features:
 * - WebSocket-based real-time communication
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
 * communication through a Cloudflare Worker relay server using WebSockets.
 * 
 * Connection Flow:
 * 1. Call connect(roomId) to join a relay room
 * 2. Establish WebSocket connection to the worker
 * 3. Listen for onPeerJoined when another player connects
 * 4. Use sendAction() to send game actions
 * 5. Receive actions via onAction callback
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
  
  /** WebSocket connection for real-time communication */
  private websocket: WebSocket | null = null;
  
  /** Message queue for when disconnected */
  private messageQueue: GameAction[] = [];
  
  /** Reconnection timer */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  /** Ping interval for connection health */
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  
  /** Reconnection attempt count */
  private reconnectAttempts: number = 0;
  
  /** Maximum reconnection attempts */
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  
  /** Reconnection delay (ms) */
  private static readonly RECONNECT_DELAY_MS = 3000;
  
  /** Ping interval (ms) */
  private static readonly PING_INTERVAL_MS = 30000;
  
  /** Bound beforeunload handler for cleanup */
  private boundBeforeUnload: (() => void) | null = null;

  /**
   * Creates a new CloudflareRelayManager instance
   */
  constructor() {
    this.playerId = this.generatePlayerId();
    
    // Set up beforeunload handler for graceful disconnect on tab close
    this.boundBeforeUnload = () => this.handleBeforeUnload();
    window.addEventListener('beforeunload', this.boundBeforeUnload);
  }
  
  /**
   * Handles browser tab close/refresh for graceful disconnect
   * @private
   */
  private handleBeforeUnload(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      // Send graceful close - browser may not wait for response
      try {
        this.websocket.close(1000, 'Page unload');
      } catch (e) {
        // Ignore errors during close
      }
    }
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
      this.startPing();
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
    this.stopPing();
    this.stopPolling();
    this.stopReconnectTimer();
    
    // Remove beforeunload handler
    if (this.boundBeforeUnload) {
      window.removeEventListener('beforeunload', this.boundBeforeUnload);
      this.boundBeforeUnload = null;
    }
    
    if (this.websocket) {
      // Send graceful close with normal closure code (1000)
      // This prevents Cloudflare from logging "client disconnected" errors
      try {
        this.websocket.close(1000, 'Normal closure');
      } catch (e) {
        // Ignore errors during close
      }
      this.websocket = null;
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

    // Use WebSocket if available
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      try {
        console.log('Sending action via WebSocket:', action.type);
        
        const message = {
          type: 'send_action',
          targetId: this.peerId,
          action
        };
        
        this.websocket.send(JSON.stringify(message));
        console.log('Action sent successfully via WebSocket');
        return;
      } catch (error) {
        console.error('Failed to send action via WebSocket:', error);
      }
    }

    // Fall back to HTTP POST
    try {
      console.log('Sending action via HTTP:', action.type);
      const response = await fetch(`${RELAY_WORKER_ENDPOINT}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.log('Action sent successfully via HTTP');
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
   * Establishes the WebSocket connection to the relay server
   * Falls back to polling if WebSocket fails
   */
  private async establishConnection(): Promise<void> {
    if (!this.roomId) {
      throw new Error('No room ID set');
    }

    // Try WebSocket first
    try {
      await this.establishWebSocketConnection();
      return;
    } catch (wsError) {
      console.warn('WebSocket connection failed, falling back to polling:', wsError);
    }

    // Fall back to polling
    await this.establishPollingConnection();
  }

  /**
   * Establishes WebSocket connection
   */
  private async establishWebSocketConnection(): Promise<void> {
    // Create WebSocket URL
    const wsUrl = `${RELAY_WORKER_ENDPOINT.replace('https://', 'wss://').replace('http://', 'ws://')}/ws?roomId=${encodeURIComponent(this.roomId!)}&playerId=${encodeURIComponent(this.playerId)}`;
    
    console.log('Establishing WebSocket connection to:', wsUrl);
    this.websocket = new WebSocket(wsUrl);

    // Set up event handlers
    this.websocket.onopen = () => {
      console.log('WebSocket connection opened successfully');
      this.reconnectAttempts = 0;
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerMessage(data);
      } catch (error) {
        console.error('Failed to parse server message:', error, 'Raw data:', event.data);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('WebSocket connection closed:', event.code, event.reason);
      
      // Only handle connection loss if we're not already disconnecting
      if (this.connectionState !== 'disconnected') {
        this.handleConnectionLoss();
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket connection error:', error);
    };

    // Wait for connection to be established with timeout
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.websocket) {
          this.websocket.close();
          this.websocket = null;
        }
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      const checkConnection = () => {
        if (!this.websocket) {
          clearTimeout(timeout);
          reject(new Error('WebSocket was closed'));
          return;
        }

        if (this.websocket.readyState === WebSocket.OPEN) {
          clearTimeout(timeout);
          resolve();
        } else if (this.websocket.readyState === WebSocket.CLOSED) {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed to open'));
        } else {
          // Still connecting, check again
          setTimeout(checkConnection, 100);
        }
      };

      // Start checking after a small delay
      setTimeout(checkConnection, 100);
    });
  }

  /**
   * Establishes polling-based connection (fallback)
   */
  private async establishPollingConnection(): Promise<void> {
    console.log('Establishing polling connection...');
    
    // Join the room
    const joinResponse = await fetch(`${RELAY_WORKER_ENDPOINT}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: this.roomId,
        playerId: this.playerId
      })
    });

    if (!joinResponse.ok) {
      throw new Error(`Failed to join room: ${joinResponse.status}`);
    }

    const joinData = await joinResponse.json();
    console.log('Joined room via polling:', joinData);

    // Check if there are other players
    if (joinData.otherPlayers && joinData.otherPlayers.length > 0) {
      this.peerId = joinData.otherPlayers[0];
      this.setConnectionState('connected');
      this.callbacks.onPeerJoined?.(this.peerId!);
    }

    // Start polling for messages
    this.startPolling();
  }

  /** Polling interval */
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Starts polling for messages
   */
  private startPolling(): void {
    this.stopPolling();
    
    this.pollingInterval = setInterval(async () => {
      if (!this.roomId || this.connectionState === 'disconnected') {
        this.stopPolling();
        return;
      }

      try {
        const response = await fetch(`${RELAY_WORKER_ENDPOINT}/poll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomId,
            playerId: this.playerId
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.messages) {
            for (const message of data.messages) {
              this.handleServerMessage(message);
            }
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 1000); // Poll every second
  }

  /**
   * Stops polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Handles messages from the relay server
   */
  private handleServerMessage(data: any): void {
    switch (data.type) {
      case 'connected':
        console.log('Relay connection confirmed');
        break;

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

      case 'pong':
        // Ping response received - connection is alive
        break;

      case 'error':
        this.callbacks.onError?.(new Error(data.message));
        break;

      default:
        console.log('Unknown message type:', data.type);
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
    
    // Close existing connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.setConnectionState('connecting');

    // Don't attempt reconnection if we've exceeded max attempts
    if (this.reconnectAttempts >= CloudflareRelayManager.MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached, giving up');
      this.setConnectionState('disconnected');
      this.callbacks.onError?.(new Error('Connection lost and could not reconnect'));
      return;
    }

    this.attemptReconnection();
  }

  /**
   * Attempts to reconnect to the relay server
   */
  private attemptReconnection(): void {
    // Clear any existing reconnect timer
    this.stopReconnectTimer();
    
    this.reconnectAttempts++;
    console.log(`Reconnection attempt ${this.reconnectAttempts}/${CloudflareRelayManager.MAX_RECONNECT_ATTEMPTS}`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        if (this.roomId && this.connectionState !== 'disconnected') {
          await this.establishConnection();
          this.setConnectionState(this.peerId ? 'connected' : 'waiting');
          this.flushMessageQueue();
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
        
        // Only attempt another reconnection if we haven't been disconnected
        if (this.connectionState !== 'disconnected') {
          this.handleConnectionLoss();
        }
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
   * Starts the ping to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        try {
          this.websocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        } catch (error) {
          console.error('Failed to send ping:', error);
        }
      }
    }, CloudflareRelayManager.PING_INTERVAL_MS);
  }

  /**
   * Stops the ping interval
   */
  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
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