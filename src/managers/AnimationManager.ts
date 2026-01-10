/**
 * @fileoverview AnimationManager - Centralized animation system for Card Chess
 * 
 * This module provides a comprehensive animation system with:
 * - Core tween helpers (move, scale, fade, rotate)
 * - Effect animations (shake, bounce, pulse, flash)
 * - Card-specific animations (draw, play, discard, shuffle)
 * - Board-specific animations (piece move, deploy, destroy)
 * - UI animations (clock, energy, victory/defeat)
 * 
 * Requirements addressed:
 * - 13.1: Animate deck shuffling
 * - 13.2: Animate cards moving from deck to hand
 * - 13.3: Animate card play from hand
 * - 13.4: Animate piece movement on board
 * - 13.5: Animate piece deployment and destruction
 * - 13.6: Animate clock and energy changes
 * - 13.7: Display victory/defeat/draw animations
 * 
 * @module managers/AnimationManager
 * @requires phaser
 */

import Phaser from 'phaser';

/* ============================================
 * ANIMATION DURATION CONSTANTS
 * ============================================
 * All durations are in milliseconds.
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

/* ============================================
 * EASING FUNCTION CONSTANTS
 * ============================================
 * Phaser easing function names for different animation feels.
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

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

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

/* ============================================
 * BASE ANIMATION MANAGER CLASS
 * ============================================
 */

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
    const tween = this.scene.tweens.add({
      targets: target,
      scaleX: 1.15,
      scaleY: 1.15,
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

/* ============================================
 * CARD ANIMATION MANAGER CLASS
 * ============================================
 */

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

/* ============================================
 * BOARD ANIMATION MANAGER CLASS
 * ============================================
 */

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

/* ============================================
 * GAME ANIMATION MANAGER CLASS
 * ============================================
 */

/**
 * GameAnimationManager - Full-featured animation manager with all game animations
 * 
 * Provides animations for:
 * - Clock changes (Requirement 13.6)
 * - Energy changes (Requirement 13.6)
 * - Victory/defeat/draw screens (Requirement 13.7)
 * - Screen effects (shake, flash, transitions)
 * 
 * @example
 * const gameAnim = new GameAnimationManager(scene);
 * gameAnim.animateVictory(scene, resultText);
 * gameAnim.screenShake(scene, 10);
 * 
 * Used by: GameScene
 */
export class GameAnimationManager extends BoardAnimationManager {
  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  /* ============================================
   * CLOCK CHANGE ANIMATION (Requirement 13.6)
   * ============================================
   */

  /**
   * Animates clock time change with visual feedback
   * 
   * @param clockContainer - The clock container
   * @param timeText - The time text object
   * @param oldTime - Previous time value
   * @param newTime - New time value
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateClockChange(
    clockContainer: Phaser.GameObjects.Container,
    timeText: Phaser.GameObjects.Text,
    oldTime: number,
    newTime: number,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    const timeDiff = newTime - oldTime;
    
    // Determine color based on change
    let flashColor: number;
    if (timeDiff > 0) {
      flashColor = 0x44ff44; // Green for time gain
    } else if (timeDiff < -30) {
      flashColor = 0xff4444; // Red for large time loss
    } else {
      flashColor = 0xffff44; // Yellow for small time loss
    }
    
    scene.tweens.add({
      targets: clockContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: config.duration ?? ANIM_DURATION.CLOCK_CHANGE,
      ease: EASING.QUAD_OUT,
      yoyo: true,
      onStart: () => {
        clockContainer.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Image) {
            child.setTint(flashColor);
          }
        });
        config.onStart?.();
      },
      onComplete: () => {
        clockContainer.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Image) {
            child.clearTint();
          }
        });
        onComplete?.();
        config.onComplete?.();
      },
    });
    
    if (timeText) {
      this.animateTextChange(timeText, flashColor, config);
    }
  }

  /**
   * Animates text with color flash
   * 
   * @param text - The text object
   * @param flashColor - Color to flash
   * @param config - Animation configuration
   * @private
   */
  private animateTextChange(
    text: Phaser.GameObjects.Text,
    flashColor: number,
    config: TweenConfig = {}
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    const originalColor = text.style.color;
    
    const colorStr = '#' + flashColor.toString(16).padStart(6, '0');
    text.setColor(colorStr);
    
    scene.tweens.add({
      targets: text,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: (config.duration ?? ANIM_DURATION.CLOCK_CHANGE) / 2,
      ease: EASING.QUAD_OUT,
      yoyo: true,
      onComplete: () => {
        text.setColor(originalColor as string);
      },
    });
  }

  /**
   * Animates clock running low warning
   * 
   * @param clockContainer - The clock container
   * @param config - Animation configuration
   * @returns The created tween
   */
  animateClockWarning(
    clockContainer: Phaser.GameObjects.Container,
    config: TweenConfig = {}
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    
    return scene.tweens.add({
      targets: clockContainer,
      alpha: 0.5,
      duration: 300,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: config.repeat ?? -1,
      onComplete: config.onComplete,
    });
  }

  /* ============================================
   * ENERGY CHANGE ANIMATION (Requirement 13.6)
   * ============================================
   */

  /**
   * Animates energy bar change
   * 
   * @param energyContainer - The energy container
   * @param energyText - The energy text object
   * @param oldEnergy - Previous energy value
   * @param newEnergy - New energy value
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateEnergyChange(
    energyContainer: Phaser.GameObjects.Container,
    energyText: Phaser.GameObjects.Text,
    oldEnergy: number,
    newEnergy: number,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    const energyDiff = newEnergy - oldEnergy;
    
    let flashColor: number;
    if (energyDiff > 0) {
      flashColor = 0x44ff44; // Green for energy gain
    } else {
      flashColor = 0xff8844; // Orange for energy spend
    }
    
    scene.tweens.add({
      targets: energyContainer,
      scaleX: energyDiff > 0 ? 1.15 : 0.9,
      scaleY: energyDiff > 0 ? 1.15 : 0.9,
      duration: config.duration ?? ANIM_DURATION.ENERGY_CHANGE,
      ease: energyDiff > 0 ? EASING.BACK_OUT : EASING.QUAD_OUT,
      yoyo: true,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
    
    if (energyText) {
      this.animateTextChange(energyText, flashColor, config);
    }
    
    this.createFloatingNumber(
      scene,
      energyContainer.x,
      energyContainer.y - 30,
      energyDiff,
      flashColor
    );
  }

  /**
   * Creates floating number indicator (+X or -X)
   * 
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @param value - Number value
   * @param color - Text color
   * @private
   */
  private createFloatingNumber(
    scene: Phaser.Scene,
    x: number,
    y: number,
    value: number,
    color: number
  ): void {
    const sign = value >= 0 ? '+' : '';
    const colorStr = '#' + color.toString(16).padStart(6, '0');
    
    const floatText = scene.add.text(x, y, `${sign}${value}`, {
      fontSize: '20px',
      fontFamily: 'BoldPixels, Arial',
      color: colorStr,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    floatText.setDepth(2000);
    
    scene.tweens.add({
      targets: floatText,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: EASING.QUAD_OUT,
      onComplete: () => floatText.destroy(),
    });
  }

  /**
   * Animates energy cap increase
   * 
   * @param energyContainer - The energy container
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateEnergyCapIncrease(
    energyContainer: Phaser.GameObjects.Container,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    
    const glow = scene.add.graphics();
    glow.fillStyle(0xffd700, 0.5);
    glow.fillCircle(energyContainer.x, energyContainer.y, 50);
    glow.setDepth(energyContainer.depth - 1);
    
    scene.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: config.duration ?? 400,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        glow.destroy();
        onComplete?.();
        config.onComplete?.();
      },
    });
    
    scene.tweens.add({
      targets: energyContainer,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: EASING.BACK_OUT,
      yoyo: true,
    });
  }

  /* ============================================
   * VICTORY/DEFEAT/DRAW ANIMATIONS (Requirement 13.7)
   * ============================================
   */

  /**
   * Animates victory screen reveal
   * 
   * @param scene - The Phaser scene
   * @param resultText - The result text object
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateVictory(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    resultText.setScale(0);
    resultText.setAlpha(0);
    
    scene.tweens.add({
      targets: resultText,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.VICTORY_REVEAL,
      ease: EASING.ELASTIC_OUT,
      onComplete: () => {
        scene.tweens.add({
          targets: resultText,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
          ease: EASING.QUAD_OUT,
          onComplete: () => {
            scene.tweens.add({
              targets: resultText,
              scaleX: 1.05,
              scaleY: 1.05,
              duration: 1000,
              ease: 'Sine.easeInOut',
              yoyo: true,
              repeat: -1,
            });
            onComplete?.();
            config.onComplete?.();
          },
        });
      },
    });
    
    this.createVictoryParticles(scene, resultText.x, resultText.y);
  }

  /**
   * Creates victory celebration particles
   * 
   * @param scene - The Phaser scene
   * @param x - X position
   * @param y - Y position
   * @private
   */
  private createVictoryParticles(scene: Phaser.Scene, x: number, y: number): void {
    const colors = [0xffd700, 0x44ff44, 0x44ffff, 0xff44ff];
    
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 150;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = scene.add.graphics();
      particle.fillStyle(color, 1);
      particle.fillTriangle(-6, 0, 0, -8, 6, 0);
      particle.fillTriangle(-6, 0, 0, 8, 6, 0);
      particle.setPosition(x, y);
      particle.setDepth(2000);
      
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance - 50;
      
      scene.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        rotation: Math.PI * 2,
        duration: 1000 + Math.random() * 500,
        ease: EASING.QUAD_OUT,
        delay: Math.random() * 300,
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Animates defeat screen reveal
   * 
   * @param scene - The Phaser scene
   * @param resultText - The result text object
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateDefeat(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const targetY = resultText.y;
    resultText.setY(targetY - 100);
    resultText.setAlpha(0);
    
    scene.tweens.add({
      targets: resultText,
      y: targetY,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.VICTORY_REVEAL,
      ease: EASING.BOUNCE_OUT,
      onComplete: () => {
        this.shake(resultText, 10, {
          onComplete: () => {
            onComplete?.();
            config.onComplete?.();
          },
        });
      },
    });
  }

  /**
   * Animates draw screen reveal
   * 
   * @param scene - The Phaser scene
   * @param resultText - The result text object
   * @param config - Animation configuration
   * @param onComplete - Callback when complete
   */
  animateDraw(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    resultText.setScale(2);
    resultText.setAlpha(0);
    resultText.setRotation(-0.1);
    
    scene.tweens.add({
      targets: resultText,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      rotation: 0,
      duration: config.duration ?? ANIM_DURATION.VICTORY_REVEAL,
      ease: EASING.BACK_OUT,
      onComplete: () => {
        onComplete?.();
        config.onComplete?.();
      },
    });
  }

  /**
   * Animates screen transition (fade to black and back)
   * 
   * @param scene - The Phaser scene
   * @param onMidpoint - Callback at midpoint (when fully black)
   * @param onComplete - Callback when complete
   */
  animateScreenTransition(
    scene: Phaser.Scene,
    onMidpoint?: () => void,
    onComplete?: () => void
  ): void {
    const { width, height } = scene.scale;
    
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, width, height);
    overlay.setAlpha(0);
    overlay.setDepth(10000);
    
    scene.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 400,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        onMidpoint?.();
        
        scene.tweens.add({
          targets: overlay,
          alpha: 0,
          duration: 400,
          ease: EASING.QUAD_OUT,
          onComplete: () => {
            overlay.destroy();
            onComplete?.();
          },
        });
      },
    });
  }

  /**
   * Creates screen shake effect
   * 
   * @param scene - The Phaser scene
   * @param intensity - Shake intensity
   * @param duration - Shake duration
   */
  screenShake(
    scene: Phaser.Scene,
    intensity: number = 10,
    duration: number = 200
  ): void {
    scene.cameras.main.shake(duration, intensity / 1000);
  }

  /**
   * Creates screen flash effect
   * 
   * @param scene - The Phaser scene
   * @param color - Flash color
   * @param duration - Flash duration
   */
  screenFlash(
    scene: Phaser.Scene,
    color: number = 0xffffff,
    duration: number = 200
  ): void {
    scene.cameras.main.flash(duration, 
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff
    );
  }
}

/**
 * Creates a full GameAnimationManager instance
 * 
 * @param scene - The Phaser scene
 * @returns New GameAnimationManager
 */
export function createGameAnimationManager(scene: Phaser.Scene): GameAnimationManager {
  return new GameAnimationManager(scene);
}
