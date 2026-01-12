/**
 * @fileoverview GameScene chess board interaction helpers
 *
 * @module scenes/game/GameSceneBoard
 */

import { Square } from 'chess.js';
import type { PlayerColor } from '../../managers/GameStateManager';
import { MAX_HAND_SIZE } from './GameConstants';
import type { GameScene } from '../GameScene';

/**
 * Sets up callback for chess board move attempts
 */
export function setupChessBoardCallbacks(this: GameScene): void {
  this.chessBoard.onMoveAttempt = (from: Square, to: Square) => {
    this.handleLocalMove(from, to);
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
 */
export function handleLocalMove(this: GameScene, from: Square, to: Square): void {
  // In single-player mode (no network), allow controlling both sides
  const isSinglePlayer = !this.networkManager;

  if (this.isConnectionPaused) {
    this.logEvent('system', 'Connection paused. Waiting for opponent.');
    return;
  }

  // Check if it's our turn (skip in single-player hotseat mode)
  if (!isSinglePlayer && !this.gameStateManager.isLocalPlayerTurn()) {
    this.logEvent('system', 'Not your turn!');
    return;
  }

  // Check if in discard mode
  if (this.isDiscardMode) {
    this.logEvent('system', 'Discard cards first!');
    return;
  }

  // Check game phase
  if (this.gameStateManager.getPhase() !== 'playing') {
    this.logEvent('system', 'Game not started yet!');
    return;
  }

  // Determine which color is moving based on the piece
  const piece = this.chessBoard.getWrapper().getPiece(from);
  if (!piece) return;

  const movingColor: PlayerColor = piece.color === 'w' ? 'white' : 'black';

  // In multiplayer, verify it's the correct player's turn
  if (!isSinglePlayer && movingColor !== this.localColor) {
    this.logEvent('system', 'Not your piece!');
    return;
  }

  // Verify it's this color's turn
  if (this.gameStateManager.getCurrentTurn() !== movingColor) {
    this.logEvent('system', `It's ${this.gameStateManager.getCurrentTurn()}'s turn!`);
    return;
  }

  // Check if piece was deployed this turn (cannot move)
  const moveCheck = this.gameStateManager.canMovePiece(movingColor, from);
  if (!moveCheck.canMove) {
    this.logEvent('system', moveCheck.reason);
    return;
  }

  // Attempt the move
  const movingPiece = this.chessBoard.getWrapper().getPiece(from);
  const capturedPiece = this.chessBoard.getWrapper().getPiece(to);
  const result = this.chessBoard.makeMove(from, to);

  if (result.success) {
    if (movingPiece) {
      this.animatePieceMove(from, to, movingPiece, capturedPiece);
    }
    // Update game state
    this.gameStateManager.setBoardFEN(this.chessBoard.getPosition());
    this.gameStateManager.deductMoveTimeCost(movingColor);
    this.gameStateManager.resolveDisturbTagsOnMove(movingColor);

    this.logEvent(movingColor, `Moved ${from} to ${to}`);

    // Send to network (only if it's our piece in multiplayer)
    if (!isSinglePlayer) {
      this.networkManager?.sendMovePiece(from, to);
    }

    // Check for king capture (Requirement 3.7)
    if (result.isKingCapture) {
      this.handleGameEnd(movingColor, 'King captured!');
      return;
    }

    // Check for checkmate/stalemate (Requirement 3.8)
    this.checkGameEndConditions();

    // Check hand size before ending turn (Requirement 3.6)
    const currentPlayer = this.gameStateManager.getPlayer(movingColor);
    if (currentPlayer.hand.length > MAX_HAND_SIZE) {
      this.enterDiscardMode();
    } else {
      // End turn after move (Requirement 3.5)
      this.logEvent('system', `Ending ${movingColor}'s turn...`);
      this.gameStateManager.endTurn();
      const newTurn = this.gameStateManager.getCurrentTurn();
      this.logEvent('system', `Now ${newTurn}'s turn`);
      if (!isSinglePlayer) {
        this.networkManager?.sendEndTurn();
      }
    }
  }

  this.updateUIFromState();
}
