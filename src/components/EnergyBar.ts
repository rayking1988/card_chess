/**
 * @fileoverview EnergyBar Component - Energy resource display
 * 
 * This component displays the player's current energy and energy cap
 * in a visual bar format. Energy is the primary resource for playing
 * non-energy cards.
 * 
 * Requirements addressed:
 * - 6.1: Display on the right side below the clock
 * - 6.2: Start at 0/0 (current/cap)
 * 
 * @module components/EnergyBar
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';

/* ============================================
 * ENERGY BAR CONFIGURATION CONSTANTS
 * ============================================
 */

/** Energy bar width in pixels */
const BAR_WIDTH = 120;

/** Energy bar height in pixels */
const BAR_HEIGHT = 30;

/** Padding inside the bar for the fill */
const FILL_PADDING = 4;

/** Fill colors based on energy level (as ratio of current/cap) */
const FILL_COLORS = {
  high: hex('#44ff44'),      // Green - 75%+ energy
  medium: hex('#ffff44'),    // Yellow - 50-74% energy
  low: hex('#ffaa44'),       // Orange - 25-49% energy
  critical: hex('#ff4444')   // Red - below 25% energy
};

/** Text colors for different energy states */
const TEXT_COLORS = {
  empty: '#888888',    // Gray - no energy system yet (0/0)
  depleted: '#ff6666', // Red - empty (0/X where X > 0)
  full: '#66ff66',     // Green - at capacity
  normal: '#ffffff'    // White - partial energy
};

/* ============================================
 * ENERGY BAR COMPONENT CLASS
 * ============================================
 */

/**
 * EnergyBarComponent - Visual energy resource display
 * 
 * Displays current energy and energy cap in format "X/Y".
 * The bar fills proportionally to show energy level visually.
 * Color changes based on how much energy remains.
 * 
 * Visual structure:
 * - Background bar (dark gray with gold border)
 * - Fill bar (colored based on energy level)
 * - Shine effect (white highlight on fill)
 * - Energy text (current/cap format)
 * - Label text ("Energy")
 * 
 * @example
 * // Create an energy bar
 * const energyBar = new EnergyBarComponent(scene, 100, 400, 'Energy');
 * 
 * // Update energy values
 * energyBar.setEnergy(3, 5); // Shows "3/5" with 60% fill
 * 
 * Used by: GameScene (creates one energy bar for local player)
 */
export class EnergyBarComponent {
  /** Container holding all energy bar visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Graphics for the background bar */
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  
  /** Graphics for the fill bar */
  private fillGraphics: Phaser.GameObjects.Graphics;
  
  /** Text displaying current/cap energy */
  private energyText: Phaser.GameObjects.Text;
  
  /** Label text above the bar */
  private labelText: Phaser.GameObjects.Text;
  
  /** Current energy value */
  private currentEnergy: number = 0;
  
  /** Maximum energy (cap) value */
  private energyCap: number = 0;
  
  /** Cached last displayed energy for change detection */
  private lastDisplayedEnergy: number = -1;
  
  /** Cached last displayed cap for change detection */
  private lastDisplayedCap: number = -1;
  
  /** Reference to the scene for texture cleanup */
  private scene: Phaser.Scene;
  
  /** Background sprite (replaces backgroundGraphics for performance) */
  private backgroundSprite: Phaser.GameObjects.Image | null = null;

  /**
   * Creates a new EnergyBarComponent
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the bar center
   * @param y - Y position for the bar center
   * @param label - Label text to display above the bar (default: 'Energy')
   * 
   * Used by: GameScene.createRightPanel()
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string = 'Energy'
  ) {
    this.scene = scene;
    this.container = scene.add.container(x, y);
    
    // Background graphics - draw then convert to texture for performance
    this.backgroundGraphics = scene.add.graphics();
    this.drawBackground();
    this.convertBackgroundToTexture();
    
    // Fill graphics (drawn on top of background) - this one stays dynamic
    this.fillGraphics = scene.add.graphics();
    this.container.add(this.fillGraphics);
    
    // Energy text (current/cap format)
    this.energyText = scene.add.text(0, 0, '0/0', {
      fontSize: '16px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(this.energyText);
    
    // Label text above the bar
    this.labelText = scene.add.text(0, -25, label, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.container.add(this.labelText);
    
    this.updateDisplay();
  }
  
  /**
   * Converts the background graphics to a texture for better rendering performance
   * 
   * @private
   */
  private convertBackgroundToTexture(): void {
    const textureKey = `energy_bar_bg_${Date.now()}`;
    
    // Generate texture from graphics
    this.backgroundGraphics.generateTexture(textureKey, BAR_WIDTH, BAR_HEIGHT);
    
    // Create sprite from texture
    this.backgroundSprite = this.scene.add.image(0, 0, textureKey);
    this.container.addAt(this.backgroundSprite, 0);
    
    // Hide the original graphics
    this.backgroundGraphics.setVisible(false);
  }

  /**
   * Draws the background bar (called once during construction)
   * 
   * Creates a dark gray rounded rectangle with a gold border.
   * 
   * @private
   */
  private drawBackground(): void {
    this.backgroundGraphics.clear();
    
    // Gold border
    this.backgroundGraphics.lineStyle(2, hex('#ffd700'), 1);
    // Dark gray fill
    this.backgroundGraphics.fillStyle(hex('#333333'), 1);
    
    this.backgroundGraphics.fillRoundedRect(
      -BAR_WIDTH / 2,
      -BAR_HEIGHT / 2,
      BAR_WIDTH,
      BAR_HEIGHT,
      5
    );
    this.backgroundGraphics.strokeRoundedRect(
      -BAR_WIDTH / 2,
      -BAR_HEIGHT / 2,
      BAR_WIDTH,
      BAR_HEIGHT,
      5
    );
  }

