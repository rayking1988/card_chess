/**
 * @fileoverview GameScene UI construction helpers
 *
 * @module scenes/game/GameSceneUIFactory
 */

import { CardHandComponent } from '../../components/CardHand';
import { ChessBoardComponent } from '../../components/ChessBoard';
import { ClockComponent } from '../../components/Clock';
import { DisturbCounterComponent } from '../../components/DisturbCounter';
import { EnergyBarComponent } from '../../components/EnergyBar';
import { EventLogComponent } from '../../components/EventLog';
import { FocusDisturbToggleComponent } from '../../components/FocusDisturbToggle';
import { StopwatchComponent } from '../../components/Stopwatch';
import { MAX_HAND_SIZE, MAX_PILE_LAYERS } from './GameConstants';
import type { GameLayout } from './GameTypes';
import { createImageButton, createPileStack } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';
import {
  positionBoard,
  positionCardCount,
  positionCardHand,
  positionLeftPanel,
  positionNameplates,
  positionOpponentHand,
  positionRightPanel,
  updateOpponentHandDisplay
} from './GameSceneLayout';
import {
  UI_FACTORY,
  LEFT_PANEL_LAYOUT,
  TURN_OVERLAY,
  NAMEPLATE,
  CARD_HAND_LAYOUT
} from '../../config';

/**
 * Creates the event log component
 *
 * @param layout - Current layout calculations
 */
export function createEventLog(this: GameScene, layout: GameLayout): void {
  // Event log on the right side, full height
  this.eventLog = new EventLogComponent(this, layout.eventLogX, layout.eventLogY);
  this.eventLog.setDepth(10);
  this.eventLog.setScale(layout.panelScale);
  this.eventLog.onQuickChatSelect = (message) => {
    const senderName = this.playerName;
    this.eventLog.addEntry(this.localColor, message, senderName);
    this.networkManager?.sendChatMessage(message, this.localColor, senderName);
  };

  // Preview area removed per user request
}

/**
 * Creates the chess board component
 * Board is flipped if local player is black (Requirement 1.8)
 *
 * @param layout - Current layout calculations
 */
