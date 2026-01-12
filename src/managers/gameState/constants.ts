/**
 * @fileoverview Game state constants
 *
 * @module managers/gameState/constants
 */

/** Initial clock time in seconds (10 minutes) */
export const INITIAL_CLOCK_SECONDS = 600;

/** Time cost for making a chess move (seconds) */
export const MOVE_TIME_COST = 3;

/** Time cost for mulligan action (seconds) */
export const MULLIGAN_TIME_COST = 10;

/** Stopwatch threshold for opponent draw (seconds) */
export const STOPWATCH_THRESHOLD = 60;

/** Maximum cards allowed in hand */
export const MAX_HAND_SIZE = 7;

/** Number of cards drawn at game start */
export const INITIAL_DRAW_COUNT = 7;
