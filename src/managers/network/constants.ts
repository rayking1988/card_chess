/**
 * @fileoverview Network manager constants
 *
 * @module managers/network/constants
 */

/** Default application ID for Trystero room isolation */
export const DEFAULT_APP_ID = 'card-chess-game-v1';

/** Timeout for reconnection attempts (ms) */
export const RECONNECT_TIMEOUT_MS = 30000;

/** Timeout for peer inactivity before considering disconnected (ms) */
export const PEER_TIMEOUT_MS = 60000;

/** Interval between keep-alive pings (ms) - 10s for turn-based game */
export const PING_INTERVAL_MS = 10000;

/**
 * WebSocket Secure (wss://) BitTorrent trackers for HTTPS compatibility
 *
 * Using multiple trackers increases connection speed and reliability.
 * All trackers use WSS for compatibility with HTTPS deployments
 * (e.g., GitHub Pages).
 */
export const WSS_TRACKERS = [
  'wss://tracker.openwebtorrent.com',
  'wss://tracker.btorrent.xyz',
  'wss://tracker.webtorrent.dev'
];

/**
 * Default WebRTC configuration with public STUN servers only
 * STUN servers help establish direct P2P connections through NAT
 * No TURN servers are used - fallback to Cloudflare Worker if P2P fails
 */
export const DEFAULT_RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' }
  ],
  iceCandidatePoolSize: 10
};

/**
 * Cloudflare Worker endpoint for fetching STUN server info
 * Returns STUN servers from Twilio (TURN servers will be filtered out)
 */
export const STUN_SERVER_ENDPOINT = 'https://cold-scene-fe82.rayking1988.workers.dev';

/** Timeout for STUN server fetch (ms) */
export const STUN_FETCH_TIMEOUT_MS = 5000;

/**
 * Cloudflare Worker endpoint for data relay when P2P fails
 * Used as fallback when direct P2P and STUN cannot establish connection
 * 
 * IMPORTANT: Replace this with your actual deployed worker URL
 */
export const RELAY_WORKER_ENDPOINT = 'https://your-relay-worker.your-subdomain.workers.dev';
