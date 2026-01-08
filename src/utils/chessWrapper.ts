/**
 * ChessBoardWrapper - Chess logic wrapper with custom rules for Card Chess
 * 
 * Requirements: 2.2, 2.3, 2.4, 2.6
 * - 2.2: Enforce standard chess movement rules via chess.js
 * - 2.3: Allow King to be captured (no checkmate-only ending)
 * - 2.4: Do NOT enforce 50-move draw rule
 * - 2.6: Start with only two kings (White King e1, Black King e8)
 */

import { Chess, Square, PieceSymbol, Color } from 'chess.js';

// Initial FEN: only two kings
export const INITIAL_FEN = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';

// Board constants
export const BOARD_SIZE = 8;

export interface MoveResult {
  success: boolean;
  captured?: PieceSymbol;
  isKingCapture?: boolean;
  san?: string;
  from: string;
  to: string;
}

export interface ControlPowerMap {
  [square: string]: number; // positive = white control, negative = black control
}

/**
 * All 64 squares on the board
 */
export function getAllSquares(): Square[] {
  const squares: Square[] = [];
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  for (const file of files) {
    for (const rank of ranks) {
      squares.push((file + rank) as Square);
    }
  }
  
  return squares;
}

/**
 * ChessBoardWrapper - Wraps chess.js with custom rules for Card Chess
 * Allows king capture (Requirement 2.3)
 * Does not enforce 50-move draw (Requirement 2.4)
 */
export class ChessBoardWrapper {
  private chess: Chess;

  constructor(fen: string = INITIAL_FEN) {
    this.chess = new Chess(fen);
  }

  /**
   * Get current position as FEN string
   */
  getPosition(): string {
    return this.chess.fen();
  }

  /**
   * Set position from FEN string
   */
  setPosition(fen: string): boolean {
    try {
      this.chess.load(fen);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset to initial position (two kings only)
   */
  reset(): void {
    this.chess.load(INITIAL_FEN);
  }

  /**
   * Get the piece at a square
   */
  getPiece(square: Square): { type: PieceSymbol; color: Color } | null {
    const piece = this.chess.get(square);
    return piece || null;
  }

  /**
   * Get all pieces on the board
   */
  getAllPieces(): Array<{ square: Square; type: PieceSymbol; color: Color }> {
    const pieces: Array<{ square: Square; type: PieceSymbol; color: Color }> = [];
    
    for (const square of getAllSquares()) {
      const piece = this.chess.get(square);
      if (piece) {
        pieces.push({ square, type: piece.type, color: piece.color });
      }
    }
    
    return pieces;
  }

  /**
   * Get valid moves for a piece at a square
   * Requirement 2.2: Enforce standard chess movement rules
   */
  getValidMoves(square: Square): Square[] {
    const moves = this.chess.moves({ square, verbose: true });
    return moves.map(m => m.to as Square);
  }

  /**
   * Check if a move is valid according to chess rules
   */
  isValidMove(from: Square, to: Square): boolean {
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves.some(m => m.to === to);
  }

  /**
   * Make a move on the board
   * Requirement 2.3: Allow king capture
   */
  makeMove(from: Square, to: Square): MoveResult {
    const targetPiece = this.chess.get(to);
    const isKingCapture = targetPiece?.type === 'k';
    
    try {
      const move = this.chess.move({ from, to, promotion: 'q' }); // Auto-promote to queen
      
      if (move) {
        return {
          success: true,
          captured: move.captured,
          isKingCapture,
          san: move.san,
          from,
          to
        };
      }
    } catch {
      // Move failed
    }
    
    return { success: false, from, to };
  }

  /**
   * Check if a king is under attack (in check)
   */
  isKingAttacked(color: Color): boolean {
    return this.chess.isCheck() && this.chess.turn() === color;
  }

  /**
   * Check if the current player can capture the opponent's king
   * Requirement 2.3: Allow king capture when king is under direct attack
   */
  canCaptureKing(): boolean {
    // Find opponent's king
    const opponentColor = this.chess.turn() === 'w' ? 'b' : 'w';
    let kingSquare: Square | null = null;
    
    for (const square of getAllSquares()) {
      const piece = this.chess.get(square);
      if (piece && piece.type === 'k' && piece.color === opponentColor) {
        kingSquare = square;
        break;
      }
    }
    
    if (!kingSquare) return false;
    
    // Check if any piece can move to the king's square
    const currentColor = this.chess.turn();
    for (const square of getAllSquares()) {
      const piece = this.chess.get(square);
      if (piece && piece.color === currentColor) {
        const moves = this.getValidMoves(square);
        if (moves.includes(kingSquare)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get squares attacked by a specific color
   */
  getAttackedSquares(color: Color): Square[] {
    const attacked: Set<Square> = new Set();
    
    for (const square of getAllSquares()) {
      const piece = this.chess.get(square);
      if (piece && piece.color === color) {
        const moves = this.chess.moves({ square, verbose: true });
        for (const move of moves) {
          attacked.add(move.to as Square);
        }
      }
    }
    
    return Array.from(attacked);
  }

  /**
   * Check if game is in checkmate
   */
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  /**
   * Check if game is in stalemate
   */
  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  /**
   * Check if game is a draw (excluding 50-move rule per Requirement 2.4)
   */
  isDraw(): boolean {
    // Only check for stalemate and insufficient material
    // Do NOT check for 50-move rule (Requirement 2.4)
    return this.chess.isStalemate() || this.chess.isInsufficientMaterial();
  }

  /**
   * Get current turn color
   */
  getTurn(): Color {
    return this.chess.turn();
  }

  /**
   * Place a piece on the board (for card effects)
   */
  placePiece(square: Square, type: PieceSymbol, color: Color): boolean {
    // Check if square is empty
    if (this.chess.get(square)) {
      return false;
    }
    
    // Use put method to place piece
    return this.chess.put({ type, color }, square);
  }

  /**
   * Remove a piece from the board (for card effects)
   */
  removePiece(square: Square): boolean {
    const piece = this.chess.get(square);
    if (!piece) return false;
    
    return this.chess.remove(square) !== null;
  }

  /**
   * Get the chess.js instance for advanced operations
   */
  getChessInstance(): Chess {
    return this.chess;
  }
}
