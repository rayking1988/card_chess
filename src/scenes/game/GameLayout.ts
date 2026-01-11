/**
 * @fileoverview Layout calculation functions for GameScene
 * 
 * Handles responsive layout calculations for all UI elements.
 * Uses a section-based approach where the screen is divided into
 * percentage-based sections with no gaps.
 * 
 * @module scenes/game/GameLayout
 */

import { GameLayout, SectionBounds } from './GameTypes';
import { BASE_BOARD_SIZE } from './GameConstants';

/**
 * Section percentages for layout division
 * These define how the screen is divided into sections
 */
const SECTION_CONFIG = {
  // Horizontal division (must sum to 100%)
  leftPanelWidth: 8,      // Left panel: decks/discards (full height)
  boardWidth: 50,         // Board area (includes top/bottom bars)
  rightPanelWidth: 18,    // Right panel: clocks/energy (full height)
  eventLogWidth: 24,      // Event log (full height)
  
  // Vertical division for board column only
  topBarHeight: 8,        // Opponent hand area (within board width)
  middleHeight: 68,       // Board area
  bottomBarHeight: 24,    // Player hand area (within board width)
};

/**
 * Creates a SectionBounds object from position and size
 */
function createBounds(x: number, y: number, width: number, height: number): SectionBounds {
  return {
    x,
    y,
    width,
    height,
    centerX: x + width / 2,
    centerY: y + height / 2,
  };
}

/**
 * Calculates responsive layout positions for all UI elements
 * 
 * Algorithm:
 * 1. Divide screen into sections by percentage
 * 2. Left panel, right panel, event log span full height
 * 3. Top bar, board, bottom bar share the board column width
 * 4. Compute element positions within their sections
 * 
 * @param width - Screen width
 * @param height - Screen height
 * @returns Layout object with section bounds and element positions
 */
export function calculateLayout(width: number, height: number): GameLayout {
  // Calculate horizontal section widths from percentages
  const leftPanelW = width * (SECTION_CONFIG.leftPanelWidth / 100);
  const boardW = width * (SECTION_CONFIG.boardWidth / 100);
  const rightPanelW = width * (SECTION_CONFIG.rightPanelWidth / 100);
  const eventLogW = width * (SECTION_CONFIG.eventLogWidth / 100);
  
  // Calculate vertical section heights for board column
  const topBarH = height * (SECTION_CONFIG.topBarHeight / 100);
  const middleH = height * (SECTION_CONFIG.middleHeight / 100);
  const bottomBarH = height * (SECTION_CONFIG.bottomBarHeight / 100);
  
  // Left panel, right panel, event log: full height
  const leftPanel = createBounds(0, 0, leftPanelW, height);
  const rightPanel = createBounds(leftPanelW + boardW, 0, rightPanelW, height);
  const eventLog = createBounds(leftPanelW + boardW + rightPanelW, 0, eventLogW, height);
  
  // Board column sections (top bar, board, bottom bar) - share board width
  const boardColumnX = leftPanelW;
  const topBar = createBounds(boardColumnX, 0, boardW, topBarH);
  const board = createBounds(boardColumnX, topBarH, boardW, middleH);
  const bottomBar = createBounds(boardColumnX, topBarH + middleH, boardW, bottomBarH);
  
  const sections = { leftPanel, board, rightPanel, eventLog, topBar, bottomBar };
  
  // Calculate scales based on section sizes
  const baseScale = Math.min(width / 1920, height / 1080);
  const panelScale = Math.max(0.5, Math.min(1.2, baseScale));
  
  // Board size: fit within board section with some padding
  const boardPadding = Math.min(board.width, board.height) * 0.05;
  const maxBoardSize = Math.min(board.width, board.height) - boardPadding * 2;
  const boardSize = Math.min(maxBoardSize, BASE_BOARD_SIZE * 1.5);
  const boardScale = boardSize / BASE_BOARD_SIZE;
  
  // Hand scale based on bottom bar height
  const handScale = Math.max(0.5, Math.min(1.2, bottomBar.height / 250));
  
  // Element positions within sections
  // Board: centered in board section
  const boardX = board.centerX;
  const boardY = board.centerY;
  
  // Left panel elements: vertically distributed
  const leftPanelX = leftPanel.centerX;
  const leftPanelPadding = leftPanel.height * 0.08;
  const pileSpacing = (leftPanel.height - leftPanelPadding * 2) / 4;
  const opponentDeckY = leftPanel.y + leftPanelPadding + pileSpacing * 0.5;
  const opponentDiscardY = leftPanel.y + leftPanelPadding + pileSpacing * 1.5;
  const playerDiscardY = leftPanel.y + leftPanel.height - leftPanelPadding - pileSpacing * 1.5;
  const playerDeckY = leftPanel.y + leftPanel.height - leftPanelPadding - pileSpacing * 0.5;
  
  // Right panel elements: vertically distributed from top
  const rightPanelX = rightPanel.centerX;
  const rightPanelTop = rightPanel.y + rightPanel.height * 0.05;
  
  // Event log: centered in section
  const eventLogX = eventLog.centerX;
  const eventLogY = eventLog.centerY;
  const eventLogWidth = eventLog.width * 0.9;
  
  // Card hand: centered in bottom bar
  const cardHandX = bottomBar.centerX;
  const cardHandY = bottomBar.centerY + bottomBar.height * 0.15;
  
  // Opponent hand: centered in top bar
  const opponentHandX = topBar.centerX;
  const opponentHandY = topBar.centerY - topBar.height * 0.2;
  const opponentHandLabelY = topBar.y + topBar.height * 0.7;
  const opponentHandCountY = opponentHandLabelY + 16 * panelScale;
  
  // Nameplates: above/below board
  const opponentNameX = board.centerX;
  const opponentNameY = board.y + boardPadding;
  const playerNameX = board.centerX;
  const playerNameY = board.y + board.height - boardPadding;
  
  // Preview card: left side of board section
  const previewX = board.x + board.width * 0.1;
  const previewY = board.y + board.height * 0.7;
  
  // Turn banner: above board
  const turnBannerX = board.centerX;
  const turnBannerY = board.y + boardPadding * 2;
  
  // Played card display: left side of board section
  const playedCardX = board.x + board.width * 0.12;
  const playedCardY = board.centerY;
  
  return {
    sections,
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
    cardHandX,
    cardHandY,
    opponentHandX,
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
    padding: boardPadding,
  };
}
