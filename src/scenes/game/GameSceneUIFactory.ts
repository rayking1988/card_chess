/**
 * @fileoverview GameScene UI construction helpers
 *
 * @module scenes/game/GameSceneUIFactory
 */

import { CardHandComponent } from '../../components/CardHand';
import { ChessBoardComponent } from '../../components/ChessBoard';
import { ClockComponent } from '../../components/Clock';
import { EnergyBarComponent } from '../../components/EnergyBar';
import { EventLogComponent } from '../../components/EventLog';
import { FocusDisturbToggleComponent } from '../../components/FocusDisturbToggle';
import { StopwatchComponent } from '../../components/Stopwatch';
import { MAX_PILE_LAYERS } from './GameConstants';
import type { GameLayout } from './GameTypes';
import { createPileStack } from './GameUIHelpers';
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
  const deckScale = 0.14 * scale;
  const stackDepth = MAX_PILE_LAYERS;

  // === OPPONENT'S DECK (top) ===
  this.opponentDeckStack = createPileStack(this, x, layout.opponentDeckY, deckScale, stackDepth, 1);
  this.opponentDeckSprite = this.add.image(x, layout.opponentDeckY, 'card_back');
  this.opponentDeckSprite.setScale(deckScale);
  this.opponentDeckSprite.setDepth(10);

  this.opponentDeckLabelText = this.add.text(x, layout.opponentDeckY - 60 * scale, 'Opp Deck', {
    fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
  }).setOrigin(0.5).setDepth(10);

  this.opponentDeckCountText = this.add.text(x, layout.opponentDeckY + 55 * scale, '60', {
    fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
  }).setOrigin(0.5).setDepth(10);

  // === OPPONENT'S DISCARD (below deck) ===
  this.opponentDiscardLabelText = this.add.text(x, layout.opponentDiscardY - 60 * scale, 'Opp Discard', {
    fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(10);

  this.opponentDiscardCountText = this.add.text(x, layout.opponentDiscardY + 55 * scale, '0', {
    fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#888888'
  }).setOrigin(0.5).setDepth(10);

  // === PLAYER'S DISCARD (above player deck) ===
  this.playerDiscardLabelText = this.add.text(x, layout.playerDiscardY - 60 * scale, 'Your Discard', {
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

  this.playerDeckLabelText = this.add.text(x, layout.playerDeckY - 60 * scale, 'Your Deck', {
    fontSize: `${10 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc'
  }).setOrigin(0.5).setDepth(10);

  this.playerDeckCountText = this.add.text(x, layout.playerDeckY + 55 * scale, '60', {
    fontSize: `${12 * scale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff'
  }).setOrigin(0.5).setDepth(10);

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
    { fontSize: `${20 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#cccccc' }
  ).setOrigin(0.5).setDepth(15);

  this.playerNameText = this.add.text(
    layout.playerNameX,
    layout.playerNameY,
    this.playerName,
    { fontSize: `${20 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
  ).setOrigin(0.5).setDepth(15);

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
  this.cardHand.setDepth(20);
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
    layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale, 'Hand: 0 / 7',
    { fontSize: `${14 * layout.panelScale}px`, fontFamily: 'BoldPixels, Arial', color: '#ffffff' }
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
  bg.fillRoundedRect(-180, -28, 360, 56, 12);

  this.turnBannerText = this.add.text(0, 0, '', {
    fontSize: `${26 * layout.panelScale}px`,
    fontFamily: 'BoldPixels, Arial',
    color: '#ffffff'
  }).setOrigin(0.5);

  this.turnBanner.add([bg, this.turnBannerText]);
}
