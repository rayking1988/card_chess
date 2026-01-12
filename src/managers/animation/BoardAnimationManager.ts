/**
 * @fileoverview Board-specific animations
 *
 * @module managers/animation/BoardAnimationManager
 */

import Phaser from 'phaser';
import { ANIM_DURATION, EASING } from './constants';
import type { BoardAnimationConfig, Position, TweenConfig } from './types';
import { CardAnimationManager } from './CardAnimationManager';

/**
 * BoardAnimationManager - Extended CardAnimationManager with board-specific animations
 *
 * Provides animations for:
 * - Piece movement (Requirement 13.4)
 * - Piece deployment (Requirement 13.5)
 * - Piece destruction (Requirement 13.5)
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

  constructor(scene: Phaser.Scene) {
    super(scene);
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
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    const fromPos = this.squareToPixel(fromSquare);
    const toPos = this.squareToPixel(toSquare);

    if (!fromPos || !toPos) {
      onComplete?.();
      return null;
    }

    pieceSprite.setPosition(fromPos.x, fromPos.y);
    const originalScale = pieceSprite.scaleX;

    return scene.tweens.add({
      targets: pieceSprite,
      x: toPos.x,
      y: toPos.y,
      duration: config.duration ?? ANIM_DURATION.PIECE_MOVE,
      ease: config.ease ?? EASING.SMOOTH,
      delay: config.delay ?? 0,
      onStart: () => {
        // Slight scale up to indicate movement
        scene.tweens.add({
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
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return null;
    }

    // Start invisible and scaled down
    pieceSprite.setPosition(pos.x, pos.y);
    pieceSprite.setScale(0);
    pieceSprite.setAlpha(0);

    return scene.tweens.add({
      targets: pieceSprite,
      scaleX: pieceSprite.scaleX || 0.8,
      scaleY: pieceSprite.scaleY || 0.8,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.PIECE_DEPLOY,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      onStart: () => {
        this.createDeployFlash(scene, pos.x, pos.y);
        config.onStart?.();
      },
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Creates a flash effect at deploy position
   *
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createDeployFlash(scene: Phaser.Scene, x: number, y: number): void {
    const flash = scene.add.graphics();
    flash.fillStyle(0xffffff, 0.8);
    flash.fillCircle(x, y, 40);
    flash.setDepth(1000);

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 300,
      ease: EASING.QUAD_OUT,
      onComplete: () => flash.destroy(),
    });
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
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    const targetPos = this.squareToPixel(square);
    if (!targetPos) {
      onComplete?.();
      return;
    }

    // Start at card position
    pieceSprite.setPosition(cardPosition.x, cardPosition.y);
    pieceSprite.setScale(0.3);
    pieceSprite.setAlpha(0.5);

    // Arc movement to target square
    const arcHeight = 100;
    const midX = (cardPosition.x + targetPos.x) / 2;
    const midY = Math.min(cardPosition.y, targetPos.y) - arcHeight;

    const duration = config.duration ?? ANIM_DURATION.PIECE_DEPLOY;

    scene.tweens.add({
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
        const t = tween.progress;
        const invT = 1 - t;

        const x = invT * invT * cardPosition.x + 2 * invT * t * midX + t * t * targetPos.x;
        const y = invT * invT * cardPosition.y + 2 * invT * t * midY + t * t * targetPos.y;

        pieceSprite.setPosition(x, y);
      },
      onComplete: () => {
        pieceSprite.setPosition(targetPos.x, targetPos.y);
        this.createDeployFlash(scene, targetPos.x, targetPos.y);
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
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return null;
    }

    // Create destruction particles
    this.createDestroyParticles(scene, pos.x, pos.y);

    return scene.tweens.add({
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
   * Creates particle effect for piece destruction
   *
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createDestroyParticles(scene: Phaser.Scene, x: number, y: number): void {
    const particleCount = 8;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 30 + Math.random() * 20;

      const particle = scene.add.graphics();
      particle.fillStyle(0xff4444, 1);
      particle.fillCircle(0, 0, 4 + Math.random() * 4);
      particle.setPosition(x, y);
      particle.setDepth(1000);

      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 300 + Math.random() * 100,
        ease: EASING.QUAD_OUT,
        onComplete: () => particle.destroy(),
      });
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
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;

    const pos = this.squareToPixel(square);
    if (!pos) {
      onComplete?.();
      return;
    }

    // Flash white
    pieceSprite.setTint(0xffffff);

    // Scale up briefly then explode
    scene.tweens.add({
      targets: pieceSprite,
      scaleX: pieceSprite.scaleX * 1.3,
      scaleY: pieceSprite.scaleY * 1.3,
      duration: 100,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        this.createExplosionEffect(scene, pos.x, pos.y);

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
   * Creates explosion visual effect
   *
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createExplosionEffect(scene: Phaser.Scene, x: number, y: number): void {
    // Central flash
    const flash = scene.add.graphics();
    flash.fillStyle(0xffaa00, 1);
    flash.fillCircle(x, y, 20);
    flash.setDepth(1001);

    scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 3,
      scaleY: 3,
      duration: 250,
      ease: EASING.QUAD_OUT,
      onComplete: () => flash.destroy(),
    });

    // Ring effect
    const ring = scene.add.graphics();
    ring.lineStyle(4, 0xff6600, 1);
    ring.strokeCircle(x, y, 10);
    ring.setDepth(1000);

    scene.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 4,
      scaleY: 4,
      duration: 350,
      ease: EASING.QUAD_OUT,
      onComplete: () => ring.destroy(),
    });

    this.createDestroyParticles(scene, x, y);
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