export function createChessBoard(this: GameScene, layout: GameLayout): void {
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
  positionBoard.call(this, layout);
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
 */
export function createRightPanel(this: GameScene, layout: GameLayout): void {
  const x = layout.rightPanelX;
  const scale = layout.panelScale;
  const y = layout.rightPanelTop;

  const topSection = layout.sections.rightPanelTop;
  const middleSection = layout.sections.rightPanelMiddle;
  const bottomSection = layout.sections.rightPanelBottom;

  this.rightPanelTopBackdrop = this.add.rectangle(
    topSection.centerX,
    topSection.centerY,
    topSection.width,
    topSection.height,
    hex('#000000'),
    UI_FACTORY.RIGHT_PANEL_BACKDROP_ALPHA
  ).setDepth(6);
  this.rightPanelMiddleBackdrop = this.add.rectangle(
    middleSection.centerX,
    middleSection.centerY,
    middleSection.width,
    middleSection.height,
    hex('#000000'),
    UI_FACTORY.RIGHT_PANEL_BACKDROP_ALPHA
  ).setDepth(6);
  this.rightPanelBottomBackdrop = this.add.rectangle(
    bottomSection.centerX,
    bottomSection.centerY,
    bottomSection.width,
    bottomSection.height,
    hex('#000000'),
    UI_FACTORY.RIGHT_PANEL_BACKDROP_ALPHA
  ).setDepth(6);

  this.rightPanelTopTint = this.add.rectangle(
    topSection.centerX,
    topSection.centerY,
    topSection.width,
    topSection.height,
    hex('#772525'),
    UI_FACTORY.RIGHT_PANEL_TINT_ALPHA
  ).setDepth(7);
  this.rightPanelMiddleTint = this.add.rectangle(
    middleSection.centerX,
    middleSection.centerY,
    middleSection.width,
    middleSection.height,
    hex('#2e4f8f'),
    UI_FACTORY.RIGHT_PANEL_TINT_ALPHA
  ).setDepth(7);
  this.rightPanelBottomTint = this.add.rectangle(
    bottomSection.centerX,
    bottomSection.centerY,
    bottomSection.width,
    bottomSection.height,
    hex('#1e335e'),
    UI_FACTORY.RIGHT_PANEL_TINT_ALPHA
  ).setDepth(7);

  // 1. Opponent Clock (top)
  this.opponentClock = new ClockComponent(this, x, y, UI_FACTORY.INITIAL_CLOCK_TIME, this.opponentName);
  this.opponentClock.setDepth(10);
  this.opponentClock.setScale(scale);

  // 2. Opponent Stopwatch
  this.opponentStopwatch = new StopwatchComponent(this, x, y);
  this.opponentStopwatch.setBaseTimeColor('#000000');
  this.opponentStopwatch.setDepth(10);
  this.opponentStopwatch.setScale(scale);

  // 3. Opponent Energy Bar
  this.opponentEnergyBar = new EnergyBarComponent(this, x, y, '');
  this.opponentEnergyBar.setDepth(10);
  this.opponentEnergyBar.setScale(scale);

  // 4. Opponent Disturb Counter
  this.opponentDisturbCounter = new DisturbCounterComponent(this, x, y, '');
  this.opponentDisturbCounter.setDepth(10);
  this.opponentDisturbCounter.setScale(scale);

  // 5. Opponent Focus/Disturb toggle
  this.opponentFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
  this.opponentFocusDisturb.setLabel('');
  this.opponentFocusDisturb.setEnabled(false); // Opponent's toggle is read-only
  this.opponentFocusDisturb.setDepth(10);
  this.opponentFocusDisturb.setScale(scale);

  // 4. Your Clock
  this.playerClock = new ClockComponent(this, x, y, UI_FACTORY.INITIAL_CLOCK_TIME, this.playerName);
  this.playerClock.setActive(true);
  this.playerClock.setDepth(10);
  this.playerClock.setScale(scale);

  // 5. Your Stopwatch
  this.playerStopwatch = new StopwatchComponent(this, x, y);
  this.playerStopwatch.setBaseTimeColor('#000000');
  this.playerStopwatch.setDepth(10);
  this.playerStopwatch.setScale(scale);

  // 6. Energy Bar
  this.energyBar = new EnergyBarComponent(this, x, y, '');
  this.energyBar.setDepth(10);
  this.energyBar.setScale(scale);

  // 7. Your Disturb Counter
  this.playerDisturbCounter = new DisturbCounterComponent(this, x, y, '');
  this.playerDisturbCounter.setDepth(10);
  this.playerDisturbCounter.setScale(scale);

  // 8. Your Focus/Disturb toggle (bottom)
  this.playerFocusDisturb = new FocusDisturbToggleComponent(this, x, y, 'focus');
  this.playerFocusDisturb.setLabel('');
  this.playerFocusDisturb.setDepth(10);
  this.playerFocusDisturb.setScale(scale);
  this.playerFocusDisturb.onModeChange = (mode) => {
    this.gameStateManager.setMode(this.localColor, mode);
    this.logEvent('system', `Mode changed to ${mode}`);
    this.sendLocalPlayerStats();
  };

  this.controlledSquaresButton = createImageButton(
    this,
    bottomSection.centerX,
    bottomSection.centerY,
    'Controlled Squares',
    'blue_button',
    'blue_button_pressed',
    () => {
      // No-op click handler; hold events handle visibility.
    }
  );
  this.controlledSquaresButton.setDepth(10);
  this.controlledSquaresButton.on('pointerdown', () => this.showControlledSquaresOverlay());
  this.controlledSquaresButton.on('pointerup', () => this.hideControlledSquaresOverlay());
  this.controlledSquaresButton.on('pointerout', () => this.hideControlledSquaresOverlay());

  positionRightPanel.call(this, layout);
}

/**
 * Create left panel with deck/discard piles for both players
 * Top: Opponent's deck, opponent's discard
 * Bottom: Player's discard, player's deck
 */
export function createLeftPanel(this: GameScene, layout: GameLayout): void {
  const scale = layout.panelScale;
  const x = layout.leftPanelX;
  const deckScale = LEFT_PANEL_LAYOUT.DECK_SCALE * scale;
  const stackDepth = MAX_PILE_LAYERS;
  const textDepth = stackDepth + 10;

  // === OPPONENT'S DECK (top) ===
  this.opponentDeckStack = createPileStack(this, x, layout.opponentDeckY, deckScale, stackDepth, 1);

  this.opponentDeckLabelText = this.add.text(x, layout.opponentDeckY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale, 'Opp Deck', {
    fontSize: `${UI_FACTORY.DECK_LABEL_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
  }).setOrigin(0.5).setDepth(textDepth);

  this.opponentDeckCountText = this.add.text(x, layout.opponentDeckY + LEFT_PANEL_LAYOUT.COUNT_Y_OFFSET * scale, '60', {
    fontSize: `${UI_FACTORY.DECK_COUNT_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
  }).setOrigin(0.5).setDepth(textDepth);

  // === OPPONENT'S DISCARD (below deck) ===
  // No pile stack needed - only the top card is displayed
  this.opponentDiscardStack = [];

  this.opponentDiscardLabelText = this.add.text(x, layout.opponentDiscardY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale, 'Opp Discard', {
    fontSize: `${UI_FACTORY.DECK_LABEL_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(textDepth);

  this.opponentDiscardCountText = this.add.text(x, layout.opponentDiscardY + LEFT_PANEL_LAYOUT.COUNT_Y_OFFSET * scale, '0', {
    fontSize: `${UI_FACTORY.DECK_COUNT_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(textDepth);

  // === PLAYER'S DISCARD (above player deck) ===
  // No pile stack needed - only the top card is displayed
  this.playerDiscardStack = [];

  this.playerDiscardLabelText = this.add.text(x, layout.playerDiscardY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale, 'Your Discard', {
    fontSize: `${UI_FACTORY.DECK_LABEL_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(textDepth);

  this.playerDiscardCountText = this.add.text(x, layout.playerDiscardY + LEFT_PANEL_LAYOUT.COUNT_Y_OFFSET * scale, '0', {
    fontSize: `${UI_FACTORY.DECK_COUNT_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(textDepth);

  // === PLAYER'S DECK (bottom) ===
  this.playerDeckStack = createPileStack(this, x, layout.playerDeckY, deckScale, stackDepth, 1);

  this.playerDeckLabelText = this.add.text(x, layout.playerDeckY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale, 'Your Deck', {
    fontSize: `${UI_FACTORY.DECK_LABEL_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
  }).setOrigin(0.5).setDepth(textDepth);

  this.playerDeckCountText = this.add.text(x, layout.playerDeckY + LEFT_PANEL_LAYOUT.COUNT_Y_OFFSET * scale, '60', {
    fontSize: `${UI_FACTORY.DECK_COUNT_FONT_SIZE * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
  }).setOrigin(0.5).setDepth(textDepth);

  positionLeftPanel.call(this, layout);
}

/**
 * Creates the opponent's hand display container
 * Shows face-down cards in a fan pattern
 *
 * @param layout - Current layout calculations
 */
export function createOpponentHand(this: GameScene, layout: GameLayout): void {
  this.opponentHandContainer = this.add.container(layout.opponentHandX, layout.opponentHandY);
  this.opponentHandContainer.setDepth(12);
  const textDepth = 20 + MAX_HAND_SIZE;

  this.opponentHandLabelText = this.add.text(
    layout.opponentHandX,
    layout.opponentHandLabelY,
    'Opponent Hand',
    { fontSize: `${UI_FACTORY.HAND_LABEL_FONT_SIZE * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
  ).setOrigin(0.5).setDepth(textDepth);

  this.opponentHandCountText = this.add.text(
    layout.opponentHandX,
    layout.opponentHandCountY,
    '0',
    { fontSize: `${UI_FACTORY.HAND_LABEL_FONT_SIZE * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
  ).setOrigin(0.5).setDepth(textDepth);

  updateOpponentHandDisplay.call(this, this.opponentHandCount);
  positionOpponentHand.call(this, layout);
}

/**
 * Creates player nameplates above and below the board
 *
 * @param layout - Current layout calculations
 */
export function createNameplates(this: GameScene, layout: GameLayout): void {
  this.opponentNameText = this.add.text(
    layout.opponentNameX,
    layout.opponentNameY,
    this.opponentName,
    { fontSize: `${NAMEPLATE.FONT_SIZE * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
  ).setOrigin(0.5).setDepth(15);

  this.playerNameText = this.add.text(
    layout.playerNameX,
    layout.playerNameY,
    this.playerName,
    { fontSize: `${NAMEPLATE.FONT_SIZE * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
  ).setOrigin(0.5).setDepth(15);

  this.opponentNameText.setVisible(false);
  this.playerNameText.setVisible(false);

  positionNameplates.call(this, layout);
}

/**
 * Creates the player's card hand component
 *
 * @param layout - Current layout calculations
 */
export function createCardHand(this: GameScene, layout: GameLayout): void {
  this.cardHand = new CardHandComponent(
    this, layout.cardHandX, layout.cardHandY,
    layout.previewX, layout.previewY
  );
  this.cardHand.setDepth(150);
  this.cardHand.setScale(1);
  this.cardHand.setHandScale(layout.handScale);
  positionCardHand.call(this, layout);

  this.cardHand.enableInteraction();
}

/**
 * Creates the card count indicator text
 *
 * @param layout - Current layout calculations
 */
export function createCardCountIndicator(this: GameScene, layout: GameLayout): void {
  this.cardCountText = this.add.text(
    layout.boardX, layout.boardY + layout.boardSize / 2 + CARD_HAND_LAYOUT.COUNT_Y_OFFSET * layout.panelScale, 'Hand: 0 / 7',
    { fontSize: `${CARD_HAND_LAYOUT.COUNT_FONT_SIZE * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
  ).setOrigin(0.5).setDepth(10);
  positionCardCount.call(this, layout);
}

/**
 * Creates the turn announcement banner
 * Banner appears briefly at turn changes
 *
 * @param layout - Current layout calculations
 */
export function createTurnBanner(this: GameScene, layout: GameLayout): void {
  this.turnBanner = this.add.container(layout.turnBannerX, layout.turnBannerY);
  this.turnBanner.setDepth(100);
  this.turnBanner.setVisible(false);

  const bg = this.add.graphics();
  bg.fillStyle(hex('#000000'), 0.7);
  bg.fillRoundedRect(-TURN_OVERLAY.BANNER_HALF_WIDTH, -TURN_OVERLAY.BANNER_HALF_HEIGHT, TURN_OVERLAY.BANNER_WIDTH, TURN_OVERLAY.BANNER_HEIGHT, TURN_OVERLAY.BANNER_BORDER_RADIUS);

  this.turnBannerText = this.add.text(0, 0, '', {
    fontSize: `${TURN_OVERLAY.BANNER_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#ffffff'
  }).setOrigin(0.5);

  this.turnBanner.add([bg, this.turnBannerText]);
}

/**
 * Creates the turn overlay banner across the board
 */
export function createTurnOverlay(this: GameScene, _layout: GameLayout): void {
  this.turnOverlayRect = this.add.rectangle(0, 0, 1, 1, hex('#3366ff'), TURN_OVERLAY.OVERLAY_ALPHA);
  this.turnOverlayRect.setOrigin(0, 0);
  this.turnOverlayRect.setDepth(30);
  this.turnOverlayRect.setVisible(false);

  this.turnOverlayText = this.add.text(0, 0, '', {
    fontSize: `${TURN_OVERLAY.OVERLAY_FONT_SIZE}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#ffffff'
  }).setOrigin(0.5);
  this.turnOverlayText.setDepth(31);
  this.turnOverlayText.setVisible(false);
}

/**
 * Creates mobile info bars for compact UI mode
 */
export function createMobileBars(this: GameScene, layout: GameLayout): void {
  const topBounds = layout.sections.mobileTopBar;
  const bottomBounds = layout.sections.mobileBottomBar;

  this.mobileTopBar = this.add.container(topBounds.centerX, topBounds.centerY).setDepth(60);
  this.mobileTopBarBackground = this.add.rectangle(0, 0, topBounds.width, topBounds.height, hex('#9a9a9a'), 0.6);
  this.mobileTopBarBackground.setOrigin(0.5);
  this.mobileTopBar.add(this.mobileTopBarBackground);

  this.mobileTopNameText = this.add.text(0, 0, this.opponentName, {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileTopBar.add(this.mobileTopNameText);

  this.mobileTopClockIcon = this.add.image(0, 0, 'clock');
  this.mobileTopStopwatchIcon = this.add.image(0, 0, 'stopwatch');
  this.mobileTopEnergyIcon = this.add.image(0, 0, 'energy_circle');
  this.mobileTopDisturbIcon = this.add.image(0, 0, 'switch_disturb');
  this.mobileTopClockText = this.add.text(0, 0, '0:00', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileTopStopwatchText = this.add.text(0, 0, '00', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileTopEnergyText = this.add.text(0, 0, '0/0', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileTopDisturbText = this.add.text(0, 0, '0', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileTopBar.add([
    this.mobileTopClockIcon,
    this.mobileTopClockText,
    this.mobileTopStopwatchIcon,
    this.mobileTopStopwatchText,
    this.mobileTopEnergyIcon,
    this.mobileTopEnergyText,
    this.mobileTopDisturbIcon,
    this.mobileTopDisturbText
  ]);

  this.mobileBottomBar = this.add.container(bottomBounds.centerX, bottomBounds.centerY).setDepth(60);
  this.mobileBottomBarBackground = this.add.rectangle(0, 0, bottomBounds.width, bottomBounds.height, hex('#9a9a9a'), 0.6);
  this.mobileBottomBarBackground.setOrigin(0.5);
  this.mobileBottomBar.add(this.mobileBottomBarBackground);

  this.mobileBottomNameText = this.add.text(0, 0, this.playerName, {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileBottomBar.add(this.mobileBottomNameText);

  this.mobileBottomClockIcon = this.add.image(0, 0, 'clock');
  this.mobileBottomStopwatchIcon = this.add.image(0, 0, 'stopwatch');
  this.mobileBottomEnergyIcon = this.add.image(0, 0, 'energy_circle');
  this.mobileBottomDisturbIcon = this.add.image(0, 0, 'switch_disturb');
  this.mobileBottomClockText = this.add.text(0, 0, '0:00', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileBottomStopwatchText = this.add.text(0, 0, '00', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileBottomEnergyText = this.add.text(0, 0, '0/0', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileBottomDisturbText = this.add.text(0, 0, '0', {
    fontSize: `${UI_FACTORY.MOBILE_STAT_FONT_SIZE * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#1a1a1a'
  }).setOrigin(0, 0.5);
  this.mobileBottomBar.add([
    this.mobileBottomClockIcon,
    this.mobileBottomClockText,
    this.mobileBottomStopwatchIcon,
    this.mobileBottomStopwatchText,
    this.mobileBottomEnergyIcon,
    this.mobileBottomEnergyText,
    this.mobileBottomDisturbIcon,
    this.mobileBottomDisturbText
  ]);

  this.mobileControlledSquaresButton = createImageButton(
    this,
    0,
    0,
    'Controlled Squares',
    'blue_button',
    'blue_button_pressed',
    () => {
      // Hold events handle overlay visibility.
    }
  );
  this.mobileControlledSquaresButton.on('pointerdown', () => this.showControlledSquaresOverlay());
  this.mobileControlledSquaresButton.on('pointerup', () => this.hideControlledSquaresOverlay());
  this.mobileControlledSquaresButton.on('pointerout', () => this.hideControlledSquaresOverlay());

  this.mobileEventLogButton = createImageButton(
    this,
    0,
    0,
    'Event Log',
    'yellow_button',
    'yellow_button_pressed',
    () => this.toggleMobileEventLog()
  );

  this.mobileBottomBar.add([this.mobileControlledSquaresButton, this.mobileEventLogButton]);
}
