/**
 * @fileoverview FocusDisturbToggle Component - Mode toggle button
 * 
 * This component allows players to switch between Focus and Disturb modes.
 * The mode affects what happens to leftover energy at the end of a turn:
 * - Focus: Converts leftover energy to time (1 energy = 1 second)
 * - Disturb: Converts leftover energy to opponent's Disturb tags
 * 
 * Requirements addressed:
 * - 8.5: Use switch_focus.png and switch_disturb.png images
 * 
 * @module components/FocusDisturbToggle
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';

/* ============================================
 * TOGGLE CONFIGURATION CONSTANTS
 * ============================================
 */

/** Toggle button width in pixels */
const TOGGLE_WIDTH = 80;

/** Toggle button height in pixels */
const TOGGLE_HEIGHT = 40;

/** Fallback colors when sprites are not available */
const FALLBACK_COLORS = {
  focus: {
    background: hex('#225522'),
    border: hex('#44ff44'),
    text: '#44ff44'
  },
  disturb: {
    background: hex('#552222'),
    border: hex('#ff4444'),
    text: '#ff4444'
  }
};

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * The two possible modes for the toggle
 * - 'focus': Leftover energy converts to time
 * - 'disturb': Leftover energy becomes opponent's Disturb tags
 */
export type ToggleMode = 'focus' | 'disturb';

/* ============================================
 * FOCUS/DISTURB TOGGLE COMPONENT CLASS
 * ============================================
 */

/**
 * FocusDisturbToggleComponent - Mode selection toggle
 * 
 * Allows players to choose between Focus and Disturb modes.
 * Uses sprite images when available, falls back to graphics.
 * 
 * Mode effects (processed at end of turn):
 * - Focus: Each leftover energy adds 1 second to your clock
 * - Disturb: Each leftover energy adds 1 Disturb tag to opponent
 * 
 * Visual structure:
 * - Focus sprite OR Disturb sprite (based on current mode)
 * - Fallback: Colored rectangle with mode text
 * - Label text above toggle ("Mode")
 * 
 * @example
 * // Create a toggle starting in Focus mode
 * const toggle = new FocusDisturbToggleComponent(scene, 100, 500, 'focus');
 * 
 * // Listen for mode changes
 * toggle.onModeChange = (mode) => {
 *   console.log('Mode changed to:', mode);
 * };
 * 
 * // Programmatically set mode
 * toggle.setMode('disturb');
 * 
 * Used by: GameScene (creates two toggles - player and opponent)
 */
export class FocusDisturbToggleComponent {
  /** Reference to the Phaser scene */
  private scene: Phaser.Scene;
  
  /** Container holding all toggle visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Focus mode sprite (shown when mode is 'focus') */
  private focusSprite: Phaser.GameObjects.Image | null = null;
  
  /** Disturb mode sprite (shown when mode is 'disturb') */
  private disturbSprite: Phaser.GameObjects.Image | null = null;
  
  /** Fallback graphics when sprites unavailable */
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  
  /** Label text above the toggle */
  private labelText: Phaser.GameObjects.Text;
  
  /** Current mode ('focus' or 'disturb') */
  private currentMode: ToggleMode = 'focus';
  
  /** Whether the toggle is interactive */
  private isEnabled: boolean = true;
  
  /**
   * Callback fired when mode changes
   * Set by parent component to handle mode changes
   */
  public onModeChange?: (mode: ToggleMode) => void;

