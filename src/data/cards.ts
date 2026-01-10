/**
 * @fileoverview Card Data Definitions for Card Chess
 * 
 * This file defines all card types, their properties, and provides
 * utility functions for creating cards and decks.
 * 
 * Deck Composition (60 cards total):
 * - Energy cards (24): Resource generation
 * - Piece cards (22): Deploy chess pieces
 *   - Pawn (10), Knight (4), Bishop (4), Rook (3), Queen (1)
 * - Spell cards (14): Various effects
 *   - Ponder (4), Growth (4), Slash (4), Treasure Hunt (2)
 * 
 * Requirements addressed:
 * - 11.1: Deck contains 60 cards as specified in deck composition
 * 
 * @module data/cards
 * @requires ../managers/GameStateManager
 */

import { Card, CardEffect, PieceType } from '../managers/GameStateManager';

/* ============================================
 * TYPE DEFINITIONS
 * ============================================
 */

/**
 * Card definition template (without unique ID)
 * 
 * This interface defines the static properties of a card type.
 * Individual card instances are created with unique IDs using createCard().
 * 
 * @property name - Display name of the card
 * @property type - Card category: 'energy', 'piece', or 'spell'
 * @property energyCost - Energy required to play (null for energy cards)
 * @property timeCost - Time cost in seconds (null for energy cards)
 * @property effect - The effect that triggers when the card is played
 * @property artAsset - Filename of the card illustration
 * @property frameColor - Color of the card border
 * @property quantity - Number of copies in a standard deck
 * @property description - Text describing the card's effect
 */
export interface CardDefinition {
  name: string;
  type: 'energy' | 'piece' | 'spell';
  energyCost: number | null;
  timeCost: number | null;
  effect: CardEffect;
  artAsset: string;
  frameColor: string;
  quantity: number;
  description: string;
}

/* ============================================
 * CARD DEFINITIONS
 * ============================================
 * 
 * All card types in the game, organized by category.
 * Each definition specifies the card's properties and how many
 * copies appear in a standard 60-card deck.
 */

/**
 * Complete card definitions for Card Chess
 * 
 * Card Categories:
 * 
 * ENERGY CARDS (24 total):
 * - Energy: The core resource card. Playing it increases your energy cap
 *   by 1 and immediately grants 1 energy. Only one can be played per turn.
 * 
 * PIECE CARDS (22 total):
 * - Pawn (10): Cheapest piece, costs 1 energy and 10 seconds
 * - Knight (4): Costs 3 energy and 30 seconds
 * - Bishop (4): Costs 4 energy and 40 seconds
 * - Rook (3): Costs 5 energy and 55 seconds
 * - Queen (1): Most expensive, costs 9 energy and 115 seconds
 * 
 * SPELL CARDS (14 total):
 * - Ponder (4): Draw 2 cards for 3 energy
 * - Growth (4): Increase energy cap by 1 for 2 energy
 * - Slash (4): Destroy a piece on a controlled square for 5 energy
 * - Treasure Hunt (2): Draw 4 cards for 7 energy
 * 
 * Used by: createCard(), createDeck(), CardComponent.getCardDescription()
 */
