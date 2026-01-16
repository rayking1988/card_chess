/**
 * Cloudflare Worker for Card Chess P2P Relay
 * 
 * This worker provides a fallback communication mechanism when direct P2P
 * connections fail. It acts as a relay server to transmit game actions
 * between players using Server-Sent Events (SSE) and HTTP POST requests.
 * 
 * Features:
 * - Room-based message routing
 * - Server-Sent Events for real-time message delivery
 * - Automatic cleanup of inactive rooms
 * - CORS support for web applications
 * - Message queuing for offline players
 * 
 * Endpoints:
 * - POST /join - Join a room
 * - GET /listen - SSE endpoint for receiving messages
 * - POST /send - Send a message to a peer
 * - POST /heartbeat - Keep connection alive
 * 
 * Deploy to Cloudflare Workers:
 * 1. Create a new worker at workers.cloudflare.com
 * 2. Replace the default code with this script
 * 3. Deploy and note the worker URL
 * 4. Update RELAY_WORKER_ENDPOINT in constants.ts
 */

// Room data structure
class Room {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // playerId -> { lastSeen, messageQueue }
    this.connections = new Map(); // playerId -> WritableStream for SSE
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

  addConnection(playerId, stream) {
    this.connections.set(playerId, stream);
    
    // Send queued messages
    const player = this.players.get(playerId);
    if (player && player.messageQueue.length > 0) {
      for (const message of player.messageQueue) {
        this.sendToPlayer(playerId, message);
      }
      player.messageQueue = [];
    }
  }

  removeConnection(playerId) {
    this.connections.delete(playerId);
  }

  sendToPlayer(playerId, message) {
    const stream = this.connections.get(playerId);
    if (stream) {
      try {
        const encoder = new TextEncoder();
        const data = `data: ${JSON.stringify(message)}\n\n`;
        stream.write(encoder.encode(data));
        return true;
      } catch (error) {
        console.error('Failed to send message to player:', error);
        this.connections.delete(playerId);
        return false;
      }
    } else {
      // Queue message for offline player
      const player = this.players.get(playerId);
      if (player) {
        player.messageQueue.push(message);
        // Limit queue size
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

// Handle join room request
async function handleJoin(request) {
  try {
    const { roomId, playerId } = await request.json();
    
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: 'Missing roomId or playerId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = getRoom(roomId);
    room.addPlayer(playerId);
    room.updatePlayerActivity(playerId);

    return new Response(JSON.stringify({ 
      success: true,
      playerCount: room.getPlayerCount()
    }), {
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

// Handle SSE listen request
async function handleListen(request) {
  const url = new URL(request.url);
  const roomId = url.searchParams.get('roomId');
  const playerId = url.searchParams.get('playerId');

  if (!roomId || !playerId) {
    return new Response('Missing roomId or playerId', {
      status: 400,
      headers: corsHeaders
    });
  }

  const room = getRoom(roomId);
  room.addPlayer(playerId);
  room.updatePlayerActivity(playerId);

  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Set up SSE headers
  const headers = {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  };

  // Send initial connection message
  writer.write(encoder.encode('data: {"type":"connected"}\n\n'));

  // Add connection to room
  room.addConnection(playerId, writer);

  // Handle client disconnect
  request.signal?.addEventListener('abort', () => {
    room.removeConnection(playerId);
    writer.close();
  });

  return new Response(readable, {
    status: 200,
    headers
  });
}

// Handle send message request
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
    // Handle CORS preflight
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    // Clean up rooms periodically
    if (Math.random() < 0.01) { // 1% chance per request
      cleanupRooms();
    }

    try {
      switch (path) {
        case '/join':
          if (request.method === 'POST') {
            return await handleJoin(request);
          }
          break;

        case '/listen':
          if (request.method === 'GET') {
            return await handleListen(request);
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
          return new Response('Card Chess Relay Server - Running', {
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