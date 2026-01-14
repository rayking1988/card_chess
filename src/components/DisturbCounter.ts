/**
 * @fileoverview DisturbCounter Component - Shows current Disturb tag count
 * 
 * This component displays the player's current disturb tags in a bar format
 * similar to the energy bar. Disturb tags are deducted from clock time when
 * the first card is played.
 *
 * @module components/DisturbCounter
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';
import { ENERGY, DISTURB_COLORS, BAR_LAYOUT } from '../config';

/* ============================================
 * DISTURB BAR CONFIGURATION CONSTANTS
 * ============================================
 */

/** Bar width in pixels (bar body only) */
const BAR_WIDTH = BAR_LAYOUT.WIDTH;

/** Bar height in pixels */
const BAR_HEIGHT = BAR_LAYOUT.HEIGHT;

/** Icon size in pixels */
const ICON_SIZE = BAR_LAYOUT.ICON_SIZE;

/** Gap between icon and bar */
const ICON_GAP = BAR_LAYOUT.ICON_GAP;

/** Gap between segments */
const SEGMENT_GAP = BAR_LAYOUT.SEGMENT_GAP;

/** Maximum segments to display */
const MAX_SEGMENTS = ENERGY.MAX_DISPLAY_SEGMENTS;

/** Purple fill color for disturb */
const FILL_COLOR = hex(DISTURB_COLORS.FILL);

const EMPTY_SEGMENT_COLOR = hex(DISTURB_COLORS.EMPTY_SEGMENT);

/** Text colors for different states */
const TEXT_COLORS = {
  empty: DISTURB_COLORS.TEXT.EMPTY,
  active: DISTURB_COLORS.TEXT.ACTIVE,
  normal: '#000000'
};

/* ============================================
 * DISTURB COUNTER COMPONENT CLASS
 * ============================================
 */

export class DisturbCounterComponent {
  /** Container holding all visual elements */
  private container: Phaser.GameObjects.Container;
  
  /** Graphics for the background bar */
  private backgroundGraphics: Phaser.GameObjects.Graphics;
  
  /** Graphics for the fill bar */
  private fillGraphics: Phaser.GameObjects.Graphics;

  /** Disturb icon sprite */
  private disturbIcon: Phaser.GameObjects.Image | null = null;

  /** Text displaying current value */
  private countText: Phaser.GameObjects.Text;
  
  /** Label text above the bar */
  private labelText: Phaser.GameObjects.Text;
  
  /** Current disturb value */
  private currentValue: number = 0;
  
  /** Cached last displayed value for change detection */
  private lastDisplayedValue: number = -1;
  
  /** Reference to the scene for texture cleanup */
  private scene: Phaser.Scene;
  
  /** Background sprite (replaces backgroundGraphics for performance) */
  private backgroundSprite: Phaser.GameObjects.Image | null = null;

  /** Cached bar center offset */
  private barCenterX: number;

  /** Cached total width for layout */
  private totalWidth: number;

