/**
 * Property-based tests for GameStateManager
 * Uses fast-check for property testing
 * 
 * Feature: card-chess
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  GameStateManager,
} from './GameStateManager';

/**
 * Property 11: Deployed Piece Movement Restriction
 * A piece deployed during a turn SHALL NOT be able to move during the same turn.
 * 
 * **Validates: New Rule - Deployed pieces cannot move same turn**
 */
describe('Property 11: Deployed Piece Movement Restriction', () => {
  it('deployed piece is tracked and cannot move same turn', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('e4', 'd4', 'c3', 'f6', 'b5', 'g3'), // deployment squares
        (square) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Initially, no pieces are deployed this turn
          expect(manager.getDeployedPiecesThisTurn('white')).toHaveLength(0);
          expect(manager.wasDeployedThisTurn('white', square)).toBe(false);
          
          // Track a deployed piece
          manager.trackDeployedPiece('white', square);
          
          // Piece should be tracked
          expect(manager.getDeployedPiecesThisTurn('white')).toContain(square);
          expect(manager.wasDeployedThisTurn('white', square)).toBe(true);
          
          // canMovePiece should return false for deployed piece
          const moveCheck = manager.canMovePiece('white', square);
          expect(moveCheck.canMove).toBe(false);
          expect(moveCheck.reason).toBe('Piece was deployed this turn and cannot move');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('deployed pieces are cleared at end of turn', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom('e4', 'd4', 'c3', 'f6', 'b5', 'g3'), { minLength: 1, maxLength: 4 }),
        (squares) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Deploy multiple pieces
          for (const square of squares) {
            manager.trackDeployedPiece('white', square);
          }
          
          // All should be tracked
          expect(manager.getDeployedPiecesThisTurn('white').length).toBe(squares.length);
          
          // End turn
          manager.endTurn();
          
          // Deployed pieces should be cleared for white
          expect(manager.getDeployedPiecesThisTurn('white')).toHaveLength(0);
          
          // All squares should now be movable
          for (const square of squares) {
            expect(manager.wasDeployedThisTurn('white', square)).toBe(false);
            expect(manager.canMovePiece('white', square).canMove).toBe(true);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('non-deployed pieces can move normally', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('e4', 'd4', 'c3', 'f6'),
        fc.constantFrom('a1', 'h8', 'b2', 'g7'),
        (deployedSquare, otherSquare) => {
          // Skip if squares are the same
          if (deployedSquare === otherSquare) return;
          
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Deploy a piece at one square
          manager.trackDeployedPiece('white', deployedSquare);
          
          // Deployed square cannot move
          expect(manager.canMovePiece('white', deployedSquare).canMove).toBe(false);
          
          // Other square can move (not deployed)
          expect(manager.canMovePiece('white', otherSquare).canMove).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('DEPLOY_PIECE effect tracks the deployed piece', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Set up energy for playing the card
    manager.modifyEnergyCap('white', 5);
    manager.addEnergy('white', 5);
    
    // Create a deploy piece card
    const deployCard: import('./GameStateManager').Card = {
      id: 'deploy_pawn_1',
      name: 'Deploy Pawn',
      type: 'piece',
      energyCost: 1,
      timeCost: 5,
      effect: { action: 'DEPLOY_PIECE', piece: 'p', requiresTarget: true },
      artAsset: 'pawn.webp',
      frameColor: 'brown'
    };
    
    // Add card to hand
    const state = manager.getState();
    state.players.white.hand.push(deployCard);
    manager.importState(state);
    
    // Play the card with target
    const result = manager.playCard('deploy_pawn_1', 'white', 'e4');
    
    expect(result.success).toBe(true);
    
    // The deployed square should be tracked
    expect(manager.wasDeployedThisTurn('white', 'e4')).toBe(true);
    expect(manager.canMovePiece('white', 'e4').canMove).toBe(false);
  });
});


/**
 * Property 13: Deployed Piece Check Restriction
 * A deployed piece SHALL NOT be allowed to directly check the opponent's king.
 * 
 * **Validates: New Rule - Deployed piece cannot give check**
 */
describe('Property 13: Deployed Piece Check Restriction', () => {
  it('detects when deployment would give check', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Standard starting position with only kings
    // White King on e1, Black King on e8
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    
    // Deploying a rook on e4 would give check to black king on e8
    const wouldCheck = manager.wouldDeploymentGiveCheck('e4', 'r', 'white', fen);
    expect(wouldCheck).toBe(true);
    
    // Deploying a rook on a4 would NOT give check
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('a4', 'r', 'white', fen);
    expect(wouldNotCheck).toBe(false);
  });

  it('detects diagonal check from bishop deployment', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Black King on e8
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    
    // Deploying a bishop on b5 would give check (diagonal to e8)
    const wouldCheck = manager.wouldDeploymentGiveCheck('b5', 'b', 'white', fen);
    expect(wouldCheck).toBe(true);
    
    // Deploying a bishop on a1 would NOT give check
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('a1', 'b', 'white', fen);
    expect(wouldNotCheck).toBe(false);
  });

  it('detects knight check from deployment', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Black King on e8
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    
    // Deploying a knight on d6 would give check (knight move to e8)
    const wouldCheck = manager.wouldDeploymentGiveCheck('d6', 'n', 'white', fen);
    expect(wouldCheck).toBe(true);
    
    // Deploying a knight on a1 would NOT give check
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('a1', 'n', 'white', fen);
    expect(wouldNotCheck).toBe(false);
  });

  it('detects queen check from deployment', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Black King on e8
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1';
    
    // Deploying a queen on e5 would give check (same file)
    const wouldCheckFile = manager.wouldDeploymentGiveCheck('e5', 'q', 'white', fen);
    expect(wouldCheckFile).toBe(true);
    
    // Deploying a queen on h5 would give check (diagonal to e8)
    const wouldCheckDiag = manager.wouldDeploymentGiveCheck('h5', 'q', 'white', fen);
    expect(wouldCheckDiag).toBe(true);
    
    // Deploying a queen on a1 would NOT give check
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('a1', 'q', 'white', fen);
    expect(wouldNotCheck).toBe(false);
  });

  it('pawn deployment check detection', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Black King on e5 (middle of board for pawn check test)
    const fen = '8/8/8/4k3/8/8/8/4K3 w - - 0 1';
    
    // Deploying a pawn on d4 would give check (pawn attacks diagonally)
    const wouldCheck = manager.wouldDeploymentGiveCheck('d4', 'p', 'white', fen);
    expect(wouldCheck).toBe(true);
    
    // Deploying a pawn on e4 would NOT give check (pawn doesn't attack forward)
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('e4', 'p', 'white', fen);
    expect(wouldNotCheck).toBe(false);
  });

  it('black player deployment check detection', () => {
    const manager = new GameStateManager('black', 'Test White', 'Test Black');
    manager.startGame();
    
    // White King on e1
    const fen = '4k3/8/8/8/8/8/8/4K3 b - - 0 1';
    
    // Black deploying a rook on e5 would give check to white king on e1
    const wouldCheck = manager.wouldDeploymentGiveCheck('e5', 'r', 'black', fen);
    expect(wouldCheck).toBe(true);
    
    // Black deploying a rook on a5 would NOT give check
    const wouldNotCheck = manager.wouldDeploymentGiveCheck('a5', 'r', 'black', fen);
    expect(wouldNotCheck).toBe(false);
  });
});
