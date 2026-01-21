/**
 * @fileoverview GameScene endgame and rematch helpers
 *
 * @module scenes/game/GameSceneEnd
 */

import { Chess } from 'chess.js';
import type { PlayerColor } from '../../managers/GameStateManager';
import { calculateLayout } from './GameLayout';
import { createImageButton } from './GameUIHelpers';
import { hex } from '../../utils/colors';
import type { GameScene } from '../GameScene';
import { OVERLAY_LAYOUT } from '../../config';
import { getBoardOverlayMetrics } from './GameSceneOverlays';

/**
 * Checks for game-ending conditions
 * - Checkmate (Requirement 3.8)
 * - Stalemate (Requirement 3.8)
 * - Clock timeout (Requirement 4.5)
 */
export function checkGameEndConditions(this: GameScene): void {
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
  // In multiplayer, only check local player's clock - opponent handles their own timeout
  // In single player, check both clocks
  const localClock = this.gameStateManager.getPlayer(this.localColor).clock;

  if (this.networkManager) {
    // Multiplayer: only check local player's clock
    if (localClock <= 0) {
      const winner = this.localColor === 'white' ? 'black' : 'white';
      this.handleGameEnd(winner as PlayerColor, `${this.localColor === 'white' ? 'White' : 'Black'} ran out of time!`);
      return;
    }
  } else {
    // Single player: check both clocks
    const opponentColor = this.localColor === 'white' ? 'black' : 'white';
    const opponentClock = this.gameStateManager.getPlayer(opponentColor).clock;
    const whiteClock = this.localColor === 'white' ? localClock : opponentClock;
    const blackClock = this.localColor === 'black' ? localClock : opponentClock;

    if (whiteClock <= 0) {
      this.handleGameEnd('black', 'White ran out of time!');
      return;
    }
    if (blackClock <= 0) {
      this.handleGameEnd('white', 'Black ran out of time!');
      return;
    }
  }
}

/**
 * Checks move availability and escape options for a player
 * 
 * @param fen - Current board position
 * @param turn - Which player to check ('w' or 'b')
 * @param blockedSquares - Squares with pieces that cannot move (just deployed)
 * @returns Object with hasMoves, inCheck, and canEscapeMate flags
 */
function getMoveAvailability(
  fen: string,
  turn: 'w' | 'b',
  blockedSquares: string[]
): { hasMoves: boolean; inCheck: boolean; canEscapeMate: boolean } {
  try {
    const parts = fen.split(' ');
    if (parts.length >= 2) {
      parts[1] = turn;
    }
    const chess = new Chess(parts.join(' '));
    const blocked = new Set(blockedSquares);
    const moves = chess.moves({ verbose: true }) as Array<{ from: string; to: string; flags?: string }>;
    
    // Filter out castling moves and moves from blocked squares
    const availableMoves = moves.filter(
      move => !blocked.has(move.from) && !move.flags?.includes('k') && !move.flags?.includes('q')
    );
    const hasMoves = availableMoves.length > 0;
    const inCheck = chess.isCheck();
    
    // canEscapeMate: Can the player escape checkmate?
    // A player can escape mate if ANY legal move (from non-blocked pieces) gets them out of check
    // This includes king moves, blocking moves, and capturing the attacker
    let canEscapeMate = false;
    
    if (inCheck) {
      // Check if any available move escapes check
      for (const move of availableMoves) {
        // Try the move on a clone to see if it escapes check
        const testChess = new Chess(parts.join(' '));
        try {
          testChess.move({ from: move.from as any, to: move.to as any, promotion: 'q' });
          // If we get here, the move was legal and escapes check
          canEscapeMate = true;
          break;
        } catch {
          // Move didn't work (shouldn't happen since we got it from moves())
        }
      }
    } else {
      // Not in check, so no mate to escape
      canEscapeMate = true;
    }
    
    return { hasMoves, inCheck, canEscapeMate };
  } catch {
    // FEN validation can fail for edge cases (e.g., pawns on edge rows after deployment)
    // In these cases, assume moves are available to avoid false game-end triggers
    return { hasMoves: true, inCheck: false, canEscapeMate: true };
  }
}

/**
 * Checks for checkmate/stalemate after a card play
 * Considers deployed pieces as immobile for the current turn.
 */
