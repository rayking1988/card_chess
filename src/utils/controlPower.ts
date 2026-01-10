/**
 * @fileoverview Control Power Calculation Utility
 * 
 * This module calculates territorial control for each square on the chess board.
 * Control power determines which player "owns" a square for card targeting purposes.
 * 
 * Control power formula:
 * - Base: +1 for ranks 1-2 (White's home), -1 for ranks 7-8 (Black's home)
 * - Attack: +1 for each White piece attacking, -1 for each Black piece attacking
 * 
 * Requirements addressed:
 * - 7.1: Calculate +1 control power for ranks 1-2 (White's home)
 * - 7.2: Calculate -1 control power for ranks 7-8 (Black's home)
 * - 7.3: Add +1 for each square attacked by White pieces
 * - 7.4: Subtract 1 for each square attacked by Black pieces
 * - 7.5: Square controlled by White when control power > 0
 * - 7.6: Square controlled by Black when control power < 0
 * - 7.7: Render overlay on board when player holds control power button
 * 
 * @module utils/controlPower
 * @requires chess.js
 * @requires utils/chessWrapper
 * 
 * Used by: GameScene for card targeting validation, ChessBoardComponent for overlay
 */

import { Chess, Square, Color } from 'chess.js';
import { getAllSquares, ChessBoardWrapper, ControlPowerMap } from './chessWrapper';

/* ============================================
 * MAIN CONTROL POWER CALCULATION
 * ============================================
 */

/**
 * Calculates control power for all squares on the board
 * 
 * Control power determines territorial ownership:
 * - Positive values = White controls the square
 * - Negative values = Black controls the square
 * - Zero = Neutral/contested square
 * 
 * Algorithm:
 * 1. For each square, start with base control from rank position
 *    - Ranks 1-2: +1 (White's home territory)
 *    - Ranks 7-8: -1 (Black's home territory)
 * 2. Calculate attack maps for both colors
 * 3. Add attack contributions (+1 per White attacker, -1 per Black attacker)
 * 
 * @param wrapper - ChessBoardWrapper instance with current position
 * @returns ControlPowerMap with power values for each square
 * 
 * @example
 * const controlMap = calculateControlPower(chessWrapper);
 * const e4Power = controlMap['e4']; // Positive = White, Negative = Black
 * 
 * Used by: GameScene.validateCardTarget(), ChessBoardComponent overlay
 */
export function calculateControlPower(wrapper: ChessBoardWrapper): ControlPowerMap {
  const controlMap: ControlPowerMap = {};
  const chess = wrapper.getChessInstance();
  
  // Pre-calculate attack maps for efficiency
  const whiteAttacks = getAttackMap(chess, 'w');
  const blackAttacks = getAttackMap(chess, 'b');
  
  for (const square of getAllSquares()) {
    let power = 0;
    const rank = parseInt(square[1]);
    
    // Base control from ranks (Requirements 7.1, 7.2)
    if (rank <= 2) {
      power += 1; // White's home territory
    }
    if (rank >= 7) {
      power -= 1; // Black's home territory
    }
    
    // Attack control (Requirements 7.3, 7.4)
    power += whiteAttacks.get(square) || 0;
    power -= blackAttacks.get(square) || 0;
    
    controlMap[square] = power;
  }
  
  return controlMap;
}

/* ============================================
 * ATTACK MAP CALCULATION
 * ============================================
 */

/**
 * Builds a map of how many times each square is attacked by pieces of a color
 * 
 * This differs from legal moves - it includes squares defended by same-color pieces.
 * 
 * Algorithm:
 * 1. Iterate through all squares
 * 2. For each piece of the specified color, get its attacked squares
 * 3. Increment the attack count for each attacked square
 * 
 * @param chess - Chess.js instance
 * @param color - Color to check attacks for ('w' or 'b')
 * @returns Map of square -> attack count
 * 
 * @private
 */
function getAttackMap(chess: Chess, color: Color): Map<Square, number> {
  const attackMap = new Map<Square, number>();
  
  for (const square of getAllSquares()) {
    const piece = chess.get(square);
    if (!piece || piece.color !== color) continue;
    
    // Get squares this piece attacks (including defended squares)
    const attackedSquares = getAttackedSquaresByPiece(chess, square, piece.type, color);
    
    for (const attackedSquare of attackedSquares) {
      const current = attackMap.get(attackedSquare) || 0;
      attackMap.set(attackedSquare, current + 1);
    }
  }
  
  return attackMap;
}

/**
 * Gets squares attacked by a specific piece (including defended squares)
 * 
 * This is different from legal moves - it includes squares with same-color pieces
 * because those squares are still "controlled" by the attacking piece.
 * 
 * @param chess - Chess.js instance
 * @param square - Square containing the piece
 * @param pieceType - Type of piece (p, n, b, r, q, k)
 * @param color - Color of the piece
 * @returns Array of attacked squares
 * 
 * @private
 */
function getAttackedSquaresByPiece(
  chess: Chess, 
  square: Square, 
  pieceType: string, 
  color: Color
): Square[] {
  const attacked: Square[] = [];
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1]) - 1;
  
  switch (pieceType) {
    case 'p': // Pawn - diagonal attacks only
      attacked.push(...getPawnAttacks(file, rank, color));
      break;
    case 'n': // Knight - L-shaped jumps
      attacked.push(...getKnightAttacks(file, rank));
      break;
    case 'b': // Bishop - diagonal slides
      attacked.push(...getSlidingAttacks(chess, file, rank, [[-1,-1], [-1,1], [1,-1], [1,1]]));
      break;
    case 'r': // Rook - orthogonal slides
      attacked.push(...getSlidingAttacks(chess, file, rank, [[-1,0], [1,0], [0,-1], [0,1]]));
      break;
    case 'q': // Queen - all directions
      attacked.push(...getSlidingAttacks(chess, file, rank, [
        [-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]
      ]));
      break;
    case 'k': // King - one square in all directions
      attacked.push(...getKingAttacks(file, rank));
      break;
  }
  
  return attacked;
}

