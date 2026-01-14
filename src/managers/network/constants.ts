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

/** Interval between keep-alive pings (ms) */
export const PING_INTERVAL_MS = 5000;

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
 * Default WebRTC configuration with public STUN servers
 * STUN servers help establish P2P connections through NAT
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
