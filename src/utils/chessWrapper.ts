/**
 * @fileoverview ChessBoardWrapper - Chess logic wrapper with custom rules for Card Chess
 * 
 * This module wraps the chess.js library to provide chess logic with custom rules
 * specific to Card Chess gameplay. Key modifications from standard chess:
 * - King capture is allowed (no checkmate-only ending)
 * - 50-move draw rule is NOT enforced
 * - Game starts with only two kings (custom initial position)
 * 
 * Requirements addressed:
 * - 2.2: Enforce standard chess movement rules via chess.js
 * - 2.3: Allow King to be captured (no checkmate-only ending)
 * - 2.4: Do NOT enforce 50-move draw rule
 * - 2.6: Start with only two kings (White King e1, Black King e8)
 * 
 * @module utils/chessWrapper
 * @requires chess.js
 * 
 * Used by: ChessBoardComponent, GameScene, controlPower utility
 */

import { Chess, Square, PieceSymbol, Color } from 'chess.js';
import { CHESS } from '../config';

/* ============================================
 * CONFIGURATION CONSTANTS
 * ============================================
 * Initial board setup and board dimensions.
 */

/** 
 * Initial FEN string: only two kings on the board
 * White King on e1, Black King on e8
 * Requirement 2.6
 */
export const INITIAL_FEN = CHESS.INITIAL_FEN;

/** Standard chess board size (8x8) */
export const BOARD_SIZE = CHESS.BOARD_SIZE;

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Result of a move attempt on the chess board
 * 
 * @property success - Whether the move was executed successfully
 * @property captured - The piece type that was captured, if any
 * @property isKingCapture - Whether the move captured a king (game-ending)
 * @property san - Standard Algebraic Notation of the move
 * @property from - Source square of the move
 * @property to - Destination square of the move
 */
export interface MoveResult {
  success: boolean;
  captured?: PieceSymbol;
  isKingCapture?: boolean;
  san?: string;
  from: string;
  to: string;
  needsPromotion?: boolean;
}

/**
 * Map of control power values for each square
 * Positive values indicate white control, negative indicate black control
 * 
 * Used by: controlPower utility for territory calculations
 */
export interface ControlPowerMap {
  [square: string]: number;
}

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Generates an array of all 64 squares on the chess board
 * 
 * Algorithm:
 * 1. Iterate through files a-h
 * 2. For each file, iterate through ranks 1-8
 * 3. Combine file and rank to create square notation
 * 
 * @returns Array of all 64 squares in algebraic notation (a1, a2, ..., h8)
 * 
 * Used by: ChessBoardWrapper methods, controlPower calculations
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

/* ============================================
 * CHESS BOARD WRAPPER CLASS
 * ============================================
 */

/**
 * ChessBoardWrapper - Wraps chess.js with custom rules for Card Chess
 * 
 * This class provides a chess engine interface with modifications for Card Chess:
 * - Allows king capture (Requirement 2.3) instead of checkmate-only endings
 * - Does not enforce 50-move draw rule (Requirement 2.4)
 * - Supports piece placement/removal for card effects
 * 
 * Key features:
 * - Standard chess move validation via chess.js
 * - Custom initial position with only two kings
 * - Methods for card-based piece manipulation
 * - Attack and control calculations
 * 
 * @example
 * const board = new ChessBoardWrapper();
 * const moves = board.getValidMoves('e1');
 * const result = board.makeMove('e1', 'e2');
 * 
 * Used by: ChessBoardComponent, GameScene, controlPower utility
 */
export class ChessBoardWrapper {
  /** Internal chess.js instance for move validation and game state */
  private chess: Chess;

  /**
   * Creates a new ChessBoardWrapper with the specified position
   * 
   * @param fen - FEN string for initial position (defaults to two kings only)
   * 
   * Used by: ChessBoardComponent constructor, GameScene initialization
   */
  constructor(fen: string = INITIAL_FEN) {
    this.chess = new Chess(fen);
  }

