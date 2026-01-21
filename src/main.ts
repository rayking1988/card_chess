/**
 * @fileoverview Main entry point for Card Chess game
 * 
 * This file initializes the Phaser 3 game instance with the appropriate
 * configuration settings. It sets up the rendering mode, scaling behavior,
 * and registers all game scenes.
 * 
 * @module main
 * @requires phaser
 * @requires ./scenes/BootScene
 * @requires ./scenes/MenuScene
 * @requires ./scenes/GameScene
 */

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { DISPLAY } from './config';

/* ============================================
 * GAME CONFIGURATION CONSTANTS
 * ============================================
 * These values define the base resolution and visual settings
 * for the game. The game uses responsive scaling to adapt to
 * different screen sizes while maintaining visual quality.
 */

/** Base game width in pixels (reference resolution) */
const GAME_WIDTH = DISPLAY.GAME_WIDTH;

/** Base game height in pixels (reference resolution) */
const GAME_HEIGHT = DISPLAY.GAME_HEIGHT;

/** Background color when no scene background is loaded (dark brown) */
const BACKGROUND_COLOR = DISPLAY.BACKGROUND_COLOR;

/* ============================================
 * PHASER GAME CONFIGURATION
 * ============================================
 * 
 * Configuration object for the Phaser.Game instance.
 * 
 * Key settings:
 * - type: AUTO - Automatically selects WebGL or Canvas based on browser support
 * - pixelArt: false - Uses LINEAR filtering for smoother scaled images
 * - antialias: true - Enables edge smoothing for better visual quality
 * - roundPixels: false - Allows sub-pixel rendering for smooth animations
 * - scale.mode: RESIZE - Canvas resizes to fill the browser window
 * 
 * Scene order determines the initial scene (BootScene loads first)
 * and establishes the scene registry for scene transitions.
 * 
 * Requirements addressed:
 * - 14.1: Responsive scaling using Phaser ScaleManager
 * - 14.2: Maintains visual quality across different screen sizes
 */
const config: Phaser.Types.Core.GameConfig = {
  // Rendering configuration
  type: Phaser.AUTO,                    // Auto-detect best renderer (WebGL preferred)
  parent: 'game-container',             // DOM element ID to attach canvas
  width: GAME_WIDTH,                    // Base width for calculations
  height: GAME_HEIGHT,                  // Base height for calculations
  backgroundColor: BACKGROUND_COLOR,    // Fallback background color
  
  // Visual quality settings
  pixelArt: false,                      // Disable NEAREST filtering for smooth scaling
  antialias: true,                      // Enable antialiasing for smooth edges
  roundPixels: false,                   // Allow sub-pixel positioning
  
  // Performance settings - cap FPS to reduce CPU/GPU load
  fps: {
    target: DISPLAY.TARGET_FPS,
    forceSetTimeOut: false,             // Use requestAnimationFrame
    smoothStep: true                    // Smooth frame timing
  },
  
  // Responsive scaling configuration
  scale: {
    mode: Phaser.Scale.RESIZE,          // Canvas resizes with window
    autoCenter: Phaser.Scale.CENTER_BOTH // Center canvas in container
  },
  
  // Scene registration (order matters - first scene starts automatically)
  scene: [
    BootScene,   // Asset loading and initialization
    MenuScene,   // Main menu and matchmaking
    GameScene    // Core gameplay
  ]
};

/* ============================================
 * GAME INITIALIZATION
 * ============================================
 * Creates the Phaser.Game instance which:
 * 1. Sets up the rendering context (WebGL/Canvas)
 * 2. Initializes the scene manager
 * 3. Starts the game loop
 * 4. Automatically transitions to BootScene
 */
const game = new Phaser.Game(config);

const syncScaleToContainer = (): void => {
  const container = game.canvas?.parentElement;
  if (!container) return;
  const { clientWidth, clientHeight } = container;
  if (clientWidth > 0 && clientHeight > 0) {
    game.scale.resize(clientWidth, clientHeight);
  }
};

if (typeof window !== 'undefined') {
  const scheduleScaleSync = (): void => {
    window.setTimeout(syncScaleToContainer, 0);
  };

  window.addEventListener('resize', scheduleScaleSync);
  window.visualViewport?.addEventListener('resize', scheduleScaleSync);

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleScaleSync);
    const container = document.getElementById('game-container');
    if (container) {
      observer.observe(container);
    }
  }
}
