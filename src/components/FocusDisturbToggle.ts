/**
 * FocusDisturbToggle Component - Toggle button for Focus/Disturb mode
 * 
 * Requirements: 8.5
 * - 8.5: Use switch_focus.png and switch_disturb.png images
 */

import Phaser from 'phaser';

// Toggle dimensions
const TOGGLE_WIDTH = 80;
const TOGGLE_HEIGHT = 40;

export type ToggleMode = 'focus' | 'disturb';

/**
 * FocusDisturbToggleComponent - Phaser visual component for mode toggle
 * Uses switch_focus.png and switch_disturb.png images
 */
export class FocusDisturbToggleComponent {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private focusSprite: Phaser.GameObjects.Image | null = null;
  private disturbSprite: Phaser.GameObjects.Image | null = null;
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;
  
  private currentMode: ToggleMode = 'focus';
  private isEnabled: boolean = true;
  
  // Callback for mode change
  public onModeChange?: (mode: ToggleMode) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialMode: ToggleMode = 'focus'
  ) {
    this.scene = scene;
    this.currentMode = initialMode;
    
    this.container = scene.add.container(x, y);
    
    // Background graphics (fallback if sprites not available)
    this.backgroundGraphics = scene.add.graphics();
    this.container.add(this.backgroundGraphics);
    
    // Load focus sprite if available
    if (scene.textures.exists('switch_focus')) {
      this.focusSprite = scene.add.image(0, 0, 'switch_focus');
      this.focusSprite.setDisplaySize(TOGGLE_WIDTH, TOGGLE_HEIGHT);
      this.container.add(this.focusSprite);
    }
    
    // Load disturb sprite if available
    if (scene.textures.exists('switch_disturb')) {
      this.disturbSprite = scene.add.image(0, 0, 'switch_disturb');
      this.disturbSprite.setDisplaySize(TOGGLE_WIDTH, TOGGLE_HEIGHT);
      this.container.add(this.disturbSprite);
    }
    
    // Label text above toggle
    this.labelText = scene.add.text(0, -30, 'Mode', {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.container.add(this.labelText);
    
    this.updateVisuals();
    this.setupInteraction();
  }

  /**
   * Update visuals based on current mode
   */
  private updateVisuals(): void {
    if (this.focusSprite && this.disturbSprite) {
      // Show appropriate sprite based on mode
      this.focusSprite.setVisible(this.currentMode === 'focus');
      this.disturbSprite.setVisible(this.currentMode === 'disturb');
      this.backgroundGraphics.setVisible(false);
    } else {
      // Fallback: draw toggle with graphics
      this.backgroundGraphics.setVisible(true);
      this.backgroundGraphics.clear();
      
      const bgColor = this.currentMode === 'focus' ? 0x225522 : 0x552222;
      const borderColor = this.currentMode === 'focus' ? 0x44ff44 : 0xff4444;
      
      this.backgroundGraphics.fillStyle(bgColor, 1);
      this.backgroundGraphics.fillRoundedRect(
        -TOGGLE_WIDTH / 2,
        -TOGGLE_HEIGHT / 2,
        TOGGLE_WIDTH,
        TOGGLE_HEIGHT,
        8
      );
      
      this.backgroundGraphics.lineStyle(2, borderColor, 1);
      this.backgroundGraphics.strokeRoundedRect(
        -TOGGLE_WIDTH / 2,
        -TOGGLE_HEIGHT / 2,
        TOGGLE_WIDTH,
        TOGGLE_HEIGHT,
        8
      );
      
      // Draw mode text
      const modeText = this.currentMode === 'focus' ? 'FOCUS' : 'DISTURB';
      const textColor = this.currentMode === 'focus' ? '#44ff44' : '#ff4444';
      
      // Remove old text if exists
      this.container.list.forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && child !== this.labelText) {
          child.destroy();
        }
      });
      
      const text = this.scene.add.text(0, 0, modeText, {
        fontSize: '12px',
        fontFamily: 'BoldPixels, Arial',
        color: textColor,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.container.add(text);
    }
  }

  /**
   * Setup click interaction
   */
  private setupInteraction(): void {
    const hitArea = new Phaser.Geom.Rectangle(
      -TOGGLE_WIDTH / 2,
      -TOGGLE_HEIGHT / 2,
      TOGGLE_WIDTH,
      TOGGLE_HEIGHT
    );
    
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    this.container.on('pointerdown', () => {
      if (this.isEnabled) {
        this.toggle();
      }
    });
    
    this.container.on('pointerover', () => {
      if (this.isEnabled) {
        this.container.setScale(1.05);
      }
    });
    
    this.container.on('pointerout', () => {
      this.container.setScale(1);
    });
  }

  /**
   * Toggle between Focus and Disturb modes
   */
  toggle(): void {
    this.currentMode = this.currentMode === 'focus' ? 'disturb' : 'focus';
    this.updateVisuals();
    
    // Simple scale bounce animation
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
    
    if (this.onModeChange) {
      this.onModeChange(this.currentMode);
    }
  }

  /**
   * Set the mode directly
   */
  setMode(mode: ToggleMode): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.updateVisuals();
    }
  }

  /**
   * Get current mode
   */
  getMode(): ToggleMode {
    return this.currentMode;
  }

  /**
   * Enable/disable the toggle
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.5);
  }

  /**
   * Check if toggle is enabled
   */
  getEnabled(): boolean {
    return this.isEnabled;
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
    return { width: TOGGLE_WIDTH, height: TOGGLE_HEIGHT };
  }

  /**
   * Destroy the component
   */
  destroy(): void {
    this.container.destroy();
  }
}

/**
 * Create a Focus/Disturb toggle component
 */
export function createFocusDisturbToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialMode: ToggleMode = 'focus'
): FocusDisturbToggleComponent {
  return new FocusDisturbToggleComponent(scene, x, y, initialMode);
}