  /* ----------------------------------------
   * Position Management
   * ---------------------------------------- */

  /**
   * Gets the current board position as a FEN string
   * 
   * @returns FEN string representing current position
   * 
   * Used by: GameStateManager for state synchronization
   */
  getPosition(): string {
    return this.chess.fen();
  }

  /**
   * Sets the board position from a FEN string
   * 
   * @param fen - FEN string to load
   * @returns true if position was loaded successfully, false otherwise
   * 
   * Used by: GameScene for network state sync
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
   * Resets the board to initial position (two kings only)
   * 
   * Used by: Game restart functionality
   */
  reset(): void {
    this.chess.load(INITIAL_FEN);
  }

  /* ----------------------------------------
   * Piece Queries
   * ---------------------------------------- */

  /**
   * Gets the piece at a specific square
   * 
   * @param square - Square to check (e.g., 'e4')
   * @returns Piece object with type and color, or null if empty
   * 
   * Used by: ChessBoardComponent for rendering, move validation
   */
  getPiece(square: Square): { type: PieceSymbol; color: Color } | null {
    const piece = this.chess.get(square);
    return piece || null;
  }

  /**
   * Gets all pieces currently on the board
   * 
   * Algorithm:
   * 1. Iterate through all 64 squares
   * 2. For each square with a piece, record square, type, and color
   * 
   * @returns Array of piece objects with their positions
   * 
   * Used by: ChessBoardComponent for initial rendering
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

  /* ----------------------------------------
   * Move Validation and Execution
   * ---------------------------------------- */

  /**
   * Gets valid destination squares for a piece
   * Requirement 2.2: Enforce standard chess movement rules
   * 
   * @param square - Square containing the piece to move
   * @returns Array of valid destination squares
   * 
   * Used by: ChessBoardComponent for move highlighting
   */
  getValidMoves(square: Square): Square[] {
    const moves = this.chess.moves({ square, verbose: true });
    return moves
      .filter(move => !(move.flags?.includes('k') || move.flags?.includes('q')))
      .map(m => m.to as Square);
  }

  /**
   * Checks if a specific move is valid
   * 
   * @param from - Source square
   * @param to - Destination square
   * @returns true if the move is legal
   * 
   * Used by: ChessBoardComponent for drag validation
   */
  isValidMove(from: Square, to: Square): boolean {
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves.some(m => m.to === to && !(m.flags?.includes('k') || m.flags?.includes('q')));
  }

  /**
   * Checks if a move is a promotion move
   *
   * @param from - Source square
   * @param to - Destination square
   * @returns True if move is a promotion
   */
  isPromotionMove(from: Square, to: Square): boolean {
    const moves = this.chess.moves({ square: from, verbose: true });
    const match = moves.find(m => m.to === to);
    return !!match?.promotion;
  }

  /**
   * Gets available promotion options for a move
   *
   * @param from - Source square
   * @param to - Destination square
   * @returns Array of promotion piece symbols
   */
  getPromotionOptions(from: Square, to: Square): PieceSymbol[] {
    const moves = this.chess.moves({ square: from, verbose: true });
    return moves
      .filter(m => m.to === to && m.promotion)
      .map(m => m.promotion as PieceSymbol);
  }

  /**
   * Checks if promoting to a piece would give check
   *
   * @param from - Source square
   * @param to - Destination square
   * @param promotion - Promotion piece symbol
   * @returns True if the promotion gives check
   */
  wouldPromotionGiveCheck(from: Square, to: Square, promotion: PieceSymbol): boolean {
    const clone = new Chess(this.chess.fen());
    const move = clone.move({ from, to, promotion });
    if (!move) return false;
    return clone.isCheck();
  }

