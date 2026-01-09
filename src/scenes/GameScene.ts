/**
 * GameScene - Main gameplay scene with UI layout and game logic
 * 
 * Requirements: UI Layout, 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 4.5
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
 */

import Phaser from 'phaser';
import { Square, Color, PieceSymbol } from 'chess.js';
import { ChessBoardComponent } from '../components/ChessBoard';
import { CardHandComponent } from '../components/CardHand';
import { ClockComponent } from '../components/Clock';
import { StopwatchComponent } from '../components/Stopwatch';
import { EnergyBarComponent } from '../components/EnergyBar';
import { EventLogComponent, LOG_WIDTH } from '../components/EventLog';
import { FocusDisturbToggleComponent } from '../components/FocusDisturbToggle';
import { CardComponent } from '../components/Card';
import { GameStateManager, PlayerColor, Card, PieceType } from '../managers/GameStateManager';
import { NetworkManager, GameAction } from '../managers/NetworkManager';
import { DeckManager, DECK_SIZE, INITIAL_DRAW_COUNT } from '../managers/DeckManager';
import { calculateControlPower, playerControlsSquare } from '../utils/controlPower';
import { CARD_DEFINITIONS } from '../data/cards';
import { createGameAnimationManager, GameAnimationManager } from '../managers/AnimationManager';

// Layout constants - base sizes at 1920x1080
const BASE_BOARD_SIZE = 512; // 8 squares * 64 pixels
const BASE_LEFT_PANEL_WIDTH = 150;
const BASE_RIGHT_PANEL_WIDTH = 210;
const BASE_TOP_ZONE_HEIGHT = 100;
const BASE_BOTTOM_ZONE_HEIGHT = 210;
const BASE_PADDING = 16;
const MAX_HAND_SIZE = 7;
const MAX_PILE_LAYERS = 6;

// Reference resolution for scaling
const REF_WIDTH = 1920;
const REF_HEIGHT = 1080;

// Scene data passed from MenuScene
interface GameSceneData {
  playerName: string;
  localColor: PlayerColor;
  networkManager: NetworkManager | null;
  opponentName: string;
}

interface UISnapshot {
  localClock: number;
  opponentClock: number;
  localStopwatch: number;
  opponentStopwatch: number;
  localEnergy: number;
  localEnergyCap: number;
  currentTurn: PlayerColor;
  localHand: number;
  opponentHand: number;
  localDeck: number;
  localDiscard: number;
  opponentDeck: number;
  opponentDiscard: number;
}

export class GameScene extends Phaser.Scene {
  // Background
  private background!: Phaser.GameObjects.Image;
  
  // Animation manager
  private animations!: GameAnimationManager;
  
  // UI Components
  private chessBoard!: ChessBoardComponent;
  private cardHand!: CardHandComponent;
  private opponentClock!: ClockComponent;
  private playerClock!: ClockComponent;
  private opponentStopwatch!: StopwatchComponent;
  private playerStopwatch!: StopwatchComponent;
  private energyBar!: EnergyBarComponent;
  private eventLog!: EventLogComponent;
  private opponentFocusDisturb!: FocusDisturbToggleComponent;
  private playerFocusDisturb!: FocusDisturbToggleComponent;
  
  // Opponent deck display
  private opponentDeckSprite!: Phaser.GameObjects.Image;
  private opponentDeckStack: Phaser.GameObjects.Image[] = [];
  private opponentDeckLabelText!: Phaser.GameObjects.Text;
  private opponentDeckCountText!: Phaser.GameObjects.Text;
  private opponentDiscardSprite!: Phaser.GameObjects.Image;
  private opponentDiscardStack: Phaser.GameObjects.Image[] = [];
  private opponentDiscardTopCard: CardComponent | null = null;
  private opponentDiscardLabelText!: Phaser.GameObjects.Text;
  private opponentDiscardCountText!: Phaser.GameObjects.Text;
  
