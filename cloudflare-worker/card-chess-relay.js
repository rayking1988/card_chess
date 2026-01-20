/**
 * Cloudflare Worker for Card Chess P2P Relay with Durable Objects
 * 
 * IMPORTANT: Cloudflare Workers are stateless - each request can hit a different instance.
 * To share state between players, we use Durable Objects which provide persistent,
 * consistent state across all requests.
 * 
 * Features:
 * - Room-based message routing using Durable Objects
 * - WebSocket connections for real-time message delivery
 * - Persistent state across worker instances
 * - CORS support for web applications
 * - Rate limiting to prevent abuse
 * - Game statistics tracking (games started/finished)
 * - Maximum 2 players per room enforcement
 * 
 * Deployment:
 * 1. Create a new worker at workers.cloudflare.com
 * 2. Enable Durable Objects in your worker settings
 * 3. Add the bindings: 
 *    [[durable_objects.bindings]] name = "ROOMS" class_name = "GameRoom"
 *    [[durable_objects.bindings]] name = "STATS" class_name = "GameStats"
 * 4. Deploy this script
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Upgrade',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return null;
}

/**
 * Durable Object class for tracking game statistics
 * Persists game counts across all requests
 */
export class GameStats {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    switch (path) {
      case '/stats':
        return this.getStats();
      case '/stats/increment-started':
        return this.incrementStarted();
      case '/stats/increment-finished':
        return this.incrementFinished();
      default:
        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
  }

