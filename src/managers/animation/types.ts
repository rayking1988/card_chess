/**
 * @fileoverview Shared animation types
 *
 * @module managers/animation/types
 */

import type Phaser from 'phaser';

/**
 * Animation configuration for tweens
 *
 * @property duration - Animation duration in ms
 * @property ease - Easing function name
 * @property delay - Delay before starting
 * @property yoyo - Whether to reverse animation
 * @property repeat - Number of repeats (-1 for infinite)
 * @property onComplete - Callback when animation completes
 * @property onStart - Callback when animation starts
 * @property onUpdate - Callback on each frame
 */
export interface TweenConfig {
  duration?: number;
  ease?: string;
  delay?: number;
  yoyo?: boolean;
  repeat?: number;
  onComplete?: () => void;
  onStart?: () => void;
  onUpdate?: (tween: Phaser.Tweens.Tween) => void;
}

/**
 * Position interface for animations
 *
 * @property x - X coordinate
 * @property y - Y coordinate
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Card animation configuration
 *
 * @property deckPosition - Position of the deck
 * @property handPosition - Position of the hand
 * @property playZonePosition - Position of the play zone
 * @property discardPosition - Position of the discard pile
 */
export interface CardAnimationConfig {
  deckPosition: Position;
  handPosition: Position;
  playZonePosition: Position;
  discardPosition: Position;
}

/**
 * Board animation configuration
 *
 * @property squareSize - Size of each chess square
 * @property boardX - Board left edge X
 * @property boardY - Board top edge Y
 * @property isFlipped - Whether board is flipped
 */
export interface BoardAnimationConfig {
  squareSize: number;
  boardX: number;
  boardY: number;
  isFlipped: boolean;
}
