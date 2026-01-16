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
 * ┌────────┬─────────────────────────────────┬──────────────┬────────────────┐
 * │        │           Top Bar (cyan)        │              │                │
 * │        │         (opponent hand)         │              │                │
 * │ Left   ├─────────────────────────────────┤    Right     │   Event Log    │
 * │ Panel  │                                 │    Panel     │   (yellow)     │
 * │(green) │         Board (red)             │   (blue)     │                │
 * │        │                                 │              │                │
 * │        ├─────────────────────────────────┤              │                │
 * │        │        Bottom Bar (magenta)     │              │                │
 * │        │          (player hand)          │              │                │
 * └────────┴─────────────────────────────────┴──────────────┴────────────────┘
 * 
 * @module scenes/GameScene
 * @requires phaser
 * @requires chess.js
 * @requires components/*
 * @requires managers/*
 * @requires utils/controlPower
 * @requires data/cards
 * 
 * Used by: MenuScene (game start)
 */

import Phaser from 'phaser';
import type { Square, Color, PieceSymbol } from 'chess.js';
import type { ChessBoardComponent } from '../components/ChessBoard';
import type { CardHandComponent } from '../components/CardHand';
import type { ClockComponent } from '../components/Clock';
import type { StopwatchComponent } from '../components/Stopwatch';
import type { EnergyBarComponent } from '../components/EnergyBar';
import type { DisturbCounterComponent } from '../components/DisturbCounter';
import type { EventLogComponent } from '../components/EventLog';
import type { FocusDisturbToggleComponent } from '../components/FocusDisturbToggle';
import type { CardComponent } from '../components/Card';
import { GameStateManager } from '../managers/GameStateManager';
import type { PlayerColor, Card } from '../managers/GameStateManager';
import type { NetworkManager, GameAction } from '../managers/NetworkManager';
import { DeckManager, DECK_SIZE, INITIAL_DRAW_COUNT } from '../managers/DeckManager';
import { createGameAnimationManager } from '../managers/AnimationManager';
import type { GameAnimationManager } from '../managers/AnimationManager';

import type { GameSceneData, UISnapshot, GameLayout } from './game/GameTypes';
import { calculateLayout } from './game/GameLayout';
import { createBackground, scaleBackgroundToCover } from './game/GameSceneBackground';
import { createDebugOverlays, updateDebugOverlays } from './game/GameSceneDebug';
import {
  handleResize,
  positionBoard,
  positionEventLog,
  positionRightPanel,
  positionMobileBars,
  positionLeftPanel,
  positionOpponentHand,
  updateOpponentHandDisplay,
  positionNameplates,
  positionCardHand,
  positionCardCount,
  positionTurnBanner,
  positionTurnOverlay,
  positionOverlays
} from './game/GameSceneLayout';
import {
  createEventLog,
  createChessBoard,
  createRightPanel,
  createLeftPanel,
  createOpponentHand,
  createNameplates,
  createCardHand,
  createCardCountIndicator,
  createTurnBanner,
  createTurnOverlay,
  createMobileBars
} from './game/GameSceneUIFactory';
import {
  setupGameStateCallbacks,
  updateUIFromState,
  runUIAnimations,
  animateStopwatchChange,
  animateCardDraw,
  animateCardDiscard,
  createFloatingDelta,
  showTurnBanner,
  updateTurnOverlay,
  showControlledSquaresOverlay,
  hideControlledSquaresOverlay,
  toggleMobileEventLog,
  updateOpponentDeckCounts,
  updatePlayerDeckCounts
} from './game/GameSceneUIState';
import { showConnectionOverlay, hideConnectionOverlay } from './game/GameSceneConnection';
import {
  showDiscardViewer,
  hideDiscardViewer,
  layoutDiscardViewer,
  buildDiscardViewerCards,
  updateDiscardViewerScroll,
  handleDiscardViewerWheel,
  isPointerInDiscardViewer
} from './game/GameSceneDiscardViewer';
import { refreshNameDisplays, logEvent, getCardDataByName } from './game/GameSceneUtils';
import {
  getSquarePixel,
  getWorldPosition,
  animateCardPlay,
  animatePieceMove,
  animatePieceDeploy,
  animatePieceDestroy
} from './game/GameSceneAnimations';
import {
  setupNetworkCallbacks,
  handleNetworkAction,
  handleOpponentStatsSync,
  sendLocalPlayerStats,
  handleOpponentPlayCard,
  handleOpponentMovePiece,
  handleOpponentMulligan,
  handleOpponentReady
} from './game/GameSceneNetwork';
import { setupChessBoardCallbacks, handleLocalMove } from './game/GameSceneBoard';
import {
  setupCardHandCallbacks,
  validateCardTarget,
  handleLocalCardPlay,
  setDiscardTopCard,
  refreshDiscardTopCards,
  lockDiscardTop,
  releaseDiscardTop,
  getLegalTargetSquares,
  highlightLegalTargets,
  clearLegalTargetHighlights
} from './game/GameSceneCards';
import {
  initializeGame,
  updateHandDisplay,
  updateCardCount,
  refreshInteractionBlockers,
  clearInteractionBlockers,
  showMulliganUI,
  handleMulligan,
  handleReady,
  hideMulliganUI,
  checkGameStart,
  enterDiscardMode,
  discardCard,
  exitDiscardMode,
  checkGameEndConditions,
  handleGameEnd,
  handleRematchRequest,
  handleRematchReceived,
  handleRematchDeclined,
  startRematch,
  handleReturnToMenu
} from './game/GameSceneFlow';
import { showPromotionPicker, hidePromotionPicker } from './game/GameScenePromotion';

