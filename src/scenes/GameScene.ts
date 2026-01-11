/**
 * @fileoverview GameScene - Main gameplay scene with UI layout and game logic
 * 
 * This is the core gameplay scene that orchestrates all game elements:
 * - Chess board with piece movement and card-based piece deployment
 * - Card hand with fan display and drag-to-play mechanics
 * - Clocks, stopwatches, and energy management
 * - P2P networking for multiplayer synchronization
 * - Mulligan phase and turn management
 * 
 * Requirements addressed:
 * - UI Layout: Responsive layout with chess board, card hand, clocks, event log
 * - 3.1: Initialize and shuffle deck at game start
 * - 3.2: Mulligan phase with redraw option
 * - 3.4: Draw card at turn start
 * - 3.5: End turn after move
 * - 3.6: Enforce max hand size (7 cards)
 * - 3.7: King capture ends game
 * - 3.8: Checkmate/stalemate detection
 * - 4.5: Card targeting with control power validation
 * 
 * UI Layout (from requirements document):
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * │  ┌─────────────┐                 Opponent's Deck (top-center)                │
 * │  │  Opponent's │                                                             │
 * │  │  Card       │                                                             │
 * │  │  (face down)│                                                             │
 * │  ├─────────────┤                                                             │
 * │  │ DECK    DISC│                                                             │
 * │  └─────────────┘                                                             │
 * │                                                                              │
 * │  ┌─────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐  │
 * │  │  EVENT LOG  │    │      CHESS BOARD        │    │  Opp Clock          │  │
 * │  │             │    │         8x8             │    │  [FOCUS/DISTURB]    │  │
 * │  │             │    │                         │    │  Your Clock         │  │
 * │  │             │    │                         │    │  Stopwatch          │  │
 * │  │             │    │                         │    │  Energy Bar         │  │
 * │  │             │    │                         │    │  [FOCUS/DISTURB]    │  │
 * │  └─────────────┘    └─────────────────────────┘    └─────────────────────┘  │
 * │                              Card Count                                      │
 * │  ┌─────────────┐    ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
 * │  │  Your Card  │    │ C │ │ C │ │ C │ │ C │ │ C │ │ C │  (Fan-shaped hand)  │
 * │  │  (preview)  │    │ A │ │ A │ │ A │ │ A │ │ A │ │ A │                     │
 * │  └─────────────┘    └───┘ └───┘ └───┘ └───┘ └───┘ └───┘                     │
 * └──────────────────────────────────────────────────────────────────────────────┘
 * 
 * @module scenes/GameScene
 * @requires phaser
 * @requires chess.js
 * @requires components/*
 * @requires managers/*
 * @requires utils/controlPower
 * @requires data/cards
 * 
 * Used by: MenuScene (game start), EndScene (rematch)
 */

import Phaser from 'phaser';
import { Square, Color, PieceSymbol } from 'chess.js';
import { ChessBoardComponent } from '../components/ChessBoard';
import { CardHandComponent } from '../components/CardHand';
import { ClockComponent } from '../components/Clock';
import { StopwatchComponent } from '../components/Stopwatch';
import { EnergyBarComponent } from '../components/EnergyBar';
import { EventLogComponent } from '../components/EventLog';
import { FocusDisturbToggleComponent } from '../components/FocusDisturbToggle';
import { CardComponent } from '../components/Card';
import { GameStateManager, PlayerColor, Card, PieceType } from '../managers/GameStateManager';
import { NetworkManager, GameAction } from '../managers/NetworkManager';
import { DeckManager, DECK_SIZE, INITIAL_DRAW_COUNT } from '../managers/DeckManager';
import { calculateControlPower, playerControlsSquare } from '../utils/controlPower';
import { CARD_DEFINITIONS } from '../data/cards';
import { createGameAnimationManager, GameAnimationManager } from '../managers/AnimationManager';
import { hex } from '../utils/colors';

// Import from extracted modules
import { GameSceneData, UISnapshot, GameLayout } from './game/GameTypes';
import { MAX_HAND_SIZE, MAX_PILE_LAYERS } from './game/GameConstants';
import { calculateLayout } from './game/GameLayout';
import {
  createImageButton,
  createPileStack,
  layoutPileStack,
  makeCardComponentClickable,
  drawTargetArrow
} from './game/GameUIHelpers';

/* ============================================
 * GAME SCENE CLASS
 * ============================================
 */

/**
 * GameScene - Main gameplay scene
 * 
 * Orchestrates all game elements including:
 * - Chess board with move validation and piece animations
 * - Card hand with fan display and targeting
 * - Clocks, stopwatches, and energy management
 * - Event log for game history
 * - P2P networking for multiplayer
 * - Mulligan and discard phases
 * 
 * Used by: MenuScene (game start), EndScene (rematch)
 */
export class GameScene extends Phaser.Scene {
  /* ----------------------------------------
   * Background and Animation
   * ---------------------------------------- */
  
  /** Background image */
  private background!: Phaser.GameObjects.Image;
  
  /** Animation manager for UI transitions */
  private animations!: GameAnimationManager;
  
  /* ----------------------------------------
   * Core UI Components
   * ---------------------------------------- */
  
  /** Chess board component */
  private chessBoard!: ChessBoardComponent;
  
  /** Player's card hand component */
  private cardHand!: CardHandComponent;
  
  /** Opponent's clock display */
  private opponentClock!: ClockComponent;
  
  /** Player's clock display */
  private playerClock!: ClockComponent;
  
  /** Opponent's stopwatch (turn timer) */
  private opponentStopwatch!: StopwatchComponent;
  
  /** Player's stopwatch (turn timer) */
  private playerStopwatch!: StopwatchComponent;
  
  /** Player's energy bar display */
  private energyBar!: EnergyBarComponent;
  
  /** Event log for game history */
  private eventLog!: EventLogComponent;
  
  /** Opponent's focus/disturb mode toggle (read-only) */
  private opponentFocusDisturb!: FocusDisturbToggleComponent;
  
  /** Player's focus/disturb mode toggle */
  private playerFocusDisturb!: FocusDisturbToggleComponent;
  
  /* ----------------------------------------
   * Opponent Deck/Discard Display
   * ---------------------------------------- */
  
  /** Opponent's deck card back image */
  private opponentDeckSprite!: Phaser.GameObjects.Image;
  
  /** Stack of images for opponent deck visual depth */
  private opponentDeckStack: Phaser.GameObjects.Image[] = [];
  
  /** Label text for opponent's deck */
  private opponentDeckLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's deck */
  private opponentDeckCountText!: Phaser.GameObjects.Text;
  
  /** Opponent's discard pile image */
  private opponentDiscardSprite!: Phaser.GameObjects.Image;
  
  /** Stack of images for opponent discard visual depth */
  private opponentDiscardStack: Phaser.GameObjects.Image[] = [];
  
  /** Top card component for opponent's discard (shows last played card) */
  private opponentDiscardTopCard: CardComponent | null = null;
  
  /** Label text for opponent's discard */
  private opponentDiscardLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's discard */
  private opponentDiscardCountText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Player Deck/Discard Display
   * ---------------------------------------- */
  
  /** Player's deck card back image */
  private playerDeckSprite!: Phaser.GameObjects.Image;
  
  /** Stack of images for player deck visual depth */
  private playerDeckStack: Phaser.GameObjects.Image[] = [];
  
  /** Label text for player's deck */
  private playerDeckLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for player's deck */
  private playerDeckCountText!: Phaser.GameObjects.Text;
  
  /** Player's discard pile image */
  private playerDiscardSprite!: Phaser.GameObjects.Image;
  
  /** Stack of images for player discard visual depth */
  private playerDiscardStack: Phaser.GameObjects.Image[] = [];
  
  /** Top card component for player's discard (shows last played card) */
  private playerDiscardTopCard: CardComponent | null = null;
  
  /** Label text for player's discard */
  private playerDiscardLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for player's discard */
  private playerDiscardCountText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Opponent Hand Display
   * ---------------------------------------- */
  
  /** Container for opponent's hand cards */
  private opponentHandContainer!: Phaser.GameObjects.Container;
  
  /** Array of card back images for opponent's hand */
  private opponentHandCards: Phaser.GameObjects.Image[] = [];
  
  /** Label text for opponent's hand */
  private opponentHandLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's hand */
  private opponentHandCountText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * UI Text Elements
   * ---------------------------------------- */
  
  /** Card count indicator text (Hand: X / 7) */
  private cardCountText!: Phaser.GameObjects.Text;
  
  /** Player's nameplate text */
  private playerNameText!: Phaser.GameObjects.Text;
  
  /** Opponent's nameplate text */
  private opponentNameText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Turn Banner
   * ---------------------------------------- */
  
  /** Container for turn announcement banner */
  private turnBanner: Phaser.GameObjects.Container | null = null;
  
  /** Text element within turn banner */
  private turnBannerText: Phaser.GameObjects.Text | null = null;
  
  /* ----------------------------------------
   * Connection Overlay
   * ---------------------------------------- */
  
  /** Container for connection status overlay */
  private connectionOverlay: Phaser.GameObjects.Container | null = null;
  
  /** Background graphics for connection overlay (using Rectangle for performance) */
  private connectionOverlayBackground: Phaser.GameObjects.Rectangle | null = null;
  
  /** Status text for connection overlay */
  private connectionOverlayText: Phaser.GameObjects.Text | null = null;
  
  /** Return to menu button in connection overlay */
  private connectionOverlayButton: Phaser.GameObjects.Container | null = null;
  
  /** Flag indicating if game is paused due to connection issues */
  private isConnectionPaused: boolean = false;
  
  /* ----------------------------------------
   * Game State Management
   * ---------------------------------------- */
  
  /** Central game state manager */
  private gameStateManager!: GameStateManager;
  
  /** Network manager for P2P communication (null in single-player) */
  private networkManager: NetworkManager | null = null;
  
  /** Deck manager for local player's deck operations */
  private localDeckManager!: DeckManager;

  /* ----------------------------------------
   * Opponent Stats (from network sync)
   * ---------------------------------------- */
  
  /** Opponent's clock time in seconds */
  private opponentClockTime: number = 600;
  
  /** Opponent's stopwatch time in seconds */
  private opponentStopwatchTime: number = 0;
  
  /** Opponent's current mode (focus/disturb) */
  private opponentMode: 'focus' | 'disturb' = 'focus';
  
  /** Opponent's deck card count */
  private opponentDeckCount: number = DECK_SIZE;
  
  /** Opponent's discard pile count */
  private opponentDiscardCount: number = 0;
  
  /** Opponent's hand card count */
  private opponentHandCount: number = INITIAL_DRAW_COUNT;
  
  /** Counter to suppress opponent hand animations during card play */
  private suppressOpponentHandAnimation: number = 0;
  
  /** Array of opponent's discarded cards (for discard viewer) */
  private opponentDiscardCards: Array<Card | null> = [];
  
  /** Counter to suppress local discard top card updates during animation */
  private suppressLocalDiscardTop: number = 0;
  
  /** Counter to suppress opponent discard top card updates during animation */
  private suppressOpponentDiscardTop: number = 0;

  /* ----------------------------------------
   * Layout Cache
   * ---------------------------------------- */
  
  /** Cached layout calculations for current screen size */
  private currentLayout: GameLayout | null = null;
  
  /** Top-left corner position of the chess board */
  private boardTopLeft = { x: 0, y: 0 };
  
  /** Size of each chess board square in pixels */
  private boardSquareSize: number = 64;
  
  /** Current scale factor for the chess board */
  private boardScale: number = 1;
  
  /* ----------------------------------------
   * UI Animation State
   * ---------------------------------------- */
  
  /** Previous UI state snapshot for animation diffing */
  private lastStateSnapshot: UISnapshot | null = null;
  
  /* ----------------------------------------
   * Scene Data
   * ---------------------------------------- */
  
  /** Local player's display name */
  private playerName: string = 'Player';
  
  /** Opponent's display name */
  private opponentName: string = 'Opponent';
  
  /** Local player's assigned color */
  private localColor: PlayerColor = 'white';
  
  /* ----------------------------------------
   * Mulligan UI Elements
   * ---------------------------------------- */
  
  /** Mulligan button container */
  private mulliganButton: Phaser.GameObjects.Container | null = null;
  
  /** Ready/Done button container */
  private readyButton: Phaser.GameObjects.Container | null = null;
  
  /** Semi-transparent overlay for mulligan phase (using Rectangle for performance) */
  private mulliganOverlay: Phaser.GameObjects.Rectangle | null = null;
  
  /** Title text for mulligan phase */
  private mulliganTitleText: Phaser.GameObjects.Text | null = null;
  
  /** Instruction text for mulligan phase */
  private mulliganInstructionText: Phaser.GameObjects.Text | null = null;
  
  /* ----------------------------------------
   * Discard Mode UI Elements
   * ---------------------------------------- */
  
  /** Semi-transparent overlay for discard mode (using Rectangle for performance) */
  private discardOverlay: Phaser.GameObjects.Rectangle | null = null;
  
  /** Prompt text for discard mode */
  private discardPromptText: Phaser.GameObjects.Text | null = null;
  
  /** Flag indicating if player is in discard mode */
  private isDiscardMode: boolean = false;

  /* ----------------------------------------
   * Discard Viewer Overlay
   * ---------------------------------------- */
  
  /** Container for discard pile viewer */
  private discardViewer: Phaser.GameObjects.Container | null = null;
  
  /** Background graphics for discard viewer (using Rectangle for performance) */
  private discardViewerBackground: Phaser.GameObjects.Rectangle | null = null;
  
  /** Panel graphics for discard viewer */
  private discardViewerPanel: Phaser.GameObjects.Graphics | null = null;
  
  /** Title text for discard viewer */
  private discardViewerTitleText: Phaser.GameObjects.Text | null = null;
  
  /** Close button for discard viewer */
  private discardViewerCloseButton: Phaser.GameObjects.Container | null = null;
  
  /** Content container for discard viewer cards */
  private discardViewerContent: Phaser.GameObjects.Container | null = null;
  
  /** Mask graphics for discard viewer scrolling */
  private discardViewerMask: Phaser.GameObjects.Graphics | null = null;
  
  /** Current scroll offset for discard viewer */
  private discardViewerScrollOffset: number = 0;
  
  /** Maximum scroll offset for discard viewer */
  private discardViewerMaxScroll: number = 0;
  
