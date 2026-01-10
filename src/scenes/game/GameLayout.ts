/**
 * @fileoverview Layout calculation functions for GameScene
 * 
 * Handles responsive layout calculations for all UI elements.
 * 
 * @module scenes/game/GameLayout
 */

import { LOG_WIDTH } from '../../components/EventLog';
import { GameLayout } from './GameTypes';
import {
  BASE_BOARD_SIZE,
  BASE_LEFT_PANEL_WIDTH,
  BASE_RIGHT_PANEL_WIDTH,
  BASE_TOP_ZONE_HEIGHT,
  BASE_BOTTOM_ZONE_HEIGHT,
  BASE_PADDING,
  REF_WIDTH,
  REF_HEIGHT
} from './GameConstants';

/**
 * Calculates responsive layout positions for all UI elements
 * 
 * Algorithm:
 * 1. Calculate base scale from reference resolution (1920x1080)
 * 2. Determine panel widths and zone heights
 * 3. Calculate board size to fit available space
 * 4. Position all elements relative to board center
 * 
 * @param width - Screen width
 * @param height - Screen height
 * @returns Layout object with all calculated positions
 */
export function calculateLayout(width: number, height: number): GameLayout {
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