  /**
   * Creates a new FocusDisturbToggleComponent
   * 
   * @param scene - The Phaser scene to add this component to
   * @param x - X position for the toggle center
   * @param y - Y position for the toggle center
   * @param initialMode - Starting mode (default: 'focus')
   * 
   * Used by: GameScene.createRightPanel()
   */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    initialMode: ToggleMode = 'focus'
  ) {
    this.scene = scene;
    this.currentMode = initialMode;
    
    this.container = scene.add.container(x, y);
    
    // Fallback background graphics
    this.backgroundGraphics = scene.add.graphics();
    this.container.add(this.backgroundGraphics);
    
    // Load focus sprite if texture exists
    if (scene.textures.exists('switch_focus')) {
      this.focusSprite = scene.add.image(0, 0, 'switch_focus');
      this.focusSprite.setDisplaySize(TOGGLE_WIDTH, TOGGLE_HEIGHT);
      this.container.add(this.focusSprite);
    }
    
    // Load disturb sprite if texture exists
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
    this.labelText.setVisible(this.labelText.text.trim().length > 0);
    this.container.add(this.labelText);
    
    this.updateVisuals();
    this.setupInteraction();
  }

  /**
   * Updates visual elements based on current mode
   * 
   * Algorithm:
   * 1. If sprites are available, show appropriate sprite
   * 2. Otherwise, draw fallback graphics with mode text
   * 
   * @private
   */
  private updateVisuals(): void {
    if (this.focusSprite && this.disturbSprite) {
      // Use sprites - show one, hide the other
      this.focusSprite.setVisible(this.currentMode === 'focus');
      this.disturbSprite.setVisible(this.currentMode === 'disturb');
      this.backgroundGraphics.setVisible(false);
    } else {
      // Fallback: draw toggle with graphics
      this.backgroundGraphics.setVisible(true);
      this.backgroundGraphics.clear();
      
      const colors = this.currentMode === 'focus' 
        ? FALLBACK_COLORS.focus 
        : FALLBACK_COLORS.disturb;
      
      // Draw background
      this.backgroundGraphics.fillStyle(colors.background, 1);
      this.backgroundGraphics.fillRoundedRect(
        -TOGGLE_WIDTH / 2,
        -TOGGLE_HEIGHT / 2,
        TOGGLE_WIDTH,
        TOGGLE_HEIGHT,
        8
      );
      
      // Draw border
      this.backgroundGraphics.lineStyle(2, colors.border, 1);
      this.backgroundGraphics.strokeRoundedRect(
        -TOGGLE_WIDTH / 2,
        -TOGGLE_HEIGHT / 2,
        TOGGLE_WIDTH,
        TOGGLE_HEIGHT,
        8
      );
      
      // Remove old mode text if exists
      this.container.list.forEach(child => {
        if (child instanceof Phaser.GameObjects.Text && child !== this.labelText) {
          child.destroy();
        }
      });
      
      // Add mode text
      const modeText = this.currentMode === 'focus' ? 'FOCUS' : 'DISTURB';
      const text = this.scene.add.text(0, 0, modeText, {
        fontSize: '12px',
        fontFamily: 'BoldPixels, Arial',
        color: colors.text,
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.container.add(text);
    }
  }

  /**
   * Sets up click interaction for the toggle
   * 
   * @private
   */
  private setupInteraction(): void {
    // Define hit area
    const hitArea = new Phaser.Geom.Rectangle(
      -TOGGLE_WIDTH / 2,
      -TOGGLE_HEIGHT / 2,
      TOGGLE_WIDTH,
      TOGGLE_HEIGHT
    );
    
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Click to toggle
    this.container.on('pointerdown', () => {
      if (this.isEnabled) {
        this.toggle();
      }
    });
    
    // Hover effect
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
   * Toggles between Focus and Disturb modes
   * 
   * Switches the mode and triggers the onModeChange callback.
   * Also plays a bounce animation for feedback.
   * 
   * Used by: Click handler, can also be called programmatically
   */
  toggle(): void {
    this.currentMode = this.currentMode === 'focus' ? 'disturb' : 'focus';
    this.updateVisuals();
    
    // Bounce animation for feedback
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
    
    // Fire callback
    if (this.onModeChange) {
      this.onModeChange(this.currentMode);
    }
  }

  /**
   * Sets the mode directly without animation
   * 
   * @param mode - The mode to set ('focus' or 'disturb')
   * 
   * Used by: GameScene when syncing opponent's mode
   */
  setMode(mode: ToggleMode): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.updateVisuals();
    }
  }

  /**
   * Gets the current mode
   * 
   * @returns Current mode ('focus' or 'disturb')
   */
  getMode(): ToggleMode {
    return this.currentMode;
  }

  /**
   * Enables or disables the toggle
   * 
   * When disabled, the toggle appears faded and cannot be clicked.
   * 
   * @param enabled - Whether the toggle should be interactive
   * 
   * Used by: GameScene to disable opponent's toggle
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.5);
  }

  /**
   * Checks if the toggle is enabled
   * 
   * @returns True if the toggle is interactive
   */
  getEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Updates the label text
   * 
   * @param label - New label text
   */
  setLabel(label: string): void {
    this.labelText.setText(label);
    this.labelText.setVisible(label.trim().length > 0);
  }

  /**
   * Sets the position of the toggle
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
   * Sets the scale of the toggle
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
   * Sets visibility of the toggle
   * 
   * @param visible - Whether the toggle should be visible
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  /**
   * Sets the alpha (transparency) of the toggle
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
   * Gets the toggle dimensions
   * 
   * @returns Object with width and height
   */
  getDimensions(): { width: number; height: number } {
    return { width: TOGGLE_WIDTH, height: TOGGLE_HEIGHT };
  }

  /**
   * Destroys the component and cleans up resources
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
 * Factory function to create a FocusDisturbToggleComponent
 * 
 * @param scene - The Phaser scene
 * @param x - X position
 * @param y - Y position
 * @param initialMode - Starting mode (default: 'focus')
 * @returns A new FocusDisturbToggleComponent instance
 */
export function createFocusDisturbToggle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  initialMode: ToggleMode = 'focus'
): FocusDisturbToggleComponent {
  return new FocusDisturbToggleComponent(scene, x, y, initialMode);
}
