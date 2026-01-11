/**
 * @fileoverview BootScene - Asset loading and initialization scene
 * 
 * This scene handles all asset preloading before the game starts.
 * It displays a loading progress bar and transitions to MenuScene
 * once all assets are loaded.
 * 
 * Asset categories loaded:
 * - Chess pieces (white and black variants)
 * - Card assets (frames, backs, art, cost circles)
 * - UI elements (clocks, buttons, toggles)
 * - Backgrounds (room, mat textures)
 * 
 * @module scenes/BootScene
 * @requires phaser
 */

import Phaser from 'phaser';
import { hex } from '../utils/colors';

/* ============================================
 * ASSET PATH CONSTANTS
 * ============================================
 * Organized by asset category for maintainability.
 * All paths are relative to the public folder.
 */

/** Chess piece asset paths */
const CHESS_ASSETS = {
  white: {
    pawn: 'chess/pawn.png',
    knight: 'chess/knight.png',
    bishop: 'chess/bishop.png',
    rook: 'chess/rook.png',
    queen: 'chess/queen.png',
    king: 'chess/king.png'
  },
  black: {
    pawn: 'chess/pawn1.png',
    knight: 'chess/knight1.png',
    bishop: 'chess/bishop1.png',
    rook: 'chess/rook1.png',
    queen: 'chess/queen1.png',
    king: 'chess/king1.png'
  },
  board: 'chess/chess_board.png'
};

/** Card frame and component asset paths */
const CARD_ASSETS = {
  back: 'card/card_back.png',
  frames: {
    blue: 'card/card_front_blue.png',
    brown: 'card/card_front_brown.png',
    cyan: 'card/card_front_cyan.png',
    gold: 'card/card_front_gold.png',
    purple: 'card/card_front_purple.png',
    silver: 'card/card_front_silver.png'
  },
  circles: {
    energy: 'card/energy_circle_gold.png',
    time: 'card/time_circle_blue.png'
  }
};

/** Card art asset paths (illustrations on cards) */
const CARD_ART_ASSETS = {
  bishop: 'card_art/bishop.png',
  destroy: 'card_art/destroy.png',
  energy: 'card_art/energy.png',
  grow: 'card_art/grow.png',
  king: 'card_art/king.png',
  knight: 'card_art/knight.png',
  pawn: 'card_art/pawn.png',
  ponder: 'card_art/ponder.png',
  queen: 'card_art/queen.png',
  rook: 'card_art/rook.png',
  search: 'card_art/search.png'
};

/** UI element asset paths */
const UI_ASSETS = {
  clock: 'clock/chess_clock.png',
  stopwatch: 'stopwatch/stopwatch.png',
  switches: {
    focus: 'button/switch_focus.png',
    disturb: 'button/switch_disturb.png'
  },
  buttons: {
    blue: { normal: 'button/blue_button.png', pressed: 'button/blue_button_pressed.png' },
    brown: { normal: 'button/brown_button.png', pressed: 'button/brown_button_pressed.png' },
    yellow: { normal: 'button/yellow_button.png', pressed: 'button/yellow_button_pressed.png' },
    red: { normal: 'button/red_button.png', pressed: 'button/red_button_pressed.png' }
  }
};

/** Background asset paths */
const BACKGROUND_ASSETS = {
  mat: 'background/cyan_mat.png',
  room: 'background/room.png'
};

/* ============================================
 * LOADING BAR CONFIGURATION
 * ============================================
 */

/** Loading bar dimensions and colors */
const LOADING_BAR = {
  width: 320,
  height: 50,
  fillHeight: 30,
  backgroundColor: hex('#f4a508'),
  fillColor: hex('#e7f20d'),
  backgroundAlpha: 0.5
};

/**
 * BootScene - Handles asset preloading and game initialization
 * 
 * This is the first scene that runs when the game starts.
 * It loads all game assets and displays a progress bar.
 * 
 * Scene lifecycle:
 * 1. preload() - Queue all assets for loading
 * 2. create() - Called after loading completes, transitions to MenuScene
 * 
 * @extends Phaser.Scene
 * 
 * @example
 * // BootScene is automatically started by Phaser as the first scene
 * // It transitions to MenuScene after loading completes
 */
