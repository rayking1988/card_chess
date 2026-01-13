/**
 * @fileoverview GameScene layout and positioning helpers
 *
 * @module scenes/game/GameSceneLayout
 */

import Phaser from 'phaser';
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
  positionMobileBars.call(this, layout);
  positionLeftPanel.call(this, layout);
  positionOpponentHand.call(this, layout);
  positionNameplates.call(this, layout);
  positionCardHand.call(this, layout);
  positionCardCount.call(this, layout);
  positionTurnBanner.call(this, layout);
  positionTurnOverlay.call(this, layout);
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
  const logArea = layout.sections.eventLogTop;
  const previewArea = layout.sections.eventLogPreview;
  const logDims = this.eventLog.getDimensions();
  const scaleX = logArea.width / logDims.width;
  const scaleY = logArea.height / logDims.height;
  const logScale = Math.min(scaleX, scaleY);

  const showLog = !layout.isMobile || this.isMobileEventLogVisible;
  this.eventLog.setVisible(showLog);
  if (showLog) {
    this.eventLog.setPosition(logArea.centerX, logArea.centerY);
    this.eventLog.setScale(logScale);
    this.eventLog.setDepth(layout.isMobile ? 80 : 10);
  }

  if (this.previewPanelBackground) {
    this.previewPanelBackground.setPosition(previewArea.centerX, previewArea.centerY);
    this.previewPanelBackground.setSize(previewArea.width, previewArea.height);
    this.previewPanelBackground.setVisible(!layout.isMobile || this.isMobileEventLogVisible);
    this.previewPanelBackground.setDepth(layout.isMobile ? 78 : 8);
  }
  if (this.previewPanelLabel) {
    this.previewPanelLabel.setPosition(previewArea.centerX, previewArea.centerY - previewArea.height * 0.4);
    this.previewPanelLabel.setVisible(!layout.isMobile || this.isMobileEventLogVisible);
    this.previewPanelLabel.setFontSize(12 * layout.panelScale);
    this.previewPanelLabel.setDepth(layout.isMobile ? 79 : 9);
  }
}

/**
 * Updates right panel positions (clocks, stopwatches, energy, toggles)
 * Elements are stacked vertically with consistent spacing
 *
 * @param layout - Current layout calculations
 */
