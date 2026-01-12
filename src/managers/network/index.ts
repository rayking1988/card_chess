/**
 * @fileoverview Network manager module exports
 *
 * @module managers/network
 */

export { NetworkManager } from './NetworkManager';
export type { GameAction, EventLogEntry, ConnectionState, NetworkCallbacks } from './types';
export {
  DEFAULT_APP_ID,
  RECONNECT_TIMEOUT_MS,
  PEER_TIMEOUT_MS,
  PING_INTERVAL_MS
} from './constants';