  /** Which side's discard pile is being viewed */
  private discardViewerSide: 'local' | 'opponent' | null = null;
  
  /** Array of card components in discard viewer */
  private discardViewerCards: CardComponent[] = [];
  
  /** Bounds of the discard viewer content area */
  private discardViewerBounds: { x: number; y: number; width: number; height: number } | null = null;
  
  /** Base Y position for discard viewer content */
  private discardViewerContentBaseY: number = 0;
  
  /** Vertical spacing between cards in discard viewer */
  private discardViewerCardSpacingY: number = 0;
  
  /* ----------------------------------------
   * Ready State Tracking
   * ---------------------------------------- */
  
  /** Flag indicating if local player is ready (mulligan phase complete) */
  private localPlayerReady: boolean = false;
  
  /** Flag indicating if opponent is ready (mulligan phase complete) */
  private opponentPlayerReady: boolean = false;

  /**
   * Creates the GameScene instance
   */
  constructor() {
    super({ key: 'GameScene' });
  }

  /* ============================================
   * SCENE LIFECYCLE
   * ============================================ */

  /**
   * Initializes scene with data from MenuScene
   * 
   * @param data - Game initialization data from MenuScene
   * 
   * Used by: Phaser scene lifecycle
   */
  init(data: GameSceneData): void {
    this.playerName = data?.playerName || 'Player';
    this.localColor = data?.localColor || 'white';
    this.networkManager = data?.networkManager || null;
    this.opponentName = data?.opponentName || 'Opponent';
  }

  /**
   * Creates all scene elements and initializes the game
   * 
   * Algorithm:
   * 1. Initialize game state and deck managers
   * 2. Create background and calculate layout
   * 3. Create all UI components (panels, board, hand, etc.)
   * 4. Wire up callbacks for state, network, board, and hand
   * 5. Initialize game (shuffle deck, draw hand, show mulligan)
   * 6. Set up resize and input handlers
   * 
   * Used by: Phaser scene lifecycle
   */
  create(): void {
    const { width, height } = this.scale;
    
    // Initialize game state manager
    const whiteName = this.localColor === 'white' ? this.playerName : this.opponentName;
    const blackName = this.localColor === 'black' ? this.playerName : this.opponentName;
    this.gameStateManager = new GameStateManager(this.localColor, whiteName, blackName);
    
    // Initialize deck manager for local player
    this.localDeckManager = new DeckManager();

    // Initialize animation manager
    this.animations = createGameAnimationManager(this);
    
    // Add background (Requirement 14.5)
    this.createBackground(width, height);
    
    // Calculate layout positions
    const layout = calculateLayout(width, height);
    this.currentLayout = layout;
    
    // Create all UI components in proper positions
    this.createLeftPanel(layout);
    this.createOpponentHand(layout);
    this.createNameplates(layout);
    this.createChessBoard(layout);
    this.createRightPanel(layout);
    this.refreshNameDisplays();
    this.createEventLog(layout);
    this.createCardHand(layout);
    this.createCardCountIndicator(layout);
    this.createTurnBanner(layout);
    
    // Wire up game state manager callbacks
    this.setupGameStateCallbacks();
    
    // Wire up network events
    this.setupNetworkCallbacks();
    
    // Wire up chess board events
    this.setupChessBoardCallbacks();
    
    // Wire up card hand events
    this.setupCardHandCallbacks();
    
    // Initialize the game
    this.initializeGame();
    
    // Handle resize
    this.scale.on('resize', this.handleResize, this);
    this.input.on('wheel', this.handleDiscardViewerWheel, this);
  }

  /* ============================================
   * RESIZE HANDLING
   * ============================================ */
  
  /**
   * Handles window resize - repositions all UI elements
   * 
   * Algorithm:
   * 1. Recalculate layout for new dimensions
   * 2. Reposition background with cover scaling
   * 3. Reposition all UI panels and components
   * 4. Update overlays if visible
   * 
   * @private
   */
  private handleResize(): void {
    const { width, height } = this.scale;
    
    // Recalculate layout
    const layout = calculateLayout(width, height);
    this.currentLayout = layout;
    
    // Reposition and rescale background to cover
    this.scaleBackgroundToCover();
    
    this.positionBoard(layout);
    this.positionEventLog(layout);
    this.positionRightPanel(layout);
    this.positionLeftPanel(layout);
    this.positionOpponentHand(layout);
    this.positionNameplates(layout);
    this.positionCardHand(layout);
    this.positionCardCount(layout);
    this.positionTurnBanner(layout);
    this.positionOverlays(layout);
  }

  /* ============================================
   * BACKGROUND MANAGEMENT
   * ============================================ */