export function positionRightPanel(this: GameScene, layout: GameLayout): void {
  const baseScale = layout.panelScale;
  const rightX = layout.sections.rightPanel.centerX;
  const baseGap = 10;

  if (layout.isMobile) {
    this.opponentClock?.setVisible(false);
    this.opponentStopwatch?.setVisible(false);
    this.opponentEnergyBar?.setVisible(false);
    this.opponentDisturbCounter?.setVisible(false);
    this.opponentFocusDisturb?.setVisible(false);
    this.playerClock?.setVisible(false);
    this.playerStopwatch?.setVisible(false);
    this.energyBar?.setVisible(false);
    this.playerDisturbCounter?.setVisible(false);
    this.playerFocusDisturb?.setVisible(false);
    this.controlledSquaresButton?.setVisible(false);
    this.rightPanelTopBackdrop?.setVisible(false);
    this.rightPanelMiddleBackdrop?.setVisible(false);
    this.rightPanelBottomBackdrop?.setVisible(false);
    this.rightPanelTopTint?.setVisible(false);
    this.rightPanelMiddleTint?.setVisible(false);
    this.rightPanelBottomTint?.setVisible(false);
    return;
  }

  const topSection = layout.sections.rightPanelTop;
  const middleSection = layout.sections.rightPanelMiddle;
  const bottomSection = layout.sections.rightPanelBottom;

  this.rightPanelTopBackdrop?.setVisible(true);
  this.rightPanelMiddleBackdrop?.setVisible(true);
  this.rightPanelBottomBackdrop?.setVisible(true);
  this.rightPanelTopTint?.setVisible(true);
  this.rightPanelMiddleTint?.setVisible(true);
  this.rightPanelBottomTint?.setVisible(true);

  if (this.rightPanelTopBackdrop) {
    this.rightPanelTopBackdrop.setPosition(topSection.centerX, topSection.centerY);
    this.rightPanelTopBackdrop.setSize(topSection.width, topSection.height);
  }
  if (this.rightPanelMiddleBackdrop) {
    this.rightPanelMiddleBackdrop.setPosition(middleSection.centerX, middleSection.centerY);
    this.rightPanelMiddleBackdrop.setSize(middleSection.width, middleSection.height);
  }
  if (this.rightPanelBottomBackdrop) {
    this.rightPanelBottomBackdrop.setPosition(bottomSection.centerX, bottomSection.centerY);
    this.rightPanelBottomBackdrop.setSize(bottomSection.width, bottomSection.height);
  }

  if (this.rightPanelTopTint) {
    this.rightPanelTopTint.setPosition(topSection.centerX, topSection.centerY);
    this.rightPanelTopTint.setSize(topSection.width, topSection.height);
  }
  if (this.rightPanelMiddleTint) {
    this.rightPanelMiddleTint.setPosition(middleSection.centerX, middleSection.centerY);
    this.rightPanelMiddleTint.setSize(middleSection.width, middleSection.height);
  }
  if (this.rightPanelBottomTint) {
    this.rightPanelBottomTint.setPosition(bottomSection.centerX, bottomSection.centerY);
    this.rightPanelBottomTint.setSize(bottomSection.width, bottomSection.height);
  }

  const layoutStack = (
    components: Array<{ component: { setVisible: (visible: boolean) => void; setPosition: (x: number, y: number) => void; setScale: (scale: number) => void; getDimensions: () => { height: number } } | null }>,
    section: { y: number; height: number }
  ): number => {
    const active = components
      .map(({ component }) => component)
      .filter((component): component is NonNullable<typeof component> => !!component);
    if (active.length === 0) {
      return baseScale;
    }

    const baseTotal = active.reduce((sum, component) => sum + component.getDimensions().height, 0)
      + baseGap * (active.length - 1);
    const availableHeight = section.height * 0.84;
    const baseStackHeight = baseTotal * baseScale;
    const scaleFactor = availableHeight > 0 ? (availableHeight / baseStackHeight) : 1;
    const scale = baseScale * Math.min(1.4, Math.max(0.85, scaleFactor));
    const gap = baseGap * scale;
    const stackHeight = baseTotal * scale;
    let y = section.y + (section.height - stackHeight) / 2;

    for (const component of active) {
      const itemHeight = component.getDimensions().height * scale;
      y += itemHeight / 2;
      component.setVisible(true);
      component.setPosition(rightX, y);
      component.setScale(scale);
      y += itemHeight / 2 + gap;
    }

    return scale;
  };

  const topScale = layoutStack([
    { component: this.opponentClock },
    { component: this.opponentStopwatch },
    { component: this.opponentEnergyBar },
    { component: this.opponentDisturbCounter },
    { component: this.opponentFocusDisturb }
  ], topSection);

  const midScale = layoutStack([
    { component: this.playerClock },
    { component: this.playerStopwatch },
    { component: this.energyBar },
    { component: this.playerDisturbCounter },
    { component: this.playerFocusDisturb }
  ], middleSection);

  if (this.controlledSquaresButton) {
    this.controlledSquaresButton.setVisible(true);
    this.controlledSquaresButton.setPosition(rightX, bottomSection.centerY);
    const buttonScale = Math.min(topScale, midScale) * 0.7;
    this.controlledSquaresButton.setData('baseScale', buttonScale);
    this.controlledSquaresButton.setScale(buttonScale);
  }
}

/**
 * Updates mobile info bars positions and visibility
 *
 * @param layout - Current layout calculations
 */