/* ============================================
 * DEBUG CONFIGURATION
 * ============================================
 */

/** Enable debug overlay to visualize layout sections with colored rectangles */
const DEBUG_SHOW_LAYOUT_SECTIONS = false;

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
 * Used by: MenuScene (game start)
 */
export class GameScene extends Phaser.Scene {
  /* ----------------------------------------
   * Background and Animation
   * ---------------------------------------- */
  
  /** Background image */
  public background!: Phaser.GameObjects.Image;
  
  /** Animation manager for UI transitions */
  public animations!: GameAnimationManager;
  
  /* ----------------------------------------
   * Core UI Components
   * ---------------------------------------- */
  
  /** Chess board component */
  public chessBoard!: ChessBoardComponent;
  
  /** Player's card hand component */
  public cardHand!: CardHandComponent;
  
  /** Opponent's clock display */
  public opponentClock!: ClockComponent;
  
  /** Player's clock display */
  public playerClock!: ClockComponent;
  
  /** Opponent's stopwatch (turn timer) */
  public opponentStopwatch!: StopwatchComponent;
  
  /** Player's stopwatch (turn timer) */
  public playerStopwatch!: StopwatchComponent;
  
  /** Player's energy bar display */
  public energyBar!: EnergyBarComponent;

  /** Opponent's energy bar display */
  public opponentEnergyBar!: EnergyBarComponent;

  /** Player's disturb counter display */
  public playerDisturbCounter!: DisturbCounterComponent;

  /** Opponent's disturb counter display */
  public opponentDisturbCounter!: DisturbCounterComponent;
  
  /** Event log for game history */
  public eventLog!: EventLogComponent;
  
  /** Opponent's focus/disturb mode toggle (read-only) */
  public opponentFocusDisturb!: FocusDisturbToggleComponent;
  
  /** Player's focus/disturb mode toggle */
  public playerFocusDisturb!: FocusDisturbToggleComponent;

  /** Controlled squares button */
  public controlledSquaresButton!: Phaser.GameObjects.Container;

  /** Right panel backdrop rectangles */
  public rightPanelTopBackdrop!: Phaser.GameObjects.Rectangle;
  public rightPanelMiddleBackdrop!: Phaser.GameObjects.Rectangle;
  public rightPanelBottomBackdrop!: Phaser.GameObjects.Rectangle;

  /** Right panel tint rectangles */
  public rightPanelTopTint!: Phaser.GameObjects.Rectangle;
  public rightPanelMiddleTint!: Phaser.GameObjects.Rectangle;
  public rightPanelBottomTint!: Phaser.GameObjects.Rectangle;

  /** Preview panel background for card preview */
  public previewPanelBackground!: Phaser.GameObjects.Rectangle;
  public previewPanelLabel!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Opponent Deck/Discard Display
   * ---------------------------------------- */
  
  /** Opponent's deck card back image */
  public opponentDeckSprite!: Phaser.GameObjects.Image;
  
  /** Stack of images for opponent deck visual depth */
  public opponentDeckStack: Phaser.GameObjects.Image[] = [];

  /** Stack of images for opponent discard visual depth */
  public opponentDiscardStack: Phaser.GameObjects.Image[] = [];
  