  // Player deck display
  private playerDeckSprite!: Phaser.GameObjects.Image;
  private playerDeckStack: Phaser.GameObjects.Image[] = [];
  private playerDeckLabelText!: Phaser.GameObjects.Text;
  private playerDeckCountText!: Phaser.GameObjects.Text;
  private playerDiscardSprite!: Phaser.GameObjects.Image;
  private playerDiscardStack: Phaser.GameObjects.Image[] = [];
  private playerDiscardTopCard: CardComponent | null = null;
  private playerDiscardLabelText!: Phaser.GameObjects.Text;
  private playerDiscardCountText!: Phaser.GameObjects.Text;
  
  // Opponent hand display
  private opponentHandContainer!: Phaser.GameObjects.Container;
  private opponentHandCards: Phaser.GameObjects.Image[] = [];
  private opponentHandLabelText!: Phaser.GameObjects.Text;
  private opponentHandCountText!: Phaser.GameObjects.Text;
  
  // Card count indicator
  private cardCountText!: Phaser.GameObjects.Text;
  
  // Player nameplates
  private playerNameText!: Phaser.GameObjects.Text;
  private opponentNameText!: Phaser.GameObjects.Text;
  
  // Turn banner
  private turnBanner: Phaser.GameObjects.Container | null = null;
  private turnBannerText: Phaser.GameObjects.Text | null = null;
  
  // Connection overlay
  private connectionOverlay: Phaser.GameObjects.Container | null = null;
  private connectionOverlayBackground: Phaser.GameObjects.Graphics | null = null;
  private connectionOverlayText: Phaser.GameObjects.Text | null = null;
  private connectionOverlayButton: Phaser.GameObjects.Container | null = null;
  private isConnectionPaused: boolean = false;
  
  // Game state management
  private gameStateManager!: GameStateManager;
  private networkManager: NetworkManager | null = null;
  private localDeckManager!: DeckManager;

  // Opponent stats tracking (from network sync)
  private opponentClockTime: number = 600;
  private opponentStopwatchTime: number = 0;
  private opponentMode: 'focus' | 'disturb' = 'focus';
  private opponentDeckCount: number = DECK_SIZE;
  private opponentDiscardCount: number = 0;
  private opponentHandCount: number = INITIAL_DRAW_COUNT;
  private suppressOpponentHandAnimation: number = 0;
  private opponentDiscardCards: Array<Card | null> = [];
  private suppressLocalDiscardTop: number = 0;
  private suppressOpponentDiscardTop: number = 0;

  // Layout cache
  private currentLayout: ReturnType<typeof this.calculateLayout> | null = null;
  private boardTopLeft = { x: 0, y: 0 };
  private boardSquareSize: number = 64;
  private boardScale: number = 1;
  
  // UI snapshot for animation diffs
  private lastStateSnapshot: UISnapshot | null = null;
  
  // Scene data
  private playerName: string = 'Player';
  private opponentName: string = 'Opponent';
  private localColor: PlayerColor = 'white';
  
  // Mulligan UI
  private mulliganButton: Phaser.GameObjects.Container | null = null;
  private readyButton: Phaser.GameObjects.Container | null = null;
  private mulliganOverlay: Phaser.GameObjects.Graphics | null = null;
  private mulliganTitleText: Phaser.GameObjects.Text | null = null;
  private mulliganInstructionText: Phaser.GameObjects.Text | null = null;
  
  // Discard UI
  private discardOverlay: Phaser.GameObjects.Graphics | null = null;
  private discardPromptText: Phaser.GameObjects.Text | null = null;
  private isDiscardMode: boolean = false;

  // Discard viewer overlay
  private discardViewer: Phaser.GameObjects.Container | null = null;
  private discardViewerBackground: Phaser.GameObjects.Graphics | null = null;
  private discardViewerPanel: Phaser.GameObjects.Graphics | null = null;
  private discardViewerTitleText: Phaser.GameObjects.Text | null = null;
  private discardViewerCloseButton: Phaser.GameObjects.Container | null = null;
  private discardViewerContent: Phaser.GameObjects.Container | null = null;
  private discardViewerMask: Phaser.GameObjects.Graphics | null = null;
  private discardViewerScrollOffset: number = 0;
  private discardViewerMaxScroll: number = 0;
  private discardViewerSide: 'local' | 'opponent' | null = null;
  private discardViewerCards: CardComponent[] = [];
  private discardViewerBounds: { x: number; y: number; width: number; height: number } | null = null;
  private discardViewerContentBaseY: number = 0;
  private discardViewerCardSpacingY: number = 0;
  
