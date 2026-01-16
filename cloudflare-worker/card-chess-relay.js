/**
 * Cloudflare Worker for Card Chess P2P Relay
 * 
 * This worker provides a fallback communication mechanism when direct P2P
 * connections fail. It uses WebSockets for real-time bidirectional communication
 * between players.
 * 
 * Features:
 * - Room-based message routing
 * - WebSocket connections for real-time message delivery
 * - Automatic cleanup of inactive rooms
 * - CORS support for web applications
 * - Message queuing for offline players
 * - Rate limiting to prevent abuse
 * 
 * Endpoints:
 * - GET /ws - WebSocket endpoint for real-time communication
 * - POST /send - HTTP fallback for sending messages
 * - POST /heartbeat - Keep connection alive
 * - GET /status - Server status
 * 
 * Deploy to Cloudflare Workers:
 * 1. Create a new worker at workers.cloudflare.com
 * 2. Replace the default code with this script
 * 3. Deploy and note the worker URL
 */

// Room data structure
class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // playerId -> { lastSeen, messageQueue }
    this.connections = new Map(); // playerId -> WebSocket
    this.createdAt = Date.now();
  }

  addPlayer(playerId) {
    if (!this.players.has(playerId)) {
      this.players.set(playerId, {
        lastSeen: Date.now(),
        messageQueue: []
      });
      
      // Notify other players
      this.broadcast({
        type: 'peer_joined',
        peerId: playerId
      }, playerId);
    }
  }

  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      this.players.delete(playerId);
      this.connections.delete(playerId);
      
      // Notify other players
      this.broadcast({
        type: 'peer_left',
        peerId: playerId
      }, playerId);
    }
  }

  updatePlayerActivity(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.lastSeen = Date.now();
    }
  }

  addConnection(playerId, websocket) {
    this.connections.set(playerId, websocket);
    
    // Send queued messages
    const player = this.players.get(playerId);
    if (player && player.messageQueue.length > 0) {
      for (const message of player.messageQueue) {
        this.sendToPlayer(playerId, message);
      }
      player.messageQueue = [];
    }

    // Send connection confirmation
    this.sendToPlayer(playerId, { type: 'connected' });
  }

  removeConnection(playerId) {
    const ws = this.connections.get(playerId);
    if (ws) {
      try {
        ws.close();
      } catch (e) {
        // WebSocket might already be closed
      }
      this.connections.delete(playerId);
    }
  }

  sendToPlayer(playerId, message) {
    const ws = this.connections.get(playerId);
    if (ws) {
      try {
        ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        console.error(`Failed to send message to player ${playerId}:`, error);
        // Remove the failed connection
        this.connections.delete(playerId);
        return false;
      }
    } else {
      // Queue message for offline player
      const player = this.players.get(playerId);
      if (player) {
        player.messageQueue.push(message);
        // Limit queue size to prevent memory issues
        if (player.messageQueue.length > 50) {
          player.messageQueue.shift();
        }
      }
      return false;
    }
  }

  broadcast(message, excludePlayerId = null) {
    for (const [playerId] of this.players) {
      if (playerId !== excludePlayerId) {
        this.sendToPlayer(playerId, message);
      }
    }
  }

  sendMessage(senderId, targetId, action) {
    const message = {
      type: 'action',
      senderId,
      action
    };
    
    if (targetId) {
      this.sendToPlayer(targetId, message);
    } else {
      this.broadcast(message, senderId);
    }
  }

  getPlayerCount() {
    return this.players.size;
  }

  getActivePlayerCount() {
    return this.connections.size;
  }

  isInactive() {
    const now = Date.now();
    const INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    
    // Room is inactive if no players or all players inactive
    if (this.players.size === 0) {
      return true;
    }
    
    for (const [, player] of this.players) {
      if (now - player.lastSeen < INACTIVE_TIMEOUT) {
        return false;
      }
    }
    
    return true;
  }
}

// Rate limiting to prevent abuse
const rateLimits = new Map(); // IP -> { count, resetTime }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per minute per IP