  /** Label text for opponent's deck */
  public opponentDeckLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's deck */
  public opponentDeckCountText!: Phaser.GameObjects.Text;
  
  /** Top card component for opponent's discard (shows last played card) */
  public opponentDiscardTopCard: CardComponent | null = null;
  
  /** Label text for opponent's discard */
  public opponentDiscardLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's discard */
  public opponentDiscardCountText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Player Deck/Discard Display
   * ---------------------------------------- */
  
  /** Player's deck card back image */
  public playerDeckSprite!: Phaser.GameObjects.Image;

  /** Stack of images for player deck visual depth */
  public playerDeckStack: Phaser.GameObjects.Image[] = [];

  /** Stack of images for player discard visual depth */
  public playerDiscardStack: Phaser.GameObjects.Image[] = [];
  
  /** Label text for player's deck */
  public playerDeckLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for player's deck */
  public playerDeckCountText!: Phaser.GameObjects.Text;
  
  /** Top card component for player's discard (shows last played card) */
  public playerDiscardTopCard: CardComponent | null = null;
  
  /** Label text for player's discard */
  public playerDiscardLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for player's discard */
  public playerDiscardCountText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Opponent Hand Display
   * ---------------------------------------- */
  
  /** Container for opponent's hand cards */
  public opponentHandContainer!: Phaser.GameObjects.Container;
  
  /** Array of card back images for opponent's hand */
  public opponentHandCards: Phaser.GameObjects.Image[] = [];
  
  /** Label text for opponent's hand */
  public opponentHandLabelText!: Phaser.GameObjects.Text;
  
  /** Count text for opponent's hand */
  public opponentHandCountText!: Phaser.GameObjects.Text;

  /** Mask graphics for opponent hand */
  public opponentHandMask?: Phaser.GameObjects.Graphics;

  /** Mask graphics for player hand */
  public playerHandMask?: Phaser.GameObjects.Graphics;
  
  /* ----------------------------------------
   * UI Text Elements
   * ---------------------------------------- */
  
  /** Card count indicator text (Hand: X / 7) */
  public cardCountText!: Phaser.GameObjects.Text;
  
  /** Player's nameplate text */
  public playerNameText!: Phaser.GameObjects.Text;
  
  /** Opponent's nameplate text */
  public opponentNameText!: Phaser.GameObjects.Text;
  
  /* ----------------------------------------
   * Turn Banner
   * ---------------------------------------- */
  
  /** Container for turn announcement banner */
  public turnBanner: Phaser.GameObjects.Container | null = null;
  
  /** Text element within turn banner */
  public turnBannerText: Phaser.GameObjects.Text | null = null;

  /** Turn overlay rectangle across the board */
  public turnOverlayRect?: Phaser.GameObjects.Rectangle;

  /** Turn overlay text */
  public turnOverlayText?: Phaser.GameObjects.Text;

  /** Track last turn shown in overlay */
  public lastTurnOverlayTurn?: PlayerColor;

  /** Timer event for hiding turn overlay */
  public turnOverlayHideEvent?: Phaser.Time.TimerEvent;

  /* ----------------------------------------
   * Promotion Overlay
   * ---------------------------------------- */

  public promotionOverlay: Phaser.GameObjects.Container | null = null;
  public pendingPromotion: { from: Square; to: Square; color: PlayerColor } | null = null;

  /* ----------------------------------------
   * Mobile UI Bars
   * ---------------------------------------- */

  public mobileTopBar?: Phaser.GameObjects.Container;
  public mobileBottomBar?: Phaser.GameObjects.Container;
  public mobileTopBarBackground?: Phaser.GameObjects.Rectangle;
  public mobileBottomBarBackground?: Phaser.GameObjects.Rectangle;

  public mobileTopNameText?: Phaser.GameObjects.Text;
  public mobileBottomNameText?: Phaser.GameObjects.Text;

  public mobileTopClockIcon?: Phaser.GameObjects.Image;
  public mobileTopClockText?: Phaser.GameObjects.Text;
  public mobileTopStopwatchIcon?: Phaser.GameObjects.Image;
  public mobileTopStopwatchText?: Phaser.GameObjects.Text;
  public mobileTopEnergyIcon?: Phaser.GameObjects.Image;
  public mobileTopEnergyText?: Phaser.GameObjects.Text;
  public mobileTopDisturbIcon?: Phaser.GameObjects.Image;
  public mobileTopDisturbText?: Phaser.GameObjects.Text;

