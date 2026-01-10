/**
 * @fileoverview Stopwatch Component - Turn time cost tracker with threshold warnings
 * 
 * This component tracks accumulated time costs during a player's turn.
 * When the stopwatch reaches 60 seconds, the opponent draws a card.
 * Visual feedback warns players as they approach the threshold.
 * 
 * Requirements addressed:
 * - 5.1: Display below the clock using asset ./dist/stopwatch
 * - 5.2: Track accumulated time cost per turn
 * - 5.3: At 60+ seconds, subtract 60 and opponent draws 1 card
 * 
 * @module components/Stopwatch
 * @requires phaser
 */

import Phaser from 'phaser';

/* ============================================
 * STOPWATCH CONFIGURATION CONSTANTS
 * ============================================
 */

/** Stopwatch display width in pixels */
const STOPWATCH_WIDTH = 100;

/** Stopwatch display height in pixels */
const STOPWATCH_HEIGHT = 100;

/** Radius for warning circle textures */
const WARNING_CIRCLE_RADIUS = STOPWATCH_WIDTH / 2 + 10;

/** 
 * Threshold in seconds that triggers opponent card draw
 * When stopwatch reaches this value, 60 is subtracted and opponent draws
 */
const THRESHOLD_SECONDS = 60;

/** Progress thresholds for visual warnings (as percentage of threshold) */
const WARNING_THRESHOLDS = {
  low: 0.25,      // 25% - Yellow tint starts
  medium: 0.5,    // 50% - Orange tint
  high: 0.75      // 75% - Red tint
};

/** Colors for different warning levels */
const WARNING_COLORS = {
  normal: '#ffffff',   // White - safe
  low: '#ffff44',      // Yellow - approaching threshold
  medium: '#ffaa44',   // Orange - getting close
  high: '#ff4444'      // Red - near threshold
};

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Formats stopwatch time into two-digit seconds display
 * 
 * @param seconds - Time in seconds to format
 * @returns Two-digit string representation
 * 
 * @example
 * formatStopwatchTime(5)  // Returns "05"
 * formatStopwatchTime(45) // Returns "45"
 */
function formatStopwatchTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return safeSeconds.toString().padStart(2, '0');
}

/* ============================================
 * STOPWATCH COMPONENT CLASS
 * ============================================
 */

/**
 * StopwatchComponent - Visual turn time tracker
 * 
 * Displays accumulated time cost for the current turn.
 * Provides visual warnings as the player approaches the 60-second threshold.
 * When threshold is crossed, opponent draws a card.
 * 
 * Visual structure:
 * - Warning background (colored circle based on progress)
 * - Progress arc (shows progress toward threshold)
 * - Stopwatch sprite (background image)
 * - Label text ("Turn Timer")
 * - Time display (two-digit seconds)
 * - Threshold indicator (shows card draw status)
 * 
 * @example
 * // Create a stopwatch
 * const stopwatch = new StopwatchComponent(scene, 100, 300);
 * 
 * // Add time when cards are played
 * stopwatch.addTime(10);
 * 
 * // Reset at end of turn
 * stopwatch.reset();
 * 
 * Used by: GameScene (creates two stopwatches - player and opponent)
 */
export class StopwatchComponent {
  /** Container holding all stopwatch visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Background sprite showing the stopwatch face */
  private stopwatchSprite: Phaser.GameObjects.Image;
  
  /** Text displaying the current time */
  private timeText: Phaser.GameObjects.Text;
  
  /** Text showing threshold status */
  private thresholdText: Phaser.GameObjects.Text;
  
  /** Label text above the stopwatch */
  private labelText: Phaser.GameObjects.Text;
  
  /** Graphics for warning background and progress arc */
  private warningGraphics: Phaser.GameObjects.Graphics;
  
  /** Sprite for warning background circle (converted from Graphics for performance) */
  private warningSprite: Phaser.GameObjects.Image | null = null;
  
  /** Sprite for progress arc (converted from Graphics for performance) */
  private progressSprite: Phaser.GameObjects.Image | null = null;
  
  /** Reference to the scene for texture generation */
  private scene: Phaser.Scene;
  
  /** Current accumulated time in seconds */
  private currentTime: number = 0;
  
