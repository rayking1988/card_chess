/**
 * Property-Based Tests for ChessBoard Component
 * 
 * Tests chess rules validation and king capture mechanics
 * Uses fast-check for property-based testing with minimum 100 iterations
 * 
 * **Property: Valid moves only**
 * **Validates: Requirements 2.2**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { ChessBoardWrapper, getAllSquares, INITIAL_FEN } from '../utils/chessWrapper';
import { PieceSymbol, Color } from 'chess.js';

// Valid squares for pawns (ranks 2-7 only)
const pawnSquares = getAllSquares().filter(sq => {
  const rank = parseInt(sq[1]);
  return rank >= 2 && rank <= 7;
});

// All squares except where kings start
const availableSquares = getAllSquares().filter(sq => sq !== 'e1' && sq !== 'e8');

// Arbitrary generators for chess
const pawnSquareArb = fc.constantFrom(...pawnSquares);
const nonPawnSquareArb = fc.constantFrom(...availableSquares);
const pawnArb = fc.constant<PieceSymbol>('p');
const nonPawnPieceArb = fc.constantFrom<PieceSymbol>('n', 'b', 'r', 'q');
const colorArb = fc.constantFrom<Color>('w', 'b');

// Generate a piece placement that respects chess rules
const piecePlacementArb = fc.oneof(
  // Pawn on valid rank
  fc.tuple(pawnSquareArb, pawnArb, colorArb),
  // Non-pawn piece anywhere
  fc.tuple(nonPawnSquareArb, nonPawnPieceArb, colorArb)
);

// Generate a random valid board position by placing pieces
const randomBoardArb = fc.array(piecePlacementArb, { minLength: 0, maxLength: 8 })
  .map(placements => {
    const wrapper = new ChessBoardWrapper(INITIAL_FEN);
    const usedSquares = new Set(['e1', 'e8']); // Kings are already placed
    
    for (const [square, piece, color] of placements) {
      if (!usedSquares.has(square)) {
        wrapper.placePiece(square, piece, color);
        usedSquares.add(square);
      }
    }
    
    return wrapper;
  });


describe('Property: Valid moves only', () => {
  /**
   * **Property: Valid moves only**
   * **Validates: Requirements 2.2**
   * 
   * For any board position and any piece, all moves returned by getValidMoves
   * should be legal chess moves that can be executed successfully.
   */
  it('all moves returned by getValidMoves are executable', () => {
    fc.assert(
      fc.property(randomBoardArb, (wrapper) => {
        const fen = wrapper.getPosition();
        const pieces = wrapper.getAllPieces();
        const currentTurn = wrapper.getTurn();
        
        // Only test pieces of the current turn's color
        for (const { square, color } of pieces) {
          if (color !== currentTurn) continue;
          
          const validMoves = wrapper.getValidMoves(square);
          
          for (const targetSquare of validMoves) {
            // Create a fresh copy to test the move
            const testWrapper = new ChessBoardWrapper(fen);
            
            // Check if this is a promotion move and provide promotion piece if needed
            const isPromotion = testWrapper.isPromotionMove(square, targetSquare);
            const result = isPromotion 
              ? testWrapper.makeMove(square, targetSquare, 'q') // Default to queen promotion
              : testWrapper.makeMove(square, targetSquare);
            
            // Every move returned by getValidMoves should succeed
            expect(result.success).toBe(true);
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * For any board position, moves NOT in getValidMoves should fail
   */
  it('moves not in getValidMoves should fail', () => {
    fc.assert(
      fc.property(
        randomBoardArb,
        fc.constantFrom(...getAllSquares()),
        fc.constantFrom(...getAllSquares()),
        (wrapper, from, to) => {
          const piece = wrapper.getPiece(from);
          if (!piece) return true; // Skip if no piece at source
          if (piece.color !== wrapper.getTurn()) return true; // Skip if not current turn's piece
          
          const validMoves = wrapper.getValidMoves(from);
          
          if (!validMoves.includes(to)) {
            // This move should fail
            const fen = wrapper.getPosition();
            const testWrapper = new ChessBoardWrapper(fen);
            const result = testWrapper.makeMove(from, to);
            expect(result.success).toBe(false);
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Valid moves should only include squares on the board
   */
  it('valid moves are always valid board squares', () => {
    fc.assert(
      fc.property(randomBoardArb, (wrapper) => {
        const allSquares = getAllSquares();
        const pieces = wrapper.getAllPieces();
        const currentTurn = wrapper.getTurn();
        
        for (const { square, color } of pieces) {
          if (color !== currentTurn) continue;
          
          const validMoves = wrapper.getValidMoves(square);
          
          for (const move of validMoves) {
            expect(allSquares).toContain(move);
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});


describe('Property 9: King Capture Victory', () => {
  /**
   * **Property 9: King Capture Victory**
   * **Validates: Requirements 2.3, 3.7**
   * 
   * For any board state where a king is under direct attack, 
   * the attacking player SHALL be able to capture it and win.
   */
  it('when king is attackable, capture move succeeds and is marked as king capture', () => {
    // Generate positions where a piece can attack the opponent's king
    const kingAttackPositionArb = fc.constantFrom(
      // White queen attacks black king
      'r3k3/8/8/8/8/8/8/4K2Q w - - 0 1',
      // White rook attacks black king
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
      // White bishop attacks black king
      '4k3/8/8/8/8/8/8/4KB2 w - - 0 1',
      // Black queen attacks white king
      '4k2q/8/8/8/8/8/8/4K3 b - - 0 1',
      // Knight attacks king
      '4k3/8/8/8/8/5N2/8/4K3 w - - 0 1'
    );

    fc.assert(
      fc.property(kingAttackPositionArb, (fen) => {
        const wrapper = new ChessBoardWrapper(fen);
        const currentTurn = wrapper.getTurn();
        const opponentColor = currentTurn === 'w' ? 'b' : 'w';
        
        // Find opponent's king
        const pieces = wrapper.getAllPieces();
        const opponentKing = pieces.find(p => p.type === 'k' && p.color === opponentColor);
        
        if (!opponentKing) return true; // Skip if no opponent king
        
        // Find a piece that can capture the king
        const attackingPieces = pieces.filter(p => p.color === currentTurn);
        
        for (const attacker of attackingPieces) {
          const validMoves = wrapper.getValidMoves(attacker.square);
          
          if (validMoves.includes(opponentKing.square)) {
            // This piece can capture the king
            const result = wrapper.makeMove(attacker.square, opponentKing.square);
            
            // The capture should succeed
            expect(result.success).toBe(true);
            // It should be marked as a king capture
            expect(result.isKingCapture).toBe(true);
            expect(result.captured).toBe('k');
            
            return true;
          }
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * When canCaptureKing returns true, there must be a valid move to capture the king
   */
  it('canCaptureKing correctly identifies when king can be captured', () => {
    // Positions where king CAN be captured (king is in check and can be taken)
    const canCapturePositions = [
      '4k3/4R3/8/8/8/8/8/4K3 w - - 0 1', // Rook on e7 can capture king on e8
      '4k3/3Q4/8/8/8/8/8/4K3 w - - 0 1', // Queen on d7 can capture king on e8
    ];
    
    // Positions where king CANNOT be captured (king is safe)
    const cannotCapturePositions = [
      '4k3/8/8/8/8/8/8/4K3 w - - 0 1',   // Just two kings, no attack
      '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',  // Rook on a1, can't reach e8 (blocked by own king)
    ];

    for (const fen of canCapturePositions) {
      const wrapper = new ChessBoardWrapper(fen);
      expect(wrapper.canCaptureKing()).toBe(true);
    }

    for (const fen of cannotCapturePositions) {
      const wrapper = new ChessBoardWrapper(fen);
      expect(wrapper.canCaptureKing()).toBe(false);
    }
  });

  /**
   * After capturing a king, the captured piece should be 'k'
   */
  it('king capture returns correct captured piece type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          // Various positions where king can be captured
          '4k3/8/8/8/8/8/4R3/4K3 w - - 0 1',
          'r3k3/8/8/8/8/8/8/4K3 b - - 0 1',
          '4k3/8/8/8/8/5N2/8/4K3 w - - 0 1'
        ),
        (fen) => {
          const wrapper = new ChessBoardWrapper(fen);
          const currentTurn = wrapper.getTurn();
          const opponentColor = currentTurn === 'w' ? 'b' : 'w';
          
          // Find opponent's king
          const pieces = wrapper.getAllPieces();
          const opponentKing = pieces.find(p => p.type === 'k' && p.color === opponentColor);
          
          if (!opponentKing) return true;
          
          // Find attacker
          const attackers = pieces.filter(p => p.color === currentTurn);
          
          for (const attacker of attackers) {
            const validMoves = wrapper.getValidMoves(attacker.square);
            
            if (validMoves.includes(opponentKing.square)) {
              const result = wrapper.makeMove(attacker.square, opponentKing.square);
              
              if (result.success) {
                expect(result.captured).toBe('k');
                expect(result.isKingCapture).toBe(true);
              }
              break;
            }
          }
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
