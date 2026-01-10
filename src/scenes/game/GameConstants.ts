/**
 * @fileoverview Constants for GameScene layout and configuration
 * 
 * Base sizes designed for 1920x1080 reference resolution.
 * All values are scaled proportionally for other resolutions.
 * 
 * @module scenes/game/GameConstants
 */

/** Base chess board size (8 squares * 64 pixels) */
export const BASE_BOARD_SIZE = 512;

/** Base width of left panel (deck/discard piles) */
export const BASE_LEFT_PANEL_WIDTH = 150;

/** Base width of right panel (clocks, energy, toggles) */
export const BASE_RIGHT_PANEL_WIDTH = 210;

/** Base height of top zone (opponent hand area) */
export const BASE_TOP_ZONE_HEIGHT = 100;

/** Base height of bottom zone (player hand area) */
export const BASE_BOTTOM_ZONE_HEIGHT = 210;

/** Base padding between UI elements */
export const BASE_PADDING = 16;

/** Maximum cards allowed in hand (Requirement 3.6) */
export const MAX_HAND_SIZE = 7;

/** Maximum visual layers for deck/discard pile stacking effect */
export const MAX_PILE_LAYERS = 6;

/** Reference width for UI scaling calculations */
export const REF_WIDTH = 1920;

/** Reference height for UI scaling calculations */
export const REF_HEIGHT = 1080;
