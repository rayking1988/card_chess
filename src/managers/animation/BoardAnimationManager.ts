/**
 * @fileoverview Board-specific animations
 *
 * @module managers/animation/BoardAnimationManager
 */

import Phaser from 'phaser';
import { ANIM_DURATION, EASING } from './constants';
import type { BoardAnimationConfig, Position, TweenConfig } from './types';
import { CardAnimationManager } from './CardAnimationManager';
import { GraphicsPool } from './GraphicsPool';
import { calculateArcPosition } from './TweenPool';

/**
 * BoardAnimationManager - Extended CardAnimationManager with board-specific animations
 *
 * Provides animations for:
 * - Piece movement (Requirement 13.4)
 * - Piece deployment (Requirement 13.5)
 * - Piece destruction (Requirement 13.5)
 *
 * Uses GraphicsPool for particle effects to reduce GC pressure.
 *
 * @example
 * const boardAnim = new BoardAnimationManager(scene);
 * boardAnim.setBoardConfig({ squareSize: 64, boardX: 100, boardY: 100, isFlipped: false });
 * boardAnim.animatePieceMove(sprite, 'e2', 'e4');
 *
 * Used by: GameAnimationManager, GameScene
 */
export class BoardAnimationManager extends CardAnimationManager {
  /** Board configuration for coordinate conversion */
  private boardConfig: BoardAnimationConfig | null = null;
  
