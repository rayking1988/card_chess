/**
 * @fileoverview Clock Component - Chess clock display with MM:SS format
 * 
 * This component displays a chess clock showing remaining time for a player.
 * It uses a digital display style and provides visual feedback for low time
 * situations (color changes when time is running out).
 * 
 * Requirements addressed:
 * - 4.1: Display on the right side of the chess board for each player
 * - 4.2: Use pixel art from ./dist/clock
 * - 4.6: Display time in MM:SS format with starting value of 10:00
 * 
 * @module components/Clock
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';

/* ============================================
 * CLOCK CONFIGURATION CONSTANTS
 * ============================================
 */

/** Clock display width in pixels */
const CLOCK_WIDTH = 150;

/** Clock display height in pixels */
const CLOCK_HEIGHT = 98;

/** Time threshold for low time warning (seconds) */
const LOW_TIME_THRESHOLD = 60;

/** Text colors for different time states */
const TIME_COLORS = {
  normal: '#000000',      // Black - plenty of time
  warning: '#ff6666',     // Light red - under 60 seconds
  critical: '#ff0000'     // Red - time expired
};

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Formats seconds into MM:SS string format
 * 
 * Algorithm:
 * 1. Ensure non-negative value
 * 2. Calculate minutes by integer division by 60
 * 3. Calculate remaining seconds with modulo 60
 * 4. Pad both values to 2 digits
 * 
 * @param seconds - Time in seconds to format
 * @returns Formatted time string in MM:SS format
 * 
 * @example
 * formatTime(600) // Returns "10:00"
 * formatTime(65)  // Returns "01:05"
 * formatTime(0)   // Returns "00:00"
 * 
 * Used by: ClockComponent.setTime()
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(Math.max(0, seconds) / 60);
  const secs = Math.max(0, seconds) % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/* ============================================
 * CLOCK COMPONENT CLASS
 * ============================================
 */

/**
 * ClockComponent - Visual chess clock display
 * 
 * Displays remaining time for a player in MM:SS format.
 * Provides visual feedback when time is running low.
 * Can be marked as "active" to indicate whose turn it is.
 * 
 * Visual structure:
 * - Background sprite (chess_clock texture)
 * - Label text (above clock, e.g., "Your Time")
 * - Time display text (centered, digital font)
 * 
 * @example
 * // Create a clock for the local player
 * const playerClock = new ClockComponent(scene, 100, 200, 600, 'Your Time');
 * 
 * // Update the time
 * playerClock.setTime(595);
 * 
 * // Mark as active player's clock
 * playerClock.setActive(true);
 * 
 * Used by: GameScene (creates two clocks - player and opponent)
 */
export class ClockComponent {
  /** Container holding all clock visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Background sprite showing the clock face */
  private clockSprite: Phaser.GameObjects.Image;
  
  /** Text displaying the time in MM:SS format */
  private timeText: Phaser.GameObjects.Text;
  
  /** Label text above the clock (e.g., "Your Time") */
  private labelText: Phaser.GameObjects.Text;
  
  /** Current time value in seconds */
  private currentTime: number;
  
  /** Whether this clock belongs to the active player */
  private isActive: boolean = false;

  /**
   * Creates a new ClockComponent
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the clock center
   * @param y - Y position for the clock center
   * @param initialTime - Starting time in seconds (default: 600 = 10:00)
   * @param label - Optional label text to display above the clock
   * 
   * Used by: GameScene.createRightPanel()
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialTime: number = 600,
    label: string = ''
  ) {
    this.currentTime = initialTime;
    
    // Create container to group all clock elements
    this.container = scene.add.container(x, y);
    
    // Add clock background sprite
    // Uses 'chess_clock' texture loaded in BootScene
    this.clockSprite = scene.add.image(0, 0, 'chess_clock');
    this.clockSprite.setDisplaySize(CLOCK_WIDTH, CLOCK_HEIGHT);
    this.container.add(this.clockSprite);
    
    // Add time display text with digital font
    // Positioned slightly above center for visual balance
    this.timeText = scene.add.text(0, -11, formatTime(initialTime), {
      fontSize: '47px',
      fontFamily: 'Digital7, "Courier New"',
      color: TIME_COLORS.normal,
      fontStyle: 'normal'
    }).setOrigin(0.5);
    this.container.add(this.timeText);
    
    // Add optional label text above the clock
    this.labelText = scene.add.text(0, -85, label, {
      fontSize: '32px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.labelText.setVisible(label.trim().length > 0);
    this.container.add(this.labelText);
  }

  /**
   * Updates the displayed time and applies visual feedback
   * 
   * Algorithm:
   * 1. Skip if time hasn't changed (performance optimization)
   * 2. Store the new time value
   * 3. Update the text display
   * 4. Apply color based on time remaining:
   *    - Normal (black): > 60 seconds
   *    - Warning (light red): 1-60 seconds
   *    - Critical (red): 0 seconds
   * 
   * @param seconds - New time value in seconds
   * 
   * Used by: GameScene.updateUI() when clock time changes
   */
  setTime(seconds: number): void {
    // Skip update if time hasn't changed (performance optimization)
    if (seconds === this.currentTime) {
      return;
    }
    
    this.currentTime = seconds;
    this.timeText.setText(formatTime(seconds));
    
    // Apply color based on remaining time
    if (seconds <= 0) {
      this.timeText.setColor(TIME_COLORS.critical);
    } else if (seconds <= LOW_TIME_THRESHOLD) {
      this.timeText.setColor(TIME_COLORS.warning);
    } else {
      this.timeText.setColor(TIME_COLORS.normal);
    }
  }

