/**
 * Property-based tests for DeckManager
 * Uses fast-check for property testing
 * 
 * Feature: card-chess
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { DeckManager, DECK_SIZE, MAX_HAND_SIZE } from './DeckManager';
import { resetCardIdCounter } from '../data/cards';

/**
 * Property: Deck integrity after shuffle
 * For any deck, shuffling SHALL preserve all cards (same count and same card IDs).
 * 
 * **Validates: Requirements 11.2**
 */
describe('Property: Deck integrity after shuffle', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  it('shuffle preserves total card count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // number of shuffles
        (shuffleCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          const initialCount = manager.getTotalCardCount();
          expect(initialCount).toBe(DECK_SIZE);
          
          // Perform multiple shuffles
          for (let i = 0; i < shuffleCount; i++) {
            manager.shuffle();
          }
          
          // Total count should remain the same
          expect(manager.getTotalCardCount()).toBe(DECK_SIZE);
          expect(manager.getDeckSize()).toBe(DECK_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shuffle preserves all card IDs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // number of shuffles
        (shuffleCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Get all card IDs before shuffle
          const idsBefore = new Set(manager.getDeck().map(c => c.id));
          
          // Perform shuffles
          for (let i = 0; i < shuffleCount; i++) {
            manager.shuffle();
          }
          
          // Get all card IDs after shuffle
          const idsAfter = new Set(manager.getDeck().map(c => c.id));
          
          // Same IDs should exist
          expect(idsAfter.size).toBe(idsBefore.size);
          for (const id of idsBefore) {
            expect(idsAfter.has(id)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shuffle preserves card type distribution', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // number of shuffles
        (shuffleCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Count card types before shuffle
          const countTypesBefore = (deck: ReturnType<typeof manager.getDeck>) => {
            const counts: Record<string, number> = {};
            for (const card of deck) {
              counts[card.name] = (counts[card.name] || 0) + 1;
            }
            return counts;
          };
          
          const typesBefore = countTypesBefore(manager.getDeck());
          
          // Perform shuffles
          for (let i = 0; i < shuffleCount; i++) {
            manager.shuffle();
          }
          
          const typesAfter = countTypesBefore(manager.getDeck());
          
          // Same distribution should exist
          expect(typesAfter).toEqual(typesBefore);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deck integrity maintained through draw and discard operations', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ type: fc.constant('draw' as const), count: fc.integer({ min: 1, max: 5 }) }),
            fc.record({ type: fc.constant('shuffle' as const) }),
            fc.record({ type: fc.constant('discardToMax' as const) })
          ),
          { minLength: 1, maxLength: 20 }
        ),
        (operations) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          for (const op of operations) {
            if (op.type === 'draw') {
              manager.draw(op.count, false);
            } else if (op.type === 'shuffle') {
              manager.shuffle();
            } else if (op.type === 'discardToMax') {
              manager.discardToHandSize();
            }
            
            // Invariant: total cards always equals DECK_SIZE
            expect(manager.getTotalCardCount()).toBe(DECK_SIZE);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shuffle changes card order (statistical test)', () => {
    // This is a statistical property - shuffling should usually change order
    let orderChangedCount = 0;
    const trials = 100;
    
    for (let i = 0; i < trials; i++) {
      resetCardIdCounter();
      const manager = new DeckManager();
      manager.initializeDeck();
      
      const orderBefore = manager.getDeck().map(c => c.id).join(',');
      manager.shuffle();
      const orderAfter = manager.getDeck().map(c => c.id).join(',');
      
      if (orderBefore !== orderAfter) {
        orderChangedCount++;
      }
    }
    
    // At least 95% of shuffles should change order (very conservative)
    expect(orderChangedCount).toBeGreaterThan(trials * 0.95);
  });
});

/**
 * Additional deck operation properties
 */
describe('Deck Operations Properties', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  it('draw respects hand cap when respectCap is true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // cards to draw
        (drawCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Draw with cap respected
          manager.draw(drawCount, true);
          
          // Hand should never exceed MAX_HAND_SIZE
          expect(manager.getHandSize()).toBeLessThanOrEqual(MAX_HAND_SIZE);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('draw ignores hand cap when respectCap is false', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_HAND_SIZE + 1, max: 30 }), // cards to draw (more than max)
        (drawCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Draw without cap
          const drawn = manager.draw(drawCount, false);
          
          // Should draw up to deck size or requested amount
          const expectedDrawn = Math.min(drawCount, DECK_SIZE);
          expect(drawn).toBe(expectedDrawn);
          expect(manager.getHandSize()).toBe(expectedDrawn);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('discardToHandSize reduces hand to MAX_HAND_SIZE', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_HAND_SIZE + 1, max: 30 }), // cards to draw (more than max)
        (drawCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Draw more than max
          manager.draw(Math.min(drawCount, DECK_SIZE), false);
          
          if (manager.getHandSize() > MAX_HAND_SIZE) {
            const discarded = manager.discardToHandSize();
            
            // Hand should now be exactly MAX_HAND_SIZE
            expect(manager.getHandSize()).toBe(MAX_HAND_SIZE);
            // Discarded cards should be in discard pile
            expect(manager.getDiscardSize()).toBe(discarded.length);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('drawing from empty deck returns 0', () => {
    const manager = new DeckManager();
    manager.initializeDeck();
    
    // Draw entire deck
    manager.draw(DECK_SIZE, false);
    expect(manager.isDeckEmpty()).toBe(true);
    
    // Try to draw more
    const drawn = manager.draw(5, false);
    expect(drawn).toBe(0);
  });

  it('card removal and discard maintains integrity', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // cards to draw
        (drawCount) => {
          const manager = new DeckManager();
          manager.initializeDeck();
          
          // Draw some cards
          manager.draw(drawCount, false);
          
          const hand = manager.getHand();
          if (hand.length > 0) {
            // Remove a card from hand
            const cardToRemove = hand[0];
            const removed = manager.removeFromHand(cardToRemove.id);
            
            expect(removed).not.toBeNull();
            expect(removed?.id).toBe(cardToRemove.id);
            
            // Add to discard
            manager.addToDiscard(removed!);
            
            // Total should still be DECK_SIZE
            expect(manager.getTotalCardCount()).toBe(DECK_SIZE);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
