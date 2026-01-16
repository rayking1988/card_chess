/**
 * Simple Cloudflare Worker for Card Chess P2P Relay
 * 
 * This is a simpler version that uses polling instead of WebSockets.
 * It doesn't require Durable Objects but has higher latency.
 * 
 * For production use, consider using the Durable Objects version.
 * 
 * Endpoints:
 * - POST /join - Join a room
 * - POST /poll - Poll for messages
 * - POST /send - Send a message
 * - GET /status - Server status
 */

// In-memory storage (note: this is per-worker-instance, not shared!)
// For a simple demo, this works if both players hit the same instance
// For production, use Durable Objects or KV storage
const rooms = new Map();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  return null;
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      players: new Map(), // playerId -> { lastSeen, messages: [] }
      createdAt: Date.now()
    });
  }
  return rooms.get(roomId);
}

// Clean up old rooms and inactive players
function cleanup() {
  const now = Date.now();
  const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes
  const PLAYER_TIMEOUT = 60 * 1000; // 1 minute
  
  for (const [roomId, room] of rooms) {
    // Remove inactive players
    for (const [playerId, player] of room.players) {
      if (now - player.lastSeen > PLAYER_TIMEOUT) {
        room.players.delete(playerId);
      }
    }
    // Remove empty rooms
    if (room.players.size === 0 && now - room.createdAt > ROOM_TIMEOUT) {
      rooms.delete(roomId);
    }
  }
}

async function handleJoin(request) {
  try {
    const { roomId, playerId } = await request.json();
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: 'Missing roomId or playerId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = getRoom(roomId);
    const isNewPlayer = !room.players.has(playerId);
    
    room.players.set(playerId, {
      lastSeen: Date.now(),
      messages: []
    });

    // Get list of other players
    const otherPlayers = [];
    for (const [id] of room.players) {
      if (id !== playerId) {
        otherPlayers.push(id);
        // Notify other player about this player joining
        const otherPlayer = room.players.get(id);
        if (otherPlayer && isNewPlayer) {
          otherPlayer.messages.push({ type: 'peer_joined', peerId: playerId });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      playerId,
      otherPlayers,
      playerCount: room.players.size
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handlePoll(request) {
  try {
    const { roomId, playerId } = await request.json();
    if (!roomId || !playerId) {
      return new Response(JSON.stringify({ error: 'Missing roomId or playerId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const player = room.players.get(playerId);
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

async function handleSend(request) {
  try {
    const { roomId, senderId, targetId, action } = await request.json();
    if (!roomId || !senderId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return new Response(JSON.stringify({ error: 'Room not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = { type: 'action', senderId, action };

    if (targetId) {
      // Send to specific player
      const target = room.players.get(targetId);
      if (target) {
        target.messages.push(message);
      }
    } else {
      // Broadcast to all except sender
      for (const [id, player] of room.players) {
        if (id !== senderId) {
          player.messages.push(message);
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    const corsResponse = handleCORS(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    // Cleanup occasionally
    if (Math.random() < 0.01) cleanup();

    try {
      switch (path) {
        case '/':
          return new Response('Card Chess Relay Server - Running (Simple/Polling)', {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });

        case '/join':
          if (request.method === 'POST') return await handleJoin(request);
          break;

        case '/poll':
          if (request.method === 'POST') return await handlePoll(request);
          break;

        case '/send':
          if (request.method === 'POST') return await handleSend(request);
          break;

        case '/status':
          const stats = { totalRooms: rooms.size, rooms: [] };
          for (const [roomId, room] of rooms) {
            stats.rooms.push({
              roomId,
              playerCount: room.players.size,
              players: Array.from(room.players.keys())
            });
          }
          return new Response(JSON.stringify(stats), {
            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
    } catch (error) {
      console.error('Error:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }
};
