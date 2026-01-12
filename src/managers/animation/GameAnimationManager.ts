/**
 * @fileoverview Game-level animations (UI and outcomes)
 *
 * @module managers/animation/GameAnimationManager
 */

import Phaser from 'phaser';
import { ANIM_DURATION, EASING } from './constants';
import type { TweenConfig } from './types';
import { BoardAnimationManager } from './BoardAnimationManager';

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
