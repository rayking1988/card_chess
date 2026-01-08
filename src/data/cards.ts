/**
 * Card Data Definitions for Card Chess
 * 
 * Requirements: 11.1
 * - THE Deck SHALL contain 60 cards as specified in deck composition
 * 
 * Card types:
 * - Energy cards (24): Increase energy cap and current energy
 * - Piece cards (22): Deploy chess pieces to controlled squares
 * - Spell cards (14): Various effects (draw, destroy, modify)
 */

import { Card, CardEffect, PieceType } from '../managers/GameStateManager';

/**
 * Card definition template (without unique ID)
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

/**
 * All card definitions for the game
 * Total: 60 cards
 * - Energy: 24
 * - Pawn: 10
 * - Knight: 4
 * - Bishop: 4
 * - Rook: 3
 * - Queen: 1
 * - Ponder: 4
 * - Growth: 4
 * - Slash: 4
 * - Treasure Hunt: 2
 */
export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  energy: {
    name: 'Energy',
    type: 'energy',
    energyCost: null,
    timeCost: null,
    effect: { action: 'ENERGY_CARD' },
    artAsset: 'energy.png',
    frameColor: 'gold',
    quantity: 24,
    description: 'Increase your energy cap by 1, then gain 1 energy.'
  },
  pawn: {
    name: 'Pawn',
    type: 'piece',
    energyCost: 1,
    timeCost: 10,
    effect: { action: 'DEPLOY_PIECE', piece: 'p' as PieceType, requiresTarget: true },
    artAsset: 'pawn.png',
    frameColor: 'silver',
    quantity: 10,
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
    quantity: 3,
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
    quantity: 1,
    description: 'Deploy a Queen to a square you control.'
  },
  ponder: {
    name: 'Ponder',
    type: 'spell',
    energyCost: 3,
    timeCost: 40,
    effect: { action: 'DRAW_CARDS', count: 2, respectCap: false },
    artAsset: 'ponder.png',
    frameColor: 'blue',
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
    frameColor: 'green',
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
    frameColor: 'purple',
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
    quantity: 2,
    description: 'Draw 4 cards.'
  }
};

/**
 * Generate a unique card ID
 */
let cardIdCounter = 0;
export function generateCardId(): string {
  return `card_${++cardIdCounter}`;
}

/**
 * Reset card ID counter (for testing)
 */
export function resetCardIdCounter(): void {
  cardIdCounter = 0;
}

/**
 * Create a Card instance from a CardDefinition
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
 * Create a full deck of 60 cards based on CARD_DEFINITIONS
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const [key, definition] of Object.entries(CARD_DEFINITIONS)) {
    for (let i = 0; i < definition.quantity; i++) {
      const card = createCard(key);
      if (card) {
        deck.push(card);
      }
    }
  }

  return deck;
}

/**
 * Get total card count in deck composition
 */
export function getTotalDeckSize(): number {
  return Object.values(CARD_DEFINITIONS).reduce((sum, def) => sum + def.quantity, 0);
}

/**
 * Get card definition by name
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
 * Check if a card requires a target
 */
export function cardRequiresTarget(card: Card): boolean {
  const effect = card.effect;
  return 'requiresTarget' in effect && effect.requiresTarget === true;
}