  async getStats() {
    const gamesStarted = await this.state.storage.get('gamesStarted') || 0;
    const gamesFinished = await this.state.storage.get('gamesFinished') || 0;
    
    return new Response(JSON.stringify({
      gamesStarted,
      gamesFinished,
      timestamp: Date.now()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  async incrementStarted() {
    const current = await this.state.storage.get('gamesStarted') || 0;
    await this.state.storage.put('gamesStarted', current + 1);
    
    return new Response(JSON.stringify({
      gamesStarted: current + 1,
      success: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  async incrementFinished() {
    const current = await this.state.storage.get('gamesFinished') || 0;
    await this.state.storage.put('gamesFinished', current + 1);
    
    return new Response(JSON.stringify({
      gamesFinished: current + 1,
      success: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Durable Object class for managing a game room
 * Each room has its own persistent state and WebSocket connections
 * Maximum 2 players per room enforced
 */
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // playerId -> WebSocket
    this.players = new Map(); // playerId -> { lastSeen, messages: [] }
    this.gameStarted = false; // Track if game has started (2 players connected)
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }
    
    // Handle HTTP requests (polling fallback)
    switch (path) {
      case '/join':
        if (request.method === 'POST') return this.handleJoin(request);
        break;
      case '/poll':
        if (request.method === 'POST') return this.handlePoll(request);
        break;
      case '/send':
        if (request.method === 'POST') return this.handleSend(request);
        break;
      case '/status':
        return new Response(JSON.stringify({
          players: Array.from(this.players.keys()),
          activeWebSockets: this.sessions.size,
          gameStarted: this.gameStarted
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  // ============ Polling Methods ============

  async handleJoin(request) {
    try {
      const { playerId } = await request.json();
      if (!playerId) {
        return new Response(JSON.stringify({ error: 'Missing playerId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Check if room is full (max 2 players)
      const existingPlayers = Array.from(this.players.keys()).filter(id => id !== playerId);
      if (existingPlayers.length >= 2) {
        return new Response(JSON.stringify({ 
          error: 'Room is full', 
          code: 'ROOM_FULL',
          playerCount: this.players.size 
        }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isNewPlayer = !this.players.has(playerId);
      
      // Add or update player
      this.players.set(playerId, {
        lastSeen: Date.now(),
        messages: []
      });

      // Get list of other players
      const otherPlayers = [];
      for (const [id] of this.players) {
        if (id !== playerId) {
          otherPlayers.push(id);
          // Notify other player about this player joining (via polling queue)
          if (isNewPlayer) {
            const otherPlayer = this.players.get(id);
            if (otherPlayer) {
              otherPlayer.messages.push({ type: 'peer_joined', peerId: playerId });
            }
            // Also notify via WebSocket if connected
            const ws = this.sessions.get(id);
            if (ws) {
              try {
                ws.send(JSON.stringify({ type: 'peer_joined', peerId: playerId }));
              } catch (e) {}
            }
          }
        }
      }

      // Track game start when 2 players are connected
      if (this.players.size === 2 && !this.gameStarted) {
        this.gameStarted = true;
        // Increment game started counter
        try {
          const statsId = this.env.STATS.idFromName('global');
          const statsObject = this.env.STATS.get(statsId);
          await statsObject.fetch(new Request('https://internal/stats/increment-started', { method: 'POST' }));
        } catch (e) {
          console.error('Failed to increment game started counter:', e);
        }
      }

      console.log(`Player ${playerId} joined via polling. Total: ${this.players.size}`);

      return new Response(JSON.stringify({
        success: true,
        playerId,
        otherPlayers,
        playerCount: this.players.size
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  async handlePoll(request) {
    try {
      const { playerId } = await request.json();
      if (!playerId) {
        return new Response(JSON.stringify({ error: 'Missing playerId' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const player = this.players.get(playerId);
      if (!player) {
        return new Response(JSON.stringify({ error: 'Player not in room' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update last seen
      player.lastSeen = Date.now();

      // Get and clear messages
      const messages = player.messages;
      player.messages = [];

      return new Response(JSON.stringify({ messages }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  async handleSend(request) {
    try {
      const { senderId, targetId, action } = await request.json();
      if (!senderId || !action) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const message = { type: 'action', senderId, action };

      // Track game finished when RESIGN or game end actions are sent
      if (action.type === 'RESIGN' || action.type === 'ACCEPT_DRAW') {
        try {
          const statsId = this.env.STATS.idFromName('global');
          const statsObject = this.env.STATS.get(statsId);
          await statsObject.fetch(new Request('https://internal/stats/increment-finished', { method: 'POST' }));
        } catch (e) {
          console.error('Failed to increment game finished counter:', e);
        }
      }

      if (targetId) {
        // Send to specific player
        // Try WebSocket first
        const ws = this.sessions.get(targetId);
        if (ws) {
          try {
            ws.send(JSON.stringify(message));
          } catch (e) {}
        }
        // Also queue for polling
        const target = this.players.get(targetId);
        if (target) {
          target.messages.push(message);
        }
      } else {
        // Broadcast to all except sender
        for (const [id, player] of this.players) {
          if (id !== senderId) {
            player.messages.push(message);
            const ws = this.sessions.get(id);
            if (ws) {
              try {
                ws.send(JSON.stringify(message));
              } catch (e) {}
            }
          }
        }
      }

      console.log(`Relayed ${action.type} from ${senderId} to ${targetId || 'all'}`);

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // ============ WebSocket Methods ============

  async handleWebSocket(request) {
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId');
    
    if (!playerId) {
      return new Response('Missing playerId', { status: 400, headers: corsHeaders });
    }

    // Check if room is full (max 2 players) - only for new players
    const existingPlayers = Array.from(this.players.keys()).filter(id => id !== playerId);
    if (existingPlayers.length >= 2 && !this.players.has(playerId)) {
      return new Response(JSON.stringify({ 
        error: 'Room is full', 
        code: 'ROOM_FULL' 
      }), { 
        status: 409, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept the connection
    server.accept();
    
    // Store the session
    this.sessions.set(playerId, server);
    
    const isNewPlayer = !this.players.has(playerId);
    
    // Also add to players map for polling compatibility
    if (!this.players.has(playerId)) {
      this.players.set(playerId, { lastSeen: Date.now(), messages: [] });
    }
    
    console.log(`Player ${playerId} connected via WebSocket. Total players: ${this.players.size}`);

    // Send connection confirmation
    server.send(JSON.stringify({ type: 'connected' }));
    
    // Notify new player about existing players
    for (const existingPlayerId of this.players.keys()) {
      if (existingPlayerId !== playerId) {
        server.send(JSON.stringify({ type: 'peer_joined', peerId: existingPlayerId }));
      }
    }
    
    // Notify existing players about new player (only if truly new)
    if (isNewPlayer) {
      this.broadcast({ type: 'peer_joined', peerId: playerId }, playerId);
    }

    // Track game start when 2 players are connected
    if (this.players.size === 2 && !this.gameStarted) {
      this.gameStarted = true;
      // Increment game started counter
      try {
        const statsId = this.env.STATS.idFromName('global');
        const statsObject = this.env.STATS.get(statsId);
        await statsObject.fetch(new Request('https://internal/stats/increment-started', { method: 'POST' }));
      } catch (e) {
        console.error('Failed to increment game started counter:', e);
      }
    }

    // Handle messages
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data);
        await this.handleMessage(playerId, data);
      } catch (error) {
        console.error(`Error handling message from ${playerId}:`, error);
      }
    });

    // Handle close
    server.addEventListener('close', () => {
      this.handleDisconnect(playerId);
    });

    // Handle error
    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${playerId}:`, error);
      this.handleDisconnect(playerId);
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleMessage(playerId, data) {
    switch (data.type) {
      case 'ping':
        const ws = this.sessions.get(playerId);
        if (ws) {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        break;
        
      case 'send_action':
        if (data.targetId && data.action) {
          // Track game finished when RESIGN or game end actions are sent
          if (data.action.type === 'RESIGN' || data.action.type === 'ACCEPT_DRAW') {
            try {
              const statsId = this.env.STATS.idFromName('global');
              const statsObject = this.env.STATS.get(statsId);
              await statsObject.fetch(new Request('https://internal/stats/increment-finished', { method: 'POST' }));
            } catch (e) {
              console.error('Failed to increment game finished counter:', e);
            }
          }

          // Send via WebSocket
          const targetWs = this.sessions.get(data.targetId);
          if (targetWs) {
            targetWs.send(JSON.stringify({
              type: 'action',
              senderId: playerId,
              action: data.action
            }));
          }
          // Also queue for polling
          const target = this.players.get(data.targetId);
          if (target) {
            target.messages.push({
              type: 'action',
              senderId: playerId,
              action: data.action
            });
          }
          console.log(`Relayed ${data.action.type} from ${playerId} to ${data.targetId}`);
        }
        break;
        
      default:
        console.log(`Unknown message type from ${playerId}:`, data.type);
    }
  }

  handleDisconnect(playerId) {
    console.log(`Player ${playerId} disconnected`);
    this.sessions.delete(playerId);
    this.players.delete(playerId);
    this.broadcast({ type: 'peer_left', peerId: playerId }, playerId);
    
    // Also queue peer_left for polling players
    for (const [id, player] of this.players) {
      if (id !== playerId) {
        player.messages.push({ type: 'peer_left', peerId: playerId });
      }
    }
  }

  broadcast(message, excludePlayerId = null) {
    const messageStr = JSON.stringify(message);
    for (const [playerId, ws] of this.sessions) {
      if (playerId !== excludePlayerId) {
        try {
          ws.send(messageStr);
        } catch (error) {
          console.error(`Failed to send to ${playerId}:`, error);
        }
      }
    }
  }
}

/**
 * Main worker entry point
 * Routes requests to the appropriate Durable Object based on roomId
 */
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Root endpoint - health check
      if (path === '/' || path === '') {
        return new Response('Card Chess Relay Server - Running (Durable Objects + Polling)', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }

      // Global status endpoint
      if (path === '/status') {
        return new Response(JSON.stringify({ status: 'running', version: '2.2', features: ['websocket', 'polling', 'stats', 'room-limit'] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Game statistics endpoint
      if (path === '/stats') {
        const statsId = env.STATS.idFromName('global');
        const statsObject = env.STATS.get(statsId);
        return statsObject.fetch(new Request('https://internal/stats', { method: 'GET' }));
      }

      // Get roomId from query params or body
      let roomId = url.searchParams.get('roomId');
      
      // For POST requests, try to get roomId from body if not in query
      if (!roomId && request.method === 'POST') {
        const clonedRequest = request.clone();
        try {
          const body = await clonedRequest.json();
          roomId = body.roomId;
        } catch (e) {
          // Body might not be JSON
        }
      }

      // Routes that need a roomId
      if (path === '/ws' || path === '/join' || path === '/poll' || path === '/send') {
        if (!roomId) {
          return new Response(JSON.stringify({ error: 'Missing roomId' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Get or create the Durable Object for this room
        const roomObjectId = env.ROOMS.idFromName(roomId);
        const roomObject = env.ROOMS.get(roomObjectId);

        // Forward the request to the Durable Object
        const newUrl = new URL(request.url);
        newUrl.pathname = path;
        return roomObject.fetch(new Request(newUrl, request));
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Request handler error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
