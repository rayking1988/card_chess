/**
 * Tests for Card UI Component Logic
 * 
 * Verifies card data structure and rendering logic
 * Note: Visual rendering tests require a browser environment
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { describe, it, expect } from 'vitest';
import { CARD_DEFINITIONS, cardRequiresTarget, createCard, createDeck, getTotalDeckSize } from '../data/cards';

describe('Card Data Validation', () => {
  it('all card definitions have required fields', () => {
    for (const def of Object.values(CARD_DEFINITIONS)) {
      expect(def.name).toBeDefined();
      expect(def.type).toMatch(/^(energy|piece|spell)$/);
      expect(def.effect).toBeDefined();
      expect(def.artAsset).toBeDefined();
      expect(def.frameColor).toBeDefined();
      expect(def.quantity).toBeGreaterThan(0);
      expect(def.description).toBeDefined();
    }
  });

  it('deck contains exactly 60 cards', () => {
    expect(getTotalDeckSize()).toBe(60);
  });

  it('createDeck generates correct number of cards', () => {
    const deck = createDeck();
    expect(deck.length).toBe(60);
  });

  it('all cards in deck have unique IDs', () => {
    const deck = createDeck();
    const ids = deck.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(deck.length);
  });

  it('card frame colors are valid', () => {
    const validColors = ['gold', 'silver', 'blue', 'green', 'purple', 'brown', 'cyan'];
    for (const def of Object.values(CARD_DEFINITIONS)) {
      expect(validColors).toContain(def.frameColor);
    }
  });
});

describe('Card Targeting Logic', () => {
  it('piece cards require target', () => {
    const pawnCard = createCard('pawn');
    const knightCard = createCard('knight');
    const bishopCard = createCard('bishop');
    const rookCard = createCard('rook');
    const queenCard = createCard('queen');
    
    expect(pawnCard).not.toBeNull();
    expect(knightCard).not.toBeNull();
    expect(bishopCard).not.toBeNull();
    expect(rookCard).not.toBeNull();
    expect(queenCard).not.toBeNull();
    
    expect(cardRequiresTarget(pawnCard!)).toBe(true);
    expect(cardRequiresTarget(knightCard!)).toBe(true);
    expect(cardRequiresTarget(bishopCard!)).toBe(true);
    expect(cardRequiresTarget(rookCard!)).toBe(true);
    expect(cardRequiresTarget(queenCard!)).toBe(true);
  });

  it('slash card requires target', () => {
    const slashCard = createCard('slash');
    expect(slashCard).not.toBeNull();
    expect(cardRequiresTarget(slashCard!)).toBe(true);
  });

  it('energy card does not require target', () => {
    const energyCard = createCard('energy');
    expect(energyCard).not.toBeNull();
    expect(cardRequiresTarget(energyCard!)).toBe(false);
  });

  it('spell cards without target do not require target', () => {
    const ponderCard = createCard('ponder');
    const growthCard = createCard('growth');
    const treasureHuntCard = createCard('treasureHunt');
    
    expect(ponderCard).not.toBeNull();
    expect(growthCard).not.toBeNull();
    expect(treasureHuntCard).not.toBeNull();
    
    expect(cardRequiresTarget(ponderCard!)).toBe(false);
    expect(cardRequiresTarget(growthCard!)).toBe(false);
    expect(cardRequiresTarget(treasureHuntCard!)).toBe(false);
  });
});

describe('Card Cost Validation', () => {
  it('energy cards have no costs', () => {
    const energyCard = createCard('energy');
    expect(energyCard).not.toBeNull();
    expect(energyCard!.energyCost).toBeNull();
    expect(energyCard!.timeCost).toBeNull();
  });

  it('piece cards have both energy and time costs', () => {
    const pieceCards = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
    
    for (const cardKey of pieceCards) {
      const card = createCard(cardKey);
      expect(card).not.toBeNull();
      expect(card!.energyCost).not.toBeNull();
      expect(card!.energyCost).toBeGreaterThan(0);
      expect(card!.timeCost).not.toBeNull();
      expect(card!.timeCost).toBeGreaterThan(0);
    }
  });

  it('spell cards have both energy and time costs', () => {
    const spellCards = ['ponder', 'growth', 'slash', 'treasureHunt'];
    
    for (const cardKey of spellCards) {
      const card = createCard(cardKey);
      expect(card).not.toBeNull();
      expect(card!.energyCost).not.toBeNull();
      expect(card!.energyCost).toBeGreaterThan(0);
      expect(card!.timeCost).not.toBeNull();
      expect(card!.timeCost).toBeGreaterThan(0);
    }
  });

  it('piece costs scale with piece value', () => {
    const pawn = createCard('pawn');
    const knight = createCard('knight');
    const bishop = createCard('bishop');
    const rook = createCard('rook');
    const queen = createCard('queen');
    
    // Pawn should be cheapest
    expect(pawn!.energyCost).toBeLessThan(knight!.energyCost!);
    // Knight and Bishop similar
    expect(knight!.energyCost).toBeLessThanOrEqual(bishop!.energyCost!);
    // Rook more expensive
    expect(bishop!.energyCost).toBeLessThan(rook!.energyCost!);
    // Queen most expensive
    expect(rook!.energyCost).toBeLessThan(queen!.energyCost!);
  });
});

describe('Card Type Distribution', () => {
  it('deck has correct card type distribution', () => {
    const deck = createDeck();
    
    const energyCount = deck.filter(c => c.type === 'energy').length;
    const pieceCount = deck.filter(c => c.type === 'piece').length;
    const spellCount = deck.filter(c => c.type === 'spell').length;
    
    // Based on CARD_DEFINITIONS quantities
    expect(energyCount).toBe(24);
    expect(pieceCount).toBe(22); // 10 pawns + 4 knights + 4 bishops + 3 rooks + 1 queen
    expect(spellCount).toBe(14); // 4 ponder + 4 growth + 4 slash + 2 treasure hunt
  });
});
