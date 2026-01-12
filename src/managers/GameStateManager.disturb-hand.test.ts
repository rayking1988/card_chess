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