export function positionMobileBars(this: GameScene, layout: GameLayout): void {
  if (!this.mobileTopBar || !this.mobileBottomBar) return;

  const showBars = layout.isMobile;
  this.mobileTopBar.setVisible(showBars);
  this.mobileBottomBar.setVisible(showBars);

  if (!showBars) {
    return;
  }

  const topBounds = layout.sections.mobileTopBar;
  const bottomBounds = layout.sections.mobileBottomBar;
  const scale = layout.panelScale;
  const iconSize = 16 * scale;
  const padding = 8 * scale;
  const gap = 10 * scale;

  this.mobileTopBar.setPosition(topBounds.centerX, topBounds.centerY);
  this.mobileBottomBar.setPosition(bottomBounds.centerX, bottomBounds.centerY);

  if (this.mobileTopBarBackground) {
    this.mobileTopBarBackground.setPosition(0, 0);
    this.mobileTopBarBackground.setSize(topBounds.width, topBounds.height);
  }
  if (this.mobileBottomBarBackground) {
    this.mobileBottomBarBackground.setPosition(0, 0);
    this.mobileBottomBarBackground.setSize(bottomBounds.width, bottomBounds.height);
  }

  let topX = -topBounds.width / 2 + padding;
  const topY = 0;
  if (this.mobileTopNameText) {
    this.mobileTopNameText.setFontSize(12 * scale);
    this.mobileTopNameText.setPosition(topX, topY);
    topX += this.mobileTopNameText.width + gap;
  }
  topX = layoutMobileStatRow(this, topX, topY, iconSize, gap, 'top');

  let bottomX = -bottomBounds.width / 2 + padding;
  const bottomY = 0;
  if (this.mobileBottomNameText) {
    this.mobileBottomNameText.setFontSize(12 * scale);
    this.mobileBottomNameText.setPosition(bottomX, bottomY);
    bottomX += this.mobileBottomNameText.width + gap;
  }
  bottomX = layoutMobileStatRow(this, bottomX, bottomY, iconSize, gap, 'bottom');

  const buttonScale = Math.max(0.3, scale * 0.55);
  const buttonPadding = 6 * scale;
  const rightEdge = bottomBounds.width / 2 - buttonPadding;
  if (this.mobileEventLogButton) {
    this.mobileEventLogButton.setData('baseScale', buttonScale);
    this.mobileEventLogButton.setScale(buttonScale);
    const bounds = this.mobileEventLogButton.getBounds();
    this.mobileEventLogButton.setPosition(rightEdge - bounds.width / 2, bottomY);
  }
  if (this.mobileControlledSquaresButton) {
    this.mobileControlledSquaresButton.setData('baseScale', buttonScale);
    this.mobileControlledSquaresButton.setScale(buttonScale);
    const bounds = this.mobileControlledSquaresButton.getBounds();
    const offset = this.mobileEventLogButton ? (this.mobileEventLogButton.getBounds().width + buttonPadding) : 0;
    this.mobileControlledSquaresButton.setPosition(rightEdge - offset - bounds.width / 2, bottomY);
  }
}

