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
import { GAME_LAYOUT } from '../../config';

const { SECTION, RIGHT_PANEL_SPLIT, EVENT_LOG_SPLIT_TOP, MOBILE_RATIO_THRESHOLD, BASE_BOARD_SIZE, MOBILE_BAR, MOBILE_PREVIEW } = GAME_LAYOUT;

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
  const isMobile = width / height < MOBILE_RATIO_THRESHOLD;

  const mobileBarHeight = isMobile
    ? Math.max(MOBILE_BAR.MIN_HEIGHT, Math.min(MOBILE_BAR.MAX_HEIGHT, height * MOBILE_BAR.HEIGHT_FACTOR))
    : 0;
  // Bottom bar needs double height for two rows in mobile
  const mobileBottomBarHeight = isMobile ? mobileBarHeight * 2 : 0;

  // Calculate horizontal section widths from percentages
  const leftPanelW = isMobile ? 0 : width * (SECTION.LEFT_PANEL_WIDTH / 100);
  const rightPanelW = isMobile ? 0 : width * (SECTION.RIGHT_PANEL_WIDTH / 100);
  const eventLogW = isMobile ? 0 : width * (SECTION.EVENT_LOG_WIDTH / 100);
  const boardW = width - leftPanelW - rightPanelW - eventLogW;
  
  // Calculate vertical section heights for board column
  const topBarH = height * (SECTION.TOP_BAR_HEIGHT / 100);
  const middleH = height * (SECTION.MIDDLE_HEIGHT / 100);
  const bottomBarH = height * (SECTION.BOTTOM_BAR_HEIGHT / 100);
  
  // Left panel, right panel, event log: full height
  const leftPanel = createBounds(0, 0, leftPanelW, height);
  const rightPanel = createBounds(leftPanelW + boardW, 0, rightPanelW, height);
  const eventLog = createBounds(leftPanelW + boardW + rightPanelW, 0, eventLogW, height);

  const rightPanelTopH = rightPanel.height * RIGHT_PANEL_SPLIT.TOP;
  const rightPanelMiddleH = rightPanel.height * RIGHT_PANEL_SPLIT.MIDDLE;
  const rightPanelBottomH = rightPanel.height - rightPanelTopH - rightPanelMiddleH;
  const rightPanelTop = createBounds(rightPanel.x, rightPanel.y, rightPanel.width, rightPanelTopH);
  const rightPanelMiddle = createBounds(rightPanel.x, rightPanel.y + rightPanelTopH, rightPanel.width, rightPanelMiddleH);
  const rightPanelBottom = createBounds(rightPanel.x, rightPanel.y + rightPanelTopH + rightPanelMiddleH, rightPanel.width, rightPanelBottomH);
  
  // Board column sections (top bar, board, bottom bar) - share board width
  const boardColumnX = leftPanelW;
  let topBarHeight = topBarH;
  let bottomBarHeight = bottomBarH;

  if (isMobile) {
    // Mobile bars live between hands and board; take their space from hand sections.
    const handTotal = topBarH + bottomBarH;
    const mobileBarTotal = mobileBarHeight + mobileBottomBarHeight;
    const adjustedHandTotal = Math.max(0, handTotal - mobileBarTotal);
    const topRatio = handTotal > 0 ? topBarH / handTotal : 0.5;
    topBarHeight = adjustedHandTotal * topRatio;
    bottomBarHeight = adjustedHandTotal - topBarHeight;
  }

  const topBar = createBounds(boardColumnX, 0, boardW, topBarHeight);
  const mobileTopBar = createBounds(boardColumnX, topBar.y + topBar.height, boardW, mobileBarHeight);
  const board = createBounds(boardColumnX, mobileTopBar.y + mobileTopBar.height, boardW, middleH);
  const mobileBottomBar = createBounds(boardColumnX, board.y + board.height, boardW, mobileBottomBarHeight);
  const bottomBar = createBounds(boardColumnX, mobileBottomBar.y + mobileBottomBar.height, boardW, bottomBarHeight);

  const eventLogBase = isMobile
    ? createBounds(boardColumnX, 0, boardW, height)
    : eventLog;
  const eventLogTopH = eventLogBase.height * EVENT_LOG_SPLIT_TOP;
  const eventLogTop = createBounds(eventLogBase.x, eventLogBase.y, eventLogBase.width, eventLogTopH);
  const eventLogPreview = createBounds(eventLogBase.x, eventLogBase.y + eventLogTopH, eventLogBase.width, eventLogBase.height - eventLogTopH);

  const sections = {
    leftPanel,
    board,
    rightPanel,
    rightPanelTop,
    rightPanelMiddle,
    rightPanelBottom,
    eventLog,
    eventLogTop,
    eventLogPreview,
    topBar,
    bottomBar,
    mobileTopBar,
    mobileBottomBar
  };
  
  // Calculate scales based on section sizes
  const baseScale = Math.min(width / 1920, height / 1080);
  const minPanelScale = isMobile ? 0.35 : 0.5;
  const maxPanelScale = isMobile ? 1.0 : 1.2;
  const panelScale = Math.max(minPanelScale, Math.min(maxPanelScale, baseScale));
  
  // Board size: fit within board section with some padding
  const boardPadding = isMobile ? 0 : Math.min(board.width, board.height) * 0.05;
  const nameplatePadding = isMobile ? Math.min(board.width, board.height) * 0.02 : boardPadding;
  const maxBoardSize = Math.min(board.width, board.height) - boardPadding * 2;
  const boardSize = Math.min(maxBoardSize, BASE_BOARD_SIZE * 1.5);
  const boardScale = boardSize / BASE_BOARD_SIZE;
  
  // Hand scale based on bottom bar height
  const handScale = Math.max(0.45, Math.min(0.95, bottomBar.height / 340));
  
  // Element positions within sections
  // Board: centered in board section
  const boardX = board.centerX;
  const boardY = board.centerY;
  
  // Left panel elements: vertically distributed
  const leftPanelX = leftPanel.centerX + 10;
  const leftPanelPadding = leftPanel.height * 0.06;
  const pileSpacing = leftPanel.height * 0.18;
  const opponentDeckY = leftPanel.y + leftPanelPadding + pileSpacing * 0.25;
  const opponentDiscardY = opponentDeckY + pileSpacing * 1.35; // Moved lower to avoid overlap with deck
  const playerDeckY = leftPanel.y + leftPanel.height - leftPanelPadding - pileSpacing * 0.25;
  const playerDiscardY = playerDeckY - pileSpacing * 1.25; // Moved higher to avoid overlap with deck
  
  // Right panel elements: vertically distributed from top
  const rightPanelX = rightPanel.centerX;
  const rightPanelTopY = rightPanel.y + rightPanel.height * 0.05;
  
  // Event log: positioned at top of section
  const eventLogX = eventLogTop.centerX;
  const eventLogHeight = 600; // EVENT_LOG_LAYOUT.HEIGHT
  const eventLogY = eventLogTop.y + (eventLogHeight / 2) * panelScale + 10; // Align to top with small padding
  const eventLogWidth = eventLogTop.width * 0.9;
  
  // Card hand: centered in bottom bar
  const cardHandX = bottomBar.centerX;
  const cardHandY = bottomBar.centerY;
  
  // Opponent hand: centered in top bar
  const opponentHandX = topBar.centerX;
  const opponentHandY = topBar.y + topBar.height * 0.8;
  const opponentHandLabelY = topBar.y + topBar.height * 0.7;
  const opponentHandCountY = opponentHandLabelY + 16 * panelScale;
  
  // Nameplates: above/below board
  const opponentNameX = board.centerX;
  const opponentNameY = board.y + nameplatePadding;
  const playerNameX = board.centerX;
  const playerNameY = board.y + board.height - nameplatePadding;
  
  // Preview card: left side of board section
  const previewX = isMobile
    ? boardColumnX + Math.max(boardW * MOBILE_PREVIEW.X_FACTOR, MOBILE_PREVIEW.MIN_X)
    : eventLogPreview.centerX || (board.x + board.width * 0.1);
  const previewY = isMobile
    ? Math.max(mobileBarHeight + MOBILE_PREVIEW.MIN_Y, height * MOBILE_PREVIEW.Y_FACTOR)
    : eventLogPreview.centerY || (board.y + board.height * 0.7);
  
  // Turn banner: above board
  const turnBannerX = board.centerX;
  const turnBannerY = board.y + nameplatePadding * 2;
  
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
    rightPanelTop: rightPanelTopY,
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
    isMobile,
    mobileBarHeight,
  };
}