  /**
   * Executes a move on the board
   * Requirement 2.3: Allow king capture
   * 
   * Algorithm:
   * 1. Check if target square contains a king (for king capture detection)
   * 2. Attempt the move via chess.js
   * 3. Auto-promote pawns to queen
   * 4. Return result with capture information
   * 
   * @param from - Source square
   * @param to - Destination square
   * @returns MoveResult with success status and capture details
   * 
   * Used by: GameScene.handleLocalMove(), handleOpponentMovePiece()
   */
  makeMove(from: Square, to: Square, promotion?: PieceSymbol): MoveResult {
    // Check for king capture before move (Requirement 2.3)
    const targetPiece = this.chess.get(to);
    const isKingCapture = targetPiece?.type === 'k';

    const moves = this.chess.moves({ square: from, verbose: true });
    const match = moves.find(m => m.to === to);
    if (!match) {
      return { success: false, from, to };
    }
    if (match.flags?.includes('k') || match.flags?.includes('q')) {
      return { success: false, from, to };
    }
    if (match.promotion && !promotion) {
      return { success: false, from, to, needsPromotion: true };
    }
    
    try {
      const move = match.promotion
        ? this.chess.move({ from, to, promotion })
        : this.chess.move({ from, to });
      
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
      // Move failed - invalid according to chess rules
    }
    
    return { success: false, from, to };
  }

  /* ----------------------------------------
   * Game State Queries
   * ---------------------------------------- */

  /**
   * Checks if a king is currently in check
   * 
   * @param color - Color of the king to check
   * @returns true if the king is under attack
   * 
   * Used by: GameScene for check detection
   */
  isKingAttacked(color: Color): boolean {
    return this.chess.isCheck() && this.chess.turn() === color;
  }

  /**
   * Checks if the current player can capture the opponent's king
   * Requirement 2.3: Allow king capture when king is under direct attack
   * 
   * Algorithm:
   * 1. Find the opponent's king position
   * 2. Check if any current player's piece can move to that square
   * 
   * @returns true if king capture is possible this turn
   * 
   * Used by: GameScene for game-ending condition check
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
   * Gets all squares attacked by pieces of a specific color
   * 
   * @param color - Color to check attacks for
   * @returns Array of squares under attack
   * 
   * Used by: Control power calculations
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
   * Checks if the game is in checkmate
   * 
   * @returns true if current player is checkmated
   */
  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  /**
   * Checks if the game is in stalemate
   * 
   * @returns true if current player has no legal moves but is not in check
   */
  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  /**
   * Checks if the game is a draw
   * Requirement 2.4: Do NOT enforce 50-move draw rule
   * 
   * Only checks for stalemate and insufficient material.
   * 
   * @returns true if the game is drawn
   * 
   * Used by: GameScene for game-ending condition check
   */
  isDraw(): boolean {
    // Only check for stalemate and insufficient material
    // Do NOT check for 50-move rule (Requirement 2.4)
    return this.chess.isStalemate() || this.chess.isInsufficientMaterial();
  }

  /**
   * Gets the color whose turn it is to move
   * 
   * @returns 'w' for white, 'b' for black
   */
  getTurn(): Color {
    return this.chess.turn();
  }

  /* ----------------------------------------
   * Piece Manipulation (for card effects)
   * ---------------------------------------- */

  /**
   * Places a piece on an empty square (for card effects)
   * 
   * @param square - Target square (must be empty)
   * @param type - Piece type to place
   * @param color - Color of the piece
   * @returns true if piece was placed successfully
   * 
   * Used by: GameScene for DEPLOY_PIECE card effects
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
   * Removes a piece from the board (for card effects)
   * 
   * @param square - Square containing the piece to remove
   * @returns true if piece was removed successfully
   * 
   * Used by: GameScene for DESTROY_PIECE card effects
   */
  removePiece(square: Square): boolean {
    const piece = this.chess.get(square);
    if (!piece) return false;
    
    return this.chess.remove(square) !== null;
  }

  /**
   * Gets the underlying chess.js instance for advanced operations
   * 
   * @returns The chess.js Chess instance
   * 
   * Used by: controlPower utility for attack calculations
   */
  getChessInstance(): Chess {
    return this.chess;
  }
}
