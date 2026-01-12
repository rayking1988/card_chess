/**
 * @fileoverview Card-specific animations
 *
 * @module managers/animation/CardAnimationManager
 */

import Phaser from 'phaser';
import { ANIM_DURATION, EASING } from './constants';
import type { Position, TweenConfig } from './types';
import { AnimationManager } from './AnimationManager';

/**
 * CardAnimationManager - Extended AnimationManager with card-specific animations
 *
 * Provides animations for:
 * - Deck shuffling (Requirement 13.1)
 * - Card drawing (Requirement 13.2)
 * - Card playing (Requirement 13.3)
 * - Card discarding
 *
 * @example
 * const cardAnim = new CardAnimationManager(scene);
 * cardAnim.animateDrawCard(card, deckPos, handPos);
 *
 * Used by: BoardAnimationManager, GameScene
 */
export class CardAnimationManager extends AnimationManager {
  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  /* ============================================
   * DECK SHUFFLE ANIMATION (Requirement 13.1)
   * ============================================
   */

  /**
   * Animates deck shuffling with card scatter and gather effect
   *
   * Algorithm:
   * 1. Scatter cards outward from deck
   * 2. Gather cards back to deck
   * 3. Bounce deck to indicate completion
   *
   * @param deckContainer - The deck container
   * @param cardSprites - Array of card sprites to animate
   * @param onComplete - Callback when complete
   */
  animateDeckShuffle(
    deckContainer: Phaser.GameObjects.Container,
    cardSprites: Phaser.GameObjects.Image[],
    onComplete?: () => void
  ): void {
    if (cardSprites.length === 0) {
      onComplete?.();
      return;
    }

    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    const centerX = deckContainer.x;
    const centerY = deckContainer.y;

    // Phase 1: Scatter cards outward
    const scatterPromises: Promise<void>[] = [];

    for (let i = 0; i < Math.min(cardSprites.length, 5); i++) {
      const card = cardSprites[i];
      const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.5;
      const distance = 30 + Math.random() * 20;

      const targetX = centerX + Math.cos(angle) * distance;
      const targetY = centerY + Math.sin(angle) * distance;
      const rotation = (Math.random() - 0.5) * 0.5;

      scatterPromises.push(new Promise(resolve => {
        scene.tweens.add({
          targets: card,
          x: targetX,
          y: targetY,
          rotation: rotation,
          duration: ANIM_DURATION.DECK_SHUFFLE / 3,
          ease: EASING.QUAD_OUT,
          delay: i * 30,
          onComplete: () => resolve(),
        });
      }));
    }

    // Phase 2: Gather cards back
    Promise.all(scatterPromises).then(() => {
      const gatherPromises: Promise<void>[] = [];

      for (let i = 0; i < Math.min(cardSprites.length, 5); i++) {
        const card = cardSprites[i];

        gatherPromises.push(new Promise(resolve => {
          scene.tweens.add({
            targets: card,
            x: centerX,
            y: centerY,
            rotation: 0,
            duration: ANIM_DURATION.DECK_SHUFFLE / 3,
            ease: EASING.BACK_OUT,
            delay: i * 20,
            onComplete: () => resolve(),
          });
        }));
      }

      Promise.all(gatherPromises).then(() => {
        // Phase 3: Quick bounce to indicate completion
        scene.tweens.add({
          targets: deckContainer,
          scaleX: 1.1,
          scaleY: 0.9,
          duration: 100,
          yoyo: true,
          onComplete: () => onComplete?.(),
        });
      });
    });
  }

