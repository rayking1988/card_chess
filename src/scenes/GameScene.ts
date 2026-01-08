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
import { CardComponent, CARD_HEIGHT } from '../components/Card';
import { GameStateManager, PlayerColor, Card, PieceType } from '../managers/GameStateManager';
import { NetworkManager, GameAction } from '../managers/NetworkManager';
import { DeckManager } from '../managers/DeckManager';
import { calculateControlPower, playerControlsSquare } from '../utils/controlPower';

// Layout constants - base sizes at 1920x1080
const BASE_BOARD_SIZE = 512; // 8 squares * 64 pixels
const RIGHT_PANEL_WIDTH = 150;
const RIGHT_PANEL_MARGIN = 20;
const TOP_MARGIN = 60;
const BOTTOM_MARGIN = 20;
const MAX_HAND_SIZE = 7;

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

export class GameScene extends Phaser.Scene {
  // Background
  private background!: Phaser.GameObjects.Image;
  
  // UI Components
  private chessBoard!: ChessBoardComponent;
  private cardHand!: CardHandComponent;
  private opponentClock!: ClockComponent;
  private playerClock!: ClockComponent;
  private stopwatch!: StopwatchComponent;
  private energyBar!: EnergyBarComponent;
  private eventLog!: EventLogComponent;
  private opponentFocusDisturb!: FocusDisturbToggleComponent;
  private playerFocusDisturb!: FocusDisturbToggleComponent;
  
  // Opponent deck display
  private opponentDeckSprite!: Phaser.GameObjects.Image;
  private opponentDeckCountText!: Phaser.GameObjects.Text;
  private opponentDiscardSprite!: Phaser.GameObjects.Image;
  private opponentDiscardCountText!: Phaser.GameObjects.Text;
  
  // Player deck display
  private playerDeckSprite!: Phaser.GameObjects.Image;
  private playerDeckCountText!: Phaser.GameObjects.Text;
  private playerDiscardSprite!: Phaser.GameObjects.Image;
  private playerDiscardCountText!: Phaser.GameObjects.Text;
  
  // Card preview (opponent's last played card)
  private opponentCardPreview: CardComponent | null = null;
  
  // Card count indicator
  private cardCountText!: Phaser.GameObjects.Text;
  
  // Game state management
  private gameStateManager!: GameStateManager;
  private networkManager: NetworkManager | null = null;
  private localDeckManager!: DeckManager;
  
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
    
    // Add background (Requirement 14.5)
    this.createBackground(width, height);
    
    // Calculate layout positions
    const layout = this.calculateLayout(width, height);
    