  /**
   * Sets both current energy and cap values
   * 
   * @param current - Current energy amount
   * @param cap - Maximum energy (cap)
   * 
   * Used by: GameScene.updateUI()
   */
  setEnergy(current: number, cap: number): void {
    this.currentEnergy = current;
    this.energyCap = cap;
    this.updateDisplay();
  }

  /**
   * Sets only the current energy value
   * 
   * @param current - New current energy amount
   */
  setCurrent(current: number): void {
    this.currentEnergy = current;
    this.updateDisplay();
  }

  /**
   * Sets only the energy cap value
   * 
   * @param cap - New maximum energy
   */
  setCap(cap: number): void {
    this.energyCap = cap;
    this.updateDisplay();
  }

  /**
   * Gets the current energy value
   * 
   * @returns Current energy amount
   */
  getCurrent(): number {
    return this.currentEnergy;
  }

  /**
   * Gets the energy cap value
   * 
   * @returns Maximum energy (cap)
   */
  getCap(): number {
    return this.energyCap;
  }

  /**
   * Updates all visual elements based on current values
   * 
   * Algorithm:
   * 1. Skip update if values haven't changed (performance optimization)
   * 2. Update text to show "current/cap"
   * 3. Clear previous fill graphics
   * 4. If cap > 0, calculate fill ratio and width
   * 5. Choose fill color based on ratio
   * 6. Draw fill bar with rounded corners
   * 7. Add shine effect (white highlight)
   * 8. Update text color based on energy state
   * 
   * @private
   */
  private updateDisplay(): void {
    // Skip update if values haven't changed (performance optimization)
    if (this.currentEnergy === this.lastDisplayedEnergy && 
        this.energyCap === this.lastDisplayedCap) {
      return;
    }
    
    this.lastDisplayedEnergy = this.currentEnergy;
    this.lastDisplayedCap = this.energyCap;
    
    // Update text display
    this.energyText.setText(`${this.currentEnergy}/${this.energyCap}`);
    
    // Clear previous fill
    this.fillGraphics.clear();
    
    // Draw fill bar if cap > 0
    if (this.energyCap > 0) {
      const fillRatio = this.currentEnergy / this.energyCap;
      const fillWidth = (BAR_WIDTH - FILL_PADDING * 2) * fillRatio;
      
      // Choose color based on energy level
      let fillColor: number;
      if (fillRatio >= 0.75) {
        fillColor = FILL_COLORS.high;
      } else if (fillRatio >= 0.5) {
        fillColor = FILL_COLORS.medium;
      } else if (fillRatio >= 0.25) {
        fillColor = FILL_COLORS.low;
      } else {
        fillColor = FILL_COLORS.critical;
      }
      
      // Draw the fill bar
      this.fillGraphics.fillStyle(fillColor, 0.8);
      this.fillGraphics.fillRoundedRect(
        -BAR_WIDTH / 2 + FILL_PADDING,
        -BAR_HEIGHT / 2 + FILL_PADDING,
        fillWidth,
        BAR_HEIGHT - FILL_PADDING * 2,
        3
      );
      
      // Add shine effect (white highlight on top third)
      this.fillGraphics.fillStyle(hex('#ffffff'), 0.3);
      this.fillGraphics.fillRoundedRect(
        -BAR_WIDTH / 2 + FILL_PADDING,
        -BAR_HEIGHT / 2 + FILL_PADDING,
        fillWidth,
        (BAR_HEIGHT - FILL_PADDING * 2) / 3,
        3
      );
    }
    
    // Update text color based on energy state
    if (this.currentEnergy === 0 && this.energyCap === 0) {
      // No energy system yet
      this.energyText.setColor(TEXT_COLORS.empty);
    } else if (this.currentEnergy === 0) {
      // Depleted
      this.energyText.setColor(TEXT_COLORS.depleted);
    } else if (this.currentEnergy === this.energyCap) {
      // Full
      this.energyText.setColor(TEXT_COLORS.full);
    } else {
      // Partial
      this.energyText.setColor(TEXT_COLORS.normal);
    }
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
   * Sets the position of the energy bar
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
   * Sets the scale of the energy bar
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
   * Sets visibility of the energy bar
   * 
   * @param visible - Whether the bar should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Sets the alpha (transparency) of the energy bar
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
   * Gets the energy text object for animations
   * 
   * @returns The Phaser text object
   */
  getEnergyText(): Phaser.GameObjects.Text {
    return this.energyText;
  }

  /**
   * Gets the energy bar dimensions
   * 
   * @returns Object with width and height
   */
  getDimensions(): { width: number; height: number } {
    return { width: BAR_WIDTH, height: BAR_HEIGHT };
  }

  /**
   * Destroys the component and cleans up resources
   */
  destroy(): void {
    // Clean up background texture
    if (this.backgroundSprite) {
      const textureKey = this.backgroundSprite.texture.key;
      this.backgroundSprite.destroy();
      this.scene.textures.remove(textureKey);
    }
    
    this.container.destroy();
  }
}

/* ============================================
 * FACTORY FUNCTION
 * ============================================
 */

/**
 * Factory function to create an EnergyBarComponent
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @param label - Label text (default: 'Energy')
 * @returns A new EnergyBarComponent instance
 */
export function createEnergyBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string = 'Energy'
): EnergyBarComponent {
  return new EnergyBarComponent(scene, x, y, label);
}