  public mobileBottomClockIcon?: Phaser.GameObjects.Image;
  public mobileBottomClockText?: Phaser.GameObjects.Text;
  public mobileBottomStopwatchIcon?: Phaser.GameObjects.Image;
  public mobileBottomStopwatchText?: Phaser.GameObjects.Text;
  public mobileBottomEnergyIcon?: Phaser.GameObjects.Image;
  public mobileBottomEnergyText?: Phaser.GameObjects.Text;
  public mobileBottomDisturbIcon?: Phaser.GameObjects.Image;
  public mobileBottomDisturbText?: Phaser.GameObjects.Text;

  public mobileEventLogButton?: Phaser.GameObjects.Container;
  public mobileControlledSquaresButton?: Phaser.GameObjects.Container;

  public isMobileEventLogVisible: boolean = false;
  
  /* ----------------------------------------
   * Connection Overlay
   * ---------------------------------------- */
  
  /** Container for connection status overlay */
  public connectionOverlay: Phaser.GameObjects.Container | null = null;
  
  /** Background graphics for connection overlay (using Rectangle for performance) */
  public connectionOverlayBackground: Phaser.GameObjects.Rectangle | null = null;
  
  /** Status text for connection overlay */
  public connectionOverlayText: Phaser.GameObjects.Text | null = null;
  
  /** Return to menu button in connection overlay */
  public connectionOverlayButton: Phaser.GameObjects.Container | null = null;
  
  /** Flag indicating if game is paused due to connection issues */
  public isConnectionPaused: boolean = false;
  
  /* ----------------------------------------
   * Game State Management
   * ---------------------------------------- */
  
  /** Central game state manager */
  public gameStateManager!: GameStateManager;
  
  /** Network manager for P2P communication (null in single-player) */
  public networkManager: NetworkManager | null = null;
  
  /** Deck manager for local player's deck operations */
  public localDeckManager!: DeckManager;

  /* ----------------------------------------
   * Opponent Stats (from network sync)
   * ---------------------------------------- */
  
  /** Opponent's clock time in seconds */
  public opponentClockTime: number = 600;
  
  /** Opponent's stopwatch time in seconds */
  public opponentStopwatchTime: number = 0;
  
  /** Opponent's current mode (focus/disturb) */
  public opponentMode: 'focus' | 'disturb' = 'focus';

  /** Opponent's current energy */
  public opponentEnergy: number = 0;

  /** Opponent's energy cap */
  public opponentEnergyCap: number = 0;

  /** Opponent's disturb tag count */
  public opponentDisturbTags: number = 0;
  
  /** Opponent's deck card count */
  public opponentDeckCount: number = DECK_SIZE;
  
  /** Opponent's discard pile count */
  public opponentDiscardCount: number = 0;
  
  /** Opponent's hand card count */
  public opponentHandCount: number = INITIAL_DRAW_COUNT;
  
  /** Counter to suppress opponent hand animations during card play */
  public suppressOpponentHandAnimation: number = 0;
  
  /** Array of opponent's discarded cards (for discard viewer) */
  public opponentDiscardCards: Array<Card | null> = [];
  
  /** Counter to suppress local discard top card updates during animation */
  public suppressLocalDiscardTop: number = 0;
  
  /** Counter to suppress opponent discard top card updates during animation */
  public suppressOpponentDiscardTop: number = 0;
  
  /** Pending opponent discard count from stats sync (applied when animation ends) */
  public pendingOpponentDiscardCount: number | null = null;
  
  /** Timestamp of last stats send (for throttling) */
  public lastStatsSendTime: number = 0;
  
  /** Last sent stats values (for change detection) */
  public lastSentStats: {
    clock: number;
    stopwatch: number;
    mode: 'focus' | 'disturb';
    deckCount: number;
    discardCount: number;
    energy: number;
    energyCap: number;
    disturb: number;
  } | null = null;

  /* ----------------------------------------
   * Debug Overlay
   * ---------------------------------------- */
  
  /** Debug rectangles for visualizing layout sections */
  public debugOverlays: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  /* ----------------------------------------
   * Layout Cache
   * ---------------------------------------- */
  
  /** Cached layout calculations for current screen size */
  public currentLayout: GameLayout | null = null;
  
  /** Top-left corner position of the chess board */
  public boardTopLeft = { x: 0, y: 0 };
  
