/**
 * @fileoverview Game state factory helpers
 *
 * @module managers/gameState/factory
 */

import { INITIAL_CLOCK_SECONDS } from './constants';
import type { GameState, PlayerColor, PlayerState } from './types';

/**
 * Creates a new empty player state
 *
 * @param name - Player display name
 * @returns Fresh PlayerState with default values
 */
function createPlayerState(name: string): PlayerState {
  return {
    name,
    clock: INITIAL_CLOCK_SECONDS,
    stopwatch: 0,
    energy: 0,
    energyCap: 0,
    disturbTags: 0,
    mode: 'focus',
    energyPlayedThisTurn: false,
    hasPlayedCardThisTurn: false,
    deployedPiecesThisTurn: [],
    deck: [],
    hand: [],
    discard: []
  };
}

/**
 * Creates initial game state for a new game
 *
 * Board starts with only two kings:
 * - White King on e1
 * - Black King on e8
 *
 * @param localPlayer - Which color local player controls
 * @param whiteName - White player's display name
 * @param blackName - Black player's display name
 * @returns Initial GameState
 */
export function createInitialGameState(
  localPlayer: PlayerColor,
  whiteName: string,
  blackName: string
): GameState {
  return {
    phase: 'mulligan',
    currentTurn: 'white',
    localPlayer,
    turnNumber: 1,
    // Starting position: only two kings (White King e1, Black King e8)
    boardFEN: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
    players: {
      white: createPlayerState(whiteName),
      black: createPlayerState(blackName)
    }
  };
}