    // Create all UI components in proper positions
    this.createLeftPanel(layout);
    this.createEventLog(layout);
    this.createChessBoard(layout);
    this.createRightPanel(layout);
    this.createOpponentPreviewArea(layout);
    this.createCardHand(layout);
    this.createCardCountIndicator(layout);
    
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
  }
  
  /**
   * Handle window resize - reposition all elements
   */
  private handleResize(): void {
    const { width, height } = this.scale;
    
    // Recalculate layout
    const layout = this.calculateLayout(width, height);
    
    // Reposition and rescale background to cover
    this.scaleBackgroundToCover();
    
    // Reposition chess board
    if (this.chessBoard) {
      this.chessBoard.getContainer().setPosition(
        layout.boardX - layout.boardSize / 2,
        layout.boardY - layout.boardSize / 2
      );
      this.chessBoard.getContainer().setScale(layout.scale);
    }
    
    // Reposition event log (right side, full height)
    if (this.eventLog) {
      this.eventLog.setPosition(layout.eventLogX, layout.eventLogY);
      this.eventLog.setScale(layout.scale);
    }
    
    // Reposition right panel components
    const rightX = layout.rightPanelX;
    let rightY = layout.boardY - layout.boardSize / 2 + 40 * layout.scale;
    
    if (this.opponentClock) {
      this.opponentClock.setPosition(rightX, rightY);
      this.opponentClock.setScale(layout.scale);
      rightY += 70 * layout.scale;
    }
    
    if (this.opponentFocusDisturb) {
      this.opponentFocusDisturb.setPosition(rightX, rightY);
      this.opponentFocusDisturb.setScale(layout.scale);
      rightY += 60 * layout.scale;
    }
    
    if (this.playerClock) {
      this.playerClock.setPosition(rightX, rightY);
      this.playerClock.setScale(layout.scale);
      rightY += 70 * layout.scale;
    }
    
    if (this.stopwatch) {
      this.stopwatch.setPosition(rightX, rightY);
      this.stopwatch.setScale(layout.scale);
      rightY += 80 * layout.scale;
    }
    
    if (this.energyBar) {
      this.energyBar.setPosition(rightX, rightY);
      this.energyBar.setScale(layout.scale);
      rightY += 60 * layout.scale;
    }
    
    if (this.playerFocusDisturb) {
      this.playerFocusDisturb.setPosition(rightX, rightY);
      this.playerFocusDisturb.setScale(layout.scale);
    }
    
    // Reposition card hand
    if (this.cardHand) {
      this.cardHand.setPosition(layout.cardHandX, layout.cardHandY);
      this.cardHand.setScale(layout.scale);
      this.cardHand.setPlayZone({
        x: layout.boardX - layout.boardSize / 2,
        y: layout.boardY - layout.boardSize / 2,
        width: layout.boardSize, height: layout.boardSize
      });
      this.cardHand.setBoardBounds(
        layout.boardX - layout.boardSize / 2, layout.boardY - layout.boardSize / 2,
        layout.boardSize, layout.boardSize, 64 * layout.scale, this.localColor === 'black'
      );
    }
    
    // Reposition card count text
    if (this.cardCountText) {
      this.cardCountText.setPosition(layout.boardX, layout.boardY + layout.boardSize / 2 + 20 * layout.scale);
      this.cardCountText.setFontSize(14 * layout.scale);
    }
    
    // Reposition left panel elements
    const leftX = layout.leftPanelX;
    const deckScale = 0.12 * layout.scale;
    
    if (this.opponentDeckSprite) {
      this.opponentDeckSprite.setPosition(leftX, layout.opponentDeckY);
      this.opponentDeckSprite.setScale(deckScale);
    }
    if (this.opponentDeckCountText) {
      this.opponentDeckCountText.setPosition(leftX, layout.opponentDeckY + 55 * layout.scale);
    }
    if (this.opponentDiscardSprite) {
      this.opponentDiscardSprite.setPosition(leftX, layout.opponentDiscardY);
      this.opponentDiscardSprite.setScale(deckScale);
    }
    if (this.opponentDiscardCountText) {
      this.opponentDiscardCountText.setPosition(leftX, layout.opponentDiscardY + 55 * layout.scale);
    }
    if (this.playerDiscardSprite) {
      this.playerDiscardSprite.setPosition(leftX, layout.playerDiscardY);
      this.playerDiscardSprite.setScale(deckScale);
    }
    if (this.playerDiscardCountText) {
      this.playerDiscardCountText.setPosition(leftX, layout.playerDiscardY + 55 * layout.scale);
    }
    if (this.playerDeckSprite) {
      this.playerDeckSprite.setPosition(leftX, layout.playerDeckY);
      this.playerDeckSprite.setScale(deckScale);
    }
    if (this.playerDeckCountText) {
      this.playerDeckCountText.setPosition(leftX, layout.playerDeckY + 55 * layout.scale);
    }
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
    // Calculate scale factor based on window size vs reference
    const scaleX = width / REF_WIDTH;
    const scaleY = height / REF_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // Use smaller to ensure everything fits
    
    // Scaled board size
    const boardSize = BASE_BOARD_SIZE * scale;
    
    // Left panel width for deck/discard display
    const leftPanelWidth = 120 * scale;
    
    // Event log on the right side (full height)
    const eventLogWidth = LOG_WIDTH * scale;
    const eventLogX = width - eventLogWidth / 2 - 10 * scale;
    const eventLogY = height / 2;
    
    // Chess board centered between left panel and event log
    const availableWidth = width - leftPanelWidth - eventLogWidth - 40 * scale;
    const boardX = leftPanelWidth + availableWidth / 2 + 20 * scale;
    const boardY = height / 2 - 30 * scale;
    
    // Right panel (clocks, energy, etc.) between board and event log
    const rightPanelX = boardX + boardSize / 2 + RIGHT_PANEL_MARGIN * scale + (RIGHT_PANEL_WIDTH * scale) / 2;
    
    // Card hand at bottom
    const cardHandY = height - BOTTOM_MARGIN * scale - CARD_HEIGHT * 0.4 * scale;
    
    // Left panel positions - opponent at top, player at bottom
    const leftPanelX = leftPanelWidth / 2 + 10 * scale;
    const opponentDeckY = 80 * scale;
    const opponentDiscardY = 200 * scale;
    const playerDiscardY = height - 200 * scale;
    const playerDeckY = height - 80 * scale;
    
    // Opponent card preview at top-center
    const opponentPreviewX = boardX;
    const opponentPreviewY = TOP_MARGIN * scale + 30 * scale;
    
    // Player card preview at bottom-left (near card hand)
    const previewX = leftPanelWidth + 80 * scale;
    const previewY = height - 150 * scale;
    
    return {
      boardX, boardY, boardSize, 
      eventLogX, eventLogY, eventLogWidth,
      rightPanelX,
      cardHandX: boardX, cardHandY,
      leftPanelX,
      opponentDeckY, opponentDiscardY,
      playerDeckY, playerDiscardY,
      opponentPreviewX, opponentPreviewY,
      previewX, previewY,
      width, height,
      scale
    };
  }

  private createEventLog(layout: ReturnType<typeof this.calculateLayout>): void {
    // Event log on the right side, full height
    this.eventLog = new EventLogComponent(this, layout.eventLogX, layout.eventLogY);
    this.eventLog.setDepth(10);
    this.eventLog.setScale(layout.scale);
  }

  private createChessBoard(layout: ReturnType<typeof this.calculateLayout>): void {
    // Flip board if local player is black (Requirement 1.8)
    const isFlipped = this.localColor === 'black';
    
    this.chessBoard = new ChessBoardComponent(
      this,
      layout.boardX - layout.boardSize / 2,
      layout.boardY - layout.boardSize / 2,
      layout.scale, 
      isFlipped
    );
    this.chessBoard.getContainer().setDepth(5);
  }

  private createRightPanel(layout: ReturnType<typeof this.calculateLayout>): void {
    const x = layout.rightPanelX;
    const scale = layout.scale;
    // Start from top of board area
    let y = layout.boardY - layout.boardSize / 2 + 40 * scale;
    
    // 1. Opponent Clock (top)
    this.opponentClock = new ClockComponent(this, x, y, 600, this.opponentName);
    this.opponentClock.setDepth(10);
    this.opponentClock.setScale(scale);
    y += 70 * scale;
    
    // 2. Opponent Focus/Disturb toggle
    this.opponentFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
    this.opponentFocusDisturb.setLabel('Opp Mode');
    this.opponentFocusDisturb.setEnabled(false); // Opponent's toggle is read-only
    this.opponentFocusDisturb.setDepth(10);
    this.opponentFocusDisturb.setScale(scale);
    y += 60 * scale;
    
    // 3. Your Clock
    this.playerClock = new ClockComponent(this, x, y, 600, 'Your Time');
    this.playerClock.setActive(true);
    this.playerClock.setDepth(10);
    this.playerClock.setScale(scale);
    y += 70 * scale;
    
    // 4. Stopwatch (turn time tracker)
    this.stopwatch = new StopwatchComponent(this, x, y);
    this.stopwatch.setDepth(10);
    this.stopwatch.setScale(scale);
    y += 80 * scale;
    
    // 5. Energy Bar
    this.energyBar = new EnergyBarComponent(this, x, y, 'Energy');
    this.energyBar.setDepth(10);
    this.energyBar.setScale(scale);
    y += 60 * scale;
    
    // 6. Your Focus/Disturb toggle (bottom)
    this.playerFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
    this.playerFocusDisturb.setLabel('Your Mode');
    this.playerFocusDisturb.setDepth(10);
    this.playerFocusDisturb.setScale(scale);
    this.playerFocusDisturb.onModeChange = (mode) => {
      this.gameStateManager.setMode(this.localColor, mode);
      this.eventLog.addEntry('system', `Mode changed to ${mode}`);
      this.sendLocalPlayerStats();
    };
  }

  /**
   * Create left panel with deck/discard piles for both players
   * Top: Opponent's deck, opponent's discard
   * Bottom: Player's discard, player's deck
   */
  private createLeftPanel(layout: ReturnType<typeof this.calculateLayout>): void {
    const scale = layout.scale;
    const x = layout.leftPanelX;
    const deckScale = 0.12 * scale;
    
    // === OPPONENT'S DECK (top) ===
    this.opponentDeckSprite = this.add.image(x, layout.opponentDeckY, 'card_back');
    this.opponentDeckSprite.setScale(deckScale);
    this.opponentDeckSprite.setDepth(10);
    
    this.add.text(x, layout.opponentDeckY - 60 * scale, "Opp Deck", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
    }).setOrigin(0.5).setDepth(10);
    
    this.opponentDeckCountText = this.add.text(x, layout.opponentDeckY + 55 * scale, '60', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
    }).setOrigin(0.5).setDepth(10);
    
    // === OPPONENT'S DISCARD (below deck) ===
    this.opponentDiscardSprite = this.add.image(x, layout.opponentDiscardY, 'card_back');
    this.opponentDiscardSprite.setScale(deckScale);
    this.opponentDiscardSprite.setDepth(10);
    this.opponentDiscardSprite.setAlpha(0.5);
    
    this.add.text(x, layout.opponentDiscardY - 60 * scale, "Opp Discard", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    this.opponentDiscardCountText = this.add.text(x, layout.opponentDiscardY + 55 * scale, '0', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    // === PLAYER'S DISCARD (above player deck) ===
    this.playerDiscardSprite = this.add.image(x, layout.playerDiscardY, 'card_back');
    this.playerDiscardSprite.setScale(deckScale);
    this.playerDiscardSprite.setDepth(10);
    this.playerDiscardSprite.setAlpha(0.5);
    
    this.add.text(x, layout.playerDiscardY - 60 * scale, "Your Discard", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    this.playerDiscardCountText = this.add.text(x, layout.playerDiscardY + 55 * scale, '0', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
    }).setOrigin(0.5).setDepth(10);
    
    // === PLAYER'S DECK (bottom) ===
    this.playerDeckSprite = this.add.image(x, layout.playerDeckY, 'card_back');
    this.playerDeckSprite.setScale(deckScale);
    this.playerDeckSprite.setDepth(10);
    
    this.add.text(x, layout.playerDeckY - 60 * scale, "Your Deck", {
      fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
    }).setOrigin(0.5).setDepth(10);
    
    this.playerDeckCountText = this.add.text(x, layout.playerDeckY + 55 * scale, '60', {
      fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
    }).setOrigin(0.5).setDepth(10);
  }

  /**
   * Create opponent's last played card preview area (top center)
   */
  private createOpponentPreviewArea(layout: ReturnType<typeof this.calculateLayout>): void {
    const scale = layout.scale;
    
    this.add.text(
      layout.opponentPreviewX, layout.opponentPreviewY - 40 * scale, "Opponent's Last Card",
      { fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
    ).setOrigin(0.5).setDepth(10);
  }

  private createCardHand(layout: ReturnType<typeof this.calculateLayout>): void {
    this.cardHand = new CardHandComponent(
      this, layout.cardHandX, layout.cardHandY,
      layout.previewX, layout.previewY
    );
    this.cardHand.setDepth(20);
    this.cardHand.setScale(layout.scale);
    
    this.cardHand.setPlayZone({
      x: layout.boardX - layout.boardSize / 2,
      y: layout.boardY - layout.boardSize / 2,
      width: layout.boardSize, height: layout.boardSize
    });
    
    this.cardHand.setBoardBounds(
      layout.boardX - layout.boardSize / 2, layout.boardY - layout.boardSize / 2,
      layout.boardSize, layout.boardSize, 64 * layout.scale, this.localColor === 'black'
    );
    
    this.cardHand.enableInteraction();
  }

  private createCardCountIndicator(layout: ReturnType<typeof this.calculateLayout>): void {
    this.cardCountText = this.add.text(
      layout.boardX, layout.boardY + layout.boardSize / 2 + 20 * layout.scale, 'Hand: 0 / 7',
      { fontSize: `${14 * layout.scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
    ).setOrigin(0.5).setDepth(10);
  }

  // ============================================
  // Game State Callbacks
  // ============================================

  private setupGameStateCallbacks(): void {
    this.gameStateManager.setOnStateChange((_state) => {
      this.updateUIFromState();
    });
  }

  private updateUIFromState(): void {
    const state = this.gameStateManager.getState();
    const localPlayer = state.players[this.localColor];
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const opponentPlayer = state.players[opponentColor];
    
    // Update clocks
    this.playerClock.setTime(localPlayer.clock);
    this.opponentClock.setTime(opponentPlayer.clock);
    
    // Update active clock indicator
    const isLocalTurn = state.currentTurn === this.localColor;
    this.playerClock.setActive(isLocalTurn);
    this.opponentClock.setActive(!isLocalTurn);
    
    // Update stopwatch
    this.stopwatch.setTime(localPlayer.stopwatch);
    
    // Update energy bar
    this.energyBar.setEnergy(localPlayer.energy, localPlayer.energyCap);
    
    // Update Focus/Disturb toggles
    this.playerFocusDisturb.setMode(localPlayer.mode);
    this.opponentFocusDisturb.setMode(opponentPlayer.mode);
    
    // Update opponent deck counts
    this.updateOpponentDeckCounts(opponentPlayer.deck.length, opponentPlayer.discard.length);
    
    // Update player deck counts
    this.updatePlayerDeckCounts(localPlayer.deck.length, localPlayer.discard.length);
    
    // Update hand display if hand changed (e.g., card drawn at turn start)
    if (this.cardHand.getCardCount() !== localPlayer.hand.length) {
      this.updateHandDisplay();
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
    
    // Send local player stats to opponent for sync
    this.sendLocalPlayerStats();
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
      this.updateUIFromState();
    });
    
    this.networkManager.onPeerLeft((_peerId) => {
      this.eventLog.addEntry('system', 'Opponent disconnected');
      // Could show reconnection dialog here
    });
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
      case 'PLAYER_STATS_SYNC':
        this.handleOpponentStatsSync(action.clock, action.stopwatch, action.mode, action.deckCount, action.discardCount);
        break;
    }
  }

  /**
   * Handle opponent stats sync (clock, stopwatch, mode)
   */
  private handleOpponentStatsSync(clock: number, _stopwatch: number, mode: 'focus' | 'disturb', deckCount: number, discardCount: number): void {
    // Update opponent's clock display
    this.opponentClock.setTime(clock);
    
    // Update opponent's focus/disturb mode display
    this.opponentFocusDisturb.setMode(mode);
    
    // Update opponent deck/discard counts
    this.updateOpponentDeckCounts(deckCount, discardCount);
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
    
    this.eventLog.addEntry(opponentColor, `Played ${cardName}`);
    
    // Handle piece deployment/destruction on board
    if (effectAction === 'DEPLOY_PIECE' && target && pieceType) {
      const color: Color = opponentColor === 'white' ? 'w' : 'b';
      this.chessBoard.placePiece(target as Square, pieceType as PieceSymbol, color);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    } else if (effectAction === 'DESTROY_PIECE' && target) {
      this.chessBoard.removePiece(target as Square);
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    }
    
    this.updateUIFromState();
  }

  private handleOpponentMovePiece(from: string, to: string): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const result = this.chessBoard.makeMove(from as Square, to as Square);
    
    if (result.success) {
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.gameStateManager.deductMoveTimeCost(opponentColor);
      this.gameStateManager.resolveDisturbTagsOnMove(opponentColor);
      
      this.eventLog.addEntry(opponentColor, `Moved ${from} to ${to}`);
      
      // Check for king capture (Requirement 3.7)
      if (result.isKingCapture) {
        this.handleGameEnd(opponentColor, 'King captured!');
        return;
      }
      
      // Note: Turn ending is handled by the END_TURN network action
      // Don't call endTurn() here to avoid double turn switch
    }
    
    this.updateUIFromState();
  }

  private handleOpponentMulligan(): void {
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    this.gameStateManager.deductMulliganTimeCost(opponentColor);
    this.eventLog.addEntry(opponentColor, 'Mulligan');
    this.updateUIFromState();
  }

  private handleOpponentReady(): void {
    this.opponentPlayerReady = true;
    this.eventLog.addEntry('system', 'Opponent is ready');
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
    
    // Check if it's our turn (skip in single-player hotseat mode)
    if (!isSinglePlayer && !this.gameStateManager.isLocalPlayerTurn()) {
      this.eventLog.addEntry('system', "Not your turn!");
      return;
    }
    
    // Check if in discard mode
    if (this.isDiscardMode) {
      this.eventLog.addEntry('system', "Discard cards first!");
      return;
    }
    
    // Check game phase
    if (this.gameStateManager.getPhase() !== 'playing') {
      this.eventLog.addEntry('system', "Game not started yet!");
      return;
    }
    
    // Determine which color is moving based on the piece
    const piece = this.chessBoard.getWrapper().getPiece(from);
    if (!piece) return;
    
    const movingColor: PlayerColor = piece.color === 'w' ? 'white' : 'black';
    
    // In multiplayer, verify it's the correct player's turn
    if (!isSinglePlayer && movingColor !== this.localColor) {
      this.eventLog.addEntry('system', "Not your piece!");
      return;
    }
    
    // Verify it's this color's turn
    if (this.gameStateManager.getCurrentTurn() !== movingColor) {
      this.eventLog.addEntry('system', `It's ${this.gameStateManager.getCurrentTurn()}'s turn!`);
      return;
    }
    
    // Check if piece was deployed this turn (cannot move)
    const moveCheck = this.gameStateManager.canMovePiece(movingColor, from);
    if (!moveCheck.canMove) {
      this.eventLog.addEntry('system', moveCheck.reason);
      return;
    }
    
    // Attempt the move
    const result = this.chessBoard.makeMove(from, to);
    
    if (result.success) {
      // Update game state
      this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      this.gameStateManager.deductMoveTimeCost(movingColor);
      this.gameStateManager.resolveDisturbTagsOnMove(movingColor);
      
      this.eventLog.addEntry(movingColor, `Moved ${from} to ${to}`);
      
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
        this.eventLog.addEntry('system', `Ending ${movingColor}'s turn...`);
        this.gameStateManager.endTurn();
        const newTurn = this.gameStateManager.getCurrentTurn();
        this.eventLog.addEntry('system', `Now ${newTurn}'s turn`);
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
      this.eventLog.addEntry('system', "Not your turn!");
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
      this.eventLog.addEntry('system', "Game not started yet!");
      return;
    }
    
    // Validate card can be played
    const validation = this.gameStateManager.canPlayCard(card, this.localColor);
    if (!validation.canPlay) {
      this.eventLog.addEntry('system', validation.reason);
      return;
    }
    
    // Play the card
    const result = this.gameStateManager.playCard(card.id, this.localColor, target);
    
    if (result.success) {
      this.eventLog.addEntry(this.localColor, `Played ${card.name}`);
      
      // Handle piece deployment/destruction on board
      if (card.effect.action === 'DEPLOY_PIECE' && target) {
        const piece = (card.effect as { piece: PieceSymbol }).piece;
        const color: Color = this.localColor === 'white' ? 'w' : 'b';
        this.chessBoard.placePiece(target, piece, color);
        this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      } else if (card.effect.action === 'DESTROY_PIECE' && target) {
        this.chessBoard.removePiece(target);
        this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
      }
      
      // Send to network with card details for opponent to sync
      const pieceType = card.effect.action === 'DEPLOY_PIECE' ? (card.effect as { piece: PieceSymbol }).piece : undefined;
      this.networkManager?.sendPlayCard(card.id, card.name, target, pieceType, card.effect.action);
      
      // Update hand display
      this.updateHandDisplay();
      
      // Check for checkmate/stalemate after card play (Requirement 3.8)
      this.checkGameEndConditions();
    } else {
      this.eventLog.addEntry('system', result.message);
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
    
    // Update hand display
    this.updateHandDisplay();
    
    // Show mulligan UI
    this.showMulliganUI();
    
    // Log game start
    this.eventLog.addEntry('system', 'Game started');
    this.eventLog.addEntry(this.localColor, 'Drew 7 cards');
    
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
    
    // Semi-transparent overlay
    this.mulliganOverlay = this.add.graphics();
    this.mulliganOverlay.fillStyle(0x000000, 0.5);
    this.mulliganOverlay.fillRect(0, 0, width, height);
    this.mulliganOverlay.setDepth(50);
    
    // Instructions - title
    this.mulliganTitleText = this.add.text(width / 2, height / 2 - 180, 'Mulligan Phase', {
      fontSize: '32px',
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(51);
    
    // Instructions - subtitle (more space from buttons)
    this.mulliganInstructionText = this.add.text(width / 2, height / 2 - 130, 'Mulligan costs 10 seconds. Click Done when ready.', {
      fontSize: '16px',
      fontFamily: 'BoldPixels, Arial',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(51);
    
    // Mulligan button (red) - more space from text
    this.mulliganButton = this.createImageButton(
      width / 2 - 120, height / 2 - 40,
      'MULLIGAN (-10s)',
      'red_button',
      'red_button_pressed',
      () => this.handleMulligan()
    );
    this.mulliganButton.setDepth(51);
    
    // Ready button (blue)
    this.readyButton = this.createImageButton(
      width / 2 + 120, height / 2 - 40,
      'DONE',
      'blue_button',
      'blue_button_pressed',
      () => this.handleReady()
    );
    this.readyButton.setDepth(51);
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
    
    this.eventLog.addEntry(this.localColor, 'Mulligan (-10s)');
    
    // Send to network
    this.networkManager?.sendMulligan();
    
    this.updateUIFromState();
  }

  private handleReady(): void {
    // Mark local player as ready
    this.localPlayerReady = true;
    
    // Hide mulligan UI
    this.hideMulliganUI();
    
    this.eventLog.addEntry('system', 'Ready to play');
    
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
      this.eventLog.addEntry('system', 'Game started!');
      this.updateUIFromState();
      return;
    }
    
    // In multiplayer, wait for both players to be ready
    if (this.localPlayerReady && this.opponentPlayerReady) {
      this.gameStateManager.startGame();
      this.eventLog.addEntry('system', 'Both players ready - Game started!');
      this.updateUIFromState();
    }
  }

  // ============================================
  // Discard Mode (Requirement 3.6)
  // ============================================

  private enterDiscardMode(): void {
    this.isDiscardMode = true;
    const { width, height } = this.scale;
    
    // Semi-transparent overlay
    this.discardOverlay = this.add.graphics();
    this.discardOverlay.fillStyle(0x000000, 0.3);
    this.discardOverlay.fillRect(0, 0, width, height);
    this.discardOverlay.setDepth(45);
    
    // Prompt text
    const handSize = this.gameStateManager.getHandSize(this.localColor);
    const toDiscard = handSize - MAX_HAND_SIZE;
    
    this.discardPromptText = this.add.text(
      width / 2, height / 2 - 150,
      `Discard ${toDiscard} card(s) to continue`,
      {
        fontSize: '24px',
        fontFamily: 'BoldPixels, Arial',
        color: '#ff6666'
      }
    ).setOrigin(0.5).setDepth(46);
    
    this.eventLog.addEntry('system', `Hand size exceeds 7. Discard ${toDiscard} card(s).`);
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
      
      this.eventLog.addEntry(this.localColor, `Discarded ${card.name}`);
      
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
    if (this.gameStateManager.hasTimedOut('white')) {
      this.handleGameEnd('black', 'White ran out of time!');
      return;
    }
    if (this.gameStateManager.hasTimedOut('black')) {
      this.handleGameEnd('white', 'Black ran out of time!');
      return;
    }
  }

  private handleGameEnd(winner: PlayerColor | null, reason: string): void {
    this.gameStateManager.endGame();
    
    this.eventLog.addEntry('system', reason);
    
    if (winner) {
      const isLocalWin = winner === this.localColor;
      this.eventLog.addEntry('system', isLocalWin ? 'You win!' : 'You lose!');
    }
    
    // Transition to EndScene with network manager for rematch flow
    this.time.delayedCall(2000, () => {
      this.scene.start('EndScene', {
        winner,
        reason,
        localColor: this.localColor,
        playerName: this.playerName,
        opponentName: this.opponentName,
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
    
    container.on('pointerover', () => {
      container.setScale(1.05);
    });
    
    container.on('pointerout', () => {
      container.setScale(1);
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
    });
    
    container.on('pointerdown', () => {
      bgNormal.setVisible(false);
      bgPressed.setVisible(true);
      container.setScale(0.98);
    });
    
    container.on('pointerup', () => {
      bgNormal.setVisible(true);
      bgPressed.setVisible(false);
      container.setScale(1.05);
      onClick();
    });
    
    return container;
  }

  updateOpponentDeckCounts(deckCount: number, discardCount: number): void {
    this.opponentDeckCountText.setText(`${deckCount}`);
    this.opponentDiscardCountText.setText(`${discardCount}`);
  }

  updatePlayerDeckCounts(deckCount: number, discardCount: number): void {
    this.playerDeckCountText.setText(`${deckCount}`);
    this.playerDiscardCountText.setText(`${discardCount}`);
  }

  showOpponentCard(cardData: Card): void {
    const layout = this.calculateLayout(this.scale.width, this.scale.height);
    
    if (this.opponentCardPreview) {
      this.opponentCardPreview.destroy();
    }
    
    if (cardData) {
      this.opponentCardPreview = new CardComponent(
        this, layout.opponentPreviewX, layout.opponentPreviewY,
        cardData, false, 0.8
      );
      this.opponentCardPreview.setDepth(15);
    }
  }

  // ============================================
  // Public Accessors
  // ============================================

  getChessBoard(): ChessBoardComponent { return this.chessBoard; }
  getCardHand(): CardHandComponent { return this.cardHand; }
  getEventLog(): EventLogComponent { return this.eventLog; }
  getGameStateManager(): GameStateManager { return this.gameStateManager; }
}