  /** Size of each chess board square in pixels */
  public boardSquareSize: number = 64;
  
  /** Current scale factor for the chess board */
  public boardScale: number = 1;
  
  /* ----------------------------------------
   * UI Animation State
   * ---------------------------------------- */
  
  /** Previous UI state snapshot for animation diffing */
  public lastStateSnapshot: UISnapshot | null = null;
  
  /* ----------------------------------------
   * Scene Data
   * ---------------------------------------- */
  
  /** Local player's display name */
  public playerName: string = 'Player';
  
  /** Opponent's display name */
  public opponentName: string = 'Opponent';
  
  /** Local player's assigned color */
  public localColor: PlayerColor = 'white';
  
  /* ----------------------------------------
   * Mulligan UI Elements
   * ---------------------------------------- */
  
  /** Mulligan button container */
  public mulliganButton: Phaser.GameObjects.Container | null = null;
  
  /** Ready/Done button container */
  public readyButton: Phaser.GameObjects.Container | null = null;
  
  /** Title text for mulligan phase */
  public mulliganTitleText: Phaser.GameObjects.Text | null = null;
  
  /** Instruction text for mulligan phase */
  public mulliganInstructionText: Phaser.GameObjects.Text | null = null;

  /** Mulligan banner strip */
  public mulliganBannerRect: Phaser.GameObjects.Rectangle | null = null;
  
  /* ----------------------------------------
   * Discard Mode UI Elements
   * ---------------------------------------- */
  
  /** Semi-transparent overlay for discard mode (using Rectangle for performance) */
  public discardOverlay: Phaser.GameObjects.Rectangle | null = null;
  
  /** Prompt text for discard mode */
  public discardPromptText: Phaser.GameObjects.Text | null = null;
  
  /** Flag indicating if player is in discard mode */
  public isDiscardMode: boolean = false;

  /* ----------------------------------------
   * End Game Overlay
   * ---------------------------------------- */

  /** Screen interaction blockers (exclude event log) */
  public interactionBlockers: Phaser.GameObjects.Rectangle[] = [];

  /** Whether interaction blockers are active */
  public interactionBlockersActive: boolean = false;

  /** Game end banner strip */
  public gameEndBannerRect: Phaser.GameObjects.Rectangle | null = null;

  /** Game end banner text */
  public gameEndBannerText: Phaser.GameObjects.Text | null = null;

  /** Rematch button in game end banner */
  public gameEndRematchButton: Phaser.GameObjects.Container | null = null;

  /** Back to menu button in game end banner */
  public gameEndMenuButton: Phaser.GameObjects.Container | null = null;

  /** Rematch request state */
  public localRematchRequested: boolean = false;
  public opponentRematchRequested: boolean = false;

  /* ----------------------------------------
   * Discard Viewer Overlay
   * ---------------------------------------- */
  
  /** Container for discard pile viewer */
  public discardViewer: Phaser.GameObjects.Container | null = null;
  
  /** Background graphics for discard viewer (using Rectangle for performance) */
  public discardViewerBackground: Phaser.GameObjects.Rectangle | null = null;
  
  /** Panel graphics for discard viewer */
  public discardViewerPanel: Phaser.GameObjects.Graphics | null = null;
  
  /** Title text for discard viewer */
  public discardViewerTitleText: Phaser.GameObjects.Text | null = null;
  
  /** Close button for discard viewer */
  public discardViewerCloseButton: Phaser.GameObjects.Container | null = null;
  
  /** Content container for discard viewer cards */
  public discardViewerContent: Phaser.GameObjects.Container | null = null;
  
  /** Mask graphics for discard viewer scrolling */
  public discardViewerMask: Phaser.GameObjects.Graphics | null = null;
  
  /** Current scroll offset for discard viewer */
  public discardViewerScrollOffset: number = 0;
  
  /** Maximum scroll offset for discard viewer */
  public discardViewerMaxScroll: number = 0;
  
  /** Which side's discard pile is being viewed */
  public discardViewerSide: 'local' | 'opponent' | null = null;
  
  /** Array of card components in discard viewer */
  public discardViewerCards: CardComponent[] = [];
  
  /** Bounds of the discard viewer content area */
  public discardViewerBounds: { x: number; y: number; width: number; height: number } | null = null;
  
  /** Base Y position for discard viewer content */
  public discardViewerContentBaseY: number = 0;
  
