/**
 * Clock Component - Chess clock display showing MM:SS format
 * 
 * Requirements: 4.1, 4.2, 4.6
 * - 4.1: Display on the right side of the chess board for each player
 * - 4.2: Use pixel art from ./dist/clock
 * - 4.6: Display time in MM:SS format with starting value of 10:00
 */

import Phaser from 'phaser';

// Clock dimensions - adjust CLOCK_HEIGHT to make it taller
const CLOCK_WIDTH = 120;
const CLOCK_HEIGHT = 120;

/**
 * Format seconds into MM:SS string
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * ClockComponent - Phaser visual component for chess clock display
 */
export class ClockComponent {
  private container: Phaser.GameObjects.Container;
  private clockSprite: Phaser.GameObjects.Image;
  private timeText: Phaser.GameObjects.Text;
  private labelText: Phaser.GameObjects.Text;
  private currentTime: number;
  private isActive: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialTime: number = 600,
    label: string = ''
  ) {
    this.currentTime = initialTime;
    
    this.container = scene.add.container(x, y);
    
    // Clock background sprite (Requirement 4.2)
    this.clockSprite = scene.add.image(0, 0, 'chess_clock');
    this.clockSprite.setDisplaySize(CLOCK_WIDTH, CLOCK_HEIGHT);
    this.container.add(this.clockSprite);
    
    // Time display text (Requirement 4.6: MM:SS format)
    // Using 7-segment LED display style font
    this.timeText = scene.add.text(0, -5, formatTime(initialTime), {
      fontSize: '30px',
      fontFamily: 'Digital7, "Courier New"',
      color: '#000000',
      fontStyle: 'normal'
    }).setOrigin(0.5);
    this.container.add(this.timeText);
    
    // Optional label (e.g., "Your Time" or "Opponent")
    this.labelText = scene.add.text(0, -35, label, {
      fontSize: '32px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.container.add(this.labelText);
  }

  /**
   * Update the displayed time
   * @param seconds Time in seconds
   */
  setTime(seconds: number): void {
    this.currentTime = seconds;
    this.timeText.setText(formatTime(seconds));
    
    // Visual feedback for low time (under 60 seconds)
    if (seconds <= 60 && seconds > 0) {
      this.timeText.setColor('#ff6666');
    } else if (seconds <= 0) {
      this.timeText.setColor('#ff0000');
    } else {
      this.timeText.setColor('#000000');
    }
  }

  /**
   * Get current time value
   */
  getTime(): number {
    return this.currentTime;
  }

  /**
   * Set whether this clock is for the active player
   */
  setActive(active: boolean): void {
    this.isActive = active;
    // Visual indication of active clock
    if (active) {
      this.clockSprite.setTint(0xaaffaa);
    } else {
      this.clockSprite.clearTint();
    }
  }

  /**
   * Check if clock is active
   */
  getActive(): boolean {
    return this.isActive;
  }

  /**
   * Set the label text
   */
  setLabel(label: string): void {
    this.labelText.setText(label);
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
    return { width: CLOCK_WIDTH, height: CLOCK_HEIGHT };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Create a clock component
 */
export function createClock(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialTime: number = 600,
  label: string = ''
): ClockComponent {
  return new ClockComponent(scene, x, y, initialTime, label);
}
