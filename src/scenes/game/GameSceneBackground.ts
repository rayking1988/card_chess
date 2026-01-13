/**
 * @fileoverview GameScene background helpers
 *
 * @module scenes/game/GameSceneBackground
 */

import Phaser from 'phaser';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';

/**
 * Creates the scene background
 *
 * @param width - Screen width
 * @param height - Screen height
 */
export function createBackground(this: GameScene, width: number, height: number): void {
  if (this.textures.exists('wood_background')) {
    // Use wood background with tiled repeating pattern
    const tiledBg = this.add.tileSprite(
      width / 2,
      height / 2,
      width,
      height,
      'wood_background'
    );
    tiledBg.setDepth(-1);
    // Store reference for resize handling
    this.background = tiledBg as unknown as Phaser.GameObjects.Image;
  } else if (this.textures.exists('room_background')) {
    // Fallback to room background with cover scaling
    this.background = this.add.image(width / 2, height / 2, 'room_background');
    this.background.setDepth(-1);
    this.scaleBackgroundToCover();
  } else if (this.textures.exists('background')) {
    // Fallback to tiled background
    const tiledBg = this.add.tileSprite(
      width / 2,
      height / 2,
      width,
      height,
      'background'
    );
    tiledBg.setDepth(-1);
  } else {
    this.cameras.main.setBackgroundColor(hex('#2a1a0a'));
  }
}

/**
 * Scales background to cover entire viewport (may crop edges)
 * Uses CSS-like "background-size: cover" behavior
 * For tiled backgrounds, resizes the tile sprite instead
 */
export function scaleBackgroundToCover(this: GameScene): void {
  if (!this.background) return;

  const { width, height } = this.scale;
  
  // Check if it's a TileSprite (wood background)
  if (this.background instanceof Phaser.GameObjects.TileSprite) {
    this.background.setSize(width, height);
    this.background.setPosition(width / 2, height / 2);
  } else {
    // Regular image - scale to cover
    const bgWidth = this.background.width;
    const bgHeight = this.background.height;

    const scaleX = width / bgWidth;
    const scaleY = height / bgHeight;
    const scale = Math.max(scaleX, scaleY);

    this.background.setScale(scale);
    this.background.setPosition(width / 2, height / 2);
  }
}