  /** Vertical spacing between cards in discard viewer */
  public discardViewerCardSpacingY: number = 0;
  
  /* ----------------------------------------
   * Ready State Tracking
   * ---------------------------------------- */
  
  /** Flag indicating if local player is ready (mulligan phase complete) */
  public localPlayerReady: boolean = false;
  
  /** Flag indicating if opponent is ready (mulligan phase complete) */
  public opponentPlayerReady: boolean = false;

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
    this.createTurnOverlay(layout);
    this.createMobileBars(layout);
    this.positionEventLog(layout);
    this.positionMobileBars(layout);
    this.positionTurnOverlay(layout);
    
    // Create debug overlays if enabled
    if (DEBUG_SHOW_LAYOUT_SECTIONS) {
      this.createDebugOverlays(layout);
    }
    
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
   * SCENE HELPERS (DELEGATED)
   * ============================================ */

  public handleResize(): void {
    handleResize.call(this);
  }

  public createBackground(width: number, height: number): void {
    createBackground.call(this, width, height);
  }

  public scaleBackgroundToCover(): void {
    scaleBackgroundToCover.call(this);
  }

  public createDebugOverlays(layout: GameLayout): void {
    createDebugOverlays.call(this, layout);
  }

  public updateDebugOverlays(layout: GameLayout): void {
    updateDebugOverlays.call(this, layout);
  }

  public positionBoard(layout: GameLayout): void {
    positionBoard.call(this, layout);
  }

  public positionEventLog(layout: GameLayout): void {
    positionEventLog.call(this, layout);
  }

  public positionRightPanel(layout: GameLayout): void {
    positionRightPanel.call(this, layout);
  }

  public positionMobileBars(layout: GameLayout): void {
    positionMobileBars.call(this, layout);
  }

  public positionLeftPanel(layout: GameLayout): void {
    positionLeftPanel.call(this, layout);
  }

  public positionOpponentHand(layout: GameLayout): void {
    positionOpponentHand.call(this, layout);
  }

  public updateOpponentHandDisplay(count: number): void {
    updateOpponentHandDisplay.call(this, count);
  }

  public positionNameplates(layout: GameLayout): void {
    positionNameplates.call(this, layout);
  }

  public positionCardHand(layout: GameLayout): void {
    positionCardHand.call(this, layout);
  }

  public positionCardCount(layout: GameLayout): void {
    positionCardCount.call(this, layout);
  }

  public positionTurnBanner(layout: GameLayout): void {
    positionTurnBanner.call(this, layout);
  }

  public positionTurnOverlay(layout: GameLayout): void {
    positionTurnOverlay.call(this, layout);
  }

  public positionOverlays(layout: GameLayout): void {
    positionOverlays.call(this, layout);
  }

  public createEventLog(layout: GameLayout): void {
    createEventLog.call(this, layout);
  }

  public createChessBoard(layout: GameLayout): void {
    createChessBoard.call(this, layout);
  }

  public createRightPanel(layout: GameLayout): void {
    createRightPanel.call(this, layout);
  }

  public createLeftPanel(layout: GameLayout): void {
    createLeftPanel.call(this, layout);
  }

  public createOpponentHand(layout: GameLayout): void {
    createOpponentHand.call(this, layout);
  }

  public createNameplates(layout: GameLayout): void {
    createNameplates.call(this, layout);
  }

  public createCardHand(layout: GameLayout): void {
    createCardHand.call(this, layout);
  }

  public createCardCountIndicator(layout: GameLayout): void {
    createCardCountIndicator.call(this, layout);
  }

  public createTurnBanner(layout: GameLayout): void {
    createTurnBanner.call(this, layout);
  }

  public createTurnOverlay(layout: GameLayout): void {
    createTurnOverlay.call(this, layout);
  }

  public createMobileBars(layout: GameLayout): void {
    createMobileBars.call(this, layout);
  }

  public setupGameStateCallbacks(): void {
    setupGameStateCallbacks.call(this);
  }

  public updateUIFromState(options: { sendStats?: boolean } = {}): void {
    updateUIFromState.call(this, options);
  }

  public runUIAnimations(prev: UISnapshot, next: UISnapshot): void {
    runUIAnimations.call(this, prev, next);
  }

  public animateStopwatchChange(component: StopwatchComponent, oldValue: number, newValue: number): void {
    animateStopwatchChange.call(this, component, oldValue, newValue);
  }

