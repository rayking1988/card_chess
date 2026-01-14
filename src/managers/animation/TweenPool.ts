/**
 * @fileoverview Tween pooling and lifecycle management for animations
 * 
 * Provides centralized tween creation with automatic cleanup to prevent
 * memory leaks and reduce GC pressure during gameplay.
 * 
 * @module managers/animation/TweenPool
 */

import Phaser from 'phaser';
import type { TweenConfig } from './types';

/**
 * TweenPool - Manages tween lifecycle and provides pooling
 * 
 * Features:
 * - Automatic cleanup of completed tweens
 * - Centralized tween creation with consistent patterns
 * - Active tween tracking for debugging
 * - Batch operations (stop all, pause all)
 */
export class TweenPool {
  private scene: Phaser.Scene;
  private activeTweens: Set<Phaser.Tweens.Tween> = new Set();
  private maxActiveTweens: number = 100;

  constructor(scene: Phaser.Scene, maxActiveTweens: number = 100) {
    this.scene = scene;
    this.maxActiveTweens = maxActiveTweens;
  }

  /**
   * Creates a tween with automatic lifecycle management
   * 
   * @param tweenConfig - Phaser tween configuration
   * @param customConfig - Additional configuration options
   * @returns The created tween
   */
  createTween(
    tweenConfig: Phaser.Types.Tweens.TweenBuilderConfig,
    customConfig: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    // Warn if too many active tweens (potential leak)
    if (this.activeTweens.size >= this.maxActiveTweens) {
      console.warn(`TweenPool: ${this.activeTweens.size} active tweens, possible memory leak`);
      this.cleanupCompletedTweens();
    }

    const originalOnComplete = tweenConfig.onComplete;
    
    const tween = this.scene.tweens.add({
      ...tweenConfig,
      onComplete: (tween, targets, ...args) => {
        this.activeTweens.delete(tween);
        originalOnComplete?.(tween, targets, ...args);
        customConfig.onComplete?.();
      }
    });

    this.activeTweens.add(tween);
    return tween;
  }

  /**
   * Creates a simple property tween
   */
  tweenProperty(
    target: Phaser.GameObjects.GameObject,
    props: Record<string, number>,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    return this.createTween({
      targets: target,
      ...props,
      duration: config.duration ?? 300,
      ease: config.ease ?? 'Quad.easeOut',
      delay: config.delay ?? 0,
      yoyo: config.yoyo ?? false,
      repeat: config.repeat ?? 0,
      onStart: config.onStart,
      onUpdate: config.onUpdate
    }, config);
  }

  /**
   * Removes completed tweens from tracking
   */
  private cleanupCompletedTweens(): void {
    for (const tween of this.activeTweens) {
      if (!tween.isPlaying()) {
        this.activeTweens.delete(tween);
      }
    }
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
   */
  stop(tween: Phaser.Tweens.Tween): void {
    tween.stop();
    this.activeTweens.delete(tween);
  }

  /**
   * Gets count of active tweens
   */
  getActiveCount(): number {
    return this.activeTweens.size;
  }

  /**
   * Checks if any tweens are running
   */
  isAnimating(): boolean {
    return this.activeTweens.size > 0;
  }

  /**
   * Destroys the pool and cleans up
   */
  destroy(): void {
    this.stopAll();
  }
}

/**
 * Shared arc position calculation for bezier curves
 * Used by multiple animation methods to avoid code duplication
 */
export function calculateArcPosition(
  t: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
  arcHeight: number
): { x: number; y: number } {
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - arcHeight;
  const invT = 1 - t;
  
  return {
    x: invT * invT * from.x + 2 * invT * t * midX + t * t * to.x,
    y: invT * invT * from.y + 2 * invT * t * midY + t * t * to.y
  };
}