  /**
   * Simple deck shuffle animation (single container bounce)
   *
   * @param deckContainer - The deck container
   * @param onComplete - Callback when complete
   */
  animateDeckShuffleSimple(
    deckContainer: Phaser.GameObjects.Container,
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    scene.tweens.add({
      targets: deckContainer,
      x: deckContainer.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        scene.tweens.add({
          targets: deckContainer,
          scaleX: 1.1,
          scaleY: 0.9,
          duration: 100,
          yoyo: true,
          onComplete: () => onComplete?.(),
        });
      },
    });
  }

  /* ============================================
   * DRAW CARD ANIMATION (Requirement 13.2)
   * ============================================
   */

  /**
   * Animates card moving from deck to hand
   *
   * Uses arc movement with scale up effect.
   *
   * @param cardContainer - The card container
   * @param fromPosition - Starting position (deck)
   * @param toPosition - Ending position (hand)
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween
   */
  animateDrawCard(
    cardContainer: Phaser.GameObjects.Container,
    fromPosition: Position,
    toPosition: Position,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    // Start at deck position
    cardContainer.setPosition(fromPosition.x, fromPosition.y);
    cardContainer.setScale(0.5);
    cardContainer.setAlpha(1);

    // Arc movement to hand with scale up
    const arcHeight = 80;
    const midX = (fromPosition.x + toPosition.x) / 2;
    const midY = Math.min(fromPosition.y, toPosition.y) - arcHeight;

    const duration = config.duration ?? ANIM_DURATION.CARD_DRAW;

    return scene.tweens.add({
      targets: cardContainer,
      x: toPosition.x,
      y: toPosition.y,
      scaleX: config.yoyo ? 0.8 : 0.8,
      scaleY: config.yoyo ? 0.8 : 0.8,
      duration: duration,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onUpdate: (tween) => {
        // Quadratic bezier for arc
        const t = tween.progress;
        const invT = 1 - t;

        const x = invT * invT * fromPosition.x + 2 * invT * t * midX + t * t * toPosition.x;
        const y = invT * invT * fromPosition.y + 2 * invT * t * midY + t * t * toPosition.y;

        cardContainer.setPosition(x, y);
      },
      onComplete: () => {
        cardContainer.setPosition(toPosition.x, toPosition.y);
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Animates multiple cards being drawn in sequence
   *
   * @param cardContainers - Array of card containers
   * @param fromPosition - Starting position (deck)
   * @param toPositions - Array of ending positions
   * @param delayBetween - Delay between each card
   * @param onComplete - Callback when all complete
   */
  animateDrawMultipleCards(
    cardContainers: Phaser.GameObjects.Container[],
    fromPosition: Position,
    toPositions: Position[],
    delayBetween: number = 100,
    onComplete?: () => void
  ): void {
    if (cardContainers.length === 0) {
      onComplete?.();
      return;
    }

    let completed = 0;
    const total = cardContainers.length;

    for (let i = 0; i < cardContainers.length; i++) {
      const card = cardContainers[i];
      const toPos = toPositions[i] || toPositions[toPositions.length - 1];

      this.animateDrawCard(card, fromPosition, toPos, {
        delay: i * delayBetween,
        onComplete: () => {
          completed++;
          if (completed >= total) {
            onComplete?.();
          }
        },
      });
    }
  }

  /* ============================================
   * PLAY CARD ANIMATION (Requirement 13.3)
   * ============================================
   */

  /**
   * Animates card being played from hand to board
   *
   * @param cardContainer - The card container
   * @param toPosition - Target position
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween
   */
  animatePlayCard(
    cardContainer: Phaser.GameObjects.Container,
    toPosition: Position,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    return scene.tweens.add({
      targets: cardContainer,
      x: toPosition.x,
      y: toPosition.y,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: config.duration ?? ANIM_DURATION.CARD_PLAY,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      onComplete: () => {
        // Flash effect then fade out
        scene.tweens.add({
          targets: cardContainer,
          alpha: 0,
          scaleX: 1.5,
          scaleY: 1.5,
          duration: 150,
          ease: EASING.QUAD_OUT,
          onComplete: () => {
            onComplete?.();
            config.onComplete?.();
          },
        });
      },
    });
  }

  /**
   * Animates card being played with targeting arrow
   *
   * @param cardContainer - The card container
   * @param targetPosition - Target position
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animatePlayCardWithTarget(
    cardContainer: Phaser.GameObjects.Container,
    targetPosition: Position,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    // First move card toward target
    scene.tweens.add({
      targets: cardContainer,
      x: (cardContainer.x + targetPosition.x) / 2,
      y: (cardContainer.y + targetPosition.y) / 2,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: (config.duration ?? ANIM_DURATION.CARD_PLAY) / 2,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        // Then fade out toward target
        scene.tweens.add({
          targets: cardContainer,
          x: targetPosition.x,
          y: targetPosition.y,
          alpha: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: (config.duration ?? ANIM_DURATION.CARD_PLAY) / 2,
          ease: EASING.QUAD_OUT,
          onComplete: () => {
            onComplete?.();
            config.onComplete?.();
          },
        });
      },
    });
  }

  /* ============================================
   * DISCARD ANIMATION
   * ============================================
   */

  /**
   * Animates card being discarded
   *
   * @param cardContainer - The card container
   * @param discardPosition - Discard pile position
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween
   */
  animateDiscard(
    cardContainer: Phaser.GameObjects.Container,
    discardPosition: Position,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    return scene.tweens.add({
      targets: cardContainer,
      x: discardPosition.x,
      y: discardPosition.y,
      scaleX: 0.3,
      scaleY: 0.3,
      alpha: 0.5,
      rotation: cardContainer.rotation + (Math.random() - 0.5) * 0.5,
      duration: config.duration ?? ANIM_DURATION.CARD_DISCARD,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Animates card flying off screen (for dramatic discard)
   *
   * @param cardContainer - The card container
   * @param direction - Direction to fly
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween
   */
  animateDiscardFlyOff(
    cardContainer: Phaser.GameObjects.Container,
    direction: 'left' | 'right' | 'up' = 'up',
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    let targetX = cardContainer.x;
    let targetY = cardContainer.y;
    const distance = 500;

    switch (direction) {
      case 'left': targetX -= distance; break;
      case 'right': targetX += distance; break;
      case 'up': targetY -= distance; break;
    }

    return scene.tweens.add({
      targets: cardContainer,
      x: targetX,
      y: targetY,
      alpha: 0,
      rotation: cardContainer.rotation + (direction === 'left' ? -1 : 1) * Math.PI,
      duration: config.duration ?? ANIM_DURATION.CARD_DISCARD * 1.5,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }
}

/**
 * Creates a CardAnimationManager instance
 *
 * @param scene - The Phaser scene
 * @returns New CardAnimationManager
 */
export function createCardAnimationManager(scene: Phaser.Scene): CardAnimationManager {
  return new CardAnimationManager(scene);
}
