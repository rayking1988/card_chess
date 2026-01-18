/**
 * @fileoverview GameScene chess board interaction helpers
 *
 * @module scenes/game/GameSceneBoard
 */

import { Square, PieceSymbol } from 'chess.js';
import type { PlayerColor } from '../../managers/GameStateManager';
import { MAX_HAND_SIZE } from './GameConstants';
import type { GameScene } from '../GameScene';

/**
 * Sets up callback for chess board move attempts
 */
export function setupChessBoardCallbacks(this: GameScene): void {
  // Handle click-to-move (with animation)
  this.chessBoard.onMoveAttempt = (from: Square, to: Square) => {
    this.handleLocalMove(from, to, undefined, true); // true = animate
  };
  
  // Handle drag-and-drop (without animation)
  this.chessBoard.onDragMove = (from: Square, to: Square) => {
    return this.handleLocalMove(from, to, undefined, false); // false = no animation
  };
}

/**
 * Handles local player attempting to move a piece
 *
 * Algorithm:
 * 1. Validate turn and game state
 * 2. Verify piece ownership
 * 3. Check if piece can move (not deployed this turn)
 * 4. Execute move and update state
 * 5. Check for king capture and game end conditions
 * 6. Handle hand size enforcement or end turn
 *
 * @param from - Source square
 * @param to - Destination square
 * @param promotion - Promotion piece (for pawn promotion)
 * @param animate - Whether to animate the move (true for click, false for drag)
 * @returns True if the move was applied
 */
export function handleLocalMove(this: GameScene, from: Square, to: Square, promotion?: PieceSymbol, animate: boolean = true): boolean {
  // In single-player mode (no network), allow controlling both sides
  const isSinglePlayer = !this.networkManager;

  if (this.isConnectionPaused) {
    this.logEvent('system', 'Connection paused. Waiting for opponent.');
    return false;
  }

  // Check if it's our turn (skip in single-player hotseat mode)
  if (!isSinglePlayer && !this.gameStateManager.isLocalPlayerTurn()) {
    this.logEvent('system', 'Not your turn!');
    return false;
  }

  // Check if in discard mode
  if (this.isDiscardMode) {
    this.logEvent('system', 'Discard cards first!');
    return false;
  }

  // Check game phase
  if (this.gameStateManager.getPhase() !== 'playing') {
    this.logEvent('system', 'Game not started yet!');
    return false;
  }

  // Determine which color is moving based on the piece
  const piece = this.chessBoard.getWrapper().getPiece(from);
  if (!piece) return false;

  const movingColor: PlayerColor = piece.color === 'w' ? 'white' : 'black';

  // In multiplayer, verify it's the correct player's turn
  if (!isSinglePlayer && movingColor !== this.localColor) {
    this.logEvent('system', 'Not your piece!');
    return false;
  }

  // Verify it's this color's turn
  if (this.gameStateManager.getCurrentTurn() !== movingColor) {
    this.logEvent('system', `It's ${this.gameStateManager.getCurrentTurn()}'s turn!`);
    return false;
  }

  // Check if piece was deployed this turn (cannot move)
  const moveCheck = this.gameStateManager.canMovePiece(movingColor, from);
  if (!moveCheck.canMove) {
    this.logEvent('system', moveCheck.reason);
    return false;
  }

  if (this.pendingPromotion && !promotion) {
    return false;
  }

  // Attempt the move
  const movingPiece = this.chessBoard.getWrapper().getPiece(from);
  const capturedPiece = this.chessBoard.getWrapper().getPiece(to);
  const needsPromotion = this.chessBoard.getWrapper().isPromotionMove(from, to);
  if (needsPromotion && !promotion) {
    this.showPromotionPicker(from, to, movingColor);
    return false;
  }

  const result = this.chessBoard.makeMove(from, to, promotion);

  if (result.success) {
    this.pendingPromotion = null;
    if (movingPiece && animate) {
      this.animatePieceMove(from, to, movingPiece, capturedPiece);
    }
    // Reset draw/resign button states when a move is made
    this.resetDrawResignState();
    
    // Update game state
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    this.gameStateManager.deductMoveTimeCost(movingColor);
    this.gameStateManager.resolveDisturbTagsOnMove(movingColor);

    // Log move with piece type (K=King, Q=Queen, R=Rook, B=Bishop, N=Knight, P=Pawn)
    const pieceSymbol = movingPiece ? movingPiece.type.toUpperCase() : '?';
    this.logEvent(movingColor, `Moved ${pieceSymbol} ${from} to ${to}`);

    // Send to network (only if it's our piece in multiplayer)
    if (!isSinglePlayer) {
      this.networkManager?.sendMovePiece(from, to, promotion);
    }

    // Check for king capture (Requirement 3.7)
    if (result.isKingCapture) {
      this.handleGameEnd(movingColor, 'King captured!');
      return true;
    }

    // Check for checkmate/stalemate (Requirement 3.8)
    this.checkGameEndConditions();

    // Update UI to show current stopwatch value
    this.updateUIFromState();
    
    // Check stopwatch threshold AFTER UI is updated, BEFORE ending turn
    const cardsDrawn = this.gameStateManager.checkStopwatchThreshold(movingColor);
    if (cardsDrawn > 0) {
      this.logEvent('system', `Opponent drew ${cardsDrawn} card(s) (stopwatch threshold)`);
      this.updateUIFromState();
    }

    // Check hand size before ending turn (Requirement 3.6)
    const currentPlayer = this.gameStateManager.getPlayer(movingColor);
    if (currentPlayer.hand.length > MAX_HAND_SIZE) {
      this.enterDiscardMode();
    } else {
      // End turn after move (Requirement 3.5)
      this.logEvent('system', `Ending ${movingColor}'s turn...`);
      const disturbToAdd = currentPlayer.mode === 'disturb' ? currentPlayer.energy : 0;
      if (!isSinglePlayer) {
        this.sendLocalPlayerStats();
      }
      this.gameStateManager.endTurn();
      if (this.networkManager) {
        const opponentColor = this.localColor === 'white' ? 'black' : 'white';
        this.opponentDisturbTags = this.gameStateManager.getPlayer(opponentColor).disturbTags;
      }
      const newTurn = this.gameStateManager.getCurrentTurn();
      this.logEvent('system', `Now ${newTurn}'s turn`);
      if (!isSinglePlayer) {
        this.networkManager?.sendEndTurn(disturbToAdd);
      }
    }
    this.updateUIFromState();
    return true;
  } else if (result.needsPromotion) {
    this.showPromotionPicker(from, to, movingColor);
    return false;
  }

  this.updateUIFromState();
  return false;
}
