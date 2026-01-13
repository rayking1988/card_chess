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
  // Modify FEN to ensure it's the deploying player's turn
  // This is necessary because chess.js only returns moves for the current turn
  const fenParts = boardFEN.split(' ');
  const deployingTurn = playerColor === 'white' ? 'w' : 'b';
  fenParts[1] = deployingTurn;
  const modifiedFEN = fenParts.join(' ');
  
  const tempChess = new Chess(modifiedFEN);

  // Find opponent's king
  const opponentColor = playerColor === 'white' ? 'b' : 'w';
  const pieceColor = playerColor === 'white' ? 'w' : 'b';
  let kingSquare: ChessSquare | null = null;

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];

  for (const file of files) {
    for (const rank of ranks) {
      const square = (file + rank) as ChessSquare;
      const piece = tempChess.get(square);
      if (piece && piece.type === 'k' && piece.color === opponentColor) {
        kingSquare = square;
        break;
      }
    }
    if (kingSquare) break;
  }

  if (!kingSquare) return false;

  // Place the piece temporarily
  const placed = tempChess.put({ type: pieceType, color: pieceColor }, targetSquare as ChessSquare);
  if (!placed) {
    return false;
  }

  // Check if the deployed piece can attack the king
  try {
    const moves = tempChess.moves({ square: targetSquare as ChessSquare, verbose: true });
    for (const move of moves) {
      if (move.to === kingSquare) {
        return true;
      }
    }
  } catch {
    // If we can't get moves, assume no check
  }

  return false;
}
