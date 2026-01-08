/**
 * AnimationManager - Centralized animation system for Card Chess
 * 
 * Requirements: 13.1-13.7
 * - 13.1: Animate deck shuffling
 * - 13.2: Animate cards moving from deck to hand
 * - 13.3: Animate card play from hand
 * - 13.4: Animate piece movement on board
 * - 13.5: Animate piece deployment and destruction
 * - 13.6: Animate clock and energy changes
 * - 13.7: Display victory/defeat/draw animations
 */

import Phaser from 'phaser';

// Animation duration constants (in milliseconds)
export const ANIM_DURATION = {
  CARD_DRAW: 400,
  CARD_PLAY: 300,
  CARD_DISCARD: 250,
  DECK_SHUFFLE: 600,
  PIECE_MOVE: 350,
  PIECE_DEPLOY: 400,
  PIECE_DESTROY: 350,
  CLOCK_CHANGE: 200,
  ENERGY_CHANGE: 250,
  VICTORY_REVEAL: 800,
  FLASH: 150,
  BOUNCE: 200,
  SHAKE: 100,
};

// Easing functions
export const EASING = {
  SMOOTH: 'Sine.easeInOut',
  BOUNCE_OUT: 'Bounce.easeOut',
  BACK_OUT: 'Back.easeOut',
  ELASTIC_OUT: 'Elastic.easeOut',
  QUAD_OUT: 'Quad.easeOut',
  CUBIC_OUT: 'Cubic.easeOut',
  EXPO_OUT: 'Expo.easeOut',
};

/**
 * Animation configuration for tweens
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
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * AnimationManager - Provides tween helpers for common game animations
 */
export class AnimationManager {
  private scene: Phaser.Scene;
  private activeTweens: Set<Phaser.Tweens.Tween> = new Set();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ============================================
  // Core Tween Helpers
  // ============================================

  /**
   * Move a game object from one position to another
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
   * Scale a game object
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
   * Fade a game object in or out
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
   * Rotate a game object
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

  // ============================================
  // Effect Animations
  // ============================================

  /**
   * Shake effect for invalid actions or damage
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

  // ============================================
  // Compound Animations
  // ============================================

  /**
   * Arc movement (for card draw animations)
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
    
    // Use a timeline for smooth arc movement
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

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Chain multiple animations in sequence
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
   * Run multiple animations in parallel
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
   * Delay execution
   */
  delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.time.delayedCall(ms, resolve);
    });
  }

  /**
   * Stop all active tweens
   */
  stopAll(): void {
    for (const tween of this.activeTweens) {
      tween.stop();
    }
    this.activeTweens.clear();
  }

  /**
   * Stop a specific tween
   */
  stop(tween: Phaser.Tweens.Tween): void {
    tween.stop();
    this.activeTweens.delete(tween);
  }

  /**
   * Check if any animations are running
   */
  isAnimating(): boolean {
    return this.activeTweens.size > 0;
  }

  /**
   * Get count of active animations
   */
  getActiveCount(): number {
    return this.activeTweens.size;
  }

  /**
   * Destroy the manager and clean up
   */
  destroy(): void {
    this.stopAll();
  }
}

/**
 * Create an AnimationManager instance
 */
export function createAnimationManager(scene: Phaser.Scene): AnimationManager {
  return new AnimationManager(scene);
}


// ============================================
// Card Animation Extensions
// ============================================

/**
 * Card animation configuration
 */
export interface CardAnimationConfig {
  deckPosition: Position;
  handPosition: Position;
  playZonePosition: Position;
  discardPosition: Position;
}

/**
 * Extended AnimationManager with card-specific animations
 * Requirements: 13.1, 13.2, 13.3, 13.4
 */
export class CardAnimationManager extends AnimationManager {
  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  // ============================================
  // Deck Shuffle Animation (Requirement 13.1)
  // ============================================