  // Ready state tracking for mulligan phase
  private localPlayerReady: boolean = false;
  private opponentPlayerReady: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    this.playerName = data?.playerName || 'Player';
    this.localColor = data?.localColor || 'white';
    this.networkManager = data?.networkManager || null;
    this.opponentName = data?.opponentName || 'Opponent';
  }

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
    const layout = this.calculateLayout(width, height);
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
  
  /**
   * Handle window resize - reposition all elements
   */
  private handleResize(): void {
    const { width, height } = this.scale;
    
    // Recalculate layout
    const layout = this.calculateLayout(width, height);
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
      this.cameras.main.setBackgroundColor(0x2a1a0a);
    }
  }
  
  /**
   * Scale background to cover entire viewport (may crop edges)
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

  private calculateLayout(width: number, height: number) {
    // Base UI scale from reference resolution
    const baseScale = Math.min(width / REF_WIDTH, height / REF_HEIGHT);
    const panelScale = Math.max(0.7, Math.min(1.1, baseScale));
    
    const padding = BASE_PADDING * panelScale;
    const leftPanelWidth = BASE_LEFT_PANEL_WIDTH * panelScale;
    const rightPanelWidth = BASE_RIGHT_PANEL_WIDTH * panelScale;
    const eventLogWidth = LOG_WIDTH * panelScale;
    
    const topZoneHeight = Math.max(40, Math.min(height * 0.08, BASE_TOP_ZONE_HEIGHT * panelScale * 0.5));
    const bottomZoneHeight = Math.max(150, Math.min(height * 0.26, BASE_BOTTOM_ZONE_HEIGHT * panelScale));
    const centerHeight = Math.max(160, height - topZoneHeight - bottomZoneHeight);
    const boardSpaceHeight = Math.max(0, centerHeight - padding * 2);
    
    const availableWidth = Math.max(0, width - leftPanelWidth - rightPanelWidth - eventLogWidth - padding * 4);
    const boardScale = Math.min(
      1.5,
      Math.min(
        availableWidth / BASE_BOARD_SIZE,
        boardSpaceHeight / BASE_BOARD_SIZE
      )
    );
    const boardSize = BASE_BOARD_SIZE * boardScale;
    const handScale = Math.max(0.6, Math.min(1.1, boardScale));
    
    const boardLeft = padding + leftPanelWidth + padding;
    const rightPanelLeft = width - eventLogWidth - rightPanelWidth - padding;
    const boardX = boardLeft + (rightPanelLeft - boardLeft) / 2;
    const boardTop = topZoneHeight + padding + Math.max(0, (boardSpaceHeight - boardSize) / 2);
    const boardY = boardTop + boardSize / 2;
    
    const rightPanelX = rightPanelLeft + rightPanelWidth / 2;
    const rightPanelTop = boardTop + 6 * panelScale;
    
    const eventLogX = width - eventLogWidth / 2 - padding;
    const eventLogY = height / 2;
    
    const cardHandY = height - bottomZoneHeight * 0.22;
    // Position opponent hand higher so only ~1/3 of cards are visible
    const opponentHandY = padding - 60 * panelScale;
    const opponentHandLabelY = opponentHandY + 80 * panelScale;
    const opponentHandCountY = opponentHandLabelY + 18 * panelScale;
    
    const leftPanelX = padding + leftPanelWidth / 2;
    const pileSpacing = 120 * panelScale;
    const opponentDeckY = topZoneHeight + padding + 18 * panelScale;
    const opponentDiscardY = opponentDeckY + pileSpacing;
    const playerDeckY = height - bottomZoneHeight - padding - 18 * panelScale;
    const playerDiscardY = playerDeckY - pileSpacing;
    
    const opponentNameX = boardX;
    const opponentNameY = boardTop - 24 * panelScale;
    const playerNameX = boardX;
    const playerNameY = height - bottomZoneHeight + 26 * panelScale;

    const previewX = boardLeft + 80 * panelScale;
    const previewY = height - bottomZoneHeight + 70 * panelScale;
    
    const turnBannerX = boardX;
    const turnBannerY = boardTop - 40 * panelScale;

    const playedCardX = boardLeft - 90 * panelScale;
    const playedCardY = boardY - boardSize * 0.05;
    
    return {
      boardX,
      boardY,
      boardSize,
      boardScale,
      panelScale,
      handScale,
      eventLogX,
      eventLogY,
      eventLogWidth,
      rightPanelX,
      rightPanelTop,
      cardHandX: boardX,
      cardHandY,
      opponentHandX: boardX,
      opponentHandY,
      opponentHandLabelY,
      opponentHandCountY,
      leftPanelX,
      opponentDeckY,
      opponentDiscardY,
      playerDeckY,
      playerDiscardY,
      opponentNameX,
      opponentNameY,
      playerNameX,
      playerNameY,
      previewX,
      previewY,
      turnBannerX,
      turnBannerY,
      playedCardX,
      playedCardY,
      width,
      height,
      padding
    };
  }

  private positionBoard(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private positionEventLog(layout: ReturnType<typeof this.calculateLayout>): void {
    if (!this.eventLog) return;
    this.eventLog.setPosition(layout.eventLogX, layout.eventLogY);
    this.eventLog.setScale(layout.panelScale);
  }

  private positionRightPanel(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private positionLeftPanel(layout: ReturnType<typeof this.calculateLayout>): void {
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
    this.layoutPileStack(this.opponentDeckStack, leftX, layout.opponentDeckY, deckScale, this.opponentDeckCount, 1);
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
    this.layoutPileStack(this.opponentDiscardStack, leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount, 0.5);
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
    this.layoutPileStack(this.playerDiscardStack, leftX, layout.playerDiscardY, deckScale, localDiscardCount, 0.5);
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
    this.layoutPileStack(this.playerDeckStack, leftX, layout.playerDeckY, deckScale, localDeckCount, 1);
    if (this.playerDeckLabelText) {
      this.playerDeckLabelText.setPosition(leftX, layout.playerDeckY - 60 * scale);
      this.playerDeckLabelText.setFontSize(labelSize);
    }
    if (this.playerDeckCountText) {
      this.playerDeckCountText.setPosition(leftX, layout.playerDeckY + 55 * scale);
      this.playerDeckCountText.setFontSize(countSize);
    }
  }

  private positionOpponentHand(layout: ReturnType<typeof this.calculateLayout>): void {
    if (!this.opponentHandContainer) return;
    this.opponentHandContainer.setPosition(layout.opponentHandX, layout.opponentHandY);
    this.opponentHandLabelText.setPosition(layout.opponentHandX, layout.opponentHandLabelY);
    this.opponentHandLabelText.setFontSize(12 * layout.panelScale);
    this.opponentHandCountText.setPosition(layout.opponentHandX, layout.opponentHandCountY);
    this.opponentHandCountText.setFontSize(12 * layout.panelScale);
    
    this.updateOpponentHandDisplay(this.opponentHandCount);
  }

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

  private positionNameplates(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private positionCardHand(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private positionCardCount(layout: ReturnType<typeof this.calculateLayout>): void {
    if (!this.cardCountText) return;
    this.cardCountText.setPosition(layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale);
    this.cardCountText.setFontSize(14 * layout.panelScale);
  }

  private positionTurnBanner(layout: ReturnType<typeof this.calculateLayout>): void {
    if (!this.turnBanner) return;
    this.turnBanner.setPosition(layout.turnBannerX, layout.turnBannerY);
    this.turnBanner.setScale(layout.panelScale);
  }

  private positionOverlays(layout: ReturnType<typeof this.calculateLayout>): void {
    const { width, height } = layout;
    
    if (this.mulliganOverlay) {
      this.mulliganOverlay.clear();
      this.mulliganOverlay.fillStyle(0x000000, 0.5);
      this.mulliganOverlay.fillRect(0, 0, width, height);
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
      this.discardOverlay.clear();
      this.discardOverlay.fillStyle(0x000000, 0.3);
      this.discardOverlay.fillRect(0, 0, width, height);
    }
    if (this.discardPromptText) {
      this.discardPromptText.setPosition(width / 2, height / 2 - 150 * layout.panelScale);
      this.discardPromptText.setFontSize(24 * layout.panelScale);
    }
    
    if (this.connectionOverlay && this.connectionOverlayBackground) {
      this.connectionOverlayBackground.clear();
      this.connectionOverlayBackground.fillStyle(0x000000, 0.6);
      this.connectionOverlayBackground.fillRect(0, 0, width, height);
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

  private createEventLog(layout: ReturnType<typeof this.calculateLayout>): void {
    // Event log on the right side, full height
    this.eventLog = new EventLogComponent(this, layout.eventLogX, layout.eventLogY);
    this.eventLog.setDepth(10);
    this.eventLog.setScale(layout.panelScale);
  }

  private createChessBoard(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private createRightPanel(layout: ReturnType<typeof this.calculateLayout>): void {
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
  private createLeftPanel(layout: ReturnType<typeof this.calculateLayout>): void {
    const scale = layout.panelScale;
    const x = layout.leftPanelX;
    const deckScale = 0.14 * scale;
    const stackDepth = MAX_PILE_LAYERS;
    
    // === OPPONENT'S DECK (top) ===
    this.opponentDeckStack = this.createPileStack(x, layout.opponentDeckY, deckScale, stackDepth, 1);
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
    this.opponentDiscardStack = this.createPileStack(x, layout.opponentDiscardY, deckScale, stackDepth, 0.5);
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
    this.playerDiscardStack = this.createPileStack(x, layout.playerDiscardY, deckScale, stackDepth, 0.5);
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
    this.playerDeckStack = this.createPileStack(x, layout.playerDeckY, deckScale, stackDepth, 1);
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

  private createOpponentHand(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private createNameplates(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private createCardHand(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private createCardCountIndicator(layout: ReturnType<typeof this.calculateLayout>): void {
    this.cardCountText = this.add.text(
      layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale, 'Hand: 0 / 7',
      { fontSize: `${14 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(10);
    this.positionCardCount(layout);
  }

  private createTurnBanner(layout: ReturnType<typeof this.calculateLayout>): void {
    this.turnBanner = this.add.container(layout.turnBannerX, layout.turnBannerY);
    this.turnBanner.setDepth(100);
    this.turnBanner.setVisible(false);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
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

  private setupGameStateCallbacks(): void {
    this.gameStateManager.setOnStateChange((_state) => {
      this.updateUIFromState();
    });
  }

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
    if (this.currentLayout) {
      this.positionLeftPanel(this.currentLayout);
    }
    this.refreshDiscardTopCards();
    if (this.discardViewer && this.currentLayout) {
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

  private showConnectionOverlay(message: string): void {
    const layout = this.currentLayout ?? this.calculateLayout(this.scale.width, this.scale.height);
    this.currentLayout = layout;
    
    if (!this.connectionOverlay) {
      this.connectionOverlay = this.add.container(0, 0);
      this.connectionOverlay.setDepth(200);
      
      this.connectionOverlayBackground = this.add.graphics();
      this.connectionOverlayBackground.fillStyle(0x000000, 0.6);
      this.connectionOverlayBackground.fillRect(0, 0, layout.width, layout.height);
      this.connectionOverlay.add(this.connectionOverlayBackground);
      
      this.connectionOverlayText = this.add.text(layout.width / 2, layout.height / 2 - 40 * layout.panelScale, message, {
        fontFamily: 'BoldPixels, Arial',
        fontSize: `${24 * layout.panelScale}px`,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: layout.width * 0.7 }
      }).setOrigin(0.5);
      this.connectionOverlay.add(this.connectionOverlayText);
      
      this.connectionOverlayButton = this.createImageButton(
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

  private hideConnectionOverlay(): void {
    if (this.connectionOverlay) {
      this.connectionOverlay.setVisible(false);
    }
    this.isConnectionPaused = false;
    this.cardHand?.enableInteraction();
  }

  private showDiscardViewer(side: 'local' | 'opponent'): void {
    const layout = this.currentLayout ?? this.calculateLayout(this.scale.width, this.scale.height);
    this.currentLayout = layout;

    this.hideDiscardViewer();
    this.discardViewerSide = side;
    this.discardViewerScrollOffset = 0;

    this.discardViewer = this.add.container(0, 0);
    this.discardViewer.setDepth(220);

    this.discardViewerBackground = this.add.graphics();
    this.discardViewerBackground.fillStyle(0x000000, 0.6);
    this.discardViewerBackground.fillRect(0, 0, layout.width, layout.height);
    this.discardViewerBackground.setInteractive(new Phaser.Geom.Rectangle(0, 0, layout.width, layout.height), Phaser.Geom.Rectangle.Contains);
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

    this.discardViewerCloseButton = this.createImageButton(
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

  private layoutDiscardViewer(layout: ReturnType<typeof this.calculateLayout>): void {
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
    this.discardViewerPanel.fillStyle(0x1a1a2e, 0.96);
    this.discardViewerPanel.fillRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      12
    );
    this.discardViewerPanel.lineStyle(2, 0x4a4a6e, 1);
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
    this.discardViewerMask.fillStyle(0xffffff);
    this.discardViewerMask.fillRect(contentX, contentY, contentWidth, contentHeight);

    const mask = this.discardViewerMask.createGeometryMask();
    this.discardViewerContent?.setMask(mask);

    if (this.discardViewerContent) {
      this.discardViewerContent.setPosition(contentX, contentY);
    }

    if (this.discardViewerBackground) {
      this.discardViewerBackground.clear();
      this.discardViewerBackground.fillStyle(0x000000, 0.6);
      this.discardViewerBackground.fillRect(0, 0, layout.width, layout.height);
    }

    this.updateDiscardViewerScroll();
  }

  private buildDiscardViewerCards(layout: ReturnType<typeof this.calculateLayout>): void {
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

  private updateDiscardViewerScroll(): void {
    if (!this.discardViewerContent) return;
    const offset = this.discardViewerScrollOffset * this.discardViewerCardSpacingY;
    this.discardViewerContent.setY(this.discardViewerContentBaseY - offset);
  }

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

  private isPointerInDiscardViewer(pointer: Phaser.Input.Pointer): boolean {
    if (!this.discardViewerBounds) return false;
    const { x, y, width, height } = this.discardViewerBounds;
    return pointer.x >= x && pointer.x <= x + width &&
      pointer.y >= y && pointer.y <= y + height;
  }

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

  private logEvent(player: PlayerColor | 'system', message: string): void {
    const displayName = player === 'system'
      ? undefined
      : player === this.localColor
        ? 'You'
        : this.opponentName;
    this.eventLog.addEntry(player === 'system' ? 'system' : player, message, displayName);
  }

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

  private getWorldPosition(container: Phaser.GameObjects.Container): { x: number; y: number } {
    const matrix = container.getWorldTransformMatrix();
    const point = new Phaser.Math.Vector2();
    matrix.transformPoint(0, 0, point);
    return { x: point.x, y: point.y };
  }

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
          ? this.drawTargetArrow(displayPos, targetPos, 0xffcc00, 18 * layout.panelScale, 4 * layout.panelScale)
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

  private drawTargetArrow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    color: number,
    headSize: number,
    lineWidth: number
  ): Phaser.GameObjects.Graphics {
    const arrow = this.add.graphics();
    arrow.setDepth(45);
    arrow.lineStyle(lineWidth, color, 0.9);
    arrow.beginPath();
    arrow.moveTo(from.x, from.y);
    arrow.lineTo(to.x, to.y);
    arrow.strokePath();

    const angle = Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y);
    const headLength = headSize;
    const headWidth = headSize * 0.75;

    const tipX = to.x;
    const tipY = to.y;
    const leftX = tipX - headLength * Math.cos(angle) + headWidth * Math.sin(angle);
    const leftY = tipY - headLength * Math.sin(angle) - headWidth * Math.cos(angle);
    const rightX = tipX - headLength * Math.cos(angle) - headWidth * Math.sin(angle);
    const rightY = tipY - headLength * Math.sin(angle) + headWidth * Math.cos(angle);

    arrow.fillStyle(color, 0.95);
    arrow.beginPath();
    arrow.moveTo(tipX, tipY);
    arrow.lineTo(leftX, leftY);
    arrow.lineTo(rightX, rightY);
    arrow.closePath();
    arrow.fillPath();

    return arrow;
  }

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

  private animatePieceDeploy(square: Square): void {
    const sprite = this.chessBoard.getPieceSprite(square);
    if (!sprite) return;
    
    const targetScale = sprite.scaleX || this.boardScale * 1.1;
    this.animations.popIn(sprite, targetScale);
  }

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

  private handleOpponentMulligan(): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    this.gameStateManager.deductMulliganTimeCost(opponentColor);
    this.logEvent(opponentColor, 'Mulligan');
    this.opponentClockTime = Math.max(0, this.opponentClockTime - 10);
    this.updateUIFromState();
  }

  private handleOpponentReady(): void {
    this.opponentPlayerReady = true;
    this.logEvent('system', 'Opponent is ready');
    // Check if both players are ready to start
    this.checkGameStart();
  }

  // ============================================
  // Chess Board Callbacks
  // ============================================

  private setupChessBoardCallbacks(): void {
    this.chessBoard.onMoveAttempt = (from: Square, to: Square) => {
      this.handleLocalMove(from, to);
    };
  }

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

  private updateHandDisplay(): void {
    const hand = this.gameStateManager.getHand(this.localColor);
    this.cardHand.setCards(hand);
    this.updateCardCount();
  }

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

  private showMulliganUI(): void {
    const { width, height } = this.scale;
    const layout = this.currentLayout ?? this.calculateLayout(width, height);
    const scale = layout.panelScale;
    
    // Semi-transparent overlay
    this.mulliganOverlay = this.add.graphics();
    this.mulliganOverlay.fillStyle(0x000000, 0.5);
    this.mulliganOverlay.fillRect(0, 0, width, height);
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
    this.mulliganButton = this.createImageButton(
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
    this.readyButton = this.createImageButton(
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

  private enterDiscardMode(): void {
    this.isDiscardMode = true;
    const { width, height } = this.scale;
    const layout = this.currentLayout ?? this.calculateLayout(width, height);
    const scale = layout.panelScale;
    
    // Semi-transparent overlay
    this.discardOverlay = this.add.graphics();
    this.discardOverlay.fillStyle(0x000000, 0.3);
    this.discardOverlay.fillRect(0, 0, width, height);
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
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const localClock = this.gameStateManager.getPlayer(this.localColor).clock;
    const opponentClock = this.networkManager
      ? this.opponentClockTime
      : this.gameStateManager.getPlayer(opponentColor).clock;
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

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Helper to create an image-based button
   */
  private createImageButton(
    x: number,
    y: number,
    text: string,
    normalTexture: string,
    pressedTexture: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const bgNormal = this.add.image(0, 0, normalTexture);
    const bgPressed = this.add.image(0, 0, pressedTexture);
    bgPressed.setVisible(false);
    
    const buttonText = this.add.text(0, -2, text, {
      fontFamily: 'BoldPixels, Arial',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);
    
    container.add([bgNormal, bgPressed, buttonText]);
    
    const hitWidth = bgNormal.width;
    const hitHeight = bgNormal.height;
    container.setSize(hitWidth, hitHeight);
    container.setInteractive({ useHandCursor: true });
    container.setData('baseScale', 1);
    
    const applyScale = (multiplier: number) => {
      const baseScale = (container.getData('baseScale') as number) ?? 1;
      container.setScale(baseScale * multiplier);
    };
    
    container.on('pointerover', () => {
      applyScale(1.05);
    });
    
    container.on('pointerout', () => {
      applyScale(1);
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
    });
    
    container.on('pointerdown', () => {
      bgNormal.setVisible(false);
      bgPressed.setVisible(true);
      applyScale(0.98);
    });
    
    container.on('pointerup', () => {
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
      applyScale(1.05);
      onClick();
    });
    
    return container;
  }

  private createPileStack(
    x: number,
    y: number,
    scale: number,
    maxLayers: number,
    alpha: number
  ): Phaser.GameObjects.Image[] {
    const stack: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < maxLayers; i++) {
      const card = this.add.image(x, y, 'card_back');
      card.setScale(scale);
      card.setAlpha(alpha);
      card.setDepth(7 + i);
      card.setVisible(false);
      stack.push(card);
    }
    return stack;
  }

  private getPileLayerCount(count: number): number {
    if (count <= 0) return 0;
    const cardsPerLayer = DECK_SIZE / MAX_PILE_LAYERS;
    const layers = Math.ceil(count / cardsPerLayer);
    return Math.min(MAX_PILE_LAYERS, Math.max(1, Math.min(count, layers)));
  }

  private layoutPileStack(
    stack: Phaser.GameObjects.Image[],
    x: number,
    y: number,
    scale: number,
    count: number,
    alpha: number
  ): void {
    const layers = this.getPileLayerCount(count);
    const offsetX = 2 * scale;
    const offsetY = 3 * scale;
    for (let i = 0; i < stack.length; i++) {
      const card = stack[i];
      if (i < layers) {
        const layerOffset = layers - i - 1;
        card.setPosition(x + layerOffset * offsetX, y + layerOffset * offsetY);
        card.setScale(scale);
        card.setAlpha(alpha);
        card.setVisible(true);
      } else {
        card.setVisible(false);
      }
    }
  }

  private makeDiscardPileInteractive(sprite: Phaser.GameObjects.Image, side: 'local' | 'opponent'): void {
    sprite.setInteractive({ useHandCursor: true });
    sprite.on('pointerdown', () => {
      this.showDiscardViewer(side);
    });
  }

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
      this.makeCardComponentClickable(backCard, () => this.showDiscardViewer('opponent'));
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
    this.makeCardComponentClickable(topCard, () => this.showDiscardViewer(side));
    if (isOpponent) {
      this.opponentDiscardTopCard = topCard;
    } else {
      this.playerDiscardTopCard = topCard;
    }
  }

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

  private lockDiscardTop(side: 'local' | 'opponent'): void {
    if (side === 'local') {
      this.suppressLocalDiscardTop++;
    } else {
      this.suppressOpponentDiscardTop++;
    }
  }

  private releaseDiscardTop(side: 'local' | 'opponent'): void {
    if (side === 'local') {
      this.suppressLocalDiscardTop = Math.max(0, this.suppressLocalDiscardTop - 1);
    } else {
      this.suppressOpponentDiscardTop = Math.max(0, this.suppressOpponentDiscardTop - 1);
    }
    this.refreshDiscardTopCards();
  }

  private makeCardComponentClickable(card: CardComponent, onClick: () => void): void {
    const container = card.getContainer();
    const bounds = container.getBounds();
    const scaleX = container.scaleX || 1;
    const scaleY = container.scaleY || 1;
    const width = bounds.width / scaleX;
    const height = bounds.height / scaleY;
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    container.on('pointerdown', () => onClick());
    if (container.input) {
      container.input.cursor = 'pointer';
    }
  }

  updateOpponentDeckCounts(deckCount: number, discardCount: number): void {
    this.opponentDeckCount = deckCount;
    this.opponentDiscardCount = discardCount;
    this.opponentDeckCountText.setText(`${deckCount}`);
    this.opponentDiscardCountText.setText(`${discardCount}`);
  }

  updatePlayerDeckCounts(deckCount: number, discardCount: number): void {
    this.playerDeckCountText.setText(`${deckCount}`);
    this.playerDiscardCountText.setText(`${discardCount}`);
  }

  // ============================================
  // Public Accessors
  // ============================================

  getChessBoard(): ChessBoardComponent { return this.chessBoard; }
  getCardHand(): CardHandComponent { return this.cardHand; }
  getEventLog(): EventLogComponent { return this.eventLog; }
  getGameStateManager(): GameStateManager { return this.gameStateManager; }
}