  /** Graphics pool for particle effects */
  private graphicsPool: GraphicsPool;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.graphicsPool = new GraphicsPool(scene, 30);
  }

  /**
   * Configures board animation settings
   *
   * @param config - Board configuration
   */
  setBoardConfig(config: BoardAnimationConfig): void {
    this.boardConfig = config;
  }

  /**
   * Converts square notation to pixel position
   *
   * @param square - Chess square notation (e.g., 'e4')
   * @returns Pixel position or null if not configured
   * @private
   */
  private squareToPixel(square: string): Position | null {
    if (!this.boardConfig) return null;

    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);

    let col = file;
    let row = rank;

    if (this.boardConfig.isFlipped) {
      col = 7 - col;
      row = 7 - row;
    }

    return {
      x: this.boardConfig.boardX + col * this.boardConfig.squareSize + this.boardConfig.squareSize / 2,
      y: this.boardConfig.boardY + row * this.boardConfig.squareSize + this.boardConfig.squareSize / 2,
    };
  }

  /* ============================================
   * PIECE MOVE ANIMATION (Requirement 13.4)
   * ============================================
   */

  /**
   * Animates piece moving from one square to another
   *
   * @param pieceSprite - The piece sprite
   * @param fromSquare - Starting square
   * @param toSquare - Ending square
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween or null
   */
  animatePieceMove(
    pieceSprite: Phaser.GameObjects.Image,
    fromSquare: string,
    toSquare: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween | null {
    const fromPos = this.squareToPixel(fromSquare);
    const toPos = this.squareToPixel(toSquare);

    if (!fromPos || !toPos) {
      onComplete?.();
      return null;
    }

    pieceSprite.setPosition(fromPos.x, fromPos.y);
    const originalScale = pieceSprite.scaleX;

    return this.scene.tweens.add({
      targets: pieceSprite,
      x: toPos.x,
      y: toPos.y,
      duration: config.duration ?? ANIM_DURATION.PIECE_MOVE,
      ease: config.ease ?? EASING.SMOOTH,
      delay: config.delay ?? 0,
      onStart: () => {
        // Slight scale up to indicate movement
        this.scene.tweens.add({
          targets: pieceSprite,
          scaleX: originalScale * 1.15,
          scaleY: originalScale * 1.15,
          duration: (config.duration ?? ANIM_DURATION.PIECE_MOVE) / 2,
          yoyo: true,
          ease: EASING.QUAD_OUT,
        });
        config.onStart?.();
      },
      onComplete: () => {
        pieceSprite.setScale(originalScale);
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Animates piece move with capture effect
   *
   * @param movingPiece - The moving piece sprite
   * @param capturedPiece - The captured piece sprite
   * @param fromSquare - Starting square
   * @param toSquare - Ending square
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animatePieceMoveWithCapture(
    movingPiece: Phaser.GameObjects.Image,
    capturedPiece: Phaser.GameObjects.Image,
    fromSquare: string,
    toSquare: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    // First animate the capture
    this.animatePieceDestroy(capturedPiece, toSquare, {
      duration: ANIM_DURATION.PIECE_DESTROY / 2,
    });

    // Then move the capturing piece
    this.animatePieceMove(movingPiece, fromSquare, toSquare, {
      ...config,
      delay: (config.delay ?? 0) + 100,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /* ============================================
   * PIECE DEPLOY ANIMATION (Requirement 13.5)
   * ============================================
   */

  /**
   * Animates piece being deployed to a square
   *
   * @param pieceSprite - The piece sprite
   * @param square - Target square
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween or null
   */
  animatePieceDeploy(
    pieceSprite: Phaser.GameObjects.Image,
    square: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween | null {
    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return null;
    }

    // Start invisible and scaled down
    pieceSprite.setPosition(pos.x, pos.y);
    pieceSprite.setScale(0);
    pieceSprite.setAlpha(0);

    return this.scene.tweens.add({
      targets: pieceSprite,
      scaleX: pieceSprite.scaleX || 0.8,
      scaleY: pieceSprite.scaleY || 0.8,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.PIECE_DEPLOY,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      onStart: () => {
        this.createDeployFlash(pos.x, pos.y);
        config.onStart?.();
      },
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Creates a flash effect at deploy position using graphics pool
   *
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createDeployFlash(x: number, y: number): void {
    this.graphicsPool.createFlash(x, y, 0xffffff, 40, 300, 1000);
  }

  /**
   * Animates piece deploying from a card
   *
   * @param pieceSprite - The piece sprite
   * @param cardPosition - Card position
   * @param square - Target square
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animatePieceDeployFromCard(
    pieceSprite: Phaser.GameObjects.Image,
    cardPosition: Position,
    square: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const targetPos = this.squareToPixel(square);
    if (!targetPos) {
      onComplete?.();
      return;
    }

    // Start at card position
    pieceSprite.setPosition(cardPosition.x, cardPosition.y);
    pieceSprite.setScale(0.3);
    pieceSprite.setAlpha(0.5);

    const arcHeight = 100;
    const duration = config.duration ?? ANIM_DURATION.PIECE_DEPLOY;

    this.scene.tweens.add({
      targets: pieceSprite,
      x: targetPos.x,
      y: targetPos.y,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 1,
      duration: duration,
      ease: EASING.QUAD_OUT,
      delay: config.delay ?? 0,
      onUpdate: (tween) => {
        // Use shared arc calculation utility
        const pos = calculateArcPosition(tween.progress, cardPosition, targetPos, arcHeight);
        pieceSprite.setPosition(pos.x, pos.y);
      },
      onComplete: () => {
        pieceSprite.setPosition(targetPos.x, targetPos.y);
        this.createDeployFlash(targetPos.x, targetPos.y);
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /* ============================================
   * PIECE DESTROY ANIMATION (Requirement 13.5)
   * ============================================
   */

  /**
   * Animates piece being destroyed/captured
   *
   * @param pieceSprite - The piece sprite
   * @param square - Square where piece is
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   * @returns The created tween or null
   */
  animatePieceDestroy(
    pieceSprite: Phaser.GameObjects.Image,
    square: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween | null {
    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return null;
    }

    // Create destruction particles using pool
    this.createDestroyParticles(pos.x, pos.y);

    return this.scene.tweens.add({
      targets: pieceSprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      rotation: pieceSprite.rotation + Math.PI,
      duration: config.duration ?? ANIM_DURATION.PIECE_DESTROY,
      ease: config.ease ?? 'Back.easeIn',
      delay: config.delay ?? 0,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Creates particle effect for piece destruction using graphics pool
   *
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createDestroyParticles(x: number, y: number): void {
    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;
      const radius = 4 + Math.random() * 4;

      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;
      const duration = 300 + Math.random() * 100;

      this.graphicsPool.createParticle(x, y, 0xff4444, radius, targetX, targetY, duration, 1000);
    }
  }

  /**
   * Animates piece exploding (dramatic destruction)
   *
   * @param pieceSprite - The piece sprite
   * @param square - Square where piece is
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animatePieceExplode(
    pieceSprite: Phaser.GameObjects.Image,
    square: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return;
    }

    // Flash white
    pieceSprite.setTint(0xffffff);

    // Scale up briefly then explode
    this.scene.tweens.add({
      targets: pieceSprite,
      scaleX: pieceSprite.scaleX * 1.3,
      scaleY: pieceSprite.scaleY * 1.3,
      duration: 100,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        this.createExplosionEffect(pos.x, pos.y);

        this.animatePieceDestroy(pieceSprite, square, {
          ...config,
          duration: (config.duration ?? ANIM_DURATION.PIECE_DESTROY) / 2,
          onComplete: () => {
            onComplete?.();
            config.onComplete?.();
          },
        });
      },
    });
  }

  /**
   * Creates explosion visual effect using graphics pool
   *
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createExplosionEffect(x: number, y: number): void {
    // Central flash
    this.graphicsPool.createFlash(x, y, 0xffaa00, 20, 250, 1001);

    // Ring effect
    this.graphicsPool.createRing(x, y, 0xff6600, 10, 4, 350, 1000);

    // Particles
    this.createDestroyParticles(x, y);
  }

  /**
   * Gets the graphics pool for external use or monitoring
   */
  getGraphicsPool(): GraphicsPool {
    return this.graphicsPool;
  }

  /**
   * Destroys the manager and cleans up resources
   */
  override destroy(): void {
    super.destroy();
    this.graphicsPool.destroy();
  }
}

/**
 * Creates a BoardAnimationManager instance
 *
 * @param scene - The Phaser scene
 * @returns New BoardAnimationManager
 */
export function createBoardAnimationManager(scene: Phaser.Scene): BoardAnimationManager {
  return new BoardAnimationManager(scene);
}