export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  /* ----------------------------------------
   * ENERGY CARDS
   * ----------------------------------------
   * The foundation of the resource system.
   * Playing an energy card increases your maximum energy
   * and immediately grants 1 energy.
   */
  energy: {
    name: 'Energy',
    type: 'energy',
    energyCost: null,      // Energy cards have no cost
    timeCost: null,        // Energy cards have no time cost
    effect: { action: 'ENERGY_CARD' },
    artAsset: 'energy.png',
    frameColor: 'gold',    // Gold frame indicates energy card
    quantity: 24,          // Most common card in deck
    description: 'Increase your energy cap by 1, then gain 1 energy.'
  },

  /* ----------------------------------------
   * PIECE CARDS
   * ----------------------------------------
   * Deploy chess pieces to squares you control.
   * Pieces cannot move on the turn they are deployed.
   * Cost scales with piece power.
   */
  pawn: {
    name: 'Pawn',
    type: 'piece',
    energyCost: 1,
    timeCost: 10,
    effect: { action: 'DEPLOY_PIECE', piece: 'p' as PieceType, requiresTarget: true },
    artAsset: 'pawn.png',
    frameColor: 'silver',  // Silver frame indicates piece card
    quantity: 10,          // Most common piece
    description: 'Deploy a Pawn to a square you control.'
  },

  knight: {
    name: 'Knight',
    type: 'piece',
    energyCost: 3,
    timeCost: 30,
    effect: { action: 'DEPLOY_PIECE', piece: 'n' as PieceType, requiresTarget: true },
    artAsset: 'knight.png',
    frameColor: 'silver',
    quantity: 4,
    description: 'Deploy a Knight to a square you control.'
  },

  bishop: {
    name: 'Bishop',
    type: 'piece',
    energyCost: 4,
    timeCost: 40,
    effect: { action: 'DEPLOY_PIECE', piece: 'b' as PieceType, requiresTarget: true },
    artAsset: 'bishop.png',
    frameColor: 'silver',
    quantity: 4,
    description: 'Deploy a Bishop to a square you control.'
  },

  rook: {
    name: 'Rook',
    type: 'piece',
    energyCost: 5,
    timeCost: 55,
    effect: { action: 'DEPLOY_PIECE', piece: 'r' as PieceType, requiresTarget: true },
    artAsset: 'rook.png',
    frameColor: 'silver',
    quantity: 4,
    description: 'Deploy a Rook to a square you control.'
  },

  queen: {
    name: 'Queen',
    type: 'piece',
    energyCost: 9,
    timeCost: 115,
    effect: { action: 'DEPLOY_PIECE', piece: 'q' as PieceType, requiresTarget: true },
    artAsset: 'queen.png',
    frameColor: 'silver',
    quantity: 1,           // Only one queen card in deck
    description: 'Deploy a Queen to a square you control.'
  },

  /* ----------------------------------------
   * SPELL CARDS
   * ----------------------------------------
   * Various utility effects that don't deploy pieces.
   * Each spell has a unique frame color.
   */
  ponder: {
    name: 'Ponder',
    type: 'spell',
    energyCost: 3,
    timeCost: 40,
    effect: { action: 'DRAW_CARDS', count: 2, respectCap: false },
    artAsset: 'ponder.png',
    frameColor: 'blue',    // Blue frame for draw spells
    quantity: 4,
    description: 'Draw 2 cards.'
  },

  growth: {
    name: 'Growth',
    type: 'spell',
    energyCost: 2,
    timeCost: 25,
    effect: { action: 'MODIFY_ENERGY_CAP', amount: 1 },
    artAsset: 'grow.png',
    frameColor: 'green',   // Green frame for growth effects
    quantity: 4,
    description: 'Increase your energy cap by 1.'
  },

  slash: {
    name: 'Slash',
    type: 'spell',
    energyCost: 5,
    timeCost: 55,
    effect: { action: 'DESTROY_PIECE', requiresTarget: true },
    artAsset: 'destroy.png',
    frameColor: 'purple',  // Purple frame for destruction spells
    quantity: 4,
    description: 'Destroy target piece on a square you control.'
  },

  treasureHunt: {
    name: 'Treasure Hunt',
    type: 'spell',
    energyCost: 7,
    timeCost: 110,
    effect: { action: 'DRAW_CARDS', count: 4, respectCap: false },
    artAsset: 'search.png',
    frameColor: 'blue',
    quantity: 1,           // Rare powerful draw spell
    description: 'Draw 4 cards.'
  }
};

/* ============================================
 * CARD ID GENERATION
 * ============================================
 * Each card instance needs a unique ID for tracking
 * in hand, deck, and discard pile.
 */

/** Counter for generating unique card IDs */
let cardIdCounter = 0;

