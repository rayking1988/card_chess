/**
 * @fileoverview Game state validation helpers
 *
 * @module managers/gameState/validation
 */

import { Chess, Square as ChessSquare } from 'chess.js';
import type { PieceType, PlayerColor } from './types';

/**
 * Checks if deploying a piece would give check to opponent's king
 *
 * This validation should be called before placing the piece.
 *
 * @param targetSquare - Square to deploy to
 * @param pieceType - Type of piece to deploy
 * @param playerColor - Color of deploying player
 * @param boardFEN - Current board position
 * @returns True if deployment would give check (invalid)
 */
export function wouldDeploymentGiveCheck(
  targetSquare: string,
  pieceType: PieceType,
  playerColor: PlayerColor,
  boardFEN: string
): boolean {
  // Modify FEN to set it to opponent's turn after we place the piece
  // This way chess.js will check if the opponent's king is in check
  const fenParts = boardFEN.split(' ');
  const opponentTurn = playerColor === 'white' ? 'b' : 'w';
  fenParts[1] = opponentTurn;
  const modifiedFEN = fenParts.join(' ');
  
  try {
    const tempChess = new Chess(modifiedFEN);
    const pieceColor = playerColor === 'white' ? 'w' : 'b';

    // Place the piece temporarily
    const placed = tempChess.put({ type: pieceType, color: pieceColor }, targetSquare as ChessSquare);
    if (!placed) {
      return false;
    }

    // Check if the opponent is now in check
    // Since it's the opponent's turn, isCheck() tells us if their king is attacked
    return tempChess.isCheck();
  } catch {
    // If FEN is invalid or other error, assume no check to avoid blocking valid moves
    return false;
  }
}
