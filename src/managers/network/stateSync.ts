/**
 * @fileoverview State sync helpers for NetworkManager
 *
 * @module managers/network/stateSync
 */

import type { GameState } from '../GameStateManager';
import type { EventLogEntry } from './types';

/**
 * Checks if two game states are in sync
 *
 * Compares key state properties to detect desync.
 *
 * @param state1 - First game state
 * @param state2 - Second game state
 * @returns True if states match
 */
export function areStatesInSync(state1: GameState, state2: GameState): boolean {
  // Compare phase and turn info
  if (state1.phase !== state2.phase) return false;
  if (state1.currentTurn !== state2.currentTurn) return false;
  if (state1.turnNumber !== state2.turnNumber) return false;
  if (state1.boardFEN !== state2.boardFEN) return false;

  // Compare player states
  for (const color of ['white', 'black'] as const) {
    const p1 = state1.players[color];
    const p2 = state2.players[color];

    if (p1.clock !== p2.clock) return false;
    if (p1.energy !== p2.energy) return false;
    if (p1.energyCap !== p2.energyCap) return false;
    if (p1.disturbTags !== p2.disturbTags) return false;
    if (p1.hand.length !== p2.hand.length) return false;
    if (p1.deck.length !== p2.deck.length) return false;
  }

  return true;
}

/**
 * Generates a simple hash of game state for quick comparison
 *
 * @param state - Game state to hash
 * @returns String hash of key state properties
 */
export function hashState(state: GameState): string {
  const key = [
    state.phase,
    state.currentTurn,
    state.turnNumber,
    state.boardFEN,
    state.players.white.clock,
    state.players.white.energy,
    state.players.white.hand.length,
    state.players.black.clock,
    state.players.black.energy,
    state.players.black.hand.length
  ].join('|');

  return key;
}

/**
 * Merges event logs from two sources, removing duplicates
 *
 * Algorithm:
 * 1. Add all local entries to a Map (keyed by ID)
 * 2. Add remote entries that don't exist locally
 * 3. Sort merged entries by timestamp
 *
 * @param local - Local event log entries
 * @param remote - Remote event log entries
 * @returns Merged and sorted entries
 */
export function mergeEventLogs(local: EventLogEntry[], remote: EventLogEntry[]): EventLogEntry[] {
  const merged = new Map<string, EventLogEntry>();

  // Add all local entries
  for (const entry of local) {
    merged.set(entry.id, entry);
  }

  // Add remote entries (won't overwrite existing)
  for (const entry of remote) {
    if (!merged.has(entry.id)) {
      merged.set(entry.id, entry);
    }
  }

  // Sort by timestamp
  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Detects desync between local and remote state
 *
 * @param localState - Local game state
 * @param remoteState - Remote game state
 * @returns True if states are out of sync
 */
export function detectDesync(localState: GameState, remoteState: GameState): boolean {
  return !areStatesInSync(localState, remoteState);
}

/**
 * Chooses which state to keep during desync recovery
 *
 * @param isHost - Whether this client is the host
 * @param localState - Local game state
 * @param hostState - Host's authoritative state
 * @returns The state to use
 */
export function recoverFromDesync(
  isHost: boolean,
  localState: GameState,
  hostState: GameState
): GameState {
  return isHost ? localState : hostState;
}