  constructor(scene: Phaser.Scene, x: number, y: number, label: string = 'Disturb') {
    this.scene = scene;
    this.container = scene.add.container(x, y);

    this.totalWidth = BAR_WIDTH + ICON_SIZE + ICON_GAP;
    const leftEdge = -this.totalWidth / 2;
    const iconCenterX = leftEdge + ICON_SIZE / 2;
    this.barCenterX = leftEdge + ICON_SIZE + ICON_GAP + BAR_WIDTH / 2;
    
    // Background graphics - draw then convert to texture for performance
    this.backgroundGraphics = scene.add.graphics();
    this.drawBackground();
    this.convertBackgroundToTexture();

    if (scene.textures.exists('disturb_icon')) {
      this.disturbIcon = scene.add.image(iconCenterX, 0, 'disturb_icon');
      this.disturbIcon.setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(this.disturbIcon);
    }
    
    // Fill graphics (drawn on top of background) - this one stays dynamic
    this.fillGraphics = scene.add.graphics();
    this.container.add(this.fillGraphics);
    
    // Count text with stroke for readability on purple background
    this.countText = scene.add.text(this.barCenterX, 0, '0', {
      fontSize: '16px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.container.add(this.countText);
    
    // Label text above the bar
    this.labelText = scene.add.text(this.barCenterX, -24, label, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.labelText.setVisible(label.trim().length > 0);
    this.container.add(this.labelText);
    
    this.updateDisplay();
  }
  
  private convertBackgroundToTexture(): void {
    const textureKey = `disturb_bar_bg_${Date.now()}`;
    this.backgroundGraphics.generateTexture(textureKey, BAR_WIDTH, BAR_HEIGHT);
    this.backgroundSprite = this.scene.add.image(this.barCenterX, 0, textureKey);
    this.container.addAt(this.backgroundSprite, 0);
    this.backgroundGraphics.setVisible(false);
  }

  private drawBackground(): void {
    this.backgroundGraphics.clear();
    // Purple border
    this.backgroundGraphics.lineStyle(2, hex('#9b59b6'), 1);
    // Dark gray fill
    this.backgroundGraphics.fillStyle(hex('#333333'), 1);
    this.backgroundGraphics.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);
    this.backgroundGraphics.strokeRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);
  }

  setValue(value: number): void {
    this.currentValue = value;
    this.updateDisplay();
  }

  getValue(): number {
    return this.currentValue;
  }

  private updateDisplay(): void {
    if (this.currentValue === this.lastDisplayedValue) {
      return;
    }
    
    this.lastDisplayedValue = this.currentValue;
    this.countText.setText(`${this.currentValue}`);
    this.fillGraphics.clear();

    const segmentCount = MAX_SEGMENTS;
    const filledSegments = Math.min(this.currentValue, segmentCount);
    const segmentWidth = (BAR_WIDTH - SEGMENT_GAP * (segmentCount - 1)) / segmentCount;
    const barLeft = this.barCenterX - BAR_WIDTH / 2;

    // Draw empty segments
    for (let i = 0; i < segmentCount; i++) {
      const x = barLeft + i * (segmentWidth + SEGMENT_GAP);
      this.fillGraphics.fillStyle(EMPTY_SEGMENT_COLOR, 0.9);
      this.fillGraphics.fillRoundedRect(x, -BAR_HEIGHT / 2 + 2, segmentWidth, BAR_HEIGHT - 4, 2);
    }

    // Draw filled segments
    for (let i = 0; i < filledSegments; i++) {
      const x = barLeft + i * (segmentWidth + SEGMENT_GAP);
      this.fillGraphics.fillStyle(FILL_COLOR, 0.95);
      this.fillGraphics.fillRoundedRect(x, -BAR_HEIGHT / 2 + 2, segmentWidth, BAR_HEIGHT - 4, 2);
      // Shine effect
      this.fillGraphics.fillStyle(hex('#ffffff'), 0.2);
      this.fillGraphics.fillRoundedRect(x, -BAR_HEIGHT / 2 + 2, segmentWidth, (BAR_HEIGHT - 4) * 0.35, 2);
    }
    
    // Update text color
    if (this.currentValue === 0) {
      this.countText.setColor(TEXT_COLORS.empty);
    } else {
      this.countText.setColor(TEXT_COLORS.active);
    }
  }

  setLabel(label: string): void {
    this.labelText.setText(label);
    this.labelText.setVisible(label.trim().length > 0);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  getDimensions(): { width: number; height: number } {
    return { width: this.totalWidth, height: Math.max(BAR_HEIGHT, ICON_SIZE) };
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    if (this.backgroundSprite) {
      const textureKey = this.backgroundSprite.texture.key;
      this.backgroundSprite.destroy();
      this.scene.textures.remove(textureKey);
    }
    this.container.destroy();
  }
}

export function createDisturbCounter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string = 'Disturb'
): DisturbCounterComponent {
  return new DisturbCounterComponent(scene, x, y, label);
}