  /** Cached display time (floored seconds) for change detection */
  private lastDisplayedTime: number = -1;
  
  /** Cached warning level for change detection */
  private lastWarningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
  
  /** Cached progress segment (0-59) for arc updates */
  private lastProgressSegment: number = -1;
  
  /** Unique ID for texture naming */
  private textureId: string;

  /**
   * Creates a new StopwatchComponent
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the stopwatch center
   * @param y - Y position for the stopwatch center
   * 
   * Used by: GameScene.createRightPanel()
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number
  ) {
    this.scene = scene;
    this.textureId = `stopwatch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.container = scene.add.container(x, y);
    
    // Warning background graphics (drawn behind everything, converted to texture)
    this.warningGraphics = scene.add.graphics();
    this.warningGraphics.setVisible(false); // Hidden after texture conversion
    this.container.add(this.warningGraphics);
    
    // Stopwatch background sprite
    this.stopwatchSprite = scene.add.image(0, 0, 'stopwatch');
    this.stopwatchSprite.setDisplaySize(STOPWATCH_WIDTH, STOPWATCH_HEIGHT);
    this.container.add(this.stopwatchSprite);
    
    // Label text above stopwatch
    this.labelText = scene.add.text(0, -55, 'Turn Timer', {
      fontSize: '14px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.labelText);
    
    // Time display (digital style)
    this.timeText = scene.add.text(0, -4, '00', {
      fontSize: '24px',
      fontFamily: 'Digital7, "Courier New"',
      color: '#ffffff',
      fontStyle: 'normal'
    }).setOrigin(0.5);
    this.container.add(this.timeText);
    
    // Threshold indicator below stopwatch
    this.thresholdText = scene.add.text(0, 46, `Draw @ ${THRESHOLD_SECONDS}s`, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#888888'
    }).setOrigin(0.5);
    this.container.add(this.thresholdText);
    
    // Pre-generate warning circle textures for each level
    this.generateWarningTextures();
    
    this.updateDisplay();
  }
  
  /**
   * Pre-generates warning circle textures for each warning level
   * This avoids re-triangulating Graphics every frame
   * 
   * @private
   */
  private generateWarningTextures(): void {
    const textureSize = WARNING_CIRCLE_RADIUS * 2 + 4;
    const center = textureSize / 2;
    
    // Generate high warning texture (red circle)
    const highGraphics = this.scene.add.graphics();
    highGraphics.fillStyle(0xff0000, 0.25);
    highGraphics.fillCircle(center, center, STOPWATCH_WIDTH / 2 + 8);
    highGraphics.generateTexture(`${this.textureId}_warning_high`, textureSize, textureSize);
    highGraphics.destroy();
    
    // Generate medium warning texture (orange circle)
    const mediumGraphics = this.scene.add.graphics();
    mediumGraphics.fillStyle(0xffaa00, 0.2);
    mediumGraphics.fillCircle(center, center, STOPWATCH_WIDTH / 2 + 6);
    mediumGraphics.generateTexture(`${this.textureId}_warning_medium`, textureSize, textureSize);
    mediumGraphics.destroy();
  }

  /**
   * Sets the accumulated time directly
   * 
   * @param seconds - New time value in seconds
   * 
   * Used by: GameScene.updateUI() for syncing with game state
   */
  setTime(seconds: number): void {
    this.currentTime = seconds;
    this.updateDisplay();
  }

  /**
   * Adds time to the stopwatch
   * 
   * Called when a card is played or action is taken that costs time.
   * 
   * @param seconds - Seconds to add
   * 
   * Used by: GameScene when cards are played
   */
  addTime(seconds: number): void {
    this.currentTime += seconds;
    this.updateDisplay();
  }

  /**
   * Resets the stopwatch to 0
   * 
   * Called at the end of each turn.
   * 
   * Used by: GameScene.endTurn()
   */
  reset(): void {
    this.currentTime = 0;
    this.updateDisplay();
  }

  /**
   * Gets the current accumulated time
   * 
   * @returns Current time in seconds
   */
  getTime(): number {
    return this.currentTime;
  }