/* ============================================
 * PIECE-SPECIFIC ATTACK PATTERNS
 * ============================================
 */

/**
 * Gets pawn attack squares (diagonal captures only, not forward moves)
 * 
 * @param file - File index (0-7)
 * @param rank - Rank index (0-7)
 * @param color - Pawn color (determines attack direction)
 * @returns Array of attacked squares
 * 
 * @private
 */
function getPawnAttacks(file: number, rank: number, color: Color): Square[] {
  const attacks: Square[] = [];
  const direction = color === 'w' ? 1 : -1; // White attacks up, Black attacks down
  const newRank = rank + direction;
  
  if (newRank >= 0 && newRank < 8) {
    // Left diagonal
    if (file > 0) {
      attacks.push(coordsToSquare(file - 1, newRank));
    }
    // Right diagonal
    if (file < 7) {
      attacks.push(coordsToSquare(file + 1, newRank));
    }
  }
  
  return attacks;
}

/**
 * Gets knight attack squares (L-shaped jumps)
 * 
 * @param file - File index (0-7)
 * @param rank - Rank index (0-7)
 * @returns Array of attacked squares
 * 
 * @private
 */
function getKnightAttacks(file: number, rank: number): Square[] {
  const attacks: Square[] = [];
  // All 8 possible knight moves
  const offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  for (const [df, dr] of offsets) {
    const newFile = file + df;
    const newRank = rank + dr;
    if (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
      attacks.push(coordsToSquare(newFile, newRank));
    }
  }
  
  return attacks;
}

/**
 * Gets king attack squares (one square in all directions)
 * 
 * @param file - File index (0-7)
 * @param rank - Rank index (0-7)
 * @returns Array of attacked squares
 * 
 * @private
 */
function getKingAttacks(file: number, rank: number): Square[] {
  const attacks: Square[] = [];
  // All 8 adjacent squares
  const offsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  for (const [df, dr] of offsets) {
    const newFile = file + df;
    const newRank = rank + dr;
    if (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
      attacks.push(coordsToSquare(newFile, newRank));
    }
  }
  
  return attacks;
}

/**
 * Gets sliding piece attacks (bishop, rook, queen)
 * 
 * Slides in each direction until hitting the board edge or a piece.
 * The square with a blocking piece IS included (it's attacked/defended).
 * 
 * @param chess - Chess.js instance for piece detection
 * @param file - Starting file index (0-7)
 * @param rank - Starting rank index (0-7)
 * @param directions - Array of [file_delta, rank_delta] direction vectors
 * @returns Array of attacked squares
 * 
 * @private
 */
function getSlidingAttacks(
  chess: Chess, 
  file: number, 
  rank: number, 
  directions: number[][]
): Square[] {
  const attacks: Square[] = [];
  
  for (const [df, dr] of directions) {
    let newFile = file + df;
    let newRank = rank + dr;
    
    // Slide until hitting board edge
    while (newFile >= 0 && newFile < 8 && newRank >= 0 && newRank < 8) {
      const square = coordsToSquare(newFile, newRank);
      attacks.push(square);
      
      // Stop if there's a piece (but we still count this square as attacked)
      if (chess.get(square)) {
        break;
      }
      
      newFile += df;
      newRank += dr;
    }
  }
  
  return attacks;
}

/* ============================================
 * COORDINATE UTILITIES
 * ============================================
 */

/**
 * Converts file/rank coordinates to algebraic square notation
 * 
 * @param file - File index (0-7, where 0='a')
 * @param rank - Rank index (0-7, where 0='1')
 * @returns Square in algebraic notation (e.g., 'e4')
 * 
 * @private
 */
function coordsToSquare(file: number, rank: number): Square {
  const files = 'abcdefgh';
  return (files[file] + (rank + 1)) as Square;
}

/* ============================================
 * CONTROL QUERY FUNCTIONS
 * ============================================
 */

/**
 * Determines which player controls a square based on power value
 * 
 * Requirements 7.5, 7.6:
 * - Positive power = White controls
 * - Negative power = Black controls
 * - Zero power = Neutral
 * 
 * @param power - Control power value for a square
 * @returns 'white', 'black', or 'neutral'
 * 
 * Used by: GameScene.validateCardTarget()
 */
export function getSquareController(power: number): 'white' | 'black' | 'neutral' {
  if (power > 0) return 'white';
  if (power < 0) return 'black';
  return 'neutral';
}

/**
 * Gets all squares controlled by a specific player
 * 
 * @param controlMap - Control power map from calculateControlPower()
 * @param player - Player color to check
 * @returns Array of squares controlled by the player
 * 
 * Used by: Card targeting validation
 */
export function getControlledSquares(
  controlMap: ControlPowerMap, 
  player: 'white' | 'black'
): Square[] {
  const controlled: Square[] = [];
  
  for (const square of getAllSquares()) {
    const power = controlMap[square] || 0;
    const controller = getSquareController(power);
    
    if (controller === player) {
      controlled.push(square);
    }
  }
  
  return controlled;
}

/**
 * Checks if a player controls a specific square
 * 
 * @param controlMap - Control power map from calculateControlPower()
 * @param square - Square to check
 * @param player - Player color to check
 * @returns true if the player controls the square
 * 
 * Used by: GameScene.validateCardTarget()
 */
export function playerControlsSquare(
  controlMap: ControlPowerMap,
  square: Square,
  player: 'white' | 'black'
): boolean {
  const power = controlMap[square] || 0;
  return getSquareController(power) === player;
}
