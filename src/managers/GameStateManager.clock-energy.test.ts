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
  INITIAL_CLOCK_SECONDS,
  MOVE_TIME_COST,
} from './GameStateManager';

/**
 * Property 1: Clock Time Conservation
 * For any sequence of card plays and moves, the total time deducted from a player's 
 * clock SHALL equal the sum of all card time costs plus 3s after the move is made.
 * 
 * **Validates: Requirements 4.3, 4.7**
 */
describe('Property 1: Clock Time Conservation', () => {
  it('total time deducted equals sum of all time costs', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of time costs (simulating card plays)
        fc.array(fc.integer({ min: 1, max: 120 }), { minLength: 0, maxLength: 20 }),
        // Whether to include a move at the end
        fc.boolean(),
        (timeCosts, includeMove) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          const initialClock = manager.getClockTime('white');
          
          // Apply all time costs
          let expectedDeduction = 0;
          for (const cost of timeCosts) {
            manager.deductTime('white', cost);
            expectedDeduction += cost;
          }
          
          // Optionally add move cost
          if (includeMove) {
            manager.deductMoveTimeCost('white');
            expectedDeduction += MOVE_TIME_COST;
          }
          
          const finalClock = manager.getClockTime('white');
          const actualDeduction = initialClock - finalClock;
          
          // Clock should never go below 0
          expect(finalClock).toBeGreaterThanOrEqual(0);
          
          // If clock didn't hit 0, deduction should match exactly
          if (expectedDeduction <= initialClock) {
            expect(actualDeduction).toBe(expectedDeduction);
          } else {
            // If we would have gone negative, clock should be 0
            expect(finalClock).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('move time cost is always exactly 3 seconds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500 }), // initial clock offset
        (offset) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set a specific clock time
          const testClock = INITIAL_CLOCK_SECONDS - offset;
          if (testClock > MOVE_TIME_COST) {
            // Manually set clock by deducting
            manager.deductTime('white', offset);
            const beforeMove = manager.getClockTime('white');
            
            manager.deductMoveTimeCost('white');
            const afterMove = manager.getClockTime('white');
            
            expect(beforeMove - afterMove).toBe(MOVE_TIME_COST);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('clock never goes negative', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 50 }),
        (timeCosts) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          for (const cost of timeCosts) {
            manager.deductTime('white', cost);
            expect(manager.getClockTime('white')).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 2: Energy Balance
 * For any game state, a player's current energy SHALL be less than or equal to 
 * their energy cap, and both values SHALL be non-negative.
 * 
 * **Validates: Requirements 6.2, 6.3, 6.5**
 */


describe('Property 2: Energy Balance', () => {
  it('energy is always <= energyCap and both are non-negative', () => {
    // Define operation types for type safety
    type EnergyOp = 
      | { type: 'addCap'; amount: number }
      | { type: 'addEnergy'; amount: number }
      | { type: 'deductEnergy'; amount: number }
      | { type: 'playEnergyCard' };

    fc.assert(
      fc.property(
        // Generate a sequence of energy operations
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('addCap' as const), amount: fc.integer({ min: 1, max: 10 }) }),
            fc.record({ type: fc.constant('addEnergy' as const), amount: fc.integer({ min: 1, max: 10 }) }),
            fc.record({ type: fc.constant('deductEnergy' as const), amount: fc.integer({ min: 1, max: 10 }) }),
            fc.record({ type: fc.constant('playEnergyCard' as const) })
          ) as fc.Arbitrary<EnergyOp>,
          { minLength: 0, maxLength: 30 }
        ),
        (operations) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          for (const op of operations) {
            if (op.type === 'addCap') {
              manager.modifyEnergyCap('white', op.amount);
            } else if (op.type === 'addEnergy') {
              manager.addEnergy('white', op.amount);
            } else if (op.type === 'deductEnergy') {
              manager.deductEnergy('white', op.amount);
            } else if (op.type === 'playEnergyCard') {
              // Reset turn flag to allow multiple energy cards for testing
              const state = manager.getState();
              state.players.white.energyPlayedThisTurn = false;
              manager.importState(state);
              manager.playEnergyCard('white');
            }
            
            // Invariant: energy <= energyCap
            expect(manager.getEnergy('white')).toBeLessThanOrEqual(manager.getEnergyCap('white'));
            // Invariant: energy >= 0
            expect(manager.getEnergy('white')).toBeGreaterThanOrEqual(0);
            // Invariant: energyCap >= 0
            expect(manager.getEnergyCap('white')).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('energy card increases cap by 1 then energy by 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }), // initial cap
        fc.integer({ min: 0, max: 20 }), // initial energy (will be capped)
        (initialCap, initialEnergy) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set initial state
          manager.modifyEnergyCap('white', initialCap);
          manager.addEnergy('white', initialEnergy);
          
          const capBefore = manager.getEnergyCap('white');
          const energyBefore = manager.getEnergy('white');
          
          // Play energy card
          manager.playEnergyCard('white');
          
          const capAfter = manager.getEnergyCap('white');
          const energyAfter = manager.getEnergy('white');
          
          // Cap should increase by 1
          expect(capAfter).toBe(capBefore + 1);
          // Energy should increase by 1 (capped at new cap)
          expect(energyAfter).toBe(Math.min(capAfter, energyBefore + 1));
          // Energy should still be <= cap
          expect(energyAfter).toBeLessThanOrEqual(capAfter);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deducting energy fails if insufficient', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // energy cap
        fc.integer({ min: 0, max: 10 }), // current energy (will be capped)
        fc.integer({ min: 1, max: 20 }), // amount to deduct
        (cap, energy, deductAmount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          manager.modifyEnergyCap('white', cap);
          manager.addEnergy('white', energy);
          
          const actualEnergy = manager.getEnergy('white');
          const energyBefore = actualEnergy;
          
          const success = manager.deductEnergy('white', deductAmount);
          
          if (deductAmount <= energyBefore) {
            // Should succeed
            expect(success).toBe(true);
            expect(manager.getEnergy('white')).toBe(energyBefore - deductAmount);
          } else {
            // Should fail and energy unchanged
            expect(success).toBe(false);
            expect(manager.getEnergy('white')).toBe(energyBefore);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 12: Energy Refill at Turn Start
 * At the beginning of each turn, the player's energy SHALL be refilled to their energy cap.
 * 
 * **Validates: New Rule - Energy refill at turn start**
 */
describe('Property 12: Energy Refill at Turn Start', () => {
  // Helper to create a dummy card for deck setup (to avoid empty deck penalty)
  const createDummyCard = (id: string) => ({
    id,
    name: 'Dummy',
    type: 'spell' as const,
    energyCost: 0,
    timeCost: 0,
    effect: { action: 'SHUFFLE_DECK' as const },
    artAsset: 'dummy',
    frameColor: 'blue'
  });

  // Helper to set up decks to avoid empty deck penalty during endTurn
  const setupDecks = (manager: GameStateManager) => {
    const dummyDeck = Array.from({ length: 10 }, (_, i) => createDummyCard(`dummy-${i}`));
    manager.setDeck('white', [...dummyDeck]);
    manager.setDeck('black', [...dummyDeck]);
  };

  it('energy is refilled to cap at turn start', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // energy cap for white
        fc.integer({ min: 1, max: 10 }), // energy cap for black
        fc.integer({ min: 0, max: 10 }), // energy spent (will be deducted)
        (whiteCap, blackCap, spent) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up decks to avoid empty deck penalty
          setupDecks(manager);
          
          // Set up energy caps for both players BEFORE any turn ends
          manager.modifyEnergyCap('white', whiteCap);
          manager.modifyEnergyCap('black', blackCap);
          
          // Fill white's energy to cap
          manager.addEnergy('white', whiteCap);
          
          // Spend some energy
          const actualSpent = Math.min(spent, whiteCap);
          if (actualSpent > 0) {
            manager.deductEnergy('white', actualSpent);
          }
          
          const energyBeforeEndTurn = manager.getEnergy('white');
          expect(energyBeforeEndTurn).toBe(whiteCap - actualSpent);
          
          // End white's turn (switches to black)
          manager.endTurn();
          
          // Black's energy should be refilled to their cap at turn start
          expect(manager.getEnergy('black')).toBe(blackCap);
          
          // End black's turn (switches back to white)
          manager.endTurn();
          
          // White's energy should be refilled to their cap
          expect(manager.getEnergy('white')).toBe(whiteCap);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('energy refill respects current energy cap', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }), // initial cap
        fc.integer({ min: -5, max: 5 }),  // cap modification
        (initialCap, capMod) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up decks to avoid empty deck penalty
          setupDecks(manager);
          
          // Set up initial energy cap
          manager.modifyEnergyCap('white', initialCap);
          
          // Modify cap (could increase or decrease)
          if (capMod !== 0) {
            manager.modifyEnergyCap('white', capMod);
          }
          
          const finalCap = manager.getEnergyCap('white');
          
          // End turn twice to get back to white
          manager.endTurn(); // to black
          manager.endTurn(); // back to white
          
          // Energy should equal the current cap
          expect(manager.getEnergy('white')).toBe(finalCap);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('energy refill happens for both players on their turn start', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Set up decks to avoid empty deck penalty
    setupDecks(manager);
    
    // Set up energy caps
    manager.modifyEnergyCap('white', 8);
    manager.modifyEnergyCap('black', 6);
    
    // Spend all white's energy
    manager.addEnergy('white', 8);
    manager.deductEnergy('white', 8);
    expect(manager.getEnergy('white')).toBe(0);
    
    // End white's turn
    manager.endTurn();
    
    // Black's energy should be refilled to their cap
    expect(manager.getEnergy('black')).toBe(6);
    
    // Spend some of black's energy
    manager.deductEnergy('black', 4);
    expect(manager.getEnergy('black')).toBe(2);
    
    // End black's turn
    manager.endTurn();
    
    // White's energy should be refilled to their cap
    expect(manager.getEnergy('white')).toBe(8);
  });

  it('zero energy cap means zero energy at turn start', () => {
    const manager = new GameStateManager('white', 'Test White', 'Test Black');
    manager.startGame();
    
    // Set up decks to avoid empty deck penalty
    setupDecks(manager);
    
    // Don't set any energy cap (stays at 0)
    expect(manager.getEnergyCap('white')).toBe(0);
    
    // End turn twice
    manager.endTurn();
    manager.endTurn();
    
    // Energy should still be 0
    expect(manager.getEnergy('white')).toBe(0);
  });
});