export function checkCardPlayEndConditions(this: GameScene): void {
  if (this.gameStateManager.getPhase() === 'ended') return;

  const fen = this.chessBoard.getPosition();
  const whiteBlocks = this.gameStateManager.getDeployedPiecesThisTurn('white');
  const blackBlocks = this.gameStateManager.getDeployedPiecesThisTurn('black');

  const whiteState = getMoveAvailability(fen, 'w', whiteBlocks);
  const blackState = getMoveAvailability(fen, 'b', blackBlocks);

  // Checkmate: in check and cannot escape (no legal moves from non-blocked pieces)
  if (!whiteState.canEscapeMate && whiteState.inCheck) {
    this.handleGameEnd('black', 'Checkmate!');
    return;
  }

  if (!blackState.canEscapeMate && blackState.inCheck) {
    this.handleGameEnd('white', 'Checkmate!');
    return;
  }

  // Stalemate: no legal moves but not in check
  if (!whiteState.hasMoves && !whiteState.inCheck) {
    this.handleGameEnd(null, 'Stalemate - Draw!');
    return;
  }
  
  if (!blackState.hasMoves && !blackState.inCheck) {
    this.handleGameEnd(null, 'Stalemate - Draw!');
  }
}

/**
 * Handles game end
 * Logs result and shows end-game overlay
 *
 * @param winner - Winning player color (null for draw)
 * @param reason - Text description of how game ended
 */
