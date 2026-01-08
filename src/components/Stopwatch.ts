/**
 * Stopwatch Component - Turn time cost tracker with threshold warnings
 * 
 * Requirements: 5.1, 5.2
 * - 5.1: Display below the clock using asset ./dist/stopwatch
 * - 5.2: Track accumulated time cost per turn
 */

import Phaser from 'phaser';

// Stopwatch dimensions
const STOPWATCH_WIDTH = 80;
const STOPWATCH_HEIGHT = 80;

// Threshold for opponent card draw (Requirement 5.3)
const THRESHOLD_SECONDS = 60;

/**
 * StopwatchComponent - Phaser visual component for turn time tracking
 */
export class StopwatchComponent {
  private container: Phaser.GameObjects.Container;
  private stopwatchSprite: Phaser.GameObjects.Image;
  private timeText: Phaser.GameObjects.Text;
  private thresholdText: Phaser.GameObjects.Text;
  private warningGraphics: Phaser.GameObjects.Graphics;
  private currentTime: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    this.container = scene.add.container(x, y);
    
    // Warning background graphics (for threshold warnings)
    this.warningGraphics = scene.add.graphics();
    this.container.add(this.warningGraphics);
    
    // Stopwatch sprite (Requirement 5.1)
    this.stopwatchSprite = scene.add.image(0, 0, 'stopwatch');
    this.stopwatchSprite.setDisplaySize(STOPWATCH_WIDTH, STOPWATCH_HEIGHT);
    this.container.add(this.stopwatchSprite);
    
    // Time display text
    this.timeText = scene.add.text(0, 0, '0s', {
      fontSize: '18px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.timeText);
    
    // Threshold indicator text
    this.thresholdText = scene.add.text(0, 45, `/ ${THRESHOLD_SECONDS}s`, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#888888'
    }).setOrigin(0.5);
    this.container.add(this.thresholdText);
    
    this.updateDisplay();
  }

  /**
   * Update the accumulated time
   * @param seconds Accumulated time cost this turn
   */
  setTime(seconds: number): void {
    this.currentTime = seconds;
    this.updateDisplay();
  }

  /**
   * Add time to the stopwatch
   * @param seconds Seconds to add
   */
  addTime(seconds: number): void {
    this.currentTime += seconds;
    this.updateDisplay();
  }

  /**
   * Reset the stopwatch to 0
   */
  reset(): void {
    this.currentTime = 0;
    this.updateDisplay();
  }

  /**
   * Get current accumulated time
   */
  getTime(): number {
    return this.currentTime;
  }

  /**
   * Check if threshold is reached
   */
  isThresholdReached(): boolean {
    return this.currentTime >= THRESHOLD_SECONDS;
  }

  /**
   * Get how many times threshold has been crossed
   */
  getThresholdCrossings(): number {
    return Math.floor(this.currentTime / THRESHOLD_SECONDS);
  }

  /**
   * Update the visual display
   */
  private updateDisplay(): void {
    // Update time text
    this.timeText.setText(`${this.currentTime}s`);
    
    // Calculate progress toward threshold
    const progress = (this.currentTime % THRESHOLD_SECONDS) / THRESHOLD_SECONDS;
    
    // Update warning graphics
    this.warningGraphics.clear();
    
    if (this.currentTime >= THRESHOLD_SECONDS * 0.75) {
      // High warning - red tint
      this.timeText.setColor('#ff4444');
      this.warningGraphics.fillStyle(0xff0000, 0.2);
      this.warningGraphics.fillCircle(0, 0, STOPWATCH_WIDTH / 2 + 5);
    } else if (this.currentTime >= THRESHOLD_SECONDS * 0.5) {
      // Medium warning - orange tint
      this.timeText.setColor('#ffaa44');
      this.warningGraphics.fillStyle(0xffaa00, 0.15);
      this.warningGraphics.fillCircle(0, 0, STOPWATCH_WIDTH / 2 + 3);
    } else if (this.currentTime >= THRESHOLD_SECONDS * 0.25) {
      // Low warning - yellow tint
      this.timeText.setColor('#ffff44');
    } else {
      // Normal - white
      this.timeText.setColor('#ffffff');
    }
    
    // Draw progress arc
    if (this.currentTime > 0) {
      this.warningGraphics.lineStyle(3, this.getProgressColor(), 0.8);
      this.warningGraphics.beginPath();
      this.warningGraphics.arc(
        0, 0,
        STOPWATCH_WIDTH / 2 + 8,
        -Math.PI / 2,
        -Math.PI / 2 + (progress * Math.PI * 2),
        false
      );
      this.warningGraphics.strokePath();
    }
  }

  /**
   * Get color based on progress
   */
  private getProgressColor(): number {
    const progress = (this.currentTime % THRESHOLD_SECONDS) / THRESHOLD_SECONDS;
    if (progress >= 0.75) return 0xff4444;
    if (progress >= 0.5) return 0xffaa44;
    if (progress >= 0.25) return 0xffff44;
    return 0x44ff44;
  }

  /**
   * Set position
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Get position
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Set scale
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  /**
   * Set depth (z-index)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Set alpha
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Get the container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Get dimensions
   */
  getDimensions(): { width: number; height: number } {
    return { width: STOPWATCH_WIDTH, height: STOPWATCH_HEIGHT };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Create a stopwatch component
 */
export function createStopwatch(
  scene: Phaser.Scene,
  x: number,
  y: number
): StopwatchComponent {
  return new StopwatchComponent(scene, x, y);
}

// Export threshold constant for external use
export { THRESHOLD_SECONDS };
