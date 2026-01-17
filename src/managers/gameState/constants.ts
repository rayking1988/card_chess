/**
 * @fileoverview Game state constants
 * 
 * Re-exports game rule constants from the centralized config.
 * This file maintains backward compatibility with existing imports.
 *
 * @module managers/gameState/constants
 */

import { CLOCK, STOPWATCH, CARDS } from '../../config';

/** Initial clock time in seconds (10 minutes) */
export const INITIAL_CLOCK_SECONDS = CLOCK.INITIAL_SECONDS;

/** Time cost for making a chess move (seconds) */
export const MOVE_TIME_COST = CLOCK.MOVE_TIME_COST;

/** Time cost for mulligan action (seconds) */
export const MULLIGAN_TIME_BASE_COST = CLOCK.MULLIGAN_TIME_BASE_COST;

/** Stopwatch threshold for opponent draw (seconds) */
export const STOPWATCH_THRESHOLD = STOPWATCH.THRESHOLD_SECONDS;

/** Maximum cards allowed in hand */
export const MAX_HAND_SIZE = CARDS.MAX_HAND_SIZE;

/** Number of cards drawn at game start */
export const INITIAL_DRAW_COUNT = CARDS.INITIAL_DRAW_COUNT;
