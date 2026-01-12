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


