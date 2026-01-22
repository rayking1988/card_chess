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
import { getPileTopPosition, layoutPileStack } from './GameUIHelpers';
import { scaleBackgroundToCover } from './GameSceneBackground';
import { updateDebugOverlays } from './GameSceneDebug';
import {
  positionTurnBanner,
  positionTurnOverlay,
  positionOverlays
} from './GameSceneLayoutOverlays';
import {
  LEFT_PANEL_LAYOUT,
  RIGHT_PANEL_LAYOUT,
  MOBILE_BAR_LAYOUT,
  OPPONENT_HAND_LAYOUT,
  CARD_HAND_LAYOUT,
  NAMEPLATE
} from '../../config';

export { positionTurnBanner, positionTurnOverlay, positionOverlays } from './GameSceneLayoutOverlays';

/**
 * Handles window resize - repositions all UI elements
 */
export function handleResize(this: GameScene): void {
  const { width, height } = this.scale;
  const wasMobile = this.currentLayout?.isMobile ?? false;

  // Recalculate layout
  const layout = calculateLayout(width, height);
  if (layout.isMobile && !wasMobile) {
    this.isMobileEventLogVisible = false;
  }
  this.currentLayout = layout;
  this.cameras.main.roundPixels = layout.isMobile;

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
    // Position at top of log area (account for scaled height, origin is center)
    const scaledHeight = logDims.height * logScale;
    const topY = logArea.y + scaledHeight / 2 + 5; // 5px padding from top
    this.eventLog.setPosition(logArea.centerX, topY);
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
  const baseGap = RIGHT_PANEL_LAYOUT.BASE_GAP;

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
    this.offerDrawButton?.setVisible(false);
    this.resignButton?.setVisible(false);
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
    const availableHeight = section.height * RIGHT_PANEL_LAYOUT.AVAILABLE_HEIGHT_FACTOR;
    const baseStackHeight = baseTotal * baseScale;
    const scaleFactor = availableHeight > 0 ? (availableHeight / baseStackHeight) : 1;
    const scale = baseScale * Math.min(RIGHT_PANEL_LAYOUT.MAX_SCALE_FACTOR, Math.max(RIGHT_PANEL_LAYOUT.MIN_SCALE_FACTOR, scaleFactor));
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
  

  const buttonScale = Math.min(topScale, midScale) * RIGHT_PANEL_LAYOUT.BUTTON_SCALE_FACTOR;
  
  // Layout: Offer Draw and Resign on top row, Controlled Squares below
  const buttonSectionTopY = bottomSection.centerY - bottomSection.height/2;
  const buttonGap = (this.controlledSquaresButton.height) * buttonScale;

  // Controlled Squares
  if (this.controlledSquaresButton) {
    this.controlledSquaresButton.setVisible(true);
    this.controlledSquaresButton.setData('baseScale', buttonScale);
    this.controlledSquaresButton.setScale(buttonScale);
    this.controlledSquaresButton.setPosition(rightX, buttonSectionTopY);
  }
  
  // Offer Draw
  if (this.offerDrawButton) {
    this.offerDrawButton.setVisible(true);
    this.offerDrawButton.setData('baseScale', buttonScale);
    this.offerDrawButton.setScale(buttonScale);
    this.offerDrawButton.setPosition(rightX, buttonSectionTopY + buttonGap);
  }

  // Resign
  if (this.resignButton) {
    this.resignButton.setVisible(true);
    this.resignButton.setData('baseScale', buttonScale);
    this.resignButton.setScale(buttonScale);
    this.resignButton.setPosition(rightX, buttonSectionTopY + buttonGap * 2);
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
  const scale = Math.min(layout.panelScale * MOBILE_BAR_LAYOUT.SCALE_BOOST, MOBILE_BAR_LAYOUT.MAX_SCALE);
  const iconSize = MOBILE_BAR_LAYOUT.ICON_SIZE * scale;
  const padding = MOBILE_BAR_LAYOUT.PADDING * scale;
  const gap = MOBILE_BAR_LAYOUT.GAP * scale;
  const modeIconSize = iconSize * MOBILE_BAR_LAYOUT.MODE_ICON_SCALE;

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

  // Top bar: single row layout
  let topX = -topBounds.width / 2 + padding;
  const topY = 0;
  if (this.mobileTopNameText) {
    this.mobileTopNameText.setFontSize(MOBILE_BAR_LAYOUT.ICON_SIZE * scale * 0.8);
    this.mobileTopNameText.setPosition(topX, topY);
    topX += this.mobileTopNameText.width + gap;
  }
  topX = layoutMobileCountRow(this, topX, topY, iconSize, gap, 'top');
  topX = layoutMobileStatRow(this, topX, topY, iconSize, gap, 'top');

  // Bottom bar: three-row layout
  // Row 1: Deck / Discard / Hand / Clock / Stopwatch
  const rowHeight = bottomBounds.height / 3;
  const row1Y = -rowHeight;
  let row1X = -bottomBounds.width / 2 + padding;
  row1X = layoutMobileCountRow(this, row1X, row1Y, iconSize, gap, 'bottom');
  row1X = layoutMobileTimeRow(this, row1X, row1Y, iconSize, gap, 'bottom');

  // Row 2: Energy / Disturb / Mode switch
  const row2Y = 0;
  let row2X = -bottomBounds.width / 2 + padding;
  row2X = layoutMobileEnergyRow(this, row2X, row2Y, iconSize, gap, 'bottom');
  layoutMobileModeSwitch(this, row2X, row2Y, modeIconSize, gap);

  // Row 3: Buttons (Offer Draw, Ctrl Squares, Event Log, Resign)
  const row3Y = rowHeight;
  const buttonScale = Math.max(MOBILE_BAR_LAYOUT.MIN_BUTTON_SCALE, scale * MOBILE_BAR_LAYOUT.BUTTON_SCALE);
  const buttonPadding = MOBILE_BAR_LAYOUT.BUTTON_PADDING * scale;
  
  // Calculate button positions - distribute evenly across the width
  const buttons = [
    this.mobileOfferDrawButton,
    this.mobileControlledSquaresButton,
    this.mobileEventLogButton,
    this.mobileResignButton
  ].filter((button): button is Phaser.GameObjects.Container => !!button);
  
  if (buttons.length > 0) {
    const totalWidth = bottomBounds.width - buttonPadding * 2;
    const maxButtonWidth = Math.max(
      1,
      ...buttons.map((button) => button.width || button.getBounds().width)
    );
    const maxButtonHeight = Math.max(
      1,
      ...buttons.map((button) => button.height || button.getBounds().height)
    );
    const maxScaleForWidth = totalWidth / (buttons.length * maxButtonWidth);
    const maxScaleForHeight = rowHeight / maxButtonHeight;
    const finalScale = Math.max(
      MOBILE_BAR_LAYOUT.MIN_BUTTON_SCALE,
      Math.min(buttonScale, maxScaleForWidth, maxScaleForHeight)
    );
    const buttonSpacing = totalWidth / buttons.length;
    const startX = -bottomBounds.width / 2 + buttonPadding + buttonSpacing / 2;
    
    buttons.forEach((button, index) => {
      button.setData('baseScale', finalScale);
      button.setScale(finalScale);
      button.setPosition(startX + index * buttonSpacing, row3Y);
    });
  }
}

function setIconSize(icon: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle, size: number): void {
  if (icon instanceof Phaser.GameObjects.Image) {
    const baseWidth = Math.max(1, icon.width);
    const baseHeight = Math.max(1, icon.height);
    const scale = size / Math.max(baseWidth, baseHeight);
    icon.setScale(scale);
  } else {
    icon.setSize(size, size);
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
  const scale = iconSize / MOBILE_BAR_LAYOUT.ICON_SIZE;
  const iconGap = MOBILE_BAR_LAYOUT.ICON_GAP * scale;
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
      setIconSize(icon, iconSize);
      icon.setPosition(x + iconSize / 2, centerY);
    }
    if (text) {
      text.setFontSize(iconSize * 0.8);
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

function layoutMobileTimeRow(
  scene: GameScene,
  startX: number,
  centerY: number,
  iconSize: number,
  gap: number,
  side: 'top' | 'bottom'
): number {
  const scale = iconSize / MOBILE_BAR_LAYOUT.ICON_SIZE;
  const iconGap = MOBILE_BAR_LAYOUT.ICON_GAP * scale;
  const clockIcon = side === 'top' ? scene.mobileTopClockIcon : scene.mobileBottomClockIcon;
  const clockText = side === 'top' ? scene.mobileTopClockText : scene.mobileBottomClockText;
  const stopwatchIcon = side === 'top' ? scene.mobileTopStopwatchIcon : scene.mobileBottomStopwatchIcon;
  const stopwatchText = side === 'top' ? scene.mobileTopStopwatchText : scene.mobileBottomStopwatchText;

  let x = startX;
  const place = (icon?: Phaser.GameObjects.Image | null, text?: Phaser.GameObjects.Text | null): void => {
    if (icon) {
      setIconSize(icon, iconSize);
      icon.setPosition(x + iconSize / 2, centerY);
    }
    if (text) {
      text.setFontSize(iconSize * 0.8);
      const textX = x + iconSize + iconGap;
      text.setPosition(textX, centerY);
      x = textX + text.width + gap;
    } else {
      x += iconSize + gap;
    }
  };

  place(clockIcon, clockText);
  place(stopwatchIcon, stopwatchText);

  return x;
}

function layoutMobileEnergyRow(
  scene: GameScene,
  startX: number,
  centerY: number,
  iconSize: number,
  gap: number,
  side: 'top' | 'bottom'
): number {
  const scale = iconSize / MOBILE_BAR_LAYOUT.ICON_SIZE;
  const iconGap = MOBILE_BAR_LAYOUT.ICON_GAP * scale;
  const energyIcon = side === 'top' ? scene.mobileTopEnergyIcon : scene.mobileBottomEnergyIcon;
  const energyText = side === 'top' ? scene.mobileTopEnergyText : scene.mobileBottomEnergyText;
  const disturbIcon = side === 'top' ? scene.mobileTopDisturbIcon : scene.mobileBottomDisturbIcon;
  const disturbText = side === 'top' ? scene.mobileTopDisturbText : scene.mobileBottomDisturbText;

  let x = startX;
  const place = (icon?: Phaser.GameObjects.Image | null, text?: Phaser.GameObjects.Text | null): void => {
    if (icon) {
      setIconSize(icon, iconSize);
      icon.setPosition(x + iconSize / 2, centerY);
    }
    if (text) {
      text.setFontSize(iconSize * 0.8);
      const textX = x + iconSize + iconGap;
      text.setPosition(textX, centerY);
      x = textX + text.width + gap;
    } else {
      x += iconSize + gap;
    }
  };

  place(energyIcon, energyText);
  place(disturbIcon, disturbText);

  return x;
}

function layoutMobileCountRow(
  scene: GameScene,
  startX: number,
  centerY: number,
  iconSize: number,
  gap: number,
  side: 'top' | 'bottom'
): number {
  const scale = iconSize / MOBILE_BAR_LAYOUT.ICON_SIZE;
  const iconGap = MOBILE_BAR_LAYOUT.ICON_GAP * scale;
  const deckIcon = side === 'top' ? scene.mobileTopDeckIcon : scene.mobileBottomDeckIcon;
  const deckText = side === 'top' ? scene.mobileTopDeckText : scene.mobileBottomDeckText;
  const discardIcon = side === 'top' ? scene.mobileTopDiscardIcon : scene.mobileBottomDiscardIcon;
  const discardText = side === 'top' ? scene.mobileTopDiscardText : scene.mobileBottomDiscardText;
  const handIcon = side === 'top' ? scene.mobileTopHandIcon : scene.mobileBottomHandIcon;
  const handText = side === 'top' ? scene.mobileTopHandText : scene.mobileBottomHandText;

  let x = startX;
  const place = (
    icon?: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle | null,
    text?: Phaser.GameObjects.Text | null
  ): void => {
    if (icon) {
      setIconSize(icon, iconSize);
      icon.setPosition(x + iconSize / 2, centerY);
    }
    if (text) {
      text.setFontSize(iconSize * 0.7);
      const textX = x + iconSize + iconGap;
      text.setPosition(textX, centerY);
      x = textX + text.width + gap;
    } else {
      x += iconSize + gap;
    }
  };

  place(deckIcon, deckText);
  place(discardIcon, discardText);
  place(handIcon, handText);

  return x;
}

function layoutMobileModeSwitch(
  scene: GameScene,
  startX: number,
  centerY: number,
  iconSize: number,
  gap: number
): number {
  const baseIconSize = iconSize / MOBILE_BAR_LAYOUT.MODE_ICON_SCALE;
  const scale = baseIconSize / MOBILE_BAR_LAYOUT.ICON_SIZE;
  const iconGap = MOBILE_BAR_LAYOUT.ICON_GAP * scale;
  if (scene.mobileBottomModeText) {
    scene.mobileBottomModeText.setFontSize(baseIconSize * 0.7);
    scene.mobileBottomModeText.setPosition(startX, centerY);
    const textWidth = scene.mobileBottomModeText.width;
    if (scene.mobileBottomModeIcon) {
      setIconSize(scene.mobileBottomModeIcon, iconSize);
      scene.mobileBottomModeIcon.setPosition(startX + textWidth + iconGap + iconSize / 2, centerY);
      return startX + textWidth + iconGap + iconSize + gap;
    }
    return startX + textWidth + gap;
  }
  if (scene.mobileBottomModeIcon) {
    setIconSize(scene.mobileBottomModeIcon, iconSize);
    scene.mobileBottomModeIcon.setPosition(startX + iconSize / 2, centerY);
    return startX + iconSize + gap;
  }
  return startX;
}

/**
 * Updates left panel positions (deck and discard piles)
 * Includes visual stack effect based on card counts
 *
 * @param layout - Current layout calculations
 */
export function positionLeftPanel(this: GameScene, layout: GameLayout): void {
  if (layout.isMobile) {
    this.opponentDeckStack?.forEach((card) => card.setVisible(false));
    this.opponentDiscardStack?.forEach((card) => card.setVisible(false));
    this.playerDeckStack?.forEach((card) => card.setVisible(false));
    this.playerDiscardStack?.forEach((card) => card.setVisible(false));
    this.opponentDeckCountText?.setVisible(false);
    this.opponentDiscardCountText?.setVisible(false);
    this.playerDeckCountText?.setVisible(false);
    this.playerDiscardCountText?.setVisible(false);
    this.opponentDeckLabelText?.setVisible(false);
    this.opponentDiscardLabelText?.setVisible(false);
    this.playerDeckLabelText?.setVisible(false);
    this.playerDiscardLabelText?.setVisible(false);
    // Hide discard top cards in mobile view
    this.opponentDiscardTopCard?.setVisible(false);
    this.playerDiscardTopCard?.setVisible(false);
    return;
  }

  const scale = layout.panelScale;
  const leftX = layout.leftPanelX;
  const deckScale = LEFT_PANEL_LAYOUT.DECK_SCALE * scale;
  const topCardScale = LEFT_PANEL_LAYOUT.TOP_CARD_SCALE * scale;
  const labelSize = LEFT_PANEL_LAYOUT.LABEL_FONT_SIZE * scale;
  const countSize = LEFT_PANEL_LAYOUT.COUNT_FONT_SIZE * scale;
  const baseCardHeight = this.opponentDeckStack[0]?.height ?? this.playerDeckStack[0]?.height ?? 0;
  const countYOffset = baseCardHeight * deckScale * 0.38;

  layoutPileStack(this.opponentDeckStack, leftX, layout.opponentDeckY, deckScale, this.opponentDeckCount, 1);
  if (this.opponentDeckLabelText) {
    this.opponentDeckLabelText.setPosition(leftX, layout.opponentDeckY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale);
    this.opponentDeckLabelText.setFontSize(labelSize);
  }
  if (this.opponentDeckCountText) {
    const topPos = getPileTopPosition(leftX, layout.opponentDeckY, deckScale, this.opponentDeckCount);
    this.opponentDeckCountText.setPosition(topPos.x, topPos.y + countYOffset);
    this.opponentDeckCountText.setFontSize(countSize);
  }

  layoutPileStack(this.opponentDiscardStack, leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount, 1);
  if (this.opponentDiscardTopCard) {
    const topPos = getPileTopPosition(leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount);
    this.opponentDiscardTopCard.setPosition(topPos.x, topPos.y);
    this.opponentDiscardTopCard.setScale(topCardScale);
  }
  if (this.opponentDiscardLabelText) {
    this.opponentDiscardLabelText.setPosition(leftX, layout.opponentDiscardY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale);
    this.opponentDiscardLabelText.setFontSize(labelSize);
  }
  if (this.opponentDiscardCountText) {
    const topPos = getPileTopPosition(leftX, layout.opponentDiscardY, deckScale, this.opponentDiscardCount);
    this.opponentDiscardCountText.setPosition(topPos.x, topPos.y + countYOffset);
    this.opponentDiscardCountText.setFontSize(countSize);
  }

  const localDiscardCount = this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).discard.length : 0;
  layoutPileStack(this.playerDiscardStack, leftX, layout.playerDiscardY, deckScale, localDiscardCount, 1);
  if (this.playerDiscardTopCard) {
    const topPos = getPileTopPosition(leftX, layout.playerDiscardY, deckScale, localDiscardCount);
    this.playerDiscardTopCard.setPosition(topPos.x, topPos.y);
    this.playerDiscardTopCard.setScale(topCardScale);
  }
  if (this.playerDiscardLabelText) {
    this.playerDiscardLabelText.setPosition(leftX, layout.playerDiscardY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale);
    this.playerDiscardLabelText.setFontSize(labelSize);
  }
  if (this.playerDiscardCountText) {
    const topPos = getPileTopPosition(leftX, layout.playerDiscardY, deckScale, localDiscardCount);
    this.playerDiscardCountText.setPosition(topPos.x, topPos.y + countYOffset);
    this.playerDiscardCountText.setFontSize(countSize);
  }

  const localDeckCount = this.gameStateManager ? this.gameStateManager.getPlayer(this.localColor).deck.length : 0;
  layoutPileStack(this.playerDeckStack, leftX, layout.playerDeckY, deckScale, localDeckCount, 1);
  if (this.playerDeckLabelText) {
    this.playerDeckLabelText.setPosition(leftX, layout.playerDeckY - LEFT_PANEL_LAYOUT.LABEL_Y_OFFSET * scale);
    this.playerDeckLabelText.setFontSize(labelSize);
  }
  if (this.playerDeckCountText) {
    const topPos = getPileTopPosition(leftX, layout.playerDeckY, deckScale, localDeckCount);
    this.playerDeckCountText.setPosition(topPos.x, topPos.y + countYOffset);
    this.playerDeckCountText.setFontSize(countSize);
  }

  this.opponentDeckCountText?.setVisible(this.opponentDeckCount > 0);
  this.opponentDiscardCountText?.setVisible(this.opponentDiscardCount > 0);
  this.playerDeckCountText?.setVisible(localDeckCount > 0);
  this.playerDiscardCountText?.setVisible(localDiscardCount > 0);
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
  this.opponentHandContainer.setPosition(section.centerX, section.centerY);
  
  this.opponentHandLabelText.setPosition(section.centerX, section.y + section.height * OPPONENT_HAND_LAYOUT.LABEL_Y_FACTOR);
  this.opponentHandLabelText.setFontSize(LEFT_PANEL_LAYOUT.COUNT_FONT_SIZE * layout.panelScale);
  this.opponentHandCountText.setPosition(section.centerX, section.y + section.height * OPPONENT_HAND_LAYOUT.COUNT_Y_FACTOR);
  this.opponentHandCountText.setFontSize(LEFT_PANEL_LAYOUT.COUNT_FONT_SIZE * layout.panelScale);

  updateOpponentHandDisplay.call(this, this.opponentHandCount);

  if (this.opponentHandCards.length > 0) {
    const bounds = this.opponentHandContainer.getBounds();
    const desiredBottom = section.y + section.height;
    const offset = desiredBottom - bounds.bottom;
    if (Math.abs(offset) > 0.5) {
      this.opponentHandContainer.y += offset;
    }
  }
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
  const baseCardHeight = OPPONENT_HAND_LAYOUT.BASE_CARD_HEIGHT;
  const baseCardWidth = OPPONENT_HAND_LAYOUT.BASE_CARD_WIDTH;
  const availableHeight = section.height * OPPONENT_HAND_LAYOUT.AVAILABLE_HEIGHT_FACTOR;
  const scaleForHeight = availableHeight / baseCardHeight;
  
  const overlapFactor = OPPONENT_HAND_LAYOUT.OVERLAP_FACTOR;
  const totalWidthNeeded = baseCardWidth + (displayCount - 1) * baseCardWidth * overlapFactor;
  const availableWidth = section.width * OPPONENT_HAND_LAYOUT.AVAILABLE_WIDTH_FACTOR;
  const scaleForWidth = availableWidth / totalWidthNeeded;
  
  const scale = Math.min(scaleForHeight, scaleForWidth, OPPONENT_HAND_LAYOUT.MAX_SCALE);
  
  const spacing = baseCardWidth * scale * overlapFactor;
  const totalWidth = spacing * (displayCount - 1);
  const startX = -totalWidth / 2;
  const maxTilt = Math.min(OPPONENT_HAND_LAYOUT.MAX_TILT_LIMIT, displayCount * OPPONENT_HAND_LAYOUT.MAX_TILT_FACTOR);
  const arcDepth = section.height * OPPONENT_HAND_LAYOUT.ARC_DEPTH_FACTOR;

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
  const fontSize = NAMEPLATE.FONT_SIZE * layout.panelScale;
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
  const centerYOffset = layout.isMobile ? CARD_HAND_LAYOUT.MOBILE_CENTER_Y_OFFSET : CARD_HAND_LAYOUT.CENTER_Y_OFFSET;
  const centerX = section.centerX;
  const centerY = section.centerY + centerYOffset;
  this.cardHand.setSectionSize(centerX, centerY, section.width, usableHeight);

  const fanSpreadFactor = layout.isMobile ? 1.2 : 1;
  const fanArcHeightFactor = layout.isMobile ? 0.26 : 0.2;
  this.cardHand.setFanLayout(fanSpreadFactor, fanArcHeightFactor);
  
  const handScale = layout.isMobile ? Math.max(0.35, layout.handScale * 0.85) : layout.handScale;
  const containerScale = layout.isMobile ? Math.min(1, handScale * 1.2) : 1;
  this.cardHand.setScale(containerScale);
  this.cardHand.getContainer().setPosition(
    (1 - containerScale) * centerX,
    (1 - containerScale) * centerY
  );

  if (layout.isMobile && this.cardHand.getCardCount() > 0) {
    const bounds = this.cardHand.getContainer().getBounds();
    const desiredTop = section.y;
    const offset = desiredTop - bounds.top;
    if (Math.abs(offset) > 0.5) {
      this.cardHand.getContainer().y += offset;
    }
  }
  this.cardHand.setHandScale(handScale);
  this.cardHand.setPreviewPosition(layout.previewX, layout.previewY);
  this.cardHand.setPreviewEnabled(true);
  this.cardHand.setTouchPreviewEnabled(layout.isMobile);
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
  this.cardCountText.setPosition(layout.boardX, layout.boardY + layout.boardSize / 2 + CARD_HAND_LAYOUT.COUNT_Y_OFFSET * layout.panelScale);
  this.cardCountText.setFontSize(CARD_HAND_LAYOUT.COUNT_FONT_SIZE * layout.panelScale);
}