export class BootScene extends Phaser.Scene {
  /**
   * Creates a new BootScene instance
   * 
   * @constructor
   * 
   * Used by: Phaser.Game during scene registration
   */
  constructor() {
    super({ key: 'BootScene' });
  }

  /**
   * Preload lifecycle method - queues all assets for loading
   * 
   * This method is called automatically by Phaser before create().
   * All this.load.* calls queue assets for the loader to fetch.
   * The loading bar updates as assets are loaded.
   * 
   * Algorithm:
   * 1. Create and display loading bar UI
   * 2. Queue chess piece assets
   * 3. Queue card frame and art assets
   * 4. Queue UI element assets
   * 5. Queue background assets
   * 
   * Used by: Phaser scene lifecycle (automatic)
   */
  preload(): void {
    this.createLoadingBar();
    this.loadChessPieces();
    this.loadCardAssets();
    this.loadUIAssets();
    this.loadBackground();
  }

  /**
   * Creates the loading progress bar UI
   * 
   * Displays a progress bar that fills as assets load.
   * The bar is centered on screen and shows "Loading..." text.
   * 
   * Algorithm:
   * 1. Calculate center position based on current screen size
   * 2. Draw background box for progress bar
   * 3. Add "Loading..." text above the bar
   * 4. Register progress callback to update fill width
   * 5. Register complete callback to clean up UI
   * 
   * Used by: preload()
   * 
   * @private
   */
  private createLoadingBar(): void {
    const { width, height } = this.scale;
    
    // Create graphics objects for the loading bar
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    
    // Draw the background box (semi-transparent dark gray)
    progressBox.fillStyle(LOADING_BAR.backgroundColor, LOADING_BAR.backgroundAlpha);
    progressBox.fillRect(
      width / 2 - LOADING_BAR.width / 2,
      height / 2 - LOADING_BAR.height / 2,
      LOADING_BAR.width,
      LOADING_BAR.height
    );
    
    // Add loading text above the progress bar
    const loadingText = this.add.text(width / 2, height / 2 - 100, 'LOADING...', {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '70px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 20
    }).setOrigin(0.5);

    // Update progress bar fill as assets load
    // The 'progress' event fires with a value from 0 to 1
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(LOADING_BAR.fillColor, 1);
      progressBar.fillRect(
        width / 2 - LOADING_BAR.width / 2 + 10,
        height / 2 - LOADING_BAR.fillHeight / 2,
        (LOADING_BAR.width - 20) * value,
        LOADING_BAR.fillHeight
      );
    });

    // Clean up loading UI when all assets are loaded
    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });
  }

  /**
   * Loads all chess piece sprites
   * 
   * Loads both white and black variants of all 6 piece types,
   * plus the chess board background image.
   * 
   * Texture keys follow the pattern: chess_[piece]_[color]
   * Example: 'chess_pawn_white', 'chess_knight_black'
   * 
   * Used by: preload()
   * 
   * @private
   */
  private loadChessPieces(): void {
    // White pieces
    this.load.image('chess_pawn_white', CHESS_ASSETS.white.pawn);
    this.load.image('chess_knight_white', CHESS_ASSETS.white.knight);
    this.load.image('chess_bishop_white', CHESS_ASSETS.white.bishop);
    this.load.image('chess_rook_white', CHESS_ASSETS.white.rook);
    this.load.image('chess_queen_white', CHESS_ASSETS.white.queen);
    this.load.image('chess_king_white', CHESS_ASSETS.white.king);
    
    // Black pieces
    this.load.image('chess_pawn_black', CHESS_ASSETS.black.pawn);
    this.load.image('chess_knight_black', CHESS_ASSETS.black.knight);
    this.load.image('chess_bishop_black', CHESS_ASSETS.black.bishop);
    this.load.image('chess_rook_black', CHESS_ASSETS.black.rook);
    this.load.image('chess_queen_black', CHESS_ASSETS.black.queen);
    this.load.image('chess_king_black', CHESS_ASSETS.black.king);
    
    // Chess board
    this.load.image('chess_board', CHESS_ASSETS.board);
  }

  /**
   * Loads all card-related assets
   * 
   * Includes:
   * - Card back (for face-down cards)
   * - Card frames in 6 colors (for different card types)
   * - Cost circles (energy and time indicators)
   * - Card art (illustrations for each card type)
   * 
   * Used by: preload()
   * 
   * @private
   */
  private loadCardAssets(): void {
    // Card back (used for opponent's hand and deck)
    this.load.image('card_back', CARD_ASSETS.back);
    
    // Card frames (colored borders based on card type)
    this.load.image('card_front_blue', CARD_ASSETS.frames.blue);
    this.load.image('card_front_brown', CARD_ASSETS.frames.brown);
    this.load.image('card_front_cyan', CARD_ASSETS.frames.cyan);
    this.load.image('card_front_gold', CARD_ASSETS.frames.gold);
    this.load.image('card_front_purple', CARD_ASSETS.frames.purple);
    this.load.image('card_front_silver', CARD_ASSETS.frames.silver);
    
    // Cost indicator circles
    this.load.image('energy_circle', CARD_ASSETS.circles.energy);
    this.load.image('time_circle', CARD_ASSETS.circles.time);
    
    // Card art (illustrations)
    this.load.image('card_art_bishop', CARD_ART_ASSETS.bishop);
    this.load.image('card_art_destroy', CARD_ART_ASSETS.destroy);
    this.load.image('card_art_energy', CARD_ART_ASSETS.energy);
    this.load.image('card_art_grow', CARD_ART_ASSETS.grow);
    this.load.image('card_art_king', CARD_ART_ASSETS.king);
    this.load.image('card_art_knight', CARD_ART_ASSETS.knight);
    this.load.image('card_art_pawn', CARD_ART_ASSETS.pawn);
    this.load.image('card_art_ponder', CARD_ART_ASSETS.ponder);
    this.load.image('card_art_queen', CARD_ART_ASSETS.queen);
    this.load.image('card_art_rook', CARD_ART_ASSETS.rook);
    this.load.image('card_art_search', CARD_ART_ASSETS.search);
  }

  /**
   * Loads all UI element assets
   * 
   * Includes:
   * - Chess clock display
   * - Stopwatch display
   * - Focus/Disturb mode toggle switches
   * - Menu buttons (normal and pressed states)
   * 
   * Used by: preload()
   * 
   * @private
   */
  private loadUIAssets(): void {
    // Clock and stopwatch displays
    this.load.image('chess_clock', UI_ASSETS.clock);
    this.load.image('stopwatch', UI_ASSETS.stopwatch);
    
    // Focus/Disturb mode toggle switches
    this.load.image('switch_focus', UI_ASSETS.switches.focus);
    this.load.image('switch_disturb', UI_ASSETS.switches.disturb);
    
    // Menu buttons (each has normal and pressed states)
    this.load.image('blue_button', UI_ASSETS.buttons.blue.normal);
    this.load.image('blue_button_pressed', UI_ASSETS.buttons.blue.pressed);
    this.load.image('brown_button', UI_ASSETS.buttons.brown.normal);
    this.load.image('brown_button_pressed', UI_ASSETS.buttons.brown.pressed);
    this.load.image('yellow_button', UI_ASSETS.buttons.yellow.normal);
    this.load.image('yellow_button_pressed', UI_ASSETS.buttons.yellow.pressed);
    this.load.image('red_button', UI_ASSETS.buttons.red.normal);
    this.load.image('red_button_pressed', UI_ASSETS.buttons.red.pressed);
  }

  /**
   * Loads background images
   * 
   * Includes:
   * - Room background (main game background)
   * - Cyan mat texture (fallback/tiled background)
   * 
   * Note: Custom fonts are loaded via CSS @font-face in index.html,
   * not through Phaser's loader.
   * 
   * Used by: preload()
   * 
   * @private
   */
  private loadBackground(): void {
    this.load.image('background', BACKGROUND_ASSETS.mat);
    this.load.image('room_background', BACKGROUND_ASSETS.room);
  }

  /**
   * Create lifecycle method - called after all assets are loaded
   * 
   * Transitions to the MenuScene to begin the game flow.
   * 
   * Used by: Phaser scene lifecycle (automatic)
   */
  create(): void {
    this.scene.start('MenuScene');
  }
}