function layoutMobileStatRow(
  scene: GameScene,
  startX: number,
  centerY: number,
  iconSize: number,
  gap: number,
  side: 'top' | 'bottom'
): number {
  const iconGap = 4 * (scene.currentLayout?.panelScale ?? 1);
  const clockIcon = side === 'top' ? scene.mobileTopClockIcon : scene.mobileBottomClockIcon;
  const clockText = side === 'top' ? scene.mobileTopClockText : scene.mobileBottomClockText;
  const stopwatchIcon = side === 'top' ? scene.mobileTopStopwatchIcon : scene.mobileBottomStopwatchIcon;
  const stopwatchText = side === 'top' ? scene.mobileTopStopwatchText : scene.mobileBottomStopwatchText;
  const energyIcon = side === 'top' ? scene.mobileTopEnergyIcon : scene.mobileBottomEnergyIcon;
  const energyText = side === 'top' ? scene.mobileTopEnergyText : scene.mobileBottomEnergyText;
  const disturbIcon = side === 'top' ? scene.mobileTopDisturbIcon : scene.mobileBottomDisturbIcon;
  const disturbText = side === 'top' ? scene.mobileTopDisturbText : scene.mobileBottomDisturbText;

  let x = startX;
  const place = (icon?: Phaser.GameObjects.Image | null, text?: Phaser.GameObjects.Text | null): void => {
    if (icon) {
      icon.setDisplaySize(iconSize, iconSize);
      icon.setPosition(x + iconSize / 2, centerY);
    }
    if (text) {
      text.setFontSize(12 * (scene.currentLayout?.panelScale ?? 1));
      const textX = x + iconSize + iconGap;
      text.setPosition(textX, centerY);
      x = textX + text.width + gap;
    } else {
      x += iconSize + gap;
    }
  };

  place(clockIcon, clockText);
  place(stopwatchIcon, stopwatchText);
  place(energyIcon, energyText);
  place(disturbIcon, disturbText);

  return x;
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
  const topCardScale = 0.75 * scale;
  const labelSize = 11 * scale;
  const countSize = 12 * scale;

  layoutPileStack(this.opponentDeckStack, leftX, layout.opponentDeckY, deckScale, this.opponentDeckCount, 1);
  if (this.opponentDeckLabelText) {
    this.opponentDeckLabelText.setPosition(leftX, layout.opponentDeckY - 60 * scale);
    this.opponentDeckLabelText.setFontSize(labelSize);
  }
  if (this.opponentDeckCountText) {
    this.opponentDeckCountText.setPosition(leftX, layout.opponentDeckY + 55 * scale);
    this.opponentDeckCountText.setFontSize(countSize);
  }

  layoutPileStack(this.opponentDiscardStack, leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount, 1);
  if (this.opponentDiscardTopCard) {
    this.opponentDiscardTopCard.setPosition(leftX, layout.opponentDiscardY - 60 * scale);
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

  const localDiscardCount = this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).discard.length : 0;
  layoutPileStack(this.playerDiscardStack, leftX, layout.playerDiscardY, deckScale, localDiscardCount, 1);
  if (this.playerDiscardTopCard) {
    this.playerDiscardTopCard.setPosition(leftX, layout.playerDiscardY);
    this.playerDiscardTopCard.setScale(topCardScale);
  }
  if (this.playerDiscardLabelText) {
    this.playerDiscardLabelText.setPosition(leftX, layout.playerDiscardY - 0 * scale);
    this.playerDiscardLabelText.setFontSize(labelSize);
  }
  if (this.playerDiscardCountText) {
    this.playerDiscardCountText.setPosition(leftX, layout.playerDiscardY + 55 * scale);
    this.playerDiscardCountText.setFontSize(countSize);
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
 * Constrains hand within topBar section
 *
 * @param layout - Current layout calculations
 */
export function positionOpponentHand(this: GameScene, layout: GameLayout): void {
  if (!this.opponentHandContainer) return;
  
  const section = layout.sections.topBar;
  const visibleHeight = section.height;
  const maskY = section.y + section.height - visibleHeight;
  this.opponentHandContainer.setPosition(section.centerX, maskY - visibleHeight * 1.2);
  
  this.opponentHandLabelText.setPosition(section.centerX, section.y + section.height * 0.85);
  this.opponentHandLabelText.setFontSize(12 * layout.panelScale);
  this.opponentHandCountText.setPosition(section.centerX, section.y + section.height * 0.95);
  this.opponentHandCountText.setFontSize(12 * layout.panelScale);

  updateOpponentHandDisplay.call(this, this.opponentHandCount);
}

/**
 * Updates opponent hand card display with fan layout
 * Cards are displayed face-down, constrained to topBar section
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

  const section = layout.sections.topBar;
  
  // Calculate scale to fit cards within section
  const baseCardHeight = 140;
  const baseCardWidth = 100;
  const availableHeight = section.height * 0.9;
  const scaleForHeight = availableHeight / baseCardHeight;
  
  const overlapFactor = 0.3;
  const totalWidthNeeded = baseCardWidth + (displayCount - 1) * baseCardWidth * overlapFactor;
  const availableWidth = section.width * 0.8;
  const scaleForWidth = availableWidth / totalWidthNeeded;
  
  const scale = Math.min(scaleForHeight, scaleForWidth, 0.2);
  
  const spacing = baseCardWidth * scale * overlapFactor;
  const totalWidth = spacing * (displayCount - 1);
  const startX = -totalWidth / 2;
  const maxTilt = Math.min(0.3, displayCount * 0.05);
  const arcDepth = section.height * 0.08;

  for (let i = 0; i < displayCount; i++) {
    const t = displayCount === 1 ? 0.5 : i / Math.max(1, displayCount - 1);
    const angle = maxTilt - t * maxTilt * 2;
    const arcOffset = Math.abs(angle) * arcDepth;
    const card = this.add.image(startX + i * spacing, arcOffset, 'card_back');
    card.setScale(scale);
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
 * Constrains hand within bottomBar section
 *
 * @param layout - Current layout calculations
 */
export function positionCardHand(this: GameScene, layout: GameLayout): void {
  if (!this.cardHand) return;
  
  const section = layout.sections.bottomBar;
  const usableHeight = section.height;
  this.cardHand.setSectionSize(
    section.centerX,
    section.centerY + 50,
    section.width,
    usableHeight
  );
  
  this.cardHand.setScale(1);
  this.cardHand.setHandScale(layout.handScale);
  this.cardHand.setPreviewPosition(layout.previewX, layout.previewY);
  this.cardHand.setPreviewEnabled(!layout.isMobile);
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

  // Remove any existing mask
  if (this.playerHandMask) {
    this.cardHand.getContainer().clearMask();
    this.playerHandMask.destroy();
    this.playerHandMask = undefined;
  }
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
 * Updates the persistent turn overlay across the board
 *
 * @param layout - Current layout calculations
 */
export function positionTurnOverlay(this: GameScene, layout: GameLayout): void {
  if (!this.turnOverlayRect || !this.turnOverlayText) return;
  const overlayY = this.boardTopLeft.y + this.boardSquareSize * 3;
  const overlayHeight = this.boardSquareSize * 2;
  const overlayWidth = layout.boardSize;

  this.turnOverlayRect.setPosition(this.boardTopLeft.x, overlayY);
  this.turnOverlayRect.setSize(overlayWidth, overlayHeight);
  this.turnOverlayText.setPosition(this.boardTopLeft.x + overlayWidth / 2, overlayY + overlayHeight / 2);
  this.turnOverlayText.setFontSize(28 * layout.panelScale);
}

/**
 * Updates all overlay positions (mulligan, discard, connection, viewer)
 *
 * @param layout - Current layout calculations
 */
export function positionOverlays(this: GameScene, layout: GameLayout): void {
  const { width, height } = layout;

  const overlayWidth = layout.boardSize;
  const overlayHeight = this.boardSquareSize * 2;
  const overlayX = this.boardTopLeft.x + overlayWidth / 2;
  const overlayY = this.boardTopLeft.y + this.boardSquareSize * 3 + overlayHeight / 2;

  if (this.mulliganBannerRect) {
    this.mulliganBannerRect.setPosition(overlayX, overlayY);
    this.mulliganBannerRect.setSize(overlayWidth, overlayHeight);
  }
  if (this.mulliganTitleText) {
    this.mulliganTitleText.setPosition(overlayX, overlayY - overlayHeight * 0.18);
    this.mulliganTitleText.setFontSize(28 * layout.panelScale);
  }
  if (this.mulliganButton) {
    this.mulliganButton.setPosition(overlayX - 160 * layout.panelScale, overlayY + overlayHeight * 0.18);
    this.mulliganButton.setData('baseScale', layout.panelScale * 0.8);
    this.mulliganButton.setScale(layout.panelScale * 0.8);
  }
  if (this.readyButton) {
    this.readyButton.setPosition(overlayX + 160 * layout.panelScale, overlayY + overlayHeight * 0.18);
    this.readyButton.setData('baseScale', layout.panelScale * 0.8);
    this.readyButton.setScale(layout.panelScale * 0.8);
  }

  if (this.gameEndBannerRect) {
    this.gameEndBannerRect.setPosition(overlayX, overlayY);
    this.gameEndBannerRect.setSize(overlayWidth, overlayHeight);
  }
  if (this.gameEndBannerText) {
    this.gameEndBannerText.setPosition(overlayX, overlayY - overlayHeight * 0.18);
    this.gameEndBannerText.setFontSize(30 * layout.panelScale);
  }
  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.setPosition(overlayX - 180 * layout.panelScale, overlayY + overlayHeight * 0.18);
    this.gameEndRematchButton.setData('baseScale', layout.panelScale * 0.8);
    this.gameEndRematchButton.setScale(layout.panelScale * 0.8);
  }
  if (this.gameEndMenuButton) {
    this.gameEndMenuButton.setPosition(overlayX + 180 * layout.panelScale, overlayY + overlayHeight * 0.18);
    this.gameEndMenuButton.setData('baseScale', layout.panelScale * 0.8);
    this.gameEndMenuButton.setScale(layout.panelScale * 0.8);
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

  if (this.promotionOverlay && this.pendingPromotion) {
    this.showPromotionPicker(this.pendingPromotion.from, this.pendingPromotion.to, this.pendingPromotion.color);
  }

  if (this.interactionBlockersActive) {
    this.refreshInteractionBlockers();
  }
}
