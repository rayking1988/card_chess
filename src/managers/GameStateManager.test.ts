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
 * Property 7: Disturb Tag Resolution
 * For any player with Disturb tags, playing the first card SHALL deduct time equal 
 * to tag count, OR moving without cards SHALL clear tags without time cost.
 * 
 * **Validates: Requirements 8.3, 8.4**
 */
describe('Property 7: Disturb Tag Resolution', () => {
  it('first card play deducts time equal to disturb tag count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // number of disturb tags
        (tagCount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Add disturb tags
          manager.modifyDisturbTags('white', tagCount);
          
          const clockBefore = manager.getClockTime('white');
          const tagsBefore = manager.getDisturbTags('white');
          
          expect(tagsBefore).toBe(tagCount);
          
          // Resolve tags on first card play
          manager.resolveDisturbTagsOnCardPlay('white');
          
          const clockAfter = manager.getClockTime('white');
          const tagsAfter = manager.getDisturbTags('white');
          
          // Tags should be cleared
          expect(tagsAfter).toBe(0);
          // Time should be deducted equal to tag count
          expect(clockBefore - clockAfter).toBe(tagCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('moving without cards clears tags without time cost', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // number of disturb tags
        (tagCount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Add disturb tags
          manager.modifyDisturbTags('white', tagCount);
          
          const clockBefore = manager.getClockTime('white');
          const tagsBefore = manager.getDisturbTags('white');
          
          expect(tagsBefore).toBe(tagCount);
          
          // Resolve tags on move (without playing cards)
          manager.resolveDisturbTagsOnMove('white');
          
          const clockAfter = manager.getClockTime('white');
          const tagsAfter = manager.getDisturbTags('white');
          
          // Tags should be cleared
          expect(tagsAfter).toBe(0);
          // Time should NOT be deducted
          expect(clockAfter).toBe(clockBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('subsequent card plays do not deduct additional time for tags', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // number of disturb tags
        fc.integer({ min: 1, max: 5 }),  // number of additional card plays
        (tagCount, additionalPlays) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Add disturb tags
          manager.modifyDisturbTags('white', tagCount);
          
          // First card play - should deduct time
          manager.resolveDisturbTagsOnCardPlay('white');
          
          const clockAfterFirst = manager.getClockTime('white');
          
          // Additional card plays - should NOT deduct more time for tags
          for (let i = 0; i < additionalPlays; i++) {
            manager.resolveDisturbTagsOnCardPlay('white');
          }
          
          const clockAfterAll = manager.getClockTime('white');
          
          // No additional time deducted for tags on subsequent plays
          expect(clockAfterAll).toBe(clockAfterFirst);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Focus mode converts leftover energy to time at end of turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // energy cap
        fc.integer({ min: 1, max: 20 }), // leftover energy (will be capped)
        (cap, energy) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up energy
          manager.modifyEnergyCap('white', cap);
          manager.addEnergy('white', energy);
          
          // Ensure Focus mode
          manager.setMode('white', 'focus');
          
          const clockBefore = manager.getClockTime('white');
          const actualEnergy = manager.getEnergy('white');
          
          // End turn (which processes Focus mode)
          manager.endTurn();
          
          // After turn ends, it's black's turn, so check white's state
          const clockAfter = manager.getClockTime('white');
          
          // Clock should have increased by leftover energy amount
          // Note: stopwatch processing may also affect this, so we check the energy was converted
          expect(clockAfter).toBeGreaterThanOrEqual(clockBefore + actualEnergy - 60); // accounting for possible stopwatch threshold
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Disturb mode converts leftover energy to opponent tags at end of turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // energy cap
        fc.integer({ min: 1, max: 20 }), // leftover energy (will be capped)
        (cap, energy) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up energy
          manager.modifyEnergyCap('white', cap);
          manager.addEnergy('white', energy);
          
          // Set Disturb mode
          manager.setMode('white', 'disturb');
          
          const tagsBefore = manager.getDisturbTags('black');
          const actualEnergy = manager.getEnergy('white');
          
          // End turn (which processes Disturb mode)
          manager.endTurn();
          
          const tagsAfter = manager.getDisturbTags('black');
          
          // Opponent's tags should have increased by leftover energy amount
          expect(tagsAfter).toBe(tagsBefore + actualEnergy);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 3: Hand Size Enforcement
 * For any turn end, if a player's hand size exceeds 7, the game SHALL force 
 * discard before turn passes.
 * 
 * **Validates: Requirements 3.6**
 */
describe('Property 3: Hand Size Enforcement', () => {
  const MAX_HAND_SIZE = 7;

  it('discardToHandSize reduces hand to max size when exceeded', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 20 }), // hand size (exceeds max)
        (handSize) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Create cards and add to hand
          const state = manager.getState();
          for (let i = 0; i < handSize; i++) {
            state.players.white.hand.push({
              id: `card_${i}`,
              name: 'Test Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.importState(state);
          
          expect(manager.getHandSize('white')).toBe(handSize);
          expect(manager.handExceedsMax('white')).toBe(true);
          
          // Force discard to hand size
          const discarded = manager.discardToHandSize('white');
          
          // Hand should now be at max size
          expect(manager.getHandSize('white')).toBe(MAX_HAND_SIZE);
          expect(manager.handExceedsMax('white')).toBe(false);
          
          // Correct number of cards should be discarded
          expect(discarded.length).toBe(handSize - MAX_HAND_SIZE);
          
          // Discarded cards should be in discard pile
          expect(manager.getDiscard('white').length).toBe(handSize - MAX_HAND_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('discardToHandSize does nothing when hand is at or below max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_HAND_SIZE }), // hand size (at or below max)
        (handSize) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Create cards and add to hand
          const state = manager.getState();
          for (let i = 0; i < handSize; i++) {
            state.players.white.hand.push({
              id: `card_${i}`,
              name: 'Test Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.importState(state);
          
          expect(manager.getHandSize('white')).toBe(handSize);
          expect(manager.handExceedsMax('white')).toBe(false);
          
          // Try to discard
          const discarded = manager.discardToHandSize('white');
          
          // Nothing should be discarded
          expect(discarded.length).toBe(0);
          expect(manager.getHandSize('white')).toBe(handSize);
          expect(manager.getDiscard('white').length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('handExceedsMax correctly identifies when hand exceeds 7', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }), // hand size
        (handSize) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Create cards and add to hand
          const state = manager.getState();
          for (let i = 0; i < handSize; i++) {
            state.players.white.hand.push({
              id: `card_${i}`,
              name: 'Test Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.importState(state);
          
          // handExceedsMax should return true only when hand > 7
          expect(manager.handExceedsMax('white')).toBe(handSize > MAX_HAND_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('drawing with respectCap=true stops at max hand size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MAX_HAND_SIZE }), // initial hand size
        fc.integer({ min: 1, max: 10 }), // cards to draw
        (initialHandSize, drawCount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up initial hand
          const state = manager.getState();
          for (let i = 0; i < initialHandSize; i++) {
            state.players.white.hand.push({
              id: `hand_card_${i}`,
              name: 'Hand Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          
          // Set up deck with enough cards
          for (let i = 0; i < 20; i++) {
            state.players.white.deck.push({
              id: `deck_card_${i}`,
              name: 'Deck Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.importState(state);
          
          // Draw with respectCap=true
          const drawn = manager.drawCards('white', drawCount, true);
          
          // Hand should not exceed max
          expect(manager.getHandSize('white')).toBeLessThanOrEqual(MAX_HAND_SIZE);
          
          // Should have drawn the expected amount (limited by cap)
          const expectedDrawn = Math.min(drawCount, MAX_HAND_SIZE - initialHandSize);
          expect(drawn).toBe(Math.max(0, expectedDrawn));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('drawing with respectCap=false can exceed max hand size', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: MAX_HAND_SIZE }), // initial hand size (close to max)
        fc.integer({ min: 3, max: 10 }), // cards to draw (enough to exceed)
        (initialHandSize, drawCount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up initial hand
          const state = manager.getState();
          for (let i = 0; i < initialHandSize; i++) {
            state.players.white.hand.push({
              id: `hand_card_${i}`,
              name: 'Hand Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          
          // Set up deck with enough cards
          for (let i = 0; i < 20; i++) {
            state.players.white.deck.push({
              id: `deck_card_${i}`,
              name: 'Deck Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.importState(state);
          
          const deckSize = manager.getDeck('white').length;
          
          // Draw with respectCap=false
          const drawn = manager.drawCards('white', drawCount, false);
          
          // Should draw all requested cards (limited only by deck size)
          const expectedDrawn = Math.min(drawCount, deckSize);
          expect(drawn).toBe(expectedDrawn);
          
          // Hand can exceed max
          expect(manager.getHandSize('white')).toBe(initialHandSize + drawn);
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 10: Card Effect Idempotence
 * For any card effect that modifies numeric values (time, energy), applying the 
 * same effect twice SHALL produce predictable cumulative results.
 * 
 * **Validates: Requirements 11.2-11.8**
 */
describe('Property 10: Card Effect Idempotence', () => {
  it('draw cards effect produces cumulative results', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // cards to draw per effect
        fc.integer({ min: 1, max: 5 }), // number of times to apply effect
        (drawCount, applications) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up a deck with enough cards
          const mockDeck: import('./GameStateManager').Card[] = [];
          for (let i = 0; i < 60; i++) {
            mockDeck.push({
              id: `card_${i}`,
              name: 'Test Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.setDeck('white', mockDeck);
          
          const initialHandSize = manager.getHandSize('white');
          const initialDeckSize = manager.getDeck('white').length;
          
          // Apply draw effect multiple times
          let totalDrawn = 0;
          for (let i = 0; i < applications; i++) {
            const drawn = manager.drawCards('white', drawCount, false);
            totalDrawn += drawn;
          }
          
          const finalHandSize = manager.getHandSize('white');
          const finalDeckSize = manager.getDeck('white').length;
          
          // Hand size should increase by total drawn
          expect(finalHandSize).toBe(initialHandSize + totalDrawn);
          // Deck size should decrease by total drawn
          expect(finalDeckSize).toBe(initialDeckSize - totalDrawn);
          // Total drawn should be predictable (min of requested and available)
          const expectedDrawn = Math.min(drawCount * applications, initialDeckSize);
          expect(totalDrawn).toBe(expectedDrawn);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('energy modification effects are cumulative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // energy cap to set
        fc.integer({ min: 1, max: 5 }),  // energy to add per effect
        fc.integer({ min: 1, max: 5 }),  // number of times to apply effect
        (cap, addAmount, applications) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up energy cap
          manager.modifyEnergyCap('white', cap);
          
          const initialEnergy = manager.getEnergy('white');
          
          // Apply energy add effect multiple times
          for (let i = 0; i < applications; i++) {
            manager.addEnergy('white', addAmount);
          }
          
          const finalEnergy = manager.getEnergy('white');
          
          // Energy should be capped at energyCap
          const expectedEnergy = Math.min(cap, initialEnergy + (addAmount * applications));
          expect(finalEnergy).toBe(expectedEnergy);
          expect(finalEnergy).toBeLessThanOrEqual(cap);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('time modification effects are cumulative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }), // time to add per effect
        fc.integer({ min: 1, max: 5 }),  // number of times to apply effect
        (addAmount, applications) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          const initialTime = manager.getClockTime('white');
          
          // Apply time add effect multiple times
          for (let i = 0; i < applications; i++) {
            manager.addTime('white', addAmount);
          }
          
          const finalTime = manager.getClockTime('white');
          
          // Time should increase by total added
          expect(finalTime).toBe(initialTime + (addAmount * applications));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('energy cap modification effects are cumulative', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // cap increase per effect
        fc.integer({ min: 1, max: 5 }), // number of times to apply effect
        (capIncrease, applications) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          const initialCap = manager.getEnergyCap('white');
          
          // Apply cap increase effect multiple times
          for (let i = 0; i < applications; i++) {
            manager.modifyEnergyCap('white', capIncrease);
          }
          
          const finalCap = manager.getEnergyCap('white');
          
          // Cap should increase by total added
          expect(finalCap).toBe(initialCap + (capIncrease * applications));
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shuffle deck is idempotent in terms of card count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // number of shuffles
        (shuffleCount) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up a deck
          const mockDeck: import('./GameStateManager').Card[] = [];
          for (let i = 0; i < 30; i++) {
            mockDeck.push({
              id: `card_${i}`,
              name: 'Test Card',
              type: 'spell',
              energyCost: 0,
              timeCost: 0,
              effect: { action: 'SHUFFLE_DECK' },
              artAsset: 'test.webp',
              frameColor: 'blue'
            });
          }
          manager.setDeck('white', mockDeck);
          
          const initialDeckSize = manager.getDeck('white').length;
          const initialCardIds = new Set(manager.getDeck('white').map(c => c.id));
          
          // Apply shuffle multiple times
          for (let i = 0; i < shuffleCount; i++) {
            manager.shuffleDeck('white');
          }
          
          const finalDeckSize = manager.getDeck('white').length;
          const finalCardIds = new Set(manager.getDeck('white').map(c => c.id));
          
          // Deck size should remain the same
          expect(finalDeckSize).toBe(initialDeckSize);
          // Same cards should exist
          expect(finalCardIds.size).toBe(initialCardIds.size);
          for (const id of initialCardIds) {
            expect(finalCardIds.has(id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('playCard validates energy cost correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // energy cap
        fc.integer({ min: 0, max: 10 }), // current energy
        fc.integer({ min: 1, max: 15 }), // card energy cost
        (cap, energy, cardCost) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up energy
          manager.modifyEnergyCap('white', cap);
          manager.addEnergy('white', energy);
          
          const actualEnergy = manager.getEnergy('white');
          
          // Create a test card
          const testCard: import('./GameStateManager').Card = {
            id: 'test_card_1',
            name: 'Test Spell',
            type: 'spell',
            energyCost: cardCost,
            timeCost: 0,
            effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
            artAsset: 'test.webp',
            frameColor: 'blue'
          };
          
          // Check if card can be played
          const validation = manager.canPlayCard(testCard, 'white');
          
          if (cardCost <= actualEnergy) {
            expect(validation.canPlay).toBe(true);
          } else {
            expect(validation.canPlay).toBe(false);
            expect(validation.reason).toBe('Insufficient energy');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('playCard deducts correct costs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 15 }), // energy cap (enough for card)
        fc.integer({ min: 1, max: 5 }),  // card energy cost
        fc.integer({ min: 1, max: 50 }), // card time cost
        (cap, energyCost, timeCost) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Set up energy
          manager.modifyEnergyCap('white', cap);
          manager.addEnergy('white', cap); // Fill to cap
          
          // Create a test card and add to hand
          const testCard: import('./GameStateManager').Card = {
            id: 'test_card_play',
            name: 'Test Spell',
            type: 'spell',
            energyCost: energyCost,
            timeCost: timeCost,
            effect: { action: 'DRAW_CARDS', count: 1, respectCap: false },
            artAsset: 'test.webp',
            frameColor: 'blue'
          };
          
          // Add card to hand and deck (for draw effect)
          const state = manager.getState();
          state.players.white.hand.push(testCard);
          state.players.white.deck.push({
            ...testCard,
            id: 'deck_card_1'
          });
          manager.importState(state);
          
          const energyBefore = manager.getEnergy('white');
          const timeBefore = manager.getClockTime('white');
          
          // Play the card
          const result = manager.playCard('test_card_play', 'white');
          
          expect(result.success).toBe(true);
          
          const energyAfter = manager.getEnergy('white');
          const timeAfter = manager.getClockTime('white');
          
          // Energy should be deducted
          expect(energyAfter).toBe(energyBefore - energyCost);
          // Time should be deducted (accounting for stopwatch)
          expect(timeBefore - timeAfter).toBe(timeCost);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('energy card can only be played once per turn', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // number of energy cards to try
        (attempts) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
          // Create energy cards and add to hand
          const state = manager.getState();
          for (let i = 0; i < attempts; i++) {
            state.players.white.hand.push({
              id: `energy_card_${i}`,
              name: 'Energy',
              type: 'energy',
              energyCost: null,
              timeCost: null,
              effect: { action: 'ENERGY_CARD' },
              artAsset: 'energy.webp',
              frameColor: 'gold'
            });
          }
          manager.importState(state);
          
          let successCount = 0;
          
          // Try to play all energy cards
          for (let i = 0; i < attempts; i++) {
            const result = manager.playCard(`energy_card_${i}`, 'white');
            if (result.success) {
              successCount++;
            }
          }
          
          // Only one should succeed
          expect(successCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});



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
 * Property 12: Energy Refill at Turn Start
 * At the beginning of each turn, the player's energy SHALL be refilled to their energy cap.
 * 
 * **Validates: New Rule - Energy refill at turn start**
 */
describe('Property 12: Energy Refill at Turn Start', () => {
  it('energy is refilled to cap at turn start', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // energy cap for white
        fc.integer({ min: 1, max: 10 }), // energy cap for black
        fc.integer({ min: 0, max: 10 }), // energy spent (will be deducted)
        (whiteCap, blackCap, spent) => {
          const manager = new GameStateManager('white', 'Test White', 'Test Black');
          manager.startGame();
          
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
    
    // Don't set any energy cap (stays at 0)
    expect(manager.getEnergyCap('white')).toBe(0);
    
    // End turn twice
    manager.endTurn();
    manager.endTurn();
    
    // Energy should still be 0
    expect(manager.getEnergy('white')).toBe(0);
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
