/**
 * @fileoverview GameScene layout and positioning helpers
 *
 * @module scenes/game/GameSceneLayout
 */

import type { GameScene } from '../GameScene';
import { MAX_HAND_SIZE } from './GameConstants';
import { calculateLayout } from './GameLayout';
import type { GameLayout } from './GameTypes';
import { layoutPileStack } from './GameUIHelpers';
import { scaleBackgroundToCover } from './GameSceneBackground';
import { updateDebugOverlays } from './GameSceneDebug';
import { buildDiscardViewerCards, layoutDiscardViewer } from './GameSceneDiscardViewer';

/**
 * Handles window resize - repositions all UI elements
 */
export function handleResize(this: GameScene): void {
  const { width, height } = this.scale;

  // Recalculate layout
  const layout = calculateLayout(width, height);
  this.currentLayout = layout;

  // Reposition and rescale background to cover
  scaleBackgroundToCover.call(this);

  positionBoard.call(this, layout);
  positionEventLog.call(this, layout);
  positionRightPanel.call(this, layout);
  positionLeftPanel.call(this, layout);
  positionOpponentHand.call(this, layout);
  positionNameplates.call(this, layout);
  positionCardHand.call(this, layout);
  positionCardCount.call(this, layout);
  positionTurnBanner.call(this, layout);
  positionOverlays.call(this, layout);

  // Update debug overlays if enabled
  if (this.debugOverlays.size > 0) {
    updateDebugOverlays.call(this, layout);
  }
}

/**
 * Updates chess board position and scale
 *
 * @param layout - Current layout calculations
 */
export function positionBoard(this: GameScene, layout: GameLayout): void {
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
 */
export function positionEventLog(this: GameScene, layout: GameLayout): void {
  if (!this.eventLog) return;
  this.eventLog.setPosition(layout.eventLogX, layout.eventLogY);
  this.eventLog.setScale(layout.panelScale);
}

/**
 * Updates right panel positions (clocks, stopwatches, energy, toggles)
 * Elements are stacked vertically with consistent spacing
 *
 * @param layout - Current layout calculations
 */
export function positionRightPanel(this: GameScene, layout: GameLayout): void {
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
 */
export function positionLeftPanel(this: GameScene, layout: GameLayout): void {
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
 */
export function positionOpponentHand(this: GameScene, layout: GameLayout): void {
  if (!this.opponentHandContainer) return;
  this.opponentHandContainer.setPosition(layout.opponentHandX, layout.opponentHandY);
  this.opponentHandLabelText.setPosition(layout.opponentHandX, layout.opponentHandLabelY);
  this.opponentHandLabelText.setFontSize(12 * layout.panelScale);
  this.opponentHandCountText.setPosition(layout.opponentHandX, layout.opponentHandCountY);
  this.opponentHandCountText.setFontSize(12 * layout.panelScale);

  updateOpponentHandDisplay.call(this, this.opponentHandCount);
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
 */
export function updateOpponentHandDisplay(this: GameScene, count: number): void {
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
 */
export function positionNameplates(this: GameScene, layout: GameLayout): void {
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
 */
export function positionCardHand(this: GameScene, layout: GameLayout): void {
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
 */
export function positionCardCount(this: GameScene, layout: GameLayout): void {
  if (!this.cardCountText) return;
  this.cardCountText.setPosition(layout.boardX, layout.boardY + layout.boardSize / 2 + 18 * layout.panelScale);
  this.cardCountText.setFontSize(14 * layout.panelScale);
}

/**
 * Updates turn banner position
 *
 * @param layout - Current layout calculations
 */
export function positionTurnBanner(this: GameScene, layout: GameLayout): void {
  if (!this.turnBanner) return;
  this.turnBanner.setPosition(layout.turnBannerX, layout.turnBannerY);
  this.turnBanner.setScale(layout.panelScale);
}

/**
 * Updates all overlay positions (mulligan, discard, connection, viewer)
 *
 * @param layout - Current layout calculations
 */
export function positionOverlays(this: GameScene, layout: GameLayout): void {
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
    layoutDiscardViewer.call(this, layout);
    buildDiscardViewerCards.call(this, layout);
  }
}
