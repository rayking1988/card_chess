/**
 * @fileoverview Configuration module exports
 * 
 * Re-exports all configuration constants from the centralized constants file.
 * Import from this module to access game configuration values.
 * 
 * @example
 * import { CLOCK, ENERGY, BOARD_COLORS } from '../config';
 * 
 * const initialTime = CLOCK.INITIAL_SECONDS;
 * const lightSquare = BOARD_COLORS.LIGHT_SQUARE;
 * 
 * @module config
 */

export * from './constants';