  public animateCardDraw(side: 'local' | 'opponent', count: number): void {
    animateCardDraw.call(this, side, count);
  }

  public animateCardDiscard(side: 'local' | 'opponent', count: number): void {
    animateCardDiscard.call(this, side, count);
  }

  public createFloatingDelta(
    x: number,
    y: number,
    value: number,
    color: string,
    suffix: string = ''
  ): void {
    createFloatingDelta.call(this, x, y, value, color, suffix);
  }

  public showTurnBanner(turn: PlayerColor): void {
    showTurnBanner.call(this, turn);
  }

  public updateTurnOverlay(turn: PlayerColor): void {
    updateTurnOverlay.call(this, turn);
  }

  public showControlledSquaresOverlay(): void {
    showControlledSquaresOverlay.call(this);
  }

  public hideControlledSquaresOverlay(): void {
    hideControlledSquaresOverlay.call(this);
  }

  public toggleMobileEventLog(): void {
    toggleMobileEventLog.call(this);
  }

  public showPromotionPicker(from: Square, to: Square, movingColor: PlayerColor): void {
    showPromotionPicker.call(this, from, to, movingColor);
  }

  public hidePromotionPicker(): void {
    hidePromotionPicker.call(this);
  }

  public showConnectionOverlay(message: string): void {
    showConnectionOverlay.call(this, message);
  }

  public hideConnectionOverlay(): void {
    hideConnectionOverlay.call(this);
  }

  public showDiscardViewer(side: 'local' | 'opponent'): void {
    showDiscardViewer.call(this, side);
  }

  public hideDiscardViewer(): void {
    hideDiscardViewer.call(this);
  }

  public layoutDiscardViewer(layout: GameLayout): void {
    layoutDiscardViewer.call(this, layout);
  }

  public buildDiscardViewerCards(layout: GameLayout): void {
    buildDiscardViewerCards.call(this, layout);
  }

  public updateDiscardViewerScroll(): void {
    updateDiscardViewerScroll.call(this);
  }

  public handleDiscardViewerWheel(
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number
  ): void {
    handleDiscardViewerWheel.call(this, pointer, gameObjects, deltaX, deltaY);
  }

  public isPointerInDiscardViewer(pointer: Phaser.Input.Pointer): boolean {
    return isPointerInDiscardViewer.call(this, pointer);
  }

  public refreshNameDisplays(): void {
    refreshNameDisplays.call(this);
  }

  public logEvent(player: PlayerColor | 'system', message: string): void {
    logEvent.call(this, player, message);
  }

  public getCardDataByName(name: string): Card | null {
    return getCardDataByName.call(this, name);
  }

  public getSquarePixel(square: Square): { x: number; y: number } | null {
    return getSquarePixel.call(this, square);
  }

  public getWorldPosition(container: Phaser.GameObjects.Container): { x: number; y: number } {
    return getWorldPosition.call(this, container);
  }

  public animateCardPlay(
    cardData: Card | null,
    side: 'local' | 'opponent',
    target?: Square,
    onComplete?: () => void
  ): void {
    animateCardPlay.call(this, cardData, side, target, onComplete);
  }

  public animatePieceMove(
    from: Square,
    to: Square,
    movingPiece: { type: PieceSymbol; color: Color },
    capturedPiece?: { type: PieceSymbol; color: Color } | null
  ): void {
    animatePieceMove.call(this, from, to, movingPiece, capturedPiece);
  }

  public animatePieceDeploy(square: Square): void {
    animatePieceDeploy.call(this, square);
  }

  public animatePieceDestroy(piece: { type: PieceSymbol; color: Color }, square: Square): void {
    animatePieceDestroy.call(this, piece, square);
  }

  public setupNetworkCallbacks(): void {
    setupNetworkCallbacks.call(this);
  }

  public handleNetworkAction(action: GameAction): void {
    handleNetworkAction.call(this, action);
  }

  public handleOpponentStatsSync(
    clock: number,
    stopwatch: number,
    mode: 'focus' | 'disturb',
    deckCount: number,
    discardCount: number,
    energy: number,
    energyCap: number,
    disturb: number
  ): void {
    handleOpponentStatsSync.call(this, clock, stopwatch, mode, deckCount, discardCount, energy, energyCap, disturb);
  }

  public sendLocalPlayerStats(): void {
    sendLocalPlayerStats.call(this);
  }