  /**
   * Creates the scene background
   * 
   * @param width - Screen width
   * @param height - Screen height
   * @private
   */
  private createBackground(width: number, height: number): void {
    if (this.textures.exists('room_background')) {
      // Use room background with cover scaling
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
   * 
   * @private
   */
  private scaleBackgroundToCover(): void {
    if (!this.background) return;
    
    const { width, height } = this.scale;
    const bgWidth = this.background.width;
    const bgHeight = this.background.height;
    
    // Scale to cover (like CSS background-size: cover)
    const scaleX = width / bgWidth;
    const scaleY = height / bgHeight;
    const scale = Math.max(scaleX, scaleY);
    
    this.background.setScale(scale);
    this.background.setPosition(width / 2, height / 2);
  }

  /* ============================================
   * POSITION UPDATE METHODS
   * ============================================ */

  /**
   * Updates chess board position and scale
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionBoard(layout: GameLayout): void {
    this.boardTopLeft = {
      x: layout.boardX - layout.boardSize / 2,
      y: layout.boardY - layout.boardSize / 2
    };
    this.boardSquareSize = layout.boardSize / 8;
    this.boardScale = layout.boardScale;
    
    if (this.chessBoard) {
      this.chessBoard.setContainerPosition(this.boardTopLeft.x, this.boardTopLeft.y);
      this.chessBoard.getContainer().setScale(layout.boardScale);
    }
    
    this.animations.setBoardConfig({
      squareSize: this.boardSquareSize,
      boardX: this.boardTopLeft.x,
      boardY: this.boardTopLeft.y,
      isFlipped: this.localColor === 'black'
    });
  }

  /**
   * Updates event log position and scale
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionEventLog(layout: GameLayout): void {
    if (!this.eventLog) return;
    this.eventLog.setPosition(layout.eventLogX, layout.eventLogY);
    this.eventLog.setScale(layout.panelScale);
  }

  /**
   * Updates right panel positions (clocks, stopwatches, energy, toggles)
   * Elements are stacked vertically with consistent spacing
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionRightPanel(layout: GameLayout): void {
    const scale = layout.panelScale;
    const rightX = layout.rightPanelX;
    let rightY = layout.rightPanelTop;
    const gap = 14 * scale;
    
    if (this.opponentClock) {
      this.opponentClock.setPosition(rightX, rightY);
      this.opponentClock.setScale(scale);
      rightY += this.opponentClock.getDimensions().height * scale + gap;
    }
    
    if (this.opponentStopwatch) {
      this.opponentStopwatch.setPosition(rightX, rightY);
      this.opponentStopwatch.setScale(scale);
      rightY += this.opponentStopwatch.getDimensions().height * scale + gap;
    }
    
    if (this.opponentFocusDisturb) {
      this.opponentFocusDisturb.setPosition(rightX, rightY);
      this.opponentFocusDisturb.setScale(scale);
      rightY += 50 * scale + gap;
    }
    
    rightY += 6 * scale;
    
    if (this.playerClock) {
      this.playerClock.setPosition(rightX, rightY);
      this.playerClock.setScale(scale);
      rightY += this.playerClock.getDimensions().height * scale + gap;
    }
    
    if (this.playerStopwatch) {
      this.playerStopwatch.setPosition(rightX, rightY);
      this.playerStopwatch.setScale(scale);
      rightY += this.playerStopwatch.getDimensions().height * scale + gap;
    }
    
    if (this.energyBar) {
      this.energyBar.setPosition(rightX, rightY);
      this.energyBar.setScale(scale);
      rightY += 50 * scale + gap;
    }
    
    if (this.playerFocusDisturb) {
      this.playerFocusDisturb.setPosition(rightX, rightY);
      this.playerFocusDisturb.setScale(scale);
    }
  }

  /**
   * Updates left panel positions (deck and discard piles)
   * Includes visual stack effect based on card counts
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionLeftPanel(layout: GameLayout): void {
    const scale = layout.panelScale;
    const leftX = layout.leftPanelX;
    const deckScale = 0.14 * scale;
    const topCardScale = 0.55 * scale;
    const labelSize = 11 * scale;
    const countSize = 12 * scale;
    
    if (this.opponentDeckSprite) {
      this.opponentDeckSprite.setPosition(leftX, layout.opponentDeckY);
      this.opponentDeckSprite.setScale(deckScale);
      this.opponentDeckSprite.setVisible(this.opponentDeckCount > 0);
    }
    layoutPileStack(this.opponentDeckStack, leftX, layout.opponentDeckY, deckScale, this.opponentDeckCount, 1);
    if (this.opponentDeckLabelText) {
      this.opponentDeckLabelText.setPosition(leftX, layout.opponentDeckY - 60 * scale);
      this.opponentDeckLabelText.setFontSize(labelSize);
    }
    if (this.opponentDeckCountText) {
      this.opponentDeckCountText.setPosition(leftX, layout.opponentDeckY + 55 * scale);
      this.opponentDeckCountText.setFontSize(countSize);
    }
    
    if (this.opponentDiscardSprite) {
      this.opponentDiscardSprite.setPosition(leftX, layout.opponentDiscardY);
      this.opponentDiscardSprite.setScale(deckScale);
      this.opponentDiscardSprite.setVisible(this.opponentDiscardCount > 0 || !!this.opponentDiscardTopCard);
    }
    layoutPileStack(this.opponentDiscardStack, leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount, 0.5);
    if (this.opponentDiscardTopCard) {
      this.opponentDiscardTopCard.setPosition(leftX, layout.opponentDiscardY);
      this.opponentDiscardTopCard.setScale(topCardScale);
    }
    if (this.opponentDiscardLabelText) {
      this.opponentDiscardLabelText.setPosition(leftX, layout.opponentDiscardY - 60 * scale);
      this.opponentDiscardLabelText.setFontSize(labelSize);
    }
    if (this.opponentDiscardCountText) {
      this.opponentDiscardCountText.setPosition(leftX, layout.opponentDiscardY + 55 * scale);
      this.opponentDiscardCountText.setFontSize(countSize);
    }
    
    if (this.playerDiscardSprite) {
      this.playerDiscardSprite.setPosition(leftX, layout.playerDiscardY);
      this.playerDiscardSprite.setScale(deckScale);
      this.playerDiscardSprite.setVisible(this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).discard.length > 0 || !!this.playerDiscardTopCard : false);
    }
    const localDiscardCount = this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).discard.length : 0;
    layoutPileStack(this.playerDiscardStack, leftX, layout.playerDiscardY, deckScale, localDiscardCount, 0.5);
    if (this.playerDiscardTopCard) {
      this.playerDiscardTopCard.setPosition(leftX, layout.playerDiscardY);
      this.playerDiscardTopCard.setScale(topCardScale);
    }
    if (this.playerDiscardLabelText) {
      this.playerDiscardLabelText.setPosition(leftX, layout.playerDiscardY - 60 * scale);
      this.playerDiscardLabelText.setFontSize(labelSize);
    }
    if (this.playerDiscardCountText) {
      this.playerDiscardCountText.setPosition(leftX, layout.playerDiscardY + 55 * scale);
      this.playerDiscardCountText.setFontSize(countSize);
    }
    
    if (this.playerDeckSprite) {
      this.playerDeckSprite.setPosition(leftX, layout.playerDeckY);
      this.playerDeckSprite.setScale(deckScale);
      this.playerDeckSprite.setVisible(this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).deck.length > 0 : false);
    }
    const localDeckCount = this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).deck.length : 0;
    layoutPileStack(this.playerDeckStack, leftX, layout.playerDeckY, deckScale, localDeckCount, 1);
    if (this.playerDeckLabelText) {
      this.playerDeckLabelText.setPosition(leftX, layout.playerDeckY - 60 * scale);
      this.playerDeckLabelText.setFontSize(labelSize);
    }
    if (this.playerDeckCountText) {
      this.playerDeckCountText.setPosition(leftX, layout.playerDeckY + 55 * scale);
      this.playerDeckCountText.setFontSize(countSize);
    }
  }

  /**
   * Updates opponent hand display position
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionOpponentHand(layout: GameLayout): void {
    if (!this.opponentHandContainer) return;
    this.opponentHandContainer.setPosition(layout.opponentHandX, layout.opponentHandY);
    this.opponentHandLabelText.setPosition(layout.opponentHandX, layout.opponentHandLabelY);
    this.opponentHandLabelText.setFontSize(12 * layout.panelScale);
    this.opponentHandCountText.setPosition(layout.opponentHandX, layout.opponentHandCountY);
    this.opponentHandCountText.setFontSize(12 * layout.panelScale);
    
    this.updateOpponentHandDisplay(this.opponentHandCount);
  }

  /**
   * Updates opponent hand card display with fan layout
   * Cards are displayed face-down in a fan pattern
   * 
   * Algorithm:
   * 1. Clear existing card images
   * 2. Calculate fan spread based on card count
   * 3. Position each card with rotation and arc offset
   * 4. Cards are flipped 180 degrees (opponent's perspective)
   * 
   * @param count - Number of cards in opponent's hand
   * @private
   */
  private updateOpponentHandDisplay(count: number): void {
    const layout = this.currentLayout;
    if (!layout || !this.opponentHandContainer) return;
    
    this.opponentHandCount = Math.max(0, count);
    this.opponentHandCountText.setText(`${this.opponentHandCount}`);
    
    this.opponentHandCards.forEach(card => card.destroy());
    this.opponentHandCards = [];
    
    const displayCount = Math.min(this.opponentHandCount, MAX_HAND_SIZE);
    if (displayCount <= 0) return;
    
    const scale = 0.16 * layout.panelScale;
    const spacing = 18 * layout.panelScale;
    const totalWidth = spacing * (displayCount - 1);
    const startX = -totalWidth / 2;
    const maxTilt = Math.min(0.4, displayCount * 0.07);
    const arcDepth = 10 * layout.panelScale;
    
    for (let i = 0; i < displayCount; i++) {
      const t = displayCount === 1 ? 0.5 : i / Math.max(1, displayCount - 1);
      // Angle for fan spread (reversed for opponent's perspective)
      const angle = maxTilt - t * maxTilt * 2;
      // Positive arcOffset so cards arc upward (fan closed at top, open at bottom)
      const arcOffset = Math.abs(angle) * arcDepth;
      const card = this.add.image(startX + i * spacing, arcOffset, 'card_back');
      card.setScale(scale);
      // Flip card 180 degrees and apply fan angle
      card.setRotation(Math.PI + angle);
      card.setDepth(12 + i);
      this.opponentHandContainer.add(card);
      this.opponentHandCards.push(card);
    }
  }

  /**
   * Updates player nameplate positions and colors
   * White player gets white text, black player gets gray text
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionNameplates(layout: GameLayout): void {
    const fontSize = 20 * layout.panelScale;
    const colorLocal = this.localColor === 'white' ? '#ffffff' : '#cccccc';
    const colorOpponent = this.localColor === 'white' ? '#cccccc' : '#ffffff';
    
    this.playerNameText.setPosition(layout.playerNameX, layout.playerNameY);
    this.playerNameText.setFontSize(fontSize);
    this.playerNameText.setColor(colorLocal);
    
    this.opponentNameText.setPosition(layout.opponentNameX, layout.opponentNameY);
    this.opponentNameText.setFontSize(fontSize);
    this.opponentNameText.setColor(colorOpponent);
  }

  /**
   * Updates card hand position and configures board bounds for targeting
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionCardHand(layout: GameLayout): void {
    if (!this.cardHand) return;
    this.cardHand.setPosition(layout.cardHandX, layout.cardHandY);
    this.cardHand.setScale(1);
    this.cardHand.setHandScale(layout.handScale);
    this.cardHand.setPreviewPosition(layout.previewX, layout.previewY);
    this.cardHand.setPlayZone({
      x: this.boardTopLeft.x,
      y: this.boardTopLeft.y,
      width: layout.boardSize,
      height: layout.boardSize
    });
    this.cardHand.setBoardBounds(
      this.boardTopLeft.x,
      this.boardTopLeft.y,
      layout.boardSize,
      layout.boardSize,
      this.boardSquareSize,
      this.localColor === 'black'
    );
  }

  /**
   * Updates card count indicator position
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionCardCount(layout: GameLayout): void {
    if (!this.cardCountText) return;
    this.cardCountText.setPosition(layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale);
    this.cardCountText.setFontSize(14 * layout.panelScale);
  }

  /**
   * Updates turn banner position
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionTurnBanner(layout: GameLayout): void {
    if (!this.turnBanner) return;
    this.turnBanner.setPosition(layout.turnBannerX, layout.turnBannerY);
    this.turnBanner.setScale(layout.panelScale);
  }

  /**
   * Updates all overlay positions (mulligan, discard, connection, viewer)
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private positionOverlays(layout: GameLayout): void {
    const { width, height } = layout;
    
    if (this.mulliganOverlay) {
      // Rectangle uses center origin, so position at center and set size
      this.mulliganOverlay.setPosition(width / 2, height / 2);
      this.mulliganOverlay.setSize(width, height);
    }
    if (this.mulliganTitleText) {
      this.mulliganTitleText.setPosition(width / 2, height / 2 - 180 * layout.panelScale);
      this.mulliganTitleText.setFontSize(32 * layout.panelScale);
    }
    if (this.mulliganInstructionText) {
      this.mulliganInstructionText.setPosition(width / 2, height / 2 - 130 * layout.panelScale);
      this.mulliganInstructionText.setFontSize(16 * layout.panelScale);
    }
    if (this.mulliganButton) {
      this.mulliganButton.setPosition(width / 2 - 140 * layout.panelScale, height / 2 - 40 * layout.panelScale);
      this.mulliganButton.setData('baseScale', layout.panelScale);
      this.mulliganButton.setScale(layout.panelScale);
    }
    if (this.readyButton) {
      this.readyButton.setPosition(width / 2 + 140 * layout.panelScale, height / 2 - 40 * layout.panelScale);
      this.readyButton.setData('baseScale', layout.panelScale);
      this.readyButton.setScale(layout.panelScale);
    }
    
    if (this.discardOverlay) {
      // Rectangle uses center origin, so position at center and set size
      this.discardOverlay.setPosition(width / 2, height / 2);
      this.discardOverlay.setSize(width, height);
    }
    if (this.discardPromptText) {
      this.discardPromptText.setPosition(width / 2, height / 2 - 150 * layout.panelScale);
      this.discardPromptText.setFontSize(24 * layout.panelScale);
    }
    
    if (this.connectionOverlay && this.connectionOverlayBackground) {
      // Rectangle uses center origin, so position at center and set size
      this.connectionOverlayBackground.setPosition(width / 2, height / 2);
      this.connectionOverlayBackground.setSize(width, height);
      this.connectionOverlay.setPosition(0, 0);
    }
    if (this.connectionOverlayText) {
      this.connectionOverlayText.setPosition(width / 2, height / 2 - 40 * layout.panelScale);
      this.connectionOverlayText.setFontSize(24 * layout.panelScale);
    }
    if (this.connectionOverlayButton) {
      this.connectionOverlayButton.setPosition(width / 2, height / 2 + 40 * layout.panelScale);
      this.connectionOverlayButton.setData('baseScale', layout.panelScale);
      this.connectionOverlayButton.setScale(layout.panelScale);
    }

    if (this.discardViewer) {
      this.layoutDiscardViewer(layout);
      this.buildDiscardViewerCards(layout);
    }
  }

  /* ============================================
   * UI COMPONENT CREATION
   * ============================================ */

  /**
   * Creates the event log component
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createEventLog(layout: GameLayout): void {
    // Event log on the right side, full height
    this.eventLog = new EventLogComponent(this, layout.eventLogX, layout.eventLogY);
    this.eventLog.setDepth(10);
    this.eventLog.setScale(layout.panelScale);
  }

  /**
   * Creates the chess board component
   * Board is flipped if local player is black (Requirement 1.8)
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createChessBoard(layout: GameLayout): void {
    // Flip board if local player is black (Requirement 1.8)
    const isFlipped = this.localColor === 'black';
    
    this.chessBoard = new ChessBoardComponent(
      this,
      layout.boardX - layout.boardSize / 2,
      layout.boardY - layout.boardSize / 2,
      1, 
      isFlipped
    );
    this.chessBoard.getContainer().setDepth(5);
    this.positionBoard(layout);
  }

  /**
   * Creates the right panel with clocks, stopwatches, energy bar, and toggles
   * Components are stacked vertically in order:
   * 1. Opponent Clock
   * 2. Opponent Stopwatch
   * 3. Opponent Focus/Disturb toggle
   * 4. Player Clock
   * 5. Player Stopwatch
   * 6. Energy Bar
   * 7. Player Focus/Disturb toggle
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createRightPanel(layout: GameLayout): void {
    const x = layout.rightPanelX;
    const scale = layout.panelScale;
    const y = layout.rightPanelTop;
    
    // 1. Opponent Clock (top)
    this.opponentClock = new ClockComponent(this, x, y, 600, this.opponentName);
    this.opponentClock.setDepth(10);
    this.opponentClock.setScale(scale);
    
    // 2. Opponent Stopwatch
    this.opponentStopwatch = new StopwatchComponent(this, x, y);
    this.opponentStopwatch.setLabel(`${this.opponentName} Timer`);
    this.opponentStopwatch.setDepth(10);
    this.opponentStopwatch.setScale(scale);

    // 3. Opponent Focus/Disturb toggle
    this.opponentFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
    this.opponentFocusDisturb.setLabel('Opp Mode');
    this.opponentFocusDisturb.setEnabled(false); // Opponent's toggle is read-only
    this.opponentFocusDisturb.setDepth(10);
    this.opponentFocusDisturb.setScale(scale);
    
    // 4. Your Clock
    this.playerClock = new ClockComponent(this, x, y, 600, this.playerName);
    this.playerClock.setActive(true);
    this.playerClock.setDepth(10);
    this.playerClock.setScale(scale);
    
    // 5. Your Stopwatch
    this.playerStopwatch = new StopwatchComponent(this, x, y);
    this.playerStopwatch.setLabel('Your Timer');
    this.playerStopwatch.setDepth(10);
    this.playerStopwatch.setScale(scale);
    
    // 6. Energy Bar
    this.energyBar = new EnergyBarComponent(this, x, y, 'Energy');
    this.energyBar.setDepth(10);
    this.energyBar.setScale(scale);
    
    // 7. Your Focus/Disturb toggle (bottom)
    this.playerFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
    this.playerFocusDisturb.setLabel('Your Mode');
    this.playerFocusDisturb.setDepth(10);
    this.playerFocusDisturb.setScale(scale);
    this.playerFocusDisturb.onModeChange = (mode) => {
      this.gameStateManager.setMode(this.localColor, mode);
      this.logEvent('system', `Mode changed to ${mode}`);
      this.sendLocalPlayerStats();
    };
    
    this.positionRightPanel(layout);
  }

  /**
   * Create left panel with deck/discard piles for both players
   * Top: Opponent's deck, opponent's discard
   * Bottom: Player's discard, player's deck
   */
  private createLeftPanel(layout: GameLayout): void {
    const scale = layout.panelScale;
    const x = layout.leftPanelX;
    const deckScale = 0.14 * scale;
    const stackDepth = MAX_PILE_LAYERS;
    
    // === OPPONENT'S DECK (top) ===
    this.opponentDeckStack = createPileStack(this, x, layout.opponentDeckY, deckScale, stackDepth, 1);
    this.opponentDeckSprite = this.add.image(x, layout.opponentDeckY, 'card_back');
    this.opponentDeckSprite.setScale(deckScale);
    this.opponentDeckSprite.setDepth(10);
    
    this.opponentDeckLabelText = this.add.text(x, layout.opponentDeckY - 60 * scale, "Opp Deck", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
    }).setOrigin(0.5).setDepth(10);
    
    this.opponentDeckCountText = this.add.text(x, layout.opponentDeckY + 55 * scale, '60', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
    }).setOrigin(0.5).setDepth(10);
    
    // === OPPONENT'S DISCARD (below deck) ===
    this.opponentDiscardStack = createPileStack(this, x, layout.opponentDiscardY, deckScale, stackDepth, 0.5);
    this.opponentDiscardSprite = this.add.image(x, layout.opponentDiscardY, 'card_back');
    this.opponentDiscardSprite.setScale(deckScale);
    this.opponentDiscardSprite.setDepth(10);
    this.opponentDiscardSprite.setAlpha(0.5);
    
    this.opponentDiscardLabelText = this.add.text(x, layout.opponentDiscardY - 60 * scale, "Opp Discard", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    this.opponentDiscardCountText = this.add.text(x, layout.opponentDiscardY + 55 * scale, '0', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    // === PLAYER'S DISCARD (above player deck) ===
    this.playerDiscardStack = createPileStack(this, x, layout.playerDiscardY, deckScale, stackDepth, 0.5);
    this.playerDiscardSprite = this.add.image(x, layout.playerDiscardY, 'card_back');
    this.playerDiscardSprite.setScale(deckScale);
    this.playerDiscardSprite.setDepth(10);
    this.playerDiscardSprite.setAlpha(0.5);
    
    this.playerDiscardLabelText = this.add.text(x, layout.playerDiscardY - 60 * scale, "Your Discard", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    this.playerDiscardCountText = this.add.text(x, layout.playerDiscardY + 55 * scale, '0', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    // === PLAYER'S DECK (bottom) ===
    this.playerDeckStack = createPileStack(this, x, layout.playerDeckY, deckScale, stackDepth, 1);
    this.playerDeckSprite = this.add.image(x, layout.playerDeckY, 'card_back');
    this.playerDeckSprite.setScale(deckScale);
    this.playerDeckSprite.setDepth(10);
    
    this.playerDeckLabelText = this.add.text(x, layout.playerDeckY - 60 * scale, "Your Deck", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
    }).setOrigin(0.5).setDepth(10);
    
    this.playerDeckCountText = this.add.text(x, layout.playerDeckY + 55 * scale, '60', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
    }).setOrigin(0.5).setDepth(10);

    this.makeDiscardPileInteractive(this.playerDiscardSprite, 'local');
    this.makeDiscardPileInteractive(this.opponentDiscardSprite, 'opponent');

    this.positionLeftPanel(layout);
  }

  /**
   * Creates the opponent's hand display container
   * Shows face-down cards in a fan pattern
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createOpponentHand(layout: GameLayout): void {
    this.opponentHandContainer = this.add.container(layout.opponentHandX, layout.opponentHandY);
    this.opponentHandContainer.setDepth(12);
    
    this.opponentHandLabelText = this.add.text(
      layout.opponentHandX,
      layout.opponentHandLabelY,
      'Opponent Hand',
      { fontSize: `${12 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
    ).setOrigin(0.5).setDepth(12);
    
    this.opponentHandCountText = this.add.text(
      layout.opponentHandX,
      layout.opponentHandCountY,
      '0',
      { fontSize: `${12 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(12);
    
    this.updateOpponentHandDisplay(this.opponentHandCount);
    this.positionOpponentHand(layout);
  }

  /**
   * Creates player nameplates above and below the board
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createNameplates(layout: GameLayout): void {
    this.opponentNameText = this.add.text(
      layout.opponentNameX,
      layout.opponentNameY,
      this.opponentName,
      { fontSize: `${20 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
    ).setOrigin(0.5).setDepth(15);
    
    this.playerNameText = this.add.text(
      layout.playerNameX,
      layout.playerNameY,
      this.playerName,
      { fontSize: `${20 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(15);
    
    this.positionNameplates(layout);
  }

  /**
   * Creates the player's card hand component
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createCardHand(layout: GameLayout): void {
    this.cardHand = new CardHandComponent(
      this, layout.cardHandX, layout.cardHandY,
      layout.previewX, layout.previewY
    );
    this.cardHand.setDepth(20);
    this.cardHand.setScale(1);
    this.cardHand.setHandScale(layout.handScale);
    this.positionCardHand(layout);
    
    this.cardHand.enableInteraction();
  }

  /**
   * Creates the card count indicator text
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createCardCountIndicator(layout: GameLayout): void {
    this.cardCountText = this.add.text(
      layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale, 'Hand: 0 / 7',
      { fontSize: `${14 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(10);
    this.positionCardCount(layout);
  }

  /**
   * Creates the turn announcement banner
   * Banner appears briefly at turn changes
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private createTurnBanner(layout: GameLayout): void {
    this.turnBanner = this.add.container(layout.turnBannerX, layout.turnBannerY);
    this.turnBanner.setDepth(100);
    this.turnBanner.setVisible(false);
    
    const bg = this.add.graphics();
    bg.fillStyle(hex('#000000'), 0.7);
    bg.fillRoundedRect(-180, -28, 360, 56, 12);
    
    this.turnBannerText = this.add.text(0, 0, '', {
      fontSize: `${26 * layout.panelScale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5);
    
    this.turnBanner.add([bg, this.turnBannerText]);
  }

  // ============================================
  // Game State Callbacks
  // ============================================

  /**
   * Sets up callback for game state changes
   * 
   * @private
   */
  private setupGameStateCallbacks(): void {
    this.gameStateManager.setOnStateChange((_state) => {
      this.updateUIFromState();
    });
  }

  /**
   * Updates all UI components from current game state
   * 
   * Algorithm:
   * 1. Get current state from game state manager
   * 2. Update clocks, stopwatches, energy bar
   * 3. Update deck/discard counts and displays
   * 4. Update hand displays if changed
   * 5. Update chess board if FEN changed
   * 6. Check for discard mode trigger
   * 7. Run UI animations for state changes
   * 8. Send stats to opponent if networked
   * 
   * @param options - Options for update behavior
   * @param options.sendStats - Whether to send stats to opponent (default: true)
   * @private
   */
  private updateUIFromState(options: { sendStats?: boolean } = {}): void {
    const state = this.gameStateManager.getState();
    const localPlayer = state.players[this.localColor];
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const opponentPlayer = state.players[opponentColor];

    const opponentClock = this.networkManager ? this.opponentClockTime : opponentPlayer.clock;
    const opponentStopwatch = this.networkManager ? this.opponentStopwatchTime : opponentPlayer.stopwatch;
    const opponentMode = this.networkManager ? this.opponentMode : opponentPlayer.mode;
    const opponentDeckCount = this.networkManager ? this.opponentDeckCount : opponentPlayer.deck.length;
    const opponentDiscardCount = this.networkManager ? this.opponentDiscardCount : opponentPlayer.discard.length;
    const opponentHandCount = this.networkManager ? this.opponentHandCount : opponentPlayer.hand.length;

    // Update clocks
    this.playerClock.setTime(localPlayer.clock);
    this.opponentClock.setTime(opponentClock);

    // Update active clock indicator
    const isLocalTurn = state.currentTurn === this.localColor;
    this.playerClock.setActive(isLocalTurn);
    this.opponentClock.setActive(!isLocalTurn);

    // Update stopwatches
    this.playerStopwatch.setTime(localPlayer.stopwatch);
    this.opponentStopwatch.setTime(opponentStopwatch);

    // Update energy bar
    this.energyBar.setEnergy(localPlayer.energy, localPlayer.energyCap);

    // Update Focus/Disturb toggles
    this.playerFocusDisturb.setMode(localPlayer.mode);
    this.opponentFocusDisturb.setMode(opponentMode);

    // Update opponent deck counts
    this.updateOpponentDeckCounts(opponentDeckCount, opponentDiscardCount);

    // Update player deck counts
    this.updatePlayerDeckCounts(localPlayer.deck.length, localPlayer.discard.length);
    
    // Only reposition left panel if deck/discard counts changed (performance optimization)
    const deckCountsChanged = !this.lastStateSnapshot || 
      this.lastStateSnapshot.localDeck !== localPlayer.deck.length ||
      this.lastStateSnapshot.localDiscard !== localPlayer.discard.length ||
      this.lastStateSnapshot.opponentDeck !== opponentDeckCount ||
      this.lastStateSnapshot.opponentDiscard !== opponentDiscardCount;
    
    if (deckCountsChanged && this.currentLayout) {
      this.positionLeftPanel(this.currentLayout);
    }
    this.refreshDiscardTopCards();
    if (this.discardViewer && this.currentLayout && deckCountsChanged) {
      this.buildDiscardViewerCards(this.currentLayout);
    }

    // Update hand display if hand changed (e.g., card drawn at turn start)
    if (this.cardHand.getCardCount() !== localPlayer.hand.length) {
      this.updateHandDisplay();
    }

    if (!this.lastStateSnapshot || this.lastStateSnapshot.opponentHand !== opponentHandCount) {
      this.updateOpponentHandDisplay(opponentHandCount);
    }

    // Update card count
    this.updateCardCount();

    // Update chess board position
    if (state.boardFEN !== this.chessBoard.getPosition()) {
      this.chessBoard.setPosition(state.boardFEN);
    }

    // Check for hand size enforcement (Requirement 3.6)
    if (localPlayer.hand.length > MAX_HAND_SIZE && !this.isDiscardMode) {
      this.enterDiscardMode();
    }

    const snapshot: UISnapshot = {
      localClock: localPlayer.clock,
      opponentClock,
      localStopwatch: localPlayer.stopwatch,
      opponentStopwatch,
      localEnergy: localPlayer.energy,
      localEnergyCap: localPlayer.energyCap,
      currentTurn: state.currentTurn,
      localHand: localPlayer.hand.length,
      opponentHand: opponentHandCount,
      localDeck: localPlayer.deck.length,
      localDiscard: localPlayer.discard.length,
      opponentDeck: opponentDeckCount,
      opponentDiscard: opponentDiscardCount
    };

    if (this.lastStateSnapshot) {
      this.runUIAnimations(this.lastStateSnapshot, snapshot);
    }
    this.lastStateSnapshot = snapshot;

    // Send local player stats to opponent for sync
    if (options.sendStats ?? true) {
      this.sendLocalPlayerStats();
    }
  }

  /**
   * Runs UI animations based on state changes
   * Compares previous and current snapshots to trigger appropriate animations
   * 
   * @param prev - Previous UI state snapshot
   * @param next - Current UI state snapshot
   * @private
   */
  private runUIAnimations(prev: UISnapshot, next: UISnapshot): void {
    const layout = this.currentLayout;
    if (!layout) return;
    
    if (prev.currentTurn !== next.currentTurn) {
      this.showTurnBanner(next.currentTurn);
    }
    
    if (prev.localClock !== next.localClock) {
      this.animations.animateClockChange(
        this.playerClock.getContainer(),
        this.playerClock.getTimeText(),
        prev.localClock,
        next.localClock
      );
      this.createFloatingDelta(
        this.playerClock.getContainer().x,
        this.playerClock.getContainer().y - 50 * layout.panelScale,
        next.localClock - prev.localClock,
        next.localClock - prev.localClock >= 0 ? '#66ff66' : '#ff6666',
        's'
      );
    }
    
    if (prev.opponentClock !== next.opponentClock) {
      this.animations.animateClockChange(
        this.opponentClock.getContainer(),
        this.opponentClock.getTimeText(),
        prev.opponentClock,
        next.opponentClock
      );
      this.createFloatingDelta(
        this.opponentClock.getContainer().x,
        this.opponentClock.getContainer().y - 50 * layout.panelScale,
        next.opponentClock - prev.opponentClock,
        next.opponentClock - prev.opponentClock >= 0 ? '#66ff66' : '#ff6666',
        's'
      );
    }
    
    if (prev.localEnergy !== next.localEnergy || prev.localEnergyCap !== next.localEnergyCap) {
      this.animations.animateEnergyChange(
        this.energyBar.getContainer(),
        this.energyBar.getEnergyText(),
        prev.localEnergy,
        next.localEnergy
      );
      if (next.localEnergyCap > prev.localEnergyCap) {
        this.animations.animateEnergyCapIncrease(this.energyBar.getContainer());
      }
    }
    
    if (prev.localStopwatch !== next.localStopwatch) {
      this.animateStopwatchChange(this.playerStopwatch, prev.localStopwatch, next.localStopwatch);
    }
    if (prev.opponentStopwatch !== next.opponentStopwatch) {
      this.animateStopwatchChange(this.opponentStopwatch, prev.opponentStopwatch, next.opponentStopwatch);
    }
    
    if (next.localHand > prev.localHand) {
      this.animateCardDraw('local', next.localHand - prev.localHand);
    }
    
    if (next.opponentHand > prev.opponentHand) {
      this.animateCardDraw('opponent', next.opponentHand - prev.opponentHand);
    }
    
    if (next.opponentHand < prev.opponentHand && next.opponentDiscard > prev.opponentDiscard) {
      if (this.suppressOpponentHandAnimation > 0) {
        this.suppressOpponentHandAnimation--;
      } else {
        const count = Math.min(prev.opponentHand - next.opponentHand, next.opponentDiscard - prev.opponentDiscard);
        this.animateCardDiscard('opponent', count);
      }
    } else if (this.suppressOpponentHandAnimation > 0 && next.opponentHand === prev.opponentHand) {
      this.suppressOpponentHandAnimation--;
    }
  }

  /**
   * Animates stopwatch value change with bounce and color flash
   * 
   * @param component - Stopwatch component to animate
   * @param oldValue - Previous time value
   * @param newValue - New time value
   * @private
   */
  private animateStopwatchChange(component: StopwatchComponent, oldValue: number, newValue: number): void {
    const diff = newValue - oldValue;
    if (diff === 0) return;
    
    const container = component.getContainer();
    const text = component.getTimeText();
    const color = diff > 0 ? '#ffaa44' : '#66aaff';
    const layout = this.currentLayout;
    const offset = layout ? 40 * layout.panelScale : 40;
    
    this.animations.bounce(container);
    text.setColor(color);
    
    this.time.delayedCall(300, () => {
      component.setTime(newValue);
    });
    
    this.createFloatingDelta(
      container.x,
      container.y - offset,
      diff,
      color,
      's'
    );
  }

  /**
   * Animates cards being drawn from deck to hand
   * Creates temporary card images that arc from deck to hand position
   * 
   * @param side - Which player is drawing ('local' or 'opponent')
   * @param count - Number of cards being drawn
   * @private
   */
  private animateCardDraw(side: 'local' | 'opponent', count: number): void {
    const layout = this.currentLayout;
    if (!layout || count <= 0) return;
    
    const deckSprite = side === 'local' ? this.playerDeckSprite : this.opponentDeckSprite;
    if (!deckSprite) return;
    const handPos = side === 'local'
      ? { x: layout.cardHandX, y: layout.cardHandY - 40 * layout.handScale }
      : { x: layout.opponentHandX, y: layout.opponentHandY + 10 * layout.panelScale };
    
    const scale = 0.26 * layout.panelScale;
    const spacing = 22 * layout.panelScale;
    const startX = handPos.x - ((Math.min(count, 3) - 1) * spacing) / 2;
    
    for (let i = 0; i < Math.min(count, 3); i++) {
      const card = this.add.image(deckSprite.x, deckSprite.y, 'card_back');
      card.setScale(scale);
      card.setDepth(30);
      
      const toPos = { x: startX + i * spacing, y: handPos.y };
      this.animations.arcMove(card, { x: deckSprite.x, y: deckSprite.y }, toPos, 120 * layout.panelScale, {
        duration: 350,
        onComplete: () => card.destroy()
      });
    }
  }

  /**
   * Animates cards being discarded from hand to discard pile
   * Creates temporary card images that move from hand to discard
   * 
   * @param side - Which player is discarding ('local' or 'opponent')
   * @param count - Number of cards being discarded
   * @private
   */
  private animateCardDiscard(side: 'local' | 'opponent', count: number): void {
    const layout = this.currentLayout;
    if (!layout || count <= 0) return;
    
    const discardSprite = side === 'local' ? this.playerDiscardSprite : this.opponentDiscardSprite;
    if (!discardSprite) return;
    const handPos = side === 'local'
      ? { x: layout.cardHandX, y: layout.cardHandY - 20 * layout.handScale }
      : { x: layout.opponentHandX, y: layout.opponentHandY };
    
    const scale = 0.26 * layout.panelScale;
    const spacing = 18 * layout.panelScale;
    const startX = handPos.x - ((Math.min(count, 2) - 1) * spacing) / 2;
    
    for (let i = 0; i < Math.min(count, 2); i++) {
      const card = this.add.image(startX + i * spacing, handPos.y, 'card_back');
      card.setScale(scale);
      card.setDepth(30);
      
      this.tweens.add({
        targets: card,
        x: discardSprite.x,
        y: discardSprite.y,
        scaleX: scale * 0.6,
        scaleY: scale * 0.6,
        alpha: 0.5,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => card.destroy()
      });
    }
  }

  /**
   * Creates a floating delta text that animates upward and fades out
   * Used to show value changes (+5s, -10s, etc.)
   * 
   * @param x - X position
   * @param y - Y position
   * @param value - Delta value to display
   * @param color - Text color
   * @param suffix - Optional suffix (e.g., 's' for seconds)
   * @private
   */
  private createFloatingDelta(x: number, y: number, value: number, color: string, suffix: string = ''): void {
    const sign = value >= 0 ? '+' : '';
    const layout = this.currentLayout;
    const fontSize = layout ? 18 * layout.panelScale : 18;
    const text = this.add.text(x, y, `${sign}${value}${suffix}`, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: `${fontSize}px`,
      color,
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    text.setDepth(2000);
    
    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy()
    });
  }

  /**
   * Shows the turn announcement banner with animation
   * Banner pops in, displays briefly, then fades out
   * 
   * @param turn - Which player's turn it is
   * @private
   */
  private showTurnBanner(turn: PlayerColor): void {
    if (!this.turnBanner || !this.turnBannerText) return;
    const layout = this.currentLayout;
    if (!layout) return;
    
    const isLocalTurn = turn === this.localColor;
    const bannerText = isLocalTurn ? 'Your Turn' : `${this.opponentName}'s Turn`;
    const color = isLocalTurn ? '#66ff66' : '#ffcc66';
    
    this.turnBannerText.setText(bannerText);
    this.turnBannerText.setColor(color);
    const baseScale = layout.panelScale;
    this.turnBanner.setPosition(layout.turnBannerX, layout.turnBannerY);
    this.turnBanner.setVisible(true);
    this.turnBanner.setAlpha(0);
    this.turnBanner.setScale(baseScale * 0.9);
    
    this.tweens.add({
      targets: this.turnBanner,
      alpha: 1,
      scaleX: baseScale,
      scaleY: baseScale,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: this.turnBanner,
          alpha: 0,
          y: layout.turnBannerY + 10 * layout.panelScale,
          duration: 600,
          delay: 900,
          ease: 'Quad.easeIn',
          onComplete: () => {
            if (this.turnBanner) {
              this.turnBanner.setVisible(false);
              this.turnBanner.setY(layout.turnBannerY);
            }
          }
        });
      }
    });
  }

  /**
   * Shows the connection status overlay
   * Displays message and return to menu button
   * Pauses game interaction while visible
   * 
   * @param message - Status message to display
   * @private
   */
  private showConnectionOverlay(message: string): void {
    const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
    this.currentLayout = layout;
    
    if (!this.connectionOverlay) {
      this.connectionOverlay = this.add.container(0, 0);
      this.connectionOverlay.setDepth(200);
      
      // Using Rectangle for better performance than Graphics
      this.connectionOverlayBackground = this.add.rectangle(
        layout.width / 2, layout.height / 2, 
        layout.width, layout.height, 
        hex('#000000'), 0.6
      );
      this.connectionOverlay.add(this.connectionOverlayBackground);
      
      this.connectionOverlayText = this.add.text(layout.width / 2, layout.height / 2 - 40 * layout.panelScale, message, {
        fontFamily: 'BoldPixels, Arial',
        fontSize: `${24 * layout.panelScale}px`,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: layout.width * 0.7 }
      }).setOrigin(0.5);
      this.connectionOverlay.add(this.connectionOverlayText);
      
      this.connectionOverlayButton = createImageButton(this, 
        layout.width / 2,
        layout.height / 2 + 40 * layout.panelScale,
        'RETURN TO MENU',
        'red_button',
        'red_button_pressed',
        () => {
          this.networkManager?.leaveRoom();
          this.scene.start('MenuScene');
        }
      );
      this.connectionOverlayButton.setData('baseScale', layout.panelScale);
      this.connectionOverlayButton.setScale(layout.panelScale);
      this.connectionOverlay.add(this.connectionOverlayButton);
    } else if (this.connectionOverlayText) {
      this.connectionOverlayText.setText(message);
    }
    
    this.connectionOverlay?.setVisible(true);
    this.isConnectionPaused = true;
    this.cardHand?.disableInteraction();
  }

  /**
   * Hides the connection status overlay
   * Resumes game interaction
   * 
   * @private
   */
  private hideConnectionOverlay(): void {
    if (this.connectionOverlay) {
      this.connectionOverlay.setVisible(false);
    }
    this.isConnectionPaused = false;
    this.cardHand?.enableInteraction();
  }

  /**
   * Shows the discard pile viewer overlay
   * Displays all cards in the selected discard pile with scrolling
   * 
   * @param side - Which discard pile to view ('local' or 'opponent')
   * @private
   */
  private showDiscardViewer(side: 'local' | 'opponent'): void {
    const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
    this.currentLayout = layout;

    this.hideDiscardViewer();
    this.discardViewerSide = side;
    this.discardViewerScrollOffset = 0;

    this.discardViewer = this.add.container(0, 0);
    this.discardViewer.setDepth(220);

    // Using Rectangle for better performance than Graphics
    this.discardViewerBackground = this.add.rectangle(
      layout.width / 2, layout.height / 2,
      layout.width, layout.height,
      hex('#000000'), 0.6
    );
    this.discardViewerBackground.setInteractive();
    this.discardViewerBackground.on('pointerdown', () => this.hideDiscardViewer());
    this.discardViewer.add(this.discardViewerBackground);

    this.discardViewerPanel = this.add.graphics();
    this.discardViewer.add(this.discardViewerPanel);

    const title = side === 'local' ? 'Your Discard Pile' : `${this.opponentName} Discard Pile`;
    this.discardViewerTitleText = this.add.text(0, 0, title, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: `${20 * layout.panelScale}px`,
      color: '#ffffff'
    }).setOrigin(0.5, 0.5);
    this.discardViewer.add(this.discardViewerTitleText);

    this.discardViewerCloseButton = createImageButton(this, 
      0,
      0,
      'CLOSE',
      'red_button',
      'red_button_pressed',
      () => this.hideDiscardViewer()
    );
    this.discardViewerCloseButton.setData('baseScale', layout.panelScale * 0.7);
    this.discardViewerCloseButton.setScale(layout.panelScale * 0.7);
    this.discardViewer.add(this.discardViewerCloseButton);

    this.discardViewerContent = this.add.container(0, 0);
    this.discardViewerMask = this.add.graphics();
    this.discardViewerMask.setVisible(false);
    this.discardViewer.add(this.discardViewerMask);
    this.discardViewer.add(this.discardViewerContent);

    this.layoutDiscardViewer(layout);
    this.buildDiscardViewerCards(layout);
    this.cardHand?.disableInteraction();
  }

  /**
   * Hides the discard pile viewer overlay
   * Cleans up all viewer elements and re-enables interaction
   * 
   * @private
   */
  private hideDiscardViewer(): void {
    this.discardViewerCards.forEach(card => card.destroy());
    this.discardViewerCards = [];
    this.discardViewerContent?.destroy();
    this.discardViewerMask?.destroy();
    this.discardViewerPanel?.destroy();
    this.discardViewerTitleText?.destroy();
    this.discardViewerCloseButton?.destroy();
    this.discardViewerBackground?.destroy();
    this.discardViewer?.destroy();
    this.discardViewer = null;
    this.discardViewerBackground = null;
    this.discardViewerPanel = null;
    this.discardViewerTitleText = null;
    this.discardViewerCloseButton = null;
    this.discardViewerContent = null;
    this.discardViewerMask = null;
    this.discardViewerBounds = null;
    this.discardViewerSide = null;
    this.discardViewerScrollOffset = 0;
    this.discardViewerMaxScroll = 0;
    this.cardHand?.enableInteraction();
  }

  /**
   * Lays out the discard viewer panel and content area
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private layoutDiscardViewer(layout: GameLayout): void {
    if (!this.discardViewer || !this.discardViewerPanel || !this.discardViewerTitleText || !this.discardViewerCloseButton || !this.discardViewerMask) {
      return;
    }

    const panelWidth = Math.min(layout.width * 0.72, 760 * layout.panelScale);
    const panelHeight = Math.min(layout.height * 0.78, 640 * layout.panelScale);
    const panelX = layout.width / 2;
    const panelY = layout.height / 2;
    const padding = 24 * layout.panelScale;
    const titleHeight = 56 * layout.panelScale;

    this.discardViewerPanel.clear();
    this.discardViewerPanel.fillStyle(hex('#1a1a2e'), 0.96);
    this.discardViewerPanel.fillRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      12
    );
    this.discardViewerPanel.lineStyle(2, hex('#4a4a6e'), 1);
    this.discardViewerPanel.strokeRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      12
    );

    this.discardViewerTitleText.setPosition(panelX, panelY - panelHeight / 2 + titleHeight * 0.55);
    this.discardViewerTitleText.setFontSize(20 * layout.panelScale);

    this.discardViewerCloseButton.setPosition(panelX + panelWidth / 2 - 70 * layout.panelScale, panelY - panelHeight / 2 + titleHeight * 0.55);
    this.discardViewerCloseButton.setData('baseScale', layout.panelScale * 0.7);
    this.discardViewerCloseButton.setScale(layout.panelScale * 0.7);

    const contentX = panelX - panelWidth / 2 + padding;
    const contentY = panelY - panelHeight / 2 + titleHeight;
    const contentWidth = panelWidth - padding * 2;
    const contentHeight = panelHeight - titleHeight - padding;

    this.discardViewerBounds = { x: contentX, y: contentY, width: contentWidth, height: contentHeight };
    this.discardViewerContentBaseY = contentY;

    this.discardViewerMask.clear();
    this.discardViewerMask.fillStyle(hex('#ffffff'));
    this.discardViewerMask.fillRect(contentX, contentY, contentWidth, contentHeight);

    const mask = this.discardViewerMask.createGeometryMask();
    this.discardViewerContent?.setMask(mask);

    if (this.discardViewerContent) {
      this.discardViewerContent.setPosition(contentX, contentY);
    }

    if (this.discardViewerBackground) {
      // Rectangle uses center origin, so position at center and set size
      this.discardViewerBackground.setPosition(layout.width / 2, layout.height / 2);
      this.discardViewerBackground.setSize(layout.width, layout.height);
    }

    this.updateDiscardViewerScroll();
  }

  /**
   * Builds card components for the discard viewer
   * Cards are arranged in a grid with scrolling support
   * 
   * @param layout - Current layout calculations
   * @private
   */
  private buildDiscardViewerCards(layout: GameLayout): void {
    if (!this.discardViewerContent || !this.discardViewerBounds || !this.discardViewerSide) return;

    this.discardViewerCards.forEach(card => card.destroy());
    this.discardViewerCards = [];

    const isOpponent = this.discardViewerSide === 'opponent';
    const localDiscard = this.gameStateManager.getPlayer(this.localColor).discard;
    const rawCards = isOpponent ? this.opponentDiscardCards : localDiscard;
    const cards = [...rawCards].reverse();

    const scale = 0.55 * layout.panelScale;
    const spacingX = 140 * layout.panelScale;
    const spacingY = 200 * layout.panelScale;
    this.discardViewerCardSpacingY = spacingY;

    const columns = Math.max(1, Math.floor(this.discardViewerBounds.width / spacingX));
    const totalRows = Math.ceil(cards.length / columns);
    const visibleRows = Math.max(1, Math.floor(this.discardViewerBounds.height / spacingY));
    this.discardViewerMaxScroll = Math.max(0, totalRows - visibleRows);
    this.discardViewerScrollOffset = Math.min(this.discardViewerScrollOffset, this.discardViewerMaxScroll);

    for (let i = 0; i < cards.length; i++) {
      const row = Math.floor(i / columns);
      const col = i % columns;
      const cardData = cards[i] ?? null;
      const faceDown = isOpponent && !cardData;
      const card = new CardComponent(this, 0, 0, cardData, faceDown, scale);
      card.setDepth(230);
      const x = col * spacingX + spacingX / 2;
      const y = row * spacingY + spacingY / 2;
      card.setPosition(x, y);
      card.getContainer().setDepth(230);
      this.discardViewerCards.push(card);
      this.discardViewerContent.add(card.getContainer());
    }

    this.updateDiscardViewerScroll();
  }

  /**
   * Updates the discard viewer scroll position
   * 
   * @private
   */
  private updateDiscardViewerScroll(): void {
    if (!this.discardViewerContent) return;
    const offset = this.discardViewerScrollOffset * this.discardViewerCardSpacingY;
    this.discardViewerContent.setY(this.discardViewerContentBaseY - offset);
  }

  /**
   * Handles mouse wheel scrolling in the discard viewer
   * 
   * @param _pointer - Phaser pointer (unused)
   * @param _gameObjects - Game objects under pointer (unused)
   * @param _deltaX - Horizontal scroll delta (unused)
   * @param deltaY - Vertical scroll delta
   * @private
   */
  private handleDiscardViewerWheel(
    _pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number
  ): void {
    if (!this.discardViewer || !this.discardViewerBounds) return;
    const pointer = this.input.activePointer;
    if (!this.isPointerInDiscardViewer(pointer)) return;
    const direction = deltaY > 0 ? 1 : -1;
    const nextOffset = Phaser.Math.Clamp(
      this.discardViewerScrollOffset + direction,
      0,
      this.discardViewerMaxScroll
    );
    if (nextOffset !== this.discardViewerScrollOffset) {
      this.discardViewerScrollOffset = nextOffset;
      this.updateDiscardViewerScroll();
    }
  }

  /**
   * Checks if pointer is within the discard viewer bounds
   * 
   * @param pointer - Phaser input pointer
   * @returns true if pointer is inside viewer bounds
   * @private
   */
  private isPointerInDiscardViewer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.discardViewerBounds) return false;
    const { x, y, width, height } = this.discardViewerBounds;
    return pointer.x >= x && pointer.x <= x + width &&
      pointer.y >= y && pointer.y <= y + height;
  }

  /**
   * Refreshes all name displays (clocks, stopwatches, nameplates)
   * Called when opponent name is received via network
   * 
   * @private
   */
  private refreshNameDisplays(): void {
    if (this.opponentClock) {
      this.opponentClock.setLabel(this.opponentName);
    }
    if (this.playerClock) {
      this.playerClock.setLabel(this.playerName);
    }
    if (this.opponentStopwatch) {
      this.opponentStopwatch.setLabel(`${this.opponentName} Timer`);
    }
    if (this.playerStopwatch) {
      this.playerStopwatch.setLabel(`${this.playerName} Timer`);
    }
    if (this.opponentNameText) {
      this.opponentNameText.setText(this.opponentName);
    }
    if (this.playerNameText) {
      this.playerNameText.setText(this.playerName);
    }
    if (this.opponentHandLabelText) {
      this.opponentHandLabelText.setText(`${this.opponentName} Hand`);
    }
    if (this.currentLayout) {
      this.positionNameplates(this.currentLayout);
      this.positionOpponentHand(this.currentLayout);
    }
  }

  /**
   * Logs an event to the event log
   * 
   * @param player - Player color or 'system' for system messages
   * @param message - Message to log
   * @private
   */
  private logEvent(player: PlayerColor | 'system', message: string): void {
    const displayName = player === 'system'
      ? undefined
      : player === this.localColor
        ? 'You'
        : this.opponentName;
    this.eventLog.addEntry(player === 'system' ? 'system' : player, message, displayName);
  }

  /**
   * Gets card data by card name from definitions
   * Used to reconstruct card data from network messages
   * 
   * @param name - Card name to look up
   * @returns Card data or null if not found
   * @private
   */
  private getCardDataByName(name: string): Card | null {
    const definition = Object.values(CARD_DEFINITIONS).find((def) => def.name === name);
    if (!definition) return null;
    
    return {
      id: `preview_${name}_${Date.now()}`,
      name: definition.name,
      type: definition.type,
      energyCost: definition.energyCost,
      timeCost: definition.timeCost,
      effect: definition.effect,
      artAsset: definition.artAsset,
      frameColor: definition.frameColor
    };
  }

  /**
   * Converts a chess square to pixel coordinates
   * Accounts for board position and flipping
   * 
   * @param square - Chess square notation (e.g., 'e4')
   * @returns Pixel coordinates or null if layout not ready
   * @private
   */
  private getSquarePixel(square: Square): { x: number; y: number } | null {
    if (!this.currentLayout) return null;
    
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1], 10);
    let col = file;
    let row = rank;
    
    if (this.localColor === 'black') {
      col = 7 - col;
      row = 7 - row;
    }
    
    return {
      x: this.boardTopLeft.x + col * this.boardSquareSize + this.boardSquareSize / 2,
      y: this.boardTopLeft.y + row * this.boardSquareSize + this.boardSquareSize / 2
    };
  }

  /**
   * Gets the world position of a container
   * Accounts for parent transforms
   * 
   * @param container - Container to get position of
   * @returns World coordinates
   * @private
   */
  private getWorldPosition(container: Phaser.GameObjects.Container): { x: number; y: number } {
    const matrix = container.getWorldTransformMatrix();
    const point = new Phaser.Math.Vector2();
    matrix.transformPoint(0, 0, point);
    return { x: point.x, y: point.y };
  }

  /**
   * Animates a card being played
   * Card moves from hand to display position, shows target arrow, then moves to discard
   * 
   * @param cardData - Card data (null for face-down)
   * @param side - Which player played the card
   * @param target - Optional target square for the card effect
   * @private
   */
  private animateCardPlay(cardData: Card | null, side: 'local' | 'opponent', target?: Square): void {
    const layout = this.currentLayout;
    if (!layout) return;
    
    let startX = side === 'local' ? layout.cardHandX : layout.opponentHandX;
    let startY = side === 'local' ? layout.cardHandY : layout.opponentHandY;
    
    if (side === 'local' && cardData) {
      const cardComponent = this.cardHand.getCardComponent(cardData.id);
      if (cardComponent) {
        const worldPos = this.getWorldPosition(cardComponent.getContainer());
        startX = worldPos.x;
        startY = worldPos.y;
      }
    }
    
    const displayScale = 0.9 * layout.panelScale;
    const animCard = new CardComponent(this, startX, startY, cardData, !cardData, displayScale);
    animCard.setDepth(50);
    const cardContainer = animCard.getContainer();
    const displayPos = { x: layout.playedCardX, y: layout.playedCardY };
    const discardSprite = side === 'local' ? this.playerDiscardSprite : this.opponentDiscardSprite;

    this.lockDiscardTop(side);
    
    this.tweens.add({
      targets: cardContainer,
      x: displayPos.x,
      y: displayPos.y,
      scaleX: displayScale,
      scaleY: displayScale,
      duration: 280,
      ease: 'Quad.easeOut',
      onComplete: () => {
        const targetPos = target ? this.getSquarePixel(target) : null;
        const arrow = targetPos
          ? drawTargetArrow(this, displayPos, targetPos, hex('#ffcc00'), 18 * layout.panelScale, 4 * layout.panelScale)
          : null;
        
        this.time.delayedCall(3000, () => {
          arrow?.destroy();
          if (!discardSprite) {
            animCard.destroy();
            this.releaseDiscardTop(side);
            return;
          }
          this.tweens.add({
            targets: cardContainer,
            x: discardSprite.x,
            y: discardSprite.y,
            scaleX: displayScale * 0.6,
            scaleY: displayScale * 0.6,
            alpha: 0.7,
            duration: 320,
            ease: 'Quad.easeIn',
            onComplete: () => {
              animCard.destroy();
              this.releaseDiscardTop(side);
            }
          });
        });
      }
    });
  }

  /**
   * Animates a piece moving on the board
   * Creates a ghost image that moves from source to destination
   * 
   * @param from - Source square
   * @param to - Destination square
   * @param movingPiece - Piece being moved
   * @param capturedPiece - Piece being captured (if any)
   * @private
   */
  private animatePieceMove(
    from: Square,
    to: Square,
    movingPiece: { type: PieceSymbol; color: Color },
    capturedPiece?: { type: PieceSymbol; color: Color } | null
  ): void {
    const fromPos = this.getSquarePixel(from);
    const toPos = this.getSquarePixel(to);
    const textureKey = this.chessBoard.getPieceTextureKey(movingPiece.type, movingPiece.color);
    
    if (!fromPos || !toPos || !textureKey) return;
    
    const ghost = this.add.image(fromPos.x, fromPos.y, textureKey);
    ghost.setScale(this.boardScale * 1.1);
    ghost.setDepth(30);
    
    const targetSprite = this.chessBoard.getPieceSprite(to);
    if (targetSprite) {
      targetSprite.setAlpha(0);
    }
    
    if (capturedPiece) {
      this.animatePieceDestroy(capturedPiece, to);
    }
    
    this.animations.moveTo(ghost, toPos.x, toPos.y, {
      duration: 300,
      onComplete: () => {
        if (targetSprite) {
          targetSprite.setAlpha(1);
        }
        ghost.destroy();
      }
    });
  }

  /**
   * Animates a piece being deployed (placed on board)
   * Uses pop-in animation
   * 
   * @param square - Square where piece was deployed
   * @private
   */
  private animatePieceDeploy(square: Square): void {
    const sprite = this.chessBoard.getPieceSprite(square);
    if (!sprite) return;
    
    const targetScale = sprite.scaleX || this.boardScale * 1.1;
    this.animations.popIn(sprite, targetScale);
  }

  /**
   * Animates a piece being destroyed (removed from board)
   * Creates a ghost image that fades out
   * 
   * @param piece - Piece being destroyed
   * @param square - Square where piece was located
   * @private
   */
  private animatePieceDestroy(piece: { type: PieceSymbol; color: Color }, square: Square): void {
    const textureKey = this.chessBoard.getPieceTextureKey(piece.type, piece.color);
    const pos = this.getSquarePixel(square);
    if (!textureKey || !pos) return;
    
    const ghost = this.add.image(pos.x, pos.y, textureKey);
    ghost.setScale(this.boardScale * 1.1);
    ghost.setDepth(35);
    this.animations.animatePieceDestroy(ghost, square, {}, () => ghost.destroy());
  }

  // ============================================
  // Network Callbacks
  // ============================================

  /**
   * Sets up callbacks for network events
   * Handles peer join/leave, actions, state sync, and errors
   * 
   * @private
   */
  private setupNetworkCallbacks(): void {
    if (!this.networkManager) return;
    
    this.networkManager.onAction((action, _peerId) => {
      this.handleNetworkAction(action);
    });
    
    this.networkManager.onStateSync((state) => {
      this.gameStateManager.importState(state);
      this.updateUIFromState({ sendStats: false });
    });
    
    this.networkManager.onPeerJoined((_peerId) => {
      this.hideConnectionOverlay();
      this.networkManager?.sendPlayerName(this.playerName);
    });
    
    this.networkManager.onPeerLeft((_peerId) => {
      this.logEvent('system', 'Opponent disconnected');
      this.showConnectionOverlay('Opponent disconnected. Waiting to reconnect...');
    });
    
    this.networkManager.onConnectionStateChange((state) => {
      if (state === 'connected') {
        this.hideConnectionOverlay();
      } else if (state === 'waiting') {
        this.showConnectionOverlay('Waiting for opponent to reconnect...');
      } else if (state === 'disconnected') {
        this.showConnectionOverlay('Connection lost. Please return to menu.');
      }
    });
    
    this.networkManager.onError((_error) => {
      this.showConnectionOverlay('Network error. Please return to menu.');
    });
    
    if (this.networkManager.getPeerId()) {
      this.networkManager.sendPlayerName(this.playerName);
    }
  }

  /**
   * Handles incoming network actions from opponent
   * Routes actions to appropriate handlers
   * 
   * @param action - Network action received
   * @private
   */
  private handleNetworkAction(action: GameAction): void {
    switch (action.type) {
      case 'PLAY_CARD':
        this.handleOpponentPlayCard(action.cardId, action.cardName, action.target, action.pieceType, action.effectAction);
        break;
      case 'MOVE_PIECE':
        this.handleOpponentMovePiece(action.from, action.to);
        break;
      case 'MULLIGAN':
        this.handleOpponentMulligan();
        break;
      case 'READY':
        this.handleOpponentReady();
        break;
      case 'END_TURN':
        // Opponent ended their turn, now it's our turn
        this.gameStateManager.endTurn();
        this.updateUIFromState();
        break;
      case 'PLAYER_NAME':
        this.opponentName = action.name || 'Opponent';
        this.refreshNameDisplays();
        this.logEvent('system', `${this.opponentName} joined`);
        this.updateUIFromState({ sendStats: false });
        break;
      case 'PLAYER_STATS_SYNC':
        this.handleOpponentStatsSync(action.clock, action.stopwatch, action.mode, action.deckCount, action.discardCount);
        break;
    }
  }

  /**
   * Handle opponent stats sync (clock, stopwatch, mode)
   */
  private handleOpponentStatsSync(clock: number, stopwatch: number, mode: 'focus' | 'disturb', deckCount: number, discardCount: number): void {
    this.opponentClockTime = clock;
    this.opponentStopwatchTime = stopwatch;
    this.opponentMode = mode;
    this.opponentDeckCount = deckCount;
    this.opponentDiscardCount = discardCount;
    this.opponentHandCount = Math.max(0, DECK_SIZE - deckCount - discardCount);
    if (this.opponentDiscardCards.length < discardCount) {
      const missing = discardCount - this.opponentDiscardCards.length;
      for (let i = 0; i < missing; i++) {
        this.opponentDiscardCards.push(null);
      }
    } else if (this.opponentDiscardCards.length > discardCount) {
      this.opponentDiscardCards = this.opponentDiscardCards.slice(0, discardCount);
    }
    
    this.updateUIFromState({ sendStats: false });
  }

  /**
   * Send local player stats to opponent
   */
  private sendLocalPlayerStats(): void {
    if (!this.networkManager) return;
    
    const localPlayer = this.gameStateManager.getPlayer(this.localColor);
    this.networkManager.sendPlayerStats(
      localPlayer.clock,
      localPlayer.stopwatch,
      localPlayer.mode,
      localPlayer.deck.length,
      localPlayer.discard.length
    );
  }

  /**
   * Handles opponent playing a card
   * Updates local state and triggers animations
   * 
   * @param _cardId - Card ID (unused, for logging)
   * @param cardName - Name of the card played
   * @param target - Target square (if applicable)
   * @param pieceType - Piece type for deployment cards
   * @param effectAction - Card effect action type
   * @private
   */
  private handleOpponentPlayCard(_cardId: string, cardName: string, target?: string, pieceType?: string, effectAction?: string): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const cardData = this.getCardDataByName(cardName);
    
    this.logEvent(opponentColor, `Played ${cardName}`);
    
    if (this.networkManager) {
      this.suppressOpponentHandAnimation++;
      this.opponentHandCount = Math.max(0, this.opponentHandCount - 1);
      this.opponentDiscardCount = Math.min(DECK_SIZE, this.opponentDiscardCount + 1);
      this.opponentDiscardCards.push(cardData ?? null);
    }
    
    this.animateCardPlay(cardData, 'opponent', target as Square | undefined);
    
    // Handle piece deployment/destruction on board
    if (effectAction === 'DEPLOY_PIECE' && target && pieceType) {
      const color: Color = opponentColor === 'white' ? 'w' : 'b';
      this.chessBoard.placePiece(target as Square, pieceType as PieceSymbol, color);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.animatePieceDeploy(target as Square);
    } else if (effectAction === 'DESTROY_PIECE' && target) {
      const targetPiece = this.chessBoard.getWrapper().getPiece(target as Square);
      this.chessBoard.removePiece(target as Square);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      if (targetPiece) {
        this.animatePieceDestroy(targetPiece, target as Square);
      }
    }

    if (cardData?.timeCost) {
      this.opponentClockTime = Math.max(0, this.opponentClockTime - cardData.timeCost);
      this.opponentStopwatchTime += cardData.timeCost;
    }
    
    this.checkGameEndConditions();
    this.updateUIFromState();
  }

  /**
   * Handles opponent moving a piece
   * Validates move, updates board, and checks game end conditions
   * 
   * @param from - Source square
   * @param to - Destination square
   * @private
   */
  private handleOpponentMovePiece(from: string, to: string): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const movingPiece = this.chessBoard.getWrapper().getPiece(from as Square);
    const capturedPiece = this.chessBoard.getWrapper().getPiece(to as Square);
    const result = this.chessBoard.makeMove(from as Square, to as Square);
    
    if (result.success) {
      if (movingPiece) {
        this.animatePieceMove(from as Square, to as Square, movingPiece, capturedPiece);
      }
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.gameStateManager.deductMoveTimeCost(opponentColor);
      this.gameStateManager.resolveDisturbTagsOnMove(opponentColor);

      this.opponentClockTime = Math.max(0, this.opponentClockTime - 3);
      this.opponentStopwatchTime += 3;
      
      this.logEvent(opponentColor, `Moved ${from} to ${to}`);
      
      // Check for king capture (Requirement 3.7)
      if (result.isKingCapture) {
        this.handleGameEnd(opponentColor, 'King captured!');
        return;
      }
      
      // Check for checkmate/stalemate after opponent move (Requirement 3.8)
      this.checkGameEndConditions();
      
      // Note: Turn ending is handled by the END_TURN network action
      // Don't call endTurn() here to avoid double turn switch
    }
    
    this.updateUIFromState();
  }

  /**
   * Handles opponent performing a mulligan
   * Deducts time cost and logs event
   * 
   * @private
   */
  private handleOpponentMulligan(): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    this.gameStateManager.deductMulliganTimeCost(opponentColor);
    this.logEvent(opponentColor, 'Mulligan');
    this.opponentClockTime = Math.max(0, this.opponentClockTime - 10);
    this.updateUIFromState();
  }

  /**
   * Handles opponent signaling ready
   * Checks if both players are ready to start
   * 
   * @private
   */
  private handleOpponentReady(): void {
    this.opponentPlayerReady = true;
    this.logEvent('system', 'Opponent is ready');
    // Check if both players are ready to start
    this.checkGameStart();
  }

  // ============================================
  // Chess Board Callbacks
  // ============================================

  /**
   * Sets up callback for chess board move attempts
   * 
   * @private
   */
  private setupChessBoardCallbacks(): void {
    this.chessBoard.onMoveAttempt = (from: Square, to: Square) => {
      this.handleLocalMove(from, to);
    };
  }

  /**
   * Handles local player attempting to move a piece
   * 
   * Algorithm:
   * 1. Validate turn and game state
   * 2. Verify piece ownership
   * 3. Check if piece can move (not deployed this turn)
   * 4. Execute move and update state
   * 5. Check for king capture and game end conditions
   * 6. Handle hand size enforcement or end turn
   * 
   * @param from - Source square
   * @param to - Destination square
   * @private
   */
  private handleLocalMove(from: Square, to: Square): void {
    // In single-player mode (no network), allow controlling both sides
    const isSinglePlayer = !this.networkManager;

    if (this.isConnectionPaused) {
      this.logEvent('system', 'Connection paused. Waiting for opponent.');
      return;
    }
    
    // Check if it's our turn (skip in single-player hotseat mode)
    if (!isSinglePlayer && !this.gameStateManager.isLocalPlayerTurn()) {
      this.logEvent('system', "Not your turn!");
      return;
    }
    
    // Check if in discard mode
    if (this.isDiscardMode) {
      this.logEvent('system', "Discard cards first!");
      return;
    }
    
    // Check game phase
    if (this.gameStateManager.getPhase() !== 'playing') {
      this.logEvent('system', "Game not started yet!");
      return;
    }
    
    // Determine which color is moving based on the piece
    const piece = this.chessBoard.getWrapper().getPiece(from);
    if (!piece) return;
    
    const movingColor: PlayerColor = piece.color === 'w' ? 'white' : 'black';
    
    // In multiplayer, verify it's the correct player's turn
    if (!isSinglePlayer && movingColor !== this.localColor) {
      this.logEvent('system', "Not your piece!");
      return;
    }
    
    // Verify it's this color's turn
    if (this.gameStateManager.getCurrentTurn() !== movingColor) {
      this.logEvent('system', `It's ${this.gameStateManager.getCurrentTurn()}'s turn!`);
      return;
    }
    
    // Check if piece was deployed this turn (cannot move)
    const moveCheck = this.gameStateManager.canMovePiece(movingColor, from);
    if (!moveCheck.canMove) {
      this.logEvent('system', moveCheck.reason);
      return;
    }
    
    // Attempt the move
    const movingPiece = this.chessBoard.getWrapper().getPiece(from);
    const capturedPiece = this.chessBoard.getWrapper().getPiece(to);
    const result = this.chessBoard.makeMove(from, to);
    
    if (result.success) {
      if (movingPiece) {
        this.animatePieceMove(from, to, movingPiece, capturedPiece);
      }
      // Update game state
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.gameStateManager.deductMoveTimeCost(movingColor);
      this.gameStateManager.resolveDisturbTagsOnMove(movingColor);
      
      this.logEvent(movingColor, `Moved ${from} to ${to}`);
      
      // Send to network (only if it's our piece in multiplayer)
      if (!isSinglePlayer) {
        this.networkManager?.sendMovePiece(from, to);
      }
      
      // Check for king capture (Requirement 3.7)
      if (result.isKingCapture) {
        this.handleGameEnd(movingColor, 'King captured!');
        return;
      }
      
      // Check for checkmate/stalemate (Requirement 3.8)
      this.checkGameEndConditions();
      
      // Check hand size before ending turn (Requirement 3.6)
      const currentPlayer = this.gameStateManager.getPlayer(movingColor);
      if (currentPlayer.hand.length > MAX_HAND_SIZE) {
        this.enterDiscardMode();
      } else {
        // End turn after move (Requirement 3.5)
        this.logEvent('system', `Ending ${movingColor}'s turn...`);
        this.gameStateManager.endTurn();
        const newTurn = this.gameStateManager.getCurrentTurn();
        this.logEvent('system', `Now ${newTurn}'s turn`);
        if (!isSinglePlayer) {
          this.networkManager?.sendEndTurn();
        }
      }
    }
    
    this.updateUIFromState();
  }

  // ============================================
  // Card Hand Callbacks
  // ============================================

  /**
   * Sets up callbacks for card hand interactions
   * Configures target validation and card play handlers
   * 
   * @private
   */
  private setupCardHandCallbacks(): void {
    // Set target validator for piece deployment and destruction
    this.cardHand.setTargetValidator((square, card) => {
      return this.validateCardTarget(card, square);
    });
    
    // Handle non-targeted card play
    this.cardHand.onCardPlayed = (card: Card) => {
      this.handleLocalCardPlay(card);
    };
    
    // Handle targeted card play
    this.cardHand.onCardTargeted = (card: Card, target: Square) => {
      this.handleLocalCardPlay(card, target);
    };
  }

  /**
   * Validates if a card can target a specific square
   * Uses control power to determine valid targets
   * 
   * @param card - Card being played
   * @param square - Target square
   * @returns true if target is valid
   * @private
   */
  private validateCardTarget(card: Card, square: Square): boolean {
    const controlMap = calculateControlPower(this.chessBoard.getWrapper());
    const playerControls = playerControlsSquare(controlMap, square, this.localColor);
    
    if (card.effect.action === 'DEPLOY_PIECE') {
      // Can only deploy to empty squares you control
      const piece = this.chessBoard.getWrapper().getPiece(square);
      if (!playerControls || piece) {
        return false;
      }
      
      // Check if deployment would give check (not allowed)
      const pieceType = (card.effect as { piece: PieceType }).piece;
      const boardFEN = this.chessBoard.getPosition();
      if (this.gameStateManager.wouldDeploymentGiveCheck(square, pieceType, this.localColor, boardFEN)) {
        return false;
      }
      
      return true;
    } else if (card.effect.action === 'DESTROY_PIECE') {
      // Can only destroy pieces on squares you control
      const piece = this.chessBoard.getWrapper().getPiece(square);
      return playerControls && !!piece;
    }
    
    return false;
  }

  /**
   * Handles local player playing a card
   * 
   * Algorithm:
   * 1. Validate turn and game state
   * 2. Check if in discard mode (discard instead of play)
   * 3. Validate card can be played (cost, requirements)
   * 4. Execute card effect on board
   * 5. Send to network and update UI
   * 
   * @param card - Card being played
   * @param target - Target square (for targeted cards)
   * @private
   */
  private handleLocalCardPlay(card: Card, target?: Square): void {
    // Check if it's our turn
    if (!this.gameStateManager.isLocalPlayerTurn()) {
      this.logEvent('system', "Not your turn!");
      return;
    }

    if (this.isConnectionPaused) {
      this.logEvent('system', 'Connection paused. Waiting for opponent.');
      return;
    }
    
    // Check if in discard mode
    if (this.isDiscardMode) {
      // In discard mode, clicking a card discards it
      this.discardCard(card);
      return;
    }
    
    // Check game phase
    if (this.gameStateManager.getPhase() !== 'playing') {
      this.logEvent('system', "Game not started yet!");
      return;
    }
    
    // Validate card can be played
    const validation = this.gameStateManager.canPlayCard(card, this.localColor);
    if (!validation.canPlay) {
      this.logEvent('system', validation.reason);
      return;
    }
    
    // Play the card
    const result = this.gameStateManager.playCard(card.id, this.localColor, target);
    
    if (result.success) {
      this.logEvent(this.localColor, `Played ${card.name}`);
      this.animateCardPlay(card, 'local', target);
      
      // Handle piece deployment/destruction on board
      if (card.effect.action === 'DEPLOY_PIECE' && target) {
        const piece = (card.effect as { piece: PieceSymbol }).piece;
        const color: Color = this.localColor === 'white' ? 'w' : 'b';
        this.chessBoard.placePiece(target, piece, color);
        this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
        this.animatePieceDeploy(target);
      } else if (card.effect.action === 'DESTROY_PIECE' && target) {
        const targetPiece = this.chessBoard.getWrapper().getPiece(target);
        this.chessBoard.removePiece(target);
        this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
        if (targetPiece) {
          this.animatePieceDestroy(targetPiece, target);
        }
      }
      
      // Send to network with card details for opponent to sync
      const pieceType = card.effect.action === 'DEPLOY_PIECE' ? (card.effect as { piece: PieceSymbol }).piece : undefined;
      this.networkManager?.sendPlayCard(card.id, card.name, target, pieceType, card.effect.action);
      
      // Update hand display
      this.updateHandDisplay();
      
      // Check for checkmate/stalemate after card play (Requirement 3.8)
      this.checkGameEndConditions();
    } else {
      this.logEvent('system', result.message);
    }
    
    this.updateUIFromState();
  }

  // ============================================
  // Game Initialization
  // ============================================

  /**
   * Initializes the game state
   * Requirement 3.1: Initialize and shuffle deck at game start
   * 
   * Algorithm:
   * 1. Initialize and shuffle deck
   * 2. Set deck in game state
   * 3. Draw initial hand (7 cards)
   * 4. Initialize opponent UI counts
   * 5. Show mulligan UI
   * 
   * @private
   */
  private initializeGame(): void {
    // Initialize and shuffle deck (Requirement 3.1)
    this.localDeckManager.initializeDeck();
    this.localDeckManager.shuffle();
    
    // Set deck in game state
    this.gameStateManager.setDeck(this.localColor, this.localDeckManager.getDeck());
    
    // Draw initial hand (7 cards)
    this.gameStateManager.drawCards(this.localColor, 7, false);

    // Initialize opponent counts for UI
    this.opponentDeckCount = DECK_SIZE - INITIAL_DRAW_COUNT;
    this.opponentDiscardCount = 0;
    this.opponentHandCount = INITIAL_DRAW_COUNT;
    this.opponentClockTime = 600;
    this.opponentStopwatchTime = 0;
    this.opponentDiscardCards = [];
    
    // Update hand display
    this.updateHandDisplay();
    
    // Show mulligan UI
    this.showMulliganUI();
    
    // Log game start
    this.logEvent('system', 'Game started');
    this.logEvent(this.localColor, 'Drew 7 cards');
    
    this.updateUIFromState();
  }

  /**
   * Updates the card hand display from game state
   * 
   * @private
   */
  private updateHandDisplay(): void {
    const hand = this.gameStateManager.getHand(this.localColor);
    this.cardHand.setCards(hand);
    this.updateCardCount();
  }

  /**
   * Updates the card count indicator text
   * Changes color based on hand size (red if over limit)
   * 
   * @private
   */
  private updateCardCount(): void {
    const count = this.cardHand.getCardCount();
    this.cardCountText.setText(`Hand: ${count} / ${MAX_HAND_SIZE}`);
    
    if (count > MAX_HAND_SIZE) {
      this.cardCountText.setColor('#ff6666');
    } else if (count === MAX_HAND_SIZE) {
      this.cardCountText.setColor('#ffff66');
    } else {
      this.cardCountText.setColor('#ffffff');
    }
  }

  // ============================================
  // Mulligan Phase (Requirement 3.2)
  // ============================================

  /**
   * Shows the mulligan phase UI
   * Displays overlay with mulligan and ready buttons
   * 
   * @private
   */
  private showMulliganUI(): void {
    const { width, height } = this.scale;
    const layout = this.currentLayout ?? calculateLayout(width, height);
    const scale = layout.panelScale;
    
    // Semi-transparent overlay (using Rectangle for better performance)
    this.mulliganOverlay = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.5);
    this.mulliganOverlay.setDepth(50);
    
    // Instructions - title
    this.mulliganTitleText = this.add.text(width / 2, height / 2 - 180, 'Mulligan Phase', {
      fontSize: `${32 * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(51);
    
    // Instructions - subtitle (more space from buttons)
    this.mulliganInstructionText = this.add.text(width / 2, height / 2 - 130, 'Mulligan costs 10 seconds. Click Done when ready.', {
      fontSize: `${16 * scale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(51);
    
    // Mulligan button (red) - more space from text
    this.mulliganButton = createImageButton(this, 
      width / 2 - 140 * scale, height / 2 - 40 * scale,
      'MULLIGAN (-10s)',
      'red_button',
      'red_button_pressed',
      () => this.handleMulligan()
    );
    this.mulliganButton.setDepth(51);
    this.mulliganButton.setData('baseScale', scale);
    this.mulliganButton.setScale(scale);
    
    // Ready button (blue)
    this.readyButton = createImageButton(this, 
      width / 2 + 140 * scale, height / 2 - 40 * scale,
      'DONE',
      'blue_button',
      'blue_button_pressed',
      () => this.handleReady()
    );
    this.readyButton.setDepth(51);
    this.readyButton.setData('baseScale', scale);
    this.readyButton.setScale(scale);
  }

  /**
   * Handles mulligan button click
   * Returns hand to deck, reshuffles, and draws new hand
   * Deducts 10 seconds from clock
   * 
   * @private
   */
  private handleMulligan(): void {
    // Deduct mulligan time cost (Requirement 3.2)
    this.gameStateManager.deductMulliganTimeCost(this.localColor);
    
    // Return hand to deck and reshuffle
    const hand = this.gameStateManager.getHand(this.localColor);
    const deck = this.gameStateManager.getDeck(this.localColor);
    
    // Put hand back in deck
    const newDeck = [...deck, ...hand];
    this.gameStateManager.setDeck(this.localColor, newDeck);
    
    // Clear hand in state (manually update player state)
    const state = this.gameStateManager.getState();
    state.players[this.localColor].hand = [];
    this.gameStateManager.importState(state);
    
    // Shuffle and draw new hand
    this.gameStateManager.shuffleDeck(this.localColor);
    this.gameStateManager.drawCards(this.localColor, 7, false);
    
    // Update display
    this.updateHandDisplay();
    
    this.logEvent(this.localColor, 'Mulligan (-10s)');
    
    // Send to network
    this.networkManager?.sendMulligan();
    
    this.updateUIFromState();
  }

  /**
   * Handles ready button click
   * Marks local player as ready and checks if game can start
   * 
   * @private
   */
  private handleReady(): void {
    // Mark local player as ready
    this.localPlayerReady = true;
    
    // Hide mulligan UI
    this.hideMulliganUI();
    
    this.logEvent('system', 'Ready to play');
    
    // Send to network
    this.networkManager?.sendReady();
    
    // Check if both players are ready (or single player mode)
    this.checkGameStart();
    
    this.updateUIFromState();
  }

  /**
   * Hides the mulligan UI elements
   * 
   * @private
   */
  private hideMulliganUI(): void {
    if (this.mulliganOverlay) {
      this.mulliganOverlay.destroy();
      this.mulliganOverlay = null;
    }
    if (this.mulliganButton) {
      this.mulliganButton.destroy();
      this.mulliganButton = null;
    }
    if (this.readyButton) {
      this.readyButton.destroy();
      this.readyButton = null;
    }
    if (this.mulliganTitleText) {
      this.mulliganTitleText.destroy();
      this.mulliganTitleText = null;
    }
    if (this.mulliganInstructionText) {
      this.mulliganInstructionText.destroy();
      this.mulliganInstructionText = null;
    }
  }

  /**
   * Checks if both players are ready to start the game
   * In single-player mode, starts immediately when local player is ready
   * 
   * @private
   */
  private checkGameStart(): void {
    // In single player mode (no network), start immediately when local player is ready
    if (!this.networkManager && this.localPlayerReady) {
      this.gameStateManager.startGame();
      this.logEvent('system', 'Game started!');
      this.showTurnBanner(this.gameStateManager.getCurrentTurn());
      this.updateUIFromState();
      return;
    }
    
    // In multiplayer, wait for both players to be ready
    if (this.localPlayerReady && this.opponentPlayerReady) {
      this.gameStateManager.startGame();
      this.logEvent('system', 'Both players ready - Game started!');
      this.showTurnBanner(this.gameStateManager.getCurrentTurn());
      this.updateUIFromState();
    }
  }

  // ============================================
  // Discard Mode (Requirement 3.6)
  // ============================================

  /**
   * Enters discard mode when hand exceeds maximum size
   * Shows overlay prompting player to discard cards
   * 
   * @private
   */
  private enterDiscardMode(): void {
    this.isDiscardMode = true;
    const { width, height } = this.scale;
    const layout = this.currentLayout ?? calculateLayout(width, height);
    const scale = layout.panelScale;
    
    // Semi-transparent overlay (using Rectangle for better performance)
    this.discardOverlay = this.add.rectangle(width / 2, height / 2, width, height, hex('#000000'), 0.3);
    this.discardOverlay.setDepth(45);
    
    // Prompt text
    const handSize = this.gameStateManager.getHandSize(this.localColor);
    const toDiscard = handSize - MAX_HAND_SIZE;
    
    this.discardPromptText = this.add.text(
      width / 2, height / 2 - 150 * scale,
      `Discard ${toDiscard} card(s) to continue`,
      {
        fontSize: `${24 * scale}px`,
        fontFamily: 'BoldPixels, Arial',
        color: '#ff6666'
      }
    ).setOrigin(0.5).setDepth(46);
    
    this.logEvent('system', `Hand size exceeds 7. Discard ${toDiscard} card(s).`);
  }

  /**
   * Discards a card from hand
   * Called when clicking a card in discard mode
   * 
   * @param card - Card to discard
   * @private
   */
  private discardCard(card: Card): void {
    // Remove card from hand and add to discard
    const state = this.gameStateManager.getState();
    const playerState = state.players[this.localColor];
    
    const cardIndex = playerState.hand.findIndex(c => c.id === card.id);
    if (cardIndex !== -1) {
      const [discardedCard] = playerState.hand.splice(cardIndex, 1);
      playerState.discard.push(discardedCard);
      this.gameStateManager.importState(state);
      
      this.logEvent(this.localColor, `Discarded ${card.name}`);
      this.animateCardDiscard('local', 1);
      
      // Update hand display
      this.updateHandDisplay();
      
      // Check if we're done discarding
      if (playerState.hand.length <= MAX_HAND_SIZE) {
        this.exitDiscardMode();
        
        // Now end the turn
        this.gameStateManager.endTurn();
        this.networkManager?.sendEndTurn();
      } else {
        // Update prompt
        const toDiscard = playerState.hand.length - MAX_HAND_SIZE;
        if (this.discardPromptText) {
          this.discardPromptText.setText(`Discard ${toDiscard} card(s) to continue`);
        }
      }
    }
    
    this.updateUIFromState();
  }

  /**
   * Exits discard mode
   * Cleans up overlay elements
   * 
   * @private
   */
  private exitDiscardMode(): void {
    this.isDiscardMode = false;
    
    if (this.discardOverlay) {
      this.discardOverlay.destroy();
      this.discardOverlay = null;
    }
    if (this.discardPromptText) {
      this.discardPromptText.destroy();
      this.discardPromptText = null;
    }
  }

  // ============================================
  // Game End Conditions (Requirements 3.7, 3.8, 4.5)
  // ============================================

  /**
   * Checks for game-ending conditions
   * - Checkmate (Requirement 3.8)
   * - Stalemate (Requirement 3.8)
   * - Clock timeout (Requirement 4.5)
   * 
   * @private
   */
  private checkGameEndConditions(): void {
    const wrapper = this.chessBoard.getWrapper();
    
    // Check for checkmate (Requirement 3.8)
    if (wrapper.isCheckmate()) {
      const winner = wrapper.getTurn() === 'w' ? 'black' : 'white';
      this.handleGameEnd(winner as PlayerColor, 'Checkmate!');
      return;
    }
    
    // Check for stalemate (Requirement 3.8)
    if (wrapper.isStalemate()) {
      this.handleGameEnd(null, 'Stalemate - Draw!');
      return;
    }
    
    // Check for clock timeout (Requirement 4.5)
    // In multiplayer, only check local player's clock - opponent handles their own timeout
    // In single player, check both clocks
    const localClock = this.gameStateManager.getPlayer(this.localColor).clock;
    
    if (this.networkManager) {
      // Multiplayer: only check local player's clock
      if (localClock <= 0) {
        const winner = this.localColor === 'white' ? 'black' : 'white';
        this.handleGameEnd(winner as PlayerColor, `${this.localColor === 'white' ? 'White' : 'Black'} ran out of time!`);
        return;
      }
    } else {
      // Single player: check both clocks
      const opponentColor = this.localColor === 'white' ? 'black' : 'white';
      const opponentClock = this.gameStateManager.getPlayer(opponentColor).clock;
      const whiteClock = this.localColor === 'white' ? localClock : opponentClock;
      const blackClock = this.localColor === 'black' ? localClock : opponentClock;

      if (whiteClock <= 0) {
        this.handleGameEnd('black', 'White ran out of time!');
        return;
      }
      if (blackClock <= 0) {
        this.handleGameEnd('white', 'Black ran out of time!');
        return;
      }
    }
  }

  /**
   * Handles game end
   * Logs result and transitions to EndScene
   * 
   * @param winner - Winning player color (null for draw)
   * @param reason - Text description of how game ended
   * @private
   */
  private handleGameEnd(winner: PlayerColor | null, reason: string): void {
    this.gameStateManager.endGame();
    
    this.logEvent('system', reason);
    
    if (winner) {
      const isLocalWin = winner === this.localColor;
      this.logEvent('system', isLocalWin ? 'You win!' : 'You lose!');
    }
    
    // Transition to EndScene with network manager for rematch flow
    const finalStats = {
      turnNumber: this.gameStateManager.getState().turnNumber,
      localClock: this.playerClock.getTime(),
      opponentClock: this.opponentClock.getTime()
    };
    
    this.time.delayedCall(2000, () => {
      this.scene.start('EndScene', {
        winner,
        reason,
        localColor: this.localColor,
        playerName: this.playerName,
        opponentName: this.opponentName,
        finalStats,
        networkManager: this.networkManager
      });
    });
  }

  /**
   * Makes a discard pile sprite clickable to open the discard viewer
   * 
   * @param sprite - Discard pile image to make interactive
   * @param side - Which player's discard pile ('local' or 'opponent')
   * 
   * Used by: createLeftPanel()
   * @private
   */
  private makeDiscardPileInteractive(sprite: Phaser.GameObjects.Image, side: 'local' | 'opponent'): void {
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.showDiscardViewer(side);
    });
  }

  /**
   * Sets or clears the top card display on a discard pile
   * Shows the most recently discarded card face-up (or card back for opponent)
   * 
   * Algorithm:
   * 1. Destroy existing top card component if present
   * 2. For opponent with no card data but cards in pile, show card back
   * 3. For null card data, clear the top card reference
   * 4. Create new CardComponent for the top card
   * 5. Position at discard pile location and make clickable
   * 
   * @param side - Which player's discard pile ('local' or 'opponent')
   * @param cardData - Card to display (null to clear)
   * 
   * Used by: refreshDiscardTopCards()
   * @private
   */
  private setDiscardTopCard(side: 'local' | 'opponent', cardData: Card | null): void {
    const layout = this.currentLayout;
    if (!layout) return;
    const scale = 0.55 * layout.panelScale;
    const isOpponent = side === 'opponent';
    const existing = isOpponent ? this.opponentDiscardTopCard : this.playerDiscardTopCard;
    if (existing) {
      existing.destroy();
    }
    if (!cardData && isOpponent) {
      if (this.opponentDiscardCount <= 0) {
        this.opponentDiscardTopCard = null;
        return;
      }
      const backCard = new CardComponent(this, 0, 0, null, true, scale);
      backCard.setDepth(11);
      backCard.getContainer().setPosition(layout.leftPanelX, layout.opponentDiscardY);
      makeCardComponentClickable(backCard, () => this.showDiscardViewer('opponent'));
      this.opponentDiscardTopCard = backCard;
      return;
    }
    if (!cardData) {
      if (isOpponent) {
        this.opponentDiscardTopCard = null;
      } else {
        this.playerDiscardTopCard = null;
      }
      return;
    }
    const topCard = new CardComponent(this, 0, 0, cardData, false, scale);
    topCard.setDepth(11);
    const position = isOpponent ? layout.opponentDiscardY : layout.playerDiscardY;
    topCard.getContainer().setPosition(layout.leftPanelX, position);
    makeCardComponentClickable(topCard, () => this.showDiscardViewer(side));
    if (isOpponent) {
      this.opponentDiscardTopCard = topCard;
    } else {
      this.playerDiscardTopCard = topCard;
    }
  }

  /**
   * Refreshes both discard pile top card displays
   * Respects suppression flags to avoid updates during animations
   * 
   * Algorithm:
   * 1. Check if local discard updates are suppressed
   * 2. If not suppressed, get local discard top and update display
   * 3. Check if opponent discard updates are suppressed
   * 4. If not suppressed, get opponent discard top and update display
   * 
   * Used by: releaseDiscardTop(), updateUIFromState()
   * @private
   */
  private refreshDiscardTopCards(): void {
    if (!this.currentLayout) return;
    if (this.suppressLocalDiscardTop === 0) {
      const localDiscard = this.gameStateManager.getPlayer(this.localColor).discard;
      const localTop = localDiscard.length > 0 ? localDiscard[localDiscard.length - 1] : null;
      this.setDiscardTopCard('local', localTop);
    }

    if (this.suppressOpponentDiscardTop === 0) {
      const opponentTop = this.opponentDiscardCards.length > 0
        ? this.opponentDiscardCards[this.opponentDiscardCards.length - 1]
        : null;
      this.setDiscardTopCard('opponent', opponentTop ?? null);
    }
  }

  /**
   * Locks discard top card updates for a side during animations
   * Increments suppression counter to allow nested locks
   * 
   * @param side - Which player's discard to lock ('local' or 'opponent')
   * 
   * Used by: animateCardDiscard()
   * @private
   */
  private lockDiscardTop(side: 'local' | 'opponent'): void {
    if (side === 'local') {
      this.suppressLocalDiscardTop++;
    } else {
      this.suppressOpponentDiscardTop++;
    }
  }

  /**
   * Releases discard top card lock and refreshes display if fully unlocked
   * Decrements suppression counter (clamped to 0)
   * 
   * @param side - Which player's discard to unlock ('local' or 'opponent')
   * 
   * Used by: animateCardDiscard() completion callback
   * @private
   */
  private releaseDiscardTop(side: 'local' | 'opponent'): void {
    if (side === 'local') {
      this.suppressLocalDiscardTop = Math.max(0, this.suppressLocalDiscardTop - 1);
    } else {
      this.suppressOpponentDiscardTop = Math.max(0, this.suppressOpponentDiscardTop - 1);
    }
    this.refreshDiscardTopCards();
  }

  /**
   * Updates opponent's deck and discard count displays
   * Called when receiving network sync data
   * 
   * @param deckCount - Number of cards in opponent's deck
   * @param discardCount - Number of cards in opponent's discard pile
   * 
   * Used by: Network callbacks (handleOpponentSync)
   */
  updateOpponentDeckCounts(deckCount: number, discardCount: number): void {
    this.opponentDeckCount = deckCount;
    this.opponentDiscardCount = discardCount;
    this.opponentDeckCountText.setText(`${deckCount}`);
    this.opponentDiscardCountText.setText(`${discardCount}`);
  }

  /**
   * Updates local player's deck and discard count displays
   * 
   * @param deckCount - Number of cards in player's deck
   * @param discardCount - Number of cards in player's discard pile
   * 
   * Used by: updateUIFromState()
   */
  updatePlayerDeckCounts(deckCount: number, discardCount: number): void {
    this.playerDeckCountText.setText(`${deckCount}`);
    this.playerDiscardCountText.setText(`${discardCount}`);
  }

  /* ============================================
   * PUBLIC ACCESSORS
   * ============================================
   * Getters for accessing scene components from external code
   */

  /**
   * Gets the chess board component
   * @returns ChessBoardComponent instance
   */
  getChessBoard(): ChessBoardComponent { return this.chessBoard; }
  
  /**
   * Gets the card hand component
   * @returns CardHandComponent instance
   */
  getCardHand(): CardHandComponent { return this.cardHand; }
  
  /**
   * Gets the event log component
   * @returns EventLogComponent instance
   */
  getEventLog(): EventLogComponent { return this.eventLog; }
  
  /**
   * Gets the game state manager
   * @returns GameStateManager instance
   */
  getGameStateManager(): GameStateManager { return this.gameStateManager; }
}
