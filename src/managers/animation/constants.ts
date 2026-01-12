/**
 * @fileoverview Animation timing and easing constants
 *
 * @module managers/animation/constants
 */

/**
 * Animation duration constants (milliseconds)
 */
export const ANIM_DURATION = {
  /** Card draw animation duration */
  CARD_DRAW: 400,
  /** Card play animation duration */
  CARD_PLAY: 300,
  /** Card discard animation duration */
  CARD_DISCARD: 250,
  /** Deck shuffle animation duration */
  DECK_SHUFFLE: 600,
  /** Piece move animation duration */
  PIECE_MOVE: 350,
  /** Piece deploy animation duration */
  PIECE_DEPLOY: 400,
  /** Piece destroy animation duration */
  PIECE_DESTROY: 350,
  /** Clock change animation duration */
  CLOCK_CHANGE: 200,
  /** Energy change animation duration */
  ENERGY_CHANGE: 250,
  /** Victory reveal animation duration */
  VICTORY_REVEAL: 800,
  /** Flash effect duration */
  FLASH: 150,
  /** Bounce effect duration */
  BOUNCE: 200,
  /** Shake effect duration */
  SHAKE: 100,
};

/**
 * Phaser easing function names for different animation feels
 */
export const EASING = {
  /** Smooth sine wave easing */
  SMOOTH: 'Sine.easeInOut',
  /** Bouncy ending */
  BOUNCE_OUT: 'Bounce.easeOut',
  /** Overshoot then settle */
  BACK_OUT: 'Back.easeOut',
  /** Springy ending */
  ELASTIC_OUT: 'Elastic.easeOut',
  /** Quadratic ease out */
  QUAD_OUT: 'Quad.easeOut',
  /** Cubic ease out */
  CUBIC_OUT: 'Cubic.easeOut',
  /** Exponential ease out */
  EXPO_OUT: 'Expo.easeOut',
};
