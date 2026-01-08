/**
 * Property-based tests for NetworkManager
 * Uses fast-check for property testing
 * 
 * Feature: card-chess
 * Property 8: P2P State Synchronization
 * 
 * **Validates: Requirements 12.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NetworkManager, EventLogEntry } from './NetworkManager';
import { GameState, PlayerState, Card, createInitialGameState } from './GameStateManager';

/**
 * Arbitrary generator for PlayerState
 */
const playerStateArb = (): fc.Arbitrary<PlayerState> => {
  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    clock: fc.integer({ min: 0, max: 600 }),
    stopwatch: fc.integer({ min: 0, max: 120 }),
    energy: fc.integer({ min: 0, max: 20 }),
    energyCap: fc.integer({ min: 0, max: 20 }),
    disturbTags: fc.integer({ min: 0, max: 50 }),
    mode: fc.constantFrom('focus' as const, 'disturb' as const),
    energyPlayedThisTurn: fc.boolean(),
    hasPlayedCardThisTurn: fc.boolean(),
    deployedPiecesThisTurn: fc.array(fc.constantFrom('a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8'), { minLength: 0, maxLength: 3 }),
    deck: fc.constant([] as Card[]),
    hand: fc.constant([] as Card[]),
    discard: fc.constant([] as Card[])
  }).map(state => {
    // Ensure energy <= energyCap
    return {
      ...state,
      energy: Math.min(state.energy, state.energyCap)
    };
  });
};

/**
 * Arbitrary generator for GameState
 */
const gameStateArb = (): fc.Arbitrary<GameState> => {
  return fc.record({
    phase: fc.constantFrom('mulligan' as const, 'playing' as const, 'ended' as const),
    currentTurn: fc.constantFrom('white' as const, 'black' as const),
    localPlayer: fc.constantFrom('white' as const, 'black' as const),
    turnNumber: fc.integer({ min: 1, max: 100 }),
    boardFEN: fc.constant('4k3/8/8/8/8/8/8/4K3 w - - 0 1'), // Use valid FEN
    players: fc.record({
      white: playerStateArb(),
      black: playerStateArb()
    })
  });
};

/**
 * Arbitrary generator for EventLogEntry
 */
const eventLogEntryArb = (): fc.Arbitrary<EventLogEntry> => {
  return fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 0, max: Date.now() }),
    player: fc.constantFrom('white' as const, 'black' as const, 'system' as const),
    message: fc.string({ minLength: 1, maxLength: 100 })
  });
};

/**
 * Property 8: P2P State Synchronization
 * For any game action sent via Trystero, both players SHALL have identical 
 * game state after processing.
 * 
 * **Validates: Requirements 12.4**
 */