  public handleOpponentPlayCard(
    _cardId: string,
    cardName: string,
    target?: string,
    pieceType?: string,
    effectAction?: string
  ): void {
    handleOpponentPlayCard.call(this, _cardId, cardName, target, pieceType, effectAction);
  }

  public handleOpponentMovePiece(from: string, to: string, promotion?: string): void {
    handleOpponentMovePiece.call(this, from, to, promotion);
  }

  public handleOpponentMulligan(): void {
    handleOpponentMulligan.call(this);
  }

  public handleOpponentReady(): void {
    handleOpponentReady.call(this);
  }

  public setupChessBoardCallbacks(): void {
    setupChessBoardCallbacks.call(this);
  }

  public handleLocalMove(from: Square, to: Square, promotion?: PieceSymbol, animate: boolean = true): void {
    handleLocalMove.call(this, from, to, promotion, animate);
  }

  public setupCardHandCallbacks(): void {
    setupCardHandCallbacks.call(this);
  }

  public validateCardTarget(card: Card, square: Square): boolean {
    return validateCardTarget.call(this, card, square);
  }

  public getLegalTargetSquares(card: Card): { deploy: Square[], destroy: Square[] } {
    return getLegalTargetSquares.call(this, card);
  }

  public highlightLegalTargets(card: Card): void {
    highlightLegalTargets.call(this, card);
  }

  public clearLegalTargetHighlights(): void {
    clearLegalTargetHighlights.call(this);
  }

  public handleLocalCardPlay(card: Card, target?: Square): boolean {
    return handleLocalCardPlay.call(this, card, target);
  }

  public initializeGame(): void {
    initializeGame.call(this);
  }

  public updateHandDisplay(): void {
    updateHandDisplay.call(this);
  }

  public updateCardCount(): void {
    updateCardCount.call(this);
  }

  public refreshInteractionBlockers(): void {
    refreshInteractionBlockers.call(this);
  }

  public clearInteractionBlockers(): void {
    clearInteractionBlockers.call(this);
  }

  public showMulliganUI(): void {
    showMulliganUI.call(this);
  }

  public handleMulligan(): void {
    handleMulligan.call(this);
  }

  public handleReady(): void {
    handleReady.call(this);
  }

  public hideMulliganUI(): void {
    hideMulliganUI.call(this);
  }

  public checkGameStart(): void {
    checkGameStart.call(this);
  }

  public enterDiscardMode(): void {
    enterDiscardMode.call(this);
  }

  public discardCard(card: Card): void {
    discardCard.call(this, card);
  }

  public exitDiscardMode(): void {
    exitDiscardMode.call(this);
  }

  public checkGameEndConditions(): void {
    checkGameEndConditions.call(this);
  }

  public handleGameEnd(winner: PlayerColor | null, reason: string): void {
    handleGameEnd.call(this, winner, reason);
  }

  public handleRematchRequest(): void {
    handleRematchRequest.call(this);
  }

  public handleRematchReceived(): void {
    handleRematchReceived.call(this);
  }

  public handleRematchDeclined(): void {
    handleRematchDeclined.call(this);
  }

  public startRematch(): void {
    startRematch.call(this);
  }

  public handleReturnToMenu(): void {
    handleReturnToMenu.call(this);
  }

  public setDiscardTopCard(side: 'local' | 'opponent', cardData: Card | null): void {
    setDiscardTopCard.call(this, side, cardData);
  }

  public refreshDiscardTopCards(): void {
    refreshDiscardTopCards.call(this);
  }

  public lockDiscardTop(side: 'local' | 'opponent'): void {
    lockDiscardTop.call(this, side);
  }

  public releaseDiscardTop(side: 'local' | 'opponent'): void {
    releaseDiscardTop.call(this, side);
  }

  public updateOpponentDeckCounts(deckCount: number, discardCount: number): void {
    updateOpponentDeckCounts.call(this, deckCount, discardCount);
  }

  public updatePlayerDeckCounts(deckCount: number, discardCount: number): void {
    updatePlayerDeckCounts.call(this, deckCount, discardCount);
  }

  /* ============================================
   * PUBLIC ACCESSORS
   * ============================================
   * Getters for accessing scene components from external code
   */

  getChessBoard(): ChessBoardComponent { return this.chessBoard; }
  
  getCardHand(): CardHandComponent { return this.cardHand; }
  
  getEventLog(): EventLogComponent { return this.eventLog; }
  
  getGameStateManager(): GameStateManager { return this.gameStateManager; }
}