  /**
   * Animate deck shuffling with card scatter and gather effect
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
   */
  animateDeckShuffleSimple(
    deckContainer: Phaser.GameObjects.Container,
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    
    // Shake and bounce effect
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

  // ============================================
  // Draw Card Animation (Requirement 13.2)
  // ============================================

  /**
   * Animate card moving from deck to hand
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
   * Animate multiple cards being drawn in sequence
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

  // ============================================
  // Play Card Animation (Requirement 13.3)
  // ============================================

  /**
   * Animate card being played from hand to board
   */
  animatePlayCard(
    cardContainer: Phaser.GameObjects.Container,
    toPosition: Position,
    config: TweenConfig = {},
    onComplete?: () => void
  ): Phaser.Tweens.Tween {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    
    // Scale up and move to play position
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
   * Animate card being played with targeting arrow
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

  // ============================================
  // Discard Animation (Requirement 13.4)
  // ============================================

  /**
   * Animate card being discarded
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
   * Animate card flying off screen (for dramatic discard)
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
      case 'left':
        targetX -= distance;
        break;
      case 'right':
        targetX += distance;
        break;
      case 'up':
        targetY -= distance;
        break;
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
 * Create a CardAnimationManager instance
 */
export function createCardAnimationManager(scene: Phaser.Scene): CardAnimationManager {
  return new CardAnimationManager(scene);
}


// ============================================
// Board Animation Extensions
// ============================================

/**
 * Board animation configuration
 */
export interface BoardAnimationConfig {
  squareSize: number;
  boardX: number;
  boardY: number;
  isFlipped: boolean;
}

/**
 * Extended AnimationManager with board-specific animations
 * Requirements: 13.5, 13.6
 */
export class BoardAnimationManager extends CardAnimationManager {
  private boardConfig: BoardAnimationConfig | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  /**
   * Configure board animation settings
   */
  setBoardConfig(config: BoardAnimationConfig): void {
    this.boardConfig = config;
  }

  /**
   * Convert square notation to pixel position
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

  // ============================================
  // Piece Move Animation (Requirement 13.5)
  // ============================================

  /**
   * Animate piece moving from one square to another
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
    
    // Set starting position
    pieceSprite.setPosition(fromPos.x, fromPos.y);
    
    // Lift piece slightly during move
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
   * Animate piece move with capture effect
   */
  animatePieceMoveWithCapture(
    movingPiece: Phaser.GameObjects.Image,
    capturedPiece: Phaser.GameObjects.Image,
    fromSquare: string,
    toSquare: string,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    // First animate the capture (piece being taken)
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

  // ============================================
  // Piece Deploy Animation (Requirement 13.6)
  // ============================================

  /**
   * Animate piece being deployed to a square
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
    
    // Pop in with glow effect
    return scene.tweens.add({
      targets: pieceSprite,
      scaleX: pieceSprite.scaleX || 0.8,
      scaleY: pieceSprite.scaleY || 0.8,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.PIECE_DEPLOY,
      ease: config.ease ?? EASING.BACK_OUT,
      delay: config.delay ?? 0,
      onStart: () => {
        // Create deploy flash effect
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
   * Create a flash effect at deploy position
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
   * Animate piece deploying from a card
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

  // ============================================
  // Piece Destroy Animation (Requirement 13.6)
  // ============================================

  /**
   * Animate piece being destroyed/captured
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
    
    // Shrink and fade out
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
   * Create particle effect for piece destruction
   */
  private createDestroyParticles(scene: Phaser.Scene, x: number, y: number): void {
    // Create multiple small particles
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
   * Animate piece exploding (dramatic destruction)
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
        // Create explosion effect
        this.createExplosionEffect(scene, pos.x, pos.y);
        
        // Destroy piece
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
   * Create explosion visual effect
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
    
    // Particles
    this.createDestroyParticles(scene, x, y);
  }
}

/**
 * Create a BoardAnimationManager instance
 */
export function createBoardAnimationManager(scene: Phaser.Scene): BoardAnimationManager {
  return new BoardAnimationManager(scene);
}


// ============================================
// UI Animation Extensions
// ============================================

/**
 * Full-featured AnimationManager with all game animations
 * Requirements: 13.7
 */
export class GameAnimationManager extends BoardAnimationManager {
  constructor(scene: Phaser.Scene) {
    super(scene);
  }

  // ============================================
  // Clock Change Animation (Requirement 13.7)
  // ============================================

  /**
   * Animate clock time change with visual feedback
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
    
    // Flash the clock
    scene.tweens.add({
      targets: clockContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: config.duration ?? ANIM_DURATION.CLOCK_CHANGE,
      ease: EASING.QUAD_OUT,
      yoyo: true,
      onStart: () => {
        // Apply color tint
        clockContainer.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Image) {
            child.setTint(flashColor);
          }
        });
        config.onStart?.();
      },
      onComplete: () => {
        // Restore original tint
        clockContainer.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Image) {
            child.clearTint();
          }
        });
        onComplete?.();
        config.onComplete?.();
      },
    });
    
    // Animate the text change
    if (timeText) {
      this.animateTextChange(timeText, flashColor, config);
    }
  }

  /**
   * Animate text with color flash
   */
  private animateTextChange(
    text: Phaser.GameObjects.Text,
    flashColor: number,
    config: TweenConfig = {}
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    const originalColor = text.style.color;
    
    // Convert hex color to string
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
   * Animate clock running low warning
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

  // ============================================
  // Energy Change Animation (Requirement 13.7)
  // ============================================

  /**
   * Animate energy bar change
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
    
    // Determine animation based on change
    let flashColor: number;
    if (energyDiff > 0) {
      flashColor = 0x44ff44; // Green for energy gain
    } else {
      flashColor = 0xff8844; // Orange for energy spend
    }
    
    // Bounce effect
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
    
    // Text flash
    if (energyText) {
      this.animateTextChange(energyText, flashColor, config);
    }
    
    // Create floating number indicator
    this.createFloatingNumber(
      scene,
      energyContainer.x,
      energyContainer.y - 30,
      energyDiff,
      flashColor
    );
  }

  /**
   * Create floating number indicator (+X or -X)
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
   * Animate energy cap increase
   */
  animateEnergyCapIncrease(
    energyContainer: Phaser.GameObjects.Container,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    const scene = (this as unknown as { scene: Phaser.Scene }).scene;
    
    // Glow effect
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
    
    // Bounce the container
    scene.tweens.add({
      targets: energyContainer,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: EASING.BACK_OUT,
      yoyo: true,
    });
  }

  // ============================================
  // Victory/Defeat/Draw Animations (Requirement 13.7)
  // ============================================

  /**
   * Animate victory screen reveal
   */
  animateVictory(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    // Start scaled down and transparent
    resultText.setScale(0);
    resultText.setAlpha(0);
    
    // Dramatic reveal
    scene.tweens.add({
      targets: resultText,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.VICTORY_REVEAL,
      ease: EASING.ELASTIC_OUT,
      onComplete: () => {
        // Settle to normal size
        scene.tweens.add({
          targets: resultText,
          scaleX: 1,
          scaleY: 1,
          duration: 300,
          ease: EASING.QUAD_OUT,
          onComplete: () => {
            // Add subtle pulse
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
    
    // Create celebration particles
    this.createVictoryParticles(scene, resultText.x, resultText.y);
  }

  /**
   * Create victory celebration particles
   */
  private createVictoryParticles(scene: Phaser.Scene, x: number, y: number): void {
    const colors = [0xffd700, 0x44ff44, 0x44ffff, 0xff44ff];
    
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 100 + Math.random() * 150;
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const particle = scene.add.graphics();
      particle.fillStyle(color, 1);
      // Draw a simple diamond shape for particles
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
   * Animate defeat screen reveal
   */
  animateDefeat(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    // Start above and transparent
    const targetY = resultText.y;
    resultText.setY(targetY - 100);
    resultText.setAlpha(0);
    
    // Drop down with shake
    scene.tweens.add({
      targets: resultText,
      y: targetY,
      alpha: 1,
      duration: config.duration ?? ANIM_DURATION.VICTORY_REVEAL,
      ease: EASING.BOUNCE_OUT,
      onComplete: () => {
        // Shake effect
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
   * Animate draw screen reveal
   */
  animateDraw(
    scene: Phaser.Scene,
    resultText: Phaser.GameObjects.Text,
    config: TweenConfig = {},
    onComplete?: () => void
  ): void {
    // Start scaled and rotated
    resultText.setScale(2);
    resultText.setAlpha(0);
    resultText.setRotation(-0.1);
    
    // Spin in and settle
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
   * Animate screen transition (fade to black and back)
   */
  animateScreenTransition(
    scene: Phaser.Scene,
    onMidpoint?: () => void,
    onComplete?: () => void
  ): void {
    const { width, height } = scene.scale;
    
    // Create black overlay
    const overlay = scene.add.graphics();
    overlay.fillStyle(0x000000, 1);
    overlay.fillRect(0, 0, width, height);
    overlay.setAlpha(0);
    overlay.setDepth(10000);
    
    // Fade to black
    scene.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 400,
      ease: EASING.QUAD_OUT,
      onComplete: () => {
        onMidpoint?.();
        
        // Fade back
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
   * Create screen shake effect
   */
  screenShake(
    scene: Phaser.Scene,
    intensity: number = 10,
    duration: number = 200
  ): void {
    scene.cameras.main.shake(duration, intensity / 1000);
  }

  /**
   * Create screen flash effect
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
 * Create a full GameAnimationManager instance
 */
export function createGameAnimationManager(scene: Phaser.Scene): GameAnimationManager {
  return new GameAnimationManager(scene);
}
