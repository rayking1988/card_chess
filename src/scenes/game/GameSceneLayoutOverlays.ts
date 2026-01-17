/**
 * @fileoverview Overlay positioning helpers for GameScene
 *
 * @module scenes/game/GameSceneLayoutOverlays
 */

import type { GameScene } from '../GameScene';
import type { GameLayout } from './GameTypes';
import { buildDiscardViewerCards, layoutDiscardViewer } from './GameSceneDiscardViewer';
import { getBoardOverlayMetrics, getPreviewOverlayMetrics } from './GameSceneOverlays';
import { OVERLAY_LAYOUT, TURN_OVERLAY } from '../../config';

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
  const overlayY = this.boardTopLeft.y + this.boardSquareSize * OVERLAY_LAYOUT.Y_OFFSET_IN_SQUARES;
  const overlayHeight = this.boardSquareSize * OVERLAY_LAYOUT.HEIGHT_IN_SQUARES;
  const overlayWidth = layout.boardSize;

  this.turnOverlayRect.setPosition(this.boardTopLeft.x, overlayY);
  this.turnOverlayRect.setSize(overlayWidth, overlayHeight);
  this.turnOverlayText.setPosition(this.boardTopLeft.x + overlayWidth / 2, overlayY + overlayHeight / 2);
  this.turnOverlayText.setFontSize(TURN_OVERLAY.OVERLAY_FONT_SIZE * layout.panelScale);
}

/**
 * Updates all overlay positions (mulligan, discard, connection, viewer)
 *
 * @param layout - Current layout calculations
 */
export function positionOverlays(this: GameScene, layout: GameLayout): void {
  const { width, height } = layout;
  const boardOverlay = getBoardOverlayMetrics(this, layout);
  const previewOverlay = getPreviewOverlayMetrics(this, layout);

  if (this.mulliganBannerRect) {
    this.mulliganBannerRect.setPosition(boardOverlay.overlayX, boardOverlay.overlayY);
    this.mulliganBannerRect.setSize(boardOverlay.overlayWidth, boardOverlay.overlayHeight);
  }
  if (this.mulliganTitleText) {
    this.mulliganTitleText.setPosition(
      boardOverlay.overlayX,
      boardOverlay.overlayY - boardOverlay.overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR
    );
    this.mulliganTitleText.setFontSize(OVERLAY_LAYOUT.MULLIGAN_TITLE_FONT_SIZE * layout.panelScale);
  }
  const mulliganButtonOffset = Math.min(OVERLAY_LAYOUT.BUTTON_X_OFFSET * layout.panelScale, previewOverlay.overlayWidth * 0.25);
  const mulliganButtonY = previewOverlay.overlayY + previewOverlay.overlayHeight * OVERLAY_LAYOUT.BUTTON_Y_OFFSET_FACTOR;
  if (this.mulliganButton) {
    this.mulliganButton.setPosition(previewOverlay.overlayX - mulliganButtonOffset, mulliganButtonY);
    this.mulliganButton.setData('baseScale', layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.mulliganButton.setScale(layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
  }
  if (this.readyButton) {
    this.readyButton.setPosition(previewOverlay.overlayX + mulliganButtonOffset, mulliganButtonY);
    this.readyButton.setData('baseScale', layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.readyButton.setScale(layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
  }

  if (this.gameEndBannerRect) {
    this.gameEndBannerRect.setPosition(boardOverlay.overlayX, boardOverlay.overlayY);
    this.gameEndBannerRect.setSize(boardOverlay.overlayWidth, boardOverlay.overlayHeight);
  }
  if (this.gameEndBannerText) {
    this.gameEndBannerText.setPosition(
      boardOverlay.overlayX,
      boardOverlay.overlayY - boardOverlay.overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR
    );
    this.gameEndBannerText.setFontSize(OVERLAY_LAYOUT.GAME_END_TITLE_FONT_SIZE * layout.panelScale);
  }
  const isViewingBoard = this.isViewingBoard === true;
  const gameEndButtonArea = isViewingBoard ? previewOverlay : boardOverlay;
  const gameEndButtonOffset = Math.min(
    OVERLAY_LAYOUT.GAME_END_BUTTON_X_OFFSET * layout.panelScale,
    gameEndButtonArea.overlayWidth * 0.3
  );
  const gameEndButtonY = gameEndButtonArea.overlayY + gameEndButtonArea.overlayHeight * OVERLAY_LAYOUT.BUTTON_Y_OFFSET_FACTOR;
  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.setPosition(gameEndButtonArea.overlayX - gameEndButtonOffset, gameEndButtonY);
    this.gameEndRematchButton.setData('baseScale', layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.gameEndRematchButton.setScale(layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
  }
  if (this.gameEndMenuButton) {
    this.gameEndMenuButton.setPosition(gameEndButtonArea.overlayX + gameEndButtonOffset, gameEndButtonY);
    this.gameEndMenuButton.setData('baseScale', layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.gameEndMenuButton.setScale(layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
  }
  if (this.gameEndViewBoardButton) {
    const viewBoardY = boardOverlay.overlayY + boardOverlay.overlayHeight * 0.35;
    this.gameEndViewBoardButton.setPosition(boardOverlay.overlayX, viewBoardY);
    this.gameEndViewBoardButton.setData('baseScale', layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.gameEndViewBoardButton.setScale(layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR);
    this.gameEndViewBoardButton.setVisible(!isViewingBoard);
  }

  if (this.discardOverlay) {
    // Rectangle uses center origin, so position at center and set size.
    this.discardOverlay.setPosition(width / 2, height / 2);
    this.discardOverlay.setSize(width, height);
  }
  if (this.discardPromptText) {
    this.discardPromptText.setPosition(width / 2, height / 2 - OVERLAY_LAYOUT.DISCARD_PROMPT_Y_OFFSET * layout.panelScale);
    this.discardPromptText.setFontSize(OVERLAY_LAYOUT.DISCARD_PROMPT_FONT_SIZE * layout.panelScale);
  }

  if (this.connectionOverlay && this.connectionOverlayBackground) {
    // Rectangle uses center origin, so position at center and set size.
    this.connectionOverlayBackground.setPosition(width / 2, height / 2);
    this.connectionOverlayBackground.setSize(width, height);
    this.connectionOverlay.setPosition(0, 0);
  }
  if (this.connectionOverlayText) {
    this.connectionOverlayText.setPosition(width / 2, height / 2 - OVERLAY_LAYOUT.CONNECTION_TEXT_Y_OFFSET * layout.panelScale);
    this.connectionOverlayText.setFontSize(24 * layout.panelScale);
  }
  if (this.connectionOverlayButton) {
    this.connectionOverlayButton.setPosition(width / 2, height / 2 + OVERLAY_LAYOUT.CONNECTION_BUTTON_Y_OFFSET * layout.panelScale);
    this.connectionOverlayButton.setData('baseScale', layout.panelScale);
    this.connectionOverlayButton.setScale(layout.panelScale);
  }

  if (this.discardViewer) {
    layoutDiscardViewer.call(this, layout);
    buildDiscardViewerCards.call(this, layout);
  }

  if (this.promotionOverlay && this.pendingPromotion) {
    const pending = this.pendingPromotion;
    this.showPromotionPicker(pending.from, pending.to, pending.color, pending.options, pending.onSelect, pending.title);
  }

  if (this.interactionBlockersActive) {
    this.refreshInteractionBlockers();
  }
}