  /**
   * Checks if the threshold has been reached
   * 
   * @returns True if time >= 60 seconds
   */
  isThresholdReached(): boolean {
    return this.currentTime >= THRESHOLD_SECONDS;
  }

  /**
   * Gets how many times the threshold has been crossed
   * 
   * Each crossing means the opponent draws a card.
   * 
   * @returns Number of threshold crossings (floor of time/60)
   * 
   * Used by: GameStateManager.processStopwatchThreshold()
   */
  getThresholdCrossings(): number {
    return Math.floor(this.currentTime / THRESHOLD_SECONDS);
  }

  /**
   * Updates all visual elements based on current time
   * 
   * Algorithm:
   * 1. Check if visual state has changed (skip if not)
   * 2. Update time text display
   * 3. Calculate progress toward threshold (0-1)
   * 4. Clear and redraw warning graphics only if warning level changed
   * 5. Apply color based on progress level
   * 6. Draw progress arc around stopwatch
   * 7. Update threshold indicator text
   * 
   * @private
   */
  private updateDisplay(): void {
    const displayTime = Math.floor(this.currentTime);
    const progressSegment = Math.floor(this.currentTime) % THRESHOLD_SECONDS;
    
    // Determine current warning level
    let currentWarningLevel: 'none' | 'low' | 'medium' | 'high' = 'none';
    if (this.currentTime >= THRESHOLD_SECONDS * WARNING_THRESHOLDS.high) {
      currentWarningLevel = 'high';
    } else if (this.currentTime >= THRESHOLD_SECONDS * WARNING_THRESHOLDS.medium) {
      currentWarningLevel = 'medium';
    } else if (this.currentTime >= THRESHOLD_SECONDS * WARNING_THRESHOLDS.low) {
      currentWarningLevel = 'low';
    }
    
    // Skip update if nothing changed (performance optimization)
    const warningChanged = currentWarningLevel !== this.lastWarningLevel;
    const progressChanged = progressSegment !== this.lastProgressSegment;
    const timeChanged = displayTime !== this.lastDisplayedTime;
    
    if (!timeChanged && !warningChanged && !progressChanged) {
      return;
    }
    
    // Update time text only if it changed
    if (timeChanged) {
      this.timeText.setText(formatStopwatchTime(this.currentTime));
      this.lastDisplayedTime = displayTime;
    }
    
    // Update warning circle sprite if warning level changed
    if (warningChanged) {
      this.lastWarningLevel = currentWarningLevel;
      
      // Remove old warning sprite
      if (this.warningSprite) {
        this.warningSprite.destroy();
        this.warningSprite = null;
      }
      
      // Apply warning colors based on progress
      if (currentWarningLevel === 'high') {
        this.timeText.setColor(WARNING_COLORS.high);
        this.warningSprite = this.scene.add.image(0, 0, `${this.textureId}_warning_high`);
        this.container.addAt(this.warningSprite, 0);
      } else if (currentWarningLevel === 'medium') {
        this.timeText.setColor(WARNING_COLORS.medium);
        this.warningSprite = this.scene.add.image(0, 0, `${this.textureId}_warning_medium`);
        this.container.addAt(this.warningSprite, 0);
      } else if (currentWarningLevel === 'low') {
        this.timeText.setColor(WARNING_COLORS.low);
      } else {
        this.timeText.setColor(WARNING_COLORS.normal);
      }
      
      // Update threshold indicator
      const crossings = this.getThresholdCrossings();
      if (crossings > 0) {
        const plural = crossings > 1 ? 's' : '';
        this.thresholdText.setText(`+${crossings} card${plural}`);
        this.thresholdText.setColor('#66ff66');
      } else {
        this.thresholdText.setText(`Draw @ ${THRESHOLD_SECONDS}s`);
        this.thresholdText.setColor('#888888');
      }
    }
    
    // Update progress arc if progress changed (only when time > 0)
    if (progressChanged || warningChanged) {
      this.lastProgressSegment = progressSegment;
      this.updateProgressArc();
    }
  }
  
