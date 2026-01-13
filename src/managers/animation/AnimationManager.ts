/**
 * @fileoverview Base animation manager with core tween helpers
 *
 * @module managers/animation/AnimationManager
 */

import Phaser from 'phaser';
import { ANIM_DURATION, EASING } from './constants';
import type { Position, TweenConfig } from './types';

/**
 * AnimationManager - Provides tween helpers for common game animations
 *
 * Base class with core animation functionality:
 * - Movement, scaling, fading, rotation
 * - Effect animations (shake, bounce, pulse, flash)
 * - Compound animations (arc movement, fly away)
 * - Animation chaining and parallel execution
 *
 * @example
 * const anim = new AnimationManager(scene);
 * anim.moveTo(sprite, 100, 200, { duration: 500 });
 * anim.bounce(sprite);
 *
 * Used by: CardAnimationManager, BoardAnimationManager, GameAnimationManager
 */
export class AnimationManager {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;

  /** Set of currently active tweens */
  private activeTweens: Set<Phaser.Tweens.Tween> = new Set();

  /**
   * Creates a new AnimationManager
   *
   * @param scene - The Phaser scene
   */
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /* ============================================
   * CORE TWEEN HELPERS
   * ============================================
   */

  /**
   * Moves a game object from current position to target
   *
   * @param target - Object to move
   * @param toX - Target X coordinate
   * @param toY - Target Y coordinate
   * @param config - Animation configuration
   * @returns The created tween
   */
  moveTo(
    target: Phaser.GameObjects.GameObject,
    toX: number,
    toY: number,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      x: toX,
      y: toY,
      duration: config.duration ?? ANIM_DURATION.PIECE_MOVE,
      ease: config.ease ?? EASING.SMOOTH,
      delay: config.delay ?? 0,
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
      onUpdate: config.onUpdate,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Scales a game object
   *
   * @param target - Object to scale
   * @param scale - Target scale
   * @param config - Animation configuration
   * @returns The created tween
   */
  scaleTo(
    target: Phaser.GameObjects.GameObject,
    scale: number,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: scale,
      scaleY: scale,
      duration: config.duration ?? ANIM_DURATION.BOUNCE,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Fades a game object in or out
   *
   * @param target - Object to fade
   * @param alpha - Target alpha (0-1)
   * @param config - Animation configuration
   * @returns The created tween
   */
  fadeTo(
    target: Phaser.GameObjects.GameObject,
    alpha: number,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      alpha: alpha,
      duration: config.duration ?? ANIM_DURATION.FLASH,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Rotates a game object
   *
   * @param target - Object to rotate
   * @param angle - Target angle in radians
   * @param config - Animation configuration
   * @returns The created tween
   */
  rotateTo(
    target: Phaser.GameObjects.GameObject,
    angle: number,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      rotation: angle,
      duration: config.duration ?? ANIM_DURATION.CARD_PLAY,
      ease: config.ease ?? EASING.SMOOTH,
      delay: config.delay ?? 0,
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /* ============================================
   * EFFECT ANIMATIONS
   * ============================================
   */

  /**
   * Shake effect for invalid actions or damage
   *
   * @param target - Object to shake
   * @param intensity - Shake intensity in pixels
   * @param config - Animation configuration
   * @returns The created tween
   */
  shake(
    target: Phaser.GameObjects.GameObject,
    intensity: number = 5,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const container = target as Phaser.GameObjects.Container;
    const originalX = container.x;

    const tween = this.scene.tweens.add({
      targets: target,
      x: originalX + intensity,
      duration: config.duration ?? ANIM_DURATION.SHAKE,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        container.x = originalX;
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Bounce effect for emphasis
   *
   * @param target - Object to bounce
   * @param config - Animation configuration
   * @returns The created tween
   */
  bounce(
    target: Phaser.GameObjects.GameObject,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const container = target as Phaser.GameObjects.Container;
    const baseScaleX = container.scaleX || 1;
    const baseScaleY = container.scaleY || 1;
    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: baseScaleX * 1.15,
      scaleY: baseScaleY * 1.15,
      duration: config.duration ?? ANIM_DURATION.BOUNCE,
      ease: EASING.BOUNCE_OUT,
      yoyo: true,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Pulse effect for highlighting
   *
   * @param target - Object to pulse
   * @param minAlpha - Minimum alpha during pulse
   * @param config - Animation configuration
   * @returns The created tween
   */
  pulse(
    target: Phaser.GameObjects.GameObject,
    minAlpha: number = 0.5,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      alpha: minAlpha,
      duration: config.duration ?? 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: config.repeat ?? -1,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Flash effect (quick alpha change)
   *
   * @param target - Object to flash
   * @param config - Animation configuration
   * @returns The created tween
   */
  flash(
    target: Phaser.GameObjects.GameObject,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      alpha: 0,
      duration: config.duration ?? ANIM_DURATION.FLASH,
      ease: 'Linear',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Pop in effect (scale from 0 to target)
   *
   * @param target - Object to pop in
   * @param targetScale - Final scale
   * @param config - Animation configuration
   * @returns The created tween
   */
  popIn(
    target: Phaser.GameObjects.GameObject,
    targetScale: number = 1,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const container = target as Phaser.GameObjects.Container;
    container.setScale(0);

    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: targetScale,
      scaleY: targetScale,
      duration: config.duration ?? ANIM_DURATION.PIECE_DEPLOY,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Pop out effect (scale to 0)
   *
   * @param target - Object to pop out
   * @param config - Animation configuration
   * @returns The created tween
   */
  popOut(
    target: Phaser.GameObjects.GameObject,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: config.duration ?? ANIM_DURATION.PIECE_DESTROY,
      ease: config.ease ?? 'Back.easeIn',
      delay: config.delay ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /* ============================================
   * COMPOUND ANIMATIONS
   * ============================================
   */

  /**
   * Arc movement (for card draw animations)
   *
   * Uses quadratic bezier curve for smooth arc.
   *
   * @param target - Object to move
   * @param from - Starting position
   * @param to - Ending position
   * @param arcHeight - Height of arc above line
   * @param config - Animation configuration
   * @returns The created tween
   */
  arcMove(
    target: Phaser.GameObjects.GameObject,
    from: Position,
    to: Position,
    arcHeight: number = 100,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const container = target as Phaser.GameObjects.Container;
    container.setPosition(from.x, from.y);

    // Calculate control point for arc
    const midX = (from.x + to.x) / 2;
    const midY = Math.min(from.y, to.y) - arcHeight;

    const duration = config.duration ?? ANIM_DURATION.CARD_DRAW;

    const tween = this.scene.tweens.add({
      targets: target,
      x: to.x,
      y: to.y,
      duration: duration,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onUpdate: (tween) => {
        // Calculate arc position using quadratic bezier
        const t = tween.progress;
        const invT = 1 - t;

        const x = invT * invT * from.x + 2 * invT * t * midX + t * t * to.x;
        const y = invT * invT * from.y + 2 * invT * t * midY + t * t * to.y;

        container.setPosition(x, y);
      },
      onComplete: () => {
        container.setPosition(to.x, to.y);
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Fly away animation (for discarded cards)
   *
   * @param target - Object to fly away
   * @param direction - Direction to fly
   * @param distance - Distance to travel
   * @param config - Animation configuration
   * @returns The created tween
   */
  flyAway(
    target: Phaser.GameObjects.GameObject,
    direction: 'up' | 'down' | 'left' | 'right' = 'up',
    distance: number = 200,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const container = target as Phaser.GameObjects.Container;

    let targetX = container.x;
    let targetY = container.y;

    switch (direction) {
      case 'up': targetY -= distance; break;
      case 'down': targetY += distance; break;
      case 'left': targetX -= distance; break;
      case 'right': targetX += distance; break;
    }

    const tween = this.scene.tweens.add({
      targets: target,
      x: targetX,
      y: targetY,
      alpha: 0,
      duration: config.duration ?? ANIM_DURATION.CARD_DISCARD,
      ease: config.ease ?? EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onComplete: () => {
        this.activeTweens.delete(tween);
        config.onComplete?.();
      },
      onStart: config.onStart,
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /* ============================================
   * UTILITY METHODS
   * ============================================
   */

  /**
   * Chains multiple animations in sequence
   *
   * @param animations - Array of animation creator functions
   * @param onComplete - Callback when all complete
   */
  chain(
    animations: Array<() => Phaser.Tweens.Tween>,
    onComplete?: () => void
  ): void {
    if (animations.length === 0) {
      onComplete?.();
      return;
    }

    let index = 0;

    const runNext = () => {
      if (index >= animations.length) {
        onComplete?.();
        return;
      }

      const tween = animations[index]();

      tween.on('complete', () => {
        index++;
        runNext();
      });
    };

    runNext();
  }

  /**
   * Runs multiple animations in parallel
   *
   * @param animations - Array of animation creator functions
   * @param onComplete - Callback when all complete
   */
  parallel(
    animations: Array<() => Phaser.Tweens.Tween>,
    onComplete?: () => void
  ): void {
    if (animations.length === 0) {
      onComplete?.();
      return;
    }

    let completed = 0;
    const total = animations.length;

    for (const createAnim of animations) {
      const tween = createAnim();
      tween.on('complete', () => {
        completed++;
        if (completed >= total) {
          onComplete?.();
        }
      });
    }
  }

  /**
   * Delays execution
   *
   * @param ms - Milliseconds to delay
   * @returns Promise that resolves after delay
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.time.delayedCall(ms, resolve);
    });
  }

  /**
   * Stops all active tweens
   */
  stopAll(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();
  }

  /**
   * Stops a specific tween
   *
   * @param tween - Tween to stop
   */
  stop(tween: Phaser.Tweens.Tween): void {
    tween.stop();
    this.activeTweens.delete(tween);
  }

  /**
   * Checks if any animations are running
   *
   * @returns True if animations are active
   */
  isAnimating(): boolean {
    return this.activeTweens.size > 0;
  }

  /**
   * Gets count of active animations
   *
   * @returns Number of active tweens
   */
  getActiveCount(): number {
    return this.activeTweens.size;
  }

  /**
   * Destroys the manager and cleans up
   */
  destroy(): void {
    this.stopAll();
  }
}

/**
 * Creates an AnimationManager instance
 *
 * @param scene - The Phaser scene
 * @returns New AnimationManager
 */
export function createAnimationManager(scene: Phaser.Scene): AnimationManager {
  return new AnimationManager(scene);
}