describe('Property 8: P2P State Synchronization', () => {
  
  it('areStatesInSync returns true for identical states', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        (state) => {
          // Create a deep copy
          const stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
          
          // Identical states should be in sync
          expect(NetworkManager.areStatesInSync(state, stateCopy)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('areStatesInSync detects phase differences', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        fc.constantFrom('mulligan' as const, 'playing' as const, 'ended' as const),
        (state, newPhase) => {
          const stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
          
          if (stateCopy.phase !== newPhase) {
            stateCopy.phase = newPhase;
            expect(NetworkManager.areStatesInSync(state, stateCopy)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('areStatesInSync detects turn differences', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        (state) => {
          const stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
          
          // Flip the turn
          stateCopy.currentTurn = state.currentTurn === 'white' ? 'black' : 'white';
          
          expect(NetworkManager.areStatesInSync(state, stateCopy)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('areStatesInSync detects clock differences', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        fc.constantFrom('white' as const, 'black' as const),
        fc.integer({ min: 1, max: 100 }),
        (state, player, clockDiff) => {
          const stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
          
          // Modify clock
          stateCopy.players[player].clock += clockDiff;
          
          expect(NetworkManager.areStatesInSync(state, stateCopy)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('areStatesInSync detects energy differences', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        fc.constantFrom('white' as const, 'black' as const),
        fc.integer({ min: 1, max: 10 }),
        (state, player, energyDiff) => {
          const stateCopy = JSON.parse(JSON.stringify(state)) as GameState;
          
          // Modify energy (ensure it stays within cap)
          const newEnergy = Math.min(
            stateCopy.players[player].energyCap,
            stateCopy.players[player].energy + energyDiff
          );
          
          if (newEnergy !== state.players[player].energy) {
            stateCopy.players[player].energy = newEnergy;
            expect(NetworkManager.areStatesInSync(state, stateCopy)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hashState produces consistent hashes for identical states', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        (state) => {
          const hash1 = NetworkManager.hashState(state);
          const hash2 = NetworkManager.hashState(state);
          
          expect(hash1).toBe(hash2);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('hashState produces different hashes for different states', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        gameStateArb(),
        (state1, state2) => {
          const hash1 = NetworkManager.hashState(state1);
          const hash2 = NetworkManager.hashState(state2);
          
          // If states are different in key properties, hashes should differ
          if (!NetworkManager.areStatesInSync(state1, state2)) {
            expect(hash1).not.toBe(hash2);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mergeEventLogs preserves all unique entries', () => {
    fc.assert(
      fc.property(
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        (local, remote) => {
          const merged = NetworkManager.mergeEventLogs(local, remote);
          
          // All unique IDs from both arrays should be in merged
          const localIds = new Set(local.map(e => e.id));
          const remoteIds = new Set(remote.map(e => e.id));
          const mergedIds = new Set(merged.map(e => e.id));
          
          // All local entries should be present
          for (const id of localIds) {
            expect(mergedIds.has(id)).toBe(true);
          }
          
          // All remote entries should be present
          for (const id of remoteIds) {
            expect(mergedIds.has(id)).toBe(true);
          }
          
          // No duplicates in merged
          expect(mergedIds.size).toBe(merged.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mergeEventLogs maintains chronological order', () => {
    fc.assert(
      fc.property(
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        (local, remote) => {
          const merged = NetworkManager.mergeEventLogs(local, remote);
          
          // Check that entries are sorted by timestamp
          for (let i = 1; i < merged.length; i++) {
            expect(merged[i].timestamp).toBeGreaterThanOrEqual(merged[i - 1].timestamp);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mergeEventLogs is idempotent', () => {
    fc.assert(
      fc.property(
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        (local, remote) => {
          const merged1 = NetworkManager.mergeEventLogs(local, remote);
          const merged2 = NetworkManager.mergeEventLogs(merged1, remote);
          const merged3 = NetworkManager.mergeEventLogs(local, merged1);
          
          // Merging again should produce same result
          expect(merged2.length).toBe(merged1.length);
          expect(merged3.length).toBe(merged1.length);
          
          // Same IDs
          const ids1 = merged1.map(e => e.id).sort();
          const ids2 = merged2.map(e => e.id).sort();
          const ids3 = merged3.map(e => e.id).sort();
          
          expect(ids2).toEqual(ids1);
          expect(ids3).toEqual(ids1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mergeEventLogs is commutative', () => {
    fc.assert(
      fc.property(
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        fc.array(eventLogEntryArb(), { minLength: 0, maxLength: 20 }),
        (local, remote) => {
          const merged1 = NetworkManager.mergeEventLogs(local, remote);
          const merged2 = NetworkManager.mergeEventLogs(remote, local);
          
          // Order of arguments shouldn't matter for final result
          expect(merged1.length).toBe(merged2.length);
          
          // Same IDs (order may differ due to timestamp ties)
          const ids1 = merged1.map(e => e.id).sort();
          const ids2 = merged2.map(e => e.id).sort();
          
          expect(ids2).toEqual(ids1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('state sync round-trip preserves state integrity', () => {
    fc.assert(
      fc.property(
        gameStateArb(),
        (originalState) => {
          // Simulate serialization/deserialization (as would happen over network)
          const serialized = JSON.stringify(originalState);
          const deserialized = JSON.parse(serialized) as GameState;
          
          // States should be in sync after round-trip
          expect(NetworkManager.areStatesInSync(originalState, deserialized)).toBe(true);
          
          // Hashes should match
          expect(NetworkManager.hashState(originalState)).toBe(NetworkManager.hashState(deserialized));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('initial game states are in sync for both players', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (whiteName, blackName) => {
          // Create initial states for both players
          const whiteState = createInitialGameState('white', whiteName, blackName);
          const blackState = createInitialGameState('black', whiteName, blackName);
          
          // The only difference should be localPlayer
          // For sync comparison, we check the game state properties
          expect(whiteState.phase).toBe(blackState.phase);
          expect(whiteState.currentTurn).toBe(blackState.currentTurn);
          expect(whiteState.turnNumber).toBe(blackState.turnNumber);
          expect(whiteState.boardFEN).toBe(blackState.boardFEN);
          
          // Player states should be identical
          expect(whiteState.players.white.clock).toBe(blackState.players.white.clock);
          expect(whiteState.players.black.clock).toBe(blackState.players.black.clock);
        }
      ),
      { numRuns: 100 }
    );
  });
});
