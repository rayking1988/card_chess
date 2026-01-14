/**
 * @fileoverview Graphics object pooling for particle effects
 * 
 * Provides reusable graphics objects to reduce GC pressure during
 * animations like piece destruction, deployment flashes, and explosions.
 * 
 * @module managers/animation/GraphicsPool
 */

import Phaser from 'phaser';

/**
 * Pooled graphics object with metadata
 */
interface PooledGraphics {
  graphics: Phaser.GameObjects.Graphics;
  inUse: boolean;
  lastUsed: number;
}

/**
 * GraphicsPool - Manages reusable graphics objects for particle effects
 * 
 * Features:
 * - Pre-allocated pool of graphics objects
 * - Automatic recycling when effects complete
 * - Cleanup of stale objects
 * - Configurable pool size
 * 
 * @example
 * const pool = new GraphicsPool(scene, 20);
 * const graphics = pool.acquire();
 * graphics.fillStyle(0xff0000, 1);
 * graphics.fillCircle(100, 100, 10);
 * pool.release(graphics);
 */
export class GraphicsPool {
  private scene: Phaser.Scene;
  private pool: PooledGraphics[] = [];
  private maxSize: number;
  private cleanupInterval: number = 5000; // 5 seconds
  private lastCleanup: number = 0;

  /**
   * Creates a new GraphicsPool
   * 
   * @param scene - The Phaser scene
   * @param maxSize - Maximum pool size (default: 30)
   */
  constructor(scene: Phaser.Scene, maxSize: number = 30) {
    this.scene = scene;
    this.maxSize = maxSize;
  }

  /**
   * Acquires a graphics object from the pool
   * 
   * Returns an existing unused object or creates a new one if needed.
   * 
   * @returns A graphics object ready for use
   */
  acquire(): Phaser.GameObjects.Graphics {
    // Try to find an unused graphics object
    for (const pooled of this.pool) {
      if (!pooled.inUse) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        pooled.graphics.clear();
        pooled.graphics.setVisible(true);
        pooled.graphics.setAlpha(1);
        pooled.graphics.setScale(1);
        pooled.graphics.setPosition(0, 0);
        return pooled.graphics;
      }
    }

    // Create new if pool not full
    if (this.pool.length < this.maxSize) {
      const graphics = this.scene.add.graphics();
      const pooled: PooledGraphics = {
        graphics,
        inUse: true,
        lastUsed: Date.now()
      };
      this.pool.push(pooled);
      return graphics;
    }

    // Pool is full, force cleanup and try again
    this.forceCleanup();
    
    // Try again after cleanup
    for (const pooled of this.pool) {
      if (!pooled.inUse) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        pooled.graphics.clear();
        pooled.graphics.setVisible(true);
        pooled.graphics.setAlpha(1);
        pooled.graphics.setScale(1);
        return pooled.graphics;
      }
    }

    // Last resort: create a new one (will exceed max temporarily)
    console.warn('GraphicsPool: Pool exhausted, creating overflow graphics');
    const graphics = this.scene.add.graphics();
    const pooled: PooledGraphics = {
      graphics,
      inUse: true,
      lastUsed: Date.now()
    };
    this.pool.push(pooled);
    return graphics;
  }

  /**
   * Releases a graphics object back to the pool
   * 
   * @param graphics - The graphics object to release
   */
  release(graphics: Phaser.GameObjects.Graphics): void {
    for (const pooled of this.pool) {
      if (pooled.graphics === graphics) {
        pooled.inUse = false;
        pooled.graphics.clear();
        pooled.graphics.setVisible(false);
        return;
      }
    }
  }

  /**
   * Creates a particle effect using pooled graphics
   * 
   * Automatically releases the graphics when the tween completes.
   * 
   * @param x - X position
   * @param y - Y position
   * @param color - Fill color
   * @param radius - Circle radius
   * @param targetX - Target X for movement
   * @param targetY - Target Y for movement
   * @param duration - Animation duration
   * @param depth - Z-depth (default: 1000)
   */
  createParticle(
    x: number,
    y: number,
    color: number,
    radius: number,
    targetX: number,
    targetY: number,
    duration: number,
    depth: number = 1000
  ): void {
    const graphics = this.acquire();
    graphics.fillStyle(color, 1);
    graphics.fillCircle(0, 0, radius);
    graphics.setPosition(x, y);
    graphics.setDepth(depth);

    this.scene.tweens.add({
      targets: graphics,
      x: targetX,
      y: targetY,
      alpha: 0,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(graphics)
    });
  }

  /**
   * Creates a flash effect using pooled graphics
   * 
   * @param x - X position
   * @param y - Y position
   * @param color - Fill color
   * @param radius - Initial radius
   * @param duration - Animation duration
   * @param depth - Z-depth (default: 1000)
   */
  createFlash(
    x: number,
    y: number,
    color: number,
    radius: number,
    duration: number,
    depth: number = 1000
  ): void {
    const graphics = this.acquire();
    graphics.fillStyle(color, 0.8);
    graphics.fillCircle(0, 0, radius);
    graphics.setPosition(x, y);
    graphics.setDepth(depth);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(graphics)
    });
  }

  /**
   * Creates a ring effect using pooled graphics
   * 
   * @param x - X position
   * @param y - Y position
   * @param color - Stroke color
   * @param radius - Initial radius
   * @param lineWidth - Stroke width
   * @param duration - Animation duration
   * @param depth - Z-depth (default: 1000)
   */
  createRing(
    x: number,
    y: number,
    color: number,
    radius: number,
    lineWidth: number,
    duration: number,
    depth: number = 1000
  ): void {
    const graphics = this.acquire();
    graphics.lineStyle(lineWidth, color, 1);
    graphics.strokeCircle(0, 0, radius);
    graphics.setPosition(x, y);
    graphics.setDepth(depth);

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      scaleX: 4,
      scaleY: 4,
      duration: duration,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(graphics)
    });
  }

  /**
   * Forces cleanup of unused graphics objects
   */
  private forceCleanup(): void {
    const now = Date.now();
    
    // Release any graphics that have been "in use" for too long (likely leaked)
    for (const pooled of this.pool) {
      if (pooled.inUse && now - pooled.lastUsed > 10000) {
        console.warn('GraphicsPool: Force releasing stale graphics');
        pooled.inUse = false;
        pooled.graphics.clear();
        pooled.graphics.setVisible(false);
      }
    }
  }

  /**
   * Periodic cleanup of the pool
   * Call this from scene update if needed
   */
  update(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.cleanupInterval) return;
    
    this.lastCleanup = now;
    this.forceCleanup();
  }

  /**
   * Gets pool statistics
   */
  getStats(): { total: number; inUse: number; available: number } {
    let inUse = 0;
    for (const pooled of this.pool) {
      if (pooled.inUse) inUse++;
    }
    return {
      total: this.pool.length,
      inUse,
      available: this.pool.length - inUse
    };
  }

  /**
   * Destroys the pool and all graphics objects
   */
  destroy(): void {
    for (const pooled of this.pool) {
      pooled.graphics.destroy();
    }
    this.pool = [];
  }
}
