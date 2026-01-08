/**
 * EnergyBar Component - Energy resource display showing current/cap format
 * 
 * Requirements: 6.1, 6.2
 * - 6.1: Display on the right side below the clock
 * - 6.2: Start at 0/0 (current/cap)
 */

import Phaser from 'phaser';

// EnergyBar dimensions
const BAR_WIDTH = 120;
const BAR_HEIGHT = 30;
const FILL_PADDING = 4;

/**
 * EnergyBarComponent - Phaser visual component for energy display
 */
export class EnergyBarComponent {
  private container: Phaser.GameObjects.Container;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private fillGraphics: Phaser.GameObjects.Graphics;
  private energyText: Phaser.GameObjects.Text;
  private labelText: Phaser.GameObjects.Text;
  private currentEnergy: number = 0;
  private energyCap: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string = 'Energy'
  ) {
    this.container = scene.add.container(x, y);
    
    // Background graphics
    this.backgroundGraphics = scene.add.graphics();
    this.container.add(this.backgroundGraphics);
    
    // Fill graphics
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
    
    // Label text
    this.labelText = scene.add.text(0, -25, label, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.container.add(this.labelText);
    
    this.drawBackground();
    this.updateDisplay();
  }

  /**
   * Draw the background bar
   */
  private drawBackground(): void {
    this.backgroundGraphics.clear();
    
    // Outer border
    this.backgroundGraphics.lineStyle(2, 0xffd700, 1);
    this.backgroundGraphics.fillStyle(0x333333, 1);
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
   * Update the energy values
   * @param current Current energy
   * @param cap Energy cap
   */
  setEnergy(current: number, cap: number): void {
    this.currentEnergy = current;
    this.energyCap = cap;
    this.updateDisplay();
  }

  /**
   * Set current energy only
   */
  setCurrent(current: number): void {
    this.currentEnergy = current;
    this.updateDisplay();
  }

  /**
   * Set energy cap only
   */
  setCap(cap: number): void {
    this.energyCap = cap;
    this.updateDisplay();
  }

  /**
   * Get current energy
   */
  getCurrent(): number {
    return this.currentEnergy;
  }

  /**
   * Get energy cap
   */
  getCap(): number {
    return this.energyCap;
  }

  /**
   * Update the visual display
   */
  private updateDisplay(): void {
    // Update text
    this.energyText.setText(`${this.currentEnergy}/${this.energyCap}`);
    
    // Update fill bar
    this.fillGraphics.clear();
    
    if (this.energyCap > 0) {
      const fillRatio = this.currentEnergy / this.energyCap;
      const fillWidth = (BAR_WIDTH - FILL_PADDING * 2) * fillRatio;
      
      // Gradient-like fill based on energy level
      let fillColor: number;
      if (fillRatio >= 0.75) {
        fillColor = 0x44ff44; // Green - high energy
      } else if (fillRatio >= 0.5) {
        fillColor = 0xffff44; // Yellow - medium energy
      } else if (fillRatio >= 0.25) {
        fillColor = 0xffaa44; // Orange - low energy
      } else {
        fillColor = 0xff4444; // Red - very low energy
      }
      
      this.fillGraphics.fillStyle(fillColor, 0.8);
      this.fillGraphics.fillRoundedRect(
        -BAR_WIDTH / 2 + FILL_PADDING,
        -BAR_HEIGHT / 2 + FILL_PADDING,
        fillWidth,
        BAR_HEIGHT - FILL_PADDING * 2,
        3
      );
      
      // Add shine effect
      this.fillGraphics.fillStyle(0xffffff, 0.3);
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
      this.energyText.setColor('#888888'); // Gray when no energy system yet
    } else if (this.currentEnergy === 0) {
      this.energyText.setColor('#ff6666'); // Red when empty
    } else if (this.currentEnergy === this.energyCap) {
      this.energyText.setColor('#66ff66'); // Green when full
    } else {
      this.energyText.setColor('#ffffff'); // White otherwise
    }
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
    return { width: BAR_WIDTH, height: BAR_HEIGHT };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Create an energy bar component
 */
export function createEnergyBar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string = 'Energy'
): EnergyBarComponent {
  return new EnergyBarComponent(scene, x, y, label);
}