/**
 * Generates a unique card ID
 * 
 * Algorithm: Increments a counter and returns a string in format "card_N"
 * 
 * @returns A unique card ID string
 * 
 * Used by: createCard()
 */
export function generateCardId(): string {
  return `card_${++cardIdCounter}`;
}

/**
 * Resets the card ID counter to 0
 * 
 * Used for testing to ensure consistent IDs across test runs.
 * Also called when initializing a new game to reset the counter.
 * 
 * Used by: DeckManager.initializeDeck(), test files
 */
export function resetCardIdCounter(): void {
  cardIdCounter = 0;
}

/* ============================================
 * CARD CREATION FUNCTIONS
 * ============================================
 */

/**
 * Creates a Card instance from a CardDefinition
 * 
 * Algorithm:
 * 1. Look up the definition by key
 * 2. If not found, return null
 * 3. Generate a unique ID
 * 4. Create Card object with definition properties
 * 
 * @param definitionKey - Key in CARD_DEFINITIONS (e.g., 'pawn', 'energy')
 * @returns A new Card instance or null if definition not found
 * 
 * @example
 * const pawnCard = createCard('pawn');
 * // Returns: { id: 'card_1', name: 'Pawn', type: 'piece', ... }
 * 
 * Used by: createDeck()
 */
export function createCard(definitionKey: string): Card | null {
  const definition = CARD_DEFINITIONS[definitionKey];
  if (!definition) return null;

  return {
    id: generateCardId(),
    name: definition.name,
    type: definition.type,
    energyCost: definition.energyCost,
    timeCost: definition.timeCost,
    effect: definition.effect,
    artAsset: definition.artAsset,
    frameColor: definition.frameColor
  };
}

/**
 * Creates a full deck of 60 cards based on CARD_DEFINITIONS
 * 
 * Algorithm:
 * 1. Iterate through all card definitions
 * 2. For each definition, create 'quantity' copies
 * 3. Add each card to the deck array
 * 4. Return the complete deck (unshuffled)
 * 
 * @returns Array of 60 Card instances
 * 
 * @example
 * const deck = createDeck();
 * // Returns array of 60 cards (24 energy, 22 pieces, 14 spells)
 * 
 * Used by: DeckManager.initializeDeck()
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const [key, definition] of Object.entries(CARD_DEFINITIONS)) {
    // Create 'quantity' copies of each card type
    for (let i = 0; i < definition.quantity; i++) {
      const card = createCard(key);
      if (card) {
        deck.push(card);
      }
    }
  }

  return deck;
}

/* ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Gets the total card count in deck composition
 * 
 * Sums up the quantity of all card definitions.
 * Should always return 60 for a standard deck.
 * 
 * @returns Total number of cards in a deck
 * 
 * Used by: Tests to verify deck composition
 */
export function getTotalDeckSize(): number {
  return Object.values(CARD_DEFINITIONS).reduce(
    (sum, def) => sum + def.quantity,
    0
  );
}

/**
 * Gets a card definition by its display name
 * 
 * @param name - The card's display name (e.g., 'Pawn', 'Energy')
 * @returns The CardDefinition or null if not found
 * 
 * Used by: CardComponent.getCardDescription()
 */
export function getCardDefinitionByName(name: string): CardDefinition | null {
  for (const definition of Object.values(CARD_DEFINITIONS)) {
    if (definition.name === name) {
      return definition;
    }
  }
  return null;
}

/**
 * Checks if a card requires a target to be played
 * 
 * Cards that require targets:
 * - Piece cards (need a square to deploy to)
 * - Slash spell (needs a piece to destroy)
 * 
 * @param card - The card to check
 * @returns True if the card requires a target square
 * 
 * Used by: CardTargetingComponent, GameScene.handleCardPlay()
 */
export function cardRequiresTarget(card: Card): boolean {
  const effect = card.effect;
  return 'requiresTarget' in effect && effect.requiresTarget === true;
}