export function handleGameEnd(this: GameScene, winner: PlayerColor | null, reason: string): void {
  if (this.gameStateManager.getPhase() === 'ended') return;

  this.gameStateManager.endGame();
  if (this.networkManager?.getIsHost() && !this.hasReportedGameFinish) {
    this.hasReportedGameFinish = true;
    this.networkManager.reportGameFinished();
  }

  this.logEvent('system', reason);

  if (winner) {
    const isLocalWin = winner === this.localColor;
    this.logEvent('system', isLocalWin ? 'You win!' : 'You lose!');
  }

  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  if (!layout.isMobile) {
    this.isMobileEventLogVisible = true;
  }
  this.positionEventLog(layout);
  this.interactionBlockersActive = true;
  this.interactionBlockersAllowPreview = true;
  this.refreshInteractionBlockers();
  this.cardHand.disableInteraction();

  const { overlayWidth, overlayHeight, overlayX, overlayY } = getBoardOverlayMetrics(this, layout);
  const buttonLayout = getBoardOverlayMetrics(this, layout);

  const isLocalWin = winner === this.localColor;
  const bannerText = winner === null ? 'DRAW' : isLocalWin ? 'VICTORY!' : 'DEFEAT';
  const bannerColor = winner === null ? '#777777' : isLocalWin ? '#006657' : '#e50b0b';

  if (!this.gameEndBannerRect) {
    this.gameEndBannerRect = this.add.rectangle(overlayX, overlayY, overlayWidth, overlayHeight, hex(bannerColor), 0.5);
    this.gameEndBannerRect.setDepth(140);
  } else {
    this.gameEndBannerRect.setPosition(overlayX, overlayY);
    this.gameEndBannerRect.setSize(overlayWidth, overlayHeight);
    this.gameEndBannerRect.setFillStyle(hex(bannerColor), 0.9);
  }

  if (!this.gameEndBannerText) {
    this.gameEndBannerText = this.add.text(overlayX, overlayY - overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR, bannerText, {
      fontSize: `${OVERLAY_LAYOUT.GAME_END_TITLE_FONT_SIZE * layout.panelScale}px`,
      fontFamily: 'BoldPixels, Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(141);
  } else {
    this.gameEndBannerText.setPosition(overlayX, overlayY - overlayHeight * OVERLAY_LAYOUT.TITLE_Y_OFFSET_FACTOR);
    this.gameEndBannerText.setFontSize(OVERLAY_LAYOUT.GAME_END_TITLE_FONT_SIZE * layout.panelScale);
    this.gameEndBannerText.setText(bannerText);
  }

  this.localRematchRequested = false;
  this.opponentRematchRequested = false;
  this.isViewingBoard = false;

  const buttonScale = layout.panelScale * OVERLAY_LAYOUT.BUTTON_SCALE_FACTOR;
  const buttonY = buttonLayout.overlayY + buttonLayout.overlayHeight * OVERLAY_LAYOUT.BUTTON_Y_OFFSET_FACTOR;
  const buttonOffset = Math.min(OVERLAY_LAYOUT.GAME_END_BUTTON_X_OFFSET * layout.panelScale, buttonLayout.overlayWidth * 0.3) * 3 / 2;
  const viewBoardY = overlayY + overlayHeight * 0.35;

  if (!this.gameEndViewBoardButton) {
    this.gameEndViewBoardButton = createImageButton(
      this,
      buttonLayout.overlayX + buttonOffset,
      buttonY,
      'View Board',
      'yellow_button',
      'yellow_button_pressed',
      () => this.enterViewBoardMode()
    );
    this.gameEndViewBoardButton.setDepth(142);
  } else {
    this.gameEndViewBoardButton.setPosition(overlayX, viewBoardY);
  }
  this.gameEndViewBoardButton.setData('baseScale', buttonScale);
  this.gameEndViewBoardButton.setScale(buttonScale);
  this.gameEndViewBoardButton.setVisible(true);

  if (!this.gameEndRematchButton) {
    this.gameEndRematchButton = createImageButton(
      this,
      buttonLayout.overlayX - buttonOffset,
      buttonY,
      'Rematch',
      'blue_button',
      'blue_button_pressed',
      () => this.handleRematchRequest()
    );
    this.gameEndRematchButton.setDepth(142);
  } else {
    this.gameEndRematchButton.setPosition(buttonLayout.overlayX - buttonOffset, buttonY);
  }
  this.gameEndRematchButton.setData('baseScale', buttonScale);
  this.gameEndRematchButton.setScale(buttonScale);
  this.gameEndRematchButton.setInteractive({ useHandCursor: true });
  this.gameEndRematchButton.setAlpha(1);

  if (!this.gameEndMenuButton) {
    this.gameEndMenuButton = createImageButton(
      this,
      buttonLayout.overlayX,
      buttonY,
      'Back to Main Menu',
      'brown_button',
      'brown_button_pressed',
      () => this.handleReturnToMenu()
    );
    this.gameEndMenuButton.setDepth(142);
  } else {
    this.gameEndMenuButton.setPosition(buttonLayout.overlayX + buttonOffset, buttonY);
  }
  this.gameEndMenuButton.setData('baseScale', buttonScale);
  this.gameEndMenuButton.setScale(buttonScale);
}

export function enterViewBoardMode(this: GameScene): void {
  this.isViewingBoard = true;
  this.gameEndBannerRect?.setVisible(false);
  this.gameEndBannerText?.setVisible(false);
  this.gameEndViewBoardButton?.setVisible(false);
  const layout = this.currentLayout ?? calculateLayout(this.scale.width, this.scale.height);
  this.currentLayout = layout;
  this.positionOverlays(layout);
}

/**
 * Handles rematch button click
 */
export function handleRematchRequest(this: GameScene): void {
  if (!this.networkManager) {
    this.startRematch();
    return;
  }
  if (this.localRematchRequested) return;
  this.localRematchRequested = true;

  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.disableInteractive();
    this.gameEndRematchButton.setAlpha(0.7);
  }

  this.logEvent('system', 'Rematch requested');
  this.networkManager?.sendRematchRequest();

  if (this.opponentRematchRequested) {
    this.startRematch();
  }
}

/**
 * Handles receiving a rematch request
 */
export function handleRematchReceived(this: GameScene): void {
  if (this.opponentRematchRequested) return;
  this.opponentRematchRequested = true;
  this.logEvent('system', `${this.opponentName} wants a rematch`);

  if (this.localRematchRequested) {
    this.startRematch();
  }
}

/**
 * Handles opponent declining rematch
 */
export function handleRematchDeclined(this: GameScene): void {
  this.localRematchRequested = false;
  this.opponentRematchRequested = false;
  this.logEvent('system', 'Opponent declined rematch');
  if (this.gameEndRematchButton) {
    this.gameEndRematchButton.setInteractive({ useHandCursor: true });
    this.gameEndRematchButton.setAlpha(1);
  }
}

/**
 * Starts rematch with swapped colors
 */
export function startRematch(this: GameScene): void {
  this.clearInteractionBlockers();
  const newLocalColor: PlayerColor = this.localColor === 'white' ? 'black' : 'white';
  this.time.delayedCall(OVERLAY_LAYOUT.REMATCH_DELAY, () => {
    this.scene.start('GameScene', {
      playerName: this.playerName,
      localColor: newLocalColor,
      networkManager: this.networkManager,
      opponentName: this.opponentName
    });
  });
}

/**
 * Returns to main menu and disconnects
 */
export function handleReturnToMenu(this: GameScene): void {
  this.networkManager?.sendRematchDecline();
  this.networkManager?.leaveRoom();
  this.scene.start('MenuScene');
}