  /**
   * Updates the progress arc sprite
   * Generates a new texture for the current progress and displays it
   * 
   * @private
   */
  private updateProgressArc(): void {
    // Remove old progress sprite
    if (this.progressSprite) {
      const oldKey = this.progressSprite.texture.key;
      this.progressSprite.destroy();
      this.progressSprite = null;
      // Clean up old texture
      if (oldKey.startsWith(`${this.textureId}_progress_`)) {
        this.scene.textures.remove(oldKey);
      }
    }
    
    if (this.currentTime <= 0) {
      return;
    }
    
    // Calculate progress toward threshold (wraps at 60)
    const progress = (this.currentTime % THRESHOLD_SECONDS) / THRESHOLD_SECONDS;
    const textureSize = WARNING_CIRCLE_RADIUS * 2 + 4;
    const center = textureSize / 2;
    
    // Generate progress arc texture
    const arcGraphics = this.scene.add.graphics();
    arcGraphics.lineStyle(4, this.getProgressColor(), 0.9);
    arcGraphics.beginPath();
    arcGraphics.arc(
      center, center,
      STOPWATCH_WIDTH / 2 + 10,
      -Math.PI / 2,
      -Math.PI / 2 + (progress * Math.PI * 2),
      false
    );
    arcGraphics.strokePath();
    
    const progressKey = `${this.textureId}_progress_${this.lastProgressSegment}`;
    arcGraphics.generateTexture(progressKey, textureSize, textureSize);
    arcGraphics.destroy();
    
    // Create sprite from texture
    this.progressSprite = this.scene.add.image(0, 0, progressKey);
    // Add after warning sprite but before stopwatch sprite
    const insertIndex = this.warningSprite ? 1 : 0;
    this.container.addAt(this.progressSprite, insertIndex);
  }

  /**
   * Gets the color for the progress arc based on current progress
   * 
   * @returns Hex color value
   * @private
   */
  private getProgressColor(): number {
    const progress = (this.currentTime % THRESHOLD_SECONDS) / THRESHOLD_SECONDS;
    if (progress >= WARNING_THRESHOLDS.high) return 0xff4444;
    if (progress >= WARNING_THRESHOLDS.medium) return 0xffaa44;
    if (progress >= WARNING_THRESHOLDS.low) return 0xffff44;
    return 0x44ff44;
  }

  /**
   * Sets the position of the stopwatch
   * 
   * @param x - New X position
   * @param y - New Y position
   * 
   * Used by: GameScene.positionRightPanel()
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
   * Sets the scale of the stopwatch
   * 
   * @param scale - Scale factor (1 = normal size)
   * 
   * Used by: GameScene.positionRightPanel()
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
   * Sets visibility of the stopwatch
   * 
   * @param visible - Whether the stopwatch should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Sets the alpha (transparency) of the stopwatch
   * 
   * @param alpha - Alpha value (0 = transparent, 1 = opaque)
   */
  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  /**
   * Gets the container for direct manipulation
   * 
   * @returns The Phaser container
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /**
   * Gets the time text object for animations
   * 
   * @returns The Phaser text object
   */
  getTimeText(): Phaser.GameObjects.Text {
    return this.timeText;
  }

  /**
   * Updates the label text
   * 
   * @param label - New label text
   */
  setLabel(label: string): void {
    this.labelText.setText(label);
  }

  /**
   * Gets the stopwatch dimensions
   * 
   * @returns Object with width and height
   */
  getDimensions(): { width: number; height: number } {
    return { width: STOPWATCH_WIDTH, height: STOPWATCH_HEIGHT };
  }

  /**
   * Destroys the component and cleans up resources
   */
  destroy(): void {
    // Clean up warning textures
    this.scene.textures.remove(`${this.textureId}_warning_high`);
    this.scene.textures.remove(`${this.textureId}_warning_medium`);
    
    // Clean up progress texture
    if (this.progressSprite) {
      const progressKey = this.progressSprite.texture.key;
      this.progressSprite.destroy();
      if (progressKey.startsWith(`${this.textureId}_progress_`)) {
        this.scene.textures.remove(progressKey);
      }
    }
    
    // Clean up warning sprite
    if (this.warningSprite) {
      this.warningSprite.destroy();
    }
    
    this.container.destroy();
  }
}

/* ============================================
 * FACTORY FUNCTION
 * ============================================
 */

/**
 * Factory function to create a StopwatchComponent
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @returns A new StopwatchComponent instance
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
