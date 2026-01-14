/**
 * @fileoverview Base class for segmented bar components (EnergyBar, DisturbCounter)
 * 
 * Extracts common functionality to reduce code duplication between
 * EnergyBar and DisturbCounter components.
 * 
 * @module components/SegmentedBarBase
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';
import { BAR_LAYOUT } from '../config';

/* ============================================
 * CONFIGURATION CONSTANTS
 * ============================================
 */

const BAR_WIDTH = BAR_LAYOUT.WIDTH;
const BAR_HEIGHT = BAR_LAYOUT.HEIGHT;
const ICON_SIZE = BAR_LAYOUT.ICON_SIZE;
const ICON_GAP = BAR_LAYOUT.ICON_GAP;
const SEGMENT_GAP = BAR_LAYOUT.SEGMENT_GAP;

// Re-export for subclasses
export { BAR_WIDTH, BAR_HEIGHT, SEGMENT_GAP };

/* ============================================
 * TYPES
 * ============================================
 */

export interface SegmentedBarConfig {
  borderColor: string;
  fillColor: string;
  emptySegmentColor: string;
  textColors: {
    empty: string;
    active: string;
    normal: string;
  };
  iconTexture?: string;
  label: string;
}

/* ============================================
 * BASE CLASS
 * ============================================
 */

export abstract class SegmentedBarBase {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  protected backgroundGraphics: Phaser.GameObjects.Graphics;
  protected fillGraphics: Phaser.GameObjects.Graphics;
  protected icon: Phaser.GameObjects.Image | null = null;
  protected valueText: Phaser.GameObjects.Text;
  protected labelText: Phaser.GameObjects.Text;
  protected backgroundSprite: Phaser.GameObjects.Image | null = null;
  protected barCenterX: number;
  protected totalWidth: number;
  protected config: SegmentedBarConfig;
  
  // Cache for change detection
  protected lastDisplayedValue: number = -1;
  protected lastDisplayedSecondary: number = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: SegmentedBarConfig
  ) {
    this.scene = scene;
    this.config = config;
    this.container = scene.add.container(x, y);

    this.totalWidth = BAR_WIDTH + ICON_SIZE + ICON_GAP;
    const leftEdge = -this.totalWidth / 2;
    const iconCenterX = leftEdge + ICON_SIZE / 2;
    this.barCenterX = leftEdge + ICON_SIZE + ICON_GAP + BAR_WIDTH / 2;
    
    // Background graphics
    this.backgroundGraphics = scene.add.graphics();
    this.drawBackground();
    this.convertBackgroundToTexture();

    // Icon
    if (config.iconTexture && scene.textures.exists(config.iconTexture)) {
      this.icon = scene.add.image(iconCenterX, 0, config.iconTexture);
      this.icon.setDisplaySize(ICON_SIZE, ICON_SIZE);
      this.container.add(this.icon);
    }
    
    // Fill graphics
    this.fillGraphics = scene.add.graphics();
    this.container.add(this.fillGraphics);
    
    // Value text
    this.valueText = scene.add.text(this.barCenterX, 0, this.getInitialText(), {
      fontSize: '16px',
      fontFamily: 'BoldPixels, Arial',
      color: config.textColors.normal,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    this.container.add(this.valueText);
    
    // Label text
    this.labelText = scene.add.text(this.barCenterX, -24, config.label, {
      fontSize: '12px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5);
    this.labelText.setVisible(config.label.trim().length > 0);
    this.container.add(this.labelText);
  }

  protected abstract getInitialText(): string;
  protected abstract getDisplayText(): string;
  protected abstract getFilledSegments(): number;
  protected abstract getSegmentCount(): number;
  protected abstract getTextColor(): string;
  protected abstract hasValueChanged(): boolean;
  protected abstract updateCachedValues(): void;

  private convertBackgroundToTexture(): void {
    const textureKey = `bar_bg_${this.config.label}_${Date.now()}`;
    this.backgroundGraphics.generateTexture(textureKey, BAR_WIDTH, BAR_HEIGHT);
    this.backgroundSprite = this.scene.add.image(this.barCenterX, 0, textureKey);
    this.container.addAt(this.backgroundSprite, 0);
    this.backgroundGraphics.setVisible(false);
  }

  private drawBackground(): void {
    this.backgroundGraphics.clear();
    this.backgroundGraphics.lineStyle(2, hex(this.config.borderColor), 1);
    this.backgroundGraphics.fillStyle(hex('#333333'), 1);
    this.backgroundGraphics.fillRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);
    this.backgroundGraphics.strokeRoundedRect(0, 0, BAR_WIDTH, BAR_HEIGHT, 5);
  }

  protected updateDisplay(): void {
    if (!this.hasValueChanged()) {
      return;
    }
    
    this.updateCachedValues();
    this.valueText.setText(this.getDisplayText());
    this.fillGraphics.clear();

    const segmentCount = this.getSegmentCount();
    const filledSegments = this.getFilledSegments();
    const segmentWidth = (BAR_WIDTH - SEGMENT_GAP * (segmentCount - 1)) / segmentCount;
    const barLeft = this.barCenterX - BAR_WIDTH / 2;
    const fillColor = hex(this.config.fillColor);
    const emptyColor = hex(this.config.emptySegmentColor);

    // Draw all segments in one pass
    for (let i = 0; i < segmentCount; i++) {
      const x = barLeft + i * (segmentWidth + SEGMENT_GAP);
      const isFilled = i < filledSegments;
      
      // Draw segment
      this.fillGraphics.fillStyle(isFilled ? fillColor : emptyColor, isFilled ? 0.95 : 0.9);
      this.fillGraphics.fillRoundedRect(x, -BAR_HEIGHT / 2 + 2, segmentWidth, BAR_HEIGHT - 4, 2);
      
      // Add shine effect for filled segments
      if (isFilled) {
        this.fillGraphics.fillStyle(hex('#ffffff'), 0.2);
        this.fillGraphics.fillRoundedRect(x, -BAR_HEIGHT / 2 + 2, segmentWidth, (BAR_HEIGHT - 4) * 0.35, 2);
      }
    }
    
    this.valueText.setColor(this.getTextColor());
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