function checkRateLimit(request) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  const now = Date.now();
  const limit = rateLimits.get(clientIP);
  
  if (!limit || now > limit.resetTime) {
    // Reset or create new limit
    rateLimits.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limited
  }
  
  limit.count++;
  return true;
}

// Clean up old rate limit entries periodically
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, limit] of rateLimits) {
    if (now > limit.resetTime) {
      rateLimits.delete(ip);
    }
  }
}

// Global room storage
const rooms = new Map();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight
function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  return null;
}

// Get or create room
function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Room(roomId));
  }
  return rooms.get(roomId);
}

// Clean up inactive rooms
function cleanupRooms() {
  for (const [roomId, room] of rooms) {
    if (room.isInactive()) {
      console.log(`Cleaning up inactive room: ${roomId}`);
      rooms.delete(roomId);
    }
  }
}

// Handle WebSocket upgrade
function handleWebSocket(request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const playerId = url.searchParams.get('playerId');

  if (!roomId || !playerId) {
    return new Response('Missing roomId or playerId', {
      status: 400,
      headers: corsHeaders
    });
  }

  // Create WebSocket pair
  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  // Accept the WebSocket connection
  server.accept();

  const room = getRoom(roomId);
  room.addPlayer(playerId);
  room.updatePlayerActivity(playerId);
  room.addConnection(playerId, server);

  console.log(`Player ${playerId} connected to room ${roomId} via WebSocket`);

  // Handle WebSocket messages
  server.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Update player activity
      room.updatePlayerActivity(playerId);
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
          
        case 'send_action':
          if (data.targetId && data.action) {
            room.sendMessage(playerId, data.targetId, data.action);
          }
          break;
          
        default:
          console.log(`Unknown message type from ${playerId}:`, data.type);
      }
    } catch (error) {
      console.error(`Error handling WebSocket message from ${playerId}:`, error);
    }
  });

  // Handle WebSocket close
  server.addEventListener('close', () => {
    console.log(`Player ${playerId} disconnected from room ${roomId}`);
    room.removeConnection(playerId);
    room.removePlayer(playerId);
  });

  // Handle WebSocket error
  server.addEventListener('error', (error) => {
    console.error(`WebSocket error for player ${playerId}:`, error);
    room.removeConnection(playerId);
    room.removePlayer(playerId);
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

// Handle send message request (HTTP fallback)
async function handleSend(request) {
  try {
    const { roomId, senderId, targetId, action } = await request.json();
    
    if (!roomId || !senderId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    room.updatePlayerActivity(senderId);
    room.sendMessage(senderId, targetId, action);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle heartbeat request
async function handleHeartbeat(request) {
  try {
    const { roomId, playerId } = await request.json();
    
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: 'Missing roomId or playerId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = rooms.get(roomId);
    if (room) {
      room.updatePlayerActivity(playerId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Handle status request
function handleStatus() {
  const stats = {
    totalRooms: rooms.size,
    rooms: []
  };

  for (const [roomId, room] of rooms) {
    stats.rooms.push({
      roomId,
      playerCount: room.getPlayerCount(),
      activeConnections: room.getActivePlayerCount(),
      createdAt: room.createdAt
    });
  }

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Main request handler
export default {
  async fetch(request, env, ctx) {
    // Check rate limiting first
    if (!checkRateLimit(request)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    // Clean up rooms and rate limits periodically (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRooms();
      cleanupRateLimits();
    }

    try {
      switch (path) {
        case '/ws':
          if (request.headers.get('Upgrade') === 'websocket') {
            return handleWebSocket(request);
          }
          break;

        case '/send':
          if (request.method === 'POST') {
            return await handleSend(request);
          }
          break;

        case '/heartbeat':
          if (request.method === 'POST') {
            return await handleHeartbeat(request);
          }
          break;

        case '/status':
          if (request.method === 'GET') {
            return handleStatus();
          }
          break;

        case '/':
          return new Response('Card Chess Relay Server - Running (WebSocket)', {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });

        default:
          return new Response('Not Found', {
            status: 404,
            headers: corsHeaders
          });
      }
    } catch (error) {
      console.error('Request handler error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', {
      status: 405,
      headers: corsHeaders
    });
  }
};