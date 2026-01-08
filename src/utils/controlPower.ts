/**
 * Control Power Calculation Utility
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7
 * - 7.1: Calculate +1 control power for ranks 1-2 (White's home)
 * - 7.2: Calculate -1 control power for ranks 7-8 (Black's home)
 * - 7.3: Add +1 for each square attacked by White pieces
 * - 7.4: Subtract 1 for each square attacked by Black pieces
 * - 7.5: Square controlled by White when control power > 0
 * - 7.6: Square controlled by Black when control power < 0
 * - 7.7: Render overlay on board when player holds control power button
 */

import { Chess, Square, Color } from 'chess.js';
import { getAllSquares, ChessBoardWrapper, ControlPowerMap } from './chessWrapper';

/**
 * Calculate control power for all squares on the board
 * 
 * Control power is calculated as:
 * - Base: +1 for ranks 1-2 (White's home), -1 for ranks 7-8 (Black's home)
 * - Attack: +1 for each White piece attacking, -1 for each Black piece attacking
 * 
 * @param wrapper - ChessBoardWrapper instance
 * @returns ControlPowerMap with power values for each square
 */
export function calculateControlPower(wrapper: ChessBoardWrapper): ControlPowerMap {
  const controlMap: ControlPowerMap = {};
  const chess = wrapper.getChessInstance();
  
  // Calculate attacked squares for each color
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


/**
 * Get a map of how many times each square is attacked by pieces of a given color
 * 
 * @param chess - Chess.js instance
 * @param color - Color to check attacks for
 * @returns Map of square -> attack count
 */
function getAttackMap(chess: Chess, color: Color): Map<Square, number> {
  const attackMap = new Map<Square, number>();
  
  // We need to check attacks from each piece's perspective
  // chess.js moves() returns legal moves, but we need attacked squares
  // which includes squares defended by same-color pieces
  
  for (const square of getAllSquares()) {
    const piece = chess.get(square);
    if (!piece || piece.color !== color) continue;
    
    // Get squares this piece attacks
    const attackedSquares = getAttackedSquaresByPiece(chess, square, piece.type, color);
    
    for (const attackedSquare of attackedSquares) {
      const current = attackMap.get(attackedSquare) || 0;
      attackMap.set(attackedSquare, current + 1);
    }
  }
  
  return attackMap;
}

/**
 * Get squares attacked by a specific piece (including defended squares)
 * This is different from legal moves - it includes squares with same-color pieces
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
    case 'p': // Pawn
      attacked.push(...getPawnAttacks(file, rank, color));
      break;
    case 'n': // Knight
      attacked.push(...getKnightAttacks(file, rank));
      break;
    case 'b': // Bishop
      attacked.push(...getSlidingAttacks(chess, file, rank, [[-1,-1], [-1,1], [1,-1], [1,1]]));
      break;
    case 'r': // Rook
      attacked.push(...getSlidingAttacks(chess, file, rank, [[-1,0], [1,0], [0,-1], [0,1]]));
      break;
    case 'q': // Queen
      attacked.push(...getSlidingAttacks(chess, file, rank, [
        [-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]
      ]));
      break;
    case 'k': // King
      attacked.push(...getKingAttacks(file, rank));
      break;
  }
  
  return attacked;
}

/**
 * Get pawn attack squares (diagonal captures only)
 */
function getPawnAttacks(file: number, rank: number, color: Color): Square[] {
  const attacks: Square[] = [];
  const direction = color === 'w' ? 1 : -1;
  const newRank = rank + direction;
  
  if (newRank >= 0 && newRank < 8) {
    if (file > 0) {
      attacks.push(coordsToSquare(file - 1, newRank));
    }
    if (file < 7) {
      attacks.push(coordsToSquare(file + 1, newRank));
    }
  }
  
  return attacks;
}

/**
 * Get knight attack squares
 */
function getKnightAttacks(file: number, rank: number): Square[] {
  const attacks: Square[] = [];
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
 * Get king attack squares
 */
function getKingAttacks(file: number, rank: number): Square[] {
  const attacks: Square[] = [];
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
 * Get sliding piece attacks (bishop, rook, queen)
 * Stops at first piece encountered (but includes that square)
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

/**
 * Convert file/rank coordinates to square notation
 */
function coordsToSquare(file: number, rank: number): Square {
  const files = 'abcdefgh';
  return (files[file] + (rank + 1)) as Square;
}

/**
 * Determine which player controls a square
 * 
 * @param power - Control power value
 * @returns 'white' if power > 0, 'black' if power < 0, 'neutral' if power === 0
 */
export function getSquareController(power: number): 'white' | 'black' | 'neutral' {
  if (power > 0) return 'white';
  if (power < 0) return 'black';
  return 'neutral';
}

/**
 * Get all squares controlled by a specific player
 * 
 * @param controlMap - Control power map
 * @param player - Player color to check
 * @returns Array of squares controlled by the player
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
 * Check if a player controls a specific square
 * 
 * @param controlMap - Control power map
 * @param square - Square to check
 * @param player - Player color to check
 * @returns true if the player controls the square
 */
export function playerControlsSquare(
  controlMap: ControlPowerMap,
  square: Square,
  player: 'white' | 'black'
): boolean {
  const power = controlMap[square] || 0;
  return getSquareController(power) === player;
}
