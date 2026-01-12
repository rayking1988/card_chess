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