  /**
   * Gets the current time value
   * 
   * @returns Current time in seconds
   * 
   * Used by: GameScene for time comparisons
   */
  getTime(): number {
    return this.currentTime;
  }

  /**
   * Sets whether this clock belongs to the active player
   * 
   * When active, the clock sprite gets a green tint to indicate
   * it's this player's turn.
   * 
   * @param active - Whether this is the active player's clock
   * 
   * Used by: GameScene.updateUI() on turn changes
   */
  setActive(active: boolean): void {
    this.isActive = active;
    if (active) {
      this.clockSprite.setTint(hex('#aaffaa')); // Light green tint
    } else {
      this.clockSprite.clearTint();
    }
  }

  /**
   * Checks if this clock is marked as active
   * 
   * @returns True if this is the active player's clock
   */
  getActive(): boolean {
    return this.isActive;
  }

  /**
   * Updates the label text above the clock
   * 
   * @param label - New label text to display
   * 
   * Used by: GameScene when player names are updated
   */
  setLabel(label: string): void {
    this.labelText.setText(label);
    this.labelText.setVisible(label.trim().length > 0);
  }

  /**
   * Sets the position of the clock
   * 
   * @param x - New X position
   * @param y - New Y position
   * 
   * Used by: GameScene.positionRightPanel() during layout updates
   */
  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Gets the current position
   * 
   * @returns Object with x and y coordinates
   */
  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  /**
   * Sets the scale of the clock
   * 
   * @param scale - Scale factor (1 = normal size)
   * 
   * Used by: GameScene.positionRightPanel() for responsive scaling
   */
  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  /**
   * Sets the depth (z-index) for layering
   * 
   * @param depth - Depth value (higher = on top)
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  /**
   * Sets visibility of the clock
   * 
   * @param visible - Whether the clock should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Sets the alpha (transparency) of the clock
   * 
   * @param alpha - Alpha value (0 = transparent, 1 = opaque)
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Gets the container for direct manipulation
   * 
   * @returns The Phaser container holding all clock elements
   * 
   * Used by: AnimationManager for clock animations
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Gets the time text object for animations
   * 
   * @returns The Phaser text object displaying the time
   * 
   * Used by: AnimationManager for time change animations
   */
  getTimeText(): Phaser.GameObjects.Text {
    return this.timeText;
  }

  /**
   * Gets the clock dimensions
   * 
   * @returns Object with width and height
   * 
   * Used by: GameScene.positionRightPanel() for layout calculations
   */
  getDimensions(): { width: number; height: number } {
    const clockHalf = CLOCK_HEIGHT / 2;
    const labelExtent = this.labelText.visible
      ? Math.abs(this.labelText.y) + this.labelText.height / 2
      : 0;
    const topExtent = Math.max(clockHalf, labelExtent);
    return { width: CLOCK_WIDTH, height: topExtent + clockHalf };
  }

  /**
   * Destroys the component and cleans up resources
   * 
   * Used by: GameScene.shutdown() for cleanup
   */
  destroy(): void {
    this.container.destroy();
  }
}

/* ============================================
 * FACTORY FUNCTION
 * ============================================
 */

/**
 * Factory function to create a ClockComponent
 * 
 * @param scene - The Phaser scene to add this component to
 * @param x - X position for the clock center
 * @param y - Y position for the clock center
 * @param initialTime - Starting time in seconds (default: 600)
 * @param label - Optional label text
 * @returns A new ClockComponent instance
 * 
 * @example
 * const clock = createClock(this, 100, 200, 600, 'Player 1');
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
