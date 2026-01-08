import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { EndScene } from './scenes/EndScene';

/**
 * Phaser Game Configuration
 * 
 * Requirements: 14.1, 14.2
 * - 14.1: Use Phaser ScaleManager with SHOW_ALL mode (Phaser 3 equivalent: FIT)
 * - 14.2: Maintain aspect ratio across all screen sizes
 * 
 * Note: Phaser 3 uses FIT mode instead of SHOW_ALL (which was Phaser 2).
 * FIT mode maintains aspect ratio and fits the game within the available space.
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1920,
  height: 1080,
  backgroundColor: '#2a1a0a', // Dark brown fallback to match room aesthetic
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.RESIZE, // Resize canvas to fill window, no letterboxing
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  scene: [BootScene, MenuScene, GameScene, EndScene]
};

new Phaser.Game(config);
